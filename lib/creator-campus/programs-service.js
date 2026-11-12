import { Timestamp } from "firebase-admin/firestore";
import { adminDb, adminAuth } from "../firebase-admin.js";
import { reserveReferralCode, normalizeUsernamePrefix } from "./referral-registry.js";

/**
 * TICKETLELO CREATOR CAMPUS AMBASSADOR PROGRAM
 * Programs, Multi-Event Connection, Applications & Approval Service
 */

export const PROGRAM_STATUSES = ["draft", "published", "paused", "archived"];

/**
 * Creates a new Creator Campus Program in DRAFT status
 * (Never automatically active on creation)
 */
export async function createProgram({
  organizerId,
  title,
  description = "",
  logo = "",
  applicationFormId = null,
  applicationStartDate = null,
  applicationEndDate = null,
  referralSettings = {},
}) {
  if (!adminDb || !organizerId || !title) {
    throw new Error("Organizer ID and program title are required.");
  }

  const programRef = adminDb.collection("ambassadorPrograms").doc();
  const programData = {
    id: programRef.id,
    organizerId,
    title: String(title).trim(),
    description: String(description || "").trim(),
    logo: String(logo || "").trim(),
    applicationFormId: applicationFormId || null,
    applicationStartDate: applicationStartDate ? Timestamp.fromDate(new Date(applicationStartDate)) : null,
    applicationEndDate: applicationEndDate ? Timestamp.fromDate(new Date(applicationEndDate)) : null,
    referralSettings: {
      paidPoints: Number(referralSettings?.paidPoints ?? 10),
      freePoints: Number(referralSettings?.freePoints ?? 2),
      ...(referralSettings || {}),
    },
    status: "draft", // Strictly initialized as draft
    isActive: false,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  await programRef.set(programData);
  return programData;
}

/**
 * Updates an existing program with ownership validation
 */
export async function updateProgram(programId, updates, callerUid, isSuper = false) {
  if (!adminDb || !programId) throw new Error("Invalid program ID");

  const programRef = adminDb.collection("ambassadorPrograms").doc(programId);
  const snap = await programRef.get();
  if (!snap.exists) throw new Error("Program not found");

  const data = snap.data();
  if (!isSuper && data.organizerId !== callerUid && data.organizationId !== callerUid) {
    throw new Error("Unauthorized to modify this program");
  }

  // Filter allowed fields
  const allowed = [
    "title",
    "description",
    "logo",
    "applicationFormId",
    "applicationStartDate",
    "applicationEndDate",
    "referralSettings",
  ];
  const payload = { updatedAt: Timestamp.now() };

  for (const k of allowed) {
    if (updates[k] !== undefined) {
      if (k === "applicationStartDate" || k === "applicationEndDate") {
        payload[k] = updates[k] ? Timestamp.fromDate(new Date(updates[k])) : null;
      } else {
        payload[k] = updates[k];
      }
    }
  }

  await programRef.update(payload);
  return { id: programId, ...data, ...payload };
}

/**
 * Safe Lifecycle Status Transition
 */
export async function updateProgramStatus(programId, targetStatus, callerUid, isSuper = false) {
  if (!PROGRAM_STATUSES.includes(targetStatus)) {
    throw new Error(`Invalid target status: ${targetStatus}`);
  }

  const programRef = adminDb.collection("ambassadorPrograms").doc(programId);
  const snap = await programRef.get();
  if (!snap.exists) throw new Error("Program not found");

  const data = snap.data();
  if (!isSuper && data.organizerId !== callerUid && data.organizationId !== callerUid) {
    throw new Error("Unauthorized to alter program lifecycle");
  }

  const payload = {
    status: targetStatus,
    isActive: targetStatus === "published",
    updatedAt: Timestamp.now(),
  };

  if (targetStatus === "published" && !data.publishedAt) {
    payload.publishedAt = Timestamp.now();
  }

  await programRef.update(payload);
  return { id: programId, ...data, ...payload };
}

/**
 * Connect multiple events to a program with strict ownership validation
 */
export async function connectEventsToProgram({ programId, eventIds = [], organizerId }) {
  if (!adminDb || !programId || !Array.isArray(eventIds) || eventIds.length === 0) {
    throw new Error("Program ID and event IDs are required.");
  }

  const programSnap = await adminDb.collection("ambassadorPrograms").doc(programId).get();
  if (!programSnap.exists) throw new Error("Program not found");
  const progData = programSnap.data();

  if (progData.organizerId !== organizerId) {
    throw new Error("Unauthorized: Organizer does not own this program");
  }

  const results = [];

  for (const eventId of eventIds) {
    // Validate organizer owns the event
    const eventSnap = await adminDb.collection("events").doc(eventId).get();
    if (!eventSnap.exists) continue;
    const evtData = eventSnap.data();

    const isEvtOwner =
      evtData.createdBy === organizerId ||
      evtData.userId === organizerId ||
      evtData.organizerId === organizerId;

    if (!isEvtOwner) {
      console.warn(`[programs-service] Skipping event ${eventId}: organizer mismatch`);
      continue;
    }

    const relId = `${programId}_${eventId}`;
    const relRef = adminDb.collection("programEvents").doc(relId);
    const relData = {
      id: relId,
      programId,
      eventId,
      eventName: evtData.name || evtData.title || "Event",
      organizerId,
      referralEnabled: true,
      status: "connected",
      connectedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    await relRef.set(relData, { merge: true });
    results.push(relData);
  }

  return results;
}

/**
 * Disconnect an event from a program while preserving historical attribution
 */
export async function disconnectEventFromProgram({ programId, eventId, organizerId }) {
  const relId = `${programId}_${eventId}`;
  const relRef = adminDb.collection("programEvents").doc(relId);
  const snap = await relRef.get();
  if (!snap.exists) return false;

  const data = snap.data();
  if (data.organizerId !== organizerId) {
    throw new Error("Unauthorized to disconnect this event");
  }

  await relRef.update({
    status: "disconnected",
    referralEnabled: false,
    disconnectedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  return true;
}

/**
 * Toggle referral enablement for an event in a program
 */
export async function toggleEventReferral({ programId, eventId, referralEnabled, organizerId }) {
  const relId = `${programId}_${eventId}`;
  const relRef = adminDb.collection("programEvents").doc(relId);
  const snap = await relRef.get();
  if (!snap.exists) throw new Error("Event is not connected to this program");

  const data = snap.data();
  if (data.organizerId !== organizerId) {
    throw new Error("Unauthorized to modify event referral settings");
  }

  await relRef.update({
    referralEnabled: Boolean(referralEnabled),
    updatedAt: Timestamp.now(),
  });

  return true;
}

/**
 * Query whether an event has active referral functionality enabled
 */
export async function getEventReferralStatus(eventId) {
  if (!adminDb || !eventId) return { referralActive: false };

  try {
    const relSnap = await adminDb
      .collection("programEvents")
      .where("eventId", "==", eventId)
      .where("status", "==", "connected")
      .where("referralEnabled", "==", true)
      .limit(1)
      .get();

    if (relSnap.empty) {
      return { referralActive: false };
    }

    const rel = relSnap.docs[0].data();
    // Check if the parent program is published and active
    const progSnap = await adminDb.collection("ambassadorPrograms").doc(rel.programId).get();
    if (!progSnap.exists) return { referralActive: false };

    const prog = progSnap.data();
    const isActive = prog.status === "published" || prog.isActive === true;
    if (!isActive) return { referralActive: false };

    return {
      referralActive: true,
      programId: rel.programId,
      programTitle: prog.title || "Campus Ambassador Program",
    };
  } catch (err) {
    console.warn("[programs-service] Error checking event referral status:", err?.message);
    return { referralActive: false };
  }
}

/**
 * Submit an ambassador application
 */
export async function submitAmbassadorApplication({
  programId,
  userId = null,
  fullName,
  email,
  whatsappPhone = "",
  college = "",
  answers = {},
}) {
  if (!adminDb || !programId || !email) {
    throw new Error("Program ID and applicant email are required");
  }

  const progSnap = await adminDb.collection("ambassadorPrograms").doc(programId).get();
  if (!progSnap.exists) throw new Error("Program not found");
  const progData = progSnap.data();

  if (progData.status !== "published" && progData.isActive !== true) {
    throw new Error("This ambassador program is not currently accepting applications.");
  }

  const cleanEmail = email.trim().toLowerCase();

  // Prevent duplicate pending applications
  const existingApp = await adminDb
    .collection("ambassadorApplications")
    .where("programId", "==", programId)
    .where("email", "==", cleanEmail)
    .where("status", "==", "pending")
    .limit(1)
    .get();

  if (!existingApp.empty) {
    throw new Error("You already have a pending application for this program.");
  }

  const appRef = adminDb.collection("ambassadorApplications").doc();
  const applicationData = {
    id: appRef.id,
    programId,
    organizerId: progData.organizerId,
    userId: userId || null,
    fullName: String(fullName || "Applicant").trim(),
    email: cleanEmail,
    whatsappPhone: String(whatsappPhone || "").replace(/\D/g, ""),
    college: String(college || "").trim(),
    answers: answers && typeof answers === "object" ? answers : {},
    status: "pending", // Strictly initialized as pending
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  await appRef.set(applicationData);
  return applicationData;
}

/**
 * Server-side Approval Flow
 * (Generates XXXX-NNNN code, creates ambassador profile, preserves user role)
 */
export async function approveAmbassadorApplication({ applicationId, callerUid, isSuper = false }) {
  if (!adminDb || !applicationId) throw new Error("Application ID required");

  const appRef = adminDb.collection("ambassadorApplications").doc(applicationId);
  const appSnap = await appRef.get();
  if (!appSnap.exists) throw new Error("Application not found");
  const app = appSnap.data();

  if (!isSuper && app.organizerId !== callerUid) {
    throw new Error("Unauthorized to approve applications for this program");
  }
  if (app.status === "approved") {
    throw new Error("This application has already been approved.");
  }

  const programId = app.programId;
  const organizerId = app.organizerId;
  let resolvedUserId = app.userId;

  // Resolve or link existing TicketLelo account
  if (!resolvedUserId && app.email) {
    try {
      const userRecord = await adminAuth.getUserByEmail(app.email);
      resolvedUserId = userRecord.uid;
    } catch {}
  }

  // 1. Transactionally reserve a unique XXXX-NNNN referral code
  const referralCode = await reserveReferralCode({
    rawNameOrUsername: app.fullName,
    email: app.email,
    userId: resolvedUserId,
    programId,
    organizerId,
  });

  // 2. Create programAmbassadors profile
  const profileRef = adminDb.collection("programAmbassadors").doc(`${programId}_${resolvedUserId || app.id}`);
  const profileData = {
    id: profileRef.id,
    applicationId,
    programId,
    organizerId,
    userId: resolvedUserId || null,
    fullName: app.fullName,
    email: app.email,
    whatsappPhone: app.whatsappPhone,
    college: app.college,
    referralCode,
    referralLink: `/discover?ref=${referralCode}`,
    totalPoints: 0,
    referralCount: 0,
    status: "active",
    approvedAt: Timestamp.now(),
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  await profileRef.set(profileData, { merge: true });

  // 3. Mark application as approved
  await appRef.update({
    status: "approved",
    referralCode,
    reviewedBy: callerUid,
    reviewedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  // 4. Update user record if exists: Grant multi-role compatibility without overwriting organizer
  if (resolvedUserId) {
    try {
      const uRef = adminDb.collection("users").doc(resolvedUserId);
      const uSnap = await uRef.get();
      if (uSnap.exists) {
        const uData = uSnap.data();
        const existingRoles = Array.isArray(uData.roles) ? uData.roles : [uData.role || "user"];
        if (!existingRoles.includes("ambassador")) {
          existingRoles.push("ambassador");
        }
        await uRef.update({
          isAmbassador: true,
          roles: existingRoles,
          updatedAt: Timestamp.now(),
        });
      }
    } catch (uErr) {
      console.warn("[programs-service] User doc role update warning:", uErr?.message);
    }
  }

  return {
    success: true,
    applicationId,
    ambassadorId: profileRef.id,
    referralCode,
  };
}

/**
 * Rejection Flow
 */
export async function rejectAmbassadorApplication({ applicationId, callerUid, rejectionReason = "", isSuper = false }) {
  if (!adminDb || !applicationId) throw new Error("Application ID required");

  const appRef = adminDb.collection("ambassadorApplications").doc(applicationId);
  const appSnap = await appRef.get();
  if (!appSnap.exists) throw new Error("Application not found");
  const app = appSnap.data();

  if (!isSuper && app.organizerId !== callerUid) {
    throw new Error("Unauthorized to reject applications for this program");
  }

  await appRef.update({
    status: "rejected",
    rejectionReason: String(rejectionReason || "").trim(),
    reviewedBy: callerUid,
    reviewedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  return { success: true, applicationId, status: "rejected" };
}
