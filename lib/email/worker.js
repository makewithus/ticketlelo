/**
 * TicketLelo Email Infrastructure - Dedicated Background Worker
 *
 * Runs persistent background processing for BullMQ email jobs,
 * coordinates concurrency, recovers crashed jobs, and scans for
 * SCHEDULED deferred jobs to automatically resume them when daily/monthly
 * quota resets.
 */

import { Worker } from "bullmq";
import { getEmailConfig } from "./config.js";
import { processEmailJob, getBullQueue } from "./queue.js";
import { EmailJobRepository } from "./job-repository.js";
import { EmailStatus, PriorityWeights } from "./types.js";
import { emailLogger } from "./logger.js";

const QUEUE_NAME = "ticketlelo-email-queue";

export class EmailWorkerService {
  constructor(options = {}) {
    this.concurrency = options.concurrency || Number(process.env.EMAIL_WORKER_CONCURRENCY || 5);
    this.worker = null;
    this.sweeperInterval = null;
    this.isRunning = false;
  }

  /**
   * Starts the background worker and recovery sweepers.
   */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;

    const config = getEmailConfig();
    emailLogger.info("Starting TicketLelo Email Worker Service", {
      concurrency: this.concurrency,
      hasRedis: config.hasRedis,
      dailyLimit: config.dailyLimit,
      monthlyLimit: config.monthlyLimit,
    });

    if (config.hasRedis) {
      try {
        this.worker = new Worker(
          QUEUE_NAME,
          async (bullJob) => {
            const { jobId } = bullJob.data;
            return await processEmailJob(jobId, `bullmq-${this.worker.id || "worker"}`);
          },
          {
            connection: {
              url: config.redisUrl,
            },
            concurrency: this.concurrency,
          }
        );

        this.worker.on("completed", (job) => {
          emailLogger.debug(`BullMQ job ${job.id} completed successfully`);
        });

        this.worker.on("failed", (job, err) => {
          emailLogger.warn(`BullMQ job ${job?.id} failed in worker`, { error: err.message });
        });
      } catch (workerErr) {
        emailLogger.error("Failed initializing BullMQ worker", workerErr);
      }
    }

    // Start background sweeper to resume SCHEDULED jobs when quota resets,
    // and recover any orphaned PROCESSING jobs
    this.sweeperInterval = setInterval(() => {
      this.sweepAndResume().catch((err) => {
        emailLogger.error("Error during quota resume sweep", err);
      });
    }, 30000); // Check every 30 seconds

    // Initial sweep immediately
    this.sweepAndResume().catch(() => {});
  }

  /**
   * Scans for deferred jobs whose reset timestamp has arrived,
   * and orphaned jobs stuck in PROCESSING.
   */
  async sweepAndResume() {
    const now = new Date();
    const config = getEmailConfig();

    // 1. Recover deferred SCHEDULED jobs (quota reset has arrived or backoff delay passed)
    try {
      const scheduledJobs = await EmailJobRepository.getScheduledJobsReady(now, 100);
      if (scheduledJobs.length > 0) {
        emailLogger.info(`Sweeper discovered ${scheduledJobs.length} scheduled jobs ready for dispatch`);
        const bullQueue = getBullQueue();

        for (const job of scheduledJobs) {
          await EmailJobRepository.updateJob(job.id, {
            status: EmailStatus.QUEUED,
            updatedAt: now,
          });

          if (bullQueue) {
            const priorityWeight = PriorityWeights[job.priority] || 3;
            await bullQueue.add(job.id, { jobId: job.id }, { priority: priorityWeight, jobId: job.id });
          } else {
            setImmediate(() => {
              processEmailJob(job.id).catch((e) => emailLogger.error("Sweeper async execution error", e));
            });
          }
        }
      }
    } catch (schedErr) {
      emailLogger.warn("Failed checking scheduled jobs during sweep", { error: schedErr.message });
    }

    // 2. Recover orphaned/stale jobs (crashed workers, unqueued pending, lease timeouts)
    try {
      const recovered = await EmailJobRepository.recoverStaleJobs({ staleMs: 5 * 60 * 1000 });
      if (recovered.length > 0) {
        emailLogger.warn(`Sweeper recovered ${recovered.length} stale/orphaned jobs`, {
          deadLettered: recovered.filter((r) => r.recoveryAction === "dead_lettered").length,
          rescheduled: recovered.filter((r) => r.recoveryAction === "rescheduled").length,
          queued: recovered.filter((r) => r.recoveryAction === "queued_from_pending").length,
        });
      }
    } catch (orphanErr) {
      emailLogger.warn("Failed checking orphaned jobs during sweep", { error: orphanErr.message });
    }

    // 3. Process QUEUED jobs if Redis is not active
    if (!config.hasRedis) {
      try {
        const queuedJobs = await EmailJobRepository.getQueuedJobs(20, now);
        for (const job of queuedJobs) {
          await processEmailJob(job.id, "worker-standalone");
        }
      } catch (queueErr) {
        emailLogger.warn("Failed processing queued jobs in standalone worker", { error: queueErr.message });
      }
    }
  }

  /**
   * Graceful shutdown.
   */
  async stop() {
    this.isRunning = false;
    if (this.sweeperInterval) {
      clearInterval(this.sweeperInterval);
      this.sweeperInterval = null;
    }
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
    emailLogger.info("TicketLelo Email Worker Service stopped gracefully");
  }
}

let globalWorkerInstance = null;

export function getGlobalEmailWorker() {
  if (!globalWorkerInstance) {
    globalWorkerInstance = new EmailWorkerService();
  }
  return globalWorkerInstance;
}
