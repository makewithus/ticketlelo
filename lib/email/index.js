/**
 * TicketLelo Email Infrastructure - Central Module Export
 *
 * Provides a unified public interface for:
 * - Asynchronous persistent email queueing (`enqueueEmail`)
 * - Domain types, statuses, priorities, and error classes
 * - Quota ledger querying and inspection
 * - All branded templates
 * - Webhook processing
 */

export * from "./types.js";
export * from "./errors.js";
export * from "./config.js";
export * from "./validator.js";
export * from "./logger.js";
export * from "./quota-ledger.js";
export * from "./job-repository.js";
export * from "./suppression.js";
export * from "./resend.js";
export * from "./queue.js";
export * from "./worker.js";
export * from "./webhook-handler.js";
export * from "./templates/index.js";
