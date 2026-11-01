/**
 * TicketLelo Email Infrastructure - Typed Errors
 *
 * Provides specialized error classes allowing workers, queue consumers,
 * and monitoring systems to classify errors, decide retryability, and
 * schedule deferral windows accurately.
 */

import { ErrorCategory } from "./types.js";

export class EmailError extends Error {
  /**
   * @param {string} message - Human-readable error description
   * @param {string} category - Value from ErrorCategory
   * @param {boolean} isRetryable - Whether the job should be retried
   * @param {number|null} [statusCode=null] - HTTP status code if applicable
   * @param {Object} [details={}] - Contextual debug metadata
   */
  constructor(message, category, isRetryable, statusCode = null, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.category = category;
    this.isRetryable = isRetryable;
    this.statusCode = statusCode;
    this.details = details;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Thrown when Resend returns HTTP 429 Too Many Requests.
 */
export class RateLimitError extends EmailError {
  constructor(message = "Resend rate limit exceeded (HTTP 429)", retryAfterMs = 2000, details = {}) {
    super(message, ErrorCategory.RATE_LIMIT, true, 429, { ...details, retryAfterMs });
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * Thrown when internal quota ledger or Resend indicates daily sending limit is reached.
 */
export class DailyQuotaExhaustedError extends EmailError {
  constructor(message = "Daily email sending quota exhausted", nextResetAt = null, details = {}) {
    super(message, ErrorCategory.DAILY_QUOTA_EXHAUSTED, true, 429, { ...details, nextResetAt });
    this.nextResetAt = nextResetAt;
  }
}

/**
 * Thrown when internal quota ledger indicates monthly limit is reached.
 */
export class MonthlyQuotaExhaustedError extends EmailError {
  constructor(message = "Monthly email sending quota exhausted", nextResetAt = null, details = {}) {
    super(message, ErrorCategory.MONTHLY_QUOTA_EXHAUSTED, true, 429, { ...details, nextResetAt });
    this.nextResetAt = nextResetAt;
  }
}

/**
 * Thrown on temporary network, socket, or HTTP 5xx provider errors.
 */
export class TemporaryProviderError extends EmailError {
  constructor(message = "Temporary provider failure or network timeout", statusCode = 503, details = {}) {
    super(message, ErrorCategory.TEMPORARY_PROVIDER_ERROR, true, statusCode, details);
  }
}

/**
 * Thrown on malformed email address or bad recipient format.
 */
export class InvalidRecipientError extends EmailError {
  constructor(message = "Invalid or unroutable recipient address", details = {}) {
    super(message, ErrorCategory.INVALID_RECIPIENT, false, 422, details);
  }
}

/**
 * Thrown when attempting to send to an address on the bounce or complaint suppression list.
 */
export class SuppressedRecipientError extends EmailError {
  constructor(email, reason = "bounced", details = {}) {
    super(`Recipient ${email} is suppressed due to previous ${reason}`, ErrorCategory.SUPPRESSED_RECIPIENT, false, 400, { email, reason, ...details });
    this.email = email;
    this.reason = reason;
  }
}

/**
 * Thrown on permanent rejection (e.g. unverified sending domain, blocked content).
 */
export class PermanentRejectionError extends EmailError {
  constructor(message = "Permanent provider rejection", statusCode = 422, details = {}) {
    super(message, ErrorCategory.PERMANENT_REJECTION, false, statusCode, details);
  }
}

/**
 * Thrown when Resend API key is missing or unauthorized.
 */
export class AuthenticationError extends EmailError {
  constructor(message = "Invalid or missing Resend API credentials", statusCode = 401, details = {}) {
    super(message, ErrorCategory.AUTHENTICATION_ERROR, false, statusCode, details);
  }
}
