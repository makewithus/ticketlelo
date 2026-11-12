"use client";

import { useEffect } from "react";

/**
 * Captures ?ref=CODE from URL query parameters across all attendee entry routes
 * and stores it into localStorage and cookie with a 30-day attribution window.
 */
export function ReferralCapturer() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get("ref") || params.get("referralCode");
      if (ref && ref.trim()) {
        const code = ref.trim().toUpperCase();
        localStorage.setItem("ticketlelo_ref_code", code);
        document.cookie = `ticketlelo_ref_code=${encodeURIComponent(code)}; path=/; max-age=2592000; SameSite=Lax`;
      }
    } catch (_) {}
  }, []);

  return null;
}

