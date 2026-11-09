"use client";

import { useState, useEffect, useRef } from "react";
import {
  X,
  QrCode,
  Camera,
  Keyboard,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  RotateCcw,
  Volume2,
  VolumeX,
  Search,
  Loader2,
  Check,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import Html5QrcodePlugin from "@/components/admin/html5-qrcode-plugin";
import { parseQRData } from "@/lib/qr";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

function playCheckinSound() {
  try {
    if (typeof window === "undefined") return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    // High snappy chime
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08); // A5
    osc.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.16); // D6

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);

    if (navigator.vibrate) {
      navigator.vibrate([40, 60, 40]);
    }
  } catch {}
}

export function WebScannerModal({
  isOpen,
  onClose,
  event,
  targetGuest = null,
  onGuestVerified,
}) {
  const [activeMode, setActiveMode] = useState("camera"); // "camera" | "manual"
  const [manualCode, setManualCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifiedGuest, setVerifiedGuest] = useState(null);
  const [verificationResult, setVerificationResult] = useState(null); // "success" | "already-used" | "not-found"
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [cameraError, setCameraError] = useState(null);

  const isCancelled = Boolean(event?.isCancelled || event?.status === "cancelled");

  // If a specific targetGuest was clicked from the guest list, pre-verify / display them
  useEffect(() => {
    if (targetGuest && isOpen) {
      setVerifiedGuest(targetGuest);
      const isAlreadyUsed =
        targetGuest.status === "Used" ||
        targetGuest.status === "used" ||
        targetGuest.checkedIn === true;
      setVerificationResult(isAlreadyUsed ? "already-used" : "ready-to-verify");
    } else if (isOpen) {
      setVerifiedGuest(null);
      setVerificationResult(null);
      setManualCode("");
    }
  }, [targetGuest, isOpen]);

  if (!isOpen) return null;

  const handleVerifyTicket = async (rawInput) => {
    if (isCancelled) {
      toast.error("This event is cancelled. Check-in operations are disabled.");
      return;
    }
    const ticketQuery = String(rawInput || "").trim();
    if (!ticketQuery || isVerifying) return;

    setIsVerifying(true);
    setCameraError(null);

    try {
      const parsed = parseQRData(ticketQuery);
      const searchCode = (parsed?.ticketId || parsed?.id || ticketQuery).trim();

      // Look up registration in Firestore
      let foundDoc = null;
      let guestData = null;

      // 1. Direct search by ticketId or id
      const regRef = collection(db, "registrations");
      const q1 = query(regRef, where("ticketId", "==", searchCode));
      const snap1 = await getDocs(q1);

      if (!snap1.empty) {
        foundDoc = snap1.docs[0];
        guestData = { id: foundDoc.id, ...foundDoc.data() };
      } else {
        // Fallback: search by document ID or email
        const q2 = query(regRef, where("id", "==", searchCode));
        const snap2 = await getDocs(q2);
        if (!snap2.empty) {
          foundDoc = snap2.docs[0];
          guestData = { id: foundDoc.id, ...foundDoc.data() };
        }
      }

      if (!foundDoc || !guestData) {
        setVerificationResult("not-found");
        setVerifiedGuest({ searchCode });
        toast.error("Ticket not found in event database");
        return;
      }

      const isAlreadyUsed =
        guestData.status === "Used" ||
        guestData.status === "used" ||
        guestData.checkedIn === true;

      if (isAlreadyUsed) {
        setVerifiedGuest(guestData);
        setVerificationResult("already-used");
        toast.warning(`Ticket was already checked in earlier`);
        return;
      }

      // Check in attendee
      const checkinTime = Timestamp.now();
      await updateDoc(doc(db, "registrations", foundDoc.id), {
        status: "Used",
        checkedIn: true,
        checkedInAt: checkinTime,
      });

      const updated = {
        ...guestData,
        status: "Used",
        checkedIn: true,
        checkedInAt: checkinTime,
      };

      setVerifiedGuest(updated);
      setVerificationResult("success");

      if (soundEnabled) playCheckinSound();
      toast.success(`Identity Verified: ${updated.fullName || updated.name || "Guest"} checked in!`);

      if (typeof onGuestVerified === "function") {
        onGuestVerified(updated);
      }
    } catch (err) {
      console.error("Verification error:", err);
      toast.error("Error verifying ticket");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (manualCode.trim()) {
      handleVerifyTicket(manualCode.trim());
    }
  };

  const handleOneClickCheckInTarget = async () => {
    if (isCancelled) {
      toast.error("This event is cancelled. Check-in operations are disabled.");
      return;
    }
    if (!verifiedGuest?.id) return;
    setIsVerifying(true);
    try {
      const checkinTime = Timestamp.now();
      await updateDoc(doc(db, "registrations", verifiedGuest.id), {
        status: "Used",
        checkedIn: true,
        checkedInAt: checkinTime,
      });

      const updated = {
        ...verifiedGuest,
        status: "Used",
        checkedIn: true,
        checkedInAt: checkinTime,
      };

      setVerifiedGuest(updated);
      setVerificationResult("success");
      if (soundEnabled) playCheckinSound();
      toast.success("Guest identity verified & checked in!");

      if (typeof onGuestVerified === "function") {
        onGuestVerified(updated);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to check in guest");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResetForNext = () => {
    setVerifiedGuest(null);
    setVerificationResult(null);
    setManualCode("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-3xl bg-[#1A1C1F] border border-[#2A2D31] p-5 sm:p-6 shadow-2xl relative space-y-4 animate-in zoom-in-95 duration-200 text-white max-h-[90vh] overflow-y-auto no-scrollbar">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 text-[#9B9EA4] hover:text-white rounded-full bg-white/5 hover:bg-white/10 transition-colors cursor-pointer z-10"
        >
          <X size={16} />
        </button>

        {/* Header */}
        <div className="flex items-center justify-between pr-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#183124] border border-[#3DD68C]/30 flex items-center justify-center text-[#3DD68C]">
              <QrCode size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Guest Identity Scanner
              </h3>
              <p className="text-xs text-[#9B9EA4]">
                Web &amp; Mobile Camera QR Check-in
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 rounded-xl bg-[#212327] border border-[#2A2D31] text-[#9B9EA4] hover:text-white transition-colors cursor-pointer"
            title={soundEnabled ? "Mute audio" : "Enable sound"}
          >
            {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </button>
        </div>

        {/* Cancelled Banner */}
        {isCancelled && (
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
            <AlertTriangle size={16} className="text-rose-400 shrink-0" />
            <span>This event has been cancelled. Check-in operations are stopped.</span>
          </div>
        )}

        {/* Mode Selector */}
        {!verifiedGuest && (
          <div className="grid grid-cols-2 p-1 rounded-xl bg-[#131517] border border-[#2A2D31]">
            <button
              type="button"
              onClick={() => setActiveMode("camera")}
              className={`py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeMode === "camera"
                  ? "bg-[#212327] text-white shadow-sm"
                  : "text-[#9B9EA4] hover:text-white"
              }`}
            >
              <Camera size={14} />
              <span>Camera Scanner</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveMode("manual")}
              className={`py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeMode === "manual"
                  ? "bg-[#212327] text-white shadow-sm"
                  : "text-[#9B9EA4] hover:text-white"
              }`}
            >
              <Keyboard size={14} />
              <span>Manual Entry</span>
            </button>
          </div>
        )}

        {/* ── Scan View ── */}
        {!verifiedGuest ? (
          <div>
            {activeMode === "camera" ? (
              <div className="rounded-2xl overflow-hidden border border-[#2A2D31] bg-black relative flex flex-col items-center justify-center min-h-[280px]">
                <Html5QrcodePlugin
                  fps={15}
                  qrbox={240}
                  aspectRatio={1.0}
                  onSuccess={(decodedText) => handleVerifyTicket(decodedText)}
                  onError={(err, friendly) => setCameraError(friendly)}
                />
                {cameraError && (
                  <div className="absolute inset-0 bg-[#131517] p-5 flex flex-col items-center justify-center text-center space-y-3 z-10">
                    <Camera size={28} className="text-[#FE760B]" />
                    <p className="text-xs text-[#9B9EA4] max-w-xs">{cameraError}</p>
                    <button
                      type="button"
                      onClick={() => setActiveMode("manual")}
                      className="px-4 py-2 rounded-xl bg-[#FE760B] text-[#131517] font-bold text-xs"
                    >
                      Use Manual Entry
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleManualSubmit} className="space-y-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-[#9B9EA4] uppercase tracking-wider mb-1.5">
                    Enter Ticket ID or Attendee Code
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="e.g. TL-84920 or scan text"
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      className="flex-1 bg-[#131517] border border-[#2A2D31] focus:border-[#FE760B] rounded-xl px-4 py-2.5 text-xs text-white placeholder-[#64748B] outline-none font-mono"
                      autoFocus
                    />
                    <button
                      type="submit"
                      disabled={isVerifying || !manualCode.trim()}
                      className="px-4 py-2.5 rounded-xl bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isVerifying ? (
                        <Loader2 className="w-4 h-4 animate-spin text-[#131517]" />
                      ) : (
                        <Search size={14} />
                      )}
                      <span>Verify</span>
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        ) : (
          /* ── Verified Identity Card ── */
          <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
            {/* Status Banner */}
            {verificationResult === "success" && (
              <div className="p-4 rounded-2xl bg-[#183124] border border-[#3DD68C]/40 flex items-center gap-3">
                <CheckCircle2 size={24} className="text-[#3DD68C] shrink-0" />
                <div>
                  <p className="text-sm font-bold text-[#3DD68C]">Identity Verified &amp; Checked In!</p>
                  <p className="text-[11px] text-[#A7F3D0]">
                    Attendee has been marked as attended in real time.
                  </p>
                </div>
              </div>
            )}

            {verificationResult === "already-used" && (
              <div className="p-4 rounded-2xl bg-[#2A1D13] border border-[#FE760B]/40 flex items-center gap-3">
                <AlertTriangle size={24} className="text-[#FE760B] shrink-0" />
                <div>
                  <p className="text-sm font-bold text-[#FE760B]">Already Checked In</p>
                  <p className="text-[11px] text-[#FDBA74]">
                    This ticket has already been used for entry.
                  </p>
                </div>
              </div>
            )}

            {verificationResult === "ready-to-verify" && (
              <div className="p-4 rounded-2xl bg-[#1E293B] border border-blue-500/40 flex items-center gap-3">
                <ShieldCheck size={24} className="text-[#3B82F6] shrink-0" />
                <div>
                  <p className="text-sm font-bold text-white">Attendee Found</p>
                  <p className="text-[11px] text-[#9B9EA4]">
                    Review identity details and confirm check-in below.
                  </p>
                </div>
              </div>
            )}

            {/* Guest Profile Card */}
            <div className="bg-[#131517] border border-[#2A2D31] rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-3.5 pb-3 border-b border-[#2A2D31]">
                <div className="w-12 h-12 rounded-full bg-blue-600 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-md">
                  {(verifiedGuest.fullName || verifiedGuest.name || "G")[0].toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-base font-bold text-white truncate">
                    {verifiedGuest.fullName || verifiedGuest.name || "Guest Attendee"}
                  </h4>
                  <p className="text-xs text-[#9B9EA4] font-mono truncate">
                    {verifiedGuest.email || verifiedGuest.whatsappPhone || "No email"}
                  </p>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                    verifiedGuest.status === "Used"
                      ? "bg-[#183124] text-[#3DD68C] border-[#3DD68C]/30"
                      : "bg-[#192738] text-[#7AA2FF] border-[#7AA2FF]/30"
                  }`}
                >
                  {verifiedGuest.status === "Used" ? "Checked In" : "Valid Pass"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-[#1A1C1F] p-2.5 rounded-xl border border-[#2A2D31]">
                  <span className="text-[10px] text-[#9B9EA4] uppercase tracking-wider block">Ticket ID</span>
                  <span className="font-mono font-bold text-white truncate block">
                    {verifiedGuest.ticketId || verifiedGuest.id || "N/A"}
                  </span>
                </div>
                <div className="bg-[#1A1C1F] p-2.5 rounded-xl border border-[#2A2D31]">
                  <span className="text-[10px] text-[#9B9EA4] uppercase tracking-wider block">Event</span>
                  <span className="font-semibold text-white truncate block">
                    {event?.name || "Tech Fest 2026"}
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={handleResetForNext}
                className="px-4 py-2.5 rounded-xl bg-[#212327] hover:bg-[#2A2D31] text-xs font-semibold text-white flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RotateCcw size={14} className="text-[#FE760B]" />
                <span>Scan Next Guest</span>
              </button>

              {verificationResult === "ready-to-verify" && (
                <button
                  type="button"
                  onClick={handleOneClickCheckInTarget}
                  disabled={isVerifying}
                  className="px-5 py-2.5 rounded-xl bg-[#3DD68C] hover:bg-[#34BE7C] text-[#061A3F] font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md"
                >
                  {isVerifying ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check size={16} />
                  )}
                  <span>Confirm Check-In</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
