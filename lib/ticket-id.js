/**
 * Ticket ID Formatting and Generation Utility
 * TicketLelo Platform
 *
 * Enforces canonical XXXX-XXXX format (e.g., "7ABA-D722")
 * making ticket IDs clean, human-readable, and easy to manually type at entry gates.
 */

/**
 * Formats any raw ticket ID into clean XXXX-XXXX format (e.g., "7ABA-D722").
 * Safely handles legacy long hash IDs (e.g., "TKT-7ABAD7225DCADFF877469BC3B5FA" -> "7ABA-D722")
 * as well as existing short IDs.
 *
 * @param {string} ticketId - Raw ticket ID from database or user input
 * @returns {string} Formatted ticket ID in XXXX-XXXX format
 */
export function formatTicketId(ticketId) {
  if (!ticketId || typeof ticketId !== "string") return "PASS-0001";
  const trimmed = ticketId.trim().toUpperCase();

  // 1. If already strictly in XXXX-XXXX format
  if (/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(trimmed)) {
    return trimmed;
  }

  // 2. Strip common prefixes: TKT-, TICKET-, PASS-
  const cleaned = trimmed
    .replace(/^(TKT|TICKET|PASS)[-_]/i, "")
    .replace(/[^A-Z0-9]/g, "");

  // 3. If cleaned string has 8 or more alphanumeric characters
  if (cleaned.length >= 8) {
    return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 8)}`;
  }

  // 4. If between 4 and 7 characters, pad cleanly
  if (cleaned.length >= 4) {
    return `${cleaned.slice(0, 4)}-${cleaned.slice(4).padEnd(4, "0")}`;
  }

  return trimmed || "PASS-0001";
}

/**
 * Generates a fresh unique ticket ID in XXXX-XXXX format.
 *
 * @param {string} [seed] - Optional seed string for deterministic generation
 * @returns {string} Unique ticket ID in XXXX-XXXX format
 */
export function generateTicketId(seed) {
  if (seed && typeof seed === "string") {
    const hex = seed.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    if (hex.length >= 8) {
      return `${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
    }
  }

  // Unambiguous character set (no 0/O, 1/I confusion)
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let p1 = "";
  let p2 = "";
  for (let i = 0; i < 4; i++) {
    p1 += chars.charAt(Math.floor(Math.random() * chars.length));
    p2 += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${p1}-${p2}`;
}

/**
 * Normalizes any ticket ID input for search/matching (e.g. "TKT-7ABA-D722" -> "7ABAD722").
 *
 * @param {string} input - Raw input ticket ID or code
 * @returns {string} Normalized uppercase alphanumeric string
 */
export function cleanTicketId(input) {
  if (!input || typeof input !== "string") return "";
  return input
    .trim()
    .toUpperCase()
    .replace(/^(TKT|TICKET|PASS)[-_]/i, "")
    .replace(/[^A-Z0-9]/g, "");
}

