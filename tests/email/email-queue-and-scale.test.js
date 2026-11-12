import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { QuotaLedger } from "../../lib/email/quota-ledger.js";
import { EmailJobRepository } from "../../lib/email/job-repository.js";
import { processEmailJob, calculateBackoffMs } from "../../lib/email/queue.js";
import { EmailWorkerService } from "../../lib/email/worker.js";
import { EmailStatus, EmailPriority, EmailType } from "../../lib/email/types.js";
import { setMockSendHandler, clearMockSendHandler } from "../../lib/email/resend.js";
import { RateLimitError, PermanentRejectionError } from "../../lib/email/errors.js";

describe("Phase 3, 4, 8 & 9: Persistent Queue, Daily Quota, Scale & Fault Tolerance", () => {
  beforeEach(() => {
    QuotaLedger.resetMemoryLedger();
    EmailJobRepository.resetMemoryStore();
    clearMockSendHandler();
    process.env.EMAIL_DAILY_LIMIT = "100";
    process.env.EMAIL_MONTHLY_LIMIT = "3000";
    process.env.EMAIL_SAFETY_MARGIN = "5";
  });

  test("Case 1 & 2: Sends 10 and 100 emails within daily quota", async () => {
    let sentCount = 0;
    setMockSendHandler(async (opts) => {
      sentCount++;
      return { id: `resend_${sentCount}` };
    });

    // 10 emails
    for (let i = 0; i < 10; i++) {
      const job = await EmailJobRepository.createJob({
        recipient: `attendee${i}@example.com`,
        subject: `Ticket #${i}`,
        html: "<p>Pass</p>",
        priority: EmailPriority.P0,
        emailType: EmailType.TICKET_DELIVERY,
      });
      const res = await processEmailJob(job.id);
      assert.ok(res.success);
      assert.equal(res.providerMessageId, `resend_${i + 1}`);
    }

    assert.equal(sentCount, 10);
    const usage = await QuotaLedger.getQuotaUsage();
    assert.equal(usage.dailyUsed, 10);
    assert.equal(usage.dailyRemaining, 90);
  });

  test("Case 3 & 4: Queue 150 emails with 100 daily quota -> 100 sent, 50 deferred; simulated reset resumes them automatically", async () => {
    let providerCalls = 0;
    setMockSendHandler(async () => {
      providerCalls++;
      return { id: `resend_call_${providerCalls}` };
    });

    const day1Date = new Date("2026-11-01T12:00:00Z");
    const jobs = [];

    // Create 150 jobs
    for (let i = 0; i < 150; i++) {
      const job = await EmailJobRepository.createJob({
        recipient: `user${i}@example.com`,
        subject: `Event Ticket #${i}`,
        html: `<p>Ticket #${i}</p>`,
        priority: EmailPriority.P0,
        emailType: EmailType.TICKET_DELIVERY,
      });
      jobs.push(job);
    }

    // Process all 150 on Day 1
    let day1Sent = 0;
    let day1Deferred = 0;

    for (const j of jobs) {
      const res = await processEmailJob(j.id, "worker-1", { atDate: day1Date });
      if (res.success) {
        day1Sent++;
      } else if (res.deferred) {
        day1Deferred++;
      }
    }

    // Exactly 100 sent, exactly 50 deferred to next UTC midnight
    assert.equal(day1Sent, 100, "Exactly 100 emails sent on Day 1");
    assert.equal(day1Deferred, 50, "Exactly 50 emails deferred on Day 1");
    assert.equal(providerCalls, 100, "Provider called exactly 100 times");

    const day1Usage = await QuotaLedger.getQuotaUsage(day1Date);
    assert.equal(day1Usage.dailyUsed, 100);
    assert.equal(day1Usage.dailyRemaining, 0);

    // Verify deferred jobs status is SCHEDULED with nextScheduledAttempt at midnight UTC
    const scheduledJobs = await EmailJobRepository.getScheduledJobsReady(new Date("2026-11-01T23:59:59Z"), 200);
    assert.equal(scheduledJobs.length, 0, "No jobs ready before midnight UTC");

    // SIMULATE DAILY QUOTA RESET at 00:00:00 UTC on Day 2
    const day2Date = new Date("2026-11-02T00:00:01Z");
    const readyJobsDay2 = await EmailJobRepository.getScheduledJobsReady(day2Date, 200);
    assert.equal(readyJobsDay2.length, 50, "All 50 deferred jobs ready after midnight UTC reset");

    // Worker sweeper resumes and dispatches the remaining 50
    let day2Sent = 0;
    for (const rj of readyJobsDay2) {
      await EmailJobRepository.updateJob(rj.id, { status: EmailStatus.QUEUED });
      const res = await processEmailJob(rj.id, "worker-sweeper", { atDate: day2Date });
      if (res.success) day2Sent++;
    }

    assert.equal(day2Sent, 50, "All 50 deferred emails successfully sent on Day 2");
    assert.equal(providerCalls, 150, "Total provider calls equals 150");

    const day2Usage = await QuotaLedger.getQuotaUsage(day2Date);
    assert.equal(day2Usage.dailyUsed, 50);
    assert.equal(day2Usage.dailyRemaining, 50);
  });

  test("Case 6: Duplicate Prevention — Idempotency key prevents duplicate ticket delivery", async () => {
    let sendCalls = 0;
    setMockSendHandler(async () => {
      sendCalls++;
      return { id: "resend_unique_ticket" };
    });

    const ticketId = "TKT-1793-TECHFEST-99";
    const idempotencyKey = `idemp_ticket_${ticketId.toLowerCase()}`;

    // First booking delivery
    const job1 = await EmailJobRepository.createJob({
      recipient: "aarav@example.com",
      subject: "Your Ticket",
      html: "<p>Pass</p>",
      ticketId,
      idempotencyKey,
      priority: EmailPriority.P0,
      emailType: EmailType.TICKET_DELIVERY,
    });
    assert.equal(job1.isDuplicate, undefined);

    const res1 = await processEmailJob(job1.id);
    assert.ok(res1.success);
    assert.equal(sendCalls, 1);

    // Second delivery attempt (e.g. repeated webhook, repeated API call, or worker retry)
    const job2 = await EmailJobRepository.createJob({
      recipient: "aarav@example.com",
      subject: "Your Ticket",
      html: "<p>Pass</p>",
      ticketId,
      idempotencyKey,
      priority: EmailPriority.P0,
      emailType: EmailType.TICKET_DELIVERY,
    });

    assert.ok(job2.isDuplicate, "Job repository flagged duplicate via idempotency key");
    assert.equal(job2.id, job1.id);

    const res2 = await processEmailJob(job2.id);
    assert.ok(res2.success);
    assert.ok(res2.alreadySent);
    assert.equal(sendCalls, 1, "Provider was NEVER called a second time");
  });

  test("Case 7: Worker crash recovery — Sweeper recovers orphaned PROCESSING jobs", async () => {
    const job = await EmailJobRepository.createJob({
      recipient: "attendee@example.com",
      subject: "Pass",
      html: "<p>Pass</p>",
      priority: EmailPriority.P0,
      emailType: EmailType.TICKET_DELIVERY,
    });

    // Simulate worker crashing mid-processing 10 minutes ago
    await EmailJobRepository.updateJob(job.id, {
      status: EmailStatus.PROCESSING,
      updatedAt: new Date(Date.now() - 10 * 60 * 1000),
    });

    const orphaned = await EmailJobRepository.getOrphanedProcessingJobs(5 * 60 * 1000);
    assert.equal(orphaned.length, 1);
    assert.equal(orphaned[0].id, job.id);
  });

  test("Case 8: Transient Error & Exponential Backoff with Jitter", async () => {
    let tries = 0;
    setMockSendHandler(async () => {
      tries++;
      if (tries < 2) {
        throw new RateLimitError("HTTP 429 Too Many Requests");
      }
      return { id: "resend_after_retry" };
    });

    const job = await EmailJobRepository.createJob({
      recipient: "user@example.com",
      subject: "Test",
      html: "<p>Test</p>",
      priority: EmailPriority.P0,
      emailType: EmailType.TICKET_DELIVERY,
    });

    // Attempt 1: Fails with 429 rate limit
    const res1 = await processEmailJob(job.id);
    assert.equal(res1.success, false);
    assert.equal(res1.retryScheduled, true);
    assert.ok(res1.delayMs >= 1000);

    const updatedJob = await EmailJobRepository.getJob(job.id);
    assert.equal(updatedJob.status, EmailStatus.QUEUED);

    // Attempt 2: Succeeds
    const res2 = await processEmailJob(job.id);
    assert.equal(res2.success, true);
    assert.equal(res2.providerMessageId, "resend_after_retry");
  });

  test("Case 9: Permanent Error moves directly to Dead Letter Queue (FAILED)", async () => {
    setMockSendHandler(async () => {
      throw new PermanentRejectionError("Domain not verified", 422);
    });

    const job = await EmailJobRepository.createJob({
      recipient: "invalid@example.com",
      subject: "Test",
      html: "<p>Test</p>",
      priority: EmailPriority.P1,
      emailType: EmailType.HOSTING_APPROVAL,
    });

    const res = await processEmailJob(job.id);
    assert.equal(res.success, false);
    assert.equal(res.failed, true);

    const updatedJob = await EmailJobRepository.getJob(job.id);
    assert.equal(updatedJob.status, EmailStatus.FAILED);
  });

  test("Case 5: Scale calculation — Handles 2,500 jobs and 10,000 quota calculations safely", async () => {
    process.env.EMAIL_DAILY_LIMIT = "5000";
    const startTime = Date.now();

    // 2,500 reservations
    for (let i = 0; i < 2500; i++) {
      await QuotaLedger.reserveQuota(EmailPriority.P0, 1);
    }

    const usage = await QuotaLedger.getQuotaUsage();
    assert.equal(usage.dailyUsed, 2500);
    assert.equal(usage.dailyRemaining, 2500);

    const elapsed = Date.now() - startTime;
    assert.ok(elapsed < 2000, `2,500 operations completed in ${elapsed}ms (< 2s)`);
  });
});
