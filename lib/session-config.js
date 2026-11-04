/**
 * Session Configuration & Inactivity Utilities
 *
 * Enforces:
 * 1. 10 minutes (600,000 ms) of idle inactivity before warning popup.
 * 2. 5 seconds countdown warning before automatic system logout.
 * 3. Cross-tab synchronization via localStorage key.
 */

// Inactivity threshold: strictly 10 minutes
export const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000; // 600,000 ms

// Warning countdown before auto-logout: strictly 5 seconds
export const COUNTDOWN_TOTAL_SECONDS = 5;

// Storage key used for cross-tab activity synchronization
export const SESSION_STORAGE_KEY = "ticketlelo_last_active";

/**
 * Checks if a session has exceeded the inactivity threshold.
 * @param {number} lastActiveTime - Timestamp in ms of last recorded activity
 * @param {number} [now=Date.now()] - Current timestamp in ms
 * @param {number} [timeoutMs=INACTIVITY_TIMEOUT_MS] - Timeout duration in ms
 * @returns {boolean} True if inactivity threshold is met or exceeded
 */
export function shouldTriggerInactivityWarning(
  lastActiveTime,
  now = Date.now(),
  timeoutMs = INACTIVITY_TIMEOUT_MS
) {
  if (!lastActiveTime || typeof lastActiveTime !== "number") return false;
  return now - lastActiveTime >= timeoutMs;
}

/**
 * Calculates remaining seconds in the warning countdown.
 * @param {number} warningStartTime - Timestamp in ms when warning modal was displayed
 * @param {number} [totalCountdown=COUNTDOWN_TOTAL_SECONDS] - Total countdown seconds
 * @param {number} [now=Date.now()] - Current timestamp in ms
 * @returns {number} Seconds remaining (0 to totalCountdown)
 */
export function calculateRemainingCountdown(
  warningStartTime,
  totalCountdown = COUNTDOWN_TOTAL_SECONDS,
  now = Date.now()
) {
  if (!warningStartTime) return totalCountdown;
  const elapsedSeconds = Math.floor((now - warningStartTime) / 1000);
  return Math.max(0, totalCountdown - elapsedSeconds);
}
