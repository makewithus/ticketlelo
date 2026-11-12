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
    if (!isNaN(d.getTime())) return d;

    // Check DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
    const ddmmyyyy = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
    if (ddmmyyyy) {
      const day = parseInt(ddmmyyyy[1], 10);
      const month = parseInt(ddmmyyyy[2], 10) - 1;
      const year = parseInt(ddmmyyyy[3], 10);
      const d2 = new Date(year, month, day);
      if (!isNaN(d2.getTime())) return d2;
    }
    return null;
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

/**
 * Parse standard human time string like "11:30 pm", "9:00 AM", "14:30", "11:30"
 */
export function parseTimeString(timeStr) {
  if (!timeStr || typeof timeStr !== "string") return null;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})(?:\s*([aApP][mM]))?$/);
  if (!match) return null;
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const ampm = match[3]?.toUpperCase();
  if (ampm === "PM" && h < 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  return { hours: h, minutes: m };
}

/**
 * Extracts normalized Date objects for { start, end } of an event
 */
export function getEventDateRange(ev) {
  if (!ev) return { start: null, end: null };

  let start = null;
  let end = null;

  // 1. Calculate Start Date/Time
  if (ev.startDate) {
    const t = parseTimeString(ev.startTime);
    const d = new Date(ev.startDate);
    if (!isNaN(d.getTime())) {
      if (t) {
        d.setHours(t.hours, t.minutes, 0, 0);
      } else {
        d.setHours(0, 0, 0, 0);
      }
      start = d;
    }
  }

  if (!start && (ev.date || ev.eventDate)) {
    const d = parseFirestoreDate(ev.date || ev.eventDate);
    if (d && !isNaN(d.getTime())) {
      start = d;
    }
  }

  // 2. Calculate End Date/Time
  if (ev.endDate) {
    const t = parseTimeString(ev.endTime);
    const d = new Date(ev.endDate);
    if (!isNaN(d.getTime())) {
      if (t) {
        d.setHours(t.hours, t.minutes, 0, 0);
      } else {
        d.setHours(23, 59, 59, 999);
      }
      end = d;
    }
  } else if (ev.endTime && start && ev.startDate) {
    const t = parseTimeString(ev.endTime);
    if (t) {
      const d = new Date(ev.startDate);
      d.setHours(t.hours, t.minutes, 0, 0);
      if (d < start) d.setDate(d.getDate() + 1); // Spans past midnight
      end = d;
    }
  }

  // 3. Fallback end time if not explicitly provided
  if (start && !end) {
    if (ev.startTime) {
      // Default event duration: 4 hours from start
      end = new Date(start.getTime() + 4 * 60 * 60 * 1000);
    } else {
      // If only whole date was given, event runs until end of that calendar day
      end = new Date(start.getTime());
      end.setHours(23, 59, 59, 999);
    }
  }

  return { start, end };
}

/**
 * Determines exact live status of an event according to its date and time.
 * Returns: { status: 'live' | 'upcoming' | 'ended', isLive, isUpcoming, isEnded, label }
 */
export function getEventLiveStatus(ev, now = new Date()) {
  const { start, end } = getEventDateRange(ev);
  if (!start) {
    return {
      status: "upcoming",
      isLive: false,
      isUpcoming: true,
      isEnded: false,
      label: "Upcoming",
      start: null,
      end: null,
    };
  }

  const nowMs = now.getTime();
  const startMs = start.getTime();
  const endMs = end ? end.getTime() : startMs + 4 * 60 * 60 * 1000;

  if (nowMs >= startMs && nowMs <= endMs) {
    return {
      status: "live",
      isLive: true,
      isUpcoming: false,
      isEnded: false,
      label: "LIVE",
      start,
      end,
    };
  }

  if (nowMs < startMs) {
    return {
      status: "upcoming",
      isLive: false,
      isUpcoming: true,
      isEnded: false,
      label: "Upcoming",
      start,
      end,
    };
  }

  return {
    status: "ended",
    isLive: false,
    isUpcoming: false,
    isEnded: true,
    label: "Ended",
    start,
    end,
  };
}
