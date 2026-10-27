import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getAuthenticatedUser } from "@/lib/auth-server";
import {
  PLANS,
  canCreateEvent,
  canAddParticipant,
  hasFeature,
} from "@/lib/plans";

/**
 * Middleware-style plan enforcement for API routes.
 * Returns { allowed: true } or { allowed: false, reason, code }
 */

export async function enforcePlanLimit(userId, action, context = {}) {
  if (!userId) {
    return {
      allowed: false,
      reason: "Authentication required",
      code: "UNAUTHENTICATED",
    };
  }

  const userDoc = await adminDb.collection("users").doc(userId).get();
  if (!userDoc.exists) {
    return { allowed: false, reason: "User not found", code: "USER_NOT_FOUND" };
  }

  const user = userDoc.data();

  // Super admins are never limited
  if (user.role === "superAdmin") {
    return { allowed: true };
  }

  const planId = user.plan || "free";
  const plan = PLANS[planId] || PLANS.free;

  switch (action) {
    case "createEvent": {
      // Count actual events in Firestore to avoid stale counter drift
      const eventsSnap = await adminDb
        .collection("events")
        .where("organiserId", "==", userId)
        .get();
      const currentCount = eventsSnap.size;

      if (!canCreateEvent(planId, currentCount)) {
        return {
          allowed: false,
          reason: `You've reached your event limit (${plan.eventsAllowed} event${plan.eventsAllowed === 1 ? "" : "s"} on ${plan.name} plan). Please upgrade to create more events.`,
          code: "EVENT_LIMIT_REACHED",
          limit: plan.eventsAllowed,
          current: currentCount,
          upgradeRequired: true,
        };
      }
      return { allowed: true };
    }

    case "addParticipant": {
      const { currentCount } = context;
      if (!canAddParticipant(planId, currentCount)) {
        return {
          allowed: false,
          reason: `This event has reached the participant limit (${plan.participantsPerEvent} on ${plan.name} plan).`,
          code: "PARTICIPANT_LIMIT_REACHED",
          limit: plan.participantsPerEvent,
          current: currentCount,
          upgradeRequired: true,
        };
      }
      return { allowed: true };
    }

    case "useFeature": {
      const { feature } = context;
      if (!hasFeature(planId, feature)) {
        return {
          allowed: false,
          reason: `This feature is not available on the ${plan.name} plan. Please upgrade to access it.`,
          code: "FEATURE_NOT_AVAILABLE",
          feature,
          upgradeRequired: true,
        };
      }
      return { allowed: true };
    }

    default:
      return { allowed: true };
  }
}

/**
 * GET /api/plans/check
 * Check if user can perform an action
 */
export async function GET(request) {
  try {
    const caller = await getAuthenticatedUser(request);
    if (!caller) return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const userId = caller.uid;
    const action = searchParams.get("action");
    const feature = searchParams.get("feature");
    const currentCount = parseInt(searchParams.get("currentCount") || "0");

    if (!userId || !action) {
      return NextResponse.json(
        { success: false, error: "userId and action are required" },
        { status: 400 },
      );
    }

    const result = await enforcePlanLimit(userId, action, {
      feature,
      currentCount,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Plan check error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

/**
 * POST /api/plans/check
 * Upgrade user plan (stub — integrate real payment gateway here)
 */
export async function POST(request) {
  return NextResponse.json(
    { success: false, error: "Direct plan upgrades are disabled. Complete verified checkout instead." },
    { status: 410 },
  );
}
