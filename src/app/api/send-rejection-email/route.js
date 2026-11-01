import { NextResponse } from "next/server";
import { getAppBaseUrl } from "@/lib/app-url";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { enqueueEmail } from "@/lib/email/queue";
import { buildRejectionEmail } from "@/lib/email/templates/rejection";
import { EmailPriority, EmailType } from "@/lib/email/types";
import { getEmailConfig } from "@/lib/email/config";

export async function POST(request) {
  try {
    const caller = await getAuthenticatedUser(request);
    if (!caller) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const emailLower = (caller?.email || "").toLowerCase().trim();
    const isSuperAdmin =
      caller.role === "superAdmin" ||
      emailLower === "adil4ticketlelo@gmail.com" ||
      emailLower === "superadmin@ticketlelo.com" ||
      emailLower === (process.env.SUPER_ADMIN_EMAIL || "").toLowerCase().trim();

    if (!isSuperAdmin) {
      return NextResponse.json({ error: "Superadmin access required" }, { status: 403 });
    }
    const appUrl = getAppBaseUrl();
    const {
      name,
      email,
      eventTitle,
      eventDescription,
      rejectionReason,
      numberOfTickets,
      college,
    } = await request.json();

    const targetEmailLower = String(email || "").trim().toLowerCase();
    if (
      targetEmailLower === "superadmin@ticketlelo.com" ||
      targetEmailLower === "superadin@ticketlelo.com"
    ) {
      return NextResponse.json({
        success: true,
        message: "Email dispatch skipped: superadmin uses the dashboard and this email inbox does not exist.",
      });
    }

    const emailConfig = getEmailConfig();
    if (!emailConfig.hasApiKey && !emailConfig.isMockEnabled && !process.env.SMTP_EMAIL) {
      return NextResponse.json({ error: "Email delivery is not configured" }, { status: 503 });
    }

    const { html: htmlContent, text: textBody } = buildRejectionEmail({
      name,
      eventTitle,
      rejectionReason,
      numberOfTickets,
      college,
      eventDescription,
      appUrl,
    });

    const enqueueResult = await enqueueEmail({
      to: email,
      subject: `Hosting Request Update: ${eventTitle}`,
      html: htmlContent,
      text: textBody,
      priority: EmailPriority.P1,
      emailType: EmailType.HOSTING_REJECTION,
      idempotencyKey: `idemp_rejection_${targetEmailLower}_${(eventTitle || "").toLowerCase().replace(/[^a-z0-9]/g, "")}`,
    });

    return NextResponse.json({
      success: true,
      message: `Rejection email queued for ${email}`,
      jobId: enqueueResult.jobId,
    });
  } catch (error) {
    console.error("Error sending rejection email:", error);
    return NextResponse.json(
      { error: "Failed to send rejection email: " + (error?.message || "Delivery failed") },
      { status: 500 },
    );
  }
}
