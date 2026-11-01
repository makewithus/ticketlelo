import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { adminAuth, adminDb, isFirebaseAdminReady } from "@/lib/firebase-admin";
import { enqueueEmail } from "@/lib/email/queue";
import { buildPasswordResetOtpEmail } from "@/lib/email/templates/password-reset-otp";
import { EmailPriority, EmailType } from "@/lib/email/types";

export async function POST(request) {
  try {
    if (!isFirebaseAdminReady()) {
      return NextResponse.json({ error: "Authentication service unavailable" }, { status: 503 });
    }

    const body = await request.json();
    const rawEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!rawEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    // 1. Check if user exists in Firebase Auth
    let userRecord = null;
    try {
      userRecord = await adminAuth.getUserByEmail(rawEmail);
    } catch (err) {
      if (err.code === "auth/user-not-found") {
        return NextResponse.json(
          { error: "No account found with this email address." },
          { status: 404 }
        );
      }
      throw err;
    }

    // 2. Generate secure 6-digit numeric OTP code
    const code = String(crypto.randomInt(100000, 999999));
    const codeHash = crypto.createHash("sha256").update(code).digest("hex");
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

    // 3. Store in Firestore passwordResetCodes collection
    if (adminDb) {
      await adminDb.collection("passwordResetCodes").doc(rawEmail).set({
        email: rawEmail,
        codeHash,
        expiresAt,
        attempts: 0,
        used: false,
        createdAt: Date.now(),
      });
    }

    // 4. Send branded verification email via Resend
    const { html, text } = buildPasswordResetOtpEmail({ code, email: rawEmail });
    await enqueueEmail({
      to: rawEmail,
      subject: `Your TicketLelo Verification Code: ${code}`,
      html,
      text,
      priority: EmailPriority.P0,
      emailType: EmailType.PASSWORD_RESET,
      idempotencyKey: `idemp_pwd_otp_${rawEmail}_${Math.floor(Date.now() / 60000)}`,
    });

    return NextResponse.json({
      success: true,
      message: "Verification code sent to your email. Please check your inbox.",
    });
  } catch (error) {
    console.error("Forgot password send code error:", error);
    return NextResponse.json(
      { error: "Failed to send verification code. Please try again." },
      { status: 500 }
    );
  }
}
