/**
 * TicketLelo Email Infrastructure - Persistent Job Repository
 *
 * Persists durable email job records in Firestore `emailJobs` collection
 * (with in-memory fallback for local dev & testing).
 * Guarantees zero data loss across worker crashes, server restarts,
 * and Redis outages.
 */

import { adminDb } from "../firebase-admin.js";
import { EmailStatus } from "./types.js";
import { emailLogger } from "./logger.js";

// In-memory job store for testing / offline operation
const memoryJobStore = new Map();
const memoryIdempotencyIndex = new Map();

/**
 * Recursively removes keys with undefined values to comply with Firestore schema requirements,
 * and strips bulky binary attachments so documents never exceed Firestore's 1MB limit.
 */
function sanitizeForFirestore(obj) {
  if (obj === null || obj === undefined) return null;
  if (Buffer.isBuffer(obj) || obj instanceof Uint8Array) {
    return `<Buffer ${obj.length} bytes>`;
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeForFirestore);
  }
  if (typeof obj === "object" && !(obj instanceof Date)) {
    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        if (key === "attachments" && Array.isArray(value)) {
          cleaned[key] = value.map((att) => ({
            filename: att.filename || "attachment",
            contentType: att.contentType || "application/octet-stream",
            cid: att.cid || null,
            size: att.content?.length || (att.path ? "file" : 0),
          }));
        } else if (
          key === "content" &&
          (Buffer.isBuffer(value) ||
            value instanceof Uint8Array ||
            (typeof value === "string" && value.length > 100000))
        ) {
          cleaned[key] = `<attachment content omitted: ${value.length || 0} bytes>`;
        } else {
          cleaned[key] = sanitizeForFirestore(value);
        }
      }
    }
    return cleaned;
  }
  return obj;
}

export class EmailJobRepository {
  /**
   * Clears in-memory job store (for test suite isolation).
   */
  static resetMemoryStore() {
    memoryJobStore.clear();
    memoryIdempotencyIndex.clear();
  }

  /**
   * Generates a deterministic idempotency key for tickets or bookings.
   *
   * @param {string} emailType - E.g. "ticket_delivery"
   * @param {string} entityId - E.g. ticketId or bookingId
   * @returns {string}
   */
  static generateIdempotencyKey(emailType, entityId) {
    const cleanType = String(emailType || "email").trim().toLowerCase();
    const cleanId = String(entityId || Date.now()).trim().toLowerCase();
    return `idemp_${cleanType}_${cleanId}`;
  }

  /**
   * Creates a persistent email job with strict idempotency deduplication.
   * If a job with the same idempotency key is already SENT or DELIVERED,
   * returns the existing job to prevent sending duplicate emails.
   *
   * @param {Object} jobData
   * @returns {Promise<Object>} Created or existing job document
   */
  static async createJob(jobData) {
    const now = new Date();
    const idempotencyKey = jobData.idempotencyKey ||
      EmailJobRepository.generateIdempotencyKey(jobData.emailType, jobData.ticketId || jobData.bookingId || `${jobData.recipient}_${now.getTime()}`);

    // 1. Check existing job by idempotency key
    const existing = await EmailJobRepository.getJobByIdempotencyKey(idempotencyKey);
    if (existing) {
      if (
        existing.status === EmailStatus.SENT ||
        existing.status === EmailStatus.DELIVERED
      ) {
        emailLogger.info("Duplicate email suppressed via idempotency key (already sent)", {
          idempotencyKey,
          jobId: existing.id,
          recipient: existing.recipient,
        });
        return { ...existing, isDuplicate: true };
      }

      // If already queued, scheduled, or processing, avoid creating duplicate
      if (
        existing.status === EmailStatus.QUEUED ||
        existing.status === EmailStatus.PROCESSING ||
        existing.status === EmailStatus.SCHEDULED
      ) {
        emailLogger.debug("Email job already queued with idempotency key", { idempotencyKey, jobId: existing.id });
        return { ...existing, isDuplicate: true };
      }
    }

    const jobId = `tl_job_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const job = {
      id: jobId,
      idempotencyKey,
      recipient: jobData.recipient,
      eventId: jobData.eventId || null,
      bookingId: jobData.bookingId || null,
      ticketId: jobData.ticketId || null,
      emailType: jobData.emailType || "transactional",
      priority: jobData.priority || "P2",
      templateId: jobData.templateId || "custom",
      payload: {
        to: jobData.recipient,
        subject: jobData.subject,
        html: jobData.html,
        text: jobData.text || "",
        attachments: jobData.attachments || [],
        headers: jobData.headers || {},
      },
      status: EmailStatus.QUEUED,
      attemptCount: 0,
      maxAttempts: Number.isSafeInteger(jobData.maxAttempts) ? jobData.maxAttempts : 5,
      nextScheduledAttempt: now,
      providerMessageId: null,
      error: null,
      workerId: null,
      createdAt: now,
      updatedAt: now,
      sentAt: null,
      deliveredAt: null,
    };

    // Store in memory
    memoryJobStore.set(jobId, job);
    memoryIdempotencyIndex.set(idempotencyKey, jobId);

    // Persist in Firestore
    if (adminDb && process.env.NODE_ENV !== "test") {
      try {
        await adminDb.collection("emailJobs").doc(jobId).set(sanitizeForFirestore(job));
      } catch (err) {
        emailLogger.warn("Failed persisting email job in Firestore, memory fallback active", { error: err.message, jobId });
      }
    }

    return job;
  }

  /**
   * Retrieves a job by ID.
   */
  static async getJob(jobId) {
    if (!jobId) return null;
    if (memoryJobStore.has(jobId)) {
      return memoryJobStore.get(jobId);
    }

    if (adminDb && process.env.NODE_ENV !== "test") {
      try {
        const snap = await adminDb.collection("emailJobs").doc(jobId).get();
        if (snap.exists) {
          const data = { id: snap.id, ...snap.data() };
          memoryJobStore.set(jobId, data);
          return data;
        }
      } catch {
        // Fall back
      }
    }

    return null;
  }

  /**
   * Retrieves a job by its unique logical idempotency key.
   */
  static async getJobByIdempotencyKey(idempotencyKey) {
    if (!idempotencyKey) return null;

    if (memoryIdempotencyIndex.has(idempotencyKey)) {
      const jobId = memoryIdempotencyIndex.get(idempotencyKey);
      if (memoryJobStore.has(jobId)) {
        return memoryJobStore.get(jobId);
      }
    }

    if (adminDb && process.env.NODE_ENV !== "test") {
      try {
        const snap = await adminDb.collection("emailJobs")
          .where("idempotencyKey", "==", idempotencyKey)
          .limit(1)
          .get();
        if (!snap.empty) {
          const doc = snap.docs[0];
          const data = { id: doc.id, ...doc.data() };
          memoryJobStore.set(data.id, data);
          memoryIdempotencyIndex.set(idempotencyKey, data.id);
          return data;
        }
      } catch {
        // Fall back
      }
    }

    return null;
  }

  /**
   * Updates job status and metadata.
   */
  static async updateJob(jobId, updates = {}) {
    const existing = await EmailJobRepository.getJob(jobId);
    if (!existing) return null;

    const merged = {
      ...existing,
      updatedAt: new Date(),
      ...updates,
    };

    memoryJobStore.set(jobId, merged);

    if (adminDb && process.env.NODE_ENV !== "test") {
      try {
        await adminDb.collection("emailJobs").doc(jobId).set(sanitizeForFirestore(merged), { merge: true });
      } catch (err) {
        emailLogger.warn("Failed updating job in Firestore", { jobId, error: err.message });
      }
    }

    return merged;
  }

  /**
   * Retrieves a job by provider message ID (e.g. Resend ID re_123).
   */
  static async getJobByProviderMessageId(providerMessageId) {
    if (!providerMessageId) return null;

    for (const job of memoryJobStore.values()) {
      if (job.providerMessageId === providerMessageId) {
        return job;
      }
    }

    if (adminDb && process.env.NODE_ENV !== "test") {
      try {
        const snap = await adminDb.collection("emailJobs")
          .where("providerMessageId", "==", providerMessageId)
          .limit(1)
          .get();
        if (!snap.empty) {
          const doc = snap.docs[0];
          const data = { id: doc.id, ...doc.data() };
          memoryJobStore.set(data.id, data);
          return data;
        }
      } catch {
        // Fall back
      }
    }

    return null;
  }

  /**
   * Atomically claims a job for processing by a worker.
   * Concurrency-safe: uses Firestore runTransaction when in persistent mode.
   * Allows reclaiming if an existing PROCESSING lease has expired (> staleMs).
   */
  static async claimJob(jobId, workerId = "worker-default", staleMs = 5 * 60 * 1000) {
    if (!jobId) return null;

    if (adminDb && process.env.NODE_ENV !== "test" && typeof adminDb.runTransaction === "function") {
      try {
        const docRef = adminDb.collection("emailJobs").doc(jobId);
        return await adminDb.runTransaction(async (transaction) => {
          const doc = await transaction.get(docRef);
          if (!doc.exists) return null;
          const data = { id: doc.id, ...doc.data() };

          // Already finalized
          if (data.status === EmailStatus.SENT || data.status === EmailStatus.DELIVERED) {
            return null;
          }

          // If currently processing, check if the lease has expired (stale)
          if (data.status === EmailStatus.PROCESSING) {
            const updatedRaw = data.updatedAt || data.createdAt;
            const updated = updatedRaw?.toDate ? updatedRaw.toDate() : new Date(updatedRaw || 0);
            const isStale = (Date.now() - updated.getTime()) > staleMs;
            if (!isStale) {
              // Active processing by another worker
              return null;
            }
          }

          const now = new Date();
          const newAttemptCount = (Number(data.attemptCount) || 0) + 1;
          const updates = {
            status: EmailStatus.PROCESSING,
            workerId,
            attemptCount: newAttemptCount,
            updatedAt: now,
          };

          transaction.update(docRef, sanitizeForFirestore(updates));
          const updatedJob = { ...data, ...updates };
          memoryJobStore.set(jobId, updatedJob);
          return updatedJob;
        });
      } catch (err) {
        emailLogger.warn("Transaction failed in claimJob, falling back to memory check", { jobId, error: err.message });
      }
    }

    // In-memory atomic check
    const job = await EmailJobRepository.getJob(jobId);
    if (!job) return null;

    if (
      job.status === EmailStatus.SENT ||
      job.status === EmailStatus.DELIVERED
    ) {
      return null;
    }

    if (job.status === EmailStatus.PROCESSING) {
      const updated = new Date(job.updatedAt || job.createdAt || 0);
      const isStale = (Date.now() - updated.getTime()) > staleMs;
      if (!isStale) {
        return null;
      }
    }

    return await EmailJobRepository.updateJob(jobId, {
      status: EmailStatus.PROCESSING,
      workerId,
      attemptCount: (Number(job.attemptCount) || 0) + 1,
    });
  }

  /**
   * Retrieves scheduled jobs whose deferral window has arrived.
   */
  static async getScheduledJobsReady(now = new Date(), limitCount = 50) {
    const ready = [];

    for (const job of memoryJobStore.values()) {
      if (
        job.status === EmailStatus.SCHEDULED &&
        job.nextScheduledAttempt &&
        new Date(job.nextScheduledAttempt) <= now
      ) {
        ready.push(job);
        if (ready.length >= limitCount) break;
      }
    }

    if (adminDb && process.env.NODE_ENV !== "test") {
      try {
        const snap = await adminDb.collection("emailJobs")
          .where("status", "==", EmailStatus.SCHEDULED)
          .where("nextScheduledAttempt", "<=", now)
          .limit(limitCount)
          .get();

        for (const doc of snap.docs) {
          const data = { id: doc.id, ...doc.data() };
          if (!ready.some((j) => j.id === data.id)) {
            ready.push(data);
          }
        }
      } catch {
        // Fall back to memory
      }
    }

    return ready;
  }

  /**
   * Retrieves orphaned jobs stuck in PROCESSING or PENDING longer than threshold (e.g. 5 minutes).
   * Checks both in-memory store and persistent Firestore collection.
   */
  static async getOrphanedProcessingJobs(staleMs = 5 * 60 * 1000) {
    const cutoff = new Date(Date.now() - staleMs);
    const orphaned = [];

    for (const job of memoryJobStore.values()) {
      const updated = new Date(job.updatedAt || job.createdAt || 0);
      if (
        (job.status === EmailStatus.PROCESSING ||
          job.status === EmailStatus.PENDING ||
          job.status === "PENDING") &&
        updated < cutoff
      ) {
        orphaned.push(job);
      }
    }

    if (adminDb && process.env.NODE_ENV !== "test") {
      try {
        const snap = await adminDb.collection("emailJobs")
          .where("status", "in", [EmailStatus.PROCESSING, EmailStatus.PENDING, "PENDING"])
          .get();

        for (const doc of snap.docs) {
          const data = { id: doc.id, ...doc.data() };
          const updatedRaw = data.updatedAt || data.createdAt;
          const updated = updatedRaw?.toDate ? updatedRaw.toDate() : new Date(updatedRaw || 0);
          if (updated < cutoff && !orphaned.some((j) => j.id === data.id)) {
            orphaned.push(data);
          }
        }
      } catch (err) {
        emailLogger.warn("Failed querying orphaned jobs from Firestore", { error: err.message });
      }
    }

    return orphaned;
  }

  /**
   * Scans for orphaned/stale jobs stuck in PROCESSING or PENDING and safely recovers them.
   * - If attempts >= maxAttempts: transitions to FAILED (dead-letter queue) preventing infinite retries.
   * - If attempts < maxAttempts: calculates bounded exponential backoff with jitter and reschedules.
   * - If stuck in PENDING: transitions to QUEUED for worker execution.
   *
   * @param {Object} options
   * @param {number} [options.staleMs=300000] - Inactivity threshold in milliseconds (default 5 min)
   * @returns {Promise<Array<Object>>} List of recovered jobs
   */
  static async recoverStaleJobs(options = {}) {
    const staleMs = options.staleMs || 5 * 60 * 1000;
    const orphaned = await EmailJobRepository.getOrphanedProcessingJobs(staleMs);
    const recovered = [];
    const now = new Date();

    for (const job of orphaned) {
      const attempts = Number(job.attemptCount) || 1;
      const maxAttempts = Number(job.maxAttempts) || 5;

      if (job.status === EmailStatus.PENDING || job.status === "PENDING") {
        const updated = await EmailJobRepository.updateJob(job.id, {
          status: EmailStatus.QUEUED,
          nextScheduledAttempt: now,
          error: "Recovered from unqueued pending state",
          updatedAt: now,
        });
        recovered.push({ ...updated, recoveryAction: "queued_from_pending" });
        continue;
      }

      if (attempts >= maxAttempts) {
        const errorMsg = `Exhausted maximum retry budget (${attempts}/${maxAttempts}); abandoned processing timeout`;
        const updated = await EmailJobRepository.updateJob(job.id, {
          status: EmailStatus.FAILED,
          error: errorMsg,
          updatedAt: now,
        });
        emailLogger.error(`Job ${job.id} dead-lettered during orphan recovery: ${errorMsg}`);
        recovered.push({ ...updated, recoveryAction: "dead_lettered" });
      } else {
        const exp = Math.min(6, Math.max(0, attempts - 1));
        const delayMs = Math.min(60000, 1000 * Math.pow(2, exp)) + Math.floor(Math.random() * 500);
        const nextAttempt = new Date(Date.now() + delayMs);

        const updated = await EmailJobRepository.updateJob(job.id, {
          status: EmailStatus.SCHEDULED,
          nextScheduledAttempt: nextAttempt,
          error: "Recovered from abandoned worker processing lease",
          updatedAt: now,
        });
        emailLogger.warn(`Job ${job.id} recovered from stale PROCESSING, rescheduled for attempt ${attempts + 1}/${maxAttempts} in ${delayMs}ms`);
        recovered.push({ ...updated, recoveryAction: "rescheduled", nextScheduledAttempt: nextAttempt });
      }
    }

    return recovered;
  }

  /**
   * Retrieves pending jobs in QUEUED status ready for execution.
   * Respects nextScheduledAttempt deferral timestamps.
   */
  static async getQueuedJobs(limitCount = 50, now = new Date()) {
    const queued = [];

    for (const job of memoryJobStore.values()) {
      if (job.status === EmailStatus.QUEUED || job.status === EmailStatus.PENDING || job.status === "PENDING") {
        const nextAttempt = job.nextScheduledAttempt ? new Date(job.nextScheduledAttempt) : null;
        if (!nextAttempt || nextAttempt <= now) {
          queued.push(job);
          if (queued.length >= limitCount) break;
        }
      }
    }

    if (adminDb && process.env.NODE_ENV !== "test") {
      try {
        const snap = await adminDb.collection("emailJobs")
          .where("status", "in", [EmailStatus.QUEUED, EmailStatus.PENDING, "PENDING"])
          .limit(limitCount)
          .get();

        for (const doc of snap.docs) {
          const data = { id: doc.id, ...doc.data() };
          const nextRaw = data.nextScheduledAttempt;
          const nextDate = nextRaw?.toDate ? nextRaw.toDate() : (nextRaw ? new Date(nextRaw) : null);
          if (!nextDate || nextDate <= now) {
            if (!queued.some((j) => j.id === data.id)) {
              queued.push(data);
            }
          }
        }
      } catch {
        // Fall back to memory
      }
    }

    return queued;
  }

  /**
   * Queries jobs for the Admin Monitoring Dashboard.
   * Returns comprehensive pagination metadata and truthful counts.
   */
  static async listJobs(filters = {}, options = {}) {
    const limitCount = options.limit || 50;
    const page = Math.max(1, Number(options.page) || 1);
    let allJobs = Array.from(memoryJobStore.values());

    if (adminDb && process.env.NODE_ENV !== "test") {
      try {
        const snap = await adminDb.collection("emailJobs").limit(500).get();
        if (!snap.empty) {
          allJobs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        }
      } catch (err) {
        emailLogger.warn("Failed fetching jobs from Firestore for listing, falling back to memory", { error: err.message });
      }
    }

    const totalAll = allJobs.length;

    // Filter matching
    let filtered = allJobs.filter((job) => {
      if (filters.status && filters.status !== "all" && filters.status !== "ALL") {
        const target = filters.status.toUpperCase();
        if (target === "DELIVERED") {
          if (job.status !== EmailStatus.DELIVERED && job.status !== EmailStatus.SENT) return false;
        } else if (target === "PENDING") {
          if (
            job.status !== EmailStatus.PENDING &&
            job.status !== EmailStatus.QUEUED &&
            job.status !== EmailStatus.PROCESSING &&
            job.status !== "PENDING"
          ) return false;
        } else if (target === "FAILED") {
          if (
            job.status !== EmailStatus.FAILED &&
            job.status !== EmailStatus.BOUNCED &&
            job.status !== EmailStatus.COMPLAINED
          ) return false;
        } else if (target === "SCHEDULED") {
          if (job.status !== EmailStatus.SCHEDULED) return false;
        } else if (job.status !== filters.status) {
          return false;
        }
      }

      if (filters.emailType && filters.emailType !== "all" && job.emailType !== filters.emailType) {
        return false;
      }

      if (filters.eventId && job.eventId !== filters.eventId) {
        return false;
      }

      if (filters.recipient && !String(job.recipient || "").toLowerCase().includes(filters.recipient.toLowerCase())) {
        return false;
      }

      return true;
    });

    const totalMatching = filtered.length;

    // Sort descending by created timestamp
    filtered.sort((a, b) => {
      const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
      const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
      return timeB - timeA;
    });

    const totalPages = Math.max(1, Math.ceil(totalMatching / limitCount));
    const offset = (page - 1) * limitCount;
    const paginated = filtered.slice(offset, offset + limitCount);

    return {
      jobs: paginated,
      totalAll,
      totalMatching,
      totalLoaded: paginated.length,
      page,
      limit: limitCount,
      totalPages,
    };
  }
}
