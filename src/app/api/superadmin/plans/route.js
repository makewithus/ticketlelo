import { NextResponse } from "next/server";
import { adminDb, isFirebaseAdminReady } from "@/lib/firebase-admin";
import { getAuthenticatedUser } from "@/lib/auth-server";
import {
  PLANS,
  FACILITY_DEFINITIONS,
  getPlan,
  getFacilitiesForPlan,
} from "@/lib/plans";
import { normalizePlanId } from "@/lib/payments/commission-engine";

/**
 * Super Admin authorization guard
 */
function isAuthorizedSuperAdmin(caller) {
  if (!caller) return false;
  const emailLower = (caller.email || "").toLowerCase().trim();
  const superAdminEnv = (process.env.SUPER_ADMIN_EMAIL || "").toLowerCase().trim();
  return (
    caller.role === "superAdmin" ||
    caller.isAdmin === true ||
    emailLower === "adil4ticketlelo@gmail.com" ||
    emailLower === "superadmin@ticketlelo.com" ||
    (superAdminEnv && emailLower === superAdminEnv)
  );
}

/**
 * GET /api/superadmin/plans
 * Fetches all users from DB with their assigned plans, facilities, usage, and metrics
 */
export async function GET(request) {
  try {
    if (!isFirebaseAdminReady() || !adminDb) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
    }

    const caller = await getAuthenticatedUser(request);
    if (!isAuthorizedSuperAdmin(caller)) {
      return NextResponse.json({ error: "Super administrator access required" }, { status: 403 });
    }

    // 1. Fetch all users from Firestore
    let userDocs = [];
    try {
      const snap = await adminDb.collection("users").get();
      userDocs = snap.docs;
    } catch (err) {
      console.warn("Failed querying users collection:", err.message);
    }

    // 2. Fetch all events to compute usage metrics
    let eventsList = [];
    try {
      const eventsSnap = await adminDb.collection("events").get();
      eventsList = eventsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (err) {
      console.warn("Failed querying events:", err.message);
    }

    // 3. Fetch approved hosting requests to cross-reference college/organization names
    let hrMap = new Map();
    try {
      const hrSnap = await adminDb.collection("hostingRequests").get();
      hrSnap.docs.forEach((doc) => {
        const d = doc.data();
        const email = (d.organiserEmail || d.email || "").toLowerCase().trim();
        if (email) {
          hrMap.set(email, {
            college: d.college || d.organization || "",
            name: d.name || d.organizerName || "",
            phone: d.phone || "",
          });
        }
      });
    } catch (_) {}

    // Map events per user
    const userEventsMap = new Map();
    eventsList.forEach((ev) => {
      const ownerId = ev.organiserId || ev.createdBy || ev.userId;
      const ownerEmail = (ev.createdByEmail || "").toLowerCase().trim();

      const pushEvent = (key) => {
        if (!key) return;
        if (!userEventsMap.has(key)) userEventsMap.set(key, []);
        userEventsMap.get(key).push(ev);
      };

      if (ownerId) pushEvent(ownerId);
      if (ownerEmail) pushEvent(ownerEmail);
    });

    const now = Date.now();
    let freeCount = 0;
    let starterCount = 0;
    let proCount = 0;
    let festCount = 0;
    let limitReachedCount = 0;
    let estimatedMRR = 0;

    const users = userDocs.map((doc) => {
      const d = doc.data();
      const email = (d.email || d.loginEmail || "").trim();
      const emailLower = email.toLowerCase();
      const hrMeta = hrMap.get(emailLower) || {};

      const rawPlanId = d.plan || d.subscriptionPlan || "free";
      const planDef = getPlan(rawPlanId);
      const canonicalPlanId = planDef.id;

      // KPI tallying
      if (canonicalPlanId === "free") freeCount++;
      else if (canonicalPlanId === "starter") {
        starterCount++;
        estimatedMRR += PLANS.starter.price;
      } else if (canonicalPlanId === "pro") {
        proCount++;
        estimatedMRR += PLANS.pro.price;
      } else if (canonicalPlanId === "fest") {
        festCount++;
        estimatedMRR += PLANS.fest.price;
      }

      // Determine events created by this user
      const userEvs = userEventsMap.get(doc.id) || (emailLower ? userEventsMap.get(emailLower) : []) || [];
      const eventsUsed = userEvs.length;
      const activeEvents = userEvs.filter((e) => e.status === "live" || e.isActive === true).length;

      // Check if user is at limit
      const eventsAllowed = typeof d.eventsAllowed === "number" ? d.eventsAllowed : planDef.eventsAllowed;
      const isLimitReached = eventsAllowed !== -1 && eventsUsed >= eventsAllowed;
      if (isLimitReached) limitReachedCount++;

      // Facilities resolution: custom user facilities take precedence over base plan facilities
      const baseFacilities = getFacilitiesForPlan(canonicalPlanId);
      const userFacilities = {
        ...baseFacilities,
        ...(d.facilities || {}),
      };

      return {
        id: doc.id,
        name: d.fullName || d.displayName || d.name || hrMeta.name || "Organizer",
        email: email || "—",
        phone: d.phone || d.whatsappPhone || hrMeta.phone || "",
        college: d.college || d.organization || hrMeta.college || "General Organizer",
        role: d.role || "organiser",
        plan: canonicalPlanId,
        planName: planDef.name,
        subscriptionTier: normalizePlanId(canonicalPlanId),
        price: planDef.price,
        platformFeeRate: typeof d.platformFeeRate === "number" ? d.platformFeeRate : planDef.platformFeeRate,
        eventsAllowed,
        eventsUsed,
        activeEvents,
        participantsPerEvent: typeof d.participantsPerEvent === "number" ? d.participantsPerEvent : planDef.participantsPerEvent,
        facilities: userFacilities,
        isLimitReached,
        planStatus: d.planStatus || "active",
        planStartDate: d.planStartDate?.toDate ? d.planStartDate.toDate().toISOString() : d.planStartDate || d.createdAt?.toDate?.()?.toISOString() || null,
        planUpdatedAt: d.planUpdatedAt?.toDate ? d.planUpdatedAt.toDate().toISOString() : d.planUpdatedAt || null,
        planUpdatedBy: d.planUpdatedBy || null,
        planUpdateReason: d.planUpdateReason || null,
        createdAt: d.createdAt?.toDate ? d.createdAt.toDate().toISOString() : d.createdAt || null,
      };
    });

    // Sort by role (organisers first), then by paid plan tier, then by events used desc
    users.sort((a, b) => {
      const planWeight = { fest: 4, pro: 3, starter: 2, free: 1 };
      const wa = (planWeight[a.plan] || 0) + (a.role === "organiser" ? 10 : 0);
      const wb = (planWeight[b.plan] || 0) + (b.role === "organiser" ? 10 : 0);
      if (wb !== wa) return wb - wa;
      return (b.eventsUsed || 0) - (a.eventsUsed || 0);
    });

    const metrics = {
      totalUsers: users.length,
      freeCount,
      starterCount,
      proCount,
      festCount,
      paidCount: starterCount + proCount + festCount,
      limitReachedCount,
      estimatedMRR,
    };

    return NextResponse.json({
      success: true,
      users,
      metrics,
      planCatalog: PLANS,
      facilityDefinitions: FACILITY_DEFINITIONS,
    }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Failed to fetch superadmin plans:", error);
    return NextResponse.json({ error: error.message || "Failed to load plans" }, { status: 500 });
  }
}

/**
 * POST /api/superadmin/plans
 * Single-click or custom update of an organizer's subscription plan & allocated facilities
 */
export async function POST(request) {
  try {
    if (!isFirebaseAdminReady() || !adminDb) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
    }

    const caller = await getAuthenticatedUser(request);
    if (!isAuthorizedSuperAdmin(caller)) {
      return NextResponse.json({ error: "Super administrator access required" }, { status: 403 });
    }

    const body = await request.json();
    const { userId, planId, customOverrides, auditReason } = body;

    if (!userId || !planId) {
      return NextResponse.json({ error: "userId and planId are required" }, { status: 400 });
    }

    const userRef = adminDb.collection("users").doc(userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return NextResponse.json({ error: "Target user not found" }, { status: 404 });
    }

    const userData = userSnap.data();
    const targetPlan = getPlan(planId);
    const canonicalPlanId = targetPlan.id;

    // Resolve base facilities according to the target plan
    const baseFacilities = getFacilitiesForPlan(canonicalPlanId);
    const mergedFacilities = {
      ...baseFacilities,
      ...(customOverrides?.facilities || {}),
    };

    // Resolve limits
    const mergedEventsAllowed =
      typeof customOverrides?.eventsAllowed === "number"
        ? customOverrides.eventsAllowed
        : targetPlan.eventsAllowed;

    const mergedParticipantsPerEvent =
      typeof customOverrides?.participantsPerEvent === "number"
        ? customOverrides.participantsPerEvent
        : targetPlan.participantsPerEvent;

    const mergedPlatformFeeRate =
      typeof customOverrides?.platformFeeRate === "number"
        ? customOverrides.platformFeeRate
        : targetPlan.platformFeeRate;

    const updatePayload = {
      plan: canonicalPlanId,
      subscriptionPlan: normalizePlanId(canonicalPlanId),
      eventsAllowed: mergedEventsAllowed,
      participantsPerEvent: mergedParticipantsPerEvent,
      platformFeeRate: mergedPlatformFeeRate,
      facilities: mergedFacilities,
      planStatus: "active",
      planStartDate: userData.planStartDate || new Date(),
      planUpdatedAt: new Date(),
      planUpdatedBy: caller.email,
      planUpdateReason: auditReason || `Plan set to ${targetPlan.name} via Super Admin 1-Click Update`,
      updatedAt: new Date(),
    };

    // Apply update to user document
    await userRef.set(updatePayload, { merge: true });

    // Append to audit log
    try {
      await adminDb.collection("adminAuditLogs").add({
        action: "ORGANIZER_PLAN_UPDATED",
        targetUserId: userId,
        targetUserEmail: userData.email || userData.loginEmail || "",
        targetUserName: userData.fullName || userData.displayName || userData.name || "Organizer",
        previousPlan: userData.plan || "free",
        newPlan: canonicalPlanId,
        newPlanName: targetPlan.name,
        eventsAllowed: mergedEventsAllowed,
        participantsPerEvent: mergedParticipantsPerEvent,
        facilities: mergedFacilities,
        performedByEmail: caller.email,
        performedByUid: caller.uid,
        reason: auditReason || "Super Admin 1-Click Plan Update",
        timestamp: new Date(),
      });
    } catch (auditErr) {
      console.warn("Audit log creation warning:", auditErr.message);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully updated ${userData.fullName || userData.email || "user"}'s plan to ${targetPlan.name}`,
      plan: canonicalPlanId,
      facilities: mergedFacilities,
      eventsAllowed: mergedEventsAllowed,
      participantsPerEvent: mergedParticipantsPerEvent,
    });
  } catch (error) {
    console.error("Failed to update user plan:", error);
    return NextResponse.json({ error: error.message || "Failed to update plan" }, { status: 500 });
  }
}

/**
 * DELETE /api/superadmin/plans
 * Revokes an organizer's paid plan, reverting them back to the Free tier and reset facilities
 */
export async function DELETE(request) {
  try {
    if (!isFirebaseAdminReady() || !adminDb) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
    }

    const caller = await getAuthenticatedUser(request);
    if (!isAuthorizedSuperAdmin(caller)) {
      return NextResponse.json({ error: "Super administrator access required" }, { status: 403 });
    }

    const body = await request.json();
    const { userId, auditReason } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const userRef = adminDb.collection("users").doc(userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return NextResponse.json({ error: "Target user not found" }, { status: 404 });
    }

    const userData = userSnap.data();
    const freePlan = PLANS.free;
    const freeFacilities = getFacilitiesForPlan("free");

    const resetPayload = {
      plan: "free",
      subscriptionPlan: "START",
      eventsAllowed: freePlan.eventsAllowed,
      participantsPerEvent: freePlan.participantsPerEvent,
      platformFeeRate: freePlan.platformFeeRate,
      facilities: freeFacilities,
      planStatus: "active",
      planUpdatedAt: new Date(),
      planUpdatedBy: caller.email,
      planUpdateReason: auditReason || "Reset to Free tier by Super Admin",
      updatedAt: new Date(),
    };

    await userRef.set(resetPayload, { merge: true });

    // Append to audit log
    try {
      await adminDb.collection("adminAuditLogs").add({
        action: "ORGANIZER_PLAN_REVOKED",
        targetUserId: userId,
        targetUserEmail: userData.email || "",
        previousPlan: userData.plan || "free",
        newPlan: "free",
        performedByEmail: caller.email,
        performedByUid: caller.uid,
        reason: auditReason || "Plan revoked and reset to Free tier",
        timestamp: new Date(),
      });
    } catch (_) {}

    return NextResponse.json({
      success: true,
      message: `Reset ${userData.fullName || userData.email || "user"} back to Free plan tier`,
    });
  } catch (error) {
    console.error("Failed to revoke plan:", error);
    return NextResponse.json({ error: error.message || "Failed to revoke plan" }, { status: 500 });
  }
}

