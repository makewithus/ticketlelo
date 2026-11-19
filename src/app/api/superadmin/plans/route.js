import { NextResponse } from "next/server";
import { adminDb, isFirebaseAdminReady } from "@/lib/firebase-admin";
import { getAuthenticatedUser } from "@/lib/auth-server";
import {
  PLANS,
  FACILITY_DEFINITIONS,
  getPlan,
  getFacilitiesForPlan,
  getEffectivePlanLimits,
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
 * Helper to extract custom overrides from a user document
 */
function extractUserOverrides(userData, planDef) {
  const overrides = { ...(userData.customOverrides || {}) };

  // Reconcile legacy top-level overrides if not already in customOverrides
  if (
    overrides.eventsAllowed === undefined &&
    typeof userData.eventsAllowed === "number" &&
    userData.eventsAllowed !== planDef.eventsAllowed
  ) {
    overrides.eventsAllowed = userData.eventsAllowed;
  }

  if (
    overrides.participantsPerEvent === undefined &&
    typeof userData.participantsPerEvent === "number" &&
    userData.participantsPerEvent !== planDef.participantsPerEvent
  ) {
    overrides.participantsPerEvent = userData.participantsPerEvent;
  }

  if (
    overrides.platformFeeRate === undefined &&
    typeof userData.platformFeeRate === "number" &&
    userData.platformFeeRate !== planDef.platformFeeRate
  ) {
    overrides.platformFeeRate = userData.platformFeeRate;
  }

  if (userData.facilities && typeof userData.facilities === "object") {
    const baseFacilities = getFacilitiesForPlan(planDef.id);
    const facilityDiff = {};
    let hasDiff = false;
    for (const [key, val] of Object.entries(userData.facilities)) {
      if (baseFacilities[key] !== val) {
        facilityDiff[key] = val;
        hasDiff = true;
      }
    }
    if (hasDiff && !overrides.facilities) {
      overrides.facilities = facilityDiff;
    }
  }

  return overrides;
}

/**
 * GET /api/superadmin/plans
 * Fetches all users from DB with assigned plans, facilities, canonical usage, and custom override status
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

    // Fetch collections concurrently in parallel to avoid sequential blocking
    const [usersSnapResult, eventsSnapResult, hrSnapResult] = await Promise.allSettled([
      adminDb.collection("users").get(),
      adminDb.collection("events").get(),
      adminDb.collection("hostingRequests").get(),
    ]);

    // 1. Process all users from Firestore
    let userDocs = [];
    if (usersSnapResult.status === "fulfilled" && usersSnapResult.value) {
      userDocs = usersSnapResult.value.docs;
    } else if (usersSnapResult.status === "rejected") {
      console.warn("Failed querying users collection:", usersSnapResult.reason?.message);
    }

    const totalRegisteredUsers = userDocs.length;

    // Filter to only organiser accounts or users with an explicit plan/subscription (unless showAll is requested)
    const url = new URL(request.url);
    const showAll = url.searchParams.get("all") === "true";

    const targetUserDocs = userDocs.filter((doc) => {
      const d = doc.data() || {};
      if (d.deleted === true || d.isDeleted === true || d.status === "deleted") {
        return false;
      }
      if (showAll) return true;
      const role = (d.role || "").toLowerCase();
      return (
        role === "organiser" ||
        role === "organizer" ||
        d.isAdmin === true ||
        Boolean(d.plan) ||
        Boolean(d.subscriptionPlan)
      );
    });

    // 2. Process all events to compute usage metrics (strictly filter out deleted events)
    let eventsList = [];
    if (eventsSnapResult.status === "fulfilled" && eventsSnapResult.value) {
      eventsList = eventsSnapResult.value.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((e) => e.isDeleted !== true && e.deleted !== true && e.status !== "deleted");
    } else if (eventsSnapResult.status === "rejected") {
      console.warn("Failed querying events:", eventsSnapResult.reason?.message);
    }

    // 3. Process hosting requests to cross-reference college/organization names
    let hrMap = new Map();
    if (hrSnapResult.status === "fulfilled" && hrSnapResult.value) {
      hrSnapResult.value.docs.forEach((doc) => {
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
    } else if (hrSnapResult.status === "rejected") {
      console.warn("Failed querying hostingRequests:", hrSnapResult.reason?.message);
    }

    // Map events per user
    const userEventsMap = new Map();
    eventsList.forEach((ev) => {
      const ownerId = ev.organiserId || ev.createdBy || ev.userId || ev.organizerId;
      const ownerEmail = (ev.createdByEmail || ev.organiserEmail || ev.organizerEmail || "").toLowerCase().trim();

      const pushEvent = (key) => {
        if (!key) return;
        if (!userEventsMap.has(key)) userEventsMap.set(key, []);
        userEventsMap.get(key).push(ev);
      };

      if (ownerId) pushEvent(ownerId);
      if (ownerEmail) pushEvent(ownerEmail);
    });

    let freeCount = 0;
    let starterCount = 0;
    let proCount = 0;
    let festCount = 0;
    let limitReachedCount = 0;
    let estimatedMRR = 0;

    const users = targetUserDocs.map((doc) => {
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

      // Determine non-deleted events created by this user
      const userEvs = userEventsMap.get(doc.id) || (emailLower ? userEventsMap.get(emailLower) : []) || [];
      const eventsUsed = userEvs.length;
      const activeEvents = userEvs.filter(
        (e) =>
          e.status === "published" ||
          e.status === "live" ||
          e.isPublished === true ||
          e.published === true ||
          e.isActive === true
      ).length;

      // Resolve effective limits and custom overrides
      const effective = getEffectivePlanLimits(d);
      const eventsAllowed = effective.eventsAllowed;
      const isLimitReached = eventsAllowed !== -1 && eventsUsed >= eventsAllowed;
      const isOverLimit = eventsAllowed !== -1 && eventsUsed > eventsAllowed;
      if (isLimitReached) limitReachedCount++;

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
        platformFeeRate: effective.platformFeeRate,
        standardPlatformFeeRate: planDef.platformFeeRate,
        eventsAllowed: effective.eventsAllowed,
        standardEventsAllowed: planDef.eventsAllowed,
        hasCustomEvents: effective.hasCustomEvents,
        hasCustomOverrides: effective.hasAnyCustomOverrides,
        customOverrides: extractUserOverrides(d, planDef),
        eventsUsed,
        activeEvents,
        participantsPerEvent: effective.participantsPerEvent,
        standardParticipantsPerEvent: planDef.participantsPerEvent,
        facilities: effective.facilities,
        isLimitReached,
        isOverLimit,
        planStatus: d.planStatus || "active",
        planStartDate: d.planStartDate?.toDate ? d.planStartDate.toDate().toISOString() : d.planStartDate || d.createdAt?.toDate?.()?.toISOString() || null,
        planUpdatedAt: d.planUpdatedAt?.toDate ? d.planUpdatedAt.toDate().toISOString() : d.planUpdatedAt || null,
        planUpdatedBy: d.planUpdatedBy || null,
        planUpdateReason: d.planUpdateReason || null,
        previousSubscription: d.previousSubscription || null,
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
      totalOrganisers: users.length,
      totalRegisteredUsers,
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
 * Safe subscription transition workflow:
 * - Uses atomic Firestore transaction
 * - Preserves organizer-specific custom overrides unless explicitly configured
 * - Records full previous and new configuration snapshots
 * - Prevents double submission via requestId
 * - Supports instant rollback if action === "rollback"
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

    const body = await request.json().catch(() => ({}));
    const {
      userId,
      planId,
      preserveCustomOverrides = true,
      customOverrides = null,
      auditReason,
      action = "update",
      requestId = null,
    } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const userRef = adminDb.collection("users").doc(userId);

    // Rollback action support
    if (action === "rollback") {
      const rollbackResult = await adminDb.runTransaction(async (transaction) => {
        const snap = await transaction.get(userRef);
        if (!snap.exists) throw new Error("Target user not found");
        const userData = snap.data();
        const prev = userData.previousSubscription;
        if (!prev) throw new Error("No previous subscription found to rollback to");

        const targetPlanDef = getPlan(prev.plan);
        const restoredPayload = {
          plan: prev.plan,
          subscriptionPlan: normalizePlanId(prev.plan),
          eventsAllowed: prev.eventsAllowed,
          standardEventsAllowed: prev.standardEventsAllowed ?? targetPlanDef.eventsAllowed,
          participantsPerEvent: prev.participantsPerEvent ?? targetPlanDef.participantsPerEvent,
          platformFeeRate: prev.platformFeeRate ?? targetPlanDef.platformFeeRate,
          facilities: prev.facilities ?? getFacilitiesForPlan(prev.plan),
          customOverrides: prev.customOverrides || {},
          hasCustomOverrides: Object.keys(prev.customOverrides || {}).length > 0,
          planStatus: "active",
          planUpdatedAt: new Date(),
          planUpdatedBy: caller.email,
          planUpdateReason: auditReason || `Rollback to ${targetPlanDef.name} by Super Admin`,
          updatedAt: new Date(),
        };

        transaction.set(userRef, restoredPayload, { merge: true });

        const auditLogRef = adminDb.collection("adminAuditLogs").doc();
        transaction.set(auditLogRef, {
          action: "ORGANIZER_PLAN_ROLLED_BACK",
          targetUserId: userId,
          targetUserEmail: userData.email || "",
          restoredPlan: prev.plan,
          performedByEmail: caller.email,
          performedByUid: caller.uid,
          reason: auditReason || "Super Admin plan rollback",
          timestamp: new Date(),
        });

        return { success: true, restoredPlan: prev.plan };
      });

      return NextResponse.json(rollbackResult);
    }

    if (!planId) {
      return NextResponse.json({ error: "planId is required" }, { status: 400 });
    }

    // Atomic plan update transaction
    const transactionResult = await adminDb.runTransaction(async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists) {
        throw new Error("Target user not found");
      }

      const userData = userSnap.data();

      // Check double-submission via requestId
      if (requestId && userData.lastPlanRequestId === requestId) {
        return {
          duplicateIgnored: true,
          plan: userData.plan,
          eventsAllowed: userData.eventsAllowed,
          facilities: userData.facilities,
        };
      }

      const currentPlanId = userData.plan || "free";
      const currentPlanDef = getPlan(currentPlanId);
      const currentEffective = getEffectivePlanLimits(userData);
      const existingOverrides = extractUserOverrides(userData, currentPlanDef);

      const targetPlan = getPlan(planId);
      const canonicalPlanId = targetPlan.id;

      // Handle custom overrides:
      // If customOverrides is provided explicitly, use it.
      // Else if preserveCustomOverrides is true, retain existing overrides.
      // Else, reset to empty overrides (clean plan defaults).
      let resolvedOverrides = {};
      if (customOverrides && typeof customOverrides === "object") {
        resolvedOverrides = {
          ...(preserveCustomOverrides ? existingOverrides : {}),
          ...customOverrides,
        };
      } else if (preserveCustomOverrides !== false) {
        resolvedOverrides = { ...existingOverrides };
      }

      // Compute effective limits after applying target plan defaults and overrides
      const effectiveEventsAllowed =
        targetPlan.eventsAllowed === -1
          ? -1
          : typeof resolvedOverrides.eventsAllowed === "number"
          ? (resolvedOverrides.eventsAllowed === -1 ? -1 : Math.max(resolvedOverrides.eventsAllowed, targetPlan.eventsAllowed))
          : targetPlan.eventsAllowed;

      const effectiveParticipantsPerEvent =
        targetPlan.participantsPerEvent === -1
          ? -1
          : typeof resolvedOverrides.participantsPerEvent === "number"
          ? (resolvedOverrides.participantsPerEvent === -1 ? -1 : Math.max(resolvedOverrides.participantsPerEvent, targetPlan.participantsPerEvent))
          : targetPlan.participantsPerEvent;

      const effectivePlatformFeeRate =
        typeof resolvedOverrides.platformFeeRate === "number"
          ? resolvedOverrides.platformFeeRate
          : targetPlan.platformFeeRate;

      const baseFacilities = getFacilitiesForPlan(canonicalPlanId);
      const mergedFacilities = {
        ...baseFacilities,
        ...(resolvedOverrides.facilities || {}),
      };

      // Previous subscription snapshot
      const previousSubscription = {
        plan: currentPlanId,
        planName: currentPlanDef.name,
        subscriptionTier: normalizePlanId(currentPlanId),
        eventsAllowed: currentEffective.eventsAllowed,
        standardEventsAllowed: currentPlanDef.eventsAllowed,
        participantsPerEvent: currentEffective.participantsPerEvent,
        platformFeeRate: currentEffective.platformFeeRate,
        facilities: currentEffective.facilities,
        customOverrides: existingOverrides,
        planStartDate: userData.planStartDate || null,
        planUpdatedAt: userData.planUpdatedAt || null,
        planUpdatedBy: userData.planUpdatedBy || null,
      };

      const updatePayload = {
        plan: canonicalPlanId,
        subscriptionPlan: normalizePlanId(canonicalPlanId),
        standardEventsAllowed: targetPlan.eventsAllowed,
        eventsAllowed: effectiveEventsAllowed,
        standardParticipantsPerEvent: targetPlan.participantsPerEvent,
        participantsPerEvent: effectiveParticipantsPerEvent,
        standardPlatformFeeRate: targetPlan.platformFeeRate,
        platformFeeRate: effectivePlatformFeeRate,
        facilities: mergedFacilities,
        customOverrides: resolvedOverrides,
        hasCustomOverrides: Object.keys(resolvedOverrides).length > 0,
        previousSubscription,
        planStatus: "active",
        planStartDate: userData.planStartDate || new Date(),
        planUpdatedAt: new Date(),
        planUpdatedBy: caller.email,
        planUpdateReason: auditReason || `Plan transitioned to ${targetPlan.name} (custom overrides ${preserveCustomOverrides !== false ? "preserved" : "reset"})`,
        lastPlanRequestId: requestId || null,
        updatedAt: new Date(),
      };

      transaction.set(userRef, updatePayload, { merge: true });

      // Atomic audit logging
      const auditLogRef = adminDb.collection("adminAuditLogs").doc();
      transaction.set(auditLogRef, {
        action: "ORGANIZER_PLAN_UPDATED",
        targetUserId: userId,
        targetUserEmail: userData.email || userData.loginEmail || "",
        targetUserName: userData.fullName || userData.displayName || userData.name || "Organizer",
        previousPlan: currentPlanId,
        previousPlanName: currentPlanDef.name,
        previousSubscription,
        newPlan: canonicalPlanId,
        newPlanName: targetPlan.name,
        standardEventsAllowed: targetPlan.eventsAllowed,
        eventsAllowed: effectiveEventsAllowed,
        participantsPerEvent: effectiveParticipantsPerEvent,
        platformFeeRate: effectivePlatformFeeRate,
        facilities: mergedFacilities,
        customOverrides: resolvedOverrides,
        preserveCustomOverrides: preserveCustomOverrides !== false,
        performedByEmail: caller.email,
        performedByUid: caller.uid,
        reason: auditReason || `Plan updated to ${targetPlan.name}`,
        timestamp: new Date(),
      });

      return {
        success: true,
        message: `Successfully transitioned ${userData.fullName || userData.email || "user"}'s plan to ${targetPlan.name}`,
        plan: canonicalPlanId,
        planName: targetPlan.name,
        eventsAllowed: effectiveEventsAllowed,
        standardEventsAllowed: targetPlan.eventsAllowed,
        hasCustomEvents: effectiveEventsAllowed !== targetPlan.eventsAllowed,
        participantsPerEvent: effectiveParticipantsPerEvent,
        platformFeeRate: effectivePlatformFeeRate,
        facilities: mergedFacilities,
        customOverrides: resolvedOverrides,
      };
    });

    return NextResponse.json(transactionResult);
  } catch (error) {
    console.error("Failed to update user plan:", error);
    return NextResponse.json({ error: error.message || "Failed to update plan" }, { status: 500 });
  }
}

/**
 * DELETE /api/superadmin/plans
 * Safely resets an organizer's plan back to Free tier
 * - Preserves custom event overrides unless explicitly asked to reset
 * - Atomic transaction with audit logging
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

    const body = await request.json().catch(() => ({}));
    const { userId, auditReason, resetAllOverrides = false } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const userRef = adminDb.collection("users").doc(userId);

    const deleteResult = await adminDb.runTransaction(async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists) {
        throw new Error("Target user not found");
      }

      const userData = userSnap.data();
      const freePlan = PLANS.free;
      const currentPlanDef = getPlan(userData.plan || "free");
      const currentEffective = getEffectivePlanLimits(userData);
      const existingOverrides = extractUserOverrides(userData, currentPlanDef);

      const resolvedOverrides = resetAllOverrides ? {} : existingOverrides;
      const effectiveEventsAllowed =
        typeof resolvedOverrides.eventsAllowed === "number"
          ? resolvedOverrides.eventsAllowed
          : freePlan.eventsAllowed;

      const effectiveFacilities = {
        ...getFacilitiesForPlan("free"),
        ...(resolvedOverrides.facilities || {}),
      };

      const previousSubscription = {
        plan: userData.plan || "free",
        planName: currentPlanDef.name,
        eventsAllowed: currentEffective.eventsAllowed,
        standardEventsAllowed: currentPlanDef.eventsAllowed,
        participantsPerEvent: currentEffective.participantsPerEvent,
        platformFeeRate: currentEffective.platformFeeRate,
        facilities: currentEffective.facilities,
        customOverrides: existingOverrides,
        planStartDate: userData.planStartDate || null,
        planUpdatedAt: userData.planUpdatedAt || null,
      };

      const resetPayload = {
        plan: "free",
        subscriptionPlan: "START",
        standardEventsAllowed: freePlan.eventsAllowed,
        eventsAllowed: effectiveEventsAllowed,
        standardParticipantsPerEvent: freePlan.participantsPerEvent,
        participantsPerEvent: typeof resolvedOverrides.participantsPerEvent === "number" ? resolvedOverrides.participantsPerEvent : freePlan.participantsPerEvent,
        standardPlatformFeeRate: freePlan.platformFeeRate,
        platformFeeRate: typeof resolvedOverrides.platformFeeRate === "number" ? resolvedOverrides.platformFeeRate : freePlan.platformFeeRate,
        facilities: effectiveFacilities,
        customOverrides: resolvedOverrides,
        hasCustomOverrides: Object.keys(resolvedOverrides).length > 0,
        previousSubscription,
        planStatus: "active",
        planUpdatedAt: new Date(),
        planUpdatedBy: caller.email,
        planUpdateReason: auditReason || (resetAllOverrides ? "Reset to Free defaults by Super Admin" : "Reverted to Free tier, custom overrides preserved"),
        updatedAt: new Date(),
      };

      transaction.set(userRef, resetPayload, { merge: true });

      const auditLogRef = adminDb.collection("adminAuditLogs").doc();
      transaction.set(auditLogRef, {
        action: "ORGANIZER_PLAN_REVOKED",
        targetUserId: userId,
        targetUserEmail: userData.email || "",
        previousPlan: userData.plan || "free",
        previousSubscription,
        newPlan: "free",
        eventsAllowed: effectiveEventsAllowed,
        customOverrides: resolvedOverrides,
        performedByEmail: caller.email,
        performedByUid: caller.uid,
        reason: auditReason || "Plan reset to Free tier",
        timestamp: new Date(),
      });

      return {
        success: true,
        message: `Reset ${userData.fullName || userData.email || "user"} to Free tier (events allowed: ${effectiveEventsAllowed})`,
        plan: "free",
        eventsAllowed: effectiveEventsAllowed,
      };
    });

    return NextResponse.json(deleteResult);
  } catch (error) {
    console.error("Failed to revoke plan:", error);
    return NextResponse.json({ error: error.message || "Failed to revoke plan" }, { status: 500 });
  }
}
