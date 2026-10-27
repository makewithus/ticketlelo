/**
 * Safe Date & Firestore Timestamp Normalization Utilities
 * Prevents "Objects are not valid as a React child ({seconds, nanoseconds})" errors.
 */

export function parseFirestoreDate(val) {
  if (!val) return null;

  // Firestore Timestamp instance
  if (typeof val?.toDate === "function") {
    try {
      const d = val.toDate();
      return isNaN(d.getTime()) ? null : d;
    } catch {
      return null;
    }
  }

  // Plain serialized Firestore Timestamp object { seconds, nanoseconds } or { _seconds, _nanoseconds }
  if (typeof val === "object" && val !== null) {
    const sec = val.seconds ?? val._seconds;
    if (typeof sec === "number") {
      const nano = val.nanoseconds ?? val._nanoseconds ?? 0;
      const d = new Date(sec * 1000 + nano / 1000000);
      return isNaN(d.getTime()) ? null : d;
    }
  }

  // JavaScript Date instance
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }

  // Number (epoch timestamp ms or seconds)
  if (typeof val === "number") {
    // If it's in seconds (10 digits), convert to ms
    const ms = val < 10000000000 ? val * 1000 : val;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }

  // ISO string or date string
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed) return null;
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
}

export function formatEventDate(val, fallback = "Date Announced Soon") {
  if (!val) return fallback;

  const d = parseFirestoreDate(val);
  if (d) {
    try {
      return d.toLocaleDateString("en-IN", {
        weekday: "long",
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return fallback;
    }
  }

  // If val was already a non-object human readable string like "15th Feb 2027" or "Tomorrow"
  if (typeof val === "string" && val.trim()) {
    return val.trim();
  }

  return fallback;
}

export function formatShortDate(val, fallback = "") {
  if (!val) return fallback;

  const d = parseFirestoreDate(val);
  if (d) {
    try {
      return d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return fallback;
    }
  }

  if (typeof val === "string" && val.trim()) {
    return val.trim();
  }

  return fallback;
}

export function formatDateTime(val, fallback = "") {
  if (!val) return fallback;

  const d = parseFirestoreDate(val);
  if (d) {
    try {
      return d.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return fallback;
    }
  }

  if (typeof val === "string" && val.trim()) {
    return val.trim();
  }

  return fallback;
}

export function getEventYear(val, fallback = "2027") {
  if (!val) return fallback;
  const d = parseFirestoreDate(val);
  if (d) {
    return d.getFullYear().toString();
  }
  return fallback;
}
