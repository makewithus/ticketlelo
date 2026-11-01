/**
 * TicketLelo Email Infrastructure - Suppression List
 *
 * Automatically suppresses recipients who have hard-bounced or filed spam
 * complaints. Sending to suppressed addresses damages domain reputation and
 * is blocked at the validation stage.
 */

import { adminDb } from "../firebase-admin.js";

const memorySuppression = new Map();

export class EmailSuppression {
  /**
   * Clears in-memory suppression list (for testing).
   */
  static resetMemorySuppression() {
    memorySuppression.clear();
  }

  /**
   * Checks whether an email address is actively suppressed.
   *
   * @param {string} email
   * @returns {Promise<boolean>}
   */
  static async isSuppressed(email) {
    if (!email) return false;
    const normalized = String(email).trim().toLowerCase();

    if (memorySuppression.has(normalized)) {
      return true;
    }

    if (adminDb && process.env.NODE_ENV !== "test") {
      try {
        const snap = await adminDb.collection("emailSuppression").doc(normalized).get();
        if (snap.exists) {
          memorySuppression.set(normalized, snap.data());
          return true;
        }
      } catch {
        // Fall back to memory
      }
    }

    return false;
  }

  /**
   * Adds an email address to the suppression list.
   *
   * @param {string} email
   * @param {string} [reason="bounced"] - "bounced" | "complained" | "manual"
   * @param {Object} [details={}]
   */
  static async suppress(email, reason = "bounced", details = {}) {
    if (!email) return;
    const normalized = String(email).trim().toLowerCase();
    const record = {
      email: normalized,
      reason,
      details,
      createdAt: new Date(),
    };

    memorySuppression.set(normalized, record);

    if (adminDb && process.env.NODE_ENV !== "test") {
      try {
        await adminDb.collection("emailSuppression").doc(normalized).set(record);
      } catch {
        // Logged or handled
      }
    }
  }

  /**
   * Removes an email address from the suppression list (admin override).
   *
   * @param {string} email
   */
  static async unsuppress(email) {
    if (!email) return;
    const normalized = String(email).trim().toLowerCase();
    memorySuppression.delete(normalized);

    if (adminDb && process.env.NODE_ENV !== "test") {
      try {
        await adminDb.collection("emailSuppression").doc(normalized).delete();
      } catch {
        // Handled
      }
    }
  }
}
