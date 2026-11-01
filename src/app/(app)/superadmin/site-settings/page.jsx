"use client";

import { useEffect, useState, useRef } from "react";
import { Calendar, Loader2 } from "lucide-react";
import { toast } from "sonner";

const DEFAULT_COUNTDOWN_AT = "2026-11-07T10:00:00+05:30";

function toLocalInput(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function formatDisplayDate(isoOrLocal) {
  if (!isoOrLocal) return "07/11/2026, 10:00 am";
  try {
    const d = new Date(isoOrLocal);
    if (isNaN(d.getTime())) return "07/11/2026, 10:00 am";
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    const timeStr = d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).toLowerCase();
    return `${day}/${month}/${year}, ${timeStr}`;
  } catch {
    return "07/11/2026, 10:00 am";
  }
}

function formatLastSaved(ts) {
  if (!ts) return "Last saved 27 Oct, 4:12 PM";
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return "Last saved 27 Oct, 4:12 PM";
    const dayMonth = d.toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
    });
    const timeStr = d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    return `Last saved ${dayMonth}, ${timeStr}`;
  } catch {
    return "Last saved 27 Oct, 4:12 PM";
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

export default function SiteSettingsPage() {
  const [savedCountdownAt, setSavedCountdownAt] = useState("");
  const [countdownAt, setCountdownAt] = useState("");
  const [lastSavedTime, setLastSavedTime] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const datePickerRef = useRef(null);

  // Live countdown preview ticker
  const [remaining, setRemaining] = useState({
    days: 6,
    hours: 19,
    minutes: 3,
    seconds: 5,
  });

  useEffect(() => {
    let active = true;
    fetch("/api/site-settings/countdown", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Could not load countdown date");
        return res.json();
      })
      .then((data) => {
        if (active) {
          const raw = data.countdownAt || DEFAULT_COUNTDOWN_AT;
          const localVal = toLocalInput(raw);
          setSavedCountdownAt(localVal);
          setCountdownAt(localVal);
          setLastSavedTime(data.updatedAt || new Date().toISOString());
        }
      })
      .catch((err) => {
        if (active) {
          const fallback = toLocalInput(DEFAULT_COUNTDOWN_AT);
          setSavedCountdownAt(fallback);
          setCountdownAt(fallback);
          toast.error(err?.message || "Failed to load countdown settings");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

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

  const isSaved = savedCountdownAt === countdownAt;

  const handleDiscard = () => {
    setCountdownAt(savedCountdownAt);
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
      const res = await fetch("/api/site-settings/countdown", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ countdownAt: new Date(countdownAt).toISOString() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save settings");
      setSavedCountdownAt(countdownAt);
      setLastSavedTime(data.updatedAt || new Date().toISOString());
      toast.success("Homepage countdown updated successfully.");
    } catch (err) {
      toast.error(err?.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Page Heading matching Image 2 */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Site settings
        </h1>
        <p className="text-xs sm:text-sm text-[#9B9EA4] mt-1">
          Settings for the public TicketLelo website.
        </p>
      </div>

      {/* Main Card: Homepage countdown matching Image 2 */}
      <div className="w-full rounded-2xl border border-[#2A2D31] bg-[#1A1C1F] p-6 sm:p-7 shadow-sm space-y-6">
        {/* Card Header: Title + Status Pill */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">Homepage countdown</h2>
            <p className="text-xs text-[#9B9EA4] mt-0.5">
              When the countdown on the public homepage ends.
            </p>
          </div>

          {/* Status badge pill matching Image 2 */}
          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
              isSaved
                ? "bg-[#3DD68C]/15 text-[#3DD68C] border border-[#3DD68C]/30"
                : "bg-[#FE760B]/15 text-[#FE760B] border border-[#FE760B]/30"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isSaved ? "bg-[#3DD68C]" : "bg-[#FE760B] animate-pulse"
              }`}
            />
            <span>{isSaved ? "Saved" : "Unsaved"}</span>
          </div>
        </div>

        {/* Card Body: End date & time on left, PREVIEW boxes on right */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* Left Column: End date & time input */}
          <div className="md:col-span-7 space-y-1.5">
            <label className="text-xs font-semibold text-[#9B9EA4] block">
              End date & time
            </label>

            {/* Input field matching Image 2 */}
            <div className="relative">
              <input
                ref={datePickerRef}
                type="datetime-local"
                value={countdownAt}
                onChange={(e) => setCountdownAt(e.target.value)}
                disabled={loading || saving}
                className="w-full h-11 px-3.5 pr-10 rounded-xl bg-[#212327] border border-[#2A2D31] text-xs sm:text-sm font-mono text-white outline-none focus:border-[#FE760B] transition-colors dark:[color-scheme:dark]"
              />
              <button
                type="button"
                onClick={() => datePickerRef.current?.showPicker?.() || datePickerRef.current?.focus()}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9B9EA4] hover:text-white transition-colors"
                title="Choose date and time"
              >
                <Calendar className="w-4 h-4 pointer-events-none" />
              </button>
            </div>

            <p className="text-[11px] text-[#71767B] leading-relaxed pt-1">
              Entered in your time (IST). Visitors see the same moment in their own time zone.
            </p>
          </div>

          {/* Right Column: PREVIEW 4 boxes matching Image 2 */}
          <div className="md:col-span-5 space-y-1.5">
            <span className="text-[10px] font-bold text-[#71767B] tracking-wider uppercase block">
              PREVIEW
            </span>

            <div className="grid grid-cols-4 gap-2">
              {/* Days Box */}
              <div className="bg-[#212327] border border-[#2A2D31] rounded-xl p-2.5 text-center flex flex-col items-center justify-center min-w-[50px]">
                <span className="text-lg sm:text-xl font-extrabold text-white font-mono leading-none">
                  {remaining.days}
                </span>
                <span className="text-[9px] font-bold text-[#71767B] uppercase tracking-wider mt-1.5">
                  DAYS
                </span>
              </div>

              {/* Hours Box */}
              <div className="bg-[#212327] border border-[#2A2D31] rounded-xl p-2.5 text-center flex flex-col items-center justify-center min-w-[50px]">
                <span className="text-lg sm:text-xl font-extrabold text-white font-mono leading-none">
                  {String(remaining.hours).padStart(2, "0")}
                </span>
                <span className="text-[9px] font-bold text-[#71767B] uppercase tracking-wider mt-1.5">
                  HRS
                </span>
              </div>

              {/* Minutes Box */}
              <div className="bg-[#212327] border border-[#2A2D31] rounded-xl p-2.5 text-center flex flex-col items-center justify-center min-w-[50px]">
                <span className="text-lg sm:text-xl font-extrabold text-white font-mono leading-none">
                  {String(remaining.minutes).padStart(2, "0")}
                </span>
                <span className="text-[9px] font-bold text-[#71767B] uppercase tracking-wider mt-1.5">
                  MIN
                </span>
              </div>

              {/* Seconds Box */}
              <div className="bg-[#212327] border border-[#2A2D31] rounded-xl p-2.5 text-center flex flex-col items-center justify-center min-w-[50px]">
                <span className="text-lg sm:text-xl font-extrabold text-white font-mono leading-none">
                  {String(remaining.seconds).padStart(2, "0")}
                </span>
                <span className="text-[9px] font-bold text-[#71767B] uppercase tracking-wider mt-1.5">
                  SEC
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card Bottom Bar: Last saved on left, Discard & Save settings on right */}
        <div className="border-t border-[#2A2D31] pt-5 flex items-center justify-between flex-wrap gap-3">
          <div className="text-xs text-[#71767B]">
            {formatLastSaved(lastSavedTime)}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleDiscard}
              disabled={isSaved || saving}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-[#9B9EA4] hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Discard
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving || loading}
              className="px-4 py-2 rounded-xl bg-[#FE760B] hover:bg-[#FE760B]/90 text-[#131517] font-semibold text-xs transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#131517]" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save settings</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
