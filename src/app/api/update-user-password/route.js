import { NextResponse } from "next/server";
import { adminAuth, isFirebaseAdminReady } from "@/lib/firebase-admin";

/**
 * Update user password in Firebase Auth
 * Used for existing users who register for paid events and get new credentials
 */
export async function POST(request) {
  try {
    if (!isFirebaseAdminReady() || !adminAuth) {
      return NextResponse.json(
        { success: false, error: "Firebase Admin SDK not configured" },
        { status: 503 },
      );
    }

    const { uid, newPassword } = await request.json();

    if (!uid || !newPassword) {
      return NextResponse.json(
        { success: false, error: "Missing uid or newPassword" },
        { status: 400 },
      );
    }

    console.log(`🔐 [Admin API] Updating password for user: ${uid}`);
    console.log(`   New password length: ${newPassword.length}`);

    // Update user password in Firebase Auth
    await adminAuth.updateUser(uid, {
      password: newPassword,
    });

    console.log(`✅ [Admin API] Password updated successfully for ${uid}`);

    return NextResponse.json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    console.error("❌ [Admin API] Error updating password:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update password" },
      { status: 500 },
    );
  }
}
