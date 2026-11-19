import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { enqueueEmail, processEmailJob } from "@/lib/email/queue";
import { EmailJobRepository } from "@/lib/email/job-repository";
import { buildApprovalEmail } from "@/lib/email/templates/approval";
import { EmailPriority, EmailType, EmailStatus } from "@/lib/email/types";
import { getEmailConfig } from "@/lib/email/config";

function getEmailBaseUrl() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  if (appUrl && !appUrl.includes("localhost") && !appUrl.includes("127.0.0.1")) {
    return appUrl.replace(/\/+$/, "");
  }
  if (process.env.VERCEL_URL && !process.env.VERCEL_URL.includes("localhost")) {
    return `https://${process.env.VERCEL_URL}`.replace(/\/+$/, "");
  }
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
    const body = await request.json();
    const { name, email, eventTitle, isExisting, organiserEmail, isResend, requestId } = body;
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
    const cleanEventTitle = eventTitle.toLowerCase().replace(/[^a-z0-9]/g, "");
    const primaryIdempotencyKey = `idemp_approval_${recipientLower}_${cleanEventTitle}`;

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

    let idempotencyKey = primaryIdempotencyKey;
    let originalJob = null;
    let resendCount = 0;

    if (isResend) {
      // Find original email job to link to and detect rapid duplicate clicks
      originalJob = await EmailJobRepository.getJobByIdempotencyKey(primaryIdempotencyKey);
      
      // Prevent unintended duplicate sends from rapid multiple clicks (10s debounce window)
      if (originalJob) {
        const lastSentRaw = originalJob.lastResentAt || originalJob.sentAt || originalJob.updatedAt;
        const lastSentDate = lastSentRaw?.toDate ? lastSentRaw.toDate() : (lastSentRaw ? new Date(lastSentRaw) : null);
        if (lastSentDate && Date.now() - lastSentDate.getTime() < 10000) {
          return NextResponse.json(
            { error: "A resend request was sent moments ago. Please wait 10 seconds before resending again." },
            { status: 429 }
          );
        }
        resendCount = (Number(originalJob.resendCount) || 0) + 1;
      } else {
        resendCount = 1;
      }

      // Generate attempt-scoped idempotency key so a new durable job record is created
      idempotencyKey = `${primaryIdempotencyKey}_resend_${resendCount}_${Math.floor(Date.now() / 10000)}`;
    }

    const enqueueResult = await enqueueEmail({
      to: recipientEmail,
      subject: `Hosting request approved: ${eventTitle}`,
      html: htmlBody,
      text: textBody,
      priority: EmailPriority.P1,
      emailType: EmailType.HOSTING_APPROVAL,
      idempotencyKey,
      eventId: requestId || null,
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

    // Dispatch the email job and record provider result
    const dispatchResult = await processEmailJob(enqueueResult.jobId, isResend ? "admin-resend" : "admin-approval");

    // Check if the dispatch genuinely succeeded or was scheduled
    if (!dispatchResult.success && !dispatchResult.retryScheduled) {
      return NextResponse.json(
        {
          error: "Could not send approval email: " + (dispatchResult.error || dispatchResult.reason || "Provider rejected delivery"),
        },
        { status: 502 }
      );
    }

    // If resending, preserve original record and link this resend attempt into resendHistory
    if (isResend && originalJob?.id) {
      const existingHistory = Array.isArray(originalJob.resendHistory) ? originalJob.resendHistory : [];
      const newHistoryEntry = {
        jobId: enqueueResult.jobId,
        resentAt: new Date().toISOString(),
        resendCount,
        status: dispatchResult.success ? "SENT" : (dispatchResult.retryScheduled ? "SCHEDULED" : "FAILED"),
        providerMessageId: dispatchResult.providerMessageId || null,
      };
      await EmailJobRepository.updateJob(originalJob.id, {
        resendCount,
        lastResentAt: new Date(),
        resendHistory: [...existingHistory, newHistoryEntry],
      });
    }

    return NextResponse.json({
      success: true,
      message: isResend
        ? `Approval email resent successfully to ${recipientEmail}`
        : `Approval email queued for ${recipientEmail}`,
      jobId: enqueueResult.jobId,
      resendCount: isResend ? resendCount : 0,
      providerMessageId: dispatchResult.providerMessageId || null,
    });
  } catch (error) {
    console.error("[send-approval-email] Error:", error);
    return NextResponse.json(
      { error: "Could not send approval email: " + (error?.message || "Delivery failed") },
      { status: 502 },
    );
  }
}
