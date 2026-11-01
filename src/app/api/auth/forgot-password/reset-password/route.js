import { NextResponse } from "next/server";
import { adminAuth, adminDb, isFirebaseAdminReady } from "@/lib/firebase-admin";

export async function POST(request) {
  try {
    if (!isFirebaseAdminReady()) {
      return NextResponse.json({ error: "Authentication service unavailable" }, { status: 503 });
    }

    const body = await request.json();
    const rawEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const resetToken = typeof body.resetToken === "string" ? body.resetToken.trim() : "";
    const newPassword = typeof body.newPassword === "string" ? body.newPassword.trim() : "";
    const confirmPassword = typeof body.confirmPassword === "string" ? body.confirmPassword.trim() : "";

    if (!rawEmail || !resetToken || !newPassword) {
      return NextResponse.json({ error: "Email, reset token, and new password are required." }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
    }

    if (!adminDb) {
      return NextResponse.json({ error: "Database service unavailable" }, { status: 503 });
    }

    const docRef = adminDb.collection("passwordResetCodes").doc(rawEmail);
    const snap = await docRef.get();

    if (!snap.exists) {
      return NextResponse.json(
        { error: "No reset request found for this email. Please start over." },
        { status: 400 }
      );
    }

    const data = snap.data();

    // Verify token
    if (!data.resetToken || data.resetToken !== resetToken) {
      return NextResponse.json(
        { error: "Invalid or expired reset token. Please verify your code again." },
        { status: 403 }
      );
    }

    // Verify token expiration
    if (Date.now() > Number(data.tokenExpiresAt)) {
      return NextResponse.json(
        { error: "Reset token has expired. Please request a new verification code." },
        { status: 400 }
      );
    }

    // Verify not already used
    if (data.used) {
      return NextResponse.json(
        { error: "This reset token has already been used. Please request a new code if needed." },
        { status: 400 }
      );
    }

    // Update password in Firebase Auth
    const userRecord = await adminAuth.getUserByEmail(rawEmail);
    await adminAuth.updateUser(userRecord.uid, {
      password: newPassword,
    });

    // Mark code as used
    await docRef.update({
      used: true,
      usedAt: Date.now(),
      resetToken: null,
    });

    // Also update updatedAt in Firestore users collection if present
    try {
      await adminDb.collection("users").doc(userRecord.uid).update({
        updatedAt: new Date(),
      });
    } catch {}

    return NextResponse.json({
      success: true,
      message: "Password updated successfully! You can now log in with your new password.",
    });
  } catch (error) {
    console.error("Forgot password reset password error:", error);
    return NextResponse.json(
      { error: "Failed to reset password. Please try again." },
      { status: 500 }
    );
  }
}
