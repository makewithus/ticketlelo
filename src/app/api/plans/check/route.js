import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getAuthenticatedUser } from "@/lib/auth-server";
import {
  PLANS,
  canCreateEvent,
  canAddParticipant,
  hasFeature,
  getEffectivePlanLimits,
} from "@/lib/plans";
import { getOrganizerUsage } from "@/lib/plan-enforcement";

export const dynamic = "force-dynamic";

/**
 * Middleware-style plan enforcement for API routes and pre-flight checks.
 * Returns { allowed: true, limit, current } or { allowed: false, reason, code, limit, current }
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
    return { allowed: true, isSuperAdmin: true };
  }

  const effective = getEffectivePlanLimits(user);

  switch (action) {
    case "createEvent": {
      // Authoritatively count actual non-deleted events in Firestore to avoid counter drift
      const usage = await getOrganizerUsage(adminDb, userId, user.email);
      const currentCount = usage.totalEvents;

      if (!canCreateEvent(user, currentCount)) {
        const overrideMsg = effective.hasCustomEvents ? ` (custom limit: ${effective.eventsAllowed})` : "";
        return {
          allowed: false,
          reason: `You've reached your event limit (${currentCount}/${effective.eventsAllowed === -1 ? "Unlimited" : effective.eventsAllowed} events on ${effective.planName} plan${overrideMsg}). Please upgrade to create more events.`,
          code: "EVENT_LIMIT_REACHED",
          limit: effective.eventsAllowed,
          standardLimit: effective.standardEventsAllowed,
          hasCustomOverride: effective.hasCustomEvents,
          current: currentCount,
          plan: effective.planId,
          planName: effective.planName,
          upgradeRequired: true,
        };
      }
      return {
        allowed: true,
        limit: effective.eventsAllowed,
        standardLimit: effective.standardEventsAllowed,
        hasCustomOverride: effective.hasCustomEvents,
        current: currentCount,
        plan: effective.planId,
        planName: effective.planName,
      };
    }

    case "addParticipant": {
      const { currentCount } = context;
      if (!canAddParticipant(user, currentCount)) {
        return {
          allowed: false,
          reason: `This event has reached the participant limit (${effective.participantsPerEvent} on ${effective.planName} plan).`,
          code: "PARTICIPANT_LIMIT_REACHED",
          limit: effective.participantsPerEvent,
          standardLimit: effective.standardParticipantsPerEvent,
          hasCustomOverride: effective.hasCustomParticipants,
          current: currentCount,
          upgradeRequired: true,
        };
      }
      return {
        allowed: true,
        limit: effective.participantsPerEvent,
        current: currentCount,
      };
    }

    case "useFeature": {
      const { feature } = context;
      if (!hasFeature(user, feature)) {
        return {
          allowed: false,
          reason: `This feature is not available on the ${effective.planName} plan. Please upgrade to access it.`,
          code: "FEATURE_NOT_AVAILABLE",
          feature,
          upgradeRequired: true,
        };
      }
      return { allowed: true, feature };
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
    const { searchParams } = new URL(request.url);
    const queryUserId = searchParams.get("userId");
    const userId = caller?.uid || queryUserId;
    const action = searchParams.get("action");
    const feature = searchParams.get("feature");
    const currentCount = parseInt(searchParams.get("currentCount") || "0");

    if (!userId || !action) {
      return NextResponse.json(
        { success: false, error: "userId and action are required" },
        { status: 400 },
      );
    }

    // If caller is authenticated and not superAdmin, ensure they only check their own limits
    if (caller && caller.role !== "superAdmin" && caller.uid !== userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized access to other user's plan" },
        { status: 403 },
      );
    }

    const result = await enforcePlanLimit(userId, action, {
      feature,
      currentCount,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Plan check error:", error);
    // On unexpected error, return allowed: true as fallback so organisers are not blocked
    return NextResponse.json(
      { success: false, allowed: true, error: error.message },
      { status: 200 },
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
