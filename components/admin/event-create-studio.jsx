"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Clock,
  Globe,
  MapPin,
  Ticket,
  Users,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Camera,
  Check,
  ChevronDown,
  Loader2,
  X,
  Upload,
  Radio,
  Video,
  ArrowLeft,
  Sparkles,
  Type,
  Sliders,
  Eye,
  Layers,
  Move,
  RotateCcw,
  Edit3,
  Pencil,
  ChevronLeft,
  ChevronRight,
  Bell,
  Lock,
  Palette,
  ExternalLink,
  Navigation,
  ImageIcon,
  Trash2,
  Plus,
  ChevronsUpDown,
  AlertTriangle,
  Monitor,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import { IoTicket, IoColorPalette, IoShuffle } from "react-icons/io5";
import { createEvent, updateEvent } from "@/lib/firestore";
import { useAuth } from "@/context/auth-context";
import { setCachedEvent, setCachedOrganiserEvents, getCachedOrganiserEvents } from "@/lib/client-cache";
import { StubTicket } from "@/components/tickets/stub-ticket";
import { TicketGraphic } from "@/components/tickets/ticket-graphic";
import { WideTicket } from "@/components/tickets/wide-ticket";
import { TicketDeckView } from "@/components/tickets/ticket-deck-view";
import { TicketFullPreviewModal } from "@/components/tickets/ticket-full-preview-modal";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { normalizeHex, isLightColor } from "@/lib/ticket-theme";
import { searchIndianVenues } from "@/lib/venues-catalog";

import { getPosterLines } from "@/lib/theme-utils";
export { getPosterLines };

export function deriveThemeFromColor(hexColor) {
  let hex = (hexColor || "#FE760B").trim();
  if (!hex.startsWith("#")) hex = "#" + hex;
  if (hex.length === 4) {
    hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }
  const isValid = /^#[0-9A-Fa-f]{6}$/.test(hex);
  const safeHex = isValid ? hex : "#FE760B";

  const r = parseInt(safeHex.slice(1, 3), 16) || 0;
  const g = parseInt(safeHex.slice(3, 5), 16) || 0;
  const b = parseInt(safeHex.slice(5, 7), 16) || 0;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  const darkBg = `rgb(${Math.max(12, Math.round(r * 0.4))}, ${Math.max(12, Math.round(g * 0.4))}, ${Math.max(14, Math.round(b * 0.4))})`;
  const brightSun = `rgb(${Math.min(255, Math.round(r * 1.25 + 25))}, ${Math.min(255, Math.round(g * 1.25 + 25))}, ${Math.min(255, Math.round(b * 1.25 + 25))})`;

  return {
    id: "custom",
    name: `Custom (${safeHex.toUpperCase()})`,
    color: safeHex,
    pageBg: darkBg,
    bg: darkBg,
    sun: brightSun,
    text: luminance > 0.55 ? "#131517" : "#FFFFFF",
  };
}

const THEMES = [
  {
    id: "minimal",
    name: "Minimal",
    color: "#FE760B",
    pageBg: "#131517",
    bg: "#131517",
    sun: "#FE760B",
    text: "#FFFFFF",
  },
  {
    id: "sunset",
    name: "Sunset",
    color: "#FE760B",
    pageBg: "#2B1605",
    bg: "#FE760B",
    sun: "#FB923C",
    text: "#131517",
  },
  {
    id: "sunny",
    name: "Sunny",
    color: "#FDE003",
    pageBg: "#261D02",
    bg: "#FE760B",
    sun: "#FDE003",
    text: "#131517",
  },
  {
    id: "electric",
    name: "Electric",
    color: "#2B59FF",
    pageBg: "#0B1536",
    bg: "#1D4ED8",
    sun: "#38BDF8",
    text: "#FFFFFF",
  },
  {
    id: "neon",
    name: "Neon",
    color: "#EC4899",
    pageBg: "#290A1A",
    bg: "#BE185D",
    sun: "#F43F5E",
    text: "#FFFFFF",
  },
  {
    id: "mint",
    name: "Mint",
    color: "#10B981",
    pageBg: "#062319",
    bg: "#047857",
    sun: "#34D399",
    text: "#FFFFFF",
  },
];

const ARTWORK_PRESETS = [
  {
    id: "squiggles",
    name: "Playful Squiggles",
    // Cream background (#FBF8EE) with artistic paint brush squiggles matching user screenshot
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="100%" height="100%"><rect width="400" height="400" fill="%23FBF8EE"/><path d="M40 70 Q90 10 140 60 T220 50" fill="none" stroke="%233B82F6" stroke-width="24" stroke-linecap="round"/><path d="M80 180 Q140 120 220 180 T340 160" fill="none" stroke="%23EF4444" stroke-width="26" stroke-linecap="round"/><path d="M30 260 Q90 320 160 270 T260 290" fill="none" stroke="%2310B981" stroke-width="24" stroke-linecap="round"/><path d="M190 80 Q250 20 320 70 T380 140" fill="none" stroke="%23F59E0B" stroke-width="24" stroke-linecap="round"/><path d="M280 200 Q360 260 300 340 T220 370" fill="none" stroke="%233B82F6" stroke-width="24" stroke-linecap="round"/><path d="M100 340 Q180 380 220 320" fill="none" stroke="%23F59E0B" stroke-width="26" stroke-linecap="round"/><circle cx="80" cy="90" r="14" fill="%23EF4444"/><circle cx="340" cy="270" r="14" fill="%2310B981"/></svg>`,
  },
  {
    id: "minimal-sunset",
    name: "Minimal Sunset",
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="100%" height="100%"><rect width="400" height="400" fill="%231E1508"/><circle cx="340" cy="80" r="160" fill="%23FE760B" opacity="0.95"/><circle cx="80" cy="320" r="120" fill="%23F59E0B" opacity="0.4"/><path d="M0 300 Q150 250 400 300 L400 400 L0 400 Z" fill="%232D1C08"/></svg>`,
  },
  {
    id: "abstract-waves",
    name: "Abstract Waves",
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="100%" height="100%"><rect width="400" height="400" fill="%230F172A"/><path d="M-50 200 C100 100 200 300 450 180 L450 400 L-50 400 Z" fill="%233B82F6" opacity="0.75"/><path d="M-50 260 C150 200 250 360 450 240 L450 400 L-50 400 Z" fill="%2310B981" opacity="0.65"/></svg>`,
  },
  {
    id: "aurora",
    name: "Aurora Glow",
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="100%" height="100%"><defs><linearGradient id="auroraG" x1="0%25" y1="0%25" x2="100%25" y2="100%25"><stop offset="0%25" stop-color="%23EC4899"/><stop offset="50%25" stop-color="%238B5CF6"/><stop offset="100%25" stop-color="%233B82F6"/></linearGradient></defs><rect width="400" height="400" fill="url(%23auroraG)"/></svg>`,
  },
];


// 30-minute interval time options from 12:00 am to 11:30 pm matching Image 2
const TIME_OPTIONS = (() => {
  const options = [];
  for (let hour = 0; hour < 24; hour++) {
    for (const min of [0, 30]) {
      const h12 = hour % 12 === 0 ? 12 : hour % 12;
      const ampm = hour < 12 ? "pm" : "pm"; // default format helper
      const actualAmpm = hour < 12 ? "am" : "pm";
      const minStr = min === 0 ? "00" : String(min);
      const str = `${String(h12).padStart(2, "0")}:${minStr} ${actualAmpm}`;
      options.push(str);
    }
  }
  return options;
})();

function normalizeTime(t) {
  if (!t) return "";
  return t.trim().toLowerCase().replace(/\s+/g, " ");
}

export function getTodayStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseTimeToMinutes(t) {
  if (!t) return null;
  const match = t.trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
  if (!match) return null;
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const ampm = (match[3] || "").toLowerCase();
  if (ampm === "pm" && h < 12) h += 12;
  if (ampm === "am" && h === 12) h = 0;
  return h * 60 + m;
}

function formatDatePill(dateStr) {
  if (!dateStr) return "Select date";
  try {
    const parts = dateStr.split("-").map(Number);
    if (parts.length === 3 && !parts.some(isNaN)) {
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      const weekday = d.toLocaleDateString("en-US", { weekday: "short" });
      const month = d.toLocaleDateString("en-US", { month: "short" });
      const day = parts[2];
      return `${weekday}, ${month} ${day}`;
    }
  } catch {}
  return dateStr;
}

// Interactive calendar popover matching theme (Image 1) with past-date prevention
function ThemedCalendarPopover({ value, onChange, onClose, themeColor, minDate = null }) {
  const effectiveMinDate = minDate || getTodayStr();

  const parsed = useMemo(() => {
    if (!value) {
      const now = new Date();
      return { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
    }
    const [y, m, d] = value.split("-").map(Number);
    if (!y || !m || !d) {
      const now = new Date();
      return { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
    }
    return { year: y, month: m - 1, day: d };
  }, [value]);

  const [viewDate, setViewDate] = useState(() => new Date(parsed.year, parsed.month, 1));

  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();

  const monthName = viewDate.toLocaleDateString("en-US", { month: "long" });

  const [minY, minM] = effectiveMinDate.split("-").map(Number);
  const canGoPrev = viewYear > minY || (viewYear === minY && viewMonth > (minM - 1));

  const prevMonth = (e) => {
    e.stopPropagation();
    if (!canGoPrev) return;
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

  const selectDay = (day) => {
    const yStr = String(viewYear);
    const mStr = String(viewMonth + 1).padStart(2, "0");
    const dStr = String(day).padStart(2, "0");
    const chosen = `${yStr}-${mStr}-${dStr}`;
    if (chosen < effectiveMinDate) return;
    onChange(chosen);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        onClick={(e) => e.stopPropagation()}
        className="absolute top-full mt-2 left-0 z-50 w-[270px] bg-[#181512] dark:bg-[#181512] border border-white/20 rounded-2xl shadow-2xl p-4 select-none animate-in fade-in zoom-in-95 duration-100"
        style={{
          boxShadow: "0 20px 40px -10px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.15)",
        }}
      >
        {/* Month Header with < > Navigation */}
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-sm font-bold text-white">
            {monthName}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={!canGoPrev}
              onClick={prevMonth}
              title={canGoPrev ? "Previous month" : "Cannot navigate to past months"}
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                canGoPrev
                  ? "text-white/70 hover:text-white hover:bg-white/10 cursor-pointer"
                  : "text-white/20 cursor-not-allowed opacity-30"
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={nextMonth}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Days of week */}
        <div className="grid grid-cols-7 gap-1 text-center mb-1">
          {["S", "M", "T", "W", "T", "F", "S"].map((day, idx) => (
            <div
              key={idx}
              className="text-[11px] font-medium text-white/50 py-1"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {/* Prev month days */}
          {prevDays.map((d, idx) => (
            <div
              key={`prev-${idx}`}
              className="h-8 flex items-center justify-center text-xs text-white/20 select-none"
            >
              {d}
            </div>
          ))}

          {/* Current month days with past date prevention */}
          {currentDays.map((d) => {
            const dayStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            const isPast = dayStr < effectiveMinDate;
            const isSelected =
              parsed.year === viewYear &&
              parsed.month === viewMonth &&
              parsed.day === d;

            if (isPast) {
              return (
                <button
                  key={`curr-${d}`}
                  type="button"
                  disabled
                  title="Date has already passed"
                  className="h-8 w-8 mx-auto flex items-center justify-center text-xs rounded-lg text-white/20 line-through cursor-not-allowed select-none opacity-40 font-mono"
                >
                  {d}
                </button>
              );
            }

            return (
              <button
                key={`curr-${d}`}
                type="button"
                onClick={() => selectDay(d)}
                style={
                  isSelected
                    ? {
                        backgroundColor: themeColor,
                        color: isLightColor(themeColor) ? "#131517" : "#FFFFFF",
                      }
                    : {}
                }
                className={`h-8 w-8 mx-auto flex items-center justify-center text-xs rounded-lg transition-colors cursor-pointer ${
                  isSelected
                    ? "font-bold shadow-sm"
                    : "text-white/80 hover:bg-white/10 hover:text-white font-medium"
                }`}
              >
                {d}
              </button>
            );
          })}

          {/* Next month days */}
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
    </>
  );
}

// Interactive scrollable time dropdown matching theme (Image 2) with past-time prevention
function ThemedTimeDropdown({ value, onChange, onClose, themeColor, minMinutes = null }) {
  const activeRef = useRef(null);

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ block: "center", behavior: "auto" });
    }
  }, []);

  const normalizedVal = normalizeTime(value);

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        onClick={(e) => e.stopPropagation()}
        className="absolute top-full mt-2 left-0 z-50 w-32 max-h-60 overflow-y-auto bg-[#181512] dark:bg-[#181512] border border-white/20 rounded-2xl shadow-2xl p-1.5 select-none animate-in fade-in zoom-in-95 duration-100 space-y-0.5 custom-scrollbar"
        style={{
          boxShadow: "0 20px 40px -10px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.15)",
        }}
      >
        {TIME_OPTIONS.map((slot) => {
          const isSelected = normalizeTime(slot) === normalizedVal;
          const slotMinutes = parseTimeToMinutes(slot);
          const isPast = minMinutes !== null && slotMinutes !== null && slotMinutes < minMinutes;

          if (isPast) {
            return (
              <button
                key={slot}
                type="button"
                disabled
                title="Time has already passed"
                className="w-full py-1.5 px-2 text-xs font-mono text-center rounded-xl text-white/20 line-through cursor-not-allowed select-none opacity-40"
              >
                {slot}
              </button>
            );
          }

          return (
            <button
              key={slot}
              ref={isSelected ? activeRef : null}
              type="button"
              onClick={() => {
                onChange(slot);
                onClose();
              }}
              style={
                isSelected
                  ? {
                      backgroundColor: themeColor,
                      color: isLightColor(themeColor) ? "#131517" : "#FFFFFF",
                    }
                  : {}
              }
              className={`w-full py-1.5 px-2 text-xs font-mono text-center rounded-xl transition-colors cursor-pointer ${
                isSelected
                  ? "font-bold shadow-sm"
                  : "text-white/80 hover:text-white hover:bg-white/10"
              }`}
            >
              {slot}
            </button>
          );
        })}
      </div>
    </>
  );
}

const EXPANDED_LOCATIONS = [];
const POPULAR_LOCATIONS = [];

function formatTimeWithTz(date = new Date()) {
  try {
    const timeStr = date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    return timeStr;
  } catch {
    return "1:04 PM";
  }
}

export function EventCreateStudio({
  editingEvent = null,
  onClose,
  onSuccess,
}) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef(null);
  const ticketBgInputRef = useRef(null);

  // Live top-bar clock
  const [clockString, setClockString] = useState("1:04 PM");

  useEffect(() => {
    const updateClock = () => setClockString(formatTimeWithTz(new Date()));
    updateClock();
    const timer = setInterval(updateClock, 10000);
    return () => clearInterval(timer);
  }, []);

  // Pre-fetch destination routes so overview navigation is instantaneous
  useEffect(() => {
    try {
      router.prefetch("/admin/overview");
      router.prefetch("/admin/dashboard");
    } catch {}
  }, [router]);

  // Initialize form state with current/future dates
  const getInitialDates = () => {
    const todayStr = getTodayStr();
    if (editingEvent) {
      let sDate = "";
      let eDate = "";
      try {
        const d = editingEvent.date?.toDate
          ? editingEvent.date.toDate()
          : new Date(editingEvent.date);
        if (!isNaN(d)) sDate = d.toISOString().split("T")[0];
      } catch {
        sDate = "";
      }
      return {
        startDate: editingEvent.startDate || sDate || todayStr,
        startTime: editingEvent.startTime || "11:30 pm",
        endDate: editingEvent.endDate || sDate || todayStr,
        endTime: editingEvent.endTime || "12:30 am",
      };
    }

    const now = new Date();
    const nextHour = now.getHours() + 1;
    const startH = nextHour < 24 ? nextHour : 18;
    const endH = (startH + 2) < 24 ? startH + 2 : 23;
    const startAmpm = startH >= 12 ? "pm" : "am";
    const endAmpm = endH >= 12 ? "pm" : "am";
    const startH12 = startH % 12 === 0 ? 12 : startH % 12;
    const endH12 = endH % 12 === 0 ? 12 : endH % 12;

    const defStartTime = `${String(startH12).padStart(2, "0")}:00 ${startAmpm}`;
    const defEndTime = `${String(endH12).padStart(2, "0")}:00 ${endAmpm}`;

    return {
      startDate: todayStr,
      startTime: defStartTime,
      endDate: todayStr,
      endTime: defEndTime,
    };
  };

  const initialDates = getInitialDates();

  const [formData, setFormData] = useState({
    name: editingEvent?.name || editingEvent?.title || "",
    description:
      typeof editingEvent?.description === "string"
        ? editingEvent.description
        : editingEvent?.description?.text || "",
    startDate: initialDates.startDate,
    startTime: initialDates.startTime,
    endDate: initialDates.endDate,
    endTime: initialDates.endTime,
    timezone: editingEvent?.timezone || "GMT+05:30",
    timezoneCity: editingEvent?.timezoneCity || "Kolkata",
    location: editingEvent?.location || "",
    locationVenue: editingEvent?.locationVenue || "",
    locationAddress: editingEvent?.locationAddress || "",
    latitude: editingEvent?.latitude || null,
    longitude: editingEvent?.longitude || null,
    locationPin: editingEvent?.locationPin || null,
    locationType: editingEvent?.locationType || "in-person",
    virtualLink: editingEvent?.virtualLink || "",
    locationInstructions: editingEvent?.locationInstructions || "",
    theme: editingEvent?.theme || "minimal",
    themeColor: editingEvent?.themeColor || editingEvent?.themeHex || "#FE760B",
    ticketBgColor: editingEvent?.ticketBgColor || editingEvent?.themeColor || "#FE760B",
    coverImage:
      editingEvent?.coverImage ||
      editingEvent?.image ||
      (editingEvent?.theme === "sunny" ? ARTWORK_PRESETS[0].svg : ARTWORK_PRESETS[1].svg),
    visibility:
      editingEvent?.visibility ||
      (editingEvent?.isActive === false ? "draft" : "public"),
    isPaid: Boolean(
      editingEvent?.isPaid ||
        (editingEvent?.price && editingEvent.price !== "Free"),
    ),
    price:
      editingEvent?.price && editingEvent.price !== "Free"
        ? String(editingEvent.price).replace(/[^0-9]/g, "") || "199"
        : "199",
    capacity: editingEvent?.totalTickets || editingEvent?.capacity || 150,
    ticketDesign: editingEvent?.ticketDesign || "stub",
    posterTextMode: editingEvent?.posterTextMode || "auto",
    posterLine1: editingEvent?.posterLine1 || "",
    posterLine2: editingEvent?.posterLine2 || "",
    posterLine3: editingEvent?.posterLine3 || "",
    posterExtraDetails: editingEvent?.posterExtraDetails || "",
    fontFamily: editingEvent?.fontFamily || "New Spirit",
    posterFontSize: editingEvent?.posterFontSize || 34,
    posterTextWidth: editingEvent?.posterTextWidth || 85,
    posterAlign: editingEvent?.posterAlign || "left",
    posterTextColor: editingEvent?.posterTextColor || "auto",
    posterTextX: typeof editingEvent?.posterTextX === "number" ? editingEvent.posterTextX : 6,
    posterTextY: typeof editingEvent?.posterTextY === "number" ? editingEvent.posterTextY : (editingEvent?.coverImage ? 55 : 68),
    showPosterText: editingEvent?.showPosterText !== undefined ? editingEvent.showPosterText : true,
    posterTextBg: editingEvent?.posterTextBg || "shadow",
    requireApproval: Boolean(editingEvent?.requireApproval),
    limitCapacity: Boolean(
      editingEvent?.limitCapacity ||
        (editingEvent?.capacity && editingEvent.capacity !== "Unlimited")
    ),
    maxCapacity: editingEvent?.maxCapacity || editingEvent?.capacity || 50,
    waitlist: editingEvent?.waitlist !== undefined ? Boolean(editingEvent.waitlist) : true,
    ticketBgUrl: editingEvent?.ticketBgUrl || editingEvent?.ticketBackground || "",
  });

  const isEventCancelled = Boolean(editingEvent?.isCancelled || editingEvent?.status === "cancelled");

  const [showThemeDropdown, setShowThemeDropdown] = useState(false);
  const [showEventPagePreviewModal, setShowEventPagePreviewModal] = useState(false);
  const [previewDevice, setPreviewDevice] = useState("desktop");
  const [showFurtherInstructions, setShowFurtherInstructions] = useState(Boolean(editingEvent?.locationInstructions));
  const [artworkPresetIdx, setArtworkPresetIdx] = useState(0);

  const handleShuffleArtwork = () => {
    setArtworkPresetIdx((prev) => {
      const nextIdx = (prev + 1) % ARTWORK_PRESETS.length;
      setFormData((f) => ({
        ...f,
        coverImage: ARTWORK_PRESETS[nextIdx].svg,
      }));
      toast.success(`Theme artwork: ${ARTWORK_PRESETS[nextIdx].name}`, { duration: 1500 });
      return nextIdx;
    });
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationInput, setLocationInput] = useState(formData.location);
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const searchTimeoutRef = useRef(null);

  const [customColorHex, setCustomColorHex] = useState(
    editingEvent?.themeColor || editingEvent?.themeHex || "#FE760B"
  );
  const [themeHexInput, setThemeHexInput] = useState(() =>
    normalizeHex(editingEvent?.themeColor || editingEvent?.themeHex || "#FE760B").replace(/^#/, "")
  );
  const [ticketHexInput, setTicketHexInput] = useState(() =>
    normalizeHex(editingEvent?.ticketBgColor || editingEvent?.themeColor || "#FE760B").replace(/^#/, "")
  );
  const [customTextColorHex, setCustomTextColorHex] = useState(() => {
    const raw = editingEvent?.posterTextColor || editingEvent?.ticketTextColor || "";
    return raw.startsWith("#") ? normalizeHex(raw).replace(/^#/, "") : "FFFFFF";
  });

  const [selectedLocationVenue, setSelectedLocationVenue] = useState(() => {
    if (editingEvent?.locationVenue) {
      return {
        name: editingEvent.locationVenue,
        address: editingEvent.locationAddress || editingEvent.location,
        lat: editingEvent.latitude || editingEvent.locationPin?.lat || null,
        lng: editingEvent.longitude || editingEvent.locationPin?.lng || null,
      };
    }
    return null;
  });
  const [pinPosition, setPinPosition] = useState({ x: 50, y: 50 });
  const [pinLandmark, setPinLandmark] = useState("");

  // Interactive popup states matching Images 1 - 5
  const [showStartCalendar, setShowStartCalendar] = useState(false);
  const [showEndCalendar, setShowEndCalendar] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [showDescriptionModal, setShowDescriptionModal] = useState(false);
  const [showCapacityModal, setShowCapacityModal] = useState(false);
  const [showTypographyModal, setShowTypographyModal] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showVisibilityMenu, setShowVisibilityMenu] = useState(false);
  const [showFullTicketModal, setShowFullTicketModal] = useState(false);
  const [modalPreviewDesign, setModalPreviewDesign] = useState("stub");
  const [previewTab, setPreviewTab] = useState("both"); // "both" | "stub" | "wide"
  const themeColorInputRef = useRef(null);
  const [isResizingText, setIsResizingText] = useState(false);
  const resizeStartPosRef = useRef({ mouseX: 0, startWidth: 85 });

  const handleLocationInputChange = (val) => {
    setLocationInput(val);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    const q = val.trim();
    if (q.length < 2) {
      setLocationSuggestions([]);
      setIsSearchingLocation(false);
      return;
    }

    // 1. Instant 0ms local match from verified Indian venues catalog
    const localMatches = searchIndianVenues(q, 6);
    if (localMatches.length > 0) {
      setLocationSuggestions(localMatches);
    }

    setIsSearchingLocation(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          const places = Array.isArray(data.places) ? data.places : [];
          const customEntry = {
            id: `custom-${Date.now()}`,
            name: q,
            address: "Custom venue entered by organiser",
            lat: places.length > 0 && places[0].lat ? places[0].lat : null,
            lng: places.length > 0 && places[0].lng ? places[0].lng : null,
            isCustom: true,
          };
          setLocationSuggestions(places.length > 0 ? [...places, customEntry] : [customEntry]);
        } else {
          setLocationSuggestions(
            localMatches.length > 0
              ? localMatches
              : [
                  {
                    id: "custom-fallback",
                    name: q,
                    address: "Use custom entered venue",
                    lat: null,
                    lng: null,
                    isCustom: true,
                  },
                ]
          );
        }
      } catch (err) {
        console.error("Location search failed:", err);
        setLocationSuggestions(
          localMatches.length > 0
            ? localMatches
            : [
                {
                  id: "custom-fallback",
                  name: q,
                  address: "Use custom entered venue",
                  lat: null,
                  lng: null,
                  isCustom: true,
                },
              ]
        );
      } finally {
        setIsSearchingLocation(false);
      }
    }, 250);
  };

  const handleSelectLocationItem = (item) => {
    const name = item.isCustom ? (item.name || locationInput) : item.name;
    const address = item.address || item.display_name || "";
    setSelectedLocationVenue({
      name,
      address,
      lat: item.lat ?? null,
      lng: item.lng ?? null,
      isVerified: item.isVerified || false,
      category: item.category || "Venue",
    });
    setPinPosition({ x: 50, y: 50 });
  };

  // Draggable text overlay state
  const [isDraggingText, setIsDraggingText] = useState(false);
  const [isTextSelected, setIsTextSelected] = useState(false);
  const [isInlineEditing, setIsInlineEditing] = useState(false);
  const posterContainerRef = useRef(null);
  const descriptionTextareaRef = useRef(null);
  const dragStartPosRef = useRef({ mouseX: 0, mouseY: 0, textX: 0, textY: 0 });
  const dragMovedRef = useRef(false);

  const handleTextDragStart = (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "BUTTON") return;

    dragMovedRef.current = false;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    dragStartPosRef.current = {
      mouseX: clientX,
      mouseY: clientY,
      textX: typeof formData.posterTextX === "number" ? formData.posterTextX : 6,
      textY: typeof formData.posterTextY === "number" ? formData.posterTextY : (formData.coverImage ? 55 : 68),
    };
    setIsDraggingText(true);
  };

  useEffect(() => {
    if (!isDraggingText) return;

    const handleMouseMove = (e) => {
      if (!posterContainerRef.current) return;
      const rect = posterContainerRef.current.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;

      const dist = Math.hypot(
        clientX - dragStartPosRef.current.mouseX,
        clientY - dragStartPosRef.current.mouseY
      );
      if (dist > 5) {
        dragMovedRef.current = true;
      }

      const deltaX = ((clientX - dragStartPosRef.current.mouseX) / rect.width) * 100;
      const deltaY = ((clientY - dragStartPosRef.current.mouseY) / rect.height) * 100;

      let newX = Math.round(dragStartPosRef.current.textX + deltaX);
      let newY = Math.round(dragStartPosRef.current.textY + deltaY);

      newX = Math.max(2, Math.min(80, newX));
      newY = Math.max(2, Math.min(84, newY));

      setFormData((prev) => ({
        ...prev,
        posterTextX: newX,
        posterTextY: newY,
      }));
    };

    const handleMouseUp = () => {
      setIsDraggingText(false);
      if (!dragMovedRef.current) {
        setShowTypographyModal(true);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("touchmove", handleMouseMove, { passive: false });
    window.addEventListener("touchend", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleMouseMove);
      window.removeEventListener("touchend", handleMouseUp);
    };
  }, [isDraggingText]);

  // Horizontal text box stretch / resize handler for Image 5
  const handleResizeStart = (e) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizingText(true);
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    resizeStartPosRef.current = {
      mouseX: clientX,
      startWidth: formData.posterTextWidth || 85,
    };
  };

  useEffect(() => {
    if (!isResizingText) return;

    const handleResizeMove = (e) => {
      if (!posterContainerRef.current) return;
      const rect = posterContainerRef.current.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const deltaX = ((clientX - resizeStartPosRef.current.mouseX) / rect.width) * 100;
      let newW = Math.round(resizeStartPosRef.current.startWidth + deltaX);
      newW = Math.max(30, Math.min(92, newW));
      setFormData((prev) => ({ ...prev, posterTextWidth: newW }));
    };

    const handleResizeEnd = () => {
      setIsResizingText(false);
    };

    window.addEventListener("mousemove", handleResizeMove);
    window.addEventListener("mouseup", handleResizeEnd);
    window.addEventListener("touchmove", handleResizeMove, { passive: false });
    window.addEventListener("touchend", handleResizeEnd);

    return () => {
      window.removeEventListener("mousemove", handleResizeMove);
      window.removeEventListener("mouseup", handleResizeEnd);
      window.removeEventListener("touchmove", handleResizeMove);
      window.removeEventListener("touchend", handleResizeEnd);
    };
  }, [isResizingText]);

  const selectedTheme = useMemo(() => {
    if (formData.theme === "custom") {
      return deriveThemeFromColor(formData.themeColor || customColorHex);
    }
    const found = THEMES.find((t) => t.id === formData.theme);
    if (found) return found;
    return THEMES[0]; // Minimal
  }, [formData.theme, formData.themeColor, customColorHex]);

  // Word-aware poster headline lines
  const posterLines = getPosterLines(
    formData.name,
    formData.posterTextMode,
    formData.posterLine1,
    formData.posterLine2
  );

  // Safe description string guarantees NO [object Object]
  const safeDescription =
    typeof formData.description === "string"
      ? formData.description
      : (formData.description?.text || "");

  // Memoized tickets for Deck View preview in Studio matching Image 4
  const studioDeckTickets = useMemo(() => {
    const currentTicket = {
      id: "studio-current-event",
      title: formData.name || "Event Name",
      name: formData.name || "Event Name",
      date: formData.startDate || "Thu, 12 Nov 2026",
      time: formData.startTime || "06:00 PM",
      venue: formData.locationVenue || formData.location || "Main Auditorium, Campus",
      location: formData.locationVenue || formData.location || "Main Auditorium, Campus",
      theme: formData.theme,
      themeColor: selectedTheme.color,
      themeHex: selectedTheme.color,
      ticketBgColor: formData.ticketBgColor || selectedTheme.color,
      ticketBgUrl: formData.ticketBgUrl || "",
      price: formData.isPaid ? formData.price : 0,
      ticketTier: formData.isPaid ? "VIP PASS" : "GENERAL PASS",
      ticketType: formData.isPaid ? "VIP PASS" : "GENERAL PASS",
      ticketId: "TKT-1793-DEMO-DECK",
      guest: "Rahul Sharma (Attendee)",
      attendeeName: "Rahul Sharma (Attendee)",
      status: "Valid Pass",
      entryLabel: "SCAN AT ENTRY",
      posterLine1: formData.posterTextMode === "custom" ? formData.posterLine1 : "",
      posterLine2: formData.posterTextMode === "custom" ? formData.posterLine2 : "",
      posterTextMode: formData.posterTextMode,
      posterTextColor: formData.posterTextColor,
      ticketTextColor: formData.posterTextColor,
      posterFontSize: formData.posterFontSize,
      posterAlign: formData.posterAlign,
      posterTextY: formData.posterTextY,
      posterTextBg: formData.posterTextBg,
      showPosterText: formData.showPosterText,
    };

    return [
      {
        id: "deck-sample-green",
        title: "Test Event for Developers",
        theme: "robotics",
        themeColor: "#10B981",
        date: "Mon, 12 Oct 2026",
        time: "11:00 AM",
        venue: "Innovation Lab",
        ticketType: "EXPO PASS",
        guest: "Adil M",
        ticketId: "TKT-ROBOTICS-004",
        entryLabel: "SCAN AT ENTRY",
        price: 99,
      },
      {
        id: "deck-sample-yellow",
        title: "Honey Singh Concert",
        theme: "yellow",
        themeColor: "#EAB308",
        date: "Wed, 28 Oct 2026",
        time: "07:00 PM",
        venue: "Open Arena Grounds",
        ticketType: "FAN PIT PASS",
        guest: "Adil M",
        ticketId: "TKT-CONCERT-183",
        entryLabel: "SCAN AT ENTRY",
        price: 999,
      },
      {
        id: "deck-sample-purple",
        title: "Praroha Gaming",
        theme: "gaming",
        themeColor: "#8B5CF6",
        date: "Sat, 07 Nov 2026",
        time: "10:00 AM",
        venue: "School of Engineering",
        ticketType: "VIP PASS",
        guest: "Adil M",
        ticketId: "TKT-PRAROHA-001",
        entryLabel: "SCAN AT ENTRY",
        price: 0,
      },
      currentTicket,
    ];
  }, [formData, selectedTheme]);

  // Compress and optimize image to WebP/JPEG using client canvas (instant upload, minimal memory & fits Firestore < 100KB)
  const compressImageFile = (file, maxWidth = 800, maxHeight = 800, quality = 0.72) => {
    return new Promise((resolve) => {
      if (typeof window === "undefined" || !window.FileReader) {
        resolve("");
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => resolve("");
      reader.onload = () => {
        const rawDataUrl = reader.result;
        if (typeof rawDataUrl !== "string") {
          resolve("");
          return;
        }
        const img = typeof window !== "undefined" && window.Image ? new window.Image() : new Image();
        img.onerror = () => {
          // Never resolve with huge raw file data on error
          resolve("");
        };
        img.onload = () => {
          try {
            const MAX_ALLOWED_CHARS = 100000; // ~75KB base64 max budget
            let curW = img.width;
            let curH = img.height;
            if (curW > maxWidth || curH > maxHeight) {
              const ratio = Math.min(maxWidth / curW, maxHeight / curH);
              curW = Math.round(curW * ratio);
              curH = Math.round(curH * ratio);
            }

            const canvas = document.createElement("canvas");
            canvas.width = curW;
            canvas.height = curH;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
              resolve("");
              return;
            }
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
            ctx.drawImage(img, 0, 0, curW, curH);

            let compressed = canvas.toDataURL("image/webp", quality);
            if (!compressed || compressed.length > rawDataUrl.length) {
              compressed = canvas.toDataURL("image/jpeg", quality);
            }

            // Iterative reduction if still larger than safe budget
            if (compressed && compressed.length > MAX_ALLOWED_CHARS) {
              compressed = canvas.toDataURL("image/webp", 0.55);
              if (compressed.length > MAX_ALLOWED_CHARS) {
                const scale = Math.min(500 / curW, 500 / curH);
                if (scale < 1) {
                  const smallCanvas = document.createElement("canvas");
                  smallCanvas.width = Math.round(curW * scale);
                  smallCanvas.height = Math.round(curH * scale);
                  const smallCtx = smallCanvas.getContext("2d");
                  if (smallCtx) {
                    smallCtx.drawImage(canvas, 0, 0, smallCanvas.width, smallCanvas.height);
                    compressed = smallCanvas.toDataURL("image/webp", 0.50);
                  }
                }
              }
            }

            resolve(compressed || "");
          } catch {
            resolve("");
          }
        };
        img.src = rawDataUrl;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Please upload a valid JPEG, PNG, or WebP image");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be under 10 MB");
      return;
    }

    try {
      const optimized = await compressImageFile(file, 800, 800, 0.72);
      if (!optimized) {
        toast.error("Could not process image. Please try a different image.");
        return;
      }
      setFormData((prev) => ({ ...prev, coverImage: optimized }));
      toast.success("Poster image updated");
    } catch {
      toast.error("Failed to load image. Please select a valid image file.");
    }
  };

  const removeCoverImage = (e) => {
    e.stopPropagation();
    setFormData((prev) => ({ ...prev, coverImage: "" }));
    toast.info("Custom banner removed; using procedural poster");
  };

  const handleTicketBgUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Please upload a valid JPEG, PNG, or WebP image");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be under 10 MB");
      return;
    }

    try {
      const optimized = await compressImageFile(file, 800, 800, 0.72);
      if (!optimized) {
        toast.error("Could not process ticket background. Please try a different image.");
        return;
      }
      setFormData((prev) => ({ ...prev, ticketBgUrl: optimized }));
      toast.success("Ticket background image applied!");
    } catch {
      toast.error("Failed to load image. Please select a valid image file.");
    }
  };

  const removeTicketBgImage = (e) => {
    e?.stopPropagation?.();
    if (ticketBgInputRef.current) {
      ticketBgInputRef.current.value = "";
    }
    setFormData((prev) => ({ ...prev, ticketBgUrl: "" }));
    toast.info("Ticket background image removed; using theme color");
  };

  const handleLocationSave = () => {
    let venue = selectedLocationVenue;

    // If user clicked Save Location without manually clicking a suggestion first,
    // auto-select the best matching suggestion from the list or local catalog!
    if (!venue && locationSuggestions.length > 0) {
      venue = locationSuggestions[0];
      setSelectedLocationVenue(venue);
    }

    if (!venue && locationInput.trim()) {
      const directMatches = searchIndianVenues(locationInput.trim(), 1);
      if (directMatches.length > 0) {
        venue = directMatches[0];
        setSelectedLocationVenue(venue);
      }
    }

    const venueName = venue?.name || locationInput.trim();
    const venueAddress = venue?.address || "";
    if (!venueName && !venueAddress) {
      toast.error("Please search and select a venue or enter location");
      return;
    }
    const finalLocation = pinLandmark
      ? `${venueName} (${pinLandmark})${venueAddress ? ", " + venueAddress : ""}`
      : `${venueName}${venueAddress ? ", " + venueAddress : ""}`;

    setFormData((prev) => ({
      ...prev,
      location: finalLocation,
      locationVenue: venueName,
      locationAddress: venueAddress,
      latitude: venue?.lat || null,
      longitude: venue?.lng || null,
      locationPin: venue?.lat
        ? {
            lat: Number(venue.lat.toFixed(6)),
            lng: Number(venue.lng.toFixed(6)),
            landmark: pinLandmark || "Venue Pin",
          }
        : null,
    }));
    setShowLocationModal(false);
    toast.success("Venue location confirmed with verified coordinates!");
  };

  const handleFormSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    if (isEventCancelled) {
      toast.error("This event is cancelled. Modifications cannot be saved.");
      return;
    }

    if (!formData.name.trim()) {
      toast.error("Please enter an event name");
      return;
    }

    if (!formData.location.trim() && formData.locationType === "in-person") {
      toast.error("Please enter an event location");
      return;
    }

    // Logical date & time validation: event cannot be in the past
    const todayStr = getTodayStr();
    if (!formData.startDate) {
      toast.error("Please select an event start date");
      return;
    }

    if (formData.startDate < todayStr) {
      toast.error("Event date cannot be in the past. Please select today or an upcoming date.");
      return;
    }

    if (formData.endDate && formData.endDate < formData.startDate) {
      toast.error("Event end date cannot be earlier than the start date.");
      return;
    }

    // Check if start time has already passed today
    if (formData.startDate === todayStr && formData.startTime) {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const startMin = parseTimeToMinutes(formData.startTime);
      if (startMin !== null && startMin < currentMinutes - 10) {
        toast.error("Event start time has already passed today. Please choose an upcoming time.");
        return;
      }
    }

    // Check if end time is before start time on the same day
    if (formData.startDate === formData.endDate && formData.startTime && formData.endTime) {
      const startMin = parseTimeToMinutes(formData.startTime);
      const endMin = parseTimeToMinutes(formData.endTime);
      if (startMin !== null && endMin !== null && endMin <= startMin) {
        toast.error("Event end time must be after the start time on the same date.");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      // Build ISO date timestamp
      let eventDateObj = new Date(formData.startDate);
      if (isNaN(eventDateObj.getTime())) {
        eventDateObj = new Date();
      }

      const canonicalName = (formData.name || "").trim();
      const generatedSlug = canonicalName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || `event-${Date.now()}`;

      const payload = {
        name: canonicalName,
        title: canonicalName,
        slug: formData.slug || editingEvent?.slug || generatedSlug,
        customDomain: formData.customDomain || editingEvent?.customDomain || "",
        description: safeDescription.trim(),
        organizerName: editingEvent?.organizerName || user?.fullName || user?.displayName || user?.name || "",
        organizerEmail: editingEvent?.organizerEmail || user?.email || "",
        organizerPhotoUrl: editingEvent?.organizerPhotoUrl || user?.photoURL || "",
        hostName: editingEvent?.hostName || user?.fullName || user?.displayName || user?.name || "",
        hostEmail: editingEvent?.hostEmail || user?.email || "",
        hostPhotoUrl: editingEvent?.hostPhotoUrl || user?.photoURL || "",
        date: eventDateObj,
        startDate: formData.startDate,
        startTime: formData.startTime,
        endDate: formData.endDate || formData.startDate,
        endTime: formData.endTime,
        timezone: formData.timezone,
        timezoneCity: formData.timezoneCity,
        location:
          formData.locationType === "virtual"
            ? formData.virtualLink.trim() || formData.location.trim() || "Virtual / Online Event"
            : formData.location.trim(),
        locationVenue: formData.locationVenue || formData.location,
        locationAddress: formData.locationAddress || "",
        latitude: formData.latitude || null,
        longitude: formData.longitude || null,
        locationPin: formData.locationPin || null,
        locationType: formData.locationType,
        virtualLink: formData.virtualLink.trim(),
        locationInstructions: formData.locationInstructions || "",
        totalTickets: formData.limitCapacity ? (parseInt(formData.maxCapacity, 10) || 50) : 9999,
        capacity: formData.limitCapacity ? (parseInt(formData.maxCapacity, 10) || 50) : "Unlimited",
        requireApproval: formData.isPaid ? false : Boolean(formData.requireApproval),
        limitCapacity: Boolean(formData.limitCapacity),
        maxCapacity: parseInt(formData.maxCapacity, 10) || 50,
        waitlist: Boolean(formData.waitlist),
        theme: selectedTheme.id || formData.theme || "minimal",
        themeColor: selectedTheme.color || "#FE760B",
        themeHex: selectedTheme.color || "#FE760B",
        themeName: selectedTheme.name || "Minimal",
        pageBg: selectedTheme.pageBg === "#432E01" ? "#131517" : (selectedTheme.pageBg || "#131517"),
        ticketBgColor: formData.ticketBgColor || selectedTheme.color || "#FE760B",
        coverImage: formData.coverImage || "",
        visibility: formData.visibility,
        isPaid: Boolean(formData.isPaid),
        price: formData.isPaid ? `₹${parseFloat(String(formData.price || 199).replace(/[^0-9.]/g, "")) || 199}` : "Free",
        ticketPrice: formData.isPaid ? (parseFloat(String(formData.price || 199).replace(/[^0-9.]/g, "")) || 199) : 0,
        amount: formData.isPaid ? (parseFloat(String(formData.price || 199).replace(/[^0-9.]/g, "")) || 199) : 0,
        ticketDesign: formData.ticketDesign || "stub",
        posterTextMode: formData.posterTextMode || "auto",
        posterLine1: formData.posterTextMode === "custom" ? (formData.posterLine1 || "").trim() : "",
        posterLine2: formData.posterTextMode === "custom" ? (formData.posterLine2 || "").trim() : "",
        posterLine3: formData.posterTextMode === "custom" ? (formData.posterLine3 || "").trim() : "",
        posterExtraDetails: formData.posterExtraDetails || "",
        fontFamily: formData.fontFamily || "New Spirit",
        posterFontSize: parseInt(formData.posterFontSize, 10) || 34,
        posterTextWidth: parseInt(formData.posterTextWidth, 10) || 85,
        posterAlign: formData.posterAlign || "left",
        posterTextColor: formData.posterTextColor || "auto",
        posterTextX: typeof formData.posterTextX === "number" ? formData.posterTextX : 6,
        posterTextY: typeof formData.posterTextY === "number" ? formData.posterTextY : 68,
        showPosterText: formData.showPosterText !== false,
        posterTextBg: formData.posterTextBg || "shadow",
        ticketBgUrl: formData.ticketBgUrl || "",
        // Never duplicate huge base64 strings into ticketBackground to protect Firestore 1MB document limit
        ticketBackground: formData.ticketBgUrl?.startsWith("data:")
          ? ""
          : formData.ticketBgUrl || "",
        isActive: formData.visibility !== "draft",
        published: formData.visibility === "public",
        status:
          formData.visibility === "draft"
            ? "draft"
            : formData.visibility === "public"
              ? "published"
              : "private",
      };

      // Safeguard against Firestore 1MB document limit (1,048,576 bytes)
      const approxPayloadBytes = JSON.stringify(payload).length;
      if (approxPayloadBytes > 750000) {
        console.warn("Payload size exceeds 750KB safe threshold; stripping duplicate ticketBackground");
        delete payload.ticketBackground;
      }

      let savedEvent;
      if (editingEvent?.id) {
        await updateEvent(editingEvent.id, payload);
        savedEvent = { id: editingEvent.id, ...payload };
        toast.success("Event updated successfully!");
      } else {
        savedEvent = await createEvent(payload, user?.id || user?.uid || null);
        toast.success("Event created successfully!");
      }

      if (typeof window !== "undefined" && savedEvent?.id) {
        try {
          localStorage.setItem("admin_selected_event_id", savedEvent.id);
          localStorage.setItem(`admin_cached_event_${savedEvent.id}`, JSON.stringify(savedEvent));
          sessionStorage.setItem("admin_last_created_event", JSON.stringify(savedEvent));
          setCachedEvent(savedEvent.id, savedEvent);
          const uId = user?.uid || user?.id;
          if (uId) {
            const cachedList = getCachedOrganiserEvents(uId) || [];
            const filtered = cachedList.filter((e) => e.id !== savedEvent.id);
            setCachedOrganiserEvents(uId, [savedEvent, ...filtered]);
          }
        } catch {}
      }

      if (typeof onSuccess === "function") {
        onSuccess(savedEvent);
      } else if (typeof onClose === "function") {
        onClose(savedEvent);
      } else {
        router.push(`/admin/overview?eventId=${savedEvent?.id || ""}`);
      }
    } catch (err) {
      console.error("Failed to save event:", err);
      toast.error(err.message || "Failed to save event");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Organiser display details
  const organiserName = user?.displayName || user?.name || "Test Organiser";
  const organiserInitials = (organiserName || "TO")
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const currentBgColor =
    formData.theme === "minimal"
      ? "#131517"
      : (selectedTheme?.pageBg === "#432E01" ? "#131517" : selectedTheme?.pageBg) || "#131517";

  // Dynamic full-page background synchronization to ensure zero static color mismatch
  useEffect(() => {
    if (typeof document !== "undefined") {
      const prevHtmlBg = document.documentElement.style.backgroundColor;
      const prevBodyBg = document.body.style.backgroundColor;

      document.documentElement.style.backgroundColor = currentBgColor;
      document.body.style.backgroundColor = currentBgColor;
      document.documentElement.style.setProperty("--studio-bg", currentBgColor);
      document.documentElement.style.setProperty(
        "--studio-header-bg",
        `${currentBgColor}F0`
      );

      return () => {
        document.documentElement.style.backgroundColor = prevHtmlBg;
        document.body.style.backgroundColor = prevBodyBg;
        document.documentElement.style.removeProperty("--studio-bg");
        document.documentElement.style.removeProperty("--studio-header-bg");
      };
    }
  }, [currentBgColor]);

  return (
    <div
      className="min-h-screen text-white flex flex-col selection:bg-[#FE760B] selection:text-[#131517] transition-colors duration-300 w-full"
      style={{
        backgroundColor: currentBgColor,
      }}
    >
      {/* Main Studio Body: 2 Columns */}
      <div className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="mb-6 flex items-center justify-between gap-3 text-xs text-white/70">
          <button
            type="button"
            onClick={() => {
              if (onClose) onClose();
              else router.push("/admin/dashboard");
            }}
            className="inline-flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-[#FE760B]" />
            <span className="font-medium">Back to Events</span>
          </button>

          <div className="flex items-center gap-2.5 sm:gap-3">
            <span className="font-semibold text-white/80 tracking-wide hidden sm:inline-block">
              {isEventCancelled
                ? "Event Cancelled (View Only)"
                : editingEvent
                ? "Edit Event Studio"
                : "Create Event Studio"}
            </span>
          </div>
        </div>

        {/* Cancelled Event Warning Banner */}
        {isEventCancelled && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
              <div>
                <p className="text-xs font-bold text-rose-400">
                  This event is Cancelled — View-Only Mode
                </p>
                <p className="text-[11px] text-rose-200/80">
                  Registrations are permanently stopped and all event operations are locked in read-only mode.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                if (onClose) onClose();
                else router.push("/admin/dashboard");
              }}
              className="px-3 py-1.5 rounded-lg bg-[#212327] hover:bg-[#2A2D31] text-xs font-bold text-white border border-[#2A2D31] transition-colors shrink-0 cursor-pointer"
            >
              Return to Events
            </button>
          </div>
        )}
        <form
          onSubmit={handleFormSubmit}
          className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start"
        >
          {/* ================= LEFT COLUMN: POSTER & THEME ================= */}
          <div className="lg:col-span-5 flex flex-col items-center lg:items-start space-y-4 lg:sticky lg:top-20 w-full">
            {/* Poster Card (Square, 1:1, rounded-3xl) with Draggable Text Overlay */}
            <div
              ref={posterContainerRef}
              onClick={() => {
                if (formData.showPosterText === false) {
                  setFormData((prev) => ({ ...prev, showPosterText: true }));
                  setShowTypographyModal(true);
                } else if (!formData.name && !formData.posterLine1 && !posterLines.line1) {
                  setShowTypographyModal(true);
                }
              }}
              className="w-full max-w-[420px] lg:max-w-none aspect-square rounded-3xl overflow-hidden relative border border-[#2A2D31] shadow-2xl bg-[#1A1C1F] group select-none"
            >
              {formData.coverImage ? (
                // Custom Uploaded Banner Image
                <div className="w-full h-full relative">
                  <img
                    src={formData.coverImage}
                    alt="Event Poster"
                    className="w-full h-full object-cover pointer-events-none select-none"
                    draggable={false}
                  />
                  {/* Remove image button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeCoverImage();
                    }}
                    className="absolute top-3 right-3 z-30 w-8 h-8 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center transition-all border border-white/20 shadow-md cursor-pointer"
                    title="Remove custom image"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                // Procedural Poster matching Image 2 (Tech Fest style with sunny yellow arc & grid)
                <div
                  className="w-full h-full relative flex flex-col justify-between p-6 overflow-hidden transition-colors duration-300"
                  style={{ backgroundColor: selectedTheme.bg }}
                >
                  {/* Sun quarter circle / arc in top-right corner */}
                  <div
                    className="absolute -top-12 -right-12 w-48 h-48 rounded-full pointer-events-none transition-colors duration-300"
                    style={{ backgroundColor: selectedTheme.sun }}
                  />

                  {/* Grid Lines Pattern matching Image 2 */}
                  <div
                    className="absolute inset-0 opacity-20 pointer-events-none"
                    style={{
                      backgroundImage:
                        "linear-gradient(#000 1.5px, transparent 1.5px), linear-gradient(90deg, #000 1.5px, transparent 1.5px)",
                      backgroundSize: "18px 18px",
                    }}
                  />
                </div>
              )}

              {/* Action button on banner when text is hidden ("Clean" mode) */}
              {formData.showPosterText === false && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFormData((prev) => ({ ...prev, showPosterText: true }));
                    setShowTypographyModal(true);
                  }}
                  className="absolute bottom-3 left-3 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/80 hover:bg-black text-white backdrop-blur border border-white/25 text-[11px] font-bold shadow-xl transition-all cursor-pointer hover:scale-105 active:scale-95"
                  title="Click to write text on banner"
                >
                  <Type className="w-3.5 h-3.5 text-[#FE760B]" />
                  <span>+ Write Text on Banner</span>
                </button>
              )}

              {/* ── DRAGGABLE TEXT OVERLAY WITH INSTANT EDIT ACCESS ── */}
              {formData.showPosterText !== false && (
                <div
                  onMouseDown={handleTextDragStart}
                  onTouchStart={handleTextDragStart}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowTypographyModal(true);
                  }}
                  className={`group/textbox absolute z-20 transition-all ${
                    isDraggingText ? "cursor-grabbing select-none ring-2 ring-[#FE760B]" : "cursor-grab"
                  } hover:ring-2 hover:ring-[#FE760B]/70 rounded-xl ${
                    formData.posterTextBg === "badge"
                      ? "bg-black/75 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/20 shadow-xl"
                      : formData.posterTextBg === "solid"
                      ? "bg-[#131517] px-3.5 py-2 rounded-xl border border-[#2A2D31] shadow-xl"
                      : "p-1.5"
                  }`}
                  style={{
                    left: `${formData.posterTextX ?? 6}%`,
                    top: `${formData.posterTextY ?? (formData.coverImage ? 55 : 68)}%`,
                    width: `${formData.posterTextWidth ?? 85}%`,
                    maxWidth: "calc(100% - 44px)",
                    textAlign: formData.posterAlign || "left",
                    fontFamily:
                      formData.fontFamily === "JetBrains Mono"
                        ? "ui-monospace, monospace"
                        : formData.fontFamily === "New Spirit"
                        ? "Georgia, serif"
                        : formData.fontFamily === "Outfit"
                        ? "'Outfit', sans-serif"
                        : formData.fontFamily === "Roboto"
                        ? "'Roboto', sans-serif"
                        : "inherit",
                    textShadow:
                      formData.posterTextBg === "shadow" || (!formData.posterTextBg && formData.coverImage)
                        ? "0 2px 10px rgba(0,0,0,0.9), 0 1px 3px rgba(0,0,0,0.85)"
                        : "none",
                  }}
                  title="Click to edit text & typography • Drag to move"
                >
                  {/* Hover Pill: Quick indicator that clicking opens the editor */}
                  <div className="absolute -top-6 left-0 opacity-0 group-hover/textbox:opacity-100 transition-opacity flex items-center gap-1.5 bg-[#FE760B] text-[#131517] px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase shadow-lg whitespace-nowrap z-30 pointer-events-none">
                    <Pencil className="w-2.5 h-2.5 stroke-[2.5]" />
                    <span>Click to edit text</span>
                    <span className="opacity-40">•</span>
                    <Move className="w-2.5 h-2.5" />
                    <span>Drag to move</span>
                  </div>

                  {/* Stretchable Horizontal Resize Handle on Right Edge */}
                  <div
                    onMouseDown={handleResizeStart}
                    onTouchStart={handleResizeStart}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute -right-3 top-1/2 -translate-y-1/2 w-4 h-9 rounded-md bg-[#FE760B] text-[#131517] flex items-center justify-center cursor-ew-resize shadow-xl z-30 select-none hover:scale-110 active:scale-95 transition-transform opacity-70 group-hover/textbox:opacity-100"
                    title="Drag horizontally to stretch or shrink text box width"
                  >
                    <span className="text-[10px] font-black leading-none">↔</span>
                  </div>

                  {/* Rendered Text Content */}
                  {posterLines.line1 || formData.name || formData.posterLine1 ? (
                    <div>
                      <span
                        className="block font-black leading-[0.92] tracking-tight uppercase select-none break-words"
                        style={{
                          color:
                            formData.posterTextColor === "dark"
                              ? "#131517"
                              : formData.posterTextColor === "light"
                              ? "#FFFFFF"
                              : formData.coverImage
                              ? "#FFFFFF"
                              : selectedTheme.text,
                          fontSize: `${formData.posterFontSize || 34}px`,
                        }}
                      >
                        {posterLines.line1}
                      </span>
                      {posterLines.line2 && (
                        <span
                          className="block font-black leading-[0.92] tracking-tight uppercase select-none mt-1 break-words"
                          style={{
                            color:
                              formData.posterTextColor === "dark"
                                ? "#131517"
                                : formData.posterTextColor === "light"
                                ? "#FFFFFF"
                                : formData.coverImage
                                ? "#FFFFFF"
                                : selectedTheme.text,
                            fontSize: `${Math.max(
                              18,
                              Math.round((formData.posterFontSize || 34) * 0.88),
                            )}px`,
                          }}
                        >
                          {posterLines.line2}
                        </span>
                      )}
                      {formData.posterLine3 && (
                        <span
                          className="block font-bold leading-tight tracking-tight uppercase select-none mt-1.5 opacity-90 break-words"
                          style={{
                            color:
                              formData.posterTextColor === "dark"
                                ? "#131517"
                                : formData.posterTextColor === "light"
                                ? "#FFFFFF"
                                : formData.coverImage
                                ? "#FFFFFF"
                                : selectedTheme.text,
                            fontSize: `${Math.max(
                              12,
                              Math.round((formData.posterFontSize || 34) * 0.55),
                            )}px`,
                          }}
                        >
                          {formData.posterLine3}
                        </span>
                      )}
                    </div>
                  ) : (
                    /* Inviting clickable write button when text is empty */
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowTypographyModal(true);
                      }}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-black/60 hover:bg-black/85 border border-dashed border-white/50 hover:border-[#FE760B] text-white/90 hover:text-white cursor-pointer transition-all shadow-xl backdrop-blur-md group select-none"
                    >
                      <Type className="w-4 h-4 text-[#FE760B] group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-bold tracking-tight">
                        Click to write text on banner
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Camera Upload Button in Bottom-Right Corner matching Image 2 */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="absolute bottom-3 right-3 z-30 w-10 h-10 rounded-full bg-black/75 hover:bg-black text-white flex items-center justify-center backdrop-blur border border-white/25 transition-transform hover:scale-105 active:scale-95 shadow-xl cursor-pointer"
                title="Upload custom banner image (up to 5 MB)"
              >
                <Camera className="w-5 h-5 text-white" />
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleImageUpload}
              />
            </div>

            {/* Helper text directly underneath square cover artwork */}
            <div className="w-full max-w-[420px] lg:max-w-none px-1 pt-0.5">
              <p className="text-[11px] text-white/50 leading-relaxed">
                Square cover artwork: JPEG, PNG or WebP up to 5 MB
              </p>
            </div>

            {/* Theme & Artwork Bar matching User Screenshot */}
            <div className="w-full max-w-[420px] lg:max-w-none space-y-2.5 pt-1">
              <div className="flex items-stretch gap-2 relative">
                {/* Theme Selector Pill Dropdown Trigger */}
                <div className="relative flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => setShowThemeDropdown(!showThemeDropdown)}
                    className="w-full h-[50px] flex items-center justify-between gap-3 px-3.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] backdrop-blur-md border border-white/10 hover:border-white/20 transition-all cursor-pointer shadow-sm group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Theme Palette Icon from react-icons */}
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border transition-all shadow-xs"
                        style={{
                          backgroundColor: `${selectedTheme.color}20`,
                          borderColor: `${selectedTheme.color}40`,
                        }}
                      >
                        <IoColorPalette
                          className="w-4 h-4 transition-transform group-hover:scale-110"
                          style={{ color: selectedTheme.color }}
                        />
                      </div>
                      <div className="flex flex-col text-left leading-tight min-w-0">
                        <span className="text-[10px] text-white/60 font-medium uppercase tracking-wider">Theme</span>
                        <span className="text-xs sm:text-sm font-bold text-white truncate">
                          {selectedTheme.name}
                        </span>
                      </div>
                    </div>
                    <ChevronsUpDown className="w-4 h-4 text-white/60 group-hover:text-white shrink-0 transition-colors" />
                  </button>

                  {/* Theme Selection Dropdown Popover */}
                  {showThemeDropdown && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowThemeDropdown(false)}
                      />
                      <div
                        className="absolute top-full left-0 mt-2 w-72 bg-[#181512] dark:bg-[#181512] border border-white/20 rounded-2xl p-3 shadow-2xl z-50 space-y-2 animate-in fade-in zoom-in-95 duration-100"
                        style={{
                          boxShadow: "0 20px 40px -10px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.15)",
                        }}
                      >
                        <div className="flex items-center justify-between pb-1.5 border-b border-white/10 px-1">
                          <span className="text-xs font-bold text-white flex items-center gap-1.5">
                            <IoColorPalette className="w-3.5 h-3.5" style={{ color: selectedTheme.color }} />
                            Select Event Theme
                          </span>
                          <span className="text-[10px] text-white/50">Luma Minimal &amp; Vibrant</span>
                        </div>

                        <div className="space-y-1 max-h-56 overflow-y-auto custom-scrollbar">
                          {THEMES.map((theme) => {
                            const isSelected = formData.theme === theme.id;
                            return (
                              <button
                                key={theme.id}
                                type="button"
                                onClick={() => {
                                  const isCurrentPreset =
                                    !formData.coverImage ||
                                    ARTWORK_PRESETS.some((p) => p.svg === formData.coverImage);
                                  let matchingPreset = formData.coverImage;
                                  if (isCurrentPreset) {
                                    if (theme.id === "minimal" || theme.id === "sunset") {
                                      matchingPreset = ARTWORK_PRESETS[1].svg;
                                    } else if (theme.id === "sunny") {
                                      matchingPreset = ARTWORK_PRESETS[0].svg;
                                    } else if (theme.id === "electric") {
                                      matchingPreset = ARTWORK_PRESETS[2].svg;
                                    } else if (theme.id === "neon") {
                                      matchingPreset = ARTWORK_PRESETS[3].svg;
                                    } else {
                                      matchingPreset = ARTWORK_PRESETS[1].svg;
                                    }
                                  }

                                  setFormData((prev) => ({
                                    ...prev,
                                    theme: theme.id,
                                    themeColor: theme.color,
                                    ticketBgColor: theme.color,
                                    coverImage: matchingPreset,
                                  }));
                                  setCustomColorHex(theme.color);
                                  setThemeHexInput(theme.color.replace(/^#/, ""));
                                  setTicketHexInput(theme.color.replace(/^#/, ""));
                                  setShowThemeDropdown(false);
                                }}
                                className={`w-full p-2 rounded-xl flex items-center justify-between text-left transition-colors cursor-pointer ${
                                  isSelected ? "bg-white/[0.15]" : "hover:bg-white/[0.08]"
                                }`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <span
                                    className="w-4 h-4 rounded-full border border-white/20 shrink-0"
                                    style={{ backgroundColor: theme.color }}
                                  />
                                  <span className="text-xs font-semibold text-white">
                                    {theme.name}
                                  </span>
                                </div>
                                {isSelected && (
                                  <Check className="w-3.5 h-3.5 stroke-[3]" style={{ color: selectedTheme.color }} />
                                )}
                              </button>
                            );
                          })}
                        </div>

                        {/* Custom Color Option inside dropdown */}
                        <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2 px-1">
                          <div className="flex items-center gap-2">
                            <label
                              title="Pick custom color"
                              className="relative w-6 h-6 rounded-md border border-white/20 shadow-xs cursor-pointer shrink-0 overflow-hidden flex items-center justify-center hover:scale-105 transition-transform"
                              style={{ backgroundColor: selectedTheme.color }}
                            >
                              <input
                                type="color"
                                value={normalizeHex(selectedTheme.color)}
                                onChange={(e) => {
                                  const val = e.target.value.toUpperCase();
                                  setThemeHexInput(val.replace(/^#/, ""));
                                  setTicketHexInput(val.replace(/^#/, ""));
                                  setCustomColorHex(val);
                                  setFormData((prev) => ({
                                    ...prev,
                                    theme: "custom",
                                    themeColor: val,
                                    ticketBgColor: val,
                                  }));
                                }}
                                className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                              />
                            </label>
                            <span className="text-xs font-medium text-white/80">Custom Hex:</span>
                          </div>
                          <div className="flex items-center gap-1 bg-black/40 px-2 py-1 rounded-lg border border-white/15">
                            <span className="text-xs font-mono font-bold text-[#FE760B]">#</span>
                            <input
                              type="text"
                              maxLength={6}
                              value={themeHexInput}
                              onChange={(e) => {
                                const raw = e.target.value.replace(/^#/, "").replace(/[^0-9A-Fa-f]/g, "").slice(0, 6).toUpperCase();
                                setThemeHexInput(raw);
                                if (raw.length === 3 || raw.length === 6) {
                                  const fullHex = normalizeHex(raw);
                                  setCustomColorHex(fullHex);
                                  setTicketHexInput(fullHex.replace(/^#/, ""));
                                  setFormData((prev) => ({
                                    ...prev,
                                    theme: "custom",
                                    themeColor: fullHex,
                                    ticketBgColor: fullHex,
                                  }));
                                }
                              }}
                              className="w-16 font-mono text-xs uppercase font-bold text-white bg-transparent outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Shuffle Button with react-icons IoShuffle */}
                <button
                  type="button"
                  onClick={handleShuffleArtwork}
                  className="w-[50px] h-[50px] rounded-xl bg-white/[0.08] hover:bg-white/[0.14] backdrop-blur-md border border-white/10 hover:border-white/20 transition-all cursor-pointer shadow-sm flex items-center justify-center text-white/80 hover:text-white shrink-0 group active:scale-95"
                  title="Shuffle cover artwork preset"
                >
                  <IoShuffle className="w-5 h-5 text-white/70 group-hover:text-white transition-colors" />
                </button>
              </div>

              {/* Banner Text & Typography Trigger Card */}
              <div
                className="w-full min-h-[54px] p-3 sm:px-4 sm:py-3 bg-[#181A1D] hover:bg-[#212327] rounded-2xl border border-[#2A2D31] hover:border-[#FE760B]/50 flex items-center justify-between gap-3 shadow-md transition-all cursor-pointer group"
                onClick={() => setShowTypographyModal(true)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-[#FE760B]/15 border border-[#FE760B]/30 flex items-center justify-center text-[#FE760B] shrink-0 font-bold group-hover:scale-105 transition-transform">
                    <Type className="w-4 h-4 text-[#FE760B]" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-bold text-white flex items-center gap-2 truncate">
                      <span>Banner Text &amp; Typography</span>
                      {formData.showPosterText === false ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 font-semibold border border-red-500/25">
                          Hidden
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FE760B]/15 text-[#FE760B] font-semibold border border-[#FE760B]/30">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[#9B9EA4] truncate mt-0.5 font-medium">
                      {formData.showPosterText === false
                        ? "Click to enable text on your event banner"
                        : formData.posterTextMode === "custom"
                        ? `Custom: "${formData.posterLine1 || 'Line 1'}" • ${formData.posterFontSize || 34}px`
                        : `Auto Title: "${posterLines.line1 || formData.name || 'Event Title'}" • ${formData.posterFontSize || 34}px`}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (formData.showPosterText === false) {
                      setFormData((prev) => ({ ...prev, showPosterText: true }));
                    }
                    setShowTypographyModal(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FE760B] hover:bg-[#ff8624] text-[#131517] text-xs font-bold transition-all shadow-sm shrink-0 cursor-pointer hover:scale-105 active:scale-95"
                >
                  <Pencil className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>{formData.showPosterText === false ? "Add Text" : "Edit Text"}</span>
                </button>
              </div>
            </div>
          </div>

          {/* ================= RIGHT COLUMN: EVENT DETAILS ================= */}
          <div className="lg:col-span-7 flex flex-col space-y-4 w-full">

            {/* Event Name Input (Cleanly labeled & aligned with top of poster card) */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-white/50 block">
                Event Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormData((prev) => ({
                    ...prev,
                    name: val,
                    title: val,
                    // If in auto mode, clear any custom posterLines so they don't override the name
                    ...(prev.posterTextMode !== "custom" ? { posterLine1: "", posterLine2: "" } : {}),
                    showPosterText: true,
                  }));
                }}
                placeholder="Event Name"
                required
                className="tl-bare-input w-full !bg-transparent text-3xl sm:text-4xl lg:text-5xl font-black text-white placeholder:text-white/25 !border-none !outline-none !shadow-none focus:outline-none focus:ring-0 p-0 tracking-tight leading-tight"
              />
            </div>

            {/* Date & Time Card */}
            <div className={`rounded-2xl bg-white/[0.08] backdrop-blur-md border border-white/10 p-3.5 sm:p-4 shadow-md relative transition-all ${
              showStartTimePicker || showEndTimePicker || showStartCalendar || showEndCalendar ? "z-40" : "z-10"
            }`}>
              {/* Start and End rows connected by vertical timeline line */}
              <div className="w-full space-y-2.5 relative">
                {/* Vertical timeline connector line */}
                <div className="absolute left-[4.5px] top-[14px] bottom-[14px] w-px bg-white/25 pointer-events-none" />

                {/* Start row: ● Start [Thu, Nov 5] [18:30] */}
                <div className={`flex items-center gap-2 sm:gap-3 flex-nowrap relative ${
                  showStartCalendar || showStartTimePicker ? "z-30" : "z-20"
                }`}>
                  <div className="flex items-center gap-2 w-14 sm:w-16 shrink-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
                      style={{ backgroundColor: selectedTheme.color }}
                    />
                    <span className="text-xs font-semibold text-white/70">
                      Start
                    </span>
                  </div>

                  {/* Start Date Pill with Calendar Popover */}
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setShowStartCalendar(!showStartCalendar);
                        setShowStartTimePicker(false);
                        setShowEndCalendar(false);
                        setShowEndTimePicker(false);
                      }}
                      style={showStartCalendar ? { borderColor: selectedTheme.color } : {}}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/10 border border-white/10 text-xs font-mono font-medium text-white transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <span>{formatDatePill(formData.startDate)}</span>
                    </button>

                    {showStartCalendar && (
                      <ThemedCalendarPopover
                        value={formData.startDate}
                        minDate={getTodayStr()}
                        onChange={(newDate) => {
                          setFormData((prev) => ({
                            ...prev,
                            startDate: newDate,
                            endDate: prev.endDate < newDate ? newDate : prev.endDate,
                          }));
                        }}
                        onClose={() => setShowStartCalendar(false)}
                        themeColor={selectedTheme.color}
                      />
                    )}
                  </div>

                  {/* Start Time Pill with Time Dropdown */}
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setShowStartTimePicker(!showStartTimePicker);
                        setShowStartCalendar(false);
                        setShowEndCalendar(false);
                        setShowEndTimePicker(false);
                      }}
                      style={showStartTimePicker ? { borderColor: selectedTheme.color } : {}}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/10 border border-white/10 text-xs font-mono font-medium text-white transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <span>{formData.startTime}</span>
                    </button>

                    {showStartTimePicker && (
                      <ThemedTimeDropdown
                        value={formData.startTime}
                        minMinutes={
                          formData.startDate === getTodayStr()
                            ? new Date().getHours() * 60 + new Date().getMinutes() - 5
                            : null
                        }
                        onChange={(newTime) => {
                          setFormData((prev) => ({
                            ...prev,
                            startTime: newTime,
                          }));
                        }}
                        onClose={() => setShowStartTimePicker(false)}
                        themeColor={selectedTheme.color}
                      />
                    )}
                  </div>
                </div>

                {/* End row: ○ End [Thu, Nov 5] [19:30] */}
                <div className={`flex items-center gap-2 sm:gap-3 flex-nowrap relative ${
                  showEndCalendar || showEndTimePicker ? "z-30" : "z-10"
                }`}>
                  <div className="flex items-center gap-2 w-14 sm:w-16 shrink-0">
                    <span className="w-2.5 h-2.5 rounded-full border-2 border-white/60 bg-transparent shrink-0" />
                    <span className="text-xs font-semibold text-white/70">
                      End
                    </span>
                  </div>

                  {/* End Date Pill with Calendar Popover */}
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setShowEndCalendar(!showEndCalendar);
                        setShowEndTimePicker(false);
                        setShowStartCalendar(false);
                        setShowStartTimePicker(false);
                      }}
                      style={showEndCalendar ? { borderColor: selectedTheme.color } : {}}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/10 border border-white/10 text-xs font-mono font-medium text-white transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <span>{formatDatePill(formData.endDate)}</span>
                    </button>

                    {showEndCalendar && (
                      <ThemedCalendarPopover
                        value={formData.endDate}
                        minDate={formData.startDate || getTodayStr()}
                        onChange={(newDate) => {
                          setFormData((prev) => ({
                            ...prev,
                            endDate: newDate,
                          }));
                        }}
                        onClose={() => setShowEndCalendar(false)}
                        themeColor={selectedTheme.color}
                      />
                    )}
                  </div>

                  {/* End Time Pill with Time Dropdown */}
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setShowEndTimePicker(!showEndTimePicker);
                        setShowEndCalendar(false);
                        setShowStartCalendar(false);
                        setShowStartTimePicker(false);
                      }}
                      style={showEndTimePicker ? { borderColor: selectedTheme.color } : {}}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/10 border border-white/10 text-xs font-mono font-medium text-white transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <span>{formData.endTime}</span>
                    </button>

                    {showEndTimePicker && (
                      <ThemedTimeDropdown
                        value={formData.endTime}
                        minMinutes={
                          formData.endDate === formData.startDate
                            ? parseTimeToMinutes(formData.startTime)
                            : null
                        }
                        onChange={(newTime) => {
                          setFormData((prev) => ({
                            ...prev,
                            endTime: newTime,
                          }));
                        }}
                        onClose={() => setShowEndTimePicker(false)}
                        themeColor={selectedTheme.color}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Location Card matching screenshot */}
            {formData.location.trim() && formData.locationType === "in-person" ? (
              <div className="rounded-2xl bg-white/[0.08] backdrop-blur-md border border-white/10 p-4 space-y-3 shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <MapPin className="w-4 h-4 text-white/80 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <h4 className="text-sm sm:text-base font-bold text-white truncate">
                        {formData.locationVenue || formData.location}
                      </h4>
                      <p className="text-xs text-white/60 truncate mt-0.5">
                        {formData.locationAddress || formData.location}
                      </p>
                      {formData.locationPin?.landmark && (
                        <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-white/[0.06] border border-white/10 text-[11px] text-white/80 font-medium">
                          <MapPin className="w-3 h-3 text-[#FE760B] shrink-0" />
                          <span>Spot:</span>
                          <span>{formData.locationPin.landmark}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setFormData((prev) => ({
                          ...prev,
                          location: "",
                          locationVenue: "",
                          locationAddress: "",
                          latitude: null,
                          longitude: null,
                          locationPin: null,
                        }));
                        setSelectedLocationVenue(null);
                      }}
                      className="p-1 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                      title="Clear location"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Real Interactive Venue Map Preview with [ Adjust Pin ] pill button */}
                <div className="rounded-xl overflow-hidden border border-white/10 h-36 sm:h-44 w-full relative bg-black/40 shadow-inner">
                  <iframe
                    title="Interactive Venue Map Preview"
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    loading="lazy"
                    allowFullScreen
                    referrerPolicy="no-referrer-when-downgrade"
                    src={
                      `https://maps.google.com/maps?q=${encodeURIComponent(
                        formData.latitude && formData.longitude
                          ? `${formData.latitude},${formData.longitude}`
                          : formData.locationVenue || formData.location || "India"
                      )}&t=&z=15&ie=UTF8&iwloc=&output=embed`
                    }
                    className="w-full h-full filter saturate-[0.9] contrast-[1.05]"
                  />

                  {/* Top-left [ Adjust Pin ] overlay pill button matching screenshot */}
                  <button
                    type="button"
                    onClick={() => {
                      setLocationInput(formData.locationVenue || formData.location);
                      setShowLocationModal(true);
                    }}
                    className="absolute top-2.5 left-2.5 z-10 px-3 py-1 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md text-[11px] font-medium text-white border border-white/20 shadow-md flex items-center gap-1.5 transition-all cursor-pointer hover:scale-[1.02]"
                  >
                    <MapPin className="w-3 h-3 text-white/90" />
                    <span>Adjust Pin</span>
                  </button>

                  <div className="absolute top-2.5 right-2.5 z-10">
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                        formData.latitude && formData.longitude
                          ? `${formData.latitude},${formData.longitude}`
                          : formData.locationVenue || formData.location
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 rounded-lg bg-black/70 hover:bg-black text-[10px] font-medium text-white flex items-center gap-1 backdrop-blur-sm border border-white/10 transition-colors shadow-sm"
                    >
                      <span>Google Maps</span>
                      <ExternalLink className="w-2.5 h-2.5 text-[#FE760B]" />
                    </a>
                  </div>

                </div>

                {/* + Add Further Instructions button matching screenshot */}
                <div>
                  {!showFurtherInstructions && !formData.locationInstructions ? (
                    <button
                      type="button"
                      onClick={() => setShowFurtherInstructions(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/10 text-xs font-medium text-white/80 hover:text-white border border-white/10 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-white/70" />
                      <span>Add Further Instructions</span>
                    </button>
                  ) : (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-xs text-white/70">
                        <span className="font-medium">Further Location Instructions</span>
                        <button
                          type="button"
                          onClick={() => {
                            setShowFurtherInstructions(false);
                            setFormData((prev) => ({ ...prev, locationInstructions: "" }));
                          }}
                          className="text-[11px] text-white/50 hover:text-white"
                        >
                          Hide
                        </button>
                      </div>
                      <textarea
                        rows={2}
                        value={formData.locationInstructions}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, locationInstructions: e.target.value }))
                        }
                        placeholder="Enter directions, landmark, or entry instructions..."
                        className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white placeholder:text-white/40 outline-none focus:border-white/30 resize-none transition-colors"
                      />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div
                onClick={() => {
                  setLocationInput(formData.location);
                  setShowLocationModal(true);
                }}
                className="rounded-2xl bg-white/[0.08] backdrop-blur-md border border-white/10 p-4 flex items-start gap-3.5 hover:bg-white/[0.12] transition-colors cursor-pointer shadow-sm group"
              >
                <MapPin className={`w-5 h-5 shrink-0 mt-0.5 transition-colors ${
                  formData.location.trim() ? "text-[#FE760B]" : "text-white/60 group-hover:text-white"
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white">
                    {formData.location.trim() ? (
                      <span className="text-white font-bold">{formData.locationVenue || formData.location}</span>
                    ) : (
                      <span>Add Event Location *</span>
                    )}
                  </div>
                  <div className="text-xs text-white/60 mt-0.5 truncate">
                    {formData.locationType === "virtual"
                      ? formData.virtualLink || "Online meeting / virtual link"
                      : "Search venue on Google Maps or add virtual link"}
                  </div>
                </div>
              </div>
            )}

            {/* Description Card matching screenshot */}
            <div
              onClick={() => setShowDescriptionModal(true)}
              className="rounded-2xl bg-white/[0.08] backdrop-blur-md border border-white/10 p-4 flex items-center gap-3.5 hover:bg-white/[0.12] transition-colors cursor-pointer shadow-sm group"
            >
              <AlignLeft className="w-5 h-5 text-white/60 group-hover:text-white shrink-0 transition-colors" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white">
                  {safeDescription.trim() ? (
                    <span className="line-clamp-2">{safeDescription}</span>
                  ) : (
                    <span className="text-white/60">Event Description</span>
                  )}
                </div>
              </div>
            </div>

            {/* Event Options Section matching Image 1, 2, 4 */}
            <div className="pt-2">
              <div className="text-xs text-white/60 font-medium tracking-wide mb-2">
                Event Options
              </div>

              <div className="rounded-2xl bg-white/[0.08] backdrop-blur-md border border-white/10 divide-y divide-white/10 overflow-hidden shadow-sm">
                {/* Row 1: Ticket Price */}
                <div className="p-4 sm:p-5 space-y-3.5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <IoTicket className="w-4 h-4 text-white/60 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-white block">
                          Ticket Pricing
                        </span>
                        <span className="text-[11px] text-white/60 block leading-tight mt-0.5">
                          Set free registration or charge a fixed price per attendee
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`text-xs font-bold px-3 py-1 rounded-full border transition-all ${
                          formData.isPaid
                            ? "bg-[#FE760B]/15 text-[#FE760B] border-[#FE760B]/30"
                            : "bg-[#3DD68C]/15 text-[#3DD68C] border-[#3DD68C]/30"
                        }`}
                      >
                        {formData.isPaid ? `Paid Pass (₹${formData.price || 0})` : "Free Entry"}
                      </span>

                      {/* Toggle button matching Image 2 */}
                      <button
                        type="button"
                        onClick={() =>
                          setFormData((prev) => {
                            const nextIsPaid = !prev.isPaid;
                            return {
                              ...prev,
                              isPaid: nextIsPaid,
                              // If switching to paid, automatically turn off and lock requireApproval
                              requireApproval: nextIsPaid ? false : prev.requireApproval,
                            };
                          })
                        }
                        className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
                          formData.isPaid ? "bg-[#FE760B]" : "bg-white/20"
                        }`}
                        title={formData.isPaid ? "Switch to Free event" : "Switch to Paid event"}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                            formData.isPaid ? "translate-x-5" : ""
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Prominent, Beautifully Styled Price Input Box when Paid is enabled */}
                  {formData.isPaid && (
                    <div className="p-4 rounded-xl bg-black/30 border border-white/10 space-y-3 animate-fade-in shadow-inner">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <label className="text-xs font-bold text-white block">
                            Ticket Price (INR)
                          </label>
                          <span className="text-[11px] text-white/60">
                            Enter the pass amount per attendee
                          </span>
                        </div>

                        {/* Large, Clear, High-Contrast Price Input Box */}
                        <div className="flex items-center gap-2 bg-black/40 px-4 py-2.5 rounded-xl border border-white/15 focus-within:border-[#FE760B] focus-within:ring-2 focus-within:ring-[#FE760B]/20 transition-all w-full sm:w-52">
                          <span className="text-xl font-black text-[#FE760B]">₹</span>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            placeholder="199"
                            value={formData.price}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                price: e.target.value,
                              }))
                            }
                            className="bg-transparent text-xl font-black text-white w-full border-none outline-none focus:ring-0 p-0 tracking-tight"
                          />
                          <span className="text-[11px] font-bold text-white/60 uppercase tracking-wider">
                            INR
                          </span>
                        </div>
                      </div>

                      {/* Quick select price chips */}
                      <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-white/10">
                        <span className="text-[10px] text-white/60 font-semibold uppercase">Popular:</span>
                        {["99", "199", "499", "999"].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setFormData((prev) => ({ ...prev, price: preset }))}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                              String(formData.price) === preset
                                ? "bg-[#FE760B] text-[#131517] font-bold shadow-xs"
                                : "bg-white/[0.08] text-white/80 hover:text-white hover:bg-white/15 border border-white/10"
                            }`}
                          >
                            ₹{preset}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Row 2: Require Approval toggle (Locked & Off for Paid Events) */}
                <div className={`p-4 flex items-center justify-between gap-4 ${formData.isPaid ? "opacity-65" : ""}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <Lock className={`w-4 h-4 shrink-0 ${formData.isPaid ? "text-amber-400/80" : "text-white/60"}`} />
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-white block">
                        Require Approval
                      </span>
                      {formData.isPaid ? (
                        <span className="text-[11px] text-amber-400 font-medium block leading-tight mt-0.5">
                          Paid events do not require approval (passes are auto-confirmed upon payment)
                        </span>
                      ) : (
                        <span className="text-[11px] text-white/60 block leading-tight mt-0.5">
                          Manually review and approve registrations before tickets are issued
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={formData.isPaid}
                    onClick={() => {
                      if (formData.isPaid) return;
                      setFormData((prev) => ({
                        ...prev,
                        requireApproval: !prev.requireApproval,
                      }));
                    }}
                    className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
                      formData.isPaid
                        ? "cursor-not-allowed bg-white/20 opacity-50"
                        : "cursor-pointer"
                    } ${
                      !formData.isPaid && formData.requireApproval ? "bg-[#3DD68C]" : "bg-white/20"
                    }`}
                    style={!formData.isPaid && formData.requireApproval ? { backgroundColor: selectedTheme.color } : {}}
                    title={
                      formData.isPaid
                        ? "Paid events do not require approval"
                        : formData.requireApproval
                        ? "Approval required"
                        : "Approval not required"
                    }
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                        !formData.isPaid && formData.requireApproval ? "translate-x-5" : ""
                      }`}
                    />
                  </button>
                </div>

                {/* Row 3: Capacity field */}
                <div
                  onClick={() => setShowCapacityModal(true)}
                  className="p-4 flex items-center justify-between gap-4 hover:bg-white/[0.03] cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <Upload className="w-4 h-4 text-white/60 group-hover:text-white transition-colors rotate-180" />
                    <span className="text-sm font-medium text-white">
                      Capacity
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-white/70 group-hover:text-white transition-colors">
                      {formData.limitCapacity ? `${formData.maxCapacity} spots` : "Unlimited"}
                    </span>
                    <Edit3 className="w-3.5 h-3.5 text-white/60 group-hover:text-white transition-colors" />
                  </div>
                </div>

                {/* Row 4: Poster Typography & Layout Modal Trigger */}
                <div
                  onClick={() => setShowTypographyModal(true)}
                  className="p-4 flex items-center justify-between gap-4 hover:bg-white/[0.03] cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Type className="w-4 h-4 text-white/60 group-hover:text-white transition-colors shrink-0" />
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-white block">
                        Poster &amp; Ticket Typography
                      </span>
                      <span className="text-[11px] text-white/60 block truncate">
                        {formData.posterTextMode === "auto" ? "Auto Title" : "Custom Lines"} • {formData.posterFontSize || 34}px • {formData.posterAlign || "Left"} • {formData.posterTextWidth || 85}% width
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className="text-xs font-semibold group-hover:underline"
                      style={{ color: selectedTheme.color }}
                    >
                      Customize
                    </span>
                    <Edit3 className="w-3.5 h-3.5 text-white/60 group-hover:text-white transition-colors" />
                  </div>
                </div>

                {/* Ticket Format & Style (Stub tickets vs Wide tickets) */}
                <div className="p-4 sm:p-5 border-t border-white/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <IoTicket className="w-4 h-4 text-white/60 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-white block">
                          Ticket Layout &amp; Template
                        </span>
                        <span className="text-[11px] text-white/60 block leading-tight mt-0.5">
                          Choose between standard stub ticket or collectible deck view pass. Editable anytime.
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                    {/* Option 1: Stub tickets */}
                    <button
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({ ...prev, ticketDesign: "stub" }))
                      }
                      className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden group flex flex-col justify-between ${
                        formData.ticketDesign === "stub"
                          ? "ring-1 shadow-lg"
                          : "border-white/10 bg-white/[0.04] hover:bg-white/[0.08]"
                      }`}
                      style={
                        formData.ticketDesign === "stub"
                          ? {
                              borderColor: selectedTheme.color,
                              backgroundColor: `${selectedTheme.color}22`,
                              boxShadow: `0 0 20px ${selectedTheme.color}25`,
                            }
                          : {}
                      }
                    >
                      <div className="flex items-center justify-between mb-1.5 w-full">
                        <span className="text-xs font-bold text-white flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: selectedTheme.color }}
                          />
                          Stub tickets (Default)
                        </span>
                        {formData.ticketDesign === "stub" ? (
                          <span
                            className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                            style={{
                              backgroundColor: selectedTheme.color,
                              color: isLightColor(selectedTheme.color) ? "#131517" : "#FFFFFF",
                            }}
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </span>
                        ) : (
                          <span className="w-5 h-5 rounded-full border border-white/20 bg-black/30 shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-white/60 leading-relaxed">
                        780 × 240 art panel + dark QR check-in stub.
                      </p>
                    </button>

                    {/* Option 2: Deck View tickets */}
                    <button
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({ ...prev, ticketDesign: "deck" }))
                      }
                      className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden group flex flex-col justify-between ${
                        formData.ticketDesign === "deck" || formData.ticketDesign === "wide"
                          ? "ring-1 shadow-lg"
                          : "border-white/10 bg-white/[0.04] hover:bg-white/[0.08]"
                      }`}
                      style={
                        formData.ticketDesign === "deck" || formData.ticketDesign === "wide"
                          ? {
                              borderColor: selectedTheme.color,
                              backgroundColor: `${selectedTheme.color}22`,
                              boxShadow: `0 0 20px ${selectedTheme.color}25`,
                            }
                          : {}
                      }
                    >
                      <div className="flex items-center justify-between mb-1.5 w-full">
                        <span className="text-xs font-bold text-white flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: selectedTheme.color }}
                          />
                          Deck View tickets
                        </span>
                        {formData.ticketDesign === "deck" || formData.ticketDesign === "wide" ? (
                          <span
                            className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                            style={{
                              backgroundColor: selectedTheme.color,
                              color: isLightColor(selectedTheme.color) ? "#131517" : "#FFFFFF",
                            }}
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </span>
                        ) : (
                          <span className="w-5 h-5 rounded-full border border-white/20 bg-black/30 shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-white/60 leading-relaxed">
                        Interactive collectible deck pass with QR tear notch.
                      </p>
                    </button>
                  </div>

                  {/* Ticket Background & Accent Color Card */}
                  <div className="mt-4 rounded-2xl bg-white/[0.04] border border-white/10 p-4 sm:p-5 space-y-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <IoTicket className="w-4 h-4 text-white/70 shrink-0" />
                        <h4 className="text-xs sm:text-sm font-bold text-white tracking-wide">
                          Ticket Background &amp; Accent Color
                        </h4>
                      </div>
                      <p className="text-[11px] text-white/60 mt-1">
                        Choose your custom ticket accent and background color. Select from the palette wheel or enter any 6-digit hex code.
                      </p>
                    </div>

                    {/* Ticket Background Color Picker and Hex Code Input */}
                    <div className="p-3 rounded-xl bg-black/30 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <label
                          title="Click to choose custom ticket color"
                          className="relative w-8 h-8 rounded-lg border border-white/20 shadow-xs cursor-pointer shrink-0 overflow-hidden flex items-center justify-center hover:scale-105 transition-transform"
                          style={{ backgroundColor: formData.ticketBgColor || selectedTheme.color }}
                        >
                          <input
                            type="color"
                            value={normalizeHex(formData.ticketBgColor || selectedTheme.color)}
                            onChange={(e) => {
                              const val = e.target.value.toUpperCase();
                              setTicketHexInput(val.replace(/^#/, ""));
                              setFormData((prev) => ({
                                ...prev,
                                ticketBgColor: val,
                              }));
                            }}
                            className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                          />
                        </label>
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-white/60 block">
                            Current Ticket Color
                          </span>
                          <span className="text-xs font-mono font-bold text-white">
                            {normalizeHex(formData.ticketBgColor || selectedTheme.color)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 bg-black/40 border border-white/15 px-2.5 py-1 rounded-lg focus-within:border-[#FE760B] transition-colors">
                          <span className="text-xs text-[#FE760B] font-mono font-bold">#</span>
                          <input
                            type="text"
                            maxLength={7}
                            value={ticketHexInput}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/^#/, "").replace(/[^0-9A-Fa-f]/g, "").slice(0, 6).toUpperCase();
                              setTicketHexInput(raw);
                              if (raw.length === 3 || raw.length === 6) {
                                const fullHex = normalizeHex(raw);
                                setFormData((prev) => ({
                                  ...prev,
                                  ticketBgColor: fullHex,
                                }));
                              }
                            }}
                            placeholder="FE760B"
                            className="w-20 font-mono text-xs uppercase font-bold text-white bg-transparent outline-none"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const fullHex = normalizeHex(ticketHexInput);
                            setTicketHexInput(fullHex.replace(/^#/, ""));
                            setFormData((prev) => ({
                              ...prev,
                              ticketBgColor: fullHex,
                            }));
                            toast.success(`Ticket color ${fullHex} applied!`);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white border border-white/10 transition-colors cursor-pointer"
                        >
                          Use Color
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* ── Ticket Background Image Upload ── */}
                  <div className="pt-2">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold text-white flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5 text-[#FE760B]" />
                        <span>Ticket Background Image</span>
                        <span className="text-[10px] font-normal text-white/50">(Optional)</span>
                      </label>
                      {formData.ticketBgUrl && (
                        <button
                          type="button"
                          onClick={removeTicketBgImage}
                          className="text-[11px] font-semibold text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                          Remove Image
                        </button>
                      )}
                    </div>

                    <input
                      ref={ticketBgInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleTicketBgUpload}
                      className="hidden"
                    />

                    {formData.ticketBgUrl ? (
                      <div className="relative rounded-xl border border-white/10 bg-white/[0.04] p-3 flex items-center justify-between gap-3 overflow-hidden">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative w-14 h-10 rounded-lg overflow-hidden shrink-0 border border-white/10 bg-black/40">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={formData.ticketBgUrl}
                              alt="Ticket background artwork"
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-white truncate">
                              Custom Artwork Applied
                            </p>
                            <p className="text-[11px] text-white/60">
                              Shown in the ticket artwork zone behind details
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => ticketBgInputRef.current?.click()}
                            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white border border-white/10 transition-colors cursor-pointer flex items-center gap-1.5"
                          >
                            <Upload className="w-3 h-3 text-[#FE760B]" />
                            Change
                          </button>
                          <button
                            type="button"
                            onClick={removeTicketBgImage}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors cursor-pointer"
                            title="Remove background image"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => ticketBgInputRef.current?.click()}
                        className="group border border-dashed border-white/15 hover:border-[#FE760B]/60 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1.5"
                      >
                        <div className="w-9 h-9 rounded-full bg-white/[0.06] group-hover:bg-[#FE760B]/10 flex items-center justify-center transition-colors">
                          <Upload className="w-4 h-4 text-white/60 group-hover:text-[#FE760B] transition-colors" />
                        </div>
                        <div className="text-xs font-semibold text-white">
                          Click to upload custom ticket background image
                        </div>
                        <div className="text-[11px] text-white/60">
                          PNG, JPG, or WebP up to 5MB (overlays on the green/theme card)
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── Live Ticket Preview Area ── */}
                  <div className="mt-5 rounded-2xl bg-black/30 border border-white/10 p-4 sm:p-5 space-y-4 shadow-xl relative">
                    <div className="flex items-center justify-between flex-wrap gap-2.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#3DD68C] animate-pulse" />
                        <span className="text-xs font-bold text-white tracking-wide uppercase">
                          Live Attendee Ticket Preview
                        </span>
                      </div>

                      {/* Preview format switcher tabs (Both views, Stub, Deck) */}
                      <div className="flex items-center rounded-xl bg-white/[0.06] p-1 border border-white/10">
                        <button
                          type="button"
                          onClick={() => setPreviewTab("both")}
                          className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                            previewTab === "both"
                              ? "bg-[#FE760B] text-[#131517] shadow-sm font-bold"
                              : "text-white/60 hover:text-white"
                          }`}
                        >
                          Both Views
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewTab("stub");
                            setFormData((prev) => ({ ...prev, ticketDesign: "stub" }));
                          }}
                          className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                            previewTab === "stub"
                              ? "bg-[#FE760B] text-[#131517] shadow-sm font-bold"
                              : "text-white/60 hover:text-white"
                          }`}
                        >
                          Stub (780×240)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewTab("deck");
                            setFormData((prev) => ({ ...prev, ticketDesign: "deck" }));
                          }}
                          className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                            previewTab === "deck"
                              ? "bg-[#FE760B] text-[#131517] shadow-sm font-bold"
                              : "text-white/60 hover:text-white"
                          }`}
                        >
                          Deck View
                        </button>
                      </div>
                    </div>

                    {/* Ticket Render Container - Clicking preview opens full length ticket */}
                    <div className="pt-2 pb-1 space-y-4">
                      {/* Render Stub Ticket if in "both" or "stub" mode */}
                      {(previewTab === "both" || previewTab === "stub") && (
                        <div className="space-y-1.5">
                          {previewTab === "both" && (
                            <div className="flex items-center justify-between text-xs px-1 text-white/60">
                              <span className="font-semibold text-white">Stub Layout (780×240)</span>
                              <span className="text-[11px] text-[#FE760B]">Click ticket to view full length</span>
                            </div>
                          )}
                          <div
                            onClick={() => {
                              setModalPreviewDesign("stub");
                              setShowFullTicketModal(true);
                            }}
                            className="pt-1 pb-1 overflow-hidden flex justify-center cursor-pointer transition-transform hover:scale-[1.005] w-full max-w-full"
                            title="Click to view full length ticket"
                          >
                            <div className="w-full max-w-[780px]">
                              <StubTicket
                                event={{
                                  name: formData.name || "Event Name",
                                  title: formData.name || "Event Name",
                                  date: formData.startDate || "2026-11-07",
                                  time: formData.startTime || "12:00 PM",
                                  location: formData.location || "Main Auditorium, Campus",
                                  theme: formData.theme,
                                  themeColor: selectedTheme.color,
                                  themeHex: selectedTheme.color,
                                  ticketBgColor: formData.ticketBgColor || selectedTheme.color,
                                  price: formData.isPaid ? formData.price : "Free",
                                  ticketDesign: "stub",
                                  ticketBgUrl: formData.ticketBgUrl || "",
                                  posterLine1: formData.posterTextMode === "custom" ? formData.posterLine1 : "",
                                  posterLine2: formData.posterTextMode === "custom" ? formData.posterLine2 : "",
                                  posterTextMode: formData.posterTextMode,
                                  posterTextColor: formData.posterTextColor,
                                  ticketTextColor: formData.posterTextColor,
                                  posterFontSize: formData.posterFontSize,
                                  posterAlign: formData.posterAlign,
                                  posterTextY: formData.posterTextY,
                                  posterTextBg: formData.posterTextBg,
                                  showPosterText: formData.showPosterText,
                                }}
                                registration={{
                                  ticketId: "TKT-1793-DEMO-STUB",
                                  attendeeName: "Rahul Sharma (Attendee)",
                                  status: "Valid Pass",
                                  ticketTier: formData.isPaid ? "VIP PASS" : "GENERAL PASS",
                                }}
                                interactive={true}
                                showActions={true}
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Render Deck View Pass if in "both" or "deck" mode matching Image 4 */}
                      {(previewTab === "both" || previewTab === "deck") && (
                        <div className={`space-y-2.5 ${previewTab === "both" ? "mt-6 pt-5 border-t border-white/10" : ""}`}>
                          <div className="flex items-center justify-between text-xs px-1 text-white/60">
                            <span className="font-semibold text-white flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-[#FE760B]" />
                              <span>Deck View (Interactive Collectible Passes)</span>
                            </span>
                            <span className="text-[11px] text-[#FE760B]">Tap cards to bring forward • Click to inspect</span>
                          </div>

                          <div className="w-full flex justify-center items-center py-4 px-2 overflow-hidden bg-black/40 rounded-2xl border border-white/10 shadow-inner">
                            <TicketDeckView
                              initialTickets={studioDeckTickets}
                              showStackOnly={true}
                              compact={true}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Submit Action Button (Themed button with dynamic high-contrast text) */}
            <div className="pt-4 space-y-3">
              <button
                type="submit"
                disabled={isSubmitting || isEventCancelled}
                style={
                  isEventCancelled
                    ? { backgroundColor: "#212327", color: "#9B9EA4" }
                    : {
                        backgroundColor: selectedTheme.color,
                        color: isLightColor(selectedTheme.color) ? "#131517" : "#FFFFFF",
                      }
                }
                className={`w-full font-bold text-sm sm:text-base py-3.5 px-6 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 ${
                  isEventCancelled
                    ? "cursor-not-allowed border border-[#2A2D31]"
                    : "cursor-pointer disabled:opacity-50 hover:opacity-90 active:scale-[0.99]"
                } ${
                  !isEventCancelled && isLightColor(selectedTheme.color) ? "border border-black/15 shadow-md" : ""
                }`}
              >
                {isEventCancelled ? (
                  <span>Event Cancelled (View-Only Mode)</span>
                ) : isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin text-white" />
                    <span>Saving event...</span>
                  </>
                ) : (
                  <span>
                    {editingEvent ? "Update Event" : "Create Event"}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (onClose) onClose();
                  else router.push("/admin/dashboard");
                }}
                className="w-full text-center text-xs text-white/60 hover:text-white transition-colors cursor-pointer py-1"
              >
                Cancel and return to events
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* ── Live Event Page Preview Modal (Simulates Published Attendee Experience) ── */}
      {showEventPagePreviewModal && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-2 sm:p-4 lg:p-6 animate-in fade-in duration-150"
          onClick={() => setShowEventPagePreviewModal(false)}
        >
          <div
            className="w-full max-w-5xl bg-[#181A1D] border border-[#26292E] rounded-3xl shadow-2xl flex flex-col h-[94vh] overflow-hidden text-white relative animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Control Bar */}
            <div className="px-5 py-3.5 border-b border-[#26292E] bg-[#141619] flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#3DD68C] animate-pulse" />
                  <span className="text-xs font-bold uppercase tracking-wider text-white">
                    Live Attendee View Preview
                  </span>
                </div>
                <span className="text-[11px] px-2.5 py-0.5 rounded-md bg-white/[0.06] text-white/60 font-mono hidden sm:inline-block">
                  /e/{formData.name ? formData.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") : "preview-event"}
                </span>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                {/* Device Switcher */}
                <div className="flex items-center rounded-xl bg-black/40 p-1 border border-white/10">
                  <button
                    type="button"
                    onClick={() => setPreviewDevice("desktop")}
                    className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      previewDevice === "desktop"
                        ? "bg-[#FE760B] text-[#131517] shadow-sm"
                        : "text-white/60 hover:text-white"
                    }`}
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Desktop</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewDevice("mobile")}
                    className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      previewDevice === "mobile"
                        ? "bg-[#FE760B] text-[#131517] shadow-sm"
                        : "text-white/60 hover:text-white"
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Mobile (390px)</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowEventPagePreviewModal(false)}
                  className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                  title="Close Preview"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Scrollable Viewport */}
            <div className="flex-1 overflow-y-auto bg-[#0D0F11] p-3 sm:p-6 lg:p-8 flex justify-center custom-scrollbar">
              <div
                className={`w-full transition-all duration-300 ${
                  previewDevice === "mobile"
                    ? "max-w-[400px] bg-[#141619] rounded-3xl border-4 border-[#2A2D31] p-4 sm:p-5 shadow-2xl my-2 space-y-5"
                    : "max-w-4xl space-y-6"
                }`}
              >
                {/* Simulated Public Navigation Header */}
                <div className="flex items-center justify-between py-2 border-b border-white/10 text-xs">
                  <div className="flex items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/logo/ticketlelo-logo-nav.png"
                      alt="TicketLelo"
                      className="h-5 w-auto object-contain"
                    />
                    <span className="text-[10px] text-white/50">• Public Event Page</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-white/60">Events</span>
                    <span className="text-[#FE760B] font-semibold">Discover</span>
                  </div>
                </div>

                {/* Hero Banner Section */}
                <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden border border-[#2A2D31] shadow-2xl aspect-[16/9] w-full bg-[#181A1D]">
                  {formData.coverImage ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={formData.coverImage}
                      alt="Event Cover"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div
                      className="w-full h-full relative flex flex-col justify-between p-6 sm:p-8 overflow-hidden"
                      style={{ backgroundColor: selectedTheme.bg }}
                    >
                      <div
                        className="absolute -top-12 -right-12 w-48 h-48 sm:w-64 sm:h-64 rounded-full pointer-events-none"
                        style={{ backgroundColor: selectedTheme.sun }}
                      />
                      <div
                        className="absolute inset-0 opacity-20 pointer-events-none"
                        style={{
                          backgroundImage:
                            "linear-gradient(#000 1.5px, transparent 1.5px), linear-gradient(90deg, #000 1.5px, transparent 1.5px)",
                          backgroundSize: "20px 20px",
                        }}
                      />
                      <div className="relative z-10">
                        <span className="px-3 py-1 rounded-full bg-black/40 text-white text-xs font-bold uppercase tracking-wider backdrop-blur-sm border border-white/10">
                          Upcoming Event
                        </span>
                      </div>
                      <div className="relative z-10 space-y-1">
                        <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white uppercase tracking-tight">
                          {formData.name || "Event Name"}
                        </h1>
                        {formData.posterLine3 && (
                          <p className="text-xs sm:text-sm text-white/80 font-medium">
                            {formData.posterLine3}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Event Core Details Bar */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-4 rounded-2xl bg-[#1A1C1F] border border-[#26292E] flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#FE760B]/15 border border-[#FE760B]/30 flex items-center justify-center text-[#FE760B] shrink-0">
                      <Calendar className="w-5 h-5 text-[#FE760B]" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] text-[#9B9EA4] uppercase tracking-wider font-semibold block">Date &amp; Time</span>
                      <p className="text-xs sm:text-sm font-bold text-white truncate">
                        {formatDisplayDate(formData.startDate)}
                      </p>
                      <p className="text-[11px] text-white/60">
                        {formData.startTime} - {formData.endTime}
                      </p>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#1A1C1F] border border-[#26292E] flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#FE760B]/15 border border-[#FE760B]/30 flex items-center justify-center text-[#FE760B] shrink-0">
                      <MapPin className="w-5 h-5 text-[#FE760B]" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] text-[#9B9EA4] uppercase tracking-wider font-semibold block">Location</span>
                      <p className="text-xs sm:text-sm font-bold text-white truncate">
                        {formData.locationVenue || formData.location || "Venue TBA"}
                      </p>
                      <p className="text-[11px] text-white/60 truncate">
                        {formData.locationAddress || (formData.locationType === "virtual" ? "Online Stream / Meet" : "Campus Location")}
                      </p>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#1A1C1F] border border-[#26292E] flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#FE760B]/15 border border-[#FE760B]/30 flex items-center justify-center text-[#FE760B] shrink-0">
                      <Ticket className="w-5 h-5 text-[#FE760B]" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] text-[#9B9EA4] uppercase tracking-wider font-semibold block">Admission</span>
                      <p className="text-xs sm:text-sm font-bold text-white truncate">
                        {formData.isPaid ? `₹${formData.price || 0}` : "Free Entry"}
                      </p>
                      <p className="text-[11px] text-white/60">
                        {formData.limitCapacity ? `Limited to ${formData.capacity} guests` : "Open Registration"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 2-Column Main Content & Registration Simulation */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                  {/* Left Column: Description & Venue Map */}
                  <div className="lg:col-span-7 space-y-5">
                    {/* Description Card */}
                    <div className="p-5 sm:p-6 rounded-3xl bg-[#1A1C1F] border border-[#26292E] space-y-3">
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <span>About This Event</span>
                      </h3>
                      <p className="text-xs sm:text-sm text-white/80 leading-relaxed whitespace-pre-wrap">
                        {safeDescription || "The organizer has not published a detailed description yet. Join the event to connect with students and campus attendees!"}
                      </p>
                    </div>

                    {/* Venue & Map preview */}
                    {formData.locationType === "in-person" && (
                      <div className="p-5 sm:p-6 rounded-3xl bg-[#1A1C1F] border border-[#26292E] space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-[#FE760B]" />
                            <span>Venue &amp; Campus Map</span>
                          </h3>
                          <span className="text-[10px] text-[#3DD68C] font-mono">Live Navigation Verified</span>
                        </div>
                        <div className="relative h-48 w-full rounded-2xl overflow-hidden border border-[#2A2D31] bg-[#121417]">
                          <iframe
                            title="Interactive Venue Map Preview"
                            width="100%"
                            height="100%"
                            style={{ border: 0 }}
                            loading="lazy"
                            src={`https://maps.google.com/maps?q=${encodeURIComponent(
                              (formData.locationVenue || formData.location || "New Delhi") + (formData.locationAddress ? `, ${formData.locationAddress}` : "")
                            )}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                            className="w-full h-full filter saturate-[0.9] contrast-[1.05]"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Registration Card Simulation */}
                  <div className="lg:col-span-5 space-y-4">
                    <div className="p-5 sm:p-6 rounded-3xl bg-[#1A1C1F] border border-[#26292E] space-y-4 shadow-xl">
                      <div className="flex items-center justify-between pb-3 border-b border-white/10">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-[#9B9EA4] tracking-wider block">Pass Type</span>
                          <span className="text-base font-black text-white">
                            {formData.isPaid ? "VIP / General Ticket" : "Free Event Pass"}
                          </span>
                        </div>
                        <span className="text-xl font-black text-[#FE760B]">
                          {formData.isPaid ? `₹${formData.price || 0}` : "FREE"}
                        </span>
                      </div>

                      <div className="space-y-2.5">
                        <span className="text-xs font-semibold text-white/90 block">Attendee Registration Preview</span>
                        <div className="space-y-2">
                          <input
                            type="text"
                            disabled
                            placeholder="Full Name (e.g. Rahul Sharma)"
                            className="w-full px-3 py-2 rounded-xl bg-[#121417] border border-[#2A2D31] text-xs text-white/60"
                          />
                          <input
                            type="email"
                            disabled
                            placeholder="Student College Email ID"
                            className="w-full px-3 py-2 rounded-xl bg-[#121417] border border-[#2A2D31] text-xs text-white/60"
                          />
                          <input
                            type="tel"
                            disabled
                            placeholder="Phone Number for Ticket QR"
                            className="w-full px-3 py-2 rounded-xl bg-[#121417] border border-[#2A2D31] text-xs text-white/60"
                          />
                        </div>

                        <button
                          type="button"
                          disabled
                          className="w-full py-3.5 rounded-2xl bg-[#FE760B] text-[#131517] font-black text-sm tracking-wide shadow-lg opacity-90 cursor-not-allowed flex items-center justify-center gap-2 mt-2"
                        >
                          <Ticket className="w-4 h-4" />
                          <span>{formData.isPaid ? "Proceed to Checkout" : "Claim Free Ticket"}</span>
                        </button>

                        <p className="text-[10px] text-center text-[#9B9EA4]">
                          Preview Mode — Real attendees will receive their e-ticket instantly via email &amp; dashboard.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Location Modal */}
      {showLocationModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-[#181A1D] border border-[#26292E] rounded-3xl p-6 sm:p-7 max-w-lg w-full space-y-5 shadow-2xl relative animate-in zoom-in-95 duration-150 text-white max-h-[90vh] overflow-y-auto">
            {/* Top Close 'X' Button */}
            <button
              type="button"
              onClick={() => setShowLocationModal(false)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-[#9B9EA4] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Close modal"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header: Icon + Title & Description */}
            <div className="flex items-center gap-3 pr-8">
              <div className="w-10 h-10 rounded-2xl bg-[#FE760B]/15 border border-[#FE760B]/30 flex items-center justify-center text-[#FE760B] shrink-0 font-bold">
                <MapPin className="w-5 h-5 text-[#FE760B]" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Event Location
                </h3>
                <p className="text-xs text-[#9B9EA4] mt-0.5">
                  Select an in-person venue or virtual meeting link
                </p>
              </div>
            </div>

            {/* Toggle Mode: In Person vs Virtual */}
            <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-[#141619] border border-[#2A2D31]">
              <button
                type="button"
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    locationType: "in-person",
                  }))
                }
                className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  formData.locationType === "in-person"
                    ? "bg-[#FE760B] text-[#131517] shadow-sm"
                    : "text-[#9B9EA4] hover:text-white"
                }`}
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>In Person</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    locationType: "virtual",
                  }))
                }
                className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  formData.locationType === "virtual"
                    ? "bg-[#FE760B] text-[#131517] shadow-sm"
                    : "text-[#9B9EA4] hover:text-white"
                }`}
              >
                <Video className="w-3.5 h-3.5" />
                <span>Virtual / Online</span>
              </button>
            </div>

            {formData.locationType === "in-person" ? (
              <div className="space-y-4">
                {!selectedLocationVenue ? (
                  /* STEP A: Searching with Real-Time Suggestions */
                  <div className="space-y-3">
                    <label className="text-xs text-[#9B9EA4] font-medium flex items-center justify-between">
                      <span>Venue Name or Address</span>
                      <span className="text-[10px] text-[#9B9EA4]">Search venue, campus, hall, or address</span>
                    </label>

                    <div className="relative">
                      <input
                        type="text"
                        value={locationInput}
                        onChange={(e) => handleLocationInputChange(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (locationSuggestions.length > 0) {
                              handleSelectLocationItem(locationSuggestions[0]);
                            }
                          }
                        }}
                        placeholder="Search location or venue..."
                        className="w-full h-11 px-3.5 pr-9 rounded-xl bg-[#212327] text-white placeholder:text-[#9B9EA4] border border-[#2A2D31] outline-none focus:border-[#FE760B] text-sm font-medium transition-colors"
                        autoFocus
                      />
                      {isSearchingLocation ? (
                        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center">
                          <Loader2 className="w-4 h-4 animate-spin text-[#FE760B]" />
                        </div>
                      ) : locationInput ? (
                        <button
                          type="button"
                          onClick={() => {
                            setLocationInput("");
                            setLocationSuggestions([]);
                          }}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9B9EA4] hover:text-white"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      ) : null}
                    </div>

                    {/* Suggestions Box: Displayed when user types 2+ characters */}
                    {locationInput.trim().length >= 2 && (
                      <div className="rounded-xl bg-[#17191C] border border-[#2A2D31] shadow-2xl overflow-hidden divide-y divide-[#2A2D31]/60 max-h-64 overflow-y-auto">
                        {isSearchingLocation && locationSuggestions.length === 0 ? (
                          <div className="p-4 text-center text-xs text-[#9B9EA4] flex items-center justify-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin text-[#FE760B]" />
                            <span>Searching venues and locations...</span>
                          </div>
                        ) : locationSuggestions.length > 0 ? (
                          locationSuggestions.map((item, idx) => (
                            <div
                              key={item.id || idx}
                              onClick={() => handleSelectLocationItem(item)}
                              className="p-3 flex items-start gap-2.5 hover:bg-[#212327] cursor-pointer transition-colors text-left group"
                            >
                              <div className="p-1.5 rounded-lg bg-[#FE760B]/10 text-[#FE760B] group-hover:bg-[#FE760B] group-hover:text-[#131517] transition-colors mt-0.5 shrink-0">
                                <MapPin className="w-4 h-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs sm:text-sm font-bold text-white leading-snug group-hover:text-[#FE760B] transition-colors truncate">
                                  {item.name}
                                </p>
                                <p className="text-[11px] text-[#9B9EA4] line-clamp-2 mt-0.5">
                                  {item.address}
                                </p>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div
                            onClick={() =>
                              handleSelectLocationItem({
                                name: locationInput.trim(),
                                address: "Custom venue entered by organiser",
                                lat: null,
                                lng: null,
                                isCustom: true,
                              })
                            }
                            className="p-3.5 text-xs text-[#9B9EA4] hover:bg-[#212327] hover:text-white cursor-pointer flex items-center gap-2 font-semibold transition-colors"
                          >
                            <MapPin className="w-4 h-4 text-[#FE760B]" />
                            <span>Use &quot;{locationInput.trim()}&quot; as custom venue</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  /* STEP B: Location Preview & Real Interactive Map */
                  <div className="space-y-3.5 animate-fade-in">
                    {/* Selected Venue Header & Change button */}
                    <div className="p-3.5 rounded-xl bg-[#212327] border border-[#2A2D31] flex items-start justify-between gap-3 shadow-sm">
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#3DD68C] flex items-center gap-1">
                          <Check className="w-3 h-3" /> Selected Venue
                        </span>
                        <h4 className="text-sm sm:text-base font-bold text-white truncate mt-0.5">
                          {selectedLocationVenue.name}
                        </h4>
                        <p className="text-xs text-[#9B9EA4] line-clamp-2 mt-0.5">
                          {selectedLocationVenue.address}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedLocationVenue(null)}
                        className="text-xs text-[#FE760B] hover:underline font-semibold shrink-0 pt-0.5 cursor-pointer"
                      >
                        Change
                      </button>
                    </div>

                    {/* Real Live Map View */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-white font-semibold flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-[#FE760B]" />
                          <span>Interactive Venue Map View</span>
                        </span>
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                            selectedLocationVenue.lat && selectedLocationVenue.lng
                              ? `${selectedLocationVenue.lat},${selectedLocationVenue.lng}`
                              : selectedLocationVenue.name + ", " + selectedLocationVenue.address
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-[#FE760B] hover:underline flex items-center gap-1"
                        >
                          <span>Open in Google Maps</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>

                      {/* Real Interactive Map Embed Container */}
                      <div className="relative h-56 sm:h-64 w-full rounded-xl overflow-hidden border border-[#2A2D31] bg-[#17191C] shadow-inner">
                        <iframe
                          title="Interactive Venue Map View"
                          width="100%"
                          height="100%"
                          style={{ border: 0 }}
                          loading="lazy"
                          allowFullScreen
                          referrerPolicy="no-referrer-when-downgrade"
                          src={
                            `https://maps.google.com/maps?q=${encodeURIComponent(
                              selectedLocationVenue.lat && selectedLocationVenue.lng
                                ? `${selectedLocationVenue.lat},${selectedLocationVenue.lng}`
                                : (selectedLocationVenue.name || "") +
                                  (selectedLocationVenue.address && !selectedLocationVenue.address.includes("Custom venue")
                                    ? `, ${selectedLocationVenue.address}`
                                    : "")
                            )}&t=&z=15&ie=UTF8&iwloc=&output=embed`
                          }
                          className="w-full h-full filter saturate-[0.9] contrast-[1.05]"
                        />

                        {/* Venue Floating Badge */}
                        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none z-10 text-[11px] text-white bg-black/80 px-2.5 py-1.5 rounded-lg backdrop-blur-sm border border-white/10 shadow-md">
                          <span className="truncate max-w-[220px] flex items-center gap-1.5 font-medium">
                            <MapPin className="w-3 h-3 text-[#FE760B] shrink-0" />
                            <span className="truncate">{selectedLocationVenue.name}</span>
                          </span>
                          <span className="text-[#3DD68C] text-[10px] font-semibold flex items-center gap-1.5 shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#3DD68C] animate-pulse" />
                            <span>Real-Time Location Mapped</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Specific Gate or Spot Note */}
                    <div className="space-y-1">
                      <label className="text-[11px] text-[#9B9EA4] font-medium">
                        Spot / Gate / Block Note (Optional)
                      </label>
                      <input
                        type="text"
                        value={pinLandmark}
                        onChange={(e) => setPinLandmark(e.target.value)}
                        placeholder="Add landmark, gate, or hall note (optional)"
                        className="w-full h-10 px-3 rounded-xl bg-[#212327] border border-[#2A2D31] text-xs text-white placeholder:text-[#9B9EA4] outline-none focus:border-[#FE760B]"
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-xs text-[#9B9EA4] font-medium">
                  Virtual Meeting / Stream Link
                </label>
                <input
                  type="url"
                  value={formData.virtualLink}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData((prev) => ({
                      ...prev,
                      virtualLink: val,
                    }));
                    setLocationInput(val || "Virtual Event");
                  }}
                  placeholder="https://zoom.us/j/... or Google Meet / YouTube Live"
                  className="w-full h-11 px-3.5 rounded-xl bg-[#212327] border border-[#2A2D31] text-sm text-white placeholder:text-[#9B9EA4] outline-none focus:border-[#2B59FF]"
                />
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleLocationSave}
                className="flex-1 py-3.5 rounded-2xl bg-[#FE760B] hover:bg-[#ff8624] text-[#131517] font-extrabold text-xs transition-all shadow-lg cursor-pointer flex items-center justify-center gap-2 hover:scale-[1.005] active:scale-[0.99]"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Save Location</span>
              </button>
              <button
                type="button"
                onClick={() => setShowLocationModal(false)}
                className="px-5 py-3.5 rounded-2xl bg-[#212327] hover:bg-[#2A2D31] text-[#9B9EA4] hover:text-white text-xs font-semibold border border-[#2A2D31] transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Event Description Modal (Crisp, clean & modern matching Image 4) */}
      {showDescriptionModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          onClick={() => setShowDescriptionModal(false)}
        >
          <div
            className="w-full max-w-xl bg-[#181A1D] border border-[#26292E] rounded-3xl shadow-2xl relative p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Close 'X' Button */}
            <button
              type="button"
              onClick={() => setShowDescriptionModal(false)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Close modal"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header: Icon + Title & Description */}
            <div className="flex items-center gap-3 pr-8">
              <div className="w-10 h-10 rounded-2xl bg-[#22252A] border border-white/5 flex items-center justify-center text-[#FE760B] shrink-0">
                <Edit3 className="w-5 h-5 text-[#FE760B]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white leading-tight">
                  Event Description
                </h3>
                <p className="text-xs text-[#9B9EA4] leading-relaxed mt-0.5">
                  Provide clear details about what attendees should expect
                </p>
              </div>
            </div>

            {/* Content: Single crisp unified container without double-borders */}
            <div className="rounded-2xl bg-[#121417] border border-[#26292E] focus-within:border-[#FE760B] transition-colors p-4 space-y-3">
              <textarea
                value={safeDescription}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Who should come? What's the event about? Include schedule, guidelines, and what to bring..."
                rows={7}
                className="w-full bg-transparent text-xs sm:text-sm text-white placeholder:text-[#64748B] border-0 outline-none ring-0 focus:outline-none focus:ring-0 resize-none leading-relaxed font-normal"
              />
              <div className="flex items-center justify-between text-[11px] text-[#9B9EA4] pt-2 border-t border-white/5 font-medium">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#3DD68C]" />
                  Markdown &amp; line breaks supported
                </span>
                <span className="font-mono text-xs text-[#9B9EA4]">{safeDescription.length} characters</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDescriptionModal(false)}
                className="flex-1 py-3.5 rounded-2xl bg-[#FE760B] hover:bg-[#ff8624] text-[#131517] font-extrabold text-sm transition-all shadow-lg cursor-pointer flex items-center justify-center gap-2 hover:scale-[1.005] active:scale-[0.99]"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Save Description</span>
              </button>
              <button
                type="button"
                onClick={() => setShowDescriptionModal(false)}
                className="px-5 py-3.5 rounded-2xl bg-[#212327] hover:bg-[#2A2D31] text-[#9B9EA4] hover:text-white text-xs font-semibold border border-[#2A2D31] transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Length Ticket Pass Preview Modal */}
      <TicketFullPreviewModal
        isOpen={showFullTicketModal}
        onClose={() => setShowFullTicketModal(false)}
        event={{
          name: formData.name || "Event Name",
          title: formData.name || "Event Name",
          date: formData.startDate || "2026-11-07",
          time: formData.startTime || "12:00 PM",
          location: formData.location || "Main Auditorium, Campus",
          theme: formData.theme,
          themeColor: selectedTheme.color,
          themeHex: selectedTheme.color,
          ticketBgColor: formData.ticketBgColor || selectedTheme.color,
          price: formData.isPaid ? formData.price : "Free",
          ticketDesign: modalPreviewDesign,
          ticketBgUrl: formData.ticketBgUrl || "",
          posterLine1: formData.posterTextMode === "custom" ? formData.posterLine1 : "",
          posterLine2: formData.posterTextMode === "custom" ? formData.posterLine2 : "",
          posterTextMode: formData.posterTextMode,
          posterTextColor: formData.posterTextColor,
          ticketTextColor: formData.posterTextColor,
          posterFontSize: formData.posterFontSize,
          posterAlign: formData.posterAlign,
          posterTextY: formData.posterTextY,
          posterTextBg: formData.posterTextBg,
          showPosterText: formData.showPosterText,
        }}
        ticket={{
          ticketId: modalPreviewDesign === "wide" ? "TKT-1793-DEMO-WIDE" : "TKT-1793-DEMO-STUB",
          attendeeName: "Rahul Sharma (Attendee)",
          status: "Valid Pass",
          ticketTier: formData.isPaid ? "VIP PASS" : "GENERAL PASS",
        }}
        design={modalPreviewDesign}
      />

      {/* Max Capacity Dialog */}
      {showCapacityModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150"
          onClick={() => setShowCapacityModal(false)}
        >
          <div
            className="w-full max-w-[420px] bg-[#181A1D] border border-[#26292E] rounded-3xl shadow-2xl p-6 sm:p-7 relative space-y-5 animate-in fade-in zoom-in-95 duration-150 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Close 'X' Button */}
            <button
              type="button"
              onClick={() => setShowCapacityModal(false)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-[#9B9EA4] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Close modal"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header: Icon + Title & Description */}
            <div className="flex items-center gap-3 pr-8">
              <div className="w-10 h-10 rounded-2xl bg-[#FE760B]/15 border border-[#FE760B]/30 flex items-center justify-center text-[#FE760B] shrink-0 font-bold">
                <Users className="w-5 h-5 text-[#FE760B]" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Max Capacity
                </h3>
                <p className="text-xs text-[#9B9EA4] mt-0.5">
                  Cap registrations once capacity limit is reached
                </p>
              </div>
            </div>

            {/* Limit Event Capacity Toggle */}
            <div className="p-3.5 rounded-2xl bg-[#212327]/80 border border-[#2A2D31] flex items-center justify-between">
              <div>
                <span className="text-xs sm:text-sm font-semibold text-white block">
                  Limit Event Capacity
                </span>
                <span className="text-[11px] text-[#9B9EA4]">
                  Stop issuing tickets when full
                </span>
              </div>
              <button
                type="button"
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    limitCapacity: !prev.limitCapacity,
                  }))
                }
                className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
                  formData.limitCapacity ? "bg-[#FE760B]" : "bg-[#2A2D31]"
                }`}
                style={formData.limitCapacity ? { backgroundColor: selectedTheme.color } : {}}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                    formData.limitCapacity ? "translate-x-5" : ""
                  }`}
                />
              </button>
            </div>

            {/* Max Capacity input (visible if limitCapacity is true) */}
            {formData.limitCapacity && (
              <div className="p-3.5 rounded-2xl bg-[#212327]/80 border border-[#2A2D31] flex items-center justify-between animate-in fade-in duration-100">
                <span className="text-xs sm:text-sm font-semibold text-white">
                  Max Seats / Attendees
                </span>
                <input
                  type="number"
                  min="1"
                  value={formData.maxCapacity}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      maxCapacity: e.target.value,
                      capacity: e.target.value,
                    }))
                  }
                  className="w-24 px-3 py-1.5 rounded-xl border border-[#2A2D31] bg-[#181A1D] text-white text-center font-bold text-sm outline-none focus:border-[#FE760B]"
                />
              </div>
            )}

            {/* Over-Capacity Waitlist Toggle */}
            <div className="p-3.5 rounded-2xl bg-[#212327]/80 border border-[#2A2D31] flex items-center justify-between">
              <div>
                <span className="text-xs sm:text-sm font-semibold text-white block">
                  Over-Capacity Waitlist
                </span>
                <span className="text-[11px] text-[#9B9EA4]">
                  Queue attendees if sold out
                </span>
              </div>
              <button
                type="button"
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    waitlist: !prev.waitlist,
                  }))
                }
                className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
                  formData.waitlist ? "bg-[#FE760B]" : "bg-[#2A2D31]"
                }`}
                style={formData.waitlist ? { backgroundColor: selectedTheme.color } : {}}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                    formData.waitlist ? "translate-x-5" : ""
                  }`}
                />
              </button>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCapacityModal(false)}
                className="flex-1 py-3.5 rounded-2xl bg-[#FE760B] hover:bg-[#ff8624] text-[#131517] font-extrabold text-sm transition-all shadow-lg cursor-pointer flex items-center justify-center gap-2 hover:scale-[1.005] active:scale-[0.99]"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Save Capacity</span>
              </button>
              <button
                type="button"
                onClick={() => setShowCapacityModal(false)}
                className="px-5 py-3.5 rounded-2xl bg-[#212327] hover:bg-[#2A2D31] text-[#9B9EA4] hover:text-white text-xs font-semibold border border-[#2A2D31] transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Banner Text & Typography Adjustment Modal (Spacious, Organized & Consistent) ── */}
      {showTypographyModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150"
          onClick={() => setShowTypographyModal(false)}
        >
          <div
            className="w-full max-w-xl bg-[#181A1D] border border-[#26292E] rounded-3xl shadow-2xl p-6 sm:p-7 relative space-y-4 animate-in fade-in zoom-in-95 duration-150 text-white max-h-[92vh] overflow-y-auto custom-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Close 'X' Button */}
            <button
              type="button"
              onClick={() => setShowTypographyModal(false)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-[#9B9EA4] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Close modal"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header: Icon & Title */}
            <div className="flex items-center gap-3 pr-8">
              <div className="w-10 h-10 rounded-2xl bg-[#FE760B]/15 border border-[#FE760B]/30 flex items-center justify-center text-[#FE760B] shrink-0 font-bold">
                <Type className="w-5 h-5 text-[#FE760B]" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Banner Typography
                </h3>
                <p className="text-xs text-[#9B9EA4] mt-0.5">
                  Configure headline overlay, placement, font styling, and colors
                </p>
              </div>
            </div>

            {/* 1. Visibility & Mode Selector Card */}
            <div className="p-3.5 rounded-2xl bg-[#212327]/80 border border-[#2A2D31] space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-semibold text-white block">Banner Text Overlay</span>
                  <span className="text-[11px] text-[#9B9EA4]">Show or hide title text on the cover</span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      showPosterText: prev.showPosterText === false ? true : false,
                    }))
                  }
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    formData.showPosterText !== false
                      ? "bg-[#FE760B] text-[#131517] border-[#FE760B] shadow-sm"
                      : "bg-[#181A1D] border-[#2A2D31] text-[#9B9EA4] hover:text-white"
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>{formData.showPosterText !== false ? "Visible" : "Hidden"}</span>
                </button>
              </div>

              <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-white">Title Generation</span>
                <div className="flex items-center rounded-xl bg-[#141619] p-1 border border-[#2A2D31]">
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, posterTextMode: "auto", showPosterText: true }))}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      formData.posterTextMode === "auto"
                        ? "bg-[#FE760B] text-[#131517] shadow-sm"
                        : "text-[#9B9EA4] hover:text-white"
                    }`}
                  >
                    Auto Title
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const auto = getPosterLines(formData.name || "");
                      setFormData((prev) => ({
                        ...prev,
                        posterTextMode: "custom",
                        posterLine1: prev.posterLine1 || auto.line1 || prev.name || "",
                        posterLine2: prev.posterLine2 || auto.line2 || "",
                        showPosterText: true,
                      }));
                    }}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      formData.posterTextMode === "custom"
                        ? "bg-[#FE760B] text-[#131517] shadow-sm"
                        : "text-[#9B9EA4] hover:text-white"
                    }`}
                  >
                    Custom Lines
                  </button>
                </div>
              </div>
            </div>

            {/* 2. Text Content Lines Card */}
            {formData.posterTextMode === "auto" ? (
              <div className="p-3.5 rounded-2xl bg-[#212327]/80 border border-[#2A2D31] space-y-2.5">
                <div className="p-2.5 rounded-xl bg-[#181A1D] border border-white/5 text-xs space-y-1">
                  <div className="text-[10px] uppercase font-bold text-[#9B9EA4] tracking-wider">
                    Auto-Parsed from Event Name
                  </div>
                  <div className="text-white font-bold truncate">
                    Line 1: &quot;{posterLines.line1 || formData.name || "Event Title"}&quot;
                  </div>
                  {posterLines.line2 && (
                    <div className="text-white/80 font-semibold truncate">
                      Line 2: &quot;{posterLines.line2}&quot;
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[11px] text-[#9B9EA4] font-medium block mb-1">
                    Line 3 (Badge / Details / Schedule - Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.posterLine3 || ""}
                    placeholder="e.g. Annual Cultural & Tech Fest • Free Entry"
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        posterLine3: e.target.value,
                        showPosterText: true,
                      }))
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#181A1D] border border-[#2A2D31] text-white focus:outline-none focus:border-[#FE760B] text-xs transition-colors"
                  />
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-[#212327]/80 border border-[#2A2D31] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Custom Headline Lines</span>
                  {formData.name && (
                    <button
                      type="button"
                      onClick={() => {
                        const auto = getPosterLines(formData.name || "");
                        setFormData((prev) => ({
                          ...prev,
                          posterLine1: auto.line1 || prev.name || "",
                          posterLine2: auto.line2 || "",
                          showPosterText: true,
                        }));
                        toast.success("Copied from Event Name");
                      }}
                      className="text-[11px] text-[#FE760B] hover:text-[#ff8624] font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Copy Event Name</span>
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  <div>
                    <label className="text-[11px] text-[#9B9EA4] font-medium block mb-1">
                      Line 1 (Headline)
                    </label>
                    <input
                      type="text"
                      value={formData.posterLine1 || ""}
                      placeholder="Enter event headline"
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData((prev) => ({
                          ...prev,
                          posterLine1: val,
                          name: !prev.name || prev.name === prev.posterLine1 ? val : prev.name,
                          showPosterText: true,
                        }));
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-[#181A1D] border border-[#2A2D31] text-white focus:outline-none focus:border-[#FE760B] text-xs font-bold uppercase tracking-tight transition-colors"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-[#9B9EA4] font-medium block mb-1">
                      Line 2 (Subtitle)
                    </label>
                    <input
                      type="text"
                      value={formData.posterLine2 || ""}
                      placeholder="Enter event subtitle"
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          posterLine2: e.target.value,
                          showPosterText: true,
                        }))
                      }
                      className="w-full px-3 py-2 rounded-xl bg-[#181A1D] border border-[#2A2D31] text-white focus:outline-none focus:border-[#FE760B] text-xs font-semibold uppercase tracking-tight transition-colors"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-[#9B9EA4] font-medium block mb-1">
                      Line 3 (Badge / Details)
                    </label>
                    <input
                      type="text"
                      value={formData.posterLine3 || ""}
                      placeholder="Enter schedule and venue highlights"
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          posterLine3: e.target.value,
                          showPosterText: true,
                        }))
                      }
                      className="w-full px-3 py-2 rounded-xl bg-[#181A1D] border border-[#2A2D31] text-white focus:outline-none focus:border-[#FE760B] text-xs transition-colors"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 3. Font Family Selection */}
            <div className="p-3.5 rounded-2xl bg-[#212327]/80 border border-[#2A2D31] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#9B9EA4] font-medium flex items-center gap-1.5">
                  <Type className="w-3.5 h-3.5 text-[#FE760B]" />
                  Font Family
                </span>
                <span className="font-semibold text-white text-xs">
                  {formData.fontFamily || "New Spirit"}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {[
                  { id: "New Spirit", name: "New Spirit", fontClass: "font-serif" },
                  { id: "Inter", name: "Inter", fontClass: "font-sans" },
                  { id: "Outfit", name: "Outfit", fontClass: "font-sans font-bold" },
                  { id: "Roboto", name: "Roboto", fontClass: "font-sans" },
                  { id: "JetBrains Mono", name: "Mono", fontClass: "font-mono" },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, fontFamily: f.id }))}
                    className={`h-9 px-2 text-xs rounded-xl border text-center transition-all cursor-pointer flex items-center justify-center ${
                      (formData.fontFamily || "New Spirit") === f.id
                        ? "bg-[#FE760B] text-[#131517] border-[#FE760B] font-bold shadow-sm"
                        : "bg-[#181A1D] border-[#2A2D31] text-gray-300 hover:text-white hover:bg-[#25282D]"
                    }`}
                  >
                    <span className={f.fontClass}>{f.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Position & Alignment Row (Balanced equal-height cards) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-stretch">
              <div className="p-3.5 rounded-2xl bg-[#212327]/80 border border-[#2A2D31] flex flex-col justify-between space-y-2">
                <span className="text-xs text-[#9B9EA4] font-medium flex items-center gap-1.5">
                  <Move className="w-3.5 h-3.5 text-[#FE760B]" />
                  Position
                </span>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { label: "Top", y: 8 },
                    { label: "Center", y: 42 },
                    { label: "Bottom", y: 68 },
                  ].map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          posterTextX: 6,
                          posterTextY: item.y,
                        }))
                      }
                      className={`h-8 text-xs rounded-xl font-bold border transition-colors cursor-pointer flex items-center justify-center ${
                        formData.posterTextY === item.y
                          ? "bg-[#FE760B] text-[#131517] border-[#FE760B] shadow-sm"
                          : "bg-[#181A1D] border-[#2A2D31] text-white hover:bg-[#25282D]"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    title="Reset position"
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        posterTextX: 6,
                        posterTextY: prev.coverImage ? 55 : 68,
                      }))
                    }
                    className="h-8 rounded-xl border border-[#2A2D31] text-[#9B9EA4] hover:text-white hover:bg-[#181A1D] transition-colors flex items-center justify-center cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#212327]/80 border border-[#2A2D31] flex flex-col justify-between space-y-2">
                <span className="text-xs text-[#9B9EA4] font-medium">Alignment</span>
                <div className="grid grid-cols-3 rounded-xl bg-[#181A1D] p-1 border border-[#2A2D31] gap-1.5">
                  {[
                    { align: "left", label: "Left", icon: AlignLeft },
                    { align: "center", label: "Center", icon: AlignCenter },
                    { align: "right", label: "Right", icon: AlignRight },
                  ].map(({ align, label, icon: Icon }) => (
                    <button
                      key={align}
                      type="button"
                      title={label}
                      onClick={() => setFormData((prev) => ({ ...prev, posterAlign: align }))}
                      className={`h-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                        (formData.posterAlign || "left") === align
                          ? "bg-[#FE760B] text-[#131517] font-bold shadow-sm"
                          : "text-[#9B9EA4] hover:text-white"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 5. Size & Width Row (Balanced equal-height cards) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-stretch">
              {/* Text Box Width */}
              <div className="p-3.5 rounded-2xl bg-[#212327]/80 border border-[#2A2D31] flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#9B9EA4] font-medium flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-[#FE760B]" />
                    Box Width
                  </span>
                  <span className="font-mono text-[#FE760B] text-xs font-bold">
                    {formData.posterTextWidth || 85}%
                  </span>
                </div>
                <input
                  type="range"
                  min="40"
                  max="92"
                  value={formData.posterTextWidth || 85}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      posterTextWidth: parseInt(e.target.value, 10),
                    }))
                  }
                  className="w-full accent-[#FE760B] cursor-pointer"
                />
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { label: "70%", val: 70 },
                    { label: "85%", val: 85 },
                    { label: "92%", val: 92 },
                  ].map((w) => (
                    <button
                      key={w.label}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, posterTextWidth: w.val }))}
                      className={`h-8 text-[11px] rounded-xl font-bold border transition-colors cursor-pointer flex items-center justify-center ${
                        (formData.posterTextWidth || 85) === w.val
                          ? "bg-[#FE760B] text-[#131517] border-[#FE760B] shadow-sm"
                          : "bg-[#181A1D] border-[#2A2D31] text-gray-300 hover:text-white"
                      }`}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Font Size */}
              <div className="p-3.5 rounded-2xl bg-[#212327]/80 border border-[#2A2D31] flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#9B9EA4] font-medium flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-[#FE760B]" />
                    Font Size
                  </span>
                  <span className="font-mono text-[#FE760B] text-xs font-bold">
                    {formData.posterFontSize || 34}px
                  </span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="56"
                  step="2"
                  value={formData.posterFontSize || 34}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      posterFontSize: parseInt(e.target.value, 10),
                    }))
                  }
                  className="w-full accent-[#FE760B] cursor-pointer"
                />
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { label: "S", val: 26 },
                    { label: "M", val: 32 },
                    { label: "L", val: 36 },
                    { label: "XL", val: 42 },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, posterFontSize: preset.val }))}
                      className={`h-8 text-[11px] rounded-xl font-bold border transition-colors cursor-pointer flex items-center justify-center ${
                        formData.posterFontSize === preset.val
                          ? "bg-[#FE760B] text-[#131517] border-[#FE760B] shadow-sm"
                          : "bg-[#181A1D] border-[#2A2D31] text-gray-300 hover:text-white"
                      }`}
                    >
                      {preset.label} ({preset.val})
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 6. Backdrop & Color Row (Balanced equal-height cards) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-stretch">
              {/* Text Backdrop */}
              <div className="p-3.5 rounded-2xl bg-[#212327]/80 border border-[#2A2D31] flex flex-col justify-between space-y-2">
                <span className="text-xs text-[#9B9EA4] font-medium">Backdrop Style</span>
                <div className="grid grid-cols-4 rounded-xl bg-[#181A1D] p-1 border border-[#2A2D31] gap-1">
                  {[
                    { id: "none", label: "Clean" },
                    { id: "shadow", label: "Shadow" },
                    { id: "badge", label: "Glass" },
                    { id: "solid", label: "Solid" },
                  ].map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, posterTextBg: b.id }))}
                      className={`py-1.5 text-[11px] font-bold rounded-lg transition-colors text-center cursor-pointer truncate ${
                        (formData.posterTextBg || "shadow") === b.id
                          ? "bg-[#FE760B] text-[#131517] shadow-sm"
                          : "text-[#9B9EA4] hover:text-white"
                      }`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Text Color */}
              <div className="p-3.5 rounded-2xl bg-[#212327]/80 border border-[#2A2D31] flex flex-col justify-between space-y-2">
                <span className="text-xs text-[#9B9EA4] font-medium flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-[#FE760B]" />
                  Color Preset
                </span>
                <div className="grid grid-cols-6 gap-1">
                  {[
                    { id: "auto", label: "Auto" },
                    { id: "light", label: "White" },
                    { id: "dark", label: "Dark" },
                    { id: "#FDE003", label: "Gold" },
                    { id: "#FE760B", label: "Orange" },
                    { id: "#14B8A6", label: "Teal" },
                  ].map((col) => {
                    const isSel = (formData.posterTextColor || "auto") === col.id;
                    return (
                      <button
                        key={col.id}
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, posterTextColor: col.id }))}
                        className={`py-1.5 text-[10px] font-bold rounded-lg border transition-colors cursor-pointer text-center truncate ${
                          isSel
                            ? "bg-[#FE760B] text-[#131517] border-[#FE760B] shadow-sm"
                            : "bg-[#181A1D] border-[#2A2D31] text-gray-300 hover:text-white"
                        }`}
                      >
                        {col.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 7. Custom Hex Color Option */}
            <div className="flex items-center gap-2 p-3 rounded-2xl bg-[#212327]/80 border border-[#2A2D31]">
              <span className="text-[11px] text-[#9B9EA4] font-medium shrink-0">Custom Hex:</span>
              <div className="flex-1 flex items-center gap-1 bg-[#181A1D] px-2.5 py-1 rounded-xl border border-[#2A2D31] focus-within:border-[#FE760B]">
                <span className="text-xs text-[#FE760B] font-mono font-bold">#</span>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="FFFFFF"
                  value={customTextColorHex ? customTextColorHex.replace(/^#/, "") : ""}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/^#/, "").toUpperCase();
                    setCustomTextColorHex(raw);
                  }}
                  className="w-full bg-transparent text-xs font-mono text-white outline-none font-bold uppercase"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  if (customTextColorHex) {
                    const full = normalizeHex(customTextColorHex);
                    setFormData((prev) => ({ ...prev, posterTextColor: full }));
                    toast.success(`Applied color ${full}`);
                  }
                }}
                className="px-4 py-1.5 bg-[#FE760B] hover:bg-[#ff8624] text-[#131517] text-xs font-extrabold rounded-xl transition-colors cursor-pointer shadow-sm"
              >
                Apply
              </button>
            </div>

            {/* 8. Confirm & Close Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowTypographyModal(false)}
                className="w-full py-3.5 rounded-2xl bg-[#FE760B] hover:bg-[#ff8624] text-[#131517] font-extrabold text-sm transition-all shadow-lg cursor-pointer flex items-center justify-center gap-2 hover:scale-[1.005] active:scale-[0.99]"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Apply &amp; Done</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
