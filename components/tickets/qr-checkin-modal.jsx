"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  CheckCircle2,
  QrCode as QrCodeIcon,
  Calendar,
  MapPin,
  Clock,
  ShieldCheck,
  Check,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { formatTicketDate } from "@/lib/date-utils";

// Web Audio synthesizer for tactile perforation tear & check-in stamp
function playTearAndStampSound() {
  try {
    if (typeof window === "undefined") return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    // 1. Paper tear sound (filtered pink noise burst)
    const bufferSize = Math.floor(ctx.sampleRate * 0.18);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const decay = Math.exp(-i / (bufferSize * 0.3));
      data[i] = (Math.random() * 2 - 1) * decay;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1800, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.16);
    filter.Q.value = 1.8;

    noise.connect(filter);
    filter.connect(ctx.destination);
    noise.start(ctx.currentTime);

    // 2. Rubber stamp thud sound (low frequency thump 120ms later)
    setTimeout(() => {
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(140, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(45, ctx.currentTime + 0.12);

        gain.gain.setValueAtTime(0.5, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.12);
      } catch {}
    }, 110);

    if (navigator.vibrate) {
      navigator.vibrate([25, 40, 35]);
    }
  } catch {}
}

export function QrCheckinModal({
  isOpen,
  onClose,
  ticket,
  onCheckIn,
}) {
  const isAlreadyUsed =
    ticket?.status === "Used" ||
    ticket?.status === "used" ||
    ticket?.checkedIn === true;

  const isPending =
    ticket?.status === "pending" ||
    ticket?.status === "Pending Approval" ||
    ticket?.approvalStatus === "pending" ||
    ticket?.isPending === true;

  const [isTorn, setIsTorn] = useState(isAlreadyUsed);
  const [isCheckedIn, setIsCheckedIn] = useState(isAlreadyUsed);
  const [isScanning, setIsScanning] = useState(false);
  const [checkinTimestamp, setCheckinTimestamp] = useState(
    isAlreadyUsed ? "Verified Earlier" : null
  );

  if (!isOpen || !ticket) return null;

  const handleScanAndCheckin = async () => {
    if (isPending) {
      toast.info("Registration pending organiser approval. Access will unlock once approved.");
      return;
    }
    if (isCheckedIn) return;
    setIsScanning(true);

    // Simulate snappy laser/scanner beam for 650ms
    setTimeout(() => {
      playTearAndStampSound();
      setIsScanning(false);
      setIsTorn(true);
      setIsCheckedIn(true);
      const timeStr = new Date().toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
      setCheckinTimestamp(timeStr);
      toast.success("Pass verified & checked in successfully!");

      if (typeof onCheckIn === "function") {
        onCheckIn(ticket.ticketId || ticket.id);
      }
    }, 700);
  };

  const handleResetCheckin = () => {
    setIsTorn(false);
    setIsCheckedIn(false);
    setCheckinTimestamp(null);
  };

  const rawQr = ticket.qrCode;
  const hasValidQrImg =
    rawQr &&
    typeof rawQr === "string" &&
    !rawQr.includes("<svg") &&
    !rawQr.includes("TICKETLELO") &&
    (rawQr.startsWith("data:image/") || rawQr.startsWith("http"));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div
        className="relative w-full max-w-lg bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-[#2A2D31]/80 bg-[#131517]/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#FE760B]/15 border border-[#FE760B]/30 flex items-center justify-center text-[#FE760B]">
              <QrCodeIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                Gate Pass QR Verification
              </h3>
              <p className="text-[11px] text-[#9B9EA4]">
                {isCheckedIn ? "Pass Checked In & Verified" : "Scan QR code for admission"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-[#212327] hover:bg-[#2A2D31] text-[#9B9EA4] hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-[#2A2D31]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body: Ticket Pass with Tear Effect */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          {/* Main Visual Ticket Card */}
          <div className="relative bg-[#212327] border border-[#2A2D31] rounded-2xl p-4 sm:p-5 shadow-lg overflow-hidden">
            {/* Ambient Warm Gradient */}
            <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-[#FE760B]/10 blur-2xl pointer-events-none" />

            {/* Event Header Info */}
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="min-w-0">
                <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-[#FE760B]/15 text-[#FE760B] border border-[#FE760B]/30 mb-1.5">
                  {ticket.ticketType || ticket.tier || "OFFICIAL ENTRY PASS"}
                </span>
                <h4 className="text-base sm:text-lg font-black text-white uppercase tracking-tight truncate">
                  {ticket.title || ticket.name || "Event Pass"}
                </h4>
              </div>

              {/* Status Pill */}
              <div
                className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 shrink-0 ${
                  isCheckedIn
                    ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                    : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isCheckedIn ? "bg-rose-500" : "bg-emerald-500 animate-pulse"
                  }`}
                />
                <span>{isCheckedIn ? "Checked In" : "Valid Pass"}</span>
              </div>
            </div>

            {/* The Tearable Ticket Stub Area */}
            <div className="relative flex flex-col items-center justify-center py-2">
              <motion.div
                layout
                animate={{
                  x: isTorn ? 14 : 0,
                  y: isTorn ? 6 : 0,
                  rotate: isTorn ? 3.5 : 0,
                  scale: isTorn ? 0.98 : 1,
                }}
                transition={{ type: "spring", stiffness: 360, damping: 22 }}
                className={`relative bg-white rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col items-center justify-center border-2 transition-all ${
                  isTorn
                    ? "border-rose-500/60 ring-2 ring-rose-500/20 shadow-rose-950/40"
                    : "border-slate-200"
                }`}
                style={{ width: "240px", minHeight: "240px" }}
              >
                {/* Laser Scanning Line Animation */}
                {isScanning && (
                  <motion.div
                    initial={{ top: "4%" }}
                    animate={{ top: "92%" }}
                    transition={{
                      repeat: Infinity,
                      repeatType: "reverse",
                      duration: 0.65,
                      ease: "easeInOut",
                    }}
                    className="absolute inset-x-3 h-1 bg-gradient-to-r from-transparent via-[#FE760B] to-transparent rounded shadow-[0_0_12px_#FE760B] z-30 pointer-events-none"
                  />
                )}

                {/* Perforation Indicator Top & Bottom Notches */}
                <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#212327] border border-[#2A2D31] z-10" />

                {/* Dashed Tear Line */}
                {isTorn && (
                  <div className="absolute left-0 inset-y-0 w-0 border-l-2 border-dashed border-rose-500/80 z-20" />
                )}

                {/* Enlarged Crisp QR Code */}
                <div className="relative w-44 h-44 sm:w-48 sm:h-48 flex items-center justify-center bg-white rounded-xl">
                  {hasValidQrImg ? (
                    <img
                      src={rawQr}
                      alt="Ticket Pass QR Code"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-800">
                      <QrCodeIcon className="w-28 h-28 text-slate-900" />
                      <span className="text-[10px] font-mono font-bold text-slate-600 mt-1">
                        {ticket.ticketId || "TKT-VERIFIED"}
                      </span>
                    </div>
                  )}

                  {/* Tactile CHECKED IN Rubber Stamp Overlay */}
                  <AnimatePresence>
                    {isCheckedIn && (
                      <motion.div
                        initial={{ scale: 2.2, opacity: 0, rotate: -30 }}
                        animate={{ scale: 1, opacity: 1, rotate: -12 }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        transition={{
                          type: "spring",
                          stiffness: 450,
                          damping: 18,
                          mass: 0.9,
                        }}
                        className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-30"
                      >
                        <div className="border-4 border-rose-600 bg-rose-600/95 text-white font-mono font-black text-sm sm:text-base px-3.5 py-1.5 rounded-lg shadow-2xl uppercase tracking-widest backdrop-blur-sm flex items-center gap-1.5">
                          <Check className="w-5 h-5 stroke-[3]" />
                          <span>CHECKED IN</span>
                        </div>
                        {checkinTimestamp && (
                          <span className="text-[10px] font-mono font-bold text-rose-700 bg-white/90 px-2 py-0.5 rounded shadow mt-1">
                            {checkinTimestamp}
                          </span>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* JetBrains Mono Ticket ID Code */}
                <div className="mt-3 text-center">
                  <p className="font-mono font-black text-xs sm:text-sm text-slate-900 tracking-wider">
                    {ticket.ticketId || ticket.id || "TKT-PASS-001"}
                  </p>
                  <p className="text-[11px] font-semibold text-slate-500 mt-0.5 truncate max-w-[200px]">
                    {ticket.guest || ticket.attendeeName || "Attendee Pass"}
                  </p>
                </div>
              </motion.div>
            </div>

            {/* Event Quick Details */}
            <div className="grid grid-cols-2 gap-2 text-xs pt-4 border-t border-[#2A2D31]/80 mt-2">
              <div className="flex items-center gap-1.5 text-[#D0D0D1]">
                <Calendar className="w-3.5 h-3.5 text-[#FE760B] shrink-0" />
                <span className="truncate">{formatTicketDate(ticket.date)}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[#D0D0D1]">
                <Clock className="w-3.5 h-3.5 text-[#FE760B] shrink-0" />
                <span className="truncate">{ticket.time || "12:00 PM"}</span>
              </div>
              <div className="col-span-2 flex items-center gap-1.5 text-[#D0D0D1]">
                <MapPin className="w-3.5 h-3.5 text-[#FE760B] shrink-0" />
                <span className="truncate">{ticket.venue || ticket.location || "Main Auditorium"}</span>
              </div>
            </div>
          </div>

          {/* Action Button: Scan to Check In or Verified message */}
          <div className="space-y-2.5">
            {isPending ? (
              <div className="w-full h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold text-xs sm:text-sm flex items-center justify-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>Pending Organiser Approval</span>
              </div>
            ) : !isCheckedIn ? (
              <button
                onClick={handleScanAndCheckin}
                disabled={isScanning}
                className="w-full h-12 rounded-xl bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.99] cursor-pointer disabled:opacity-75"
              >
                {isScanning ? (
                  <>
                    <div className="w-4 h-4 border-2 border-[#131517] border-t-transparent rounded-full animate-spin" />
                    <span>Scanning & Verifying Pass...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Simulate Gate Scan & Tear Pass</span>
                  </>
                )}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex-1 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold text-xs sm:text-sm flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Verified & Admitted at Entry Gate</span>
                </div>
                <button
                  onClick={handleResetCheckin}
                  title="Reset status for testing"
                  className="h-12 px-3 rounded-xl bg-[#212327] hover:bg-[#2A2D31] text-[#9B9EA4] hover:text-white border border-[#2A2D31] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Reset</span>
                </button>
              </div>
            )}

            <p className="text-[11px] text-center text-[#9B9EA4]">
              {isPending
                ? "This ticket is awaiting organiser review. Access will unlock upon approval."
                : isCheckedIn
                ? "This ticket has been officially redeemed and perforated for entry."
                : "Organisers can scan this high-resolution QR with their scanner camera at entry."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
