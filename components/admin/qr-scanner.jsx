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
  Wifi,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import { parseQRData } from "@/lib/qr";
import Html5QrcodePlugin from "@/components/admin/html5-qrcode-plugin";

export function QRScanner() {
  const [manualTicketId, setManualTicketId] = useState("");
  const [lastScannedResult, setLastScannedResult] = useState(null);
  const [scanHistory, setScanHistory] = useState([]);
  const [useManualEntry, setUseManualEntry] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastScanTime, setLastScanTime] = useState(0);
  const [scannerReady, setScannerReady] = useState(false);

  const verifyTicket = async (ticketId) => {
    setIsProcessing(true);
    try {
      const response = await fetch("/api/verify-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId }),
      });
      const result = await response.json();

      setLastScannedResult({ ticketId, ...result, scannedAt: new Date() });
      setScanHistory((prev) =>
        [{ ticketId, ...result, scannedAt: new Date() }, ...prev].slice(0, 10),
      );

      if (result.status === "valid") {
        toast.success(`✅ ENTRY ALLOWED - Welcome ${result.user}!`);
      } else if (result.status === "already_used") {
        const usedDate = result.usedAt
          ? new Date(result.usedAt.seconds * 1000).toLocaleString()
          : "Unknown time";
        toast.error(
          `❌ ENTRY DENIED - Already used by ${result.user} at ${usedDate}`,
        );
      } else if (result.status === "not_found") {
        toast.error("❌ INVALID TICKET - Not found in system");
      } else if (result.status === "invalid") {
        toast.error("❌ INVALID QR CODE - Invalid format");
      } else {
        toast.error("❌ SYSTEM ERROR - Please try again");
      }
      return result;
    } catch (error) {
      console.error("Verify ticket error:", error);
      toast.error("❌ NETWORK ERROR - Check connection");
      return { status: "error" };
    } finally {
      setIsProcessing(false);
    }
  };

  const handleQRScan = async (decodedText) => {
    const now = Date.now();
    if (now - lastScanTime < 2000) return;
    setLastScanTime(now);
    try {
      const ticketId = parseQRData(decodedText);
      await verifyTicket(ticketId);
    } catch (error) {
      console.error("QR scan error:", error);
      toast.error("❌ Invalid QR code format");
    }
  };

  const handleManualEntry = async () => {
    if (!manualTicketId.trim()) {
      toast.error("Please enter a ticket ID");
      return;
    }
    await verifyTicket(manualTicketId.trim());
    setManualTicketId("");
  };

  const getStatusConfig = (status) => {
    switch (status) {
      case "valid":
        return {
          border: "border-[#FE760B]/40 dark:border-[#FE760B]/30",
          bg: "bg-orange-50 dark:bg-[#FE760B]/10",
          icon: (
            <CheckCircle2 className="w-6 h-6 text-[#FE760B]" />
          ),
          title: "✅ ENTRY ALLOWED",
          accent: "text-[#FE760B]",
        };
      case "already_used":
        return {
          border: "border-red-300 dark:border-red-500/30",
          bg: "bg-red-50 dark:bg-red-500/10",
          icon: <X className="w-6 h-6 text-red-600 dark:text-red-400" />,
          title: "❌ ENTRY DENIED - Already Used",
          accent: "text-red-700 dark:text-red-400",
        };
      case "not_found":
        return {
          border: "border-orange-300 dark:border-orange-500/30",
          bg: "bg-orange-50 dark:bg-orange-500/10",
          icon: (
            <AlertCircle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
          ),
          title: "❌ INVALID TICKET",
          accent: "text-orange-700 dark:text-orange-400",
        };
      default:
        return {
          border: "border-gray-300 dark:border-[#FE760B]/20",
          bg: "bg-gray-50 dark:bg-black/50",
          icon: (
            <AlertCircle className="w-6 h-6 text-gray-500 dark:text-slate-400" />
          ),
          title: "❌ ERROR",
          accent: "text-gray-700 dark:text-slate-400",
        };
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="opacity-0 animate-fade-in-up">
        <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white">
          QR Ticket Verification
        </h2>
        <p className="text-gray-500 dark:text-slate-400 mt-1">
          Scan or enter ticket IDs for event entry verification
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Scanner / Manual Entry */}
        <div className="lg:col-span-2 space-y-6">
          {/* Mode Switcher */}
          <div className="flex gap-2 p-1 rounded-xl bg-[#FE760B]/10 dark:bg-black/50 border border-[#FE760B]/20 opacity-0 animate-fade-in-up stagger-1">
            <button
              onClick={() => setUseManualEntry(false)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                !useManualEntry
                  ? "bg-white dark:bg-black text-[#FE760B] shadow-sm border border-[#FE760B]/30"
                  : "text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300"
              }`}
            >
              <Camera className="w-4 h-4" /> Camera Scanner
            </button>
            <button
              onClick={() => setUseManualEntry(true)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                useManualEntry
                  ? "bg-white dark:bg-black text-[#FE760B] shadow-sm border border-[#FE760B]/30"
                  : "text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300"
              }`}
            >
              <Keyboard className="w-4 h-4" /> Manual Entry
            </button>
          </div>

          {!useManualEntry ? (
            <div className="rounded-2xl border bg-white dark:bg-black/50 border-[#FE760B]/20 dark:border-[#FE760B]/20 overflow-hidden opacity-0 animate-scale-in">
              {/* Scanner Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#FE760B]/10 dark:border-[#FE760B]/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FE760B] to-[#FEDF05] flex items-center justify-center">
                    <ScanLine className="w-5 h-5 text-black" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white">
                      Camera Scanner
                    </h3>
                    <p className="text-xs text-gray-400 dark:text-slate-500">
                      Point camera at QR code
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {scannerReady && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FE760B]/10 border border-[#FE760B]/20">
                      <div className="w-2 h-2 bg-[#FE760B] rounded-full animate-pulse" />
                      <span className="text-xs font-medium text-[#FE760B]">
                        Ready
                      </span>
                    </div>
                  )}
                  {isProcessing && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FE760B]/10 border border-[#FE760B]/20">
                      <div className="w-3.5 h-3.5 border-2 border-[#FE760B] border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs font-medium text-[#FE760B]">
                        Processing...
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Camera View */}
              <div className="bg-black relative">
                <div className="text-center text-white text-sm py-3 px-4 bg-black border-b border-[#FE760B]/20 flex items-center justify-center gap-2">
                  <QrCode className="w-4 h-4 text-[#FE760B]" />
                  Hold QR code steady in the camera view
                </div>
                <Html5QrcodePlugin
                  fps={15}
                  qrbox={350}
                  aspectRatio={1.0}
                  disableFlip={false}
                  onSuccess={handleQRScan}
                  onReady={() => setScannerReady(true)}
                  onError={(error) => console.log("Scanner error:", error)}
                />
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border bg-white dark:bg-black/50 border-[#FE760B]/20 p-8 opacity-0 animate-scale-in">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FE760B] to-[#FEDF05] flex items-center justify-center">
                  <Keyboard className="w-5 h-5 text-black" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white">
                    Manual Ticket Entry
                  </h3>
                  <p className="text-xs text-gray-400 dark:text-slate-500">
                    Enter ticket ID manually for verification
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-600 dark:text-slate-300">
                    Ticket ID
                  </label>
                  <div className="relative input-glow rounded-xl">
                    <QrCode className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
                    <Input
                      placeholder="Enter ticket ID (e.g., TKT-1704067890-ABC123)"
                      value={manualTicketId}
                      onChange={(e) => setManualTicketId(e.target.value)}
                      onKeyPress={(e) =>
                        e.key === "Enter" && handleManualEntry()
                      }
                      className="h-12 pl-10 text-base bg-gray-50 dark:bg-black border-[#FE760B]/30 dark:border-[#FE760B]/30 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-600 focus:border-[#FE760B] dark:focus:border-[#FE760B] rounded-xl"
                      autoFocus
                      disabled={isProcessing}
                    />
                  </div>
                </div>
                <Button
                  onClick={handleManualEntry}
                  disabled={isProcessing}
                  className="w-full h-12 gap-2 bg-gradient-to-r from-[#FE760B] to-[#FEDF05] hover:opacity-90 text-black font-bold shadow-lg shadow-[#FE760B]/20 rounded-xl"
                >
                  {isProcessing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{" "}
                      Processing...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" /> Verify Ticket
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Last Scanned Result */}
          {lastScannedResult &&
            (() => {
              const cfg = getStatusConfig(lastScannedResult.status);
              return (
                <div
                  className={`rounded-2xl border-2 p-6 ${cfg.border} ${cfg.bg} opacity-0 animate-scale-in`}
                >
                  <div className="flex items-start gap-4">
                    <div className="pt-1">{cfg.icon}</div>
                    <div className="flex-1">
                      <h4 className={`font-bold text-lg mb-3 ${cfg.accent}`}>
                        {cfg.title}
                      </h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium text-gray-500 dark:text-slate-400">
                            Ticket ID:
                          </span>
                          <p className="font-mono text-gray-900 dark:text-white mt-0.5">
                            {lastScannedResult.ticketId}
                          </p>
                        </div>
                        {lastScannedResult.user && (
                          <div>
                            <span className="font-medium text-gray-500 dark:text-slate-400">
                              Attendee:
                            </span>
                            <p className="text-gray-900 dark:text-white mt-0.5">
                              {lastScannedResult.user}
                            </p>
                          </div>
                        )}
                        {lastScannedResult.email && (
                          <div>
                            <span className="font-medium text-gray-500 dark:text-slate-400">
                              Email:
                            </span>
                            <p className="text-gray-900 dark:text-white mt-0.5">
                              {lastScannedResult.email}
                            </p>
                          </div>
                        )}
                        <div>
                          <span className="font-medium text-gray-500 dark:text-slate-400">
                            Scanned At:
                          </span>
                          <p className="text-gray-900 dark:text-white mt-0.5">
                            {lastScannedResult.scannedAt.toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
        </div>

        {/* Scan History */}
        <div className="lg:col-span-1">
          <div className="rounded-2xl border bg-white dark:bg-black/50 border-[#FE760B]/20 p-6 h-full opacity-0 animate-fade-in-up stagger-2">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-5 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#FE760B]/10 flex items-center justify-center">
                <Clock className="w-4 h-4 text-[#FE760B]" />
              </div>
              Recent Scans
            </h3>
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {scanHistory.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-14 h-14 rounded-full bg-[#FE760B]/10 flex items-center justify-center mx-auto mb-3">
                    <ScanLine className="w-7 h-7 text-[#FE760B]/40" />
                  </div>
                  <p className="text-sm text-gray-400 dark:text-slate-500">
                    No scans yet. Start scanning tickets!
                  </p>
                </div>
              ) : (
                scanHistory.map((scan, idx) => {
                  const isValid = scan.status === "valid";
                  return (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-xl text-sm border-l-4 transition-all ${
                        isValid
                          ? "bg-orange-50 dark:bg-[#FE760B]/5 border-[#FE760B]"
                          : scan.status === "already_used"
                            ? "bg-red-50 dark:bg-red-500/5 border-red-400"
                            : "bg-orange-50 dark:bg-orange-500/5 border-orange-400"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {isValid ? (
                          <UserCheck className="w-4 h-4 text-[#FE760B]" />
                        ) : (
                          <X className="w-4 h-4 text-red-600 dark:text-red-400" />
                        )}
                        <span className="font-medium text-gray-900 dark:text-white">
                          {scan.user || "Unknown"}
                        </span>
                      </div>
                      <p className="text-xs font-mono text-gray-500 dark:text-slate-400 mb-1 truncate">
                        {scan.ticketId}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-slate-500">
                        {scan.scannedAt.toLocaleTimeString()}
                      </p>
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
