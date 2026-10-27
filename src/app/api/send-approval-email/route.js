import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { getAppBaseUrl } from "@/lib/app-url";
import { getAuthenticatedUser } from "@/lib/auth-server";

const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char]));

export async function POST(request) {
  const caller = await getAuthenticatedUser(request);
  if (!caller) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (caller.role !== "superAdmin") return NextResponse.json({ error: "Superadmin approval required" }, { status: 403 });

  try {
    const { name, email, eventTitle, isExisting } = await request.json();
    if (!email || !name || !eventTitle) {
      return NextResponse.json({ error: "Name, email and event title are required" }, { status: 400 });
    }
    if (!process.env.SMTP_EMAIL || !process.env.SMTP_PASSWORD) {
      return NextResponse.json({ error: "Email delivery is not configured" }, { status: 503 });
    }

    const loginUrl = `${getAppBaseUrl()}/organiser-login`;
    const safeName = escapeHtml(name);
    const safeEvent = escapeHtml(eventTitle);
    const safeLoginUrl = escapeHtml(loginUrl);
    const accountMessage = isExisting
      ? "Your existing password has not been changed. Sign in with your current password."
      : 'Your account is ready. Open the organizer sign-in page and use “Forgot password?” to set your password.';
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT || 587) === 465,
      auth: { user: process.env.SMTP_EMAIL, pass: process.env.SMTP_PASSWORD },
    });
    await transporter.sendMail({
      from: `TicketLelo <${process.env.SMTP_EMAIL}>`,
      to: email,
      subject: `Organizer request approved: ${eventTitle}`,
      text: `Hello ${name}, your hosting request for ${eventTitle} was approved. ${accountMessage} Sign in at ${loginUrl}.`,
      html: `<p>Hello ${safeName},</p><p>Your hosting request for <strong>${safeEvent}</strong> was approved.</p><p>${escapeHtml(accountMessage)}</p><p><a href="${safeLoginUrl}">Organizer sign in</a></p>`,
    });
    return NextResponse.json({ success: true, message: "Approval email sent" });
  } catch (error) {
    console.error("[send-approval-email] Delivery failed:", error.code || "unexpected-error");
    return NextResponse.json({ error: "Could not send approval email" }, { status: 502 });
  }
}
