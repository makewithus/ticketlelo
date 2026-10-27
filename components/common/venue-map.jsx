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
    <div className={`rounded-2xl bg-[#0B132B] border border-slate-800 p-6 text-slate-100 shadow-xl ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-blue-950/60 border border-blue-800/40 text-blue-400">
              <MapPin className="w-4 h-4" />
            </span>
            <h3 className="text-lg font-bold text-white tracking-tight">{venueName}</h3>
          </div>
          {subVenue && (
            <p className="text-xs text-amber-400 font-medium pl-8">
              Location: {subVenue}
            </p>
          )}
        </div>

        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors shrink-0 shadow-md shadow-blue-900/30"
        >
          <Navigation className="w-3.5 h-3.5" />
          Get Directions
          <ExternalLink className="w-3 h-3 opacity-70" />
        </a>
      </div>

      {/* Address & Coordinates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-4 text-xs text-slate-300">
        <div>
          <span className="text-slate-500 block mb-0.5">Full Postal Address:</span>
          <p className="font-medium text-slate-200">{fullAddress || "Address provided upon registration confirmation"}</p>
        </div>
        <div>
          <span className="text-slate-500 block mb-0.5">Geographic Coordinates:</span>
          <p className="font-mono text-slate-400 flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-blue-400" />
            {latitude && longitude ? `${latitude.toFixed(6)}, ${longitude.toFixed(6)}` : "Coordinates verified on campus guide"}
          </p>
        </div>
      </div>

      {/* Responsive Map Embed / Fallback Preview */}
      <div className="mt-2 rounded-xl overflow-hidden border border-slate-800/90 aspect-video md:aspect-[21/9] bg-slate-900/90 relative">
        <iframe
          title={`Map location for ${venueName}`}
          width="100%"
          height="100%"
          style={{ border: 0 }}
          loading="lazy"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
          src={embedUrl}
          className="w-full h-full filter saturate-[0.85] contrast-[1.1]"
        />
      </div>
    </div>
  );
}

export default VenueMap;
