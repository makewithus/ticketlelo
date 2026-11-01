import { NextResponse } from "next/server";
import { enqueueEmail } from "@/lib/email/queue";
import { buildPasswordResetEmail } from "@/lib/email/templates/password-reset";
import { EmailPriority, EmailType } from "@/lib/email/types";
import { adminAuth, isFirebaseAdminReady } from "@/lib/firebase-admin";
import { getAuthenticatedUser } from "@/lib/auth-server";

const escapeHtml = (value = "") =>
  String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));

export async function POST(request) {
  try {
    if (!isFirebaseAdminReady()) {
      return NextResponse.json(
        { error: "Identity service unavailable" },
        { status: 503 },
      );
    }

    const caller = await getAuthenticatedUser(request);
    const emailLower = (caller?.email || "").toLowerCase().trim();
    const isSuperAdmin =
      caller?.role === "superAdmin" ||
      emailLower === "adil4ticketlelo@gmail.com" ||
      emailLower === "superadmin@ticketlelo.com";

    if (!caller || !isSuperAdmin) {
      return NextResponse.json(
        { error: "Super administrator access required" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "Organiser";
    const eventTitle = typeof body.eventTitle === "string" ? body.eventTitle.trim() : "Event";

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "A valid organiser email is required" },
        { status: 400 },
      );
    }

    // 1. Ensure user exists in Firebase Auth
    try {
      await adminAuth.getUserByEmail(email);
    } catch (err) {
      if (err.code === "auth/user-not-found") {
        const userRecord = await adminAuth.createUser({
          email,
          displayName: name,
        });
        await adminAuth.setCustomUserClaims(userRecord.uid, { role: "organiser" });
      } else {
        throw err;
      }
    }

    // 2. Generate password reset link
    const resetLink = await adminAuth.generatePasswordResetLink(email);

    // 3. Attempt to send email if SMTP is configured
    let emailSent = false;
    const targetEmailLower = String(email || "").trim().toLowerCase();
    const isSuperAdminEmail =
      targetEmailLower === "superadmin@ticketlelo.com" ||
      targetEmailLower === "superadin@ticketlelo.com";

    if (!isSuperAdminEmail) {
      try {
        const { html: htmlContent, text: textBody } = buildPasswordResetEmail({
          name,
          email,
          eventTitle,
          resetLink,
        });

        await enqueueEmail({
          to: email,
          subject: `Reset your TicketLelo password: ${eventTitle}`,
          html: htmlContent,
          text: textBody,
          priority: EmailPriority.P0,
          emailType: EmailType.PASSWORD_RESET,
          idempotencyKey: `idemp_pwdreset_${targetEmailLower}_${Date.now()}`,
        });
        emailSent = true;
      } catch (emailErr) {
        console.warn("[reset-organiser-login] Dispatch error:", emailErr.message);
      }
    }

    return NextResponse.json({
      success: true,
      resetLink,
      email,
      emailSent,
      message: emailSent
        ? `Password reset link generated and sent to ${email}`
        : `Password reset link generated for ${email}`,
    });
  } catch (error) {
    console.error("[reset-organiser-login] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to reset organiser login" },
      { status: 500 },
    );
  }
}
