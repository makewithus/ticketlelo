import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { enqueueEmail } from "@/lib/email/queue";
import { buildApprovalEmail } from "@/lib/email/templates/approval";
import { EmailPriority, EmailType } from "@/lib/email/types";
import { getEmailConfig } from "@/lib/email/config";

function getEmailBaseUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "https://ticketlelo.in";
}

export async function POST(request) {
  const caller = await getAuthenticatedUser(request);
  if (!caller) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  const emailLower = (caller?.email || "").toLowerCase().trim();
  const isSuperAdmin =
    caller.role === "superAdmin" ||
    emailLower === "adil4ticketlelo@gmail.com" ||
    emailLower === "superadmin@ticketlelo.com" ||
    emailLower === (process.env.SUPER_ADMIN_EMAIL || "").toLowerCase().trim();

  if (!isSuperAdmin) {
    return NextResponse.json({ error: "Superadmin approval required" }, { status: 403 });
  }

  try {
    const { name, email, eventTitle, isExisting, organiserEmail } = await request.json();
    if (!email || !name || !eventTitle) {
      return NextResponse.json(
        { error: "Name, email and event title are required" },
        { status: 400 },
      );
    }

    const emailConfig = getEmailConfig();
    if (!emailConfig.hasApiKey && !emailConfig.isMockEnabled && !process.env.SMTP_EMAIL) {
      return NextResponse.json(
        { error: "Email delivery is not configured" },
        { status: 503 },
      );
    }

    const recipientEmail = (organiserEmail || email).trim();
    const recipientLower = recipientEmail.toLowerCase();
    if (
      recipientLower === "superadmin@ticketlelo.com" ||
      recipientLower === "superadin@ticketlelo.com"
    ) {
      return NextResponse.json({
        success: true,
        message: "Email dispatch skipped: superadmin uses the dashboard and this email inbox does not exist.",
      });
    }

    const emailBaseUrl = getEmailBaseUrl();

    // RFC 5322 compliant unique Message-ID
    const domain = "ticketlelo.in";
    const uniqueId = `tl-appr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const messageId = `<${uniqueId}@${domain}>`;

    const { html: htmlBody, text: textBody } = buildApprovalEmail({
      name,
      recipientEmail,
      eventTitle,
      emailBaseUrl,
    });

    const enqueueResult = await enqueueEmail({
      to: recipientEmail,
      subject: `Hosting request approved: ${eventTitle}`,
      html: htmlBody,
      text: textBody,
      priority: EmailPriority.P1,
      emailType: EmailType.HOSTING_APPROVAL,
      idempotencyKey: `idemp_approval_${recipientLower}_${eventTitle.toLowerCase().replace(/[^a-z0-9]/g, "")}`,
      headers: {
        "Message-ID": messageId,
        "Date": new Date().toUTCString(),
        "X-Entity-Ref-ID": messageId,
        "X-Mailer": "TicketLelo Mail Engine 2.0 (Resend)",
        "List-Unsubscribe": `<mailto:support@ticketlelo.in?subject=Unsubscribe>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        "X-Auto-Response-Suppress": "OOF, AutoReply",
        "Auto-Submitted": "auto-generated",
      },
    });

    return NextResponse.json({
      success: true,
      message: `Approval email queued for ${recipientEmail}`,
      jobId: enqueueResult.jobId,
    });
  } catch (error) {
    console.error("[send-approval-email] Error:", error);
    return NextResponse.json(
      { error: "Could not send approval email: " + (error?.message || "Delivery failed") },
      { status: 502 },
    );
  }
}
