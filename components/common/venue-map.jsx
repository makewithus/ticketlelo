"use client";

import React from "react";
import { MapPin, Navigation, ExternalLink, Compass } from "lucide-react";

/**
 * VenueMap Component
 * 
 * Displays responsive venue details, coordinates, embedded map, and Google Maps directions link.
 * Falls back cleanly when coordinates or Google Maps API key are missing.
 */
export function VenueMap({
  venueName = "Main Campus Venue",
  address = "",
  city = "",
  latitude = null,
  longitude = null,
  subVenue = null,
  apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
  className = "",
}) {
  const fullAddress = [address, city].filter(Boolean).join(", ");
  const queryParam = latitude && longitude
    ? `${latitude},${longitude}`
    : encodeURIComponent(fullAddress || venueName);

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${queryParam}`;

  // Safe Google Maps Embed URL
  const embedUrl = apiKey
    ? `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${queryParam}`
    : `https://maps.google.com/maps?q=${queryParam}&t=&z=15&ie=UTF8&iwloc=&output=embed`;

  return (
    <div className={`rounded-2xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] p-6 text-slate-900 dark:text-white shadow-xl ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-[#2A2D31]">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-[#3DD68C]">
              <MapPin className="w-4 h-4" />
            </span>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">{venueName}</h3>
          </div>
          {subVenue && (
            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium pl-8">
              Location: {subVenue}
            </p>
          )}
        </div>

        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-[#FE760B] hover:bg-[#FF8A2B] text-white transition-colors shrink-0 shadow-sm"
        >
          <Navigation className="w-3.5 h-3.5" />
          Get Directions
          <ExternalLink className="w-3 h-3 opacity-80" />
        </a>
      </div>

      {/* Address & Coordinates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-4 text-xs">
        <div>
          <span className="text-slate-500 dark:text-[#9B9EA4] block mb-0.5">Full Postal Address:</span>
          <p className="font-medium text-slate-800 dark:text-slate-200">{fullAddress || "Address provided upon registration confirmation"}</p>
        </div>
        <div>
          <span className="text-slate-500 dark:text-[#9B9EA4] block mb-0.5">Geographic Coordinates:</span>
          <p className="font-mono text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-emerald-600 dark:text-[#3DD68C]" />
            {latitude && longitude ? `${latitude.toFixed(6)}, ${longitude.toFixed(6)}` : "Coordinates verified on campus guide"}
          </p>
        </div>
      </div>

      {/* Responsive Map Embed / Fallback Preview */}
      <div className="mt-2 rounded-xl overflow-hidden border border-slate-200 dark:border-[#2A2D31] aspect-video md:aspect-[21/9] bg-slate-100 dark:bg-slate-900/90 relative">
        <iframe
          title={`Map location for ${venueName}`}
          width="100%"
          height="100%"
          style={{ border: 0 }}
          loading="lazy"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
          src={embedUrl}
          className="w-full h-full filter saturate-[0.85] contrast-[1.05]"
        />
      </div>
    </div>
  );
}

export default VenueMap;
