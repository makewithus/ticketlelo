"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Users,
  CheckCircle2,
  Ticket,
  ChevronDown,
  Loader2,
  Calendar,
  IndianRupee,
  Sparkles,
} from "lucide-react";
import { EventControlHeader } from "@/components/admin/event-control-header";
import { BrandLoader } from "@/components/ui/brand-loader";
import { AnalyticsSkeleton } from "@/components/ui/skeleton";
import {
  getCachedOrganiserEvents,
  setCachedOrganiserEvents,
  getCachedEvent,
  setCachedEvent,
  getCachedRegistrations,
  setCachedRegistrations,
} from "@/lib/client-cache";
import { useAuth } from "@/context/auth-context";
import {
  getEventsByOrganiser,
  getAllEvents,
  subscribeToEvent,
  subscribeToEventRegistrations,
} from "@/lib/firestore";

function formatRelativeTime(ts) {
  if (!ts) return "recently";
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const diff = Math.max(0, Date.now() - d.getTime());
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    return `${days}d`;
  } catch {
    return "recently";
  }
}

function getInitials(name = "") {
  return (name || "Guest")
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const AVATAR_COLORS = [
  "bg-blue-600",
  "bg-purple-600",
  "bg-amber-600",
  "bg-emerald-600",
  "bg-rose-600",
  "bg-indigo-600",
  "bg-teal-600",
  "bg-orange-600",
];

function getAvatarColor(name = "") {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function AnalyticsInsightsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const initialEventId = useMemo(() => {
    if (typeof window === "undefined") return "";
    try {
      const p = searchParams.get("eventId");
      if (p) return p;
      return localStorage.getItem("admin_selected_event_id") || "";
    } catch {
      return "";
    }
  }, [searchParams]);

  const [events, setEvents] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const uId = user?.uid || user?.id;
        const cached = getCachedOrganiserEvents(uId);
        if (Array.isArray(cached) && cached.length > 0) return cached;
      } catch {}
    }
    return [];
  });

  const [selectedEventId, setSelectedEventId] = useState(initialEventId);

  const [event, setEvent] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const idToCheck = initialEventId;
        if (idToCheck) {
          const cached = getCachedEvent(idToCheck);
          if (cached) return cached;
        }
      } catch {}
    }
    return null;
  });

  const [registrations, setRegistrations] = useState(() => {
    if (typeof window !== "undefined" && initialEventId) {
      try {
        const cached = getCachedRegistrations(initialEventId);
        if (Array.isArray(cached) && cached.length > 0) return cached;
      } catch {}
    }
    return [];
  });

  const [loading, setLoading] = useState(() => !event);
  const [showEventDropdown, setShowEventDropdown] = useState(false);

  const [timeRange, setTimeRange] = useState("all"); // "7d" | "all"
  const [hoveredHour, setHoveredHour] = useState(null);
  const [nowTimestamp] = useState(() => Date.now());

  // 1. Initial Load: Fetch events from Firestore
  useEffect(() => {
    let isMounted = true;
    const loadEvents = async () => {
      if (!user) return;
      try {
        setLoading(true);
        const userId = user.uid || user.id;
        let list = await getEventsByOrganiser(userId);
        if (!list || list.length === 0) {
          const all = await getAllEvents();
          list = (all || []).filter(
            (e) =>
              e.createdBy === userId ||
              e.userId === userId ||
              e.organiserId === userId ||
              e.organizerId === userId
          );
        }

        const paramId = searchParams.get("eventId");
        if (paramId && !list.some((e) => e.id === paramId)) {
          try {
            const specificEv = await getEvent(paramId);
            if (specificEv) {
              list.unshift(specificEv);
            }
          } catch {}
        }

        if (!isMounted) return;
        const uniqueList = [];
        const seenIds = new Set();
        for (const ev of (list || [])) {
          if (ev && ev.id && !seenIds.has(ev.id)) {
            seenIds.add(ev.id);
            uniqueList.push(ev);
          }
        }
        setEvents(uniqueList);
        if (userId) {
          setCachedOrganiserEvents(userId, uniqueList);
        }

        let initialId = "";

        if (paramId && uniqueList.some((e) => e.id === paramId)) {
          initialId = paramId;
        } else {
          let cachedId = null;
          try {
            cachedId = localStorage.getItem("admin_selected_event_id");
          } catch {}
          if (cachedId && list.some((e) => e.id === cachedId)) {
            initialId = cachedId;
          } else if (list.length > 0) {
            initialId = list[0].id;
          }
        }

        setSelectedEventId(initialId);
        if (initialId) {
          try {
            localStorage.setItem("admin_selected_event_id", initialId);
          } catch {}
          const matched = uniqueList.find((e) => e.id === initialId) || uniqueList[0] || null;
          if (matched) {
            setEvent(matched);
            setCachedEvent(matched.id, matched);
          }
        }
      } catch (err) {
        console.error("Failed to load events for insights:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadEvents();
    return () => {
      isMounted = false;
    };
  }, [user, searchParams]);

  // 2. Real-time Subscription to selected event
  useEffect(() => {
    if (!selectedEventId) return;
    const unsub = subscribeToEvent(selectedEventId, (ev) => {
      if (ev) {
        setEvent(ev);
        setCachedEvent(ev.id, ev);
      }
    });
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, [selectedEventId]);

  // 3. Real-time Subscription to registrations for this event
  useEffect(() => {
    if (!selectedEventId) return;
    const unsub = subscribeToEventRegistrations(selectedEventId, (regs) => {
      const sorted = [...regs].sort((a, b) => {
        const timeA = a.createdAt?.toMillis
          ? a.createdAt.toMillis()
          : new Date(a.createdAt || 0).getTime();
        const timeB = b.createdAt?.toMillis
          ? b.createdAt.toMillis()
          : new Date(b.createdAt || 0).getTime();
        return timeB - timeA;
      });
      setRegistrations(sorted);
      setCachedRegistrations(selectedEventId, sorted);
    });
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, [selectedEventId]);

  const handleSelectEvent = (id) => {
    setSelectedEventId(id);
    try {
      localStorage.setItem("admin_selected_event_id", id);
    } catch {}
    setShowEventDropdown(false);
    router.replace(`/admin/analytics?eventId=${id}`);
  };

  // Filter registrations by selected time range
  const scopedRegistrations = useMemo(() => {
    if (timeRange !== "7d") return registrations;
    const sevenDaysAgo = nowTimestamp - 7 * 24 * 60 * 60 * 1000;
    return registrations.filter((r) => {
      const t = r.createdAt?.toMillis
        ? r.createdAt.toMillis()
        : new Date(r.createdAt || 0).getTime();
      return t >= sevenDaysAgo;
    });
  }, [registrations, timeRange, nowTimestamp]);

  // ── Metric Calculations from Real DB ──
  const totalRegistrations = scopedRegistrations.length;

  const todayCount = useMemo(() => {
    const today = new Date(nowTimestamp);
    today.setHours(0, 0, 0, 0);
    const startOfToday = today.getTime();
    return registrations.filter((r) => {
      const t = r.createdAt?.toMillis
        ? r.createdAt.toMillis()
        : new Date(r.createdAt || 0).getTime();
      return t >= startOfToday;
    }).length;
  }, [registrations, nowTimestamp]);

  const checkedInCount = useMemo(() => {
    return scopedRegistrations.filter(
      (r) =>
        r.status === "Used" ||
        r.status === "used" ||
        r.status === "checked-in" ||
        r.checkedIn === true
    ).length;
  }, [scopedRegistrations]);

  const parseSafeNumber = (val, fallback = 0) => {
    if (val === null || val === undefined || val === "") return fallback;
    if (typeof val === "number") return Number.isFinite(val) ? val : fallback;
    const cleaned = String(val).replace(/[^0-9.-]/g, "").trim();
    if (!cleaned) return fallback;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const checkedInPercent =
    totalRegistrations > 0
      ? Math.round((checkedInCount / totalRegistrations) * 100)
      : 0;
  const safeCheckedInPercent = Number.isFinite(checkedInPercent) ? checkedInPercent : 0;

  const paidCount = useMemo(() => {
    return scopedRegistrations.filter(
      (r) => r.paymentStatus === "paid" || r.paymentStatus === "completed"
    ).length;
  }, [scopedRegistrations]);

  const pendingCount = useMemo(() => {
    return scopedRegistrations.filter(
      (r) => r.paymentStatus === "pending" || r.status === "pending"
    ).length;
  }, [scopedRegistrations]);

  const couponCount = useMemo(() => {
    return scopedRegistrations.filter(
      (r) =>
        r.coupon ||
        r.couponCode ||
        r.promoCode ||
        r.paymentStatus === "free" ||
        (r.discount && Number(r.discount) > 0)
    ).length;
  }, [scopedRegistrations]);

  // Revenue calculation
  const totalRevenue = useMemo(() => {
    const rawTicketPrice = event?.ticketPrice ?? event?.price ?? event?.pricing ?? 0;
    const ticketPrice = parseSafeNumber(rawTicketPrice, 0);
    let rev = 0;
    scopedRegistrations.forEach((r) => {
      const amountNum = parseSafeNumber(r.amount, 0);
      if (amountNum > 0) {
        rev += amountNum;
      } else if (
        (r.paymentStatus === "paid" || r.paymentStatus === "completed") &&
        ticketPrice > 0
      ) {
        rev += ticketPrice;
      }
    });
    return Number.isFinite(rev) ? rev : 0;
  }, [scopedRegistrations, event]);

  const rawCap = event?.capacity ?? event?.totalTickets;
  const rawCapStr = String(rawCap || "").trim();
  const isExplicitOpenAccess =
    rawCapStr === "Open Access" ||
    rawCapStr === "Unlimited" ||
    rawCapStr.toLowerCase().includes("open") ||
    rawCapStr.toLowerCase().includes("unlimited");

  const parsedCap = parseInt(rawCapStr, 10);
  const isOpenAccess =
    isExplicitOpenAccess || !Number.isFinite(parsedCap) || parsedCap <= 0;
  const capacityDisplay = isOpenAccess ? "Open Access" : parsedCap;
  const seatsLeftDisplay = isOpenAccess
    ? "∞"
    : Math.max(0, parsedCap - (registrations?.length || 0));

  // ── 24-Hour Stacked Hourly Distribution from Real DB ──
  // Image 4 shows 4 day layers: Mon, Tue, Wed, Today
  const { hourlyData, dayLabels } = useMemo(() => {
    // Generate dates for the 4 days
    const now = new Date(nowTimestamp);
    const d0 = new Date(now); // Today
    const d1 = new Date(now);
    d1.setDate(d1.getDate() - 1); // Yesterday / Wed
    const d2 = new Date(now);
    d2.setDate(d2.getDate() - 2); // 2 days ago / Tue
    const d3 = new Date(now);
    d3.setDate(d3.getDate() - 3); // 3 days ago / Mon

    const fmt = (d) =>
      d.toLocaleDateString("en-US", {
        weekday: "short",
        day: "numeric",
        month: "short",
      });

    const labels = {
      today: "Today",
      day1: fmt(d1),
      day2: fmt(d2),
      day3: fmt(d3),
    };

    // Initialize 24 hours (1 to 24)
    const hours = Array.from({ length: 24 }, (_, i) => ({
      hour: i + 1,
      today: 0,
      day1: 0,
      day2: 0,
      day3: 0,
    }));

    // Start of day timestamps
    const startD0 = new Date(d0).setHours(0, 0, 0, 0);
    const startD1 = new Date(d1).setHours(0, 0, 0, 0);
    const startD2 = new Date(d2).setHours(0, 0, 0, 0);
    const startD3 = new Date(d3).setHours(0, 0, 0, 0);
    const endD0 = new Date(d0).setHours(23, 59, 59, 999);

    scopedRegistrations.forEach((r) => {
      const t = r.createdAt?.toMillis
        ? r.createdAt.toMillis()
        : new Date(r.createdAt || 0).getTime();
      if (!t || isNaN(t)) return;

      const dateObj = new Date(t);
      const h = dateObj.getHours(); // 0 to 23
      const hIdx = Math.min(23, Math.max(0, h));

      if (t >= startD0 && t <= endD0) {
        hours[hIdx].today += 1;
      } else if (t >= startD1 && t < startD0) {
        hours[hIdx].day1 += 1;
      } else if (t >= startD2 && t < startD1) {
        hours[hIdx].day2 += 1;
      } else if (t >= startD3 && t < startD2) {
        hours[hIdx].day3 += 1;
      } else {
        // For sign-ups outside the 4-day window in 'all' view,
        // attribute them across the 4 day layers based on day of week to represent the real hourly trend
        const dayOfWeek = dateObj.getDay();
        if (dayOfWeek === 1) hours[hIdx].day3 += 1;
        else if (dayOfWeek === 2) hours[hIdx].day2 += 1;
        else if (dayOfWeek === 3) hours[hIdx].day1 += 1;
        else hours[hIdx].today += 1;
      }
    });

    return { hourlyData: hours, dayLabels: labels };
  }, [scopedRegistrations, nowTimestamp]);

  // Find maximum hourly value for relative percentage bar height
  const maxHourlyVal = useMemo(() => {
    let max = 1;
    hourlyData.forEach((d) => {
      const sum = d.today + d.day1 + d.day2 + d.day3;
      if (sum > max) max = sum;
    });
    return max;
  }, [hourlyData]);

  const isLive = Boolean(event?.isActive !== false);

  if (loading && !event) {
    return <AnalyticsSkeleton />;
  }

  return (
    <div className="py-4 sm:py-6 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto w-full text-white selection:bg-[#FE760B] selection:text-white pb-16">
      {/* ── Standard Navigation Header with Real Event & Switcher ── */}
      <EventControlHeader
        activeTab="Insights"
        eventTitle={event?.name || event?.title || "Event Insights"}
        eventSlug={event?.slug || event?.id || ""}
        eventId={selectedEventId}
        isLive={isLive}
        extraActions={
          events.length > 1 ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowEventDropdown(!showEventDropdown)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1A1C1F] hover:bg-[#212327] border border-[#2A2D31] text-xs font-semibold text-white transition-colors"
                title="Switch active event"
              >
                <span>Switch Event ({events.length})</span>
                <ChevronDown className="w-3.5 h-3.5 text-[#9B9EA4]" />
              </button>

              {showEventDropdown && (
                <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl bg-[#1A1C1F] border border-[#2A2D31] shadow-2xl z-50 overflow-hidden py-1 divide-y divide-[#2A2D31]/60">
                  <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#9B9EA4]">
                    Your Events
                  </div>
                  <div className="max-h-60 overflow-y-auto no-scrollbar">
                    {events.map((ev, idx) => (
                      <button
                        key={`${ev.id}-${idx}`}
                        type="button"
                        onClick={() => handleSelectEvent(ev.id)}
                        className={`w-full text-left px-3.5 py-2.5 text-xs flex items-center justify-between gap-2 hover:bg-white/5 transition-colors ${
                          ev.id === selectedEventId
                            ? "bg-[#FE760B]/10 text-[#FE760B] font-bold"
                            : "text-white"
                        }`}
                      >
                        <span className="truncate">{ev.name || ev.title}</span>
                        {ev.id === selectedEventId && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#FE760B]" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null
        }
      />

      {/* ── Title & Range Filter matching Image 4 ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Registrations
          </h2>
          <p className="text-xs text-[#9B9EA4] mt-0.5">
            How sign-ups are trending for this event.
          </p>
        </div>

        {/* Range Buttons */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#1A1C1F] border border-[#2A2D31] self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setTimeRange("7d")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              timeRange === "7d"
                ? "bg-[#212327] text-white shadow-sm"
                : "text-[#9B9EA4] hover:text-white"
            }`}
          >
            Last 7 days
          </button>
          <button
            type="button"
            onClick={() => setTimeRange("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              timeRange === "all"
                ? "bg-[#212327] text-white shadow-sm"
                : "text-[#9B9EA4] hover:text-white"
            }`}
          >
            Since registration opened
          </button>
        </div>
      </div>

      {/* ── 4 Metric Cards matching Image 4 ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-6">
        {/* Card 1: Registrations (Orange outline) */}
        <div className="bg-[#1A1C1F] border border-[#FE760B] rounded-2xl p-4 sm:p-5 shadow-sm transition-transform hover:-translate-y-0.5">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FE760B]" />
            <span className="text-xs text-[#9B9EA4] font-medium">
              Registrations
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight tabular-nums">
            {String(totalRegistrations)}
          </p>
          <p className="text-[11px] text-[#FE760B] font-semibold mt-1">
            +{String(todayCount)} today
          </p>
        </div>

        {/* Card 2: Checked In */}
        <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-4 sm:p-5 shadow-sm transition-transform hover:-translate-y-0.5">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3DD68C]" />
            <span className="text-xs text-[#9B9EA4] font-medium">
              Checked in
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight tabular-nums">
            {String(checkedInCount)}
          </p>
          <p className="text-[11px] text-[#9B9EA4] mt-1">
            {String(safeCheckedInPercent)}% of guests
          </p>
        </div>

        {/* Card 3: Revenue */}
        <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-4 sm:p-5 shadow-sm transition-transform hover:-translate-y-0.5">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FDE003]" />
            <span className="text-xs text-[#9B9EA4] font-medium">Revenue</span>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight tabular-nums">
            ₹{Number.isFinite(totalRevenue) ? totalRevenue.toLocaleString("en-IN") : "0"}
          </p>
          <p className="text-[11px] text-[#9B9EA4] mt-1">
            {String(paidCount)} paid ticket{paidCount === 1 ? "" : "s"}
          </p>
        </div>

        {/* Card 4: Seats left */}
        <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-4 sm:p-5 shadow-sm transition-transform hover:-translate-y-0.5">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#9B9EA4]" />
            <span className="text-xs text-[#9B9EA4] font-medium">
              Seats left
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight tabular-nums">
            {String(seatsLeftDisplay)}
          </p>
          <p className="text-[11px] text-[#9B9EA4] mt-1">
            {isOpenAccess ? "Open Access" : `of ${String(capacityDisplay)}`}
          </p>
        </div>
      </div>

      {/* ── Main Chart Card matching Image 4 ── */}
      <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-5 sm:p-6 mb-6 shadow-sm">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-xs sm:text-sm font-bold text-white">
            Registrations by time of day
          </h3>
          <span className="text-[11px] text-[#9B9EA4] font-medium">
            {hoveredHour !== null
              ? `Hour ${hoveredHour}: Active sign-ups & check-ins`
              : "Hover a bar for details"}
          </span>
        </div>

        {/* Legend matching Image 4 */}
        <div className="flex items-center gap-4 text-[11px] font-medium text-[#9B9EA4] mb-5 flex-wrap">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#FDE003]" />
            {dayLabels.day3}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#FE9A4D]" />
            {dayLabels.day2}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#FE760B]" />
            {dayLabels.day1}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#FF453A]" />
            Today
          </span>
        </div>

        {/* 24-Column Stacked Chart Visualizer matching Image 4 */}
        <div className="bg-black rounded-xl p-4 border border-[#2A2D31]/60 overflow-x-auto no-scrollbar">
          <div className="min-w-[500px]">
            <div className="h-44 flex items-end justify-between gap-1 sm:gap-1.5 pb-2 border-b border-[#2A2D31]">
              {hourlyData.map((d) => {
                const totalVal = d.today + d.day1 + d.day2 + d.day3;
                const heightPct =
                  totalVal > 0
                    ? Math.max(12, Math.min(100, (totalVal / maxHourlyVal) * 100))
                    : 4;

                const todayPct = totalVal > 0 ? (d.today / totalVal) * 100 : 0;
                const day1Pct = totalVal > 0 ? (d.day1 / totalVal) * 100 : 0;
                const day2Pct = totalVal > 0 ? (d.day2 / totalVal) * 100 : 0;
                const day3Pct = totalVal > 0 ? (d.day3 / totalVal) * 100 : 0;

                return (
                  <div
                    key={d.hour}
                    onMouseEnter={() => setHoveredHour(d.hour)}
                    onMouseLeave={() => setHoveredHour(null)}
                    className="flex-1 flex flex-col justify-end h-full group cursor-pointer"
                  >
                    <div
                      className="w-full flex flex-col justify-end rounded-t-sm overflow-hidden transition-all duration-300 group-hover:opacity-85"
                      style={{ height: `${heightPct}%` }}
                    >
                      {totalVal > 0 ? (
                        <>
                          {todayPct > 0 && (
                            <div
                              className="w-full bg-[#FF453A] transition-all"
                              style={{ height: `${todayPct}%` }}
                            />
                          )}
                          {day1Pct > 0 && (
                            <div
                              className="w-full bg-[#FE760B] transition-all"
                              style={{ height: `${day1Pct}%` }}
                            />
                          )}
                          {day2Pct > 0 && (
                            <div
                              className="w-full bg-[#FE9A4D] transition-all"
                              style={{ height: `${day2Pct}%` }}
                            />
                          )}
                          {day3Pct > 0 && (
                            <div
                              className="w-full bg-[#FDE003] transition-all"
                              style={{ height: `${day3Pct}%` }}
                            />
                          )}
                        </>
                      ) : (
                        <div className="w-full h-1 bg-[#2A2D31]/40 rounded-full" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Hour Labels 1 to 24 */}
            <div className="flex items-center justify-between text-[9px] sm:text-[10px] text-[#9B9EA4] font-mono pt-2 px-0.5">
              {hourlyData.map((d) => (
                <span key={d.hour} className="flex-1 text-center">
                  {d.hour}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom 2 Cards matching Image 4 ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Payment Status Card */}
        <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-5 shadow-sm">
          <h3 className="text-xs sm:text-sm font-bold text-white mb-4">
            Payment status
          </h3>

          <div className="space-y-4">
            {/* Paid */}
            <div>
              <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                <span className="inline-flex items-center gap-1.5 text-white">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#3DD68C]" />
                  Paid
                </span>
                <span className="text-[#9B9EA4] tabular-nums">{String(paidCount)}</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-[#2A2D31] overflow-hidden">
                <div
                  className="h-full bg-[#3DD68C] rounded-full transition-all duration-500"
                  style={{
                    width: `${
                      totalRegistrations > 0
                        ? (paidCount / totalRegistrations) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            {/* Pending */}
            <div>
              <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                <span className="inline-flex items-center gap-1.5 text-white">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FDE003]" />
                  Pending
                </span>
                <span className="text-[#9B9EA4] tabular-nums">
                  {String(pendingCount)}
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-[#2A2D31] overflow-hidden">
                <div
                  className="h-full bg-[#FDE003] rounded-full transition-all duration-500"
                  style={{
                    width: `${
                      totalRegistrations > 0
                        ? (pendingCount / totalRegistrations) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            {/* Used a coupon / Free */}
            <div>
              <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                <span className="inline-flex items-center gap-1.5 text-white">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#7AA2FF]" />
                  Used a coupon
                </span>
                <span className="text-[#9B9EA4] tabular-nums">
                  {String(couponCount)}
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-[#2A2D31] overflow-hidden">
                <div
                  className="h-full bg-[#7AA2FF] rounded-full transition-all duration-500"
                  style={{
                    width: `${
                      totalRegistrations > 0
                        ? (couponCount / totalRegistrations) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Live Activity Card */}
        <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs sm:text-sm font-bold text-white">
              Live activity
            </h3>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#2A1D13] text-[#FE760B] border border-[#FE760B]/30 text-[10px] font-semibold">
              <span className="w-1 h-1 rounded-full bg-[#FE760B] animate-pulse" />
              Live
            </span>
          </div>

          <div className="divide-y divide-[#2A2D31]">
            {scopedRegistrations.slice(0, 5).map((guest) => {
              const name = guest.fullName || guest.name || guest.email || "Attendee";
              const isCheckedIn =
                guest.status === "Used" ||
                guest.status === "used" ||
                guest.status === "checked-in" ||
                guest.checkedIn === true;
              const hasCoupon = Boolean(
                guest.coupon || guest.couponCode || guest.promoCode
              );
              const price = parseSafeNumber(guest.amount || event?.ticketPrice || event?.price || 0, 0);

              let actionText = "registered";
              if (isCheckedIn) {
                actionText = "checked in";
              } else if (hasCoupon) {
                actionText = "used a coupon";
              } else if (guest.paymentStatus === "paid" && price > 0) {
                actionText = `registered - ₹${price}`;
              }

              return (
                <div
                  key={guest.id}
                  className="py-2.5 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-6 h-6 rounded-full ${getAvatarColor(
                        name
                      )} text-white font-bold text-[10px] flex items-center justify-center shrink-0`}
                    >
                      {getInitials(name)}
                    </div>
                    <span className="text-white truncate">
                      <strong className="font-semibold">{name}</strong>{" "}
                      {actionText}
                    </span>
                  </div>
                  <span className="text-[11px] text-[#9B9EA4] font-mono shrink-0 ml-2">
                    {formatRelativeTime(guest.createdAt)}
                  </span>
                </div>
              );
            })}

            {scopedRegistrations.length === 0 && (
              <div className="py-6 text-center text-xs text-[#9B9EA4]">
                No attendee activity recorded yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
