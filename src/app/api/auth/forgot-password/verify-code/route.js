import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { adminDb, isFirebaseAdminReady } from "@/lib/firebase-admin";

export async function POST(request) {
  try {
    if (!isFirebaseAdminReady()) {
      return NextResponse.json({ error: "Authentication service unavailable" }, { status: 503 });
    }

    const body = await request.json();
    const rawEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const rawCode = typeof body.code === "string" || typeof body.code === "number" ? String(body.code).trim() : "";

    if (!rawEmail || !rawCode) {
      return NextResponse.json({ error: "Email and verification code are required." }, { status: 400 });
    }

    if (!adminDb) {
      return NextResponse.json({ error: "Database service unavailable" }, { status: 503 });
    }

    const docRef = adminDb.collection("passwordResetCodes").doc(rawEmail);
    const snap = await docRef.get();

    if (!snap.exists) {
      return NextResponse.json(
        { error: "No verification code requested for this email. Please request a new code." },
        { status: 400 }
      );
    }

    const data = snap.data();

    // Check expiration
    if (Date.now() > Number(data.expiresAt)) {
      return NextResponse.json(
        { error: "Verification code has expired. Please request a new code." },
        { status: 400 }
      );
    }

    // Check already used
    if (data.used) {
      return NextResponse.json(
        { error: "This code has already been used. Please request a new code." },
        { status: 400 }
      );
    }

    // Check attempts brute force protection
    if ((data.attempts || 0) >= 5) {
      return NextResponse.json(
        { error: "Too many incorrect attempts. Please request a new code." },
        { status: 429 }
      );
    }

    // Verify hash
    const inputHash = crypto.createHash("sha256").update(rawCode).digest("hex");
    if (inputHash !== data.codeHash) {
      await docRef.update({ attempts: (data.attempts || 0) + 1 });
      return NextResponse.json(
        { error: "Incorrect verification code. Please check and try again." },
        { status: 400 }
      );
    }

    // Code is valid! Generate resetToken valid for 10 minutes
    const resetToken = crypto.randomBytes(32).toString("hex");
    const tokenExpiresAt = Date.now() + 10 * 60 * 1000;

    await docRef.update({
      resetToken,
      tokenExpiresAt,
      verifiedAt: Date.now(),
    });

    return NextResponse.json({
      success: true,
      resetToken,
      message: "Code verified successfully! You can now set your new password.",
    });
  } catch (error) {
    console.error("Forgot password verify code error:", error);
    return NextResponse.json(
      { error: "Failed to verify code. Please try again." },
      { status: 500 }
    );
  }
}
