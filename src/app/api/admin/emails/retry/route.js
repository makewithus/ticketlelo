import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { EmailJobRepository } from "@/lib/email/job-repository";
import { processEmailJob } from "@/lib/email/queue";
import { EmailStatus } from "@/lib/email/types";

/**
 * POST /api/admin/emails/retry
 *
 * Superadmin API endpoint to safely retry a failed or scheduled email job.
 * Body: { jobId }
 */
export async function POST(request) {
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

    const { jobId } = await request.json();
    if (!jobId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    }

    const job = await EmailJobRepository.getJob(jobId);
    if (!job) {
      return NextResponse.json({ error: "Email job not found" }, { status: 404 });
    }

    // Reset job status to QUEUED
    await EmailJobRepository.updateJob(jobId, {
      status: EmailStatus.QUEUED,
      error: null,
      nextScheduledAttempt: new Date(),
      updatedAt: new Date(),
    });

    // Trigger immediate async execution
    setImmediate(() => {
      processEmailJob(jobId, "admin-retry").catch(console.error);
    });

    return NextResponse.json({
      success: true,
      message: `Job ${jobId} successfully re-queued for processing`,
      jobId,
    });
  } catch (error) {
    console.error("[admin/emails/retry] Error:", error);
    return NextResponse.json(
      { error: "Failed to retry job: " + (error?.message || "Internal error") },
      { status: 500 }
    );
  }
}
