/**
 * TicketLelo Email Infrastructure - Queue Producer & Execution Engine
 *
 * Provides persistent background queuing via BullMQ when Redis is available,
 * with durable zero-loss processing backed by the Firestore EmailJobRepository.
 *
 * Guarantees that HTTP API requests (such as ticket checkout) are never blocked
 * by email delivery, and that quota exhaustion automatically defers jobs rather
 * than dropping them.
 */

import { Queue } from "bullmq";
import { getEmailConfig } from "./config.js";
import { EmailJobRepository } from "./job-repository.js";
import { QuotaLedger } from "./quota-ledger.js";
import { EmailSuppression } from "./suppression.js";
import { sendViaResend } from "./resend.js";
import { emailLogger } from "./logger.js";
import { EmailStatus, EmailPriority, PriorityWeights } from "./types.js";
import { validateEmailPayload } from "./validator.js";
import { DailyQuotaExhaustedError, MonthlyQuotaExhaustedError } from "./errors.js";

const QUEUE_NAME = "ticketlelo-email-queue";
let bullQueueInstance = null;

/**
 * Initializes or returns the BullMQ Queue instance if Redis is configured.
 */
export function getBullQueue() {
  const config = getEmailConfig();
  if (!config.hasRedis) {
    return null;
  }

  if (!bullQueueInstance) {
    try {
      bullQueueInstance = new Queue(QUEUE_NAME, {
        connection: {
          url: config.redisUrl,
        },
        defaultJobOptions: {
          removeOnComplete: 1000,
          removeOnFail: 5000,
          attempts: 1, // We handle exponential backoff and persistent rescheduling at our ledger layer
        },
      });
      emailLogger.info("BullMQ persistent email queue initialized with Redis");
    } catch (err) {
      emailLogger.warn("Failed initializing BullMQ with Redis, falling back to durable runner", { error: err.message });
      bullQueueInstance = null;
    }
  }

  return bullQueueInstance;
}

/**
 * Calculates exponential backoff with random jitter.
 */
export function calculateBackoffMs(attemptCount, baseMs = 1000, maxMs = 60000) {
  const exp = Math.min(6, Math.max(0, attemptCount - 1));
  const delay = Math.min(maxMs, baseMs * Math.pow(2, exp));
  const jitter = Math.floor(Math.random() * 500);
  return delay + jitter;
}

/**
 * Core atomic execution unit for an email job.
 * Used by BullMQ workers and the asynchronous durable engine.
 *
 * @param {string} jobId
 * @param {string} [workerId="engine"]
 * @returns {Promise<Object>} Execution result
 */
export async function processEmailJob(jobId, workerId = "engine", options = {}) {
  const atDate = options?.atDate || new Date();
  const job = await EmailJobRepository.getJob(jobId);
  if (!job) {
    emailLogger.warn("Job not found for execution", { jobId });
    return { success: false, reason: "job_not_found" };
  }

  // Idempotency check: if already completed, do nothing
  if (job.status === EmailStatus.SENT || job.status === EmailStatus.DELIVERED) {
    emailLogger.info("Job already completed, skipping redundant dispatch", { jobId, status: job.status });
    return { success: true, alreadySent: true, providerMessageId: job.providerMessageId };
  }

  // Check suppression
  const isSuppressed = await EmailSuppression.isSuppressed(job.recipient);
  if (isSuppressed) {
    await EmailJobRepository.updateJob(jobId, {
      status: EmailStatus.FAILED,
      error: `Recipient ${job.recipient} is on suppression list`,
      updatedAt: new Date(),
    });
    emailLogger.warn("Email dispatch blocked by suppression list", { jobId, recipient: job.recipient });
    return { success: false, reason: "suppressed" };
  }

  // Atomically claim the job
  const claimed = await EmailJobRepository.claimJob(jobId, workerId);
  if (!claimed) {
    emailLogger.debug("Job could not be claimed (likely handled by another worker)", { jobId });
    return { success: false, reason: "already_claimed" };
  }

  // Check & Reserve Quota
  let quotaReservation = null;
  try {
    quotaReservation = await QuotaLedger.reserveQuota(claimed.priority, 1, atDate);
  } catch (quotaError) {
    if (
      quotaError instanceof DailyQuotaExhaustedError ||
      quotaError instanceof MonthlyQuotaExhaustedError
    ) {
      const isDaily = quotaError instanceof DailyQuotaExhaustedError;
      const nextResetAt = quotaError.nextResetAt || new Date(Date.now() + 3600000);

      emailLogger.warn(`Quota exhausted (${isDaily ? "Daily" : "Monthly"}), deferring job`, {
        jobId,
        recipient: claimed.recipient,
        priority: claimed.priority,
        nextResetAt,
      });

      await EmailJobRepository.updateJob(jobId, {
        status: EmailStatus.SCHEDULED,
        nextScheduledAttempt: nextResetAt,
        error: quotaError.message,
        updatedAt: new Date(),
      });

      return {
        success: false,
        deferred: true,
        reason: isDaily ? "daily_quota_exhausted" : "monthly_quota_exhausted",
        nextResetAt,
      };
    }
    throw quotaError;
  }

  // Quota successfully reserved. Now dispatch through Resend provider
  try {
    const resendResponse = await sendViaResend({
      to: claimed.payload.to,
      subject: claimed.payload.subject,
      html: claimed.payload.html,
      text: claimed.payload.text,
      attachments: claimed.payload.attachments,
      headers: claimed.payload.headers,
      idempotencyKey: claimed.idempotencyKey,
    });

    const now = new Date();
    await EmailJobRepository.updateJob(jobId, {
      status: EmailStatus.SENT,
      providerMessageId: resendResponse.id,
      sentAt: now,
      error: null,
      updatedAt: now,
    });

    emailLogger.info("Job successfully sent through Resend", {
      jobId,
      recipient: claimed.recipient,
      providerId: resendResponse.id,
      priority: claimed.priority,
    });

    return {
      success: true,
      providerMessageId: resendResponse.id,
      jobId,
    };
  } catch (sendError) {
    emailLogger.error("Failed sending email via Resend", sendError, { jobId, recipient: claimed.recipient });

    // Release unconsumed quota reservation
    await QuotaLedger.releaseQuota(1);

    const isRetryable = sendError.isRetryable !== false;
    const attemptCount = claimed.attemptCount || 1;
    const maxAttempts = claimed.maxAttempts || 5;

    if (isRetryable && attemptCount < maxAttempts) {
      const delayMs = calculateBackoffMs(attemptCount);
      const nextAttempt = new Date(Date.now() + delayMs);

      await EmailJobRepository.updateJob(jobId, {
        status: EmailStatus.QUEUED,
        nextScheduledAttempt: nextAttempt,
        error: sendError.message,
        updatedAt: new Date(),
      });

      emailLogger.info(`Scheduled retry for job ${jobId} in ${delayMs}ms (attempt ${attemptCount}/${maxAttempts})`);

      return {
        success: false,
        retryScheduled: true,
        delayMs,
        attemptCount,
        nextAttempt,
      };
    }

    // Permanent failure or max attempts exhausted -> Dead Letter State
    await EmailJobRepository.updateJob(jobId, {
      status: EmailStatus.FAILED,
      error: sendError.message,
      updatedAt: new Date(),
    });

    emailLogger.error(`Job ${jobId} permanently failed and moved to dead-letter status: ${sendError.message}`);

    return {
      success: false,
      failed: true,
      error: sendError.message,
    };
  }
}

/**
 * Public entrypoint to enqueue an email job.
 * Non-blocking: returns job metadata immediately to caller.
 *
 * @param {Object} options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Subject line
 * @param {string} options.html - HTML content
 * @param {string} [options.text] - Plain text content
 * @param {string} [options.priority="P2"] - EmailPriority (P0, P1, P2, P3)
 * @param {string} [options.emailType="transactional"] - Canonical email type
 * @param {string} [options.idempotencyKey] - Unique deduplication key
 * @param {string} [options.eventId] - Event reference
 * @param {string} [options.ticketId] - Ticket reference
 * @param {string} [options.bookingId] - Booking reference
 * @param {Array} [options.attachments] - Array of attachments
 * @returns {Promise<Object>} Job submission metadata
 */
export async function enqueueEmail(options) {
  const validated = validateEmailPayload(options);

  // If internal suppressed mailbox (e.g. non-existent superadmin inbox), skip silently
  if (!validated.to) {
    emailLogger.info("Email enqueue skipped for suppressed internal administrative address");
    return {
      success: true,
      suppressed: true,
      message: "Skipped for suppressed internal address",
    };
  }

  // Create durable job record
  const job = await EmailJobRepository.createJob({
    recipient: validated.to,
    subject: validated.subject,
    html: validated.html,
    text: validated.text,
    priority: validated.priority,
    emailType: validated.emailType,
    idempotencyKey: validated.idempotencyKey,
    eventId: options.eventId || null,
    ticketId: options.ticketId || null,
    bookingId: options.bookingId || null,
    templateId: options.templateId || "custom",
    attachments: validated.attachments,
    headers: options.headers || {},
  });

  if (job.isDuplicate) {
    return {
      success: true,
      jobId: job.id,
      idempotencyKey: job.idempotencyKey,
      status: job.status,
      isDuplicate: true,
      message: "Existing email job returned via idempotency key",
    };
  }

  // Push to BullMQ if Redis queue is active
  const bullQueue = getBullQueue();
  if (bullQueue) {
    try {
      const priorityWeight = PriorityWeights[validated.priority] || 3;
      await bullQueue.add(
        job.id,
        { jobId: job.id },
        {
          priority: priorityWeight,
          jobId: job.id,
        }
      );
      emailLogger.debug("Job enqueued in BullMQ", { jobId: job.id, priorityWeight });
    } catch (err) {
      emailLogger.warn("BullMQ push failed, triggering background runner", { jobId: job.id, error: err.message });
      // Run asynchronously without awaiting to ensure HTTP caller is never blocked
      setImmediate(() => {
        processEmailJob(job.id).catch((e) => emailLogger.error("Async execution error", e));
      });
    }
  } else {
    // Run asynchronously without awaiting so HTTP request terminates immediately
    setImmediate(() => {
      processEmailJob(job.id).catch((e) => emailLogger.error("Async execution error", e));
    });
  }

  return {
    success: true,
    jobId: job.id,
    idempotencyKey: job.idempotencyKey,
    status: EmailStatus.QUEUED,
  };
}
