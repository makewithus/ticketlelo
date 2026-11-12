/**
 * TicketLelo Rate Limiting & Abuse Prevention Engine
 *
 * Implements sliding-window in-memory rate limiting with optional Firestore
 * distributed tracking to protect sensitive authentication, registration,
 * and email dispatch endpoints from brute force and denial of service.
 */

// In-memory sliding window cache: key -> Array of timestamps (ms)
const memoryStore = new Map();

// Periodic cleanup of expired entries every 5 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let cleanupTimer = null;

function ensureCleanupTimer() {
  if (cleanupTimer || typeof setInterval === "undefined") return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of memoryStore.entries()) {
      const valid = timestamps.filter((t) => now - t < 3600000); // 1 hr max window
      if (valid.length === 0) {
        memoryStore.delete(key);
      } else {
        memoryStore.set(key, valid);
      }
    }
  }, CLEANUP_INTERVAL_MS);
  if (cleanupTimer.unref) cleanupTimer.unref();
}

/**
 * Extracts client IP safely from request headers
 *
 * @param {Request} request
 * @returns {string} Client IP or fallback
 */
export function getClientIp(request) {
  if (!request || !request.headers) return "127.0.0.1";
  
  // Standard proxy headers
  const xForwardedFor = request.headers.get("x-forwarded-for");
  if (xForwardedFor) {
    // Leftmost address is the original client IP
    const parts = xForwardedFor.split(",");
    const clientIp = parts[0].trim();
    if (clientIp) return clientIp;
  }

  const xRealIp = request.headers.get("x-real-ip");
  if (xRealIp) return xRealIp.trim();

  const cfConnectingIp = request.headers.get("cf-connecting-ip");
  if (cfConnectingIp) return cfConnectingIp.trim();

  return "127.0.0.1";
}

/**
 * Checks and records an access event against the rate limit window.
 *
 * @param {Object} options
 * @param {string} options.key - Unique identifier (e.g. `reg:${ip}`, `setup:${email}`)
 * @param {number} options.limit - Maximum allowed requests within the window
 * @param {number} options.windowMs - Sliding window duration in milliseconds
 * @returns {{ allowed: boolean, count: number, remaining: number, resetMs: number }}
 */
export function checkRateLimit({ key, limit = 10, windowMs = 60000 }) {
  ensureCleanupTimer();

  const now = Date.now();
  const windowStart = now - windowMs;

  const timestamps = memoryStore.get(key) || [];
  // Retain only timestamps within the current sliding window
  const activeTimestamps = timestamps.filter((t) => t > windowStart);

  if (activeTimestamps.length >= limit) {
    const oldest = activeTimestamps[0];
    const resetMs = Math.max(0, oldest + windowMs - now);
    return {
      allowed: false,
      count: activeTimestamps.length,
      remaining: 0,
      resetMs,
      retryAfterSeconds: Math.ceil(resetMs / 1000) || 1,
    };
  }

  activeTimestamps.push(now);
  memoryStore.set(key, activeTimestamps);

  return {
    allowed: true,
    count: activeTimestamps.length,
    remaining: Math.max(0, limit - activeTimestamps.length),
    resetMs: windowMs,
    retryAfterSeconds: 0,
  };
}

/**
 * Helper to reset rate limits for a specific key (useful in tests)
 */
export function resetRateLimit(key) {
  if (key) {
    memoryStore.delete(key);
  } else {
    memoryStore.clear();
  }
}
