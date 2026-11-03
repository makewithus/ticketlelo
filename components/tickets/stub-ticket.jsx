"use client";

import { useState, useEffect } from "react";
import QRCode from "qrcode";
import {
  Download,
  Award,
  RotateCcw,
  Scissors,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { parseFirestoreDate, formatTicketMeta } from "@/lib/date-utils";
import {
  resolveTicketTheme,
  parseTicketTitle as parseTicketTitleUniversal,
} from "@/lib/ticket-theme";
import { QrCheckinModal } from "./qr-checkin-modal";

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
  onCheckIn,
  onDownload,
  onAddToCalendar,
  onInvoice,
  onCertificate,
  onAppleWallet,
  onGoogleWallet,
  className = "",
}) {
  const isPending =
    registration.status === "pending" ||
    registration.approvalStatus === "pending";

  const isCheckedInInitially =
    registration.status === "Used" ||
    registration.status === "used" ||
    registration.status === "CheckedIn" ||
    registration.status === "checked_in" ||
    registration.checkedIn === true;

  const [isTornLocally, setIsTornLocally] = useState(false);
  const isTorn = isCheckedInInitially || isTornLocally;
  const setIsTorn = (val) => {
    setIsTornLocally(typeof val === "function" ? val(isTorn) : val);
  };
  const [showQrModal, setShowQrModal] = useState(false);
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

  const ticketBgUrl =
    event.ticketBgUrl ||
    event.ticketBackground ||
    registration.ticketBgUrl ||
    registration.ticketBackground ||
    null;

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

  // Audio effect for realistic paper tear sound
  const playTearSound = () => {
    try {
      if (typeof window === "undefined") return;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const bufferSize = Math.floor(ctx.sampleRate * 0.16);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        const decay = Math.exp(-i / (bufferSize * 0.28));
        data[i] = (Math.random() * 2 - 1) * decay;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(2200, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(700, ctx.currentTime + 0.15);
      filter.Q.value = 1.6;
      noise.connect(filter);
      filter.connect(ctx.destination);
      noise.start();

      if (navigator.vibrate) {
        navigator.vibrate([22, 40, 28]);
      }
    } catch {
      // Audio autoplay policy or not supported, ignore silently
    }
  };

  const handleStubClick = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!interactive) return;
    if (isPending) {
      toast.info("Registration pending organiser approval. Access will unlock once approved.");
      return;
    }
    playTearSound();
    setIsTorn(true);
    toast.success("Ticket stub torn · Check-in confirmed!");
    if (onCheckIn) {
      onCheckIn(registration.ticketId || ticketId);
    }
  };

  // Organiser layout and typography customizations
  const yPos = typeof event.posterTextY === "number" ? event.posterTextY : 42;
  const vAlignClass =
    yPos <= 28
      ? "justify-start pt-3 sm:pt-4"
      : yPos >= 60
      ? "justify-end pb-3 sm:pb-4"
      : "justify-center";

  const hAlign = event.posterAlign || event.ticketAlign || "left";
  const textAlignClass =
    hAlign === "center"
      ? "text-center items-center mx-auto"
      : hAlign === "right"
      ? "text-right items-end ml-auto"
      : "text-left items-start mr-auto";

  const customFontSize = event.posterFontSize || event.ticketFontSize || null;
  const fontSizeStyle = customFontSize
    ? {
        fontSize: `clamp(${Math.max(16, Math.round(customFontSize * 0.65))}px, ${customFontSize * 0.075}vw + 12px, ${customFontSize}px)`,
        lineHeight: 1.08,
      }
    : undefined;

  const backdrop = event.posterTextBg || event.ticketTextBg || "shadow";
  const backdropClass =
    backdrop === "badge"
      ? "bg-black/40 backdrop-blur-md px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl border border-white/10 shadow-lg"
      : backdrop === "solid"
      ? "bg-black/90 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl shadow-xl"
      : backdrop === "shadow"
      ? "drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
      : "";

  return (
    <div className={`w-full max-w-4xl mx-auto overflow-hidden sm:overflow-visible ${className}`}>
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
            {/* Optional Custom Background Image with Auto-fit Aspect Ratio */}
            {ticketBgUrl && (
              <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                <img
                  src={ticketBgUrl}
                  alt="Ticket Background"
                  className="w-full h-full object-cover object-center pointer-events-none transition-transform duration-700 group-hover:scale-105"
                />
                {/* Contrast overlay / scrim */}
                <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/35 backdrop-blur-[0.5px]" />
              </div>
            )}

            {/* Top Graphics & Title Area */}
            <div
              className={`relative px-4 xs:px-5 sm:px-7 md:px-8 py-3 sm:py-5 flex-1 flex flex-col ${vAlignClass} overflow-hidden`}
            >
              {/* Main Typography Header (Matching bold, clean, solid) */}
              <div
                className={`relative z-10 max-w-[80%] sm:max-w-[76%] flex flex-col ${textAlignClass} ${backdropClass}`}
              >
                <h2
                  style={{ ...fontSizeStyle, ...themeConfig.titleStyle }}
                  className={`text-base xs:text-xl sm:text-2xl md:text-[34px] font-black uppercase tracking-tight leading-[1.08] break-words ${themeConfig.titleColor}`}
                >
                  {titleInfo.line1}
                </h2>

                {/* Subtitle / Second Line in matching bold solid color */}
                {titleInfo.line2 && (
                  <div className="mt-0.5 sm:mt-1 w-full">
                    <span
                      style={{ ...fontSizeStyle, ...themeConfig.titleStyle }}
                      className={`text-base xs:text-xl sm:text-2xl md:text-[34px] font-black uppercase tracking-tight leading-[1.08] block break-words ${themeConfig.titleColor}`}
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

            {/* Jagged Ripped Edge on Ticket Body when Torn */}
            {isTorn && (
              <svg
                className="absolute -right-2 top-0 bottom-0 h-full w-4 overflow-visible pointer-events-none fill-current text-black/35 dark:text-black/60 z-20"
                preserveAspectRatio="none"
                viewBox="0 0 10 100"
              >
                <path d="M 0 0 L 10 5 L 0 10 L 10 15 L 0 20 L 10 25 L 0 30 L 10 35 L 0 40 L 10 45 L 0 50 L 10 55 L 0 60 L 10 65 L 0 70 L 10 75 L 0 80 L 10 85 L 0 90 L 10 95 L 0 100 Z" />
              </svg>
            )}
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
                  ? "Ticket stub torn · User checked in"
                  : "Click or tap to tear off ticket stub & check in"
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
                ? "translate-x-3.5 sm:translate-x-6 translate-y-1.5 sm:translate-y-3.5 rotate-[3.8deg] shadow-2xl opacity-95 ring-1 ring-emerald-500/30"
                : "hover:brightness-105"
            }`}
          >
            {/* Top Cutout Notch */}
            <div className="ticket-notch absolute -top-2 sm:-top-3 -left-2 sm:-left-3 w-4 h-4 sm:w-6 sm:h-6 rounded-full bg-[#131517] [html.light_&]:bg-[#F7F5EE] print:bg-white z-20 pointer-events-none" />

            {/* Bottom Cutout Notch */}
            <div className="ticket-notch absolute -bottom-2 sm:-bottom-3 -left-2 sm:-left-3 w-4 h-4 sm:w-6 sm:h-6 rounded-full bg-[#131517] [html.light_&]:bg-[#F7F5EE] print:bg-white z-20 pointer-events-none" />

            {/* Vertical Perforation Line / Torn Edge */}
            <div
              className={`absolute top-2 sm:top-3 bottom-2 sm:bottom-3 -left-[1px] border-l sm:border-l-2 border-dashed ${
                isTorn ? "border-emerald-500/60" : themeConfig.perforationBorder
              } z-10`}
            />

            {/* Jagged Ripped Paper SVG Edge on Stub when Torn */}
            {isTorn && (
              <svg
                className="absolute -left-2 top-0 bottom-0 h-full w-4 overflow-visible pointer-events-none fill-current text-white/20 dark:text-black/40 z-20"
                preserveAspectRatio="none"
                viewBox="0 0 10 100"
              >
                <path d="M 0 0 L 10 5 L 0 10 L 10 15 L 0 20 L 10 25 L 0 30 L 10 35 L 0 40 L 10 45 L 0 50 L 10 55 L 0 60 L 10 65 L 0 70 L 10 75 L 0 80 L 10 85 L 0 90 L 10 95 L 0 100 Z" />
              </svg>
            )}

            {/* Floating Scissors Tear Cue when Untorn */}
            {interactive && !isTorn && !isPending && (
              <div className="absolute -left-3.5 top-1/2 -translate-y-1/2 z-30 opacity-80 group-hover/stub:opacity-100 transition-all pointer-events-none">
                <div className="bg-[#FE760B] text-black text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full shadow-lg flex items-center gap-1 border border-white/20 whitespace-nowrap animate-bounce">
                  <Scissors className="w-2.5 h-2.5 stroke-[2.5]" />
                  <span className="hidden sm:inline">Tear</span>
                </div>
              </div>
            )}

            {/* Stub Header: "SCAN AT ENTRY", "PENDING APPROVAL", or "CHECKED IN" */}
            <div className="w-full text-center mb-1 sm:mb-2">
              <span
                className={`text-[8px] xs:text-[9.5px] sm:text-xs font-black tracking-widest uppercase block ${
                  isPending
                    ? "text-amber-400"
                    : isTorn
                    ? "text-emerald-400 font-extrabold flex items-center justify-center gap-1"
                    : themeConfig.scanColor
                }`}
              >
                {isPending ? (
                  "PENDING APPROVAL"
                ) : isTorn ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>CHECKED IN</span>
                  </>
                ) : (
                  "SCAN AT ENTRY"
                )}
              </span>
            </div>

            {/* QR Code Container with High-Contrast White Background (Click to Enlarge & Check-in) */}
            <div
              onClick={(e) => {
                e.stopPropagation();
                if (isPending) {
                  toast.info("Registration pending organiser approval. Access will unlock once approved.");
                  return;
                }
                setShowQrModal(true);
              }}
              title={isPending ? "Pending organiser approval" : "Click to view QR & check in"}
              className={`relative p-1 sm:p-2 bg-white rounded-lg sm:rounded-xl shadow-md flex items-center justify-center my-0.5 sm:my-1 transition-transform ${
                isPending ? "cursor-default opacity-85" : "cursor-pointer hover:scale-105 active:scale-95"
              }`}
            >
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
              {isTorn && !isPending && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
                  <div className="transform -rotate-12 border sm:border-2 border-emerald-500 bg-emerald-600/95 text-white font-mono font-black text-[7px] xs:text-[8.5px] sm:text-xs px-1.5 xs:px-2 sm:px-2.5 py-0.5 rounded shadow-xl uppercase tracking-wider backdrop-blur-xs ring-2 ring-emerald-500/40 animate-scale-in">
                    ✓ CHECKED IN
                  </div>
                </div>
              )}

              {/* "PENDING" Stamp overlay when registration requires approval */}
              {isPending && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/35 rounded-lg sm:rounded-xl backdrop-blur-[1px]">
                  <div className="transform -rotate-12 border border-amber-400 bg-amber-500/90 text-[#131517] font-mono font-black text-[7px] xs:text-[8px] sm:text-[10px] px-1.5 py-0.5 rounded shadow-lg uppercase tracking-wider">
                    PENDING
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
              {isTorn && !isPending && (
                <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[7px] xs:text-[8px] sm:text-[9px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  Entry Admitted
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          OPTIONAL ACTIONS DRAWER & CONTROLS
          ══════════════════════════════════════════════════ */}
      {showActions && (onDownload || (isTorn && onCertificate)) && (
        <div className="ticket-actions-bar mt-2.5 sm:mt-3 bg-[#1A1C1F] border border-[#2A2D31] rounded-xl p-2.5 sm:p-3 flex flex-wrap items-center justify-end gap-2 shadow-sm">
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

      {/* Interactive QR Check-In Modal with Perforation Tear Animation */}
      <QrCheckinModal
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
        ticket={{
          ...registration,
          ticketId,
          guest: attendeeName,
          title: titleInfo.line1 + (titleInfo.line2 ? ` ${titleInfo.line2}` : ""),
          date: meta.dateStr,
          time: meta.timeStr,
          venue: meta.venueStr,
          ticketType: meta.tierStr,
          qrCode: qrDataUrl,
          status: isTorn ? "Used" : (registration.status || "Unused"),
        }}
        onCheckIn={() => {
          setIsTorn(true);
        }}
      />
    </div>
  );
}

export default StubTicket;
