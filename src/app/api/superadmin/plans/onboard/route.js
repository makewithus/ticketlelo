import { NextResponse } from "next/server";
import { adminDb, isFirebaseAdminReady } from "@/lib/firebase-admin";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { PLANS, getPlan, getFacilitiesForPlan } from "@/lib/plans";
import { normalizePlanId } from "@/lib/payments/commission-engine";

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
 * POST /api/superadmin/plans/onboard
 * Assign a plan to a new or existing user by email
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
    const { email, fullName, phone, college, role = "organiser", planId = "starter", auditReason } = body;

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email address is required" }, { status: 400 });
    }

    const emailClean = email.toLowerCase().trim();
    const targetPlan = getPlan(planId);
    const facilities = getFacilitiesForPlan(targetPlan.id);

    // Check if user already exists in users collection
    const usersSnap = await adminDb.collection("users").where("email", "==", emailClean).limit(1).get();

    let userId = null;
    let isExisting = false;

    if (!usersSnap.empty) {
      userId = usersSnap.docs[0].id;
      isExisting = true;
    } else {
      // Create new user document ID
      const newRef = adminDb.collection("users").doc();
      userId = newRef.id;
    }

    const userRef = adminDb.collection("users").doc(userId);

    const planData = {
      email: emailClean,
      fullName: fullName?.trim() || "Organizer",
      phone: phone?.trim() || "",
      college: college?.trim() || "General Organizer",
      role: role || "organiser",
      plan: targetPlan.id,
      subscriptionPlan: normalizePlanId(targetPlan.id),
      eventsAllowed: targetPlan.eventsAllowed,
      participantsPerEvent: targetPlan.participantsPerEvent,
      platformFeeRate: targetPlan.platformFeeRate,
      facilities,
      planStatus: "active",
      planStartDate: new Date(),
      planUpdatedAt: new Date(),
      planUpdatedBy: caller.email,
      planUpdateReason: auditReason || `Direct onboard with ${targetPlan.name} plan by Super Admin`,
      updatedAt: new Date(),
    };

    if (!isExisting) {
      planData.createdAt = new Date();
    }

    await userRef.set(planData, { merge: true });

    // Audit log
    try {
      await adminDb.collection("adminAuditLogs").add({
        action: isExisting ? "ORGANIZER_PLAN_ASSIGNED" : "NEW_ORGANIZER_ONBOARDED_WITH_PLAN",
        targetUserId: userId,
        targetUserEmail: emailClean,
        plan: targetPlan.id,
        planName: targetPlan.name,
        performedByEmail: caller.email,
        performedByUid: caller.uid,
        reason: auditReason || "Super Admin Onboard with Plan",
        timestamp: new Date(),
      });
    } catch (_) {}

    return NextResponse.json({
      success: true,
      message: `${isExisting ? "Updated" : "Onboarded"} ${emailClean} with ${targetPlan.name} plan successfully`,
      userId,
      isExisting,
      plan: targetPlan.id,
    });
  } catch (error) {
    console.error("Failed to onboard user with plan:", error);
    return NextResponse.json({ error: error.message || "Failed to onboard user with plan" }, { status: 500 });
  }
}

