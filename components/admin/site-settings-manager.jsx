"use client";

import { useEffect, useState, useRef } from "react";
import {
  Calendar,
  Loader2,
  Sliders,
  CheckCircle2,
  Save,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { auth } from "@/lib/firebase";

const DEFAULT_COUNTDOWN_AT = "2026-11-07T10:00:00+05:30";

function toLocalInput(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function formatLastSaved(ts) {
  if (!ts) return "Last saved recently";
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return "Last saved recently";
    const dayMonth = d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
    });
    const timeStr = d.toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    return `Last saved ${dayMonth}, ${timeStr}`;
  } catch {
    return "Last saved recently";
  }
}

function calculateRemaining(target) {
  if (!target) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  const diff = Math.max(0, new Date(target).getTime() - Date.now());
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);
  return { days, hours, minutes, seconds };
}

export function SiteSettingsManager() {
  const [savedCountdownAt, setSavedCountdownAt] = useState("");
  const [countdownAt, setCountdownAt] = useState("");
  const [lastSavedTime, setLastSavedTime] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const datePickerRef = useRef(null);

  // Platform operational settings
  const [siteConfig, setSiteConfig] = useState({
    platformName: "TicketLelo",
    supportEmail: "support@ticketlelo.com",
    serviceFeePercent: "2.5",
    maintenanceMode: false,
    publicDiscovery: true,
  });
  const [savedSiteConfig, setSavedSiteConfig] = useState({
    platformName: "TicketLelo",
    supportEmail: "support@ticketlelo.com",
    serviceFeePercent: "2.5",
    maintenanceMode: false,
    publicDiscovery: true,
  });

  // Live countdown preview ticker
  const [remaining, setRemaining] = useState({
    days: 6,
    hours: 19,
    minutes: 3,
    seconds: 5,
  });

  useEffect(() => {
    let active = true;

    async function loadSettings() {
      try {
        let headers = {};
        try {
          if (auth?.currentUser) {
            const token = await auth.currentUser.getIdToken();
            if (token) headers.Authorization = `Bearer ${token}`;
          }
        } catch (_) {}

        const res = await fetch("/api/site-settings/countdown", { headers, cache: "no-store" });
        if (!res.ok) throw new Error("Could not load site settings");
        const data = await res.json();
        if (active) {
          const raw = data.countdownAt || DEFAULT_COUNTDOWN_AT;
          const localVal = toLocalInput(raw);
          setSavedCountdownAt(localVal);
          setCountdownAt(localVal);
          setLastSavedTime(data.updatedAt || new Date().toISOString());

          if (data.siteConfig) {
            setSiteConfig(data.siteConfig);
            setSavedSiteConfig(data.siteConfig);
          }
        }
      } catch (err) {
        if (active) {
          const fallback = toLocalInput(DEFAULT_COUNTDOWN_AT);
          setSavedCountdownAt(fallback);
          setCountdownAt(fallback);
          toast.error(err?.message || "Failed to load site settings");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadSettings();

    return () => {
      active = false;
    };
  }, []);

  // Update countdown clock every second
  useEffect(() => {
    const tick = () => {
      if (countdownAt) {
        setRemaining(calculateRemaining(countdownAt));
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [countdownAt]);

  const isCountdownSaved = savedCountdownAt === countdownAt;
  const isConfigSaved = JSON.stringify(siteConfig) === JSON.stringify(savedSiteConfig);
  const isAllSaved = isCountdownSaved && isConfigSaved;

  const handleDiscard = () => {
    setCountdownAt(savedCountdownAt);
    setSiteConfig(savedSiteConfig);
    toast.info("Changes discarded");
  };

  const handleSave = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!countdownAt || Number.isNaN(new Date(countdownAt).getTime())) {
      toast.error("Please pick a valid date and time.");
      return;
    }

    setSaving(true);
    try {
      let headers = { "Content-Type": "application/json" };
      try {
        if (auth?.currentUser) {
          const token = await auth.currentUser.getIdToken();
          if (token) headers.Authorization = `Bearer ${token}`;
        }
      } catch (_) {}

      const res = await fetch("/api/site-settings/countdown", {
        method: "PUT",
        headers,
        body: JSON.stringify({
          countdownAt: new Date(countdownAt).toISOString(),
          siteConfig,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save settings");
      setSavedCountdownAt(countdownAt);
      setSavedSiteConfig(siteConfig);
      setLastSavedTime(data.updatedAt || new Date().toISOString());
      toast.success("Site settings updated successfully.");
    } catch (err) {
      toast.error(err?.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Sliders className="w-6 h-6 text-[#FE760B]" />
            Site Settings &amp; Platform Configuration
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-[#9B9EA4] mt-0.5">
            Configure homepage countdown timer, platform metadata, and operational parameters.
          </p>
        </div>

        {/* Global Save / Discard Bar */}
        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={handleDiscard}
            disabled={isAllSaved || saving}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-[#9B9EA4] hover:text-slate-900 dark:hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Discard</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading || isAllSaved}
            className="px-4 py-2 rounded-xl bg-[#FE760B] hover:bg-[#FF8A2B] text-white font-bold text-xs transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {saving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5 text-white" />
                <span>Save settings</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Card 1: Homepage Countdown Timer */}
      <div className="w-full rounded-2xl border border-slate-200 dark:border-[#2A2D31] bg-white dark:bg-[#1A1C1F] p-5 sm:p-7 shadow-sm space-y-6">
        {/* Card Header: Title + Status Pill */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Homepage Countdown</h3>
            <p className="text-xs text-slate-500 dark:text-[#9B9EA4] mt-0.5">
              The live global countdown timer displayed to all visitors on the public TicketLelo homepage.
            </p>
          </div>

          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
              isCountdownSaved
                ? "bg-[#3DD68C]/15 text-[#3DD68C] border border-[#3DD68C]/30"
                : "bg-[#FE760B]/15 text-[#FE760B] border border-[#FE760B]/30"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isCountdownSaved ? "bg-[#3DD68C]" : "bg-[#FE760B] animate-pulse"
              }`}
            />
            <span>{isCountdownSaved ? "Saved" : "Unsaved"}</span>
          </div>
        </div>

        {/* Card Body: End date & time on left, PREVIEW boxes on right */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* Left Column: End date & time input */}
          <div className="md:col-span-6 space-y-2">
            <label className="text-xs font-semibold text-slate-700 dark:text-[#9B9EA4] block">
              Countdown Target Date &amp; Time
            </label>

            <div className="relative">
              <input
                ref={datePickerRef}
                type="datetime-local"
                value={countdownAt}
                onChange={(e) => setCountdownAt(e.target.value)}
                disabled={loading || saving}
                className="w-full h-11 px-3.5 pr-10 rounded-xl bg-slate-50 dark:bg-[#212327] border border-slate-200 dark:border-[#2A2D31] text-xs sm:text-sm font-mono text-slate-900 dark:text-white outline-none focus:border-[#FE760B] transition-colors dark:[color-scheme:dark]"
              />
              <button
                type="button"
                onClick={() => datePickerRef.current?.showPicker?.() || datePickerRef.current?.focus()}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#9B9EA4] hover:text-slate-900 dark:hover:text-white transition-colors"
                title="Choose date and time"
              >
                <Calendar className="w-4 h-4 pointer-events-none" />
              </button>
            </div>

            <p className="text-[11px] text-slate-400 dark:text-[#71767B] leading-relaxed">
              Target IST time. Visitors automatically see the accurate countdown synced across all time zones.
            </p>
          </div>

          {/* Right Column: PREVIEW 4 boxes */}
          <div className="md:col-span-6 space-y-2">
            <span className="text-[10px] font-bold text-slate-400 dark:text-[#71767B] tracking-wider uppercase block">
              LIVE PREVIEW ON HOMEPAGE
            </span>

            <div className="grid grid-cols-4 gap-2">
              {/* Days Box */}
              <div className="bg-slate-100 dark:bg-[#212327] border border-slate-200 dark:border-[#2A2D31] rounded-xl p-2.5 text-center flex flex-col items-center justify-center">
                <span className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white font-mono leading-none">
                  {remaining.days}
                </span>
                <span className="text-[9px] font-bold text-slate-400 dark:text-[#71767B] uppercase tracking-wider mt-1.5">
                  DAYS
                </span>
              </div>

              {/* Hours Box */}
              <div className="bg-slate-100 dark:bg-[#212327] border border-slate-200 dark:border-[#2A2D31] rounded-xl p-2.5 text-center flex flex-col items-center justify-center">
                <span className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white font-mono leading-none">
                  {String(remaining.hours).padStart(2, "0")}
                </span>
                <span className="text-[9px] font-bold text-slate-400 dark:text-[#71767B] uppercase tracking-wider mt-1.5">
                  HRS
                </span>
              </div>

              {/* Minutes Box */}
              <div className="bg-slate-100 dark:bg-[#212327] border border-slate-200 dark:border-[#2A2D31] rounded-xl p-2.5 text-center flex flex-col items-center justify-center">
                <span className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white font-mono leading-none">
                  {String(remaining.minutes).padStart(2, "0")}
                </span>
                <span className="text-[9px] font-bold text-slate-400 dark:text-[#71767B] uppercase tracking-wider mt-1.5">
                  MIN
                </span>
              </div>

              {/* Seconds Box */}
              <div className="bg-slate-100 dark:bg-[#212327] border border-slate-200 dark:border-[#2A2D31] rounded-xl p-2.5 text-center flex flex-col items-center justify-center">
                <span className="text-lg sm:text-2xl font-black text-[#FE760B] font-mono leading-none">
                  {String(remaining.seconds).padStart(2, "0")}
                </span>
                <span className="text-[9px] font-bold text-slate-400 dark:text-[#71767B] uppercase tracking-wider mt-1.5">
                  SEC
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card Footer: Timestamp */}
        <div className="border-t border-slate-200 dark:border-[#2A2D31] pt-3 text-xs text-slate-400 dark:text-[#71767B]">
          {formatLastSaved(lastSavedTime)}
        </div>
      </div>
    </div>
  );
}
