"use client";

import React from "react";
import { EventBanner } from "@/components/events/event-banner";

/**
 * EventPoster - Legacy adapter delegating to canonical EventBanner.
 * Guarantees visual consistency across dashboard lists, activity feeds, and modals.
 */
export function EventPoster({ event, className = "" }) {
  return (
    <EventBanner
      event={event}
      aspect="auto"
      className={`shrink-0 overflow-hidden ${className}`}
    />
  );
}

export default EventPoster;
