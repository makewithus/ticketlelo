import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { QuotaLedger } from "@/lib/email/quota-ledger";
import { EmailJobRepository } from "@/lib/email/job-repository";
import { EmailStatus } from "@/lib/email/types";
import { adminDb } from "@/lib/firebase-admin";

/**
 * GET /api/admin/emails
 *
 * Superadmin API endpoint for monitoring email infrastructure, quota usage,
 * and querying email job records with filters.
 */
export async function GET(request) {
  try {
    const caller = await getAuthenticatedUser(request);
    if (!caller) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const emailLower = (caller?.email || "").toLowerCase().trim();
    const superAdminEnv = (process.env.SUPER_ADMIN_EMAIL || "").toLowerCase().trim();
    const isSuperAdmin =
      caller.role === "superAdmin" ||
      caller.isAdmin === true ||
      emailLower === "adil4ticketlelo@gmail.com" ||
      emailLower === "superadmin@ticketlelo.com" ||
      (superAdminEnv && emailLower === superAdminEnv);

    if (!isSuperAdmin) {
      return NextResponse.json({ error: "Superadmin access required" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status") || "";
    const emailTypeFilter = searchParams.get("emailType") || "";
    const recipientFilter = searchParams.get("recipient") || "";
    const eventIdFilter = searchParams.get("eventId") || "";
    const limit = Math.min(100, Number.parseInt(searchParams.get("limit") || "50", 10));

    // 1. Quota metrics
    const quota = await QuotaLedger.getQuotaUsage();

    // 2. Query jobs
    const jobs = await EmailJobRepository.listJobs(
      {
        status: statusFilter,
        emailType: emailTypeFilter,
        recipient: recipientFilter,
        eventId: eventIdFilter,
      },
      { limit }
    );

    // 3. Aggregate totals across jobs
    let totalSent = 0;
    let totalDelivered = 0;
    let totalPending = 0;
    let totalScheduled = 0;
    let totalFailed = 0;
    let totalBounced = 0;
    let totalComplained = 0;

    if (adminDb && process.env.NODE_ENV !== "test") {
      try {
        const snap = await adminDb.collection("emailJobs").limit(500).get();
        for (const doc of snap.docs) {
          const s = doc.data().status;
          if (s === EmailStatus.SENT) totalSent++;
          else if (s === EmailStatus.DELIVERED) totalDelivered++;
          else if (s === EmailStatus.QUEUED || s === EmailStatus.PENDING || s === EmailStatus.PROCESSING) totalPending++;
          else if (s === EmailStatus.SCHEDULED) totalScheduled++;
          else if (s === EmailStatus.FAILED) totalFailed++;
          else if (s === EmailStatus.BOUNCED) totalBounced++;
          else if (s === EmailStatus.COMPLAINED) totalComplained++;
        }
      } catch {
        // Fall back to current jobs count
      }
    }

    // Helper to safely serialize Firestore Timestamp objects to standard ISO strings
    const normalizeIsoDate = (val) => {
      if (!val) return null;
      if (typeof val === "string") return val;
      if (typeof val?.toDate === "function") {
        try {
          return val.toDate().toISOString();
        } catch {
          return null;
        }
      }
      if (typeof val === "object") {
        const sec = val.seconds ?? val._seconds;
        if (typeof sec === "number") {
          const nano = val.nanoseconds ?? val._nanoseconds ?? 0;
          return new Date(sec * 1000 + nano / 1000000).toISOString();
        }
      }
      if (val instanceof Date) {
        return isNaN(val.getTime()) ? null : val.toISOString();
      }
      if (typeof val === "number") {
        const ms = val < 10000000000 ? val * 1000 : val;
        const d = new Date(ms);
        return isNaN(d.getTime()) ? null : d.toISOString();
      }
      return null;
    };

    // Sanitize jobs list (never expose raw API keys or passwords)
    const sanitizedJobs = jobs.map((j) => ({
      id: j.id,
      idempotencyKey: j.idempotencyKey,
      recipient: j.recipient,
      emailType: j.emailType,
      priority: j.priority,
      status: j.status,
      attemptCount: j.attemptCount,
      nextScheduledAttempt: normalizeIsoDate(j.nextScheduledAttempt),
      providerMessageId: j.providerMessageId,
      error: j.error,
      eventId: j.eventId,
      ticketId: j.ticketId,
      createdAt: normalizeIsoDate(j.createdAt),
      sentAt: normalizeIsoDate(j.sentAt),
      deliveredAt: normalizeIsoDate(j.deliveredAt),
      subject: j.payload?.subject || "",
    }));

    return NextResponse.json({
      success: true,
      quota,
      stats: {
        totalSent,
        totalDelivered,
        totalPending,
        totalScheduled,
        totalFailed,
        totalBounced,
        totalComplained,
      },
      jobs: sanitizedJobs,
    });
  } catch (error) {
    console.error("[admin/emails] Error:", error);
    return NextResponse.json(
      { error: "Failed fetching email stats: " + (error?.message || "Internal error") },
      { status: 500 }
    );
  }
}
