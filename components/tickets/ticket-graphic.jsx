"use client";

import React from "react";
import { formatTicketMeta } from "./stub-ticket";
import { resolveTicketTheme, parseTicketTitle } from "@/lib/ticket-theme";

export function normalizeTheme(t = "") {
  const s = String(t || "").toLowerCase().trim();
  if (s === "gaming" || s === "purple") return "gaming";
  if (s === "mic" || s === "pink" || s === "red") return "mic";
  if (s === "robotics" || s === "teal" || s === "green") return "robotics";
  return "tech"; // default orange
}

export function StarburstBadge({
  text,
  bgColor = "#FACC15",
  textColor = "#000000",
  className = "",
  size = 38,
}) {
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 1.5;
  const innerR = outerR * 0.76;
  const points = 12;
  const step = Math.PI / points;
  const pts = [];
  for (let i = 0; i < 2 * points; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = i * step - Math.PI / 2;
    pts.push(
      `${(cx + r * Math.cos(angle)).toFixed(1)},${(
        cy +
        r * Math.sin(angle)
      ).toFixed(1)}`
    );
  }
  const pointsStr = pts.join(" ");

  return (
    <div
      className={`relative flex items-center justify-center shrink-0 drop-shadow-md select-none ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0"
      >
        <polygon points={pointsStr} fill={bgColor} />
      </svg>
      <span
        className="relative z-10 font-black text-[9px] xs:text-[10px] sm:text-[11px] uppercase tracking-tight text-center leading-none px-0.5"
        style={{ color: textColor }}
      >
        {text}
      </span>
    </div>
  );
}

export function TicketGraphic({
  ticket,
  horizontal = false,
  notchBg,
  onQrClick,
  className = "",
}) {
  const theme = normalizeTheme(ticket?.theme);
  const themeConfig = resolveTicketTheme(ticket, ticket?.theme);

  // Parse title & year using organiser settings (posterLine1 / posterLine2) or event name
  const rawTitle = ticket?.title || ticket?.name || "EVENT PASS";
  const titleInfo = parseTicketTitle(rawTitle, ticket);

  // Format metadata matching Image 2
  const meta = formatTicketMeta({
    date: ticket?.date,
    time: ticket?.time,
    venue: ticket?.venue || ticket?.location || "MAIN AUDITORIUM",
    tier: ticket?.ticketType || ticket?.ticketTier || ticket?.subBadge || "GENERAL",
    price: ticket?.price !== undefined ? ticket.price : 199,
  });

  const ticketId = ticket?.ticketId || "TKT-1793-AB12C";
  const attendeeName = ticket?.guest || ticket?.attendeeName || "Adil M";
  const isPending =
    ticket?.isPending ||
    ticket?.status === "pending" ||
    ticket?.approvalStatus === "pending" ||
    ticket?.entryLabel === "PENDING APPROVAL";
  return (
    <div
      data-ticket="true"
      className={`ticket-graphic-root relative select-none flex rounded-xl sm:rounded-2xl lg:rounded-3xl overflow-hidden shadow-xl transition-all duration-300 ${className} ${
        horizontal
          ? "w-[310px] min-[360px]:w-[340px] xs:w-[400px] sm:w-[520px] md:w-[640px] lg:w-[800px] xl:w-[920px] h-[125px] min-[360px]:h-[135px] xs:h-[155px] sm:h-[190px] md:h-[225px] lg:h-[265px] xl:h-[295px]"
          : "w-[300px] min-[360px]:w-[330px] xs:w-[375px] sm:w-[465px] md:w-[550px] lg:w-[680px] xl:w-[780px] h-[120px] min-[360px]:h-[126px] xs:h-[142px] sm:h-[172px] md:h-[198px] lg:h-[235px] xl:h-[265px]"
      }`}
      style={{
        boxShadow: "0 22px 50px -12px rgba(0,0,0,0.85), 0 6px 18px rgba(0,0,0,0.55)",
      }}
    >
      {/* ══════════════════════════════════════════════════
          LEFT SECTION: MAIN TICKET BODY (Exact Image 2 Styling)
          ══════════════════════════════════════════════════ */}
      <div
        style={themeConfig.bodyBgStyle}
        className="relative flex-1 min-w-0 overflow-hidden flex flex-col justify-between"
      >
        {/* Top Graphics & Title Area */}
        <div className="relative p-2 xs:p-2.5 sm:p-4 md:p-4.5 lg:p-6 flex-1 flex flex-col justify-between overflow-hidden">
          {/* ── THEME 1 (TECH): Dot Matrix Top-Left & Microchip/Circuit Traces on Right ── */}
          {theme === "tech" && (
            <>
              {/* Dot matrix on top left */}
              <div className="absolute top-1 sm:top-2 left-2 sm:left-4 pointer-events-none opacity-40 scale-[0.6] xs:scale-[0.7] sm:scale-90 md:scale-100 lg:scale-[1.2] xl:scale-[1.3] origin-top-left">
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

              {/* Microchip & Gold Circuit Traces on Right (Image 2) */}
              <div className="absolute right-0 sm:right-2 top-1/2 -translate-y-1/2 pointer-events-none flex items-center scale-[0.45] xs:scale-[0.52] sm:scale-[0.72] md:scale-80 lg:scale-[1.05] xl:scale-[1.2] origin-right">
                <svg
                  width="150"
                  height="110"
                  viewBox="0 0 150 110"
                  fill="none"
                  className="overflow-visible"
                >
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

                  <g transform="translate(75, 25)">
                    <rect x="-6" y="8" width="8" height="4" rx="1" fill="#FDE003" />
                    <rect x="-6" y="18" width="8" height="4" rx="1" fill="#FDE003" />
                    <rect x="-6" y="28" width="8" height="4" rx="1" fill="#FDE003" />
                    <rect x="-6" y="38" width="8" height="4" rx="1" fill="#FDE003" />

                    <rect x="48" y="8" width="8" height="4" rx="1" fill="#FDE003" />
                    <rect x="48" y="18" width="8" height="4" rx="1" fill="#FDE003" />
                    <rect x="48" y="28" width="8" height="4" rx="1" fill="#FDE003" />
                    <rect x="48" y="38" width="8" height="4" rx="1" fill="#FDE003" />

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

          {/* ── THEME 2 (GAMING): Yellow Plus, Neon Circles, and 8-bit Colorful Pixel Stairs (Image 2) ── */}
          {theme === "gaming" && (
            <>
              <div className="absolute right-0.5 sm:right-2 top-1 sm:top-2 pointer-events-none scale-[0.45] xs:scale-[0.52] sm:scale-[0.72] md:scale-80 lg:scale-[1.05] xl:scale-[1.2] origin-top-right">
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

          {/* ── THEME 3 (MIC / CONCERT): Concentric Soundwaves & Yellow Stage Microphone (Image 2) ── */}
          {theme === "mic" && (
            <>
              <div className="absolute right-0 sm:right-2 top-1/2 -translate-y-1/2 pointer-events-none scale-[0.45] xs:scale-[0.52] sm:scale-[0.72] md:scale-80 lg:scale-[1.05] xl:scale-[1.2] origin-right">
                <svg
                  width="150"
                  height="130"
                  viewBox="0 0 150 130"
                  fill="none"
                  className="overflow-visible"
                >
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

          {/* ── THEME 4 (ROBOTICS): Hex Nuts & Interlocking Mint & Yellow Gears (Image 2) ── */}
          {theme === "robotics" && (
            <>
              <div className="absolute right-0 sm:right-2 top-1/2 -translate-y-1/2 pointer-events-none scale-[0.45] xs:scale-[0.52] sm:scale-[0.72] md:scale-80 lg:scale-[1.05] xl:scale-[1.2] origin-right">
                <svg
                  width="160"
                  height="130"
                  viewBox="0 0 160 130"
                  fill="none"
                  className="overflow-visible"
                >
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

          {/* Main Typography Header (Exact Image 2 layout) */}
          <div className="relative z-10 max-w-[65%] sm:max-w-[62%] my-auto">
            <h2
              style={themeConfig.titleStyle}
              className={`text-sm xs:text-base sm:text-xl md:text-2xl lg:text-3xl xl:text-4xl font-black uppercase tracking-tight leading-none ${themeConfig.titleColor}`}
            >
              {titleInfo.line1}
            </h2>

            {/* Subtitle / Second Line */}
            {titleInfo.line2 && (
              <div className="mt-0.5 sm:mt-1 lg:mt-1.5">
                <span
                  style={themeConfig.titleStyle}
                  className={`text-sm xs:text-base sm:text-xl md:text-2xl lg:text-3xl xl:text-4xl font-black uppercase tracking-tight leading-none block ${themeConfig.titleColor}`}
                >
                  {titleInfo.line2}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Bottom Dark Information Strip ── */}
        <div
          style={themeConfig.bottomBarStyle}
          className="relative z-10 px-2 sm:px-3.5 lg:px-6 py-1 sm:py-1.5 lg:py-2.5 flex items-center overflow-hidden border-t border-black/10"
        >
          <div className="font-mono text-[7px] xs:text-[8px] sm:text-[9.5px] md:text-[10px] lg:text-[12px] xl:text-[13px] font-bold tracking-tight sm:tracking-wider text-[#D0D0D1] uppercase whitespace-nowrap overflow-x-auto scrollbar-none w-full flex items-center gap-1 sm:gap-1.5 lg:gap-2.5">
            <span>{meta.dateStr}</span>
            <span className="text-[#9B9EA4]">•</span>
            <span>{meta.timeStr}</span>
            <span className="text-[#9B9EA4]">•</span>
            <span className="truncate max-w-[85px] sm:max-w-none">{meta.venueStr}</span>
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

      {/* ── PERFORATION DIVIDER & NOTCHES ── */}
      <div className="relative w-0 flex items-center justify-center">
        {/* Dashed Vertical Line */}
        <div
          className={`absolute inset-y-0 w-0 border-r sm:border-r-[1.5px] lg:border-r-2 border-dashed ${themeConfig.perforationBorder} z-20`}
        />
        {/* Top Notch Cutout */}
        <div
          className="ticket-notch absolute -top-2 sm:-top-2.5 lg:-top-3.5 -left-2 sm:-left-2.5 lg:-left-3.5 w-4 h-4 sm:w-5 sm:h-5 lg:w-7 lg:h-7 rounded-full bg-[#131517] [html.light_&]:bg-[#F7F5EE] z-30 pointer-events-none"
          style={notchBg ? { backgroundColor: notchBg } : undefined}
        />
        {/* Bottom Notch Cutout */}
        <div
          className="ticket-notch absolute -bottom-2 sm:-bottom-2.5 lg:-bottom-3.5 -left-2 sm:-left-2.5 lg:-left-3.5 w-4 h-4 sm:w-5 sm:h-5 lg:w-7 lg:h-7 rounded-full bg-[#131517] [html.light_&]:bg-[#F7F5EE] z-30 pointer-events-none"
          style={notchBg ? { backgroundColor: notchBg } : undefined}
        />
      </div>

      {/* ══════════════════════════════════════════════════
          RIGHT SECTION: STUB (Exact Image 2 Clean Layout)
          ══════════════════════════════════════════════════ */}
      <div
        style={themeConfig.stubBgStyle}
        className="relative w-[84px] xs:w-[94px] sm:w-[118px] md:w-[132px] lg:w-[170px] xl:w-[195px] shrink-0 p-1.5 sm:p-2 lg:p-3.5 flex flex-col items-center justify-between text-center overflow-hidden"
      >
        {/* Stub Header: "SCAN AT ENTRY" or "PENDING APPROVAL" */}
        <div className="w-full text-center mb-0.5 lg:mb-1">
          <span
            className={`text-[7.5px] xs:text-[8.5px] sm:text-[10px] lg:text-[13px] xl:text-[14px] font-black tracking-widest uppercase block ${
              isPending ? "text-amber-400" : themeConfig.scanColor
            }`}
          >
            {isPending ? "PENDING APPROVAL" : (ticket?.entryLabel || "SCAN AT ENTRY")}
          </span>
        </div>

        {/* QR Code Container with High-Contrast White Background (Click to Enlarge/Scan) */}
        <div
          onClick={(e) => {
            if (typeof onQrClick === "function") {
              e.stopPropagation();
              onQrClick(ticket);
            }
          }}
          title={onQrClick ? (isPending ? "Pending organiser approval" : "Click to scan and check in") : undefined}
          className={`relative p-0.5 sm:p-1 lg:p-1.5 bg-white rounded-md sm:rounded-lg lg:rounded-xl shadow-md flex items-center justify-center my-0.5 lg:my-1 transition-all ${
            onQrClick ? "cursor-pointer hover:scale-105 active:scale-95" : ""
          } ${isPending ? "opacity-85" : ""}`}
        >
          {ticket?.qrCode && !ticket.qrCode.includes("<svg") && !ticket.qrCode.includes("TICKETLELO") ? (
            <img
              src={ticket.qrCode}
              alt="QR Code"
              className="w-12 h-12 xs:w-14 xs:h-14 sm:w-[70px] sm:h-[70px] md:w-[76px] md:h-[76px] lg:w-[96px] lg:h-[96px] xl:w-[112px] xl:h-[112px] object-contain"
            />
          ) : (
            <div className="w-12 h-12 xs:w-14 xs:h-14 sm:w-[70px] sm:h-[70px] md:w-[76px] md:h-[76px] lg:w-[96px] lg:h-[96px] xl:w-[112px] xl:h-[112px] bg-white flex items-center justify-center">
              <svg viewBox="0 0 33 33" className="w-full h-full fill-black">
                <rect x="2" y="2" width="9" height="9" fill="#000" />
                <rect x="4" y="4" width="5" height="5" fill="#fff" />
                <rect x="5.5" y="5.5" width="2" height="2" fill="#000" />
                <rect x="22" y="2" width="9" height="9" fill="#000" />
                <rect x="24" y="4" width="5" height="5" fill="#fff" />
                <rect x="25.5" y="5.5" width="2" height="2" fill="#000" />
                <rect x="2" y="22" width="9" height="9" fill="#000" />
                <rect x="4" y="24" width="5" height="5" fill="#fff" />
                <rect x="5.5" y="25.5" width="2" height="2" fill="#000" />
                <rect x="14" y="3" width="2" height="2" />
                <rect x="18" y="5" width="2" height="3" />
                <rect x="14" y="8" width="3" height="2" />
                <rect x="13" y="14" width="7" height="6" />
                <rect x="15" y="16" width="3" height="2" fill="#fff" />
                <rect x="3" y="14" width="3" height="2" />
                <rect x="8" y="16" width="2" height="4" />
                <rect x="23" y="14" width="3" height="3" />
                <rect x="27" y="15" width="4" height="2" />
                <rect x="24" y="23" width="3" height="3" />
                <rect x="28" y="22" width="3" height="4" />
                <rect x="14" y="24" width="4" height="2" />
                <rect x="16" y="27" width="2" height="4" />
              </svg>
            </div>
          )}

          {/* Pending Stamp overlay */}
          {isPending && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/35 rounded-md sm:rounded-lg lg:rounded-xl backdrop-blur-[1px]">
              <div className="transform -rotate-12 border border-amber-400 bg-amber-500/90 text-[#131517] font-mono font-black text-[6.5px] xs:text-[7.5px] sm:text-[9px] px-1 py-0.5 rounded shadow uppercase tracking-wider">
                PENDING
              </div>
            </div>
          )}
        </div>

        {/* Ticket ID & Attendee (Exact Image 2) */}
        <div className="w-full text-center mt-0.5 lg:mt-1 space-y-0.5">
          <p
            className={`font-mono font-bold text-[6.5px] xs:text-[7.5px] sm:text-[8.5px] md:text-[9px] lg:text-xs xl:text-sm tracking-tight truncate ${themeConfig.ticketIdColor}`}
          >
            {ticketId}
          </p>
          <p className="text-[6px] xs:text-[7px] sm:text-[8px] md:text-[8.5px] lg:text-[10.5px] xl:text-xs text-[#D0D0D1] font-medium truncate max-w-[75px] xs:max-w-[85px] sm:max-w-[110px] lg:max-w-[150px] mx-auto">
            {attendeeName}
          </p>
        </div>
      </div>
    </div>
  );
}
