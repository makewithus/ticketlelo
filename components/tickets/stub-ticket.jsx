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

/**
 * Helper to parse an event title into primary headline and subtitle/year.
 * Handles "TECH FEST 2026", "PRAROHA GAMING", "OPEN MIC NIGHT", "ROBOTICS EXPO", etc.
 */
export function parseTicketTitle(fullName = "") {
  const trimmed = (fullName || "").trim();
  if (!trimmed) {
    return { line1: "EVENT", line2: "PASS", isYear: false };
  }

  // Check for 4-digit year at the end e.g. "TECH FEST 2026"
  const yearMatch = trimmed.match(/^(.*?)\s+((?:19|20)\d{2})$/i);
  if (yearMatch) {
    return { line1: yearMatch[1], line2: yearMatch[2], isYear: true };
  }

  // Check multi-word titles e.g. "PRAROHA GAMING", "OPEN MIC NIGHT", "ROBOTICS EXPO"
  const words = trimmed.split(/\s+/);
  if (words.length >= 2) {
    const line2 = words[words.length - 1];
    const line1 = words.slice(0, words.length - 1).join(" ");
    return { line1, line2, isYear: false };
  }

  return { line1: trimmed, line2: "", isYear: false };
}

/**
 * Deterministically auto-detect the best matching theme from event name & category
 */
export function detectTicketTheme(eventName = "", category = "") {
  const combined = `${eventName} ${category}`.toLowerCase();
  if (
    combined.includes("game") ||
    combined.includes("gaming") ||
    combined.includes("esport") ||
    combined.includes("play") ||
    combined.includes("praroha")
  ) {
    return "gaming";
  }
  if (
    combined.includes("mic") ||
    combined.includes("comedy") ||
    combined.includes("music") ||
    combined.includes("cult") ||
    combined.includes("concert") ||
    combined.includes("standup") ||
    combined.includes("open mic")
  ) {
    return "mic";
  }
  if (
    combined.includes("robot") ||
    combined.includes("expo") ||
    combined.includes("science") ||
    combined.includes("innovation") ||
    combined.includes("lab")
  ) {
    return "robotics";
  }
  return "tech"; // default Ticket Orange theme
}

export { formatTicketMeta };

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

  // Determine theme
  const theme =
    explicitTheme ||
    event.theme ||
    detectTicketTheme(
      event.name || event.title || registration.eventName || registration.eventTitle,
      event.category || registration.category
    );

  // Parse title & year
  const titleInfo = parseTicketTitle(
    event.name || event.title || registration.eventName || registration.eventTitle || "TICKET PASS"
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

  // Theme-specific color classes & visual configurations
  const themeConfig = {
    tech: {
      bodyBg: "bg-[#FE760B]",
      bodyBgStyle: { backgroundColor: "#FE760B" },
      stubBg: "bg-[#201207]",
      stubBgStyle: { backgroundColor: "#201207" },
      bottomBarBg: "bg-[#0C0D10]",
      bottomBarStyle: { backgroundColor: "#0C0D10" },
      scanColor: "text-[#FDE003]",
      ticketIdColor: "text-[#FE760B]",
      accentYellow: "#FDE003",
      titleColor: "text-black font-black",
      subtitleOutline: true,
      perforationBorder: "border-black/20",
    },
    gaming: {
      bodyBg: "bg-[#4B2E9C]",
      bodyBgStyle: { backgroundColor: "#472F92" },
      stubBg: "bg-[#150D29]",
      stubBgStyle: { backgroundColor: "#150D29" },
      bottomBarBg: "bg-[#0D081B]",
      bottomBarStyle: { backgroundColor: "#0D081B" },
      scanColor: "text-[#3DD68C]",
      ticketIdColor: "text-[#A78BFA]",
      accentYellow: "#FDE003",
      titleColor: "text-white font-black",
      subtitleOutline: false,
      perforationBorder: "border-white/20",
    },
    mic: {
      bodyBg: "bg-[#DE334C]",
      bodyBgStyle: { backgroundColor: "#DE334C" },
      stubBg: "bg-[#1D060D]",
      stubBgStyle: { backgroundColor: "#1D060D" },
      bottomBarBg: "bg-[#16040A]",
      bottomBarStyle: { backgroundColor: "#16040A" },
      scanColor: "text-[#FE760B]",
      ticketIdColor: "text-[#FB7185]",
      accentYellow: "#FDE003",
      titleColor: "text-white font-black",
      subtitleOutline: false,
      perforationBorder: "border-white/20",
    },
    robotics: {
      bodyBg: "bg-[#0E746D]",
      bodyBgStyle: { backgroundColor: "#0E746D" },
      stubBg: "bg-[#051917]",
      stubBgStyle: { backgroundColor: "#051917" },
      bottomBarBg: "bg-[#041513]",
      bottomBarStyle: { backgroundColor: "#041513" },
      scanColor: "text-[#FDE003]",
      ticketIdColor: "text-[#5EEAD4]",
      accentYellow: "#FDE003",
      titleColor: "text-white font-black",
      subtitleOutline: false,
      perforationBorder: "border-white/20",
    },
  }[theme] || {
    bodyBg: "bg-[#FE760B]",
    bodyBgStyle: { backgroundColor: "#FE760B" },
    stubBg: "bg-[#201207]",
    stubBgStyle: { backgroundColor: "#201207" },
    bottomBarBg: "bg-[#0C0D10]",
    bottomBarStyle: { backgroundColor: "#0C0D10" },
    scanColor: "text-[#FDE003]",
    ticketIdColor: "text-[#FE760B]",
    accentYellow: "#FDE003",
    titleColor: "text-black font-black",
    subtitleOutline: true,
    perforationBorder: "border-black/20",
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
            <div className="relative p-3 xs:p-4 sm:p-7 flex-1 flex flex-col justify-between overflow-hidden">
              {/* Theme 1 (Tech): Dot Matrix Top-Left & Microchip/Circuit Traces on Right */}
              {theme === "tech" && (
                <>
                  {/* Dot matrix on top left */}
                  <div className="absolute top-2.5 sm:top-4 left-3 sm:left-6 pointer-events-none opacity-40 scale-75 sm:scale-100 origin-top-left">
                    <svg width="108" height="36" viewBox="0 0 108 36" fill="none">
                      {[0, 1, 2, 3].map((row) =>
                        [0, 1, 2, 3, 4, 5, 6, 7].map((col) => (
                          <circle
                            key={`${row}-${col}`}
                            cx={col * 14 + 5}
                            cy={row * 9 + 4}
                            r="2"
                            fill="#7C2D00"
                          />
                        ))
                      )}
                    </svg>
                  </div>

                  {/* Microchip & Gold Circuit Traces on Right (Responsively scaled) */}
                  <div className="absolute right-1 sm:right-4 top-1/2 -translate-y-1/2 pointer-events-none flex items-center scale-[0.52] xs:scale-[0.68] sm:scale-100 origin-right">
                    <svg
                      width="150"
                      height="110"
                      viewBox="0 0 150 110"
                      fill="none"
                      className="overflow-visible"
                    >
                      {/* Circuit Traces */}
                      <path
                        d="M 5 25 L 35 25 L 50 12 L 80 12"
                        stroke="#FDE003"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <circle cx="5" cy="25" r="3.5" fill="#FDE003" />

                      <path
                        d="M 15 45 L 40 45 L 60 30 L 78 30"
                        stroke="#FDE003"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <circle cx="15" cy="45" r="3" fill="#FDE003" />

                      {/* Microchip Body */}
                      <g transform="translate(75, 25)">
                        {/* Chip Left Pins */}
                        <rect x="-6" y="8" width="8" height="4" rx="1" fill="#FDE003" />
                        <rect x="-6" y="18" width="8" height="4" rx="1" fill="#FDE003" />
                        <rect x="-6" y="28" width="8" height="4" rx="1" fill="#FDE003" />
                        <rect x="-6" y="38" width="8" height="4" rx="1" fill="#FDE003" />

                        {/* Chip Right Pins */}
                        <rect x="48" y="8" width="8" height="4" rx="1" fill="#FDE003" />
                        <rect x="48" y="18" width="8" height="4" rx="1" fill="#FDE003" />
                        <rect x="48" y="28" width="8" height="4" rx="1" fill="#FDE003" />
                        <rect x="48" y="38" width="8" height="4" rx="1" fill="#FDE003" />

                        {/* Chip Main Shell */}
                        <rect
                          x="0"
                          y="0"
                          width="50"
                          height="50"
                          rx="6"
                          fill="#131517"
                          stroke="#2A2D31"
                          strokeWidth="1.5"
                        />
                        {/* Chip Golden Core */}
                        <rect
                          x="9"
                          y="9"
                          width="32"
                          height="32"
                          rx="4"
                          fill="#FDE003"
                        />
                      </g>
                    </svg>
                  </div>
                </>
              )}

              {/* Theme 2 (Gaming): Yellow Plus, Neon Circles, and 8-bit Colorful Pixel Stairs */}
              {theme === "gaming" && (
                <>
                  <div className="absolute right-1 sm:right-5 top-2 sm:top-5 pointer-events-none scale-[0.52] xs:scale-[0.68] sm:scale-100 origin-top-right">
                    <svg width="140" height="120" viewBox="0 0 140 120" fill="none">
                      {/* Yellow D-pad Plus */}
                      <path
                        d="M 30 15 h 14 v 14 h 14 v 14 h -14 v 14 h -14 v -14 h -14 v -14 h 14 Z"
                        fill="#FDE003"
                      />
                      {/* Neon Magenta & Cyan gaming dots */}
                      <circle cx="82" cy="22" r="8" fill="#F43F5E" />
                      <circle cx="102" cy="38" r="7" fill="#00E5FF" />

                      {/* 8-bit colorful pixel blocks staircase */}
                      <g transform="translate(5, 62)">
                        {/* Stepped 8-bit blocks */}
                        <rect x="75" y="0" width="12" height="12" fill="#F43F5E" />
                        <rect x="75" y="14" width="12" height="12" fill="#00E5FF" />
                        <rect x="89" y="14" width="12" height="12" fill="#FDE003" />
                        <rect x="61" y="28" width="12" height="12" fill="#3DD68C" />
                        <rect x="75" y="28" width="12" height="12" fill="#F43F5E" />
                        <rect x="89" y="28" width="12" height="12" fill="#00E5FF" />
                        <rect x="103" y="28" width="12" height="12" fill="#FDE003" />
                        <rect x="47" y="42" width="12" height="12" fill="#00E5FF" />
                        <rect x="61" y="42" width="12" height="12" fill="#F43F5E" />
                        <rect x="75" y="42" width="12" height="12" fill="#00E5FF" />
                        <rect x="89" y="42" width="12" height="12" fill="#FDE003" />
                        <rect x="103" y="42" width="12" height="12" fill="#3DD68C" />
                        <rect x="117" y="42" width="12" height="12" fill="#A855F7" />
                      </g>
                    </svg>
                  </div>
                </>
              )}

              {/* Theme 3 (Open Mic): Concentric Soundwaves & Yellow Stage Microphone */}
              {theme === "mic" && (
                <>
                  <div className="absolute right-1 sm:right-4 top-1/2 -translate-y-1/2 pointer-events-none scale-[0.52] xs:scale-[0.68] sm:scale-100 origin-right">
                    <svg
                      width="150"
                      height="130"
                      viewBox="0 0 150 130"
                      fill="none"
                      className="overflow-visible"
                    >
                      {/* Concentric soundwaves radiating outwards */}
                      <circle
                        cx="75"
                        cy="65"
                        r="32"
                        stroke="rgba(255,255,255,0.4)"
                        strokeWidth="3.5"
                      />
                      <circle
                        cx="75"
                        cy="65"
                        r="48"
                        stroke="rgba(255,255,255,0.3)"
                        strokeWidth="3.5"
                      />
                      <circle
                        cx="75"
                        cy="65"
                        r="64"
                        stroke="rgba(255,255,255,0.2)"
                        strokeWidth="3.5"
                      />

                      {/* Microphone circular dark badge */}
                      <circle
                        cx="75"
                        cy="65"
                        r="25"
                        fill="#801323"
                        stroke="#FFA4B2"
                        strokeWidth="2.5"
                      />

                      {/* Yellow Vintage Microphone */}
                      <g transform="translate(75, 65)">
                        <rect
                          x="-8"
                          y="-18"
                          width="16"
                          height="22"
                          rx="8"
                          fill="#FDE003"
                        />
                        <path
                          d="M -13 -6 A 13 13 0 0 0 13 -6"
                          fill="none"
                          stroke="#FDE003"
                          strokeWidth="3.5"
                          strokeLinecap="round"
                        />
                        <line
                          x1="0"
                          y1="7"
                          x2="0"
                          y2="16"
                          stroke="#FDE003"
                          strokeWidth="3.5"
                          strokeLinecap="round"
                        />
                        <line
                          x1="-10"
                          y1="16"
                          x2="10"
                          y2="16"
                          stroke="#FDE003"
                          strokeWidth="3.5"
                          strokeLinecap="round"
                        />
                      </g>
                    </svg>
                  </div>
                </>
              )}

              {/* Theme 4 (Robotics): Interlocking Mint & Yellow Gears, White Cog & Hex Nuts */}
              {theme === "robotics" && (
                <>
                  <div className="absolute right-0.5 sm:right-3 top-1/2 -translate-y-1/2 pointer-events-none scale-[0.52] xs:scale-[0.68] sm:scale-100 origin-right">
                    <svg
                      width="160"
                      height="130"
                      viewBox="0 0 160 130"
                      fill="none"
                      className="overflow-visible"
                    >
                      {/* Hex Nut 1 */}
                      <polygon
                        points="35,12 43,17 43,27 35,32 27,27 27,17"
                        fill="none"
                        stroke="rgba(255,255,255,0.85)"
                        strokeWidth="1.5"
                      />
                      <circle
                        cx="35"
                        cy="22"
                        r="3.5"
                        fill="none"
                        stroke="rgba(255,255,255,0.85)"
                        strokeWidth="1.5"
                      />

                      {/* Hex Nut 2 */}
                      <polygon
                        points="15,40 22,44 22,52 15,56 8,52 8,44"
                        fill="none"
                        stroke="rgba(255,255,255,0.85)"
                        strokeWidth="1.5"
                      />
                      <circle
                        cx="15"
                        cy="48"
                        r="3"
                        fill="none"
                        stroke="rgba(255,255,255,0.85)"
                        strokeWidth="1.5"
                      />

                      {/* Large Mint Green Gear */}
                      <g transform="translate(95, 42)">
                        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
                          <rect
                            key={angle}
                            x="-6"
                            y="-33"
                            width="12"
                            height="10"
                            rx="2"
                            fill="#3DD68C"
                            transform={`rotate(${angle})`}
                          />
                        ))}
                        <circle cx="0" cy="0" r="28" fill="#3DD68C" />
                        <circle cx="0" cy="0" r="10" fill="#0E746D" />
                      </g>

                      {/* Interlocking Sunny Yellow Gear */}
                      <g transform="translate(56, 92)">
                        {[0, 60, 120, 180, 240, 300].map((angle) => (
                          <rect
                            key={angle}
                            x="-5"
                            y="-25"
                            width="10"
                            height="8"
                            rx="1.5"
                            fill="#FDE003"
                            transform={`rotate(${angle})`}
                          />
                        ))}
                        <circle cx="0" cy="0" r="20" fill="#FDE003" />
                        <circle cx="0" cy="0" r="7" fill="#0E746D" />
                      </g>

                      {/* White Peeking Gear Bottom */}
                      <g transform="translate(120, 108)">
                        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
                          <rect
                            key={angle}
                            x="-4"
                            y="-22"
                            width="8"
                            height="7"
                            rx="1"
                            fill="#FFFFFF"
                            transform={`rotate(${angle})`}
                          />
                        ))}
                        <circle cx="0" cy="0" r="18" fill="#FFFFFF" />
                        <circle cx="0" cy="0" r="6" fill="#0E746D" />
                      </g>
                    </svg>
                  </div>
                </>
              )}

              {/* Main Typography Header (Responsively sized) */}
              <div className="relative z-10 max-w-[65%] sm:max-w-[62%] my-auto">
                <h2
                  className={`text-base xs:text-xl sm:text-3xl md:text-[38px] uppercase tracking-tight leading-none ${themeConfig.titleColor}`}
                >
                  {titleInfo.line1}
                </h2>

                {/* Subtitle / Second Line */}
                {titleInfo.line2 && (
                  <div className="mt-0.5 sm:mt-1">
                    {titleInfo.isYear && theme === "tech" ? (
                      /* Outline hollow font for "2026" on Tech Fest */
                      <span
                        className="text-sm xs:text-lg sm:text-3xl md:text-[38px] font-black tracking-tight leading-none block text-transparent"
                        style={{
                          WebkitTextStroke: "1.8px #000000",
                        }}
                      >
                        {titleInfo.line2}
                      </span>
                    ) : (
                      /* Bold Sunny Yellow font for "GAMING", "NIGHT", "EXPO" */
                      <span className="text-xs xs:text-base sm:text-2xl md:text-[32px] font-black uppercase tracking-tight leading-none text-[#FDE003] block">
                        {titleInfo.line2}
                      </span>
                    )}
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
            <div className="ticket-notch absolute -top-2 sm:-top-3 -left-2 sm:-left-3 w-4 h-4 sm:w-6 sm:h-6 rounded-full bg-[#131517] [html.light_&]:bg-[#F7F5EE] z-20 pointer-events-none" />

            {/* Bottom Cutout Notch */}
            <div className="ticket-notch absolute -bottom-2 sm:-bottom-3 -left-2 sm:-left-3 w-4 h-4 sm:w-6 sm:h-6 rounded-full bg-[#131517] [html.light_&]:bg-[#F7F5EE] z-20 pointer-events-none" />

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
