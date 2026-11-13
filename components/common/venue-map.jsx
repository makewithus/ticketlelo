"use client";

import React, { useState } from "react";
import { MapPin, Navigation, ExternalLink, Eye, Copy, Check, Video, Globe, ShieldCheck } from "lucide-react";
import {
  parseVenueDisplay,
  isVirtualLocation,
  getVirtualMeetingUrl,
  getVirtualPlatformName,
} from "@/lib/venues-catalog";
import { getReadableAccentColor, getReadableButtonTextColor } from "@/lib/theme-utils";

export { parseVenueDisplay, isVirtualLocation, getVirtualMeetingUrl, getVirtualPlatformName };

/**
 * VenueMap Component
 * 
 * Displays broad venue name and a link to view/expand full address without repetitive address clutters.
 * For online/virtual events, renders a dedicated Online Access card with direct join & copy actions.
 * For in-person events, includes interactive Google Maps directions link and embedded map preview.
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
  themeColor = "#FE760B",
  isOnline = false,
  virtualLink = "",
  event = null,
}) {
  const [showFullAddress, setShowFullAddress] = useState(false);
  const [copied, setCopied] = useState(false);

  const readableAccent = getReadableAccentColor(themeColor, true);
  const buttonTextColor = getReadableButtonTextColor(themeColor);

  // Check if event or venue represents an online / virtual event (meet.google.com, zoom.us, etc.)
  const isVirtualEvent = Boolean(
    isOnline ||
    isVirtualLocation(event) ||
    isVirtualLocation(virtualLink) ||
    isVirtualLocation(address) ||
    isVirtualLocation(venueName) ||
    (typeof address === "string" && /\b(meet\.google\.com|zoom\.us)\b/i.test(address)) ||
    (typeof venueName === "string" && /\b(meet\.google\.com|zoom\.us)\b/i.test(venueName))
  );

  const meetingUrl = getVirtualMeetingUrl(virtualLink || event || address || venueName);
  const platformName = getVirtualPlatformName(meetingUrl || event || venueName || address);

  const handleCopyMeetingLink = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard && meetingUrl) {
      navigator.clipboard.writeText(meetingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // If virtual / online, render dedicated virtual access panel without Google Maps iframe
  if (isVirtualEvent) {
    return (
      <div className={`rounded-2xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] p-5 sm:p-6 text-slate-900 dark:text-white shadow-xl ${className}`}>
        {/* Header with platform name and direct join CTA */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-[#2A2D31]">
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex items-center gap-2.5">
              <span className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-500 dark:text-[#7AA2FF] shrink-0">
                <Video className="w-4 h-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight truncate">
                    {platformName}
                  </h3>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-300 border border-blue-500/25">
                    Online Event
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-[#9B9EA4] truncate">
                  Interactive video session & live stream
                </p>
              </div>
            </div>
            {subVenue && (
              <p className="text-xs text-amber-600 dark:text-amber-400 font-medium pl-10">
                Track: {subVenue}
              </p>
            )}
          </div>

          {meetingUrl && (
            <a
              href={meetingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold hover:brightness-110 active:scale-[0.98] transition-all shrink-0 shadow-sm cursor-pointer"
              style={{ backgroundColor: themeColor, color: buttonTextColor }}
            >
              <Video className="w-3.5 h-3.5" />
              Join Meeting
              <ExternalLink className="w-3 h-3 opacity-80" />
            </a>
          )}
        </div>

        {/* Virtual Link Container */}
        <div className="py-4 border-b border-slate-200 dark:border-[#2A2D31] text-xs space-y-2.5">
          <span className="text-slate-500 dark:text-[#9B9EA4] block text-[11px] font-medium uppercase tracking-wider">
            Meeting Access URL
          </span>
          {meetingUrl ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-[#131517] border border-slate-200 dark:border-[#2A2D31]">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Globe className="w-4 h-4 text-slate-400 dark:text-white/40 shrink-0" />
                <span className="font-mono text-xs text-slate-800 dark:text-slate-200 truncate select-all">
                  {meetingUrl}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleCopyMeetingLink}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-200/70 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-emerald-500 font-semibold">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>
                <a
                  href={meetingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-white/15 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-semibold transition-colors"
                >
                  <span>Open</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
              The organizer will share the live stream/meeting link prior to event start time. Registered attendees will also receive direct link credentials in their digital pass confirmation.
            </p>
          )}
        </div>

        {/* Online Guidelines & Admission Tips */}
        <div className="pt-3.5 flex items-start gap-2.5 text-xs text-slate-500 dark:text-[#9B9EA4]">
          <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
          <div className="space-y-1 text-[11px] leading-relaxed">
            <p className="font-semibold text-slate-700 dark:text-slate-200">
              Online Event Guidelines:
            </p>
            <ul className="list-disc pl-4 space-y-0.5 text-slate-600 dark:text-slate-400">
              <li>Join directly through any supported web browser or mobile client app.</li>
              <li>Keep your registered email handy for entry check-in if required by the host.</li>
              <li>Meeting credentials and calendar reminders are securely linked to your ticket.</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  const { broadVenue, broadLocality, fullAddress } = parseVenueDisplay({
    venueName,
    address,
    city,
  });

  const isDefaultDelhi = (latitude === 28.6139 && longitude === 77.209) || (latitude === 28.6139 && longitude === 77.2090);
  const hasRealCoords = latitude && longitude && !isDefaultDelhi;

  const queryParam = hasRealCoords
    ? `${latitude},${longitude}`
    : encodeURIComponent(fullAddress || broadVenue || venueName || "India");

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${queryParam}`;

  // Safe Google Maps Embed URL - standard universal embed displays true location without API key restrictions
  const embedUrl = `https://maps.google.com/maps?q=${queryParam}&t=&z=15&ie=UTF8&iwloc=&output=embed`;

  const handleCopy = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(fullAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const hasDistinctFullAddress = Boolean(
    fullAddress &&
    fullAddress.toLowerCase().trim() !== broadVenue.toLowerCase().trim()
  );

  return (
    <div className={`rounded-2xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] p-5 sm:p-6 text-slate-900 dark:text-white shadow-xl space-y-4 ${className}`}>
      {/* Header with broad venue name and directions button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 sm:gap-4 pb-4 border-b border-slate-200 dark:border-[#2A2D31]">
        <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
          <div
            className="p-2.5 rounded-xl shrink-0"
            style={{
              backgroundColor: `${themeColor}20`,
              borderColor: `${themeColor}40`,
              borderWidth: "1px",
              color: readableAccent,
            }}
          >
            <MapPin className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight break-words">
                {broadVenue}
              </h3>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 shrink-0">
                In-Person Venue
              </span>
            </div>
            {broadLocality && (
              <p className="text-xs text-slate-500 dark:text-[#9B9EA4] mt-0.5 truncate">
                {broadLocality}
              </p>
            )}
          </div>
        </div>

        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold hover:brightness-110 active:scale-[0.98] transition-all shrink-0 shadow-sm cursor-pointer"
          style={{ backgroundColor: themeColor, color: buttonTextColor }}
        >
          <Navigation className="w-3.5 h-3.5" />
          <span>Get Directions</span>
          <ExternalLink className="w-3 h-3 opacity-80" />
        </a>
      </div>

      {/* Structured Address Container matching TicketLelo Design System */}
      <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50 dark:bg-[#131517] border border-slate-200 dark:border-[#2A2D31] space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#9B9EA4] block">
              Venue Location:
            </span>
            <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 leading-relaxed break-words">
              {broadVenue}{broadLocality ? `, ${broadLocality}` : ""}
            </p>
            {subVenue && (
              <div className="pt-1">
                <span className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  Hall / Room: {subVenue}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0 pt-0.5">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-200/70 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
              title="Copy address to clipboard"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-emerald-500 font-semibold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>

            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-white/15 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-semibold transition-colors"
            >
              <span>Google Maps</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {hasDistinctFullAddress && (
          <div className="pt-2 border-t border-slate-200 dark:border-[#2A2D31]/80 flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowFullAddress(!showFullAddress)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold hover:opacity-85 transition-opacity cursor-pointer underline underline-offset-2"
              style={{ color: readableAccent }}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{showFullAddress ? "Hide full address" : "See full address"}</span>
            </button>
            <span className="text-slate-300 dark:text-[#2A2D31]">•</span>
            <span className="text-xs text-slate-500 dark:text-[#9B9EA4]">
              {showFullAddress ? "Detailed postal address expanded below" : "Click to view full postal street address"}
            </span>
          </div>
        )}

        {/* Expandable Full Postal Address */}
        {showFullAddress && hasDistinctFullAddress && (
          <div className="mt-2.5 p-3 rounded-lg bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#9B9EA4] block">
              Complete Postal Address:
            </span>
            <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-medium break-words">
              {fullAddress}
            </p>
          </div>
        )}
      </div>

      {/* Responsive Map Embed Container */}
      <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-[#2A2D31] aspect-video md:aspect-[21/9] bg-slate-100 dark:bg-slate-900/90 relative">
        <iframe
          title={`Map location for ${broadVenue}`}
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
