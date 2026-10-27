import { NextResponse } from "next/server";
import { adminAuth, adminDb, isFirebaseAdminReady } from "@/lib/firebase-admin";
import { getAuthenticatedUser } from "@/lib/auth-server";

/**
 * Assign organiser role to a user.
 * Strictly restricted to SuperAdmin users (SEC-04).
 */
export async function POST(request) {
  try {
    if (!isFirebaseAdminReady() || !adminAuth || !adminDb) {
      return NextResponse.json(
        { success: false, error: "Firebase Admin SDK not configured" },
        { status: 503 },
      );
    }

    const caller = await getAuthenticatedUser(request);
    if (!caller || caller.role !== "superAdmin") {
      return NextResponse.json(
        { success: false, error: "Forbidden: Only SuperAdmin can assign organiser roles." },
        { status: 403 },
      );
    }

    const { uid } = await request.json();
    const role = "organiser";

    if (!uid) {
      return NextResponse.json(
        { success: false, error: "Missing required parameter: uid." },
        { status: 400 },
      );
    }

    const userDocRef = adminDb.collection("users").doc(uid);
    const userDoc = await userDocRef.get();

    if (!userDoc.exists) {
      return NextResponse.json(
        { success: false, error: "User not found." },
        { status: 404 },
      );
    }

    await userDocRef.update({
      role,
      isAdmin: role === "organiser" || role === "superAdmin",
      updatedAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      message: `User role successfully updated to ${role}`,
      uid,
      role,
    });
  } catch (error) {
    console.error("[fix-organiser-role] Error:", error.message);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update role" },
      { status: 500 },
    );
  }
}
