"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import {
  Calendar,
  Loader2,
  Sliders,
  CheckCircle2,
  Save,
  RotateCcw,
  AlertCircle,
  Power,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { auth } from "@/lib/firebase";
import { getCachedItem, setCachedItem } from "@/lib/client-cache";

const DEFAULT_COUNTDOWN_AT = "2026-11-07T10:00:00+05:30";
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

function toLocalInput(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function formatDisplayDateTime(value) {
  if (!value) return "";
  try {
    const parts = value.split("T");
    if (parts.length >= 2) {
      const [y, m, d] = parts[0].split("-").map(Number);
      const [hr, min] = parts[1].split(":").map(Number);
      if (y && m && d) {
        const dStr = String(d).padStart(2, "0");
        const mStr = String(m).padStart(2, "0");
        const hrStr = String(Number.isFinite(hr) ? hr : 0).padStart(2, "0");
        const minStr = String(Number.isFinite(min) ? min : 0).padStart(2, "0");
        return `${dStr}/${mStr}/${y}, ${hrStr}:${minStr}`;
      }
    }
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      const dStr = String(d.getDate()).padStart(2, "0");
      const mStr = String(d.getMonth() + 1).padStart(2, "0");
      const y = d.getFullYear();
      const hrStr = String(d.getHours()).padStart(2, "0");
      const minStr = String(d.getMinutes()).padStart(2, "0");
      return `${dStr}/${mStr}/${y}, ${hrStr}:${minStr}`;
    }
  } catch {}
  return value;
}

function parseCountdownDate(value) {
  if (!value) {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 60);
    return {
      year: now.getFullYear(),
      month: now.getMonth(),
      day: now.getDate(),
      hour: now.getHours(),
      minute: Math.floor(now.getMinutes() / 5) * 5,
    };
  }
  try {
    const parts = value.split("T");
    if (parts.length >= 2) {
      const [y, m, d] = parts[0].split("-").map(Number);
      const [hr, min] = parts[1].split(":").map(Number);
      if (y && m && d) {
        return {
          year: y,
          month: m - 1,
          day: d,
          hour: Number.isFinite(hr) ? hr : 0,
          minute: Number.isFinite(min) ? min : 0,
        };
      }
    }
    const dateObj = new Date(value);
    if (!Number.isNaN(dateObj.getTime())) {
      return {
        year: dateObj.getFullYear(),
        month: dateObj.getMonth(),
        day: dateObj.getDate(),
        hour: dateObj.getHours(),
        minute: dateObj.getMinutes(),
      };
    }
  } catch {}
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth(),
    day: now.getDate(),
    hour: now.getHours(),
    minute: 0,
  };
}

function buildDateTimeStr(year, month, day, hour, minute) {
  const yStr = String(year);
  const mStr = String(month + 1).padStart(2, "0");
  const dStr = String(day).padStart(2, "0");
  const hrStr = String(hour).padStart(2, "0");
  const minStr = String(minute).padStart(2, "0");
  return `${yStr}-${mStr}-${dStr}T${hrStr}:${minStr}`;
}

// Themed Date & Time Picker Popover matching the Event Calendar dark theme & #FE760B styling
function ThemedDateTimePickerPopover({ value, onChange, onClose, onClear }) {
  const parsed = useMemo(() => parseCountdownDate(value), [value]);

  const [viewDate, setViewDate] = useState(() => new Date(parsed.year, parsed.month, 1));
  const [selectedDay, setSelectedDay] = useState(parsed.day);
  const [selectedHour, setSelectedHour] = useState(parsed.hour);
  const [selectedMinute, setSelectedMinute] = useState(parsed.minute);

  const activeHourRef = useRef(null);
  const activeMinRef = useRef(null);

  useEffect(() => {
    setSelectedDay(parsed.day);
    setSelectedHour(parsed.hour);
    setSelectedMinute(parsed.minute);
    setViewDate(new Date(parsed.year, parsed.month, 1));
  }, [value]);

  useEffect(() => {
    if (activeHourRef.current) {
      activeHourRef.current.scrollIntoView({ block: "center", behavior: "auto" });
    }
    if (activeMinRef.current) {
      activeMinRef.current.scrollIntoView({ block: "center", behavior: "auto" });
    }
  }, []);

  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();
  const monthName = viewDate.toLocaleDateString("en-US", { month: "long" });

  const prevMonth = (e) => {
    e.stopPropagation();
    setViewDate(new Date(viewYear, viewMonth - 1, 1));
  };

  const nextMonth = (e) => {
    e.stopPropagation();
    setViewDate(new Date(viewYear, viewMonth + 1, 1));
  };

  const { prevDays, currentDays, nextDays } = useMemo(() => {
    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sun
    const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const prev = [];
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      prev.push(daysInPrevMonth - i);
    }

    const current = [];
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      current.push(d);
    }

    const total = prev.length + current.length;
    const remaining = (7 - (total % 7)) % 7;
    const next = [];
    for (let d = 1; d <= remaining; d++) {
      next.push(d);
    }

    return { prevDays: prev, currentDays: current, nextDays: next };
  }, [viewYear, viewMonth]);

  const emitChange = (y, m, d, hr, min) => {
    const nextVal = buildDateTimeStr(y, m, d, hr, min);
    onChange(nextVal);
  };

  const handleSelectDay = (day) => {
    setSelectedDay(day);
    emitChange(viewYear, viewMonth, day, selectedHour, selectedMinute);
  };

  const handleSelectHour = (hr) => {
    setSelectedHour(hr);
    emitChange(viewYear, viewMonth, selectedDay, hr, selectedMinute);
  };

  const handleSelectMinute = (min) => {
    setSelectedMinute(min);
    emitChange(viewYear, viewMonth, selectedDay, selectedHour, min);
  };

  const handleToday = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 15);
    const y = now.getFullYear();
    const m = now.getMonth();
    const d = now.getDate();
    const hr = now.getHours();
    const min = Math.floor(now.getMinutes() / 5) * 5;
    setViewDate(new Date(y, m, 1));
    setSelectedDay(d);
    setSelectedHour(hr);
    setSelectedMinute(min);
    emitChange(y, m, d, hr, min);
  };

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        onClick={(e) => e.stopPropagation()}
        className="absolute top-full mt-2 left-0 z-50 bg-[#181512] dark:bg-[#181512] border border-white/20 rounded-2xl shadow-2xl p-3.5 sm:p-4 select-none animate-in fade-in zoom-in-95 duration-100 max-w-[calc(100vw-2rem)]"
        style={{
          boxShadow: "0 20px 40px -10px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.15)",
        }}
      >
        <div className="flex flex-row gap-3 items-stretch">
          {/* Calendar side */}
          <div className="w-[230px] sm:w-[245px]">
            {/* Header: Month Year + Arrows */}
            <div className="flex items-center justify-between mb-2.5 px-1">
              <span className="text-xs sm:text-sm font-bold text-white tracking-wide">
                {monthName} {viewYear}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={prevMonth}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  title="Previous month"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={nextMonth}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  title="Next month"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Weekdays */}
            <div className="grid grid-cols-7 gap-1 text-center mb-1">
              {["S", "M", "T", "W", "T", "F", "S"].map((day, idx) => (
                <div key={idx} className="text-[11px] font-medium text-white/50 py-1">
                  {day}
                </div>
              ))}
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {prevDays.map((d, idx) => (
                <div
                  key={`prev-${idx}`}
                  className="h-8 flex items-center justify-center text-xs text-white/20 select-none"
                >
                  {d}
                </div>
              ))}
              {currentDays.map((d) => {
                const isSelected =
                  parsed.year === viewYear &&
                  parsed.month === viewMonth &&
                  selectedDay === d;

                return (
                  <button
                    key={`curr-${d}`}
                    type="button"
                    onClick={() => handleSelectDay(d)}
                    className={`h-8 w-8 mx-auto flex items-center justify-center text-xs rounded-xl transition-all cursor-pointer ${
                      isSelected
                        ? "bg-[#FE760B] text-white font-bold shadow-md ring-1 ring-[#FE760B]/40"
                        : "text-white/80 hover:bg-white/10 hover:text-white font-medium"
                    }`}
                  >
                    {d}
                  </button>
                );
              })}
              {nextDays.map((d, idx) => (
                <div
                  key={`next-${idx}`}
                  className="h-8 flex items-center justify-center text-xs text-white/20 select-none"
                >
                  {d}
                </div>
              ))}
            </div>
          </div>

          {/* Time Picker Columns */}
          <div className="border-l border-white/15 pl-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2 px-1">
                <span className="w-8 sm:w-9 text-center">HR</span>
                <span className="w-8 sm:w-9 text-center">MIN</span>
              </div>
              <div className="flex gap-1.5 h-[216px]">
                {/* Hours column */}
                <div className="w-8 sm:w-9 overflow-y-auto space-y-0.5 custom-scrollbar pr-0.5 h-full">
                  {HOURS.map((hr) => {
                    const isSelected = selectedHour === hr;
                    return (
                      <button
                        key={hr}
                        ref={isSelected ? activeHourRef : null}
                        type="button"
                        onClick={() => handleSelectHour(hr)}
                        className={`w-full py-1 text-xs font-mono text-center rounded-lg transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-[#FE760B] text-white font-bold shadow-sm"
                            : "text-white/70 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        {String(hr).padStart(2, "0")}
                      </button>
                    );
                  })}
                </div>

                {/* Minutes column */}
                <div className="w-8 sm:w-9 overflow-y-auto space-y-0.5 custom-scrollbar pr-0.5 h-full">
                  {MINUTES.map((min) => {
                    const isSelected = selectedMinute === min;
                    return (
                      <button
                        key={min}
                        ref={isSelected ? activeMinRef : null}
                        type="button"
                        onClick={() => handleSelectMinute(min)}
                        className={`w-full py-1 text-xs font-mono text-center rounded-lg transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-[#FE760B] text-white font-bold shadow-sm"
                            : "text-white/70 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        {String(min).padStart(2, "0")}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 mt-3 border-t border-white/15 text-xs">
          <button
            type="button"
            onClick={onClear}
            className="text-white/50 hover:text-rose-400 font-medium transition-colors cursor-pointer"
          >
            Clear
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToday}
              className="text-[#FE760B] hover:text-[#FF8A2B] font-semibold transition-colors cursor-pointer px-2 py-0.5 rounded hover:bg-[#FE760B]/10"
            >
              Today
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 bg-[#FE760B] hover:bg-[#FF8A2B] text-white font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </>
  );
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
  const cachedSettings = typeof window !== "undefined" ? getCachedItem("superadmin_site_settings") : null;
  const initialCountdown = cachedSettings?.countdownAt ? toLocalInput(cachedSettings.countdownAt) : toLocalInput(DEFAULT_COUNTDOWN_AT);
  const [savedCountdownAt, setSavedCountdownAt] = useState(() => initialCountdown);
  const [countdownAt, setCountdownAt] = useState(() => initialCountdown);
  const [savedCountdownEnabled, setSavedCountdownEnabled] = useState(() => cachedSettings?.countdownEnabled !== false);
  const [countdownEnabled, setCountdownEnabled] = useState(() => cachedSettings?.countdownEnabled !== false);
  const [lastSavedTime, setLastSavedTime] = useState(() => cachedSettings?.updatedAt || "");
  const [loading, setLoading] = useState(() => !cachedSettings);
  const [saving, setSaving] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const datePickerRef = useRef(null);

  useEffect(() => {
    if (datePickerRef.current) {
      datePickerRef.current.showPicker = () => setIsPickerOpen(true);
    }
  }, []);

  // Platform operational settings
  const [siteConfig, setSiteConfig] = useState(() => cachedSettings?.siteConfig || {
    platformName: "TicketLelo",
    supportEmail: "support@ticketlelo.com",
    serviceFeePercent: "2.5",
    maintenanceMode: false,
    publicDiscovery: true,
  });
  const [savedSiteConfig, setSavedSiteConfig] = useState(() => cachedSettings?.siteConfig || {
    platformName: "TicketLelo",
    supportEmail: "support@ticketlelo.com",
    serviceFeePercent: "2.5",
    maintenanceMode: false,
    publicDiscovery: true,
  });

  // Live countdown preview ticker
  const [remaining, setRemaining] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
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
          const raw = data.countdownAt || "";
          const localVal = raw ? toLocalInput(raw) : "";
          const isEnabled = Boolean(data.countdownEnabled);
          setSavedCountdownAt(localVal);
          setCountdownAt(localVal);
          setSavedCountdownEnabled(isEnabled);
          setCountdownEnabled(isEnabled);
          setLastSavedTime(data.updatedAt || new Date().toISOString());

          if (data.siteConfig) {
            setSiteConfig(data.siteConfig);
            setSavedSiteConfig(data.siteConfig);
          }

          setCachedItem(
            "superadmin_site_settings",
            {
              countdownAt: raw,
              countdownEnabled: isEnabled,
              updatedAt: data.updatedAt || new Date().toISOString(),
              siteConfig: data.siteConfig || null,
            },
            15 * 60 * 1000
          );
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
      if (countdownEnabled && countdownAt) {
        setRemaining(calculateRemaining(countdownAt));
      } else {
        setRemaining({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [countdownAt, countdownEnabled]);

  const isCountdownDateSaved = savedCountdownAt === countdownAt;
  const isCountdownToggleSaved = savedCountdownEnabled === countdownEnabled;
  const isCountdownSaved = isCountdownDateSaved && isCountdownToggleSaved;
  const isConfigSaved = JSON.stringify(siteConfig) === JSON.stringify(savedSiteConfig);
  const isAllSaved = isCountdownSaved && isConfigSaved;

  const isPastDate = Boolean(countdownAt && new Date(countdownAt).getTime() <= Date.now());

  const handleDiscard = () => {
    setCountdownAt(savedCountdownAt);
    setCountdownEnabled(savedCountdownEnabled);
    setSiteConfig(savedSiteConfig);
    setIsPickerOpen(false);
    toast.info("Changes discarded");
  };

  const handleClearCountdown = () => {
    setCountdownEnabled(false);
    setCountdownAt("");
    setIsPickerOpen(false);
    toast.info("Countdown cleared. Click 'Save settings' to apply.");
  };

  const handleSave = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (countdownEnabled) {
      if (!countdownAt || Number.isNaN(new Date(countdownAt).getTime())) {
        toast.error("Please pick a valid target date and time.");
        return;
      }
      if (new Date(countdownAt).getTime() <= Date.now()) {
        toast.error("Countdown target date cannot be in the past. Please select a future date and time.");
        return;
      }
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
          countdownAt: countdownEnabled && countdownAt ? new Date(countdownAt).toISOString() : null,
          countdownEnabled,
          siteConfig,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save settings");
      setSavedCountdownAt(countdownAt);
      setSavedCountdownEnabled(countdownEnabled);
      setSavedSiteConfig(siteConfig);
      setLastSavedTime(data.updatedAt || new Date().toISOString());
      toast.success(
        countdownEnabled
          ? "Site settings updated: Homepage countdown active."
          : "Site settings updated: Homepage countdown disabled."
      );
    } catch (err) {
      toast.error(err?.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            Site settings
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-[#9B9EA4] mt-1">
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
        {/* Card Header: Title + Status Pill + Enable Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Homepage Countdown</h3>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  countdownEnabled && !isPastDate
                    ? "bg-[#3DD68C]/15 text-[#3DD68C] border border-[#3DD68C]/30"
                    : "bg-slate-200 dark:bg-[#2A2D31] text-slate-600 dark:text-[#9B9EA4]"
                }`}
              >
                {countdownEnabled ? (isPastDate ? "Expired Date" : "Active") : "Disabled"}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-[#9B9EA4] mt-0.5">
              The live global countdown timer displayed to all visitors on the public TicketLelo homepage.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setCountdownEnabled(!countdownEnabled)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                countdownEnabled
                  ? "bg-[#3DD68C]/10 border-[#3DD68C]/30 text-[#3DD68C] hover:bg-[#3DD68C]/20"
                  : "bg-slate-100 dark:bg-[#212327] border-slate-300 dark:border-[#2A2D31] text-slate-600 dark:text-[#9B9EA4] hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Power className="w-3.5 h-3.5" />
              <span>{countdownEnabled ? "Enabled" : "Disabled"}</span>
            </button>

            <button
              type="button"
              onClick={handleClearCountdown}
              disabled={loading || saving}
              className="px-3 py-1.5 rounded-xl border border-rose-500/20 text-rose-500 hover:bg-rose-500/10 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40"
              title="Clear countdown date and disable"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>

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
        </div>

        {/* Card Body: End date & time on left, PREVIEW boxes on right */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* Left Column: End date & time input */}
          <div className="md:col-span-6 space-y-2">
            <label className="text-xs font-semibold text-slate-700 dark:text-[#9B9EA4] block">
              Countdown Target Date &amp; Time
            </label>

            <div className="relative">
              <div
                role="button"
                tabIndex={countdownEnabled && !loading && !saving ? 0 : -1}
                onClick={() => {
                  if (countdownEnabled && !loading && !saving) {
                    setIsPickerOpen((prev) => !prev);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (countdownEnabled && !loading && !saving) {
                      setIsPickerOpen((prev) => !prev);
                    }
                  }
                }}
                aria-haspopup="dialog"
                aria-expanded={isPickerOpen}
                className={`w-full h-11 px-3.5 pr-10 rounded-xl border text-xs sm:text-sm font-mono text-left transition-all flex items-center justify-between select-none ${
                  !countdownEnabled
                    ? "bg-slate-100 dark:bg-[#1D1F23] border-slate-200 dark:border-[#2A2D31] text-slate-400 dark:text-[#71767B] opacity-50 cursor-not-allowed"
                    : isPastDate
                    ? "bg-rose-500/5 border-rose-500/50 text-slate-900 dark:text-white focus:border-rose-500 cursor-pointer"
                    : isPickerOpen
                    ? "bg-slate-50 dark:bg-[#212327] border-[#FE760B] text-slate-900 dark:text-white ring-1 ring-[#FE760B]/30 cursor-pointer"
                    : "bg-slate-50 dark:bg-[#212327] border-slate-200 dark:border-[#2A2D31] text-slate-900 dark:text-white hover:border-slate-300 dark:hover:border-white/20 cursor-pointer"
                }`}
              >
                <span className={countdownAt ? "text-slate-900 dark:text-white font-medium" : "text-slate-400 dark:text-[#71767B]"}>
                  {countdownAt ? formatDisplayDateTime(countdownAt) : "Select target date & time"}
                </span>
                <Calendar
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    isPickerOpen ? "text-[#FE760B]" : "text-slate-400 dark:text-[#9B9EA4]"
                  }`}
                />
              </div>

              {/* Underlying input with ref for programmatic access & form serialization */}
              <input
                ref={datePickerRef}
                type="hidden"
                name="countdownAt"
                value={countdownAt}
                onChange={(e) => setCountdownAt(e.target.value)}
              />

              {isPickerOpen && countdownEnabled && (
                <ThemedDateTimePickerPopover
                  value={countdownAt}
                  onChange={(newVal) => setCountdownAt(newVal)}
                  onClose={() => setIsPickerOpen(false)}
                  onClear={() => {
                    setCountdownAt("");
                    setIsPickerOpen(false);
                  }}
                />
              )}
            </div>

            {countdownEnabled && isPastDate && (
              <div className="flex items-center gap-1.5 text-xs text-rose-500 font-medium pt-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>The selected date is in the past. To display an active countdown, choose a future date.</span>
              </div>
            )}

            {!countdownEnabled && (
              <p className="text-[11px] text-amber-500 dark:text-amber-400 leading-relaxed font-medium">
                Countdown is currently disabled. Toggle &apos;Enabled&apos; and select a future target date to display the countdown.
              </p>
            )}

            {countdownEnabled && !isPastDate && (
              <p className="text-[11px] text-slate-400 dark:text-[#71767B] leading-relaxed">
                Target IST time. Visitors automatically see the accurate countdown synced across all time zones.
              </p>
            )}
          </div>

          {/* Right Column: PREVIEW 4 boxes */}
          <div className="md:col-span-6 space-y-2">
            <span className="text-[10px] font-bold text-slate-400 dark:text-[#71767B] tracking-wider uppercase block">
              {countdownEnabled && !isPastDate ? "LIVE PREVIEW ON HOMEPAGE" : "PREVIEW (COUNTDOWN DISABLED)"}
            </span>

            <div className={`grid grid-cols-4 gap-2 ${!countdownEnabled ? "opacity-40" : ""}`}>
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
