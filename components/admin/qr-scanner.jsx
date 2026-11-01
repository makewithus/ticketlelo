"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Ticket,
  Camera,
  Keyboard,
  Volume2,
  VolumeX,
  MapPin,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { parseQRData } from "@/lib/qr";
import Html5QrcodePlugin from "@/components/admin/html5-qrcode-plugin";
import { EventControlHeader } from "@/components/admin/event-control-header";
import { queueOfflineScan } from "@/lib/offline-checkin";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";

const GATE_STATIONS = [
  { id: "main_gate", label: "Main Festival Gate" },
  { id: "track_workshop", label: "AI Workshop Hall" },
  { id: "track_hackathon", label: "Hackathon Dev Room" },
  { id: "track_proshow", label: "Pro Show Concert Arena" },
  { id: "track_gaming", label: "Gaming Arena" },
  { id: "track_robowars", label: "RoboWars Arena" },
];

export function QRScanner() {
  const [selectedStation, setSelectedStation] = useState("main_gate");
  const [activeTab, setActiveTab] = useState("Check-in");
  const [manualTicketId, setManualTicketId] = useState("");
  const [scanHistory, setScanHistory] = useState([]);
  const [checkedInCount, setCheckedInCount] = useState(0);
  const [totalGuests, setTotalGuests] = useState(0);

  const [useManualEntry, setUseManualEntry] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scannerReady, setScannerReady] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [cameraPermissionDismissed, setCameraPermissionDismissed] = useState(false);
  const [cameraRetryKey, setCameraRetryKey] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [flashColor, setFlashColor] = useState(null); // 'green' | 'red' | 'orange' | null

  // Fast local memory cache for sub-second duplicate detection at this gate
  const localScanCache = useRef(new Set());

  // ── Load Real Attendance & Registrations from Firestore ──
  useEffect(() => {
    let isMounted = true;
    const loadRealRegistrations = async () => {
      try {
        const snap = await getDocs(collection(db, "registrations"));
        if (!snap.empty && isMounted) {
          const regs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          const total = regs.length;
          const checked = regs.filter(
            (r) => r.status === "Used" || r.checkedIn === true,
          ).length;

          setTotalGuests(total);
          setCheckedInCount(checked);

          // Populate recent scans from real database check-ins
          const usedRegs = regs
            .filter((r) => r.status === "Used" || r.checkedIn === true)
            .slice(0, 10);

          if (usedRegs.length > 0) {
            const colors = [
              "bg-blue-600 text-white",
              "bg-pink-600 text-white",
              "bg-emerald-600 text-white",
              "bg-purple-600 text-white",
            ];
            const realScans = usedRegs.map((r, i) => {
              const name = r.fullName || r.buyerName || "Admitted Guest";
              const initials =
                name
                  .split(" ")
                  .filter(Boolean)
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase() || "OK";
              const timeObj = r.usedAt?.toDate?.() || new Date();
              const timeStr = timeObj.toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              });
              return {
                id: `real-${r.id}`,
                attendee: name,
                ticketId: r.ticketId || `TKT-${r.id.slice(0, 8)}`,
                status: "valid",
                time: timeStr,
                avatar: initials,
                avatarBg: colors[i % colors.length],
              };
            });

            setScanHistory(realScans);
          }
        }
      } catch (err) {
        console.warn("Could not load registrations from Firestore:", err);
      }
    };

    loadRealRegistrations();
    return () => {
      isMounted = false;
    };
  }, []);

  // Web Audio feedback
  const playFeedbackSound = (type) => {
    if (!soundEnabled || typeof window === "undefined") return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === "admitted") {
        // High upbeat chime (880Hz -> 1320Hz)
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.25);
      } else {
        // Low double-buzz (220Hz)
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.35);
      }
    } catch {
      // AudioCtx might be blocked until user gesture, safe to ignore
    }
  };

  const triggerVisualFlash = (color) => {
    setFlashColor(color);
    setTimeout(() => setFlashColor(null), 1200);
  };

  const verifyTicketPayload = async (payload) => {
    setIsProcessing(true);
    const code = (payload.ticketId || payload.rawQRData || "").trim();
    const cacheKey = `${selectedStation}:${code}`;

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

    // 1. Fast local memory duplicate check
    if (localScanCache.current.has(cacheKey)) {
      triggerVisualFlash("orange");
      playFeedbackSound("denied");
      const duplicateRecord = {
        id: `scan-${Date.now()}`,
        attendee: payload.attendeeName || "Duplicate Ticket",
        ticketId: code || "Scanned Ticket",
        status: "invalid",
        time: timeStr,
        avatar: "!",
        avatarBg: "bg-amber-600 text-white",
      };
      setScanHistory((prev) => [duplicateRecord, ...prev].slice(0, 10));
      toast.warning("DUPLICATE SCAN - Already checked in at this gate!");
      setIsProcessing(false);
      return;
    }

    try {
      // 2. Direct Real-Time Firestore Verification against database
      let dbTicket = null;
      let dbRef = null;

      try {
        const qReg = query(collection(db, "registrations"), where("ticketId", "==", code));
        const regSnap = await getDocs(qReg);
        if (!regSnap.empty) {
          dbDocFound: {
            dbRef = regSnap.docs[0].ref;
            dbTicket = { id: regSnap.docs[0].id, ...regSnap.docs[0].data() };
          }
        } else {
          const qTicket = query(collection(db, "tickets"), where("ticketId", "==", code));
          const tSnap = await getDocs(qTicket);
          if (!tSnap.empty) {
            dbRef = tSnap.docs[0].ref;
            dbTicket = { id: tSnap.docs[0].id, ...tSnap.docs[0].data() };
          }
        }
      } catch (dbErr) {
        console.warn("Client Firestore lookup warning:", dbErr);
      }


      if (dbTicket) {
        const attendeeName = dbTicket.fullName || dbTicket.buyerName || "Verified Guest";
        const isAlreadyUsed = dbTicket.status === "Used" || dbTicket.checkedIn === true;

        if (isAlreadyUsed) {
          triggerVisualFlash("orange");
          playFeedbackSound("denied");
          const duplicateRecord = {
            id: `scan-${Date.now()}`,
            attendee: attendeeName,
            ticketId: code,
            status: "invalid",
            time: timeStr,
            avatar: "!",
            avatarBg: "bg-amber-600 text-white",
          };
          setScanHistory((prev) => [duplicateRecord, ...prev].slice(0, 10));
          toast.warning(`DUPLICATE SCAN: ${attendeeName} is already checked in!`);
          setIsProcessing(false);
          return;
        }

        // Valid & Unused: update database in real-time
        if (dbRef) {
          try {
            await updateDoc(dbRef, {
              status: "Used",
              checkedIn: true,
              usedAt: Timestamp.now(),
              checkedInStation: selectedStation,
            });
          } catch (writeErr) {
            console.warn("Firestore status update warning:", writeErr);
          }
        }

        localScanCache.current.add(cacheKey);
        triggerVisualFlash("green");
        playFeedbackSound("admitted");
        setCheckedInCount((prev) => Math.min(totalGuests, prev + 1));

        const newScan = {
          id: `scan-${Date.now()}`,
          attendee: attendeeName,
          ticketId: code,
          status: "valid",
          time: timeStr,
          avatar: attendeeName
            .split(" ")
            .filter(Boolean)
            .map((n) => n[0])
            .slice(0, 2)
            .join("")
            .toUpperCase() || "OK",
          avatarBg: "bg-blue-600 text-white",
        };

        setScanHistory((prev) => [newScan, ...prev].slice(0, 10));
        toast.success(`ADMITTED: Welcome ${attendeeName}!`);
        setIsProcessing(false);
        return;
      }

      // 3. Fallback to API route if needed
      let idToken = "";
      try {
        if (auth?.currentUser) {
          idToken = await auth.currentUser.getIdToken();
        }
      } catch {
        // safe ignore
      }

      const response = await fetch("/api/verify-ticket", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({
          rawQRData: payload.rawQRData,
          ticketId: code,
          gateStationSubEventId: selectedStation,
        }),
      });

      const result = await response.json();
      const isValid = result.status === "admitted" || result.status === "valid";
      const attendeeName =
        result.attendee ||
        result.user ||
        payload.attendeeName ||
        (isValid ? "Verified Guest" : "Unknown ticket");

      const newScan = {
        id: `scan-${Date.now()}`,
        attendee: attendeeName,
        ticketId: code || "QR-PASS",
        status: isValid ? "valid" : "invalid",
        time: timeStr,
        avatar: isValid
          ? attendeeName
              .split(" ")
              .filter(Boolean)
              .map((n) => n[0])
              .slice(0, 2)
              .join("")
              .toUpperCase() || "OK"
          : "?",
        avatarBg: isValid ? "bg-emerald-600 text-white" : "bg-[#2A2D31] text-[#9B9EA4]",
      };

      setScanHistory((prev) => [newScan, ...prev].slice(0, 10));

      if (isValid) {
        localScanCache.current.add(cacheKey);
        triggerVisualFlash("green");
        playFeedbackSound("admitted");
        setCheckedInCount((prev) => Math.min(totalGuests, prev + 1));
        toast.success(`ADMITTED: Welcome ${attendeeName}!`);
      } else {
        triggerVisualFlash("red");
        playFeedbackSound("denied");
        toast.error(`DENIED: ${result.message || "Invalid ticket"}`);
      }
    } catch (error) {
      console.warn("[qr-scanner] Network offline, switching to offline check-in queue:", error);
      const offlineRecord = queueOfflineScan({
        ticketId: code || "OFFLINE_QR",
        rawQRData: payload.rawQRData,
        gateStationSubEventId: selectedStation,
      });

      const isValid = offlineRecord.status === "offline_provisional_admitted";
      const newScan = {
        id: `scan-${Date.now()}`,
        attendee: offlineRecord.attendeeName || "Offline Guest",
        ticketId: offlineRecord.ticketId,
        status: isValid ? "valid" : "invalid",
        time: timeStr,
        avatar: isValid ? "OG" : "!",
        avatarBg: isValid ? "bg-emerald-600 text-white" : "bg-amber-600 text-white",
      };

      setScanHistory((prev) => [newScan, ...prev].slice(0, 10));

      if (isValid) {
        triggerVisualFlash("green");
        playFeedbackSound("admitted");
        setCheckedInCount((prev) => Math.min(totalGuests, prev + 1));
        toast.info("OFFLINE: Provisional check-in queued for sync");
      } else {
        triggerVisualFlash("orange");
        playFeedbackSound("denied");
        toast.warning("OFFLINE DUPLICATE: Already scanned locally");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleQRScan = async (decodedText) => {
    const now = Date.now();
    if (now - lastScanTime < 1800) return;
    setLastScanTime(now);

    try {
      if (decodedText.startsWith("TLSEC:")) {
        await verifyTicketPayload({ rawQRData: decodedText });
      } else {
        const ticketId = parseQRData(decodedText);
        await verifyTicketPayload({ rawQRData: decodedText, ticketId });
      }
    } catch (error) {
      console.error("QR scan error:", error);
      toast.error("Unrecognized QR code format");
    }
  };

  const handleManualEntry = async () => {
    if (!manualTicketId.trim()) {
      toast.error("Please enter a ticket ID");
      return;
    }
    await verifyTicketPayload({ ticketId: manualTicketId.trim() });
    setManualTicketId("");
  };

  // Simulate a scan action strictly matching Image 1
  const handleSimulateScan = () => {
    const candidates = [
      { name: "Priya Sharma", code: "TKT-1793-PR89Q", valid: true, bg: "bg-purple-600 text-white" },
      { name: "Rohan Verma", code: "TKT-1793-RV44X", valid: true, bg: "bg-emerald-600 text-white" },
      { name: "Ananya Iyer", code: "TKT-1793-AI11L", valid: true, bg: "bg-amber-600 text-white" },
      { name: "Unknown ticket", code: "TKT-1701-XX99E", valid: false, bg: "bg-[#2A2D31] text-[#9B9EA4]" },
      { name: "Sneha Patel", code: "TKT-1793-SP77K", valid: true, bg: "bg-blue-600 text-white" },
    ];
    const candidate = candidates[Math.floor(Math.random() * candidates.length)];
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

    const newScan = {
      id: `sim-${Date.now()}`,
      attendee: candidate.name,
      ticketId: candidate.code,
      status: candidate.valid ? "valid" : "invalid",
      time: timeStr,
      avatar: candidate.valid
        ? candidate.name
            .split(" ")
            .filter(Boolean)
            .map((n) => n[0])
            .slice(0, 2)
            .join("")
            .toUpperCase()
        : "?",
      avatarBg: candidate.bg,
    };

    if (candidate.valid) {
      triggerVisualFlash("green");
      playFeedbackSound("admitted");
      setCheckedInCount((prev) => Math.min(totalGuests, prev + 1));
      toast.success(`ADMITTED: Welcome ${candidate.name}!`);
    } else {
      triggerVisualFlash("red");
      playFeedbackSound("denied");
      toast.error(`DENIED: Invalid ticket ${candidate.code}`);
    }

    setScanHistory((prev) => [newScan, ...prev].slice(0, 10));
  };

  return (
    <div className="w-full text-white selection:bg-[#FE760B] selection:text-white pb-10">
      <EventControlHeader
        activeTab="Check-In"
        extraActions={
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? "Mute chime" : "Enable chime"}
            className="p-2 rounded-xl border border-[#2A2D31] bg-[#1A1C1F] hover:bg-[#212327] text-[#9B9EA4] hover:text-white transition-colors"
          >
            {soundEnabled ? (
              <Volume2 size={14} className="text-[#3DD68C]" />
            ) : (
              <VolumeX size={14} />
            )}
          </button>
        }
      />

      {/* ── 3. Main Two-Column Layout strictly matching Image 1 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start max-w-5xl mx-auto w-full">
        {/* ── Left Column: QR Viewfinder & Controls ── */}
        <div className="w-full flex flex-col items-center">
          {/* Camera / Manual Entry Mode Toggle matching Image 1 */}
          <div className="w-full flex p-1 rounded-xl bg-[#1A1C1F] border border-[#2A2D31] mb-4">
            <button
              type="button"
              onClick={() => setUseManualEntry(false)}
              className={`flex-1 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                !useManualEntry
                  ? "bg-[#2A2D31] text-white shadow-sm"
                  : "text-[#9B9EA4] hover:text-white"
              }`}
            >
              <Camera size={14} className="shrink-0" />
              <span>Camera</span>
            </button>
            <button
              type="button"
              onClick={() => setUseManualEntry(true)}
              className={`flex-1 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                useManualEntry
                  ? "bg-[#2A2D31] text-white shadow-sm"
                  : "text-[#9B9EA4] hover:text-white"
              }`}
            >
              <Keyboard size={14} className="shrink-0" />
              <span>Manual entry</span>
            </button>
          </div>

          {!useManualEntry ? (
            /* ── Camera Viewfinder Box with Brackets & Animated Laser matching Image 1 ── */
            <>
              <div className="relative w-full aspect-square max-h-[380px] sm:max-h-[420px] rounded-2xl bg-[#0B0C0E] border border-[#2A2D31] overflow-hidden flex items-center justify-center shadow-2xl">
                {/* Background live camera stream */}
                <div className="absolute inset-0 z-0">
                  <Html5QrcodePlugin
                    key={`scanner-key-${cameraRetryKey}`}
                    fps={20}
                    qrbox={260}
                    aspectRatio={1.0}
                    disableFlip={false}
                    onSuccess={handleQRScan}
                    onReady={() => {
                      setScannerReady(true);
                      setCameraError(null);
                      setCameraPermissionDismissed(false);
                    }}
                    onError={(err, friendlyMsg) => {
                      setScannerReady(false);
                      setCameraError(friendlyMsg);
                      const isDismissed =
                        err?.name === "NotAllowedError" ||
                        String(err?.message || "").toLowerCase().includes("permission dismissed") ||
                        String(err?.message || "").toLowerCase().includes("permission denied");
                      setCameraPermissionDismissed(isDismissed);
                    }}
                  />
                </div>

                {/* Translucent vignette overlay for reticle contrast */}
                <div className="absolute inset-0 bg-black/35 pointer-events-none z-10" />

                {/* Color Flash on scan result */}
                {flashColor && (
                  <div
                    className={`absolute inset-0 z-20 pointer-events-none transition-opacity duration-300 ${
                      flashColor === "green"
                        ? "bg-emerald-500/25 ring-4 ring-emerald-500 inset-0"
                        : flashColor === "red"
                        ? "bg-red-500/25 ring-4 ring-red-500 inset-0"
                        : "bg-amber-500/25 ring-4 ring-amber-500 inset-0"
                    }`}
                  />
                )}

                {/* ── 4 White Corner Brackets forming Reticle Frame ── */}
                <div className="relative z-20 w-[190px] h-[190px] sm:w-[230px] sm:h-[230px] pointer-events-none flex items-center justify-center">
                  {/* Top-Left Corner */}
                  <div className="absolute top-0 left-0 w-8 h-8 sm:w-9 sm:h-9 border-t-[3.5px] border-l-[3.5px] border-white rounded-tl-2xl shadow-sm" />
                  {/* Top-Right Corner */}
                  <div className="absolute top-0 right-0 w-8 h-8 sm:w-9 sm:h-9 border-t-[3.5px] border-r-[3.5px] border-white rounded-tr-2xl shadow-sm" />
                  {/* Bottom-Left Corner */}
                  <div className="absolute bottom-0 left-0 w-8 h-8 sm:w-9 sm:h-9 border-b-[3.5px] border-l-[3.5px] border-white rounded-bl-2xl shadow-sm" />
                  {/* Bottom-Right Corner */}
                  <div className="absolute bottom-0 right-0 w-8 h-8 sm:w-9 sm:h-9 border-b-[3.5px] border-r-[3.5px] border-white rounded-br-2xl shadow-sm" />

                  {/* ── Animated Orange Scanning Laser Beam Line ── */}
                  {!cameraError && (
                    <div className="absolute left-2.5 right-2.5 h-[2.5px] bg-[#FE760B] rounded-full shadow-[0_0_14px_3px_rgba(254,118,11,0.85),0_0_28px_6px_rgba(254,118,11,0.5)] animate-qr-laser">
                      <div className="absolute -top-3 inset-x-0 h-6 bg-gradient-to-b from-transparent via-[#FE760B]/25 to-transparent pointer-events-none" />
                    </div>
                  )}
                </div>

                {/* ── Fallback View when Camera Permission is Dismissed or Unavailable ── */}
                {cameraError && (
                  <div className="absolute inset-0 z-30 bg-[#131517]/95 flex flex-col items-center justify-center p-6 text-center backdrop-blur-sm">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center mb-3">
                      <Camera className="w-6 h-6 text-amber-500" />
                    </div>
                    <h4 className="text-sm font-bold text-white mb-1">
                      {cameraPermissionDismissed ? "Camera Access Dismissed" : "Camera Unavailable"}
                    </h4>
                    <p className="text-xs text-[#9B9EA4] max-w-xs mb-4 leading-relaxed">
                      {cameraError}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setUseManualEntry(true)}
                        className="px-4 py-2 rounded-xl bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-md"
                      >
                        <Keyboard size={13} />
                        <span>Use Manual Entry</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCameraError(null);
                          setCameraPermissionDismissed(false);
                          setCameraRetryKey((k) => k + 1);
                        }}
                        className="px-3.5 py-2 rounded-xl bg-[#212327] hover:bg-[#2A2D31] text-white border border-[#2A2D31] text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Retry Camera
                      </button>
                    </div>
                  </div>
                )}

                {/* Status at bottom inside Viewfinder matching Image 1 */}
                <div className="absolute bottom-3 sm:bottom-4 inset-x-0 flex items-center justify-center gap-2 z-20 pointer-events-none">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      cameraError
                        ? "bg-amber-500"
                        : scannerReady
                        ? "bg-[#3DD68C]"
                        : "bg-[#FE760B] animate-pulse"
                    } shrink-0`}
                  />
                  <span className="text-[11px] sm:text-xs text-[#D0D0D1] font-medium tracking-wide drop-shadow-sm">
                    {cameraError
                      ? "Camera disabled · manual entry available"
                      : scannerReady
                      ? "Camera ready · hold QR code steady"
                      : "Initializing camera..."}
                  </span>
                </div>
              </div>

              {/* ── Simulate a scan button (Only under camera mode matching Image 1) ── */}
              <button
                type="button"
                onClick={handleSimulateScan}
                className="w-full mt-3.5 py-2.5 sm:py-3 rounded-xl bg-[#1A1C1F] hover:bg-[#212327] border border-[#2A2D31] text-xs sm:text-sm font-semibold text-white transition-all active:scale-[0.99] text-center shadow-md"
              >
                Simulate a scan
              </button>
            </>
          ) : (
            /* ── Manual Entry Panel strictly matching Image 1 ── */
            <div className="w-full rounded-2xl bg-[#1A1C1F] border border-[#2A2D31] p-4 sm:p-5 shadow-lg">
              <label className="block text-xs font-semibold text-[#9B9EA4] mb-2.5">
                Ticket ID
              </label>

              <div className="flex items-center gap-2.5 mb-3">
                <input
                  type="text"
                  placeholder="TKT-1704087890-ABC123"
                  value={manualTicketId}
                  onChange={(e) => setManualTicketId(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleManualEntry()}
                  className="flex-1 h-10 px-3.5 rounded-xl bg-[#212327] border border-[#2A2D31] text-white text-xs sm:text-sm font-mono placeholder:text-[#5C6066] focus:border-[#FE760B] focus:outline-none transition-colors"
                  autoFocus
                  disabled={isProcessing}
                />
                <button
                  type="button"
                  onClick={handleManualEntry}
                  disabled={isProcessing}
                  className="h-10 px-5 rounded-xl bg-white hover:bg-slate-100 text-[#131517] font-semibold text-xs sm:text-sm transition-all disabled:opacity-50 shrink-0 flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98]"
                >
                  {isProcessing ? (
                    <Loader2 size={14} className="animate-spin text-black" />
                  ) : (
                    "Verify"
                  )}
                </button>
              </div>

              <p className="text-[11px] sm:text-xs text-[#9B9EA4] leading-relaxed">
                Try{" "}
                <button
                  type="button"
                  onClick={() => setManualTicketId("TKT-1793-QW89E")}
                  className="font-mono text-[#D0D0D1] hover:text-[#FE760B] hover:underline transition-colors"
                >
                  TKT-1793-QW89E
                </button>{" "}
                (valid),{" "}
                <button
                  type="button"
                  onClick={() => setManualTicketId("TKT-1793-AB12C")}
                  className="font-mono text-[#D0D0D1] hover:text-[#FE760B] hover:underline transition-colors"
                >
                  TKT-1793-AB12C
                </button>{" "}
                (already in) or anything else
              </p>
            </div>
          )}
        </div>

        {/* ── Right Column: Stats & Recent Scans matching Image 1 ── */}
        <div className="w-full space-y-5">
          {/* ── 1. Checked in Counter & Progress Bar ── */}
          <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-4 sm:p-5 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#3DD68C]" />
                <span className="text-xs sm:text-sm font-semibold text-white">
                  Checked in
                </span>
              </div>
              <div className="flex items-baseline gap-1 text-white">
                <span className="text-lg sm:text-xl font-bold tabular-nums">
                  {checkedInCount}
                </span>
                <span className="text-xs text-[#9B9EA4] font-medium">
                  / {totalGuests}
                </span>
              </div>
            </div>

            {/* Green Progress Bar matching Image 1 */}
            <div className="w-full h-1.5 sm:h-2 rounded-full bg-[#2A2D31] overflow-hidden">
              <div
                className="h-full bg-[#3DD68C] rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${Math.min(100, (checkedInCount / totalGuests) * 100)}%`,
                }}
              />
            </div>
          </div>

          {/* ── 2. Recent Scans Section matching Image 1 ── */}
          <div>
            <div className="flex items-center justify-between mb-2.5 px-0.5">
              <h3 className="text-xs sm:text-sm font-semibold text-[#D0D0D1]">
                Recent scans
              </h3>
              {/* Gate station indicator */}
              <div className="flex items-center gap-1.5 text-[11px] text-[#9B9EA4]">
                <MapPin size={12} className="text-[#FE760B]" />
                <select
                  value={selectedStation}
                  onChange={(e) => setSelectedStation(e.target.value)}
                  className="bg-transparent text-[11px] font-medium text-[#9B9EA4] hover:text-white focus:outline-none cursor-pointer"
                >
                  {GATE_STATIONS.map((station) => (
                    <option
                      key={station.id}
                      value={station.id}
                      className="bg-[#1A1C1F] text-white"
                    >
                      {station.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl divide-y divide-[#2A2D31] overflow-hidden shadow-lg">
              {scanHistory.map((scan) => (
                <div
                  key={scan.id}
                  className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-[#212327]/40 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${scan.avatarBg}`}
                    >
                      {scan.avatar}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-semibold text-white truncate">
                        {scan.attendee}
                      </p>
                      <p className="font-mono text-[11px] text-[#9B9EA4] truncate">
                        {scan.ticketId}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold ${
                        scan.status === "valid" || scan.status === "admitted"
                          ? "bg-[#3DD68C]/12 text-[#3DD68C] border border-[#3DD68C]/20"
                          : "bg-[#FF6B6B]/12 text-[#FF9A9A] border border-[#FF6B6B]/20"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          scan.status === "valid" || scan.status === "admitted"
                            ? "bg-[#3DD68C]"
                            : "bg-[#FF6B6B]"
                        }`}
                      />
                      <span>
                        {scan.status === "valid" || scan.status === "admitted"
                          ? "Valid"
                          : "Invalid"}
                      </span>
                    </span>
                    <span className="text-xs text-[#9B9EA4] whitespace-nowrap">
                      {scan.time}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
