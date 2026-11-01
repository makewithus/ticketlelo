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

export function formatTicketDate(val, fallback = "Thu, 29 Oct 2026") {
  if (!val) return fallback;
  if (typeof val === "string" && val.trim()) return val.trim();
  const d = parseFirestoreDate(val);
  if (d) {
    try {
      return d.toLocaleDateString("en-IN", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export function formatTicketMeta({ date, time, venue, tier, price }) {
  let dateStr = "DATE TBA";
  let timeStr = time || "12:00 PM";

  if (date) {
    try {
      const d = parseFirestoreDate(date);

      if (d && !isNaN(d.getTime())) {
        const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
        const months = [
          "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
          "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
        ];
        const dayName = days[d.getDay()];
        const dayNum = String(d.getDate()).padStart(2, "0");
        const monthName = months[d.getMonth()];
        const year = d.getFullYear();
        dateStr = `${dayName} ${dayNum} ${monthName} ${year}`;

        if (!time) {
          const hours = d.getHours();
          const mins = String(d.getMinutes()).padStart(2, "0");
          const ampm = hours >= 12 ? "PM" : "AM";
          timeStr = `${hours % 12 || 12}:${mins} ${ampm}`;
        }
      }
    } catch {
      dateStr = "DATE TBA";
    }
  }

  const venueStr = (venue || "VENUE TBA").toUpperCase();
  const tierStr = (tier || "GENERAL").toUpperCase();

  let priceStr = "FREE ENTRY";
  if (price !== undefined && price !== null) {
    if (typeof price === "number") {
      priceStr = price === 0 ? "FREE ENTRY" : `₹${price}`;
    } else if (typeof price === "string") {
      const pClean = price.replace(/[^\d.]/g, "");
      const pNum = parseFloat(pClean);
      if (price.toLowerCase().includes("free") || pNum === 0) {
        priceStr = "FREE ENTRY";
      } else if (!isNaN(pNum)) {
        priceStr = `₹${pNum}`;
      } else {
        priceStr = price.toUpperCase();
      }
    }
  }

  return {
    dateStr,
    timeStr,
    venueStr,
    tierStr,
    priceStr,
    fullStrip: `${dateStr} • ${timeStr} • ${venueStr} • ${tierStr} • ${priceStr}`,
  };
}
