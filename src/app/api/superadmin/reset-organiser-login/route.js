import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
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
    if (process.env.SMTP_EMAIL && process.env.SMTP_PASSWORD) {
      try {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST || "smtp.gmail.com",
          port: Number(process.env.SMTP_PORT || 587),
          secure: Number(process.env.SMTP_PORT || 587) === 465,
          auth: { user: process.env.SMTP_EMAIL, pass: process.env.SMTP_PASSWORD },
        });

        const safeName = escapeHtml(name);
        const safeEvent = escapeHtml(eventTitle);
        const safeResetLink = escapeHtml(resetLink);

        await transporter.sendMail({
          from: `TicketLelo <${process.env.SMTP_EMAIL}>`,
          to: email,
          subject: `Reset your TicketLelo password: ${eventTitle}`,
          text: `Hello ${name},\n\nA password reset was requested for your TicketLelo organiser account (${email}).\n\nReset your password here:\n${resetLink}\n\nIf you did not request this, please contact support.`,
          html: `<p>Hello ${safeName},</p><p>A password reset was requested for your TicketLelo organiser account for <strong>${safeEvent}</strong>.</p><p><a href="${safeResetLink}" style="display:inline-block;padding:10px 18px;background-color:#FE760B;color:#131517;font-weight:bold;text-decoration:none;border-radius:8px;">Reset Password</a></p><p style="font-size:12px;color:#888;">Or copy this link into your browser:<br/><a href="${safeResetLink}">${safeResetLink}</a></p>`,
        });
        emailSent = true;
      } catch (emailErr) {
        console.warn("[reset-organiser-login] SMTP dispatch skipped/failed:", emailErr.message);
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
