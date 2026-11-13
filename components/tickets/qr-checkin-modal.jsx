"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  CheckCircle2,
  QrCode as QrCodeIcon,
  Calendar,
  MapPin,
  Clock,
  Check,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { formatTicketDate } from "@/lib/date-utils";
import { formatTicketId } from "@/lib/ticket-id";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, collection, query, where } from "firebase/firestore";

export function QrCheckinModal({
  isOpen,
  onClose,
  ticket,
  onCheckIn,
}) {
  const [mounted, setMounted] = useState(false);

  const isAlreadyUsed =
    ticket?.status === "Used" ||
    ticket?.status === "used" ||
    ticket?.checkedIn === true;

  const isPending =
    ticket?.status === "pending" ||
    ticket?.status === "Pending Approval" ||
    ticket?.approvalStatus === "pending" ||
    ticket?.isPending === true;

  const [isCheckedIn, setIsCheckedIn] = useState(isAlreadyUsed);
  const [checkinTimestamp, setCheckinTimestamp] = useState(
    isAlreadyUsed ? "Verified" : null
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  // Synchronize state when ticket prop changes
  useEffect(() => {
    if (ticket) {
      const used =
        ticket.status === "Used" ||
        ticket.status === "used" ||
        ticket.checkedIn === true;
      setIsCheckedIn(used);
      setCheckinTimestamp(used ? "Verified" : null);
    }
  }, [ticket]);

  // Real-Time Firestore Listener for live gate admission updates
  useEffect(() => {
    if (!isOpen || !ticket) return;

    let unsubscribe = null;
    try {
      const regId = ticket.registrationId || ticket.id;
      const tktCode = ticket.ticketId;

      if (
        db &&
        regId &&
        typeof regId === "string" &&
        !regId.startsWith("canonical-") &&
        !regId.startsWith("tkt-demo")
      ) {
        const docRef = doc(db, "registrations", regId);
        unsubscribe = onSnapshot(
          docRef,
          (snap) => {
            if (snap.exists()) {
              const data = snap.data();
              const used =
                data.status === "Used" ||
                data.status === "used" ||
                data.checkedIn === true ||
                Boolean(data.checkIns && Object.keys(data.checkIns).length > 0);

              if (used) {
                setIsCheckedIn(true);
                let timeStr = "Admitted at Gate";
                const rawTime = data.usedAt || data.checkedInAt;
                if (rawTime?.toDate) {
                  timeStr = rawTime.toDate().toLocaleTimeString("en-IN", {
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                  });
                } else if (typeof rawTime === "string") {
                  timeStr = rawTime;
                }
                setCheckinTimestamp(timeStr);
                if (typeof onCheckIn === "function") {
                  onCheckIn(ticket.ticketId || ticket.id);
                }
              }
            }
          },
          (err) => {
            console.warn("[QrCheckinModal] Realtime registration listener notice:", err.message);
          }
        );
      } else if (db && tktCode && typeof tktCode === "string") {
        const q = query(collection(db, "registrations"), where("ticketId", "==", tktCode));
        unsubscribe = onSnapshot(
          q,
          (snap) => {
            if (!snap.empty) {
              const data = snap.docs[0].data();
              const used =
                data.status === "Used" ||
                data.status === "used" ||
                data.checkedIn === true ||
                Boolean(data.checkIns && Object.keys(data.checkIns).length > 0);

              if (used) {
                setIsCheckedIn(true);
                let timeStr = "Admitted at Gate";
                const rawTime = data.usedAt || data.checkedInAt;
                if (rawTime?.toDate) {
                  timeStr = rawTime.toDate().toLocaleTimeString("en-IN", {
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                  });
                }
                setCheckinTimestamp(timeStr);
                if (typeof onCheckIn === "function") {
                  onCheckIn(ticket.ticketId || ticket.id);
                }
              }
            }
          },
          (err) => {
            console.warn("[QrCheckinModal] Realtime query listener notice:", err.message);
          }
        );
      }
    } catch (err) {
      console.warn("[QrCheckinModal] Realtime listener error:", err);
    }

    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, [isOpen, ticket, onCheckIn]);

  // Lock body scroll and handle Escape key while modal is open
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !ticket || !mounted || typeof document === "undefined") return null;

  const handleDownloadPdf = () => {
    if (!ticket?.ticketId) return;
    window.open(`/api/generate-ticket/${ticket.ticketId}`, "_blank");
    toast.success("Downloading verified PDF pass...");
  };

  const rawQr = ticket.qrCode;
  const hasValidQrImg =
    rawQr &&
    typeof rawQr === "string" &&
    !rawQr.includes("<svg") &&
    !rawQr.includes("TICKETLELO") &&
    (rawQr.startsWith("data:image/") || rawQr.startsWith("http"));

  const modalContent = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Gate Pass QR Verification"
    >
      <div
        className="relative w-full max-w-lg bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-[#2A2D31]/80 bg-[#131517]/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#FE760B]/15 border border-[#FE760B]/30 flex items-center justify-center text-[#FE760B]">
              <QrCodeIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                Gate Pass QR Verification
              </h3>
              <p className="text-[11px] text-[#9B9EA4]">
                {isCheckedIn
                  ? "Pass Checked In & Verified"
                  : isPending
                  ? "Pending Organiser Approval"
                  : "Official entry pass for gate admission"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="w-8 h-8 rounded-xl bg-[#212327] hover:bg-[#2A2D31] text-[#9B9EA4] hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-[#2A2D31]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body: Ticket Pass */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1 overscroll-contain">
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
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : isPending
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isCheckedIn
                      ? "bg-emerald-500"
                      : isPending
                      ? "bg-amber-500"
                      : "bg-emerald-500 animate-pulse"
                  }`}
                />
                <span>
                  {isCheckedIn
                    ? "Checked In"
                    : isPending
                    ? "Pending Approval"
                    : "Valid Pass"}
                </span>
              </div>
            </div>

            {/* Official QR Pass Container */}
            <div className="relative flex flex-col items-center justify-center py-2">
              <div
                className={`relative bg-white rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col items-center justify-center border-2 transition-all ${
                  isCheckedIn
                    ? "border-emerald-500/50 ring-2 ring-emerald-500/20"
                    : "border-slate-200"
                }`}
                style={{ width: "240px", minHeight: "240px" }}
              >
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
                        {formatTicketId(ticket.ticketId || ticket.id || "PASS-0001")}
                      </span>
                    </div>
                  )}

                  {/* Real-Time CHECKED IN Stamp Overlay */}
                  <AnimatePresence>
                    {isCheckedIn && (
                      <motion.div
                        initial={{ scale: 2, opacity: 0, rotate: -25 }}
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
                        <div className="border-4 border-emerald-600 bg-emerald-600/95 text-white font-mono font-black text-sm sm:text-base px-3.5 py-1.5 rounded-lg shadow-2xl uppercase tracking-widest backdrop-blur-sm flex items-center gap-1.5">
                          <Check className="w-5 h-5 stroke-[3]" />
                          <span>CHECKED IN</span>
                        </div>
                        {checkinTimestamp && (
                          <span className="text-[10px] font-mono font-bold text-emerald-800 bg-white/95 px-2 py-0.5 rounded shadow mt-1">
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
                    {formatTicketId(ticket.ticketId || ticket.id || "PASS-0001")}
                  </p>
                  <p className="text-[11px] font-semibold text-slate-500 mt-0.5 truncate max-w-[200px]">
                    {ticket.guest || ticket.attendeeName || "Attendee Pass"}
                  </p>
                </div>
              </div>
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

          {/* Real-Time Admission Status & Actions */}
          <div className="space-y-2.5">
            {isPending ? (
              <div className="w-full rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 sm:p-3.5 text-center space-y-1">
                <div className="flex items-center justify-center gap-2 text-xs font-bold text-amber-400">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span>Pending Organiser Approval</span>
                </div>
                <p className="text-[11px] text-[#9B9EA4]">
                  Your registration is awaiting organiser review. Entry pass QR activates immediately once approved.
                </p>
              </div>
            ) : isCheckedIn ? (
              <div className="w-full rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 sm:p-3.5 text-center space-y-1">
                <div className="flex items-center justify-center gap-2 text-xs font-bold text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Admitted & Verified at Entry Gate</span>
                </div>
                <p className="text-[11px] text-[#9B9EA4]">
                  {checkinTimestamp && checkinTimestamp !== "Verified"
                    ? `Officially admitted at ${checkinTimestamp}. Enjoy the event!`
                    : "This pass has been officially admitted and verified at the venue gate."}
                </p>
              </div>
            ) : (
              <div className="w-full rounded-xl bg-[#131517] border border-[#2A2D31] p-3 sm:p-3.5 text-center space-y-1">
                <div className="flex items-center justify-center gap-2 text-xs font-semibold text-[#3DD68C]">
                  <span className="w-2 h-2 rounded-full bg-[#3DD68C] animate-pulse" />
                  <span>Live Entry Pass • Ready for Gate Admission</span>
                </div>
                <p className="text-[11px] text-[#9B9EA4]">
                  Present this official QR code at the entrance gate. Organisers scan it with their camera for instant admission.
                </p>
              </div>
            )}

            {/* Save PDF Pass to Device Button */}
            {ticket.ticketId && (
              <button
                type="button"
                onClick={handleDownloadPdf}
                className="w-full h-11 rounded-xl bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download PDF Pass</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

export default QrCheckinModal;
