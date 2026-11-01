/**
 * TicketLelo Email Infrastructure - Atomic Quota Ledger
 *
 * Implements concurrency-safe daily and monthly sending quota tracking
 * with atomic reservation, safety margin protection, and automatic
 * UTC reset window calculation.
 *
 * Prevents race conditions where concurrent workers might double-consume quota.
 */

import { getEmailConfig, getNextDailyQuotaReset, getNextMonthlyQuotaReset } from "./config.js";
import { DailyQuotaExhaustedError, MonthlyQuotaExhaustedError } from "./errors.js";
import { EmailPriority } from "./types.js";
import { adminDb } from "../firebase-admin.js";

// In-memory ledger fallback for local development, tests, or when primary storage is unavailable
const memoryLedger = {
  daily: new Map(),   // key: "YYYY-MM-DD", val: count
  monthly: new Map(), // key: "YYYY-MM", val: count
};

/**
 * Returns the UTC date keys for daily and monthly buckets.
 * @param {Date} [date=new Date()]
 * @returns {{ dailyKey: string, monthlyKey: string }}
 */
export function getUtcBucketKeys(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return {
    dailyKey: `${year}-${month}-${day}`,
    monthlyKey: `${year}-${month}`,
  };
}

export class QuotaLedger {
  /**
   * Resets in-memory ledger (primarily for test suite isolation).
   */
  static resetMemoryLedger() {
    memoryLedger.daily.clear();
    memoryLedger.monthly.clear();
  }

  /**
   * Atomically checks and reserves sending quota for an email job.
   * Throws DailyQuotaExhaustedError or MonthlyQuotaExhaustedError if limit is reached.
   *
   * @param {string} [priority=EmailPriority.P0] - Priority level of the job
   * @param {number} [count=1] - Number of emails to reserve
   * @param {Date} [now=new Date()] - Reference timestamp
   * @returns {Promise<Object>} Usage snapshot after reservation
   */
  static async reserveQuota(priority = EmailPriority.P0, count = 1, now = new Date()) {
    const config = getEmailConfig();
    const { dailyKey, monthlyKey } = getUtcBucketKeys(now);
    const nextDailyReset = getNextDailyQuotaReset(now);
    const nextMonthlyReset = getNextMonthlyQuotaReset(now);

    // If Firestore admin is available, execute inside a concurrency-safe transaction
    if (adminDb && process.env.NODE_ENV !== "test") {
      try {
        const dailyRef = adminDb.collection("emailQuotaLedger").doc(`daily_${dailyKey}`);
        const monthlyRef = adminDb.collection("emailQuotaLedger").doc(`monthly_${monthlyKey}`);

        return await adminDb.runTransaction(async (transaction) => {
          const [dailySnap, monthlySnap] = await Promise.all([
            transaction.get(dailyRef),
            transaction.get(monthlyRef),
          ]);

          const currentDaily = dailySnap.exists ? Number(dailySnap.data().count || 0) : 0;
          const currentMonthly = monthlySnap.exists ? Number(monthlySnap.data().count || 0) : 0;

          // 1. Check Monthly Limit
          if (currentMonthly + count > config.monthlyLimit) {
            throw new MonthlyQuotaExhaustedError(
              `Monthly quota limit reached (${currentMonthly}/${config.monthlyLimit})`,
              nextMonthlyReset,
              { monthlyUsed: currentMonthly, monthlyLimit: config.monthlyLimit }
            );
          }

          // 2. Check Daily Limit
          if (currentDaily + count > config.dailyLimit) {
            throw new DailyQuotaExhaustedError(
              `Daily quota limit reached (${currentDaily}/${config.dailyLimit})`,
              nextDailyReset,
              { dailyUsed: currentDaily, dailyLimit: config.dailyLimit }
            );
          }

          // 3. Safety Margin check for lower priority emails
          const isCritical = priority === EmailPriority.P0 || priority === EmailPriority.P1;
          const remainingDaily = config.dailyLimit - currentDaily;
          if (!isCritical && remainingDaily <= config.safetyMargin) {
            throw new DailyQuotaExhaustedError(
              `Daily quota safety margin active (${remainingDaily} remaining <= ${config.safetyMargin} safety margin reserved for tickets)`,
              nextDailyReset,
              { dailyUsed: currentDaily, dailyLimit: config.dailyLimit, safetyMargin: config.safetyMargin }
            );
          }

          // Atomic increment
          const newDaily = currentDaily + count;
          const newMonthly = currentMonthly + count;

          transaction.set(dailyRef, {
            count: newDaily,
            dateKey: dailyKey,
            updatedAt: now,
            expiresAt: nextDailyReset,
          }, { merge: true });

          transaction.set(monthlyRef, {
            count: newMonthly,
            monthKey: monthlyKey,
            updatedAt: now,
            expiresAt: nextMonthlyReset,
          }, { merge: true });

          return {
            success: true,
            dailyUsed: newDaily,
            dailyLimit: config.dailyLimit,
            dailyRemaining: Math.max(0, config.dailyLimit - newDaily),
            monthlyUsed: newMonthly,
            monthlyLimit: config.monthlyLimit,
            monthlyRemaining: Math.max(0, config.monthlyLimit - newMonthly),
            nextDailyReset,
            nextMonthlyReset,
          };
        });
      } catch (err) {
        if (err instanceof DailyQuotaExhaustedError || err instanceof MonthlyQuotaExhaustedError) {
          throw err;
        }
        // Fall back to memory ledger on unexpected Firestore error
      }
    }

    // In-memory atomic check & reserve
    const currentDaily = memoryLedger.daily.get(dailyKey) || 0;
    const currentMonthly = memoryLedger.monthly.get(monthlyKey) || 0;

    if (currentMonthly + count > config.monthlyLimit) {
      throw new MonthlyQuotaExhaustedError(
        `Monthly quota limit reached (${currentMonthly}/${config.monthlyLimit})`,
        nextMonthlyReset,
        { monthlyUsed: currentMonthly, monthlyLimit: config.monthlyLimit }
      );
    }

    if (currentDaily + count > config.dailyLimit) {
      throw new DailyQuotaExhaustedError(
        `Daily quota limit reached (${currentDaily}/${config.dailyLimit})`,
        nextDailyReset,
        { dailyUsed: currentDaily, dailyLimit: config.dailyLimit }
      );
    }

    const isCritical = priority === EmailPriority.P0 || priority === EmailPriority.P1;
    const remainingDaily = config.dailyLimit - currentDaily;
    if (!isCritical && remainingDaily <= config.safetyMargin) {
      throw new DailyQuotaExhaustedError(
        `Daily quota safety margin active (${remainingDaily} remaining <= ${config.safetyMargin} safety margin reserved for tickets)`,
        nextDailyReset,
        { dailyUsed: currentDaily, dailyLimit: config.dailyLimit, safetyMargin: config.safetyMargin }
      );
    }

    const newDaily = currentDaily + count;
    const newMonthly = currentMonthly + count;
    memoryLedger.daily.set(dailyKey, newDaily);
    memoryLedger.monthly.set(monthlyKey, newMonthly);

    return {
      success: true,
      dailyUsed: newDaily,
      dailyLimit: config.dailyLimit,
      dailyRemaining: Math.max(0, config.dailyLimit - newDaily),
      monthlyUsed: newMonthly,
      monthlyLimit: config.monthlyLimit,
      monthlyRemaining: Math.max(0, config.monthlyLimit - newMonthly),
      nextDailyReset,
      nextMonthlyReset,
    };
  }

  /**
   * Releases previously reserved quota if a job was cancelled or failed before provider dispatch.
   */
  static async releaseQuota(count = 1, now = new Date()) {
    const { dailyKey, monthlyKey } = getUtcBucketKeys(now);

    if (adminDb && process.env.NODE_ENV !== "test") {
      try {
        const dailyRef = adminDb.collection("emailQuotaLedger").doc(`daily_${dailyKey}`);
        const monthlyRef = adminDb.collection("emailQuotaLedger").doc(`monthly_${monthlyKey}`);

        await adminDb.runTransaction(async (transaction) => {
          const [dailySnap, monthlySnap] = await Promise.all([
            transaction.get(dailyRef),
            transaction.get(monthlyRef),
          ]);
          if (dailySnap.exists) {
            const current = Number(dailySnap.data().count || 0);
            transaction.update(dailyRef, { count: Math.max(0, current - count), updatedAt: now });
          }
          if (monthlySnap.exists) {
            const current = Number(monthlySnap.data().count || 0);
            transaction.update(monthlyRef, { count: Math.max(0, current - count), updatedAt: now });
          }
        });
      } catch {
        // Fall back to memory
      }
    }

    const currentDaily = memoryLedger.daily.get(dailyKey) || 0;
    const currentMonthly = memoryLedger.monthly.get(monthlyKey) || 0;
    memoryLedger.daily.set(dailyKey, Math.max(0, currentDaily - count));
    memoryLedger.monthly.set(monthlyKey, Math.max(0, currentMonthly - count));
  }

  /**
   * Reads current quota usage stats without incrementing.
   */
  static async getQuotaUsage(now = new Date()) {
    const config = getEmailConfig();
    const { dailyKey, monthlyKey } = getUtcBucketKeys(now);
    const nextDailyReset = getNextDailyQuotaReset(now);
    const nextMonthlyReset = getNextMonthlyQuotaReset(now);

    let dailyUsed = memoryLedger.daily.get(dailyKey) || 0;
    let monthlyUsed = memoryLedger.monthly.get(monthlyKey) || 0;

    if (adminDb && process.env.NODE_ENV !== "test") {
      try {
        const [dailySnap, monthlySnap] = await Promise.all([
          adminDb.collection("emailQuotaLedger").doc(`daily_${dailyKey}`).get(),
          adminDb.collection("emailQuotaLedger").doc(`monthly_${monthlyKey}`).get(),
        ]);
        if (dailySnap.exists) dailyUsed = Number(dailySnap.data().count || 0);
        if (monthlySnap.exists) monthlyUsed = Number(monthlySnap.data().count || 0);
      } catch {
        // Use memory values
      }
    }

    return {
      dailyUsed,
      dailyLimit: config.dailyLimit,
      dailyRemaining: Math.max(0, config.dailyLimit - dailyUsed),
      monthlyUsed,
      monthlyLimit: config.monthlyLimit,
      monthlyRemaining: Math.max(0, config.monthlyLimit - monthlyUsed),
      safetyMargin: config.safetyMargin,
      nextDailyReset,
      nextMonthlyReset,
      timezone: config.timezone,
    };
  }
}
