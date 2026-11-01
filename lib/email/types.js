/**
 * TicketLelo Email Infrastructure - Domain Types & Constants
 *
 * Defines priorities, job statuses, email types, error classifications,
 * and data structures for the production-grade email subsystem.
 */

/**
 * Priority levels for email scheduling.
 * Lower numerical value = higher priority.
 */
export const EmailPriority = Object.freeze({
  P0: "P0", // Critical: Tickets, QR passes, password reset, payment confirmation, refunds
  P1: "P1", // Important: Organizer approval/rejection, event cancellations
  P2: "P2", // Normal: Event reminders (24h/2h), hosting request confirmation
  P3: "P3", // Promotional: Organizer announcements, marketing broadcasts
});

/**
 * Numerical weight used by queue schedulers (BullMQ / internal priority queue).
 * BullMQ opts: lower integer = higher priority.
 */
export const PriorityWeights = Object.freeze({
  [EmailPriority.P0]: 1,
  [EmailPriority.P1]: 2,
  [EmailPriority.P2]: 3,
  [EmailPriority.P3]: 4,
});

/**
 * Lifecycle statuses of an email job.
 */
export const EmailStatus = Object.freeze({
  PENDING: "PENDING",       // Job created, awaiting queueing
  QUEUED: "QUEUED",         // Job enqueued in BullMQ or persistent store
  PROCESSING: "PROCESSING", // Currently being handled by a worker
  SCHEDULED: "SCHEDULED",   // Deferred to a future quota window (daily/monthly limit)
  SENT: "SENT",             // Accepted and dispatched by provider (Resend)
  DELIVERED: "DELIVERED",   // Webhook confirmed delivery to recipient mailbox
  BOUNCED: "BOUNCED",       // Webhook reported hard/soft bounce
  COMPLAINED: "COMPLAINED", // Webhook reported recipient marked as spam
  FAILED: "FAILED",         // Permanently failed or exhausted retry budget (DLQ)
  CANCELLED: "CANCELLED",   // Cancelled before dispatch
});

/**
 * Canonical email types across TicketLelo.
 */
export const EmailType = Object.freeze({
  TICKET_DELIVERY: "ticket_delivery",
  HOSTING_APPROVAL: "hosting_approval",
  HOSTING_REJECTION: "hosting_rejection",
  HOSTING_RECEIVED: "hosting_received",
  PASSWORD_RESET: "password_reset",
  EVENT_REMINDER: "event_reminder",
  ANNOUNCEMENT: "announcement",
  TRANSACTIONAL: "transactional",
});

/**
 * Error classifications for intelligent retry decisions.
 */
export const ErrorCategory = Object.freeze({
  RATE_LIMIT: "RATE_LIMIT",                               // HTTP 429 - Retryable with backoff
  DAILY_QUOTA_EXHAUSTED: "DAILY_QUOTA_EXHAUSTED",         // Provider daily quota hit - Defer to UTC midnight
  MONTHLY_QUOTA_EXHAUSTED: "MONTHLY_QUOTA_EXHAUSTED",     // Provider monthly quota hit - Defer to month reset
  TEMPORARY_PROVIDER_ERROR: "TEMPORARY_PROVIDER_ERROR",   // HTTP 5xx, socket timeout - Retryable
  INVALID_RECIPIENT: "INVALID_RECIPIENT",                 // Malformed email, non-existent domain - Fatal (DLQ)
  PERMANENT_REJECTION: "PERMANENT_REJECTION",             // Domain authentication failure, blocked - Fatal
  AUTHENTICATION_ERROR: "AUTHENTICATION_ERROR",           // Invalid Resend API key - Configuration error
  SUPPRESSED_RECIPIENT: "SUPPRESSED_RECIPIENT",           // Recipient is on suppression list (bounced/complained)
});
