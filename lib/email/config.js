/**
 * TicketLelo Email Infrastructure - Configuration & Quota Parameters
 *
 * Centralized, validated environment configuration for Resend provider,
 * BullMQ queue, Redis connection, and quota tracking.
 */

/**
 * Calculates the exact next UTC midnight (00:00:00.000 UTC) when Resend's daily quota resets.
 * Resend documentation specifies daily quota resets at 00:00 UTC.
 *
 * @param {Date} [fromTime=new Date()]
 * @returns {Date}
 */
export function getNextDailyQuotaReset(fromTime = new Date()) {
  const date = new Date(fromTime);
  const nextUtcDay = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() + 1,
    0, 0, 0, 0
  );
  return new Date(nextUtcDay);
}

/**
 * Calculates the exact next month start (00:00:00.000 UTC on the 1st of next month).
 *
 * @param {Date} [fromTime=new Date()]
 * @returns {Date}
 */
export function getNextMonthlyQuotaReset(fromTime = new Date()) {
  const date = new Date(fromTime);
  const nextMonth = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    1,
    0, 0, 0, 0
  );
  return new Date(nextMonth);
}

function sanitizeEnvString(val) {
  if (!val || typeof val !== "string") return "";
  let clean = val.trim();
  if ((clean.startsWith('"') && clean.endsWith('"')) || (clean.startsWith("'") && clean.endsWith("'"))) {
    clean = clean.slice(1, -1).trim();
  }
  return clean;
}

/**
 * Retrieves and validates the active email configuration.
 */
export function getEmailConfig() {
  const apiKey = sanitizeEnvString(process.env.RESEND_API_KEY);
  const rawFrom = sanitizeEnvString(process.env.EMAIL_FROM);
  const rawReplyTo = sanitizeEnvString(process.env.EMAIL_REPLY_TO);

  // Fallback sender identity adheres to verified domain ticketlelo.in
  const defaultFrom = "TicketLelo <noreply@ticketlelo.in>";

  const from = rawFrom || defaultFrom;
  const replyTo = rawReplyTo || "TicketLelo Support <support@ticketlelo.in>";

  // Quota limits with safe numeric parsing
  const dailyLimit = Number.parseInt(process.env.EMAIL_DAILY_LIMIT || "100", 10);
  const monthlyLimit = Number.parseInt(process.env.EMAIL_MONTHLY_LIMIT || "3000", 10);
  const safetyMargin = Number.parseInt(process.env.EMAIL_SAFETY_MARGIN || "5", 10);

  // Timezone defaults to UTC (Resend authoritative reset timezone)
  const timezone = (process.env.EMAIL_QUEUE_TIMEZONE || "UTC").trim().toUpperCase();

  const isQueueEnabled = process.env.EMAIL_QUEUE_ENABLED !== "false";
  const redisUrl = (process.env.REDIS_URL || "").trim();
  const webhookSecret = (process.env.RESEND_WEBHOOK_SECRET || "").trim();

  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://ticketlelo.in")
  ).replace(/\/+$/, "");

  return {
    apiKey,
    hasApiKey: Boolean(apiKey),
    from,
    replyTo,
    dailyLimit: Number.isSafeInteger(dailyLimit) && dailyLimit > 0 ? dailyLimit : 100,
    monthlyLimit: Number.isSafeInteger(monthlyLimit) && monthlyLimit > 0 ? monthlyLimit : 3000,
    safetyMargin: Number.isSafeInteger(safetyMargin) && safetyMargin >= 0 ? safetyMargin : 5,
    timezone,
    isQueueEnabled,
    redisUrl,
    hasRedis: Boolean(redisUrl),
    webhookSecret,
    appUrl,
    isMockEnabled: process.env.RESEND_MOCK === "true" || process.env.NODE_ENV === "test",
  };
}
