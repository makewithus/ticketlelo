"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertCircle,
  CheckCircle2,
  QrCode,
  X,
  Clock,
  UserCheck,
  Keyboard,
  Camera,
  ScanLine,
  ShieldCheck,
  ShieldAlert,
  Volume2,
  VolumeX,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";
import { parseQRData } from "@/lib/qr";
import Html5QrcodePlugin from "@/components/admin/html5-qrcode-plugin";
import { queueOfflineScan, syncOfflineQueue } from "@/lib/offline-checkin";

const GATE_STATIONS = [
  { id: "main_gate", label: "Main Festival Gate (All Passes)" },
  { id: "track_workshop", label: "AI Workshop Hall" },
  { id: "track_hackathon", label: "Hackathon Dev Room" },
  { id: "track_proshow", label: "Pro Show Concert Arena" },
  { id: "track_gaming", label: "Gaming Arena" },
  { id: "track_robowars", label: "RoboWars Arena" },
];

export function QRScanner() {
  const [selectedStation, setSelectedStation] = useState("main_gate");
  const [manualTicketId, setManualTicketId] = useState("");
  const [lastScannedResult, setLastScannedResult] = useState(null);
  const [scanHistory, setScanHistory] = useState([]);
  const [useManualEntry, setUseManualEntry] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastScanTime, setLastScanTime] = useState(0);
  const [scannerReady, setScannerReady] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [flashColor, setFlashColor] = useState(null); // 'green' | 'red' | 'orange' | null

  // Fast local memory cache for sub-second duplicate detection at this gate
  const localScanCache = useRef(new Set());

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
    const cacheKey = `${selectedStation}:${payload.ticketId || payload.rawQRData}`;

    // Fast local duplicate check
    if (localScanCache.current.has(cacheKey)) {
      triggerVisualFlash("orange");
      playFeedbackSound("denied");
      const duplicateRes = {
        status: "already_used",
        ticketId: payload.ticketId || "Scanned Ticket",
        attendee: "Attendee (Local Cache)",
        message: "Duplicate scan at this station within this session.",
        scannedAt: new Date(),
      };
      setLastScannedResult(duplicateRes);
      setScanHistory((prev) => [duplicateRes, ...prev].slice(0, 15));
      toast.warning("DUPLICATE SCAN - Already checked in locally at this gate!");
      setIsProcessing(false);
      return duplicateRes;
    }

    try {
      const response = await fetch("/api/verify-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawQRData: payload.rawQRData,
          ticketId: payload.ticketId,
          gateStationSubEventId: selectedStation,
        }),
      });
      const result = await response.json();

      const displayResult = {
        ...result,
        ticketId: result.ticketId || payload.ticketId || "QR-PASS",
        user: result.attendee || result.user,
        scannedAt: new Date(),
      };

      setLastScannedResult(displayResult);
      setScanHistory((prev) => [displayResult, ...prev].slice(0, 15));

      if (result.status === "admitted" || result.status === "valid") {
        localScanCache.current.add(cacheKey);
        triggerVisualFlash("green");
        playFeedbackSound("admitted");
        toast.success(`ADMITTED: Welcome ${result.attendee || "Attendee"}!`);
      } else if (result.status === "unauthorized_track") {
        triggerVisualFlash("red");
        playFeedbackSound("denied");
        toast.error(`DENIED: Track Unauthorized! ${result.message}`);
      } else if (result.status === "already_used") {
        localScanCache.current.add(cacheKey);
        triggerVisualFlash("orange");
        playFeedbackSound("denied");
        toast.warning(`DUPLICATE SCAN: Already admitted at ${result.usedAt || "earlier"}`);
      } else if (result.status === "invalid_signature") {
        triggerVisualFlash("red");
        playFeedbackSound("denied");
        toast.error(`TAMPERED QR CODE: Cryptographic signature mismatch!`);
      } else if (result.status === "not_found") {
        triggerVisualFlash("red");
        playFeedbackSound("denied");
        toast.error("INVALID TICKET: Not found in database");
      } else {
        triggerVisualFlash("red");
        playFeedbackSound("denied");
        toast.error(result.message || "SCAN DENIED");
      }
      return result;
    } catch (error) {
      console.warn("[qr-scanner] Network offline, switching to offline check-in queue:", error);
      const offlineRecord = queueOfflineScan({
        ticketId: payload.ticketId || "OFFLINE_QR",
        rawQRData: payload.rawQRData,
        gateStationSubEventId: selectedStation,
      });

      const displayResult = {
        ...offlineRecord,
        status: offlineRecord.status,
        attendee: offlineRecord.attendeeName,
        user: offlineRecord.attendeeName,
        ticketId: offlineRecord.ticketId,
        scannedAt: new Date(),
        message: offlineRecord.status === "offline_duplicate"
          ? "Duplicate scan detected locally at this offline terminal."
          : "Offline Provisional Admission (Sync Pending)",
      };

      setLastScannedResult(displayResult);
      setScanHistory((prev) => [displayResult, ...prev].slice(0, 15));

      if (offlineRecord.status === "offline_provisional_admitted") {
        triggerVisualFlash("green");
        playFeedbackSound("admitted");
        toast.info("OFFLINE MODE: Provisional check-in queued for sync");
      } else {
        triggerVisualFlash("orange");
        playFeedbackSound("denied");
        toast.warning("OFFLINE DUPLICATE: Already scanned on this terminal");
      }
      return displayResult;
    } finally {
      setIsProcessing(false);
    }

  };

  const handleQRScan = async (decodedText) => {
    const now = Date.now();
    if (now - lastScanTime < 1800) return;
    setLastScanTime(now);

    try {
      // If signed QR payload, pass raw string directly to route
      if (decodedText.startsWith("TLSEC:")) {
        await verifyTicketPayload({ rawQRData: decodedText });
      } else {
        // Fallback to legacy QR parser
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

  const getStatusConfig = (status) => {
    switch (status) {
      case "admitted":
      case "valid":
        return {
          border: "border-emerald-500",
          bg: "bg-emerald-500/10",
          icon: <CheckCircle2 className="w-8 h-8 text-emerald-400 animate-bounce" />,
          title: "ENTRY GRANTED — ADMITTED",
          accent: "text-emerald-400",
        };
      case "unauthorized_track":
        return {
          border: "border-red-500",
          bg: "bg-red-500/10",
          icon: <ShieldAlert className="w-8 h-8 text-red-400 animate-pulse" />,
          title: "ENTRY DENIED — TRACK UNAUTHORIZED",
          accent: "text-red-400",
        };
      case "already_used":
        return {
          border: "border-amber-500",
          bg: "bg-amber-500/10",
          icon: <AlertCircle className="w-8 h-8 text-amber-400 animate-pulse" />,
          title: "DUPLICATE SCAN — ALREADY ADMITTED",
          accent: "text-amber-400",
        };
      case "invalid_signature":
        return {
          border: "border-red-600",
          bg: "bg-red-600/15",
          icon: <X className="w-8 h-8 text-red-500" />,
          title: "TAMPERED / FAKE QR CODE",
          accent: "text-red-500",
        };
      case "not_found":
        return {
          border: "border-red-500",
          bg: "bg-red-500/10",
          icon: <AlertCircle className="w-8 h-8 text-red-400" />,
          title: "TICKET NOT FOUND",
          accent: "text-red-400",
        };
      default:
        return {
          border: "border-slate-700",
          bg: "bg-slate-900/50",
          icon: <AlertCircle className="w-8 h-8 text-slate-400" />,
          title: "SCAN ERROR",
          accent: "text-slate-400",
        };
    }
  };

  return (
    <div className={`space-y-6 transition-colors duration-300 ${
      flashColor === "green"
        ? "bg-emerald-950/20 ring-4 ring-emerald-500 rounded-3xl p-2"
        : flashColor === "red"
        ? "bg-red-950/20 ring-4 ring-red-500 rounded-3xl p-2"
        : flashColor === "orange"
        ? "bg-amber-950/20 ring-4 ring-amber-500 rounded-3xl p-2"
        : ""
    }`}>
      {/* Header & Station Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-[#0B132B] border border-blue-900/30 text-white shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
            <h2 className="text-2xl font-black tracking-tight text-white">
              Gate Operations & Check-In
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            HMAC-SHA-256 verification • Sub-event track entitlement gating • Duplicate prevention
          </p>
        </div>

        {/* Station Selector & Audio Toggle */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-700/60 rounded-xl px-3 py-2">
            <MapPin className="w-4 h-4 text-blue-400 shrink-0" />
            <select
              value={selectedStation}
              onChange={(e) => setSelectedStation(e.target.value)}
              className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer"
            >
              {GATE_STATIONS.map((station) => (
                <option key={station.id} value={station.id} className="bg-[#0B132B] text-white">
                  {station.label}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? "Mute audio beeps" : "Enable audio beeps"}
            className="p-2.5 rounded-xl border border-slate-700 bg-slate-900 text-slate-300 hover:text-white hover:border-slate-500 transition-colors"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Scanner / Manual Entry Panel */}
        <div className="lg:col-span-2 space-y-6">
          {/* Mode Switcher */}
          <div className="flex gap-2 p-1 rounded-xl bg-slate-900/60 border border-slate-800">
            <button
              onClick={() => setUseManualEntry(false)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                !useManualEntry
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Camera className="w-4 h-4" /> Camera Scanner
            </button>
            <button
              onClick={() => setUseManualEntry(true)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                useManualEntry
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Keyboard className="w-4 h-4" /> Manual Ticket ID
            </button>
          </div>

          {!useManualEntry ? (
            <div className="rounded-2xl border border-slate-800 bg-[#0B132B] overflow-hidden shadow-2xl">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                    <ScanLine className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">
                      Optical QR Camera Scanner
                    </h3>
                    <p className="text-xs text-slate-400">
                      Station: <span className="text-blue-400 font-mono">{selectedStation}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {scannerReady && (
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30">
                      <div className="w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
                      <span className="text-xs font-semibold text-emerald-400">Ready</span>
                    </div>
                  )}
                  {isProcessing && (
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30">
                      <div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs font-semibold text-amber-400">Checking...</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-black relative">
                <div className="text-center text-xs text-slate-300 py-2.5 px-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-center gap-2">
                  <QrCode className="w-4 h-4 text-blue-400" />
                  Hold attendee QR badge steady in view
                </div>
                <Html5QrcodePlugin
                  fps={15}
                  qrbox={320}
                  aspectRatio={1.0}
                  disableFlip={false}
                  onSuccess={handleQRScan}
                  onReady={() => setScannerReady(true)}
                  onError={() => {}}
                />
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-[#0B132B] p-8 shadow-2xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                  <Keyboard className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white">Manual Verification</h3>
                  <p className="text-xs text-slate-400">
                    Enter the ticket ID printed on attendee pass
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Ticket ID / Code
                  </label>
                  <div className="relative">
                    <QrCode className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input
                      placeholder="e.g., TKT-1740000000-ABC123"
                      value={manualTicketId}
                      onChange={(e) => setManualTicketId(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleManualEntry()}
                      className="h-12 pl-10 text-base bg-slate-900 border-slate-700 text-white placeholder:text-slate-600 focus:border-blue-500 rounded-xl"
                      autoFocus
                      disabled={isProcessing}
                    />
                  </div>
                </div>

                <Button
                  onClick={handleManualEntry}
                  disabled={isProcessing}
                  className="w-full h-12 gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-600/30 transition-all"
                >
                  {isProcessing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" /> Verify Ticket at {GATE_STATIONS.find((s) => s.id === selectedStation)?.label.split(" (")[0]}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Prominent High-Contrast Admission Result Banner */}
          {lastScannedResult &&
            (() => {
              const cfg = getStatusConfig(lastScannedResult.status);
              return (
                <div
                  className={`rounded-2xl border-2 p-6 ${cfg.border} ${cfg.bg} shadow-2xl transition-all duration-200`}
                >
                  <div className="flex items-start gap-4">
                    <div className="pt-0.5">{cfg.icon}</div>
                    <div className="flex-1">
                      <h4 className={`font-black text-xl mb-3 tracking-wide ${cfg.accent}`}>
                        {cfg.title}
                      </h4>
                      <p className="text-xs text-slate-300 mb-4">{lastScannedResult.message}</p>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs bg-black/40 p-4 rounded-xl border border-white/5">
                        <div>
                          <span className="font-semibold text-slate-400 block mb-0.5">
                            Ticket ID:
                          </span>
                          <span className="font-mono text-white text-sm">
                            {lastScannedResult.ticketId}
                          </span>
                        </div>
                        {lastScannedResult.user && (
                          <div>
                            <span className="font-semibold text-slate-400 block mb-0.5">
                              Attendee:
                            </span>
                            <span className="text-white font-bold text-sm">
                              {lastScannedResult.user}
                            </span>
                          </div>
                        )}
                        {lastScannedResult.ticketTitle && (
                          <div>
                            <span className="font-semibold text-slate-400 block mb-0.5">
                              Tier / Pass:
                            </span>
                            <span className="text-blue-400 font-semibold text-sm">
                              {lastScannedResult.ticketTitle}
                            </span>
                          </div>
                        )}
                        <div>
                          <span className="font-semibold text-slate-400 block mb-0.5">
                            Station:
                          </span>
                          <span className="text-slate-200 font-mono">
                            {selectedStation}
                          </span>
                        </div>
                        <div>
                          <span className="font-semibold text-slate-400 block mb-0.5">
                            Scanned At:
                          </span>
                          <span className="text-slate-200 font-mono">
                            {lastScannedResult.scannedAt.toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
        </div>

        {/* Scan History Sidebar */}
        <div className="lg:col-span-1">
          <div className="rounded-2xl border border-slate-800 bg-[#0B132B] p-6 h-full shadow-2xl">
            <h3 className="text-base font-bold text-white mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400" />
                Gate Audit Log
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
                {scanHistory.length}
              </span>
            </h3>

            <div className="space-y-2.5 max-h-[540px] overflow-y-auto pr-1">
              {scanHistory.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-12 h-12 rounded-full bg-slate-800/60 flex items-center justify-center mx-auto mb-3">
                    <ScanLine className="w-6 h-6 text-slate-500" />
                  </div>
                  <p className="text-xs text-slate-400">
                    No scans logged at this station yet.
                  </p>
                </div>
              ) : (
                scanHistory.map((scan, idx) => {
                  const isAdmitted = scan.status === "admitted" || scan.status === "valid";
                  const isDuplicate = scan.status === "already_used";
                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl text-xs border-l-4 transition-all ${
                        isAdmitted
                          ? "bg-emerald-500/10 border-emerald-500 text-emerald-300"
                          : isDuplicate
                          ? "bg-amber-500/10 border-amber-500 text-amber-300"
                          : "bg-red-500/10 border-red-500 text-red-300"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5 font-bold">
                          {isAdmitted ? (
                            <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <X className="w-3.5 h-3.5 text-red-400" />
                          )}
                          <span className="truncate">{scan.user || "Attendee"}</span>
                        </div>
                        <span className="text-[10px] opacity-75 font-mono">
                          {scan.scannedAt.toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="font-mono text-[11px] opacity-80 truncate">
                        {scan.ticketId}
                      </p>
                      {scan.ticketTitle && (
                        <p className="text-[10px] font-semibold text-blue-300 truncate mt-0.5">
                          {scan.ticketTitle}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
