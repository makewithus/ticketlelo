"use client";

import { useState, useEffect } from "react";
import QRCode from "qrcode";
import Image from "next/image";
import {
  Download,
  Printer,
  RotateCcw,
  CheckCircle2,
  Award,
  Scissors,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatTicketMeta } from "./stub-ticket";
import { resolveTicketTheme, parseTicketTitle } from "@/lib/ticket-theme";
import { parseFirestoreDate } from "@/lib/date-utils";
import { formatTicketId } from "@/lib/ticket-id";

// ==================== CODE 128 BARCODE GENERATOR ====================
const CODE128_START_B = 104;
const CODE128_STOP = 106;
const CODE128_PATTERNS = [
  "11011001100","11001101100","11001100110","10010011000","10010001100","10001001100",
  "10011001000","10011000100","10001100100","11001001000","11001000100","11000100100",
  "10110011100","10011011100","10011001110","10111001100","10011101100","10011100110",
  "11001110010","11001011100","11001001110","11011100100","11001110100","11100101100",
  "11100100110","11101100100","11100110100","11100110010","11011011000","11011000110",
  "11000110110","10100011000","10001011000","10001000110","10110001000","10001101000",
  "10001100010","11010001000","11000101000","11000100010","10110111000","10110001110",
  "10001101110","10111011000","10111000110","10001110110","11101110110","11010001110",
  "11000101110","11011101000","11011100010","11011101110","11101011000","11101000110",
  "11100010110","11101101000","11101100010","11100011010","11101111010","11001000010",
  "11110001010","10100110000","10100001100","10010110000","10010000110","10000101100",
  "10000100110","10110010000","10110000100","10011010000","10011000010","10000110100",
  "10000110010","11000010010","11001010000","11110111010","11000010100","10001111010",
  "10100111100","10010111100","10010011110","10111100100","10011110100","10011110010",
  "11110100100","11110010100","11110010010","11011011110","11110110110","11110011010",
  "10010111000","10010001110","10001010000","10100010000","10100001000","10001010000",
  "10100010000","11101011110","11110101110","11010000100","11010010000","11010011100",
  "1100011101011",
];

function encodeCode128(text = "") {
  const safeText = String(text || "TKT-0000-00000");
  let codes = [CODE128_START_B];
  let checksum = CODE128_START_B;
  for (let i = 0; i < safeText.length; i++) {
    const code = safeText.charCodeAt(i) - 32;
    codes.push(code);
    checksum += code * (i + 1);
  }
  codes.push(checksum % 103);
  codes.push(CODE128_STOP);
  let binary = "";
  for (const code of codes) {
    binary += CODE128_PATTERNS[code] || "";
  }
  return binary;
}

export function SvgBarcode({
  value = "1234567890",
  height = 44,
  orientation = "horizontal",
  className = "",
}) {
  const binary = encodeCode128(value);
  const barWidth = 1.15;
  const totalLength = binary.length * barWidth;

  if (orientation === "vertical") {
    return (
      <svg
        viewBox={`0 0 ${height} ${totalLength}`}
        className={`w-full h-full select-none ${className}`}
        preserveAspectRatio="none"
      >
        {binary.split("").map((bit, idx) =>
          bit === "1" ? (
            <rect
              key={idx}
              x={0}
              y={idx * barWidth}
              width={height}
              height={barWidth + 0.15}
              fill="#000000"
            />
          ) : null
        )}
      </svg>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${totalLength} ${height}`}
      className={`h-full w-auto select-none ${className}`}
      preserveAspectRatio="none"
    >
      {binary.split("").map((bit, idx) =>
        bit === "1" ? (
          <rect
            key={idx}
            x={idx * barWidth}
            y={0}
            width={barWidth + 0.15}
            height={height}
            fill="#000000"
          />
        ) : null
      )}
    </svg>
  );
}

/**
 * WideTicket: 3-Panel Ticket matching Image 2 reference design
 * 720 x 200: Left QR/Details Panel + Center Art Panel + Right Barcode Stub
 */
export function WideTicket({
  registration = {},
  event = {},
  theme: explicitTheme,
  interactive = true,
  showActions = true,
  leftVariant = "auto", // "auto" | "qr" | "details"
  onDownload,
  onAddToCalendar,
  onInvoice,
  onCertificate,
  onAppleWallet,
  onGoogleWallet,
  onTearChange,
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

  const themeConfig = resolveTicketTheme(event, explicitTheme);
  const theme = themeConfig.name;

  const titleInfo = parseTicketTitle(
    event.name || event.title || registration.eventName || registration.eventTitle || "TECH FEST 2026",
    event
  );

  const meta = formatTicketMeta({
    date: event.date || event.startDate,
    time: event.time,
    venue: event.location || event.venue || "MAIN AUDITORIUM",
    tier: registration.ticketTier || registration.tierName || "GENERAL",
    price:
      registration.amount !== undefined
        ? registration.amount
        : event.price !== undefined
        ? event.price
        : 199,
  });

  const rawTicketId =
    registration.ticketId || registration.id || "1793-AB12";
  const ticketId = formatTicketId(rawTicketId);
  const attendeeName =
    registration.attendeeName ||
    registration.name ||
    registration.fullName ||
    registration.buyerName ||
    "Aarav Kumar";

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
        console.warn("QR code generation error:", err);
      });
    return () => {
      isMounted = false;
    };
  }, [registration.qrCode, registration.qrPayload, registration.ticketId, ticketId]);

  // Audio effect for tearing ticket stub
  const playTearSound = () => {
    try {
      if (typeof window === "undefined") return;
      const AudioContext = window.AudioContext || window.webkitAudioContext;
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
      // Ignore audio policy issues
    }
  };

  const handleStubClick = () => {
    if (!interactive) return;
    playTearSound();
    setIsTorn((prev) => {
      const next = !prev;
      if (typeof onTearChange === "function") {
        onTearChange(next);
      }
      return next;
    });
  };

  // Determine left panel style:
  // If leftVariant is "auto", "gaming" theme defaults to the rich details variant (as in Praroha Gaming),
  // otherwise default to the "ADMIT ONE + QR" variant (as in Tech Fest).
  const isDetailsLeft =
    leftVariant === "details" ||
    (leftVariant === "auto" && theme === "gaming" && !registration.forceQrLeft);

  const ticketBgUrl =
    event.ticketBgUrl ||
    event.ticketBackground ||
    registration.ticketBgUrl ||
    registration.ticketBackground ||
    "";

  // Format date day and month for Praroha style e.g. "07.11"
  const getDateDisplay = () => {
    try {
      const d = parseFirestoreDate(event.date) || new Date();
      if (!isNaN(d.getTime())) {
        const day = String(d.getDate()).padStart(2, "0");
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
        const dayName = days[d.getDay()];
        const year = d.getFullYear();
        return {
          num: `${day}.${month}`,
          sub: `${dayName} • ${year}`,
        };
      }
    } catch {}
    return { num: "07.11", sub: "SAT • 2026" };
  };

  const dateDisplay = getDateDisplay();

  // Color & graphic themes for Center Panel
  const themeStyles = {
    tech: {
      centerBg: "bg-[#FE760B]",
      accentYellow: "#FDE003",
      titleColor: "text-black",
      outlineYear: true,
      chipColor: "#FDE003",
      bottomBarBg: "bg-black/95",
      bottomBarText: "text-[#D0D0D1]",
      dateColor: "text-black",
    },
    gaming: {
      centerBg: "bg-[#472F92]",
      accentYellow: "#FDE003",
      titleColor: "text-white",
      outlineYear: false,
      chipColor: "#3DD68C",
      bottomBarBg: "bg-[#150D29]/95",
      bottomBarText: "text-[#D0D0D1]",
      dateColor: "text-[#472F92]",
    },
    mic: {
      centerBg: "bg-[#DE334C]",
      accentYellow: "#FDE003",
      titleColor: "text-white",
      outlineYear: false,
      chipColor: "#FE760B",
      bottomBarBg: "bg-[#1D060D]/95",
      bottomBarText: "text-[#D0D0D1]",
      dateColor: "text-[#DE334C]",
    },
    robotics: {
      centerBg: "bg-[#0E746D]",
      accentYellow: "#FDE003",
      titleColor: "text-white",
      outlineYear: false,
      chipColor: "#5EEAD4",
      bottomBarBg: "bg-[#051917]/95",
      bottomBarText: "text-[#D0D0D1]",
      dateColor: "text-[#0E746D]",
    },
  }[theme] || {
    centerBg: "bg-[#FE760B]",
    accentYellow: "#FDE003",
    titleColor: "text-black",
    outlineYear: true,
    chipColor: "#FDE003",
    bottomBarBg: "bg-black/95",
    bottomBarText: "text-[#D0D0D1]",
    dateColor: "text-black",
  };

  // Organiser layout and typography customizations
  const yPos = typeof event.posterTextY === "number" ? event.posterTextY : 42;
  const vAlignClass =
    yPos <= 28
      ? "justify-start pt-2"
      : yPos >= 60
      ? "justify-end pb-2"
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
      ? "bg-black/40 backdrop-blur-md px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl border border-white/10 shadow-lg"
      : backdrop === "solid"
      ? "bg-black/90 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl shadow-xl"
      : backdrop === "shadow"
      ? "drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
      : "";

  return (
    <div className={`w-full max-w-[760px] mx-auto select-none print:max-w-none ${className}`}>
      {/* ── 3-PANEL WIDE TICKET CONTAINER ── */}
      <div
        data-ticket="true"
        className={`wide-ticket-root relative flex flex-col md:flex-row items-stretch rounded-2xl overflow-hidden shadow-2xl transition-all duration-300 ${
          isTorn ? "opacity-95" : ""
        }`}
        style={{
          boxShadow: "0 20px 40px -10px rgba(0,0,0,0.7), 0 4px 12px rgba(0,0,0,0.3)",
        }}
      >
        {/* ══════════════════════════════════════════════════
            PANEL 1: LEFT PANEL (HIGH-CONTRAST DARK QR STUB WITH TEAR)
            ══════════════════════════════════════════════════ */}
        <div
          onClick={handleStubClick}
          title={
            interactive
              ? isTorn
                ? "Ticket stub torn off · User checked in"
                : "Click stub to tear off & check in"
              : undefined
          }
          style={{
            transformOrigin: "center left",
          }}
          className={`relative w-full md:w-[175px] lg:w-[190px] shrink-0 bg-[#16181B] text-white p-3.5 sm:p-4 flex flex-col justify-between items-center text-center transition-all duration-300 ${
            interactive ? "cursor-pointer group/qrstub" : ""
          } ${
            isTorn
              ? "md:-translate-x-2.5 md:-translate-y-1 md:-rotate-[1.5deg] shadow-2xl opacity-95 ring-1 ring-emerald-500/40"
              : "hover:brightness-105"
          }`}
        >
          {/* Top Status Header: SCAN AT ENTRY or CHECKED IN */}
          <div className="w-full text-center">
            <span
              className={`text-[9px] sm:text-[10px] font-black tracking-widest uppercase block ${
                isTorn
                  ? "text-emerald-400 font-extrabold flex items-center justify-center gap-1.5"
                  : "text-[#FDE003]"
              }`}
            >
              {isTorn ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>CHECKED IN</span>
                </>
              ) : (
                "SCAN AT ENTRY"
              )}
            </span>
          </div>

          {/* High-Contrast Styled QR Code Card with Checked In Overlay */}
          <div className="my-auto py-1 flex items-center justify-center relative">
            <div className="p-2 sm:p-2.5 bg-white rounded-xl shadow-md flex items-center justify-center relative">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`Ticket QR Code for ${ticketId}`}
                  className="w-24 h-24 sm:w-28 sm:h-28 object-contain"
                />
              ) : (
                <div className="w-24 h-24 sm:w-28 sm:h-28 bg-white flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {/* Checked In Overlay Stamp on QR when Torn */}
              {isTorn && (
                <div className="absolute inset-0 bg-black/65 backdrop-blur-[1px] rounded-xl flex flex-col items-center justify-center p-1 border-2 border-emerald-400">
                  <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-emerald-400 mb-0.5">
                    <Check className="w-4 h-4 stroke-[3]" />
                  </div>
                  <span className="text-[10px] sm:text-[11px] font-black tracking-wider text-emerald-300 uppercase leading-none">
                    CHECKED IN
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Ticket ID & Attendee Info matching Stub ticket style */}
          <div className="w-full space-y-0.5 pt-1">
            <span className="font-mono text-[9px] sm:text-[10.5px] font-bold tracking-tight text-[#FE760B] block truncate">
              {ticketId}
            </span>
            <span className="text-[9px] sm:text-[10px] text-gray-300 font-medium block truncate">
              {attendeeName} (Attendee)
            </span>
          </div>

          {/* Perforation line (dashed) on right boundary */}
          <div
            className={`hidden md:block absolute inset-y-0 right-0 w-0 border-r-2 border-dashed ${
              isTorn ? "border-emerald-500/60" : "border-black/30 dark:border-white/20"
            } z-10`}
          />

          {/* Right boundary die-cut notches for Left QR Stub (desktop) */}
          <div className="ticket-notch hidden md:block absolute -top-3.5 -right-3.5 w-7 h-7 rounded-full bg-[#131517] [html.light_&]:bg-[#F7F5EE] print:bg-white z-20 pointer-events-none" />
          <div className="ticket-notch hidden md:block absolute -bottom-3.5 -right-3.5 w-7 h-7 rounded-full bg-[#131517] [html.light_&]:bg-[#F7F5EE] print:bg-white z-20 pointer-events-none" />

          {/* Jagged Ripped Paper SVG Edge when torn */}
          {isTorn && (
            <div className="hidden md:block absolute -right-2 top-0 bottom-0 w-2 pointer-events-none z-20 overflow-hidden">
              <svg
                viewBox="0 0 10 100"
                preserveAspectRatio="none"
                className="w-full h-full fill-[#16181B] drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]"
              >
                <polygon points="0,0 8,5 1,10 9,16 2,22 7,28 0,34 8,40 2,46 9,52 1,58 7,64 0,70 8,76 2,82 9,88 1,94 0,100" />
              </svg>
            </div>
          )}

          {/* Floating Scissors Tear Cue on Perforation when Untorn */}
          {interactive && !isTorn && (
            <div className="hidden md:flex absolute -right-3 top-4 z-30 items-center justify-center px-1.5 py-0.5 rounded-full bg-[#FE760B] text-black text-[9px] font-black uppercase shadow-lg border border-white/20 whitespace-nowrap animate-bounce pointer-events-none gap-0.5">
              <Scissors className="w-2.5 h-2.5 stroke-[2.5]" />
              <span>TEAR</span>
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════════
            PANEL 2: ARTWORK PANEL (VIBRANT THEME ART)
            ══════════════════════════════════════════════════ */}
        <div
          style={themeConfig.bodyBgStyle}
          className="relative flex-1 min-h-[160px] md:min-h-[190px] flex flex-col justify-between p-4 sm:p-5 overflow-hidden rounded-b-2xl md:rounded-b-none md:rounded-r-2xl"
        >
          {/* Left boundary die-cut notches for Art Panel (desktop) */}
          <div className="ticket-notch hidden md:block absolute -top-3.5 -left-3.5 w-7 h-7 rounded-full bg-[#131517] [html.light_&]:bg-[#F7F5EE] print:bg-white z-20 pointer-events-none" />
          <div className="ticket-notch hidden md:block absolute -bottom-3.5 -left-3.5 w-7 h-7 rounded-full bg-[#131517] [html.light_&]:bg-[#F7F5EE] print:bg-white z-20 pointer-events-none" />

          {/* Jagged Ripped Paper SVG Edge on left when torn */}
          {isTorn && (
            <div className="hidden md:block absolute -left-2 top-0 bottom-0 w-2 pointer-events-none z-20 overflow-hidden">
              <svg
                viewBox="0 0 10 100"
                preserveAspectRatio="none"
                className="w-full h-full fill-black/40 drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]"
              >
                <polygon points="10,0 2,5 9,10 1,16 8,22 3,28 10,34 2,40 8,46 1,52 9,58 3,64 10,70 2,76 8,82 1,88 9,94 10,100" />
              </svg>
            </div>
          )}
          {/* Custom Ticket Artwork / Background with auto-fit aspect ratio */}
          {ticketBgUrl ? (
            <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
              <img
                src={ticketBgUrl}
                alt="Ticket artwork"
                className="w-full h-full object-cover object-center"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/45 to-black/85" />
            </div>
          ) : null}

          {/* THEME ARTWORKS */}

          {/* Theme 1: Tech Orange */}
          {theme === "tech" && (
            <>
              {/* Dot grid at top left */}
              <div className="absolute top-3.5 left-4 grid grid-cols-5 gap-2 pointer-events-none opacity-40">
                {Array.from({ length: 15 }).map((_, i) => (
                  <span key={i} className="w-1 h-1 rounded-full bg-black/60" />
                ))}
              </div>

              {/* Yellow Circuit Lines Top Right */}
              <div className="absolute top-2 right-12 w-32 h-14 pointer-events-none opacity-90">
                <svg viewBox="0 0 130 50" className="w-full h-full fill-none stroke-[#FDE003]" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M10 25 L 45 25 L 60 10 L 115 10" />
                  <circle cx="118" cy="10" r="3.5" fill="#FDE003" />
                  <path d="M30 38 L 65 38 L 80 25 L 125 25" />
                  <circle cx="127" cy="25" r="3" fill="#FDE003" />
                </svg>
              </div>

              {/* Circuit Chip Icon Bottom Right */}
              <div className="absolute right-4 bottom-8 sm:bottom-7 w-14 h-14 pointer-events-none drop-shadow-md">
                <svg viewBox="0 0 50 50" className="w-full h-full">
                  <rect x="10" y="10" width="30" height="30" rx="5" fill="#131517" />
                  <rect x="16" y="16" width="18" height="18" rx="3" fill="#FDE003" />
                  {/* Pins */}
                  <line x1="10" y1="18" x2="4" y2="18" stroke="#131517" strokeWidth="2.5" />
                  <line x1="10" y1="25" x2="4" y2="25" stroke="#131517" strokeWidth="2.5" />
                  <line x1="10" y1="32" x2="4" y2="32" stroke="#131517" strokeWidth="2.5" />
                  <line x1="40" y1="18" x2="46" y2="18" stroke="#131517" strokeWidth="2.5" />
                  <line x1="40" y1="25" x2="46" y2="25" stroke="#131517" strokeWidth="2.5" />
                  <line x1="40" y1="32" x2="46" y2="32" stroke="#131517" strokeWidth="2.5" />
                </svg>
              </div>
            </>
          )}

          {/* Theme 2: Gaming Purple */}
          {theme === "gaming" && (
            <>
              {/* Top Right: Yellow 8-bit Cross + Bubble Dots */}
              <div className="absolute top-3 right-6 pointer-events-none flex items-center gap-3">
                {/* 8-bit Cross */}
                <div className="relative w-8 h-8">
                  <div className="absolute inset-x-2.5 inset-y-0 bg-[#FDE003] rounded-xs" />
                  <div className="absolute inset-y-2.5 inset-x-0 bg-[#FDE003] rounded-xs" />
                </div>
                {/* Bubble Dots */}
                <div className="flex flex-col gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[#EC4899]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#3DD68C]" />
                </div>
              </div>

              {/* Bottom Right: Cascading Mosaic Pixel Blocks */}
              <div className="absolute right-4 bottom-7 grid grid-cols-6 gap-1 pointer-events-none opacity-90">
                <span className="w-3 h-3 bg-[#EC4899] rounded-xs col-start-2" />
                <span className="w-3 h-3 bg-[#3DD68C] rounded-xs col-start-4" />
                <span className="w-3 h-3 bg-[#FDE003] rounded-xs col-start-5" />
                <span className="w-3 h-3 bg-[#3B82F6] rounded-xs col-start-1" />
                <span className="w-3 h-3 bg-[#EC4899] rounded-xs col-start-2" />
                <span className="w-3 h-3 bg-[#FDE003] rounded-xs col-start-3" />
                <span className="w-3 h-3 bg-[#3DD68C] rounded-xs col-start-4" />
                <span className="w-3 h-3 bg-[#A855F7] rounded-xs col-start-5" />
                <span className="w-3 h-3 bg-[#EC4899] rounded-xs col-start-6" />
                <span className="w-3 h-3 bg-[#3DD68C] rounded-xs col-start-2" />
                <span className="w-3 h-3 bg-[#FDE003] rounded-xs col-start-3" />
                <span className="w-3 h-3 bg-[#3B82F6] rounded-xs col-start-4" />
                <span className="w-3 h-3 bg-[#EC4899] rounded-xs col-start-5" />
              </div>
            </>
          )}

          {/* Theme 3: Open Mic Red */}
          {theme === "mic" && (
            <>
              {/* Concentric soundwaves & microphone */}
              <div className="absolute right-6 top-1/2 -translate-y-1/2 w-28 h-28 pointer-events-none opacity-80">
                <svg viewBox="0 0 100 100" className="w-full h-full">
                  <circle cx="50" cy="50" r="16" stroke="#FDE003" strokeWidth="2" strokeDasharray="3 3" fill="none" opacity="0.8" />
                  <circle cx="50" cy="50" r="26" stroke="#FDE003" strokeWidth="1.8" strokeDasharray="4 4" fill="none" opacity="0.6" />
                  <circle cx="50" cy="50" r="36" stroke="#FFFFFF" strokeWidth="1.5" strokeDasharray="5 4" fill="none" opacity="0.4" />
                  <circle cx="50" cy="50" r="46" stroke="#FFFFFF" strokeWidth="1.2" strokeDasharray="6 4" fill="none" opacity="0.3" />
                </svg>
              </div>
              <div className="absolute right-8 top-1/2 -translate-y-1/2 w-10 h-16 pointer-events-none">
                <svg viewBox="0 0 50 70" className="w-full h-full drop-shadow-md">
                  <rect x="18" y="8" width="14" height="26" rx="7" fill="#FDE003" stroke="#131517" strokeWidth="2" />
                  <path d="M14 24 Q 14 38, 25 38 Q 36 38, 36 24" fill="none" stroke="#131517" strokeWidth="2.5" />
                  <line x1="25" y1="38" x2="25" y2="52" stroke="#131517" strokeWidth="3" />
                  <rect x="16" y="52" width="18" height="4" rx="2" fill="#131517" />
                </svg>
              </div>
            </>
          )}

          {/* Theme 4: Robotics Teal */}
          {theme === "robotics" && (
            <>
              {/* Cog gears illustration */}
              <div className="absolute right-5 top-2 w-24 h-24 pointer-events-none opacity-85">
                <svg viewBox="0 0 100 100" className="w-full h-full fill-[#3DD68C]">
                  <path d="M50 35 A 15 15 0 1 0 50 65 A 15 15 0 1 0 50 35 M50 20 L54 10 L62 12 L60 22 L70 28 L79 22 L85 28 L80 37 L88 45 L98 43 L99 51 L89 55 L87 66 L95 73 L90 80 L80 77 L73 85 L76 95 L68 98 L63 88 L52 89 L48 99 L40 97 L42 87 L32 81 L23 87 L17 81 L22 72 L14 64 L4 66 L3 58 L13 54 L15 43 L7 36 L12 29 L22 32 L29 24 L26 14 L34 11 L39 21 Z" />
                  <circle cx="50" cy="50" r="10" fill="#0E746D" />
                </svg>
              </div>
              <div className="absolute right-20 bottom-8 w-12 h-12 pointer-events-none opacity-90">
                <svg viewBox="0 0 100 100" className="w-full h-full fill-[#FDE003]">
                  <circle cx="50" cy="50" r="30" />
                  <circle cx="50" cy="50" r="12" fill="#0E746D" />
                </svg>
              </div>
            </>
          )}

          {/* Center Content: Headline & Subtitle */}
          <div className={`relative z-10 my-auto flex flex-col ${textAlignClass} ${backdropClass}`}>
            <h2
              style={{ ...fontSizeStyle, ...themeConfig.titleStyle }}
              className={`text-xl sm:text-2xl lg:text-3xl font-black uppercase tracking-tight leading-[1.08] break-words ${themeConfig.titleColor}`}
            >
              {titleInfo.line1 || "EVENT PASS"}
            </h2>

            {titleInfo.line2 ? (
              <div className="mt-0.5 sm:mt-1 w-full">
                <span
                  style={{ ...fontSizeStyle, ...themeConfig.titleStyle }}
                  className={`text-base sm:text-xl font-black uppercase tracking-tight leading-[1.08] block break-words ${themeConfig.titleColor}`}
                >
                  {titleInfo.line2}
                </span>
              </div>
            ) : null}
          </div>

          {/* Bottom Information Strip matching Image 2 */}
          <div className="relative z-10 mt-4 pt-1.5 border-t border-black/15">
            <p className="font-mono text-[9px] sm:text-[10.5px] font-bold text-black/85 tracking-wider truncate uppercase">
              {meta.dateStr} • {meta.timeStr} • {meta.venueStr} • {attendeeName}
            </p>
          </div>
        </div>
      </div>

      {/* ── ACTION BUTTONS & METADATA BAR ── */}
      {showActions && (
        <div className="ticket-actions-bar mt-3.5 flex flex-wrap items-center justify-between gap-2.5 px-1 print:hidden">
          <div className="flex items-center gap-2 text-xs text-[#061A3F] dark:text-[#9B9EA4]">
            <button
              onClick={handleStubClick}
              className="text-xs text-[#FE760B] hover:underline font-semibold cursor-pointer flex items-center gap-1.5"
            >
              {isTorn ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5 text-[#FE760B]" />
                  <span>Stub torn off (Click to reattach)</span>
                </>
              ) : (
                <>
                  <Scissors className="w-3.5 h-3.5 text-[#FE760B]" />
                  <span>Click stub to tear off</span>
                </>
              )}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {onDownload && (
              <Button
                onClick={onDownload}
                size="sm"
                variant="outline"
                className="h-8 text-xs font-semibold bg-[#1A1C1F] border-[#2A2D31] text-[#061A3F] dark:text-[#D0D0D1] hover:text-[#FE760B] hover:bg-[#212327] gap-1.5 rounded-xl cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-[#FE760B]" />
                <span>PDF Pass</span>
              </Button>
            )}

            <Button
              onClick={() => window.print()}
              size="sm"
              variant="outline"
              className="h-8 text-xs font-semibold bg-[#1A1C1F] border-[#2A2D31] text-[#061A3F] dark:text-[#D0D0D1] hover:text-[#3DD68C] hover:bg-[#212327] gap-1.5 rounded-xl cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-[#3DD68C]" />
              <span>Print</span>
            </Button>

            {onCertificate && (
              <Button
                onClick={onCertificate}
                size="sm"
                variant="outline"
                className="h-8 text-xs font-semibold bg-[#1A1C1F] border-[#2A2D31] text-[#061A3F] dark:text-[#D0D0D1] hover:text-[#FE760B] hover:bg-[#212327] gap-1.5 rounded-xl cursor-pointer"
              >
                <Award className="w-3.5 h-3.5 text-[#FE760B]" />
                <span>Certificate</span>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
