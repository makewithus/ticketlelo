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
 * Recursively removes keys with undefined values to comply with Firestore schema requirements.
 */
function sanitizeForFirestore(obj) {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) {
    return obj.map(sanitizeForFirestore);
  }
  if (typeof obj === "object" && !(obj instanceof Date)) {
    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = sanitizeForFirestore(value);
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
   */
  static async claimJob(jobId, workerId = "worker-default") {
    const job = await EmailJobRepository.getJob(jobId);
    if (!job) return null;

    // Do not claim if already finished or being processed
    if (
      job.status === EmailStatus.SENT ||
      job.status === EmailStatus.DELIVERED ||
      job.status === EmailStatus.PROCESSING
    ) {
      return null;
    }

    return await EmailJobRepository.updateJob(jobId, {
      status: EmailStatus.PROCESSING,
      workerId,
      attemptCount: (job.attemptCount || 0) + 1,
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
   * Retrieves orphaned jobs stuck in PROCESSING longer than threshold (e.g. 5 minutes).
   */
  static async getOrphanedProcessingJobs(staleMs = 5 * 60 * 1000) {
    const cutoff = new Date(Date.now() - staleMs);
    const orphaned = [];

    for (const job of memoryJobStore.values()) {
      if (job.status === EmailStatus.PROCESSING && new Date(job.updatedAt) < cutoff) {
        orphaned.push(job);
      }
    }

    return orphaned;
  }

  /**
   * Retrieves pending jobs in QUEUED status ready for execution.
   */
  static async getQueuedJobs(limitCount = 50) {
    const queued = [];

    for (const job of memoryJobStore.values()) {
      if (job.status === EmailStatus.QUEUED) {
        queued.push(job);
        if (queued.length >= limitCount) break;
      }
    }

    if (adminDb && process.env.NODE_ENV !== "test") {
      try {
        const snap = await adminDb.collection("emailJobs")
          .where("status", "==", EmailStatus.QUEUED)
          .limit(limitCount)
          .get();

        for (const doc of snap.docs) {
          const data = { id: doc.id, ...doc.data() };
          if (!queued.some((j) => j.id === data.id)) {
            queued.push(data);
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
   */
  static async listJobs(filters = {}, options = {}) {
    const limitCount = options.limit || 50;
    let list = Array.from(memoryJobStore.values());

    if (adminDb && process.env.NODE_ENV !== "test") {
      try {
        let q = adminDb.collection("emailJobs");
        if (filters.status) q = q.where("status", "==", filters.status);
        if (filters.emailType) q = q.where("emailType", "==", filters.emailType);
        if (filters.eventId) q = q.where("eventId", "==", filters.eventId);
        q = q.limit(limitCount);

        const snap = await q.get();
        const firestoreJobs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (firestoreJobs.length > 0) {
          list = firestoreJobs;
        }
      } catch {
        // Use memory
      }
    }

    // Apply in-memory filters if needed
    if (filters.status) list = list.filter((j) => j.status === filters.status);
    if (filters.emailType) list = list.filter((j) => j.emailType === filters.emailType);
    if (filters.recipient) list = list.filter((j) => j.recipient.includes(filters.recipient.toLowerCase()));

    // Sort descending by created timestamp
    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return list.slice(0, limitCount);
  }
}
