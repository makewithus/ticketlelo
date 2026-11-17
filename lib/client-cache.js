"use client";

/**
 * Client-side In-Memory + SessionStorage Cache
 *
 * Provides synchronous instant data retrieval (0ms) on page mount and tab navigation,
 * paired with background network revalidation (Stale-While-Revalidate).
 *
 * If data was previously fetched, it is returned synchronously from memory / sessionStorage
 * so the page renders INSTANTLY with zero blank screen or loader delay.
 * If data is not yet in cache, pages display a tailored skeleton loading state.
 */

const memoryCache = new Map();

export function getCachedItem(key) {
  if (!key) return null;

  // 1. In-memory map (instant, no JSON parse)
  if (memoryCache.has(key)) {
    const entry = memoryCache.get(key);
    if (!entry.expiry || entry.expiry > Date.now()) {
      return entry.data;
    }
    memoryCache.delete(key);
  }

  // 2. SessionStorage (persists across route changes and same-tab refreshes)
  if (typeof window !== "undefined") {
    try {
      const raw = sessionStorage.getItem(`tl_cache_${key}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (!parsed.expiry || parsed.expiry > Date.now()) {
          memoryCache.set(key, parsed);
          return parsed.data;
        }
        sessionStorage.removeItem(`tl_cache_${key}`);
      }
    } catch (_) {}
  }

  return null;
}

export function setCachedItem(key, data, ttlMs = 15 * 60 * 1000) {
  if (!key || data === undefined) return;
  const entry = {
    data,
    expiry: ttlMs ? Date.now() + ttlMs : 0,
    timestamp: Date.now(),
  };
  memoryCache.set(key, entry);

  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem(`tl_cache_${key}`, JSON.stringify(entry));
    } catch (_) {}
  }
}

export function removeCachedItem(key) {
  if (!key) return;
  memoryCache.delete(key);
  if (typeof window !== "undefined") {
    try {
      sessionStorage.removeItem(`tl_cache_${key}`);
    } catch (_) {}
  }
}

// ── Specific Domain Helpers ──

export function getCachedOrganiserEvents(userId) {
  if (!userId) return null;
  const items = getCachedItem(`organiser_events_${userId}`);
  if (!Array.isArray(items)) return null;
  return items.filter(
    (ev) => ev && !ev.isDeleted && !ev.deleted && ev.status !== "deleted"
  );
}

export function setCachedOrganiserEvents(userId, events) {
  if (!userId || !events) return;
  const clean = Array.isArray(events)
    ? events.filter((ev) => ev && !ev.isDeleted && !ev.deleted && ev.status !== "deleted")
    : events;
  setCachedItem(`organiser_events_${userId}`, clean, 20 * 60 * 1000);
}

function sanitizeCachedEvent(ev) {
  if (!ev || typeof ev !== "object") return ev;
  if (ev.theme === "purple" || ev.theme === "gaming") {
    ev.theme = "minimal";
  }
  if (ev.pageBg === "#432E01") {
    ev.pageBg = "#131517";
  }
  return ev;
}

export function getCachedEvent(eventId) {
  if (!eventId) return null;
  // Also check legacy storage keys for maximum backwards compatibility
  const cached = getCachedItem(`event_${eventId}`);
  if (cached) return sanitizeCachedEvent(cached);
  if (typeof window !== "undefined") {
    try {
      const legacy = localStorage.getItem(`admin_cached_event_${eventId}`);
      if (legacy) {
        const parsed = JSON.parse(legacy);
        if (parsed) {
          const sanitized = sanitizeCachedEvent(parsed);
          setCachedItem(`event_${eventId}`, sanitized);
          return sanitized;
        }
      }
    } catch (_) {}
  }
  return null;
}

export function setCachedEvent(eventId, event) {
  if (!eventId || !event) return;
  setCachedItem(`event_${eventId}`, event, 20 * 60 * 1000);
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(`admin_cached_event_${eventId}`, JSON.stringify(event));
    } catch (_) {}
  }
  if (event.slug && event.slug !== eventId) {
    setCachedItem(`event_${event.slug}`, event, 20 * 60 * 1000);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(`admin_cached_event_${event.slug}`, JSON.stringify(event));
      } catch (_) {}
    }
  }
  if (event.id && event.id !== eventId) {
    setCachedItem(`event_${event.id}`, event, 20 * 60 * 1000);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(`admin_cached_event_${event.id}`, JSON.stringify(event));
      } catch (_) {}
    }
  }
}

export function getCachedRegistrations(eventId) {
  if (!eventId) return null;
  return getCachedItem(`registrations_${eventId}`);
}

export function setCachedRegistrations(eventId, registrations) {
  if (!eventId || !registrations) return;
  setCachedItem(`registrations_${eventId}`, registrations, 5 * 60 * 1000);
}

export function getCachedPrograms(userId) {
  if (!userId) return null;
  const items = getCachedItem(`organizer_programs_${userId}`);
  return Array.isArray(items) ? items : null;
}

export function setCachedPrograms(userId, programs) {
  if (!userId || !programs) return;
  setCachedItem(`organizer_programs_${userId}`, programs, 15 * 60 * 1000);
}

export function getCachedProgram(programId) {
  if (!programId) return null;
  return getCachedItem(`program_${programId}`);
}

export function setCachedProgram(programId, program) {
  if (!programId || !program) return;
  setCachedItem(`program_${programId}`, program, 15 * 60 * 1000);
}

export function getCachedOrganizerPayments(organizerId, eventId) {
  const key = `org_payments_${organizerId || "all"}_${eventId || "all"}`;
  return getCachedItem(key);
}

export function setCachedOrganizerPayments(organizerId, eventId, data) {
  if (!data) return;
  const key = `org_payments_${organizerId || "all"}_${eventId || "all"}`;
  setCachedItem(key, data, 10 * 60 * 1000);
}

