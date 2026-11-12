"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  Download,
  Ticket,
  Eye,
} from "lucide-react";
import QRCodeLib from "qrcode";
import { TicketGraphic } from "./ticket-graphic";
import { QrCheckinModal } from "./qr-checkin-modal";
import { TicketFullPreviewModal } from "./ticket-full-preview-modal";
import { toast } from "sonner";
import { CANONICAL_TICKETS } from "@/lib/canonical-tickets";
import { formatTicketDate } from "@/lib/date-utils";

export { CANONICAL_TICKETS };

export const CANONICAL_VISUAL_ORDER = [
  "praroha-gaming",
  "open-mic-night",
  "robotics-expo",
  "tech-fest-2026",
];

export function TicketDeckView({
  initialTickets = [],
  onBack,
  standalone = false,
  showStackOnly = false,
  compact = false,
}) {
  const effectiveTickets =
    Array.isArray(initialTickets) && initialTickets.length > 0
      ? initialTickets
      : CANONICAL_TICKETS;

  const [reorderedIds, setReorderedIds] = useState(null);
  const defaultOrder = React.useMemo(
    () => (effectiveTickets || []).map((t) => t.id),
    [effectiveTickets]
  );
  // ticketsOrder maintains the stacking from back (index 0) to front (last index)
  const ticketsOrder = reorderedIds || defaultOrder;

  // Track active QR modal for checkin
  const [selectedQrTicket, setSelectedQrTicket] = useState(null);
  const [showFullModal, setShowFullModal] = useState(false);

  // Generous vertical spacing tuned for both mobile and desktop (Image 2)
  const [spacing, setSpacing] = useState(compact ? 24 : 90);

  useEffect(() => {
    function updateSpacing() {
      if (typeof window === "undefined") return;
      if (compact) {
        setSpacing(window.innerWidth < 480 ? 20 : window.innerWidth < 768 ? 22 : 24);
        return;
      }
      if (window.innerWidth < 360) {
        setSpacing(92);
      } else if (window.innerWidth < 480) {
        setSpacing(102);
      } else if (window.innerWidth < 768) {
        setSpacing(114);
      } else if (window.innerWidth < 1024) {
        setSpacing(130);
      } else if (window.innerWidth < 1440) {
        setSpacing(152);
      } else {
        setSpacing(170);
      }
    }
    updateSpacing();
    window.addEventListener("resize", updateSpacing);
    return () => window.removeEventListener("resize", updateSpacing);
  }, [compact]);

  // Active ticket is the front-most ticket
  const activeTicketId =
    ticketsOrder[ticketsOrder.length - 1] ||
    effectiveTickets[effectiveTickets.length - 1]?.id;

  // Track if we are in Detail View (inspection view)
  const [isDetailView, setIsDetailView] = useState(false);

  // Track which ticket is actively performing the vertical lift animation
  const [animatingTicketId, setAnimatingTicketId] = useState(null);

  // Cache generated QR codes
  const [qrMap, setQrMap] = useState({});

  useEffect(() => {
    let isMounted = true;
    async function generateMissingQrs() {
      const missing = effectiveTickets.filter(
        (t) =>
          !t.qrCode ||
          typeof t.qrCode !== "string" ||
          t.qrCode.includes("<svg") ||
          t.qrCode.includes("TICKETLELO")
      );
      if (missing.length === 0) return;

      const generated = {};
      await Promise.all(
        missing.map(async (t) => {
          try {
            const qr = await QRCodeLib.toDataURL(t.ticketId || t.id, {
              margin: 1,
              width: 240,
              color: { dark: "#000000", light: "#FFFFFF" },
            });
            generated[t.id] = qr;
          } catch {
            // ignore
          }
        })
      );
      if (isMounted && Object.keys(generated).length > 0) {
        setQrMap((prev) => ({ ...prev, ...generated }));
      }
    }
    generateMissingQrs();
    return () => {
      isMounted = false;
    };
  }, [effectiveTickets]);

  const ticketsWithQr = React.useMemo(() => {
    return effectiveTickets.map((t) =>
      qrMap[t.id] ? { ...t, qrCode: qrMap[t.id] } : t
    );
  }, [effectiveTickets, qrMap]);

  // Handle clicking on any ticket in the stack to bring it forward with spring animation
  const handleTicketClick = useCallback(
    (ticketId) => {
      if (isDetailView) return;

      const isAlreadyFront = ticketId === activeTicketId;
      setAnimatingTicketId(ticketId);

      if (!isAlreadyFront) {
        setTimeout(() => {
          setReorderedIds((prev) => {
            const current = prev || defaultOrder;
            const remaining = current.filter((id) => id !== ticketId);
            return [...remaining, ticketId];
          });
        }, 130);
      } else {
        if (showStackOnly) {
          setShowFullModal(true);
        } else {
          setIsDetailView(true);
        }
      }

      setTimeout(() => {
        setAnimatingTicketId(null);
      }, 500);
    },
    [activeTicketId, isDetailView, defaultOrder, showStackOnly]
  );

  // Handle back button
  const handleBackClick = () => {
    if (isDetailView) {
      setIsDetailView(false);
    } else if (typeof onBack === "function") {
      onBack();
    } else if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
    }
  };

  const activeTicket =
    ticketsWithQr.find((t) => t.id === activeTicketId) ||
    ticketsWithQr[ticketsWithQr.length - 1] ||
    effectiveTickets[0];

  // Stack offsets for tilted layout
  // Index 0 sits at the top, index (total-1) sits at the bottom in front
  const getStackPosition = (ticketId) => {
    const canonIdx = CANONICAL_VISUAL_ORDER.indexOf(ticketId);
    const originalIndex = effectiveTickets.findIndex((t) => t.id === ticketId);
    const posIndex = canonIdx >= 0 ? canonIdx : originalIndex >= 0 ? originalIndex : 0;
    const total = effectiveTickets.length || 1;

    // Centered vertical baseline spacing
    const baseY = (posIndex - (total - 1) / 2) * spacing;

    // Lower index (e.g. 0) sits at top, higher index (e.g. 3) sits in front
    // When clicked/promoted, the active ticket gets highest zIndex
    const stackRank = ticketsOrder.indexOf(ticketId);
    const isFront = ticketId === activeTicketId;
    const zIndex = isFront ? 50 : 10 + (stackRank >= 0 ? stackRank : posIndex);

    return {
      baseY,
      zIndex,
      posIndex,
    };
  };

  const handleDownloadPdf = () => {
    if (!activeTicket?.ticketId) return;
    const downloadUrl = `/api/generate-ticket/${activeTicket.ticketId}`;
    window.open(downloadUrl, "_blank");
    toast.success("Downloading verified PDF pass...");
  };

  const stackHeight = compact
    ? Math.max(260, (ticketsWithQr.length - 1) * spacing + 220)
    : Math.max(
        400,
        (ticketsWithQr.length - 1) * spacing + (spacing >= 110 ? 320 : 220)
      );

  return (
    <div
      className={`relative w-full mx-auto flex flex-col justify-between select-none transition-all duration-300 ${
        compact
          ? "max-w-[420px] py-1 px-1 overflow-hidden"
          : showStackOnly
          ? "max-w-[540px] sm:max-w-[640px] md:max-w-[760px] lg:max-w-[960px] xl:max-w-[1120px] py-1 px-1 overflow-visible"
          : standalone
          ? "min-h-screen max-w-[540px] sm:max-w-[640px] md:max-w-[760px] lg:max-w-[960px] xl:max-w-[1120px] py-4 px-3 lg:py-8 lg:px-6"
          : "max-w-[540px] sm:max-w-[640px] md:max-w-[760px] lg:max-w-[960px] xl:max-w-[1120px] py-2 px-2 sm:px-3 lg:py-4 lg:px-6"
      }`}
    >
      {/* Ambient Subtle Warm Glow (Desktop enhanced) */}
      {!showStackOnly && (
        <div className="absolute -top-16 -right-16 lg:-top-24 lg:-right-24 w-72 h-72 lg:w-[480px] lg:h-[480px] rounded-full bg-[#FE760B]/10 blur-3xl pointer-events-none" />
      )}

      {/* ── TOP HEADER (Clean Alignment Across Mobile & Desktop) ── */}
      {!showStackOnly && (
        <header className="relative z-40 flex items-center justify-between gap-3 mb-2 sm:mb-3 lg:mb-6">
          <div className="flex items-center gap-3 lg:gap-4">
            {/* Circular White Back Button */}
            <button
              onClick={handleBackClick}
              aria-label="Back"
              className="w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-white text-black shadow-md flex items-center justify-center hover:scale-105 active:scale-95 transition-all shrink-0 cursor-pointer border-none"
            >
              <ChevronLeft className="w-5 h-5 lg:w-6 lg:h-6 text-black stroke-[2.5]" />
            </button>

            {/* Title & Count */}
            <div className="flex flex-col">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-[#061A3F] dark:text-white leading-tight">
                My tickets
              </h1>
              <AnimatePresence mode="wait">
                <motion.p
                  key={isDetailView ? activeTicket?.title : "count"}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.18 }}
                  className="text-xs sm:text-sm lg:text-base text-[#4A566F] dark:text-[#9B9EA4] font-medium"
                >
                  {isDetailView ? activeTicket?.title : `${ticketsWithQr.length} tickets`}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>
        </header>
      )}

      {/* ── MAIN CONTENT AREA ── */}
      <main className="relative flex-1 flex flex-col justify-center py-1 overflow-visible">
        {!isDetailView ? (
          /* ══════════════════════════════════════════════════
              VIEW 1: TILTED STACK DECK (Fanned out, 100% Readable)
              ══════════════════════════════════════════════════ */
          ticketsWithQr.length === 0 ? (
            <div className="text-center p-8 my-auto">
              <Ticket className="w-8 h-8 text-[#FE760B] mx-auto mb-2" />
              <p className="text-sm font-semibold text-[#061A3F] dark:text-white">No passes found</p>
            </div>
          ) : (
            <div
              className="relative w-full flex items-center justify-center overflow-visible my-auto"
              style={{ minHeight: `${stackHeight}px`, height: `${stackHeight}px` }}
            >
              {ticketsWithQr.map((ticket) => {
                const { baseY, zIndex } = getStackPosition(ticket.id);
                const isAnimating = animatingTicketId === ticket.id;
                const isFront = ticket.id === activeTicketId;

                return (
                  <motion.div
                    key={ticket.id}
                    layout
                    initial={false}
                    onClick={() => handleTicketClick(ticket.id)}
                    className="absolute cursor-pointer touch-manipulation origin-center"
                    style={{
                      zIndex: isAnimating ? 60 : zIndex,
                    }}
                    animate={{
                      // Tilted at -22deg matching layout
                      rotate: -22,
                      y: isAnimating
                        ? baseY - (compact ? 32 : (spacing >= 110 ? 75 : 55))
                        : baseY,
                      x: 0,
                      scale: isAnimating ? 1.04 : isFront ? 1.02 : 1,
                    }}
                    whileHover={{
                      scale: isFront ? 1.03 : 1.02,
                      y: isAnimating
                        ? baseY - (compact ? 32 : (spacing >= 110 ? 75 : 55))
                        : baseY - (compact ? 6 : (spacing >= 110 ? 12 : 8)),
                      transition: { duration: 0.16 },
                    }}
                    whileTap={{ scale: 0.98 }}
                    transition={{
                      type: "spring",
                      stiffness: 340,
                      damping: 24,
                      mass: 0.8,
                    }}
                  >
                    <TicketGraphic
                      ticket={ticket}
                      horizontal={false}
                      compact={compact}
                      onQrClick={(t) => setSelectedQrTicket(t)}
                    />
                  </motion.div>
                );
              })}
            </div>
          )
        ) : (
          /* ══════════════════════════════════════════════════
              VIEW 2: HORIZONTAL DETAIL INSPECTION VIEW
              ══════════════════════════════════════════════════ */
          activeTicket && (
            <div className="relative w-full flex-1 flex flex-col items-center justify-center py-2">
              {/* Horizontal Ticket (0deg tilt, centered - Click to view full length) */}
              <motion.div
                layoutId={`ticket-card-${activeTicket.id}`}
                initial={{ rotate: -22, scale: 0.94, opacity: 0 }}
                animate={{ rotate: 0, scale: 1, opacity: 1 }}
                exit={{ rotate: -22, opacity: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 320,
                  damping: 26,
                }}
                onClick={() => setShowFullModal(true)}
                className="my-3 flex justify-center w-full cursor-pointer hover:scale-[1.01] transition-transform"
                title="Click to view full length ticket"
              >
                <TicketGraphic
                  ticket={activeTicket}
                  horizontal={true}
                  onQrClick={(t) => setSelectedQrTicket(t)}
                />
              </motion.div>

              {/* Ticket Details Card */}
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 16 }}
                transition={{ duration: 0.26, ease: "easeOut" }}
                className="w-full max-w-[450px] md:max-w-[540px] lg:max-w-[680px] xl:max-w-[780px] bg-white dark:bg-[#1A1C1F] border border-[#D9DBE0] dark:border-[#2A2D31] rounded-2xl lg:rounded-3xl p-5 sm:p-6 lg:p-7 shadow-xl mt-3 text-left"
              >
                {/* Event Title */}
                <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-[#061A3F] dark:text-white mb-3 lg:mb-4 tracking-tight truncate">
                  {activeTicket.title}
                </h2>

                {/* 2-Column Key-Value Grid */}
                <div className="grid grid-cols-2 gap-y-3 lg:gap-y-4 gap-x-5 lg:gap-x-8 text-xs sm:text-sm lg:text-base">
                  <div>
                    <p className="text-[10.5px] sm:text-xs lg:text-[13px] text-[#4A566F] dark:text-[#9B9EA4] font-semibold uppercase tracking-wider mb-0.5">Date</p>
                    <p className="font-bold text-[#061A3F] dark:text-white">{formatTicketDate(activeTicket.date)}</p>
                  </div>
                  <div>
                    <p className="text-[10.5px] sm:text-xs lg:text-[13px] text-[#4A566F] dark:text-[#9B9EA4] font-semibold uppercase tracking-wider mb-0.5">Time</p>
                    <p className="font-bold text-[#061A3F] dark:text-white">{typeof activeTicket.time === "string" ? activeTicket.time : "12:00 PM"}</p>
                  </div>
                  <div>
                    <p className="text-[10.5px] sm:text-xs lg:text-[13px] text-[#4A566F] dark:text-[#9B9EA4] font-semibold uppercase tracking-wider mb-0.5">Venue</p>
                    <p className="font-bold text-[#061A3F] dark:text-white truncate">{typeof activeTicket.venue === "string" ? activeTicket.venue : "MAIN AUDITORIUM"}</p>
                  </div>
                  <div>
                    <p className="text-[10.5px] sm:text-xs lg:text-[13px] text-[#4A566F] dark:text-[#9B9EA4] font-semibold uppercase tracking-wider mb-0.5">Ticket Tier</p>
                    <p className="font-bold text-[#061A3F] dark:text-white truncate">{typeof activeTicket.ticketType === "string" ? activeTicket.ticketType : "GENERAL PASS"}</p>
                  </div>
                  <div>
                    <p className="text-[10.5px] sm:text-xs lg:text-[13px] text-[#4A566F] dark:text-[#9B9EA4] font-semibold uppercase tracking-wider mb-0.5">Guest</p>
                    <p className="font-bold text-[#061A3F] dark:text-white truncate">{typeof activeTicket.guest === "string" ? activeTicket.guest : "Adil M"}</p>
                  </div>
                  <div>
                    <p className="text-[10.5px] sm:text-xs lg:text-[13px] text-[#4A566F] dark:text-[#9B9EA4] font-semibold uppercase tracking-wider mb-0.5">Ticket ID</p>
                    <p className="font-mono font-bold text-[#FE760B] tracking-tight truncate">
                      {typeof activeTicket.ticketId === "string" ? activeTicket.ticketId : `TKT-${activeTicket.id || "001"}`}
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="mt-5 lg:mt-6 pt-4 lg:pt-5 border-t border-[#D9DBE0] dark:border-[#2A2D31] flex flex-col sm:flex-row gap-2.5">
                  <button
                    onClick={() => setShowFullModal(true)}
                    className="flex-1 bg-[#FE760B] hover:bg-[#FF8A2B] text-white font-bold text-xs sm:text-sm lg:text-base py-2.5 sm:py-3 lg:py-3.5 px-3.5 sm:px-4 lg:px-5 rounded-xl lg:rounded-2xl flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-md"
                  >
                    <Eye className="w-3.5 h-3.5 lg:w-4 lg:h-4" /> View Ticket
                  </button>
                  <button
                    onClick={handleDownloadPdf}
                    className="flex-1 bg-slate-100 dark:bg-[#212327] hover:bg-slate-200 dark:hover:bg-[#2A2D31] text-slate-800 dark:text-white font-bold text-xs sm:text-sm lg:text-base py-2.5 sm:py-3 lg:py-3.5 px-3.5 sm:px-4 lg:px-5 rounded-xl lg:rounded-2xl flex items-center justify-center gap-2 transition-colors cursor-pointer border border-slate-200 dark:border-[#2A2D31]"
                  >
                    <Download className="w-3.5 h-3.5 lg:w-4 lg:h-4" /> Download PDF Ticket
                  </button>
                </div>
              </motion.div>
            </div>
          )
        )}
      </main>

      {/* Full Length Ticket Preview Modal */}
      <TicketFullPreviewModal
        isOpen={showFullModal}
        onClose={() => setShowFullModal(false)}
        ticket={activeTicket}
        event={{
          name: activeTicket?.title || activeTicket?.name,
          title: activeTicket?.title || activeTicket?.name,
          date: activeTicket?.date,
          time: activeTicket?.time,
          venue: activeTicket?.venue,
          theme: activeTicket?.theme,
          price: activeTicket?.price,
          ticketDesign: activeTicket?.ticketDesign || "stub",
        }}
        design={activeTicket?.ticketDesign || "stub"}
      />

      {/* Enlarged QR Modal & Tactile Check-In Perforation Tear */}
      <QrCheckinModal
        isOpen={Boolean(selectedQrTicket)}
        onClose={() => setSelectedQrTicket(null)}
        ticket={selectedQrTicket}
        onCheckIn={(ticketId) => {
          toast.success("Ticket pass admitted and checked in!");
        }}
      />
    </div>
  );
}
