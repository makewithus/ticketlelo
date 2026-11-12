const PRODUCTION_URL = "https://ticketlelo.in";

/**
 * Check if a hostname represents a local development environment
 */
export function isLocalhost(hostname = "") {
  if (!hostname || typeof hostname !== "string") return false;
  const h = hostname.toLowerCase().split(":")[0];
  return (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "0.0.0.0" ||
    h.endsWith(".local")
  );
}

/**
 * Extract clean display host (e.g. "ticketlelo.in" or "ticketlelo.vercel.app")
 * without protocol or trailing slash.
 */
export function getCleanDomain(urlStr = "") {
  try {
    const parsed = new URL(urlStr);
    return parsed.host;
  } catch (_) {
    return String(urlStr || "")
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "");
  }
}

/**
 * Get dynamic, consistent public base URL for sharing events.
 * NEVER returns localhost.
 * - When in browser on a deployed URL (e.g. *.vercel.app or ticketlelo.in): returns current origin dynamically.
 * - When on localhost or SSR: returns production domain (ticketlelo.in or Vercel production URL).
 */
export function getPublicBaseUrl() {
  // 1. Client-side browser inspection:
  // If running on a live deployed domain (e.g. ticketlelo.in or vercel.app), return that origin.
  // When running on localhost, return canonical PRODUCTION_URL (https://ticketlelo.in)
  // so public shareable links, poster links, QR codes, and embeds always carry the production URL.
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (!isLocalhost(hostname)) {
      return window.location.origin;
    }
  }

  // 2. Server-side or client on localhost: inspect environment variables for deployed domains
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  if (appUrl && !appUrl.includes("localhost") && !appUrl.includes("127.0.0.1")) {
    return appUrl.replace(/\/+$/, "");
  }

  // Vercel project production or preview deployment domain
  const vercelProd =
    process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercelProd) {
    return `https://${vercelProd}`.replace(/\/+$/, "");
  }

  const vercelUrl =
    process.env.NEXT_PUBLIC_VERCEL_URL || process.env.VERCEL_URL;
  if (vercelUrl && !vercelUrl.includes("localhost")) {
    return `https://${vercelUrl}`.replace(/\/+$/, "");
  }

  return PRODUCTION_URL;
}

/**
 * Get the full public shareable URL for an event.
 * Guaranteed to be consistent and NEVER return localhost.
 * @param {string} slugOrId - Event slug or ID
 * @param {"register" | "event"} pathType - "register" (/register/slug) or "event" (/e/slug)
 */
export function getPublicEventUrl(slugOrId = "event", pathType = "register") {
  const base = getPublicBaseUrl();
  const path = pathType === "event" ? "e" : "register";
  return `${base}/${path}/${slugOrId}`;
}

/**
 * Get the clean display string for the event link (e.g. "ticketlelo.in/register/tech-fest-2026")
 * without the "https://" prefix, perfectly matching the base domain.
 * @param {string} slugOrId - Event slug or ID
 * @param {"register" | "event"} pathType - "register" or "event"
 */
export function getPublicEventDisplayUrl(slugOrId = "event", pathType = "register") {
  const full = getPublicEventUrl(slugOrId, pathType);
  return full.replace(/^https?:\/\//, "");
}

/**
 * Base URL for internal routing and webhook processing
 */
export function getAppBaseUrl() {
  if (process.env.VERCEL_ENV === "preview") {
    return process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : PRODUCTION_URL;
  }

  if (process.env.NODE_ENV === "production") return PRODUCTION_URL;

  // On client, if not localhost use window.location.origin
  if (typeof window !== "undefined" && !isLocalhost(window.location.hostname)) {
    return window.location.origin;
  }

  return PRODUCTION_URL;
}
