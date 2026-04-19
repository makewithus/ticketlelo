import { NextResponse } from "next/server";
import { adminAuth, isFirebaseAdminReady } from "@/lib/firebase-admin";

/**
 * Update user password in Firebase Auth
 * Used for existing users who register for paid events and get new credentials
 */
export async function POST(request) {
  try {
    console.log("🔐 [Password Update API] Request received");
    console.log("   Admin ready:", isFirebaseAdminReady());
    console.log("   adminAuth exists:", !!adminAuth);

    if (!isFirebaseAdminReady() || !adminAuth) {
      console.error("❌ [Password Update API] Firebase Admin not configured");
      return NextResponse.json(
        {
          success: false,
          error: "Firebase Admin SDK not configured. Check server logs.",
        },
        { status: 503 },
      );
    }

    const { uid, newPassword } = await request.json();

    if (!uid || !newPassword) {
      console.error("❌ [Password Update API] Missing parameters");
      console.log("   UID provided:", !!uid);
      console.log("   Password provided:", !!newPassword);
      return NextResponse.json(
        { success: false, error: "Missing uid or newPassword" },
        { status: 400 },
      );
    }

    console.log(`🔐 [Password Update API] Updating password for user: ${uid}`);
    console.log(`   New password length: ${newPassword.length}`);

    // Update user password in Firebase Auth
    await adminAuth.updateUser(uid, {
      password: newPassword,
    });

    console.log(
      `✅ [Password Update API] Password updated successfully for ${uid}`,
    );

    return NextResponse.json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    console.error("❌ [Password Update API] Error updating password:");
    console.error("   Error code:", error.code);
    console.error("   Error message:", error.message);
    console.error("   Full error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to update password",
        errorCode: error.code,
      },
      { status: 500 },
    );
  }
}
