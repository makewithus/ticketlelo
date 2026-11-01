"use client";

import { useState, useEffect } from "react";
import QRCode from "qrcode";
import {
  Download,
  Award,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseFirestoreDate, formatTicketMeta } from "@/lib/date-utils";
import {
  resolveTicketTheme,
  parseTicketTitle as parseTicketTitleUniversal,
} from "@/lib/ticket-theme";

export { parseTicketTitleUniversal as parseTicketTitle, formatTicketMeta };

export function detectTicketTheme(eventName = "", category = "") {
  return "orange";
}

/**
 * Master StubTicket component matching the exact physical ticket aesthetic:
 * - 4 distinct visual themes (Tech Orange, Gaming Purple, Open Mic Red, Robotics Teal)
 * - Fully responsive on all viewports (Mobile, Tablet, Desktop)
 * - Die-cut semicircular notches at the perforation boundary on all screen sizes
 * - Vertical dashed perforation line
 * - Interactive tear-off animation with check-in stamp and sound feedback
 * - Dynamic Attendee Name, JetBrains Mono Ticket ID, and high-contrast QR Code
 * - Action buttons for download, calendar, tax invoice, and wallets
 */
export function StubTicket({
  registration = {},
  event = {},
  theme: explicitTheme,
  interactive = true,
  showActions = true,
  onDownload,
  onAddToCalendar,
  onInvoice,
  onCertificate,
  onAppleWallet,
  onGoogleWallet,
  className = "",
}) {
  const [isTorn, setIsTorn] = useState(
    registration.status === "Used" || registration.status === "used"
  );
  const [qrDataUrl, setQrDataUrl] = useState(() => {
    const raw = registration.qrCode;
    if (
      raw &&
      typeof raw === "string" &&
      !raw.includes("<svg") &&
      !raw.includes("TICKETLELO") &&
      (raw.startsWith("data:image/") || raw.startsWith("http"))
    ) {
      return raw;
    }
    return "";
  });

  // Determine full theme configuration based on organiser selections
  const themeConfig = resolveTicketTheme(event, explicitTheme);

  // Parse title & year using organiser settings (posterLine1 / posterLine2) or event name
  const titleInfo = parseTicketTitleUniversal(
    event.name || event.title || registration.eventName || registration.eventTitle || "TICKET PASS",
    event
  );

  // Format metadata
  const meta = formatTicketMeta({
    date: event.date || event.startDate || registration.eventDate,
    time: event.time || registration.time || registration.eventTime,
    venue: event.location || event.venue || registration.venue || registration.location || "MAIN AUDITORIUM",
    tier: registration.ticketTier || registration.tierName || registration.ticketType || "GENERAL",
    price:
      registration.amount !== undefined
        ? registration.amount
        : event.price !== undefined
        ? event.price
        : 199,
  });

  const ticketId =
    registration.ticketId || registration.id || "TKT-1793-AB12C";
  const attendeeName =
    registration.attendeeName ||
    registration.name ||
    registration.fullName ||
    registration.buyerName ||
    "Attendee";

  // Generate QR code if not provided or if invalid dummy
  useEffect(() => {
    let isMounted = true;
    const isRealQr =
      registration.qrCode &&
      typeof registration.qrCode === "string" &&
      !registration.qrCode.includes("<svg") &&
      !registration.qrCode.includes("TICKETLELO") &&
      (registration.qrCode.startsWith("data:image/") || registration.qrCode.startsWith("http"));

    if (isRealQr) {
      if (registration.qrCode !== qrDataUrl) {
        const timer = setTimeout(() => {
          if (isMounted) setQrDataUrl(registration.qrCode);
        }, 0);
        return () => clearTimeout(timer);
      }
      return;
    }

    const payload =
      registration.qrPayload ||
      registration.ticketId ||
      ticketId ||
      "TICKETLELO-PASS";
    QRCode.toDataURL(payload, {
      margin: 1,
      width: 220,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    })
      .then((url) => {
        if (isMounted) setQrDataUrl(url);
      })
      .catch((err) => {
        console.warn("Failed to generate QR code data URL:", err);
      });
    return () => {
      isMounted = false;
    };
  }, [registration.qrCode, registration.qrPayload, registration.ticketId, ticketId]);

  // Audio effect for tearing ticket
  const playTearSound = () => {
    try {
      if (typeof window === "undefined") return;
      const AudioContext =
        window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const bufferSize = Math.floor(ctx.sampleRate * 0.12);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        const decay = Math.exp(-i / (bufferSize * 0.25));
        data[i] = (Math.random() * 2 - 1) * decay;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 1900;
      filter.Q.value = 1.4;
      noise.connect(filter);
      filter.connect(ctx.destination);
      noise.start();
      if (navigator.vibrate) {
        navigator.vibrate(18);
      }
    } catch {
      // Audio autoplay policy or not supported, ignore silently
    }
  };

  const handleStubClick = () => {
    if (!interactive) return;
    playTearSound();
    setIsTorn((prev) => !prev);
  };



  return (
    <div className={`w-full max-w-4xl mx-auto overflow-visible ${className}`}>
      {/* ── Main Ticket Container (Responsive Horizontal Stub Ticket) ── */}
      <div
        data-ticket="true"
        className="stub-ticket-root relative group transition-all duration-300"
      >
        <div className="flex flex-row items-stretch select-none">
          {/* ══════════════════════════════════════════════════
              LEFT SECTION: MAIN TICKET BODY (~70% Width)
              ══════════════════════════════════════════════════ */}
          <div
            style={themeConfig.bodyBgStyle}
            className="relative flex-1 min-w-0 rounded-l-xl sm:rounded-l-2xl overflow-hidden flex flex-col justify-between min-h-[140px] xs:min-h-[165px] sm:min-h-[200px] md:min-h-[220px] shadow-lg transition-transform duration-300"
          >
            {/* Top Graphics & Title Area */}
            <div className="relative p-3 xs:p-4 sm:p-7 flex-1 flex flex-col justify-center overflow-hidden">
              {/* Main Typography Header (Matching Card 1 of reference: bold, clean, solid) */}
              <div className="relative z-10 max-w-[85%] sm:max-w-[80%] my-auto">
                <h2
                  className={`text-base xs:text-xl sm:text-3xl md:text-[38px] font-black uppercase tracking-tight leading-none ${themeConfig.titleColor}`}
                >
                  {titleInfo.line1}
                </h2>

                {/* Subtitle / Second Line in matching bold solid color */}
                {titleInfo.line2 && (
                  <div className="mt-1 sm:mt-1.5">
                    <span
                      className={`text-base xs:text-xl sm:text-3xl md:text-[38px] font-black uppercase tracking-tight leading-none block ${themeConfig.titleColor}`}
                    >
                      {titleInfo.line2}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Dark Information Strip (Responsive horizontal layout) */}
            <div
              style={themeConfig.bottomBarStyle}
              className="relative z-10 px-2.5 sm:px-6 py-1.5 sm:py-2.5 flex items-center overflow-hidden border-t border-black/10"
            >
              <div className="font-mono text-[8px] xs:text-[9.5px] sm:text-xs md:text-[11px] font-bold tracking-tight sm:tracking-wider text-[#D0D0D1] uppercase whitespace-nowrap overflow-x-auto scrollbar-none w-full flex items-center gap-1 sm:gap-2">
                <span>{meta.dateStr}</span>
                <span className="text-[#9B9EA4]">•</span>
                <span>{meta.timeStr}</span>
                <span className="text-[#9B9EA4]">•</span>
                <span className="truncate max-w-[120px] sm:max-w-none">{meta.venueStr}</span>
                <span className="text-[#9B9EA4]">•</span>
                <span>{meta.tierStr}</span>
                {meta.priceStr && (
                  <>
                    <span className="text-[#9B9EA4]">•</span>
                    <span className="text-[#FDE003] font-bold">
                      {meta.priceStr}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════
              RIGHT SECTION: STUB (~30% Width on Mobile, ~28% on Desktop)
              Interactive Tear-Off Mechanism
              ══════════════════════════════════════════════════ */}
          <div
            onClick={handleStubClick}
            title={
              interactive
                ? isTorn
                  ? "Click to re-attach stub"
                  : "Click to tear off stub at check-in"
                : undefined
            }
            style={{
              ...themeConfig.stubBgStyle,
              transformOrigin: "top left",
            }}
            className={`relative w-[105px] xs:w-[125px] sm:w-[190px] md:w-[220px] shrink-0 rounded-r-xl sm:rounded-r-2xl p-2 xs:p-2.5 sm:p-5 flex flex-col items-center justify-between transition-all duration-300 ${
              interactive ? "cursor-pointer group/stub" : ""
            } ${
              isTorn
                ? "translate-x-2 sm:translate-x-4 translate-y-0.5 sm:translate-y-2 rotate-2 sm:rotate-3 shadow-2xl opacity-95 ring-1 ring-white/10"
                : "hover:brightness-105"
            }`}
          >
            {/* Top Cutout Notch (Circles matching background canvas on ALL screen sizes and themes) */}
            <div className="ticket-notch absolute -top-2 sm:-top-3 -left-2 sm:-left-3 w-4 h-4 sm:w-6 sm:h-6 rounded-full bg-[#131517] [html.light_&]:bg-[#F7F5EE] print:bg-white z-20 pointer-events-none" />

            {/* Bottom Cutout Notch */}
            <div className="ticket-notch absolute -bottom-2 sm:-bottom-3 -left-2 sm:-left-3 w-4 h-4 sm:w-6 sm:h-6 rounded-full bg-[#131517] [html.light_&]:bg-[#F7F5EE] print:bg-white z-20 pointer-events-none" />

            {/* Vertical Perforation Line / Torn Edge */}
            <div
              className={`absolute top-2 sm:top-3 bottom-2 sm:bottom-3 -left-[1px] border-l sm:border-l-2 border-dashed ${
                isTorn ? "border-[#FE760B]/60" : themeConfig.perforationBorder
              } z-10`}
            />

            {/* Stub Header: "SCAN AT ENTRY" */}
            <div className="w-full text-center mb-1 sm:mb-2">
              <span
                className={`text-[8px] xs:text-[9.5px] sm:text-xs font-black tracking-widest uppercase block ${themeConfig.scanColor}`}
              >
                SCAN AT ENTRY
              </span>
            </div>

            {/* QR Code Container with High-Contrast White Background */}
            <div className="relative p-1 sm:p-2 bg-white rounded-lg sm:rounded-xl shadow-md flex items-center justify-center my-0.5 sm:my-1">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`QR Code for ${ticketId}`}
                  className="w-14 h-14 xs:w-18 xs:h-18 sm:w-24 sm:h-24 md:w-28 md:h-28 object-contain"
                />
              ) : (
                <div className="w-14 h-14 xs:w-18 xs:h-18 sm:w-24 sm:h-24 md:w-28 md:h-28 bg-white flex items-center justify-center">
                  <div className="w-4 h-4 sm:w-6 sm:h-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {/* Verified "CHECKED IN / ADMITTED" Stamp overlay when stub is torn off */}
              {isTorn && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="transform -rotate-12 border sm:border-2 border-[#EF4444] bg-[#EF4444]/95 text-white font-mono font-black text-[7px] xs:text-[8.5px] sm:text-xs px-1 xs:px-1.5 sm:px-2 py-0.5 rounded shadow-lg uppercase tracking-wider backdrop-blur-sm animate-scale-in">
                    CHECKED IN
                  </div>
                </div>
              )}
            </div>

            {/* Ticket Code in JetBrains Mono */}
            <div className="w-full text-center mt-1 sm:mt-2 space-y-0.5">
              <p
                className={`font-mono font-bold text-[8px] xs:text-[10px] sm:text-[13px] tracking-tight sm:tracking-wide truncate ${themeConfig.ticketIdColor}`}
              >
                {ticketId}
              </p>
              <p className="text-[8px] xs:text-[9.5px] sm:text-xs text-[#D0D0D1] font-medium truncate max-w-[95px] xs:max-w-[115px] sm:max-w-[170px] mx-auto">
                {attendeeName}
              </p>
            </div>

            {/* Tear Hint Pill */}
            {interactive && (
              <div className="hidden sm:block mt-2 text-[10px] text-[#9B9EA4] opacity-0 group-hover/stub:opacity-100 transition-opacity text-center">
                {isTorn ? "Click to re-attach" : "Click to tear off"}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          OPTIONAL ACTIONS DRAWER & CONTROLS
          ══════════════════════════════════════════════════ */}
      {showActions && (
        <div className="ticket-actions-bar mt-2.5 sm:mt-3 bg-[#1A1C1F] border border-[#2A2D31] rounded-xl p-2.5 sm:p-3 flex flex-wrap items-center justify-between gap-2 shadow-sm">
          {/* Status Indicator: Dot + Word */}
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#212327] border border-[#2A2D31] text-[#061A3F] dark:text-[#D0D0D1]">
              <span
                className={`w-2 h-2 rounded-full ${
                  isTorn ? "bg-[#3DD68C]" : "bg-[#FE760B]"
                }`}
              />
              {isTorn ? "Stub Torn • Checked In" : registration.status || "Valid Pass"}
            </span>

            {/* Reset button if torn */}
            {isTorn && (
              <button
                onClick={() => setIsTorn(false)}
                className="text-xs text-[#061A3F] dark:text-[#9B9EA4] hover:text-[#FE760B] flex items-center gap-1 transition-colors ml-1 font-medium cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" /> Reattach
              </button>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {onDownload && (
              <Button
                onClick={onDownload}
                size="sm"
                className="h-7 sm:h-8 px-2.5 sm:px-3 text-xs font-semibold bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] rounded-lg transition-colors gap-1 sm:gap-1.5 cursor-pointer shadow-sm"
              >
                <Download className="w-3.5 h-3.5" /> PDF
              </Button>
            )}

            {isTorn && onCertificate && (
              <Button
                onClick={onCertificate}
                size="sm"
                className="h-7 sm:h-8 px-2.5 sm:px-3 text-xs font-semibold bg-[#3DD68C] hover:bg-[#34D399] text-[#131517] rounded-lg gap-1 sm:gap-1.5 cursor-pointer"
              >
                <Award className="w-3.5 h-3.5 text-[#131517]" /> Certificate
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default StubTicket;
