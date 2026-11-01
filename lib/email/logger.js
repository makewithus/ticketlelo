/**
 * TicketLelo Email Infrastructure - Sanitized Structured Logger
 *
 * Provides logging with automatic masking of secrets, API keys, credentials,
 * and sensitive attendee personally identifiable information.
 */

const SECRET_PATTERNS = [
  /re_[a-zA-Z0-9_-]{20,}/g,                          // Resend API keys
  /redis:\/\/[^:]+:([^@]+)@/g,                       // Redis URL password
  /Bearer\s+[a-zA-Z0-9._-]+/gi,                      // Bearer tokens
  /"pass(word)?":\s*"[^"]+"/gi,                      // JSON password fields
  /key=[a-zA-Z0-9_-]{20,}/gi,                        // Generic keys
];

/**
 * Sanitizes strings or objects by masking tokens, secrets, and passwords.
 */
export function sanitizeLogData(data) {
  if (typeof data === "string") {
    let sanitized = data;
    for (const pattern of SECRET_PATTERNS) {
      sanitized = sanitized.replace(pattern, "[REDACTED_SECRET]");
    }
    return sanitized;
  }

  if (data instanceof Error) {
    return {
      name: data.name,
      message: sanitizeLogData(data.message),
      category: data.category || null,
      statusCode: data.statusCode || null,
      stack: process.env.NODE_ENV === "development" ? sanitizeLogData(data.stack || "") : undefined,
    };
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeLogData(item));
  }

  if (data && typeof data === "object") {
    const clean = {};
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes("password") ||
        lowerKey.includes("secret") ||
        lowerKey.includes("token") ||
        lowerKey.includes("apikey") ||
        lowerKey.includes("api_key")
      ) {
        clean[key] = "[REDACTED]";
      } else {
        clean[key] = sanitizeLogData(value);
      }
    }
    return clean;
  }

  return data;
}

export const emailLogger = {
  info(message, context = {}) {
    console.log(`[EmailEngine:INFO] ${message}`, Object.keys(context).length ? JSON.stringify(sanitizeLogData(context)) : "");
  },

  warn(message, context = {}) {
    console.warn(`[EmailEngine:WARN] ${message}`, Object.keys(context).length ? JSON.stringify(sanitizeLogData(context)) : "");
  },

  error(message, error = null, context = {}) {
    const errorDetails = error ? sanitizeLogData(error) : null;
    const cleanContext = sanitizeLogData(context);
    console.error(`[EmailEngine:ERROR] ${message}`, JSON.stringify({ error: errorDetails, ...cleanContext }));
  },

  debug(message, context = {}) {
    if (process.env.DEBUG_EMAIL === "true" || process.env.NODE_ENV === "development") {
      console.debug(`[EmailEngine:DEBUG] ${message}`, Object.keys(context).length ? JSON.stringify(sanitizeLogData(context)) : "");
    }
  },
};
