"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Radio,
  Calendar,
  Users,
  Clock,
  RefreshCw,
  Loader2,
  Shield,
  Plus,
} from "lucide-react";
import { EventManagement } from "@/components/admin/event-management";
import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { getAllEvents, getEventsByOrganiser } from "@/lib/firestore";
import { DashboardEventsSkeleton } from "@/components/ui/skeleton";
import { getCachedOrganiserEvents, setCachedOrganiserEvents } from "@/lib/client-cache";

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  iconBg,
  iconColor,
  loading,
}) {
  return (
    <div className="bg-white dark:bg-[#1A1C1F] rounded-2xl border border-slate-200 dark:border-[#2A2D31] p-4 sm:p-5 flex items-center gap-3.5 sm:gap-4 shadow-sm transition-colors">
      <div
        className={`w-11 h-11 sm:w-12 sm:h-12 ${iconBg} rounded-xl flex items-center justify-center flex-shrink-0 border border-slate-200/60 dark:border-[#2A2D31]`}
      >
        <Icon size={20} className={iconColor} />
      </div>
      <div className="min-w-0">
        {loading ? (
          <Loader2 size={20} className="animate-spin text-slate-400 dark:text-[#9B9EA4] my-1" />
        ) : (
          <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight truncate">
            {value}
          </div>
        )}
        <div className="text-xs text-slate-500 dark:text-[#9B9EA4] mt-0.5 truncate">{label}</div>
        {sub && !loading && (
          <div className="text-[11px] text-slate-400 dark:text-[#9B9EA4]/80 mt-0.5 truncate">{sub}</div>
        )}
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const userId = user?.id || user?.uid;

  // Instant 0ms cache-first hydration
  const [events, setEvents] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const uId = user?.id || user?.uid;
        const cached = getCachedOrganiserEvents(uId);
        if (Array.isArray(cached) && cached.length > 0) return cached;
      } catch {}
    }
    return [];
  });
  const [loading, setLoading] = useState(() => events.length === 0);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("ticketlelo_last_active", String(Date.now()));
      } catch (_) {}
    }
  }, []);

  const emailLower = (user?.email || "").toLowerCase().trim();
  const isSuperAdmin =
    user?.role === "superAdmin" ||
    emailLower === "adil4ticketlelo@gmail.com" ||
    emailLower === "superadmin@ticketlelo.com";
  const userRole = isSuperAdmin ? "superAdmin" : user?.role;

  const loadData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      if (userId) {
        let evts = [];
        try {
          // Always load this specific organiser's events for their personal dashboard
          const userEvents = await getEventsByOrganiser(userId);
          if (Array.isArray(userEvents) && userEvents.length > 0) {
            evts = userEvents;
          } else if (userRole === "superAdmin") {
            // If superAdmin, filter platform events down to events created by this user
            const all = await getAllEvents();
            evts = (all || []).filter(
              (ev) =>
                ev?.createdBy === userId ||
                ev?.userId === userId ||
                ev?.organiserId === userId ||
                ev?.organizerId === userId ||
                (ev?.organiserEmail && ev.organiserEmail.toLowerCase() === emailLower)
            );
          }
        } catch (evtErr) {
          console.warn("Could not load events:", evtErr);
        }
        const unique = [];
        const seen = new Set();
        for (const ev of evts || []) {
          if (!ev) continue;
          const evId = ev.id || ev._id;
          const evSlug = ev.slug ? String(ev.slug).toLowerCase().trim() : null;
          const normTitle = (ev.title || ev.name || "").trim().toLowerCase();
          let dateVal = "";
          try {
            const d = ev.date?.toDate
              ? ev.date.toDate()
              : ev.date?.seconds
              ? new Date(ev.date.seconds * 1000)
              : ev.date
              ? new Date(ev.date)
              : null;
            if (d && !isNaN(d.getTime())) {
              dateVal = d.toISOString().slice(0, 10);
            }
          } catch {}
          const compositeKey = normTitle && dateVal ? `${normTitle}__${dateVal}` : null;

          const isDuplicate =
            (evId && seen.has(`id:${evId}`)) ||
            (evSlug && seen.has(`slug:${evSlug}`)) ||
            (compositeKey && seen.has(`comp:${compositeKey}`));

          if (!isDuplicate) {
            if (evId) seen.add(`id:${evId}`);
            if (evSlug) seen.add(`slug:${evSlug}`);
            if (compositeKey) seen.add(`comp:${compositeKey}`);
            unique.push(ev);
          }
        }
        setEvents(unique);
        if (userId) {
          setCachedOrganiserEvents(userId, unique);
        }
      }
    } catch (e) {
      console.error("Failed to load dashboard data:", e);
    } finally {
      setLoading(false);
    }
  }, [userId, userRole]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData(false);
    }, 0);

    return () => clearTimeout(timer);
  }, [loadData]);

  const totalEvents = events.length;
  const liveEvents = events.filter((e) => e.published === true || e.status === "live").length;
  const upcomingEvents = events.filter((e) => {
    if (!e.date) return true;
    try {
      const d = e.date?.toDate ? e.date.toDate() : new Date(e.date);
      return d >= new Date(Date.now() - 24 * 60 * 60 * 1000);
    } catch {
      return true;
    }
  }).length;

  const totalGuestsCapacity = events.reduce((acc, ev) => {
    // 1. Explicitly limited capacity
    if (ev.limitCapacity && ev.maxCapacity) {
      const cap = parseInt(ev.maxCapacity, 10);
      if (Number.isFinite(cap) && cap > 0) return acc + cap;
    }
    // 2. Numeric capacity (excluding dummy 9999)
    if (typeof ev.capacity === "number" && Number.isFinite(ev.capacity) && ev.capacity < 9999) {
      return acc + ev.capacity;
    }
    // 3. String capacity (excluding "Unlimited")
    if (typeof ev.capacity === "string" && ev.capacity !== "Unlimited") {
      const cap = parseInt(ev.capacity, 10);
      if (Number.isFinite(cap) && cap > 0 && cap < 9999) return acc + cap;
    }
    // 4. Specific totalTickets (excluding default placeholder 9999)
    if (ev.totalTickets && ev.totalTickets !== 9999) {
      const cap = parseInt(ev.totalTickets, 10);
      if (Number.isFinite(cap) && cap > 0 && cap < 9999) return acc + cap;
    }
    // 5. Open access / unlimited events: count actual confirmed registrations
    const actualAttendees =
      ev.attendeesCount ||
      ev.registrationsCount ||
      ev.attendeeCount ||
      (Array.isArray(ev.attendees) ? ev.attendees.length : 0);
    return acc + (Number.isFinite(actualAttendees) ? actualAttendees : 0);
  }, 0);

  if (loading && events.length === 0) {
    return <DashboardEventsSkeleton />;
  }

  return (
    <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8 min-h-screen text-slate-900 dark:text-white transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
            Admin dashboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-[#9B9EA4] mt-1">
            Manage events, attendee registrations and check-ins
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isSuperAdmin && (
            <Link
              href="/superadmin"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#FE760B]/60 text-[#FE760B] hover:bg-[#FE760B]/10 text-xs font-semibold transition-all"
            >
              <Shield className="w-3.5 h-3.5 text-[#FE760B]" />
              <span>Super Admin Suite</span>
            </Link>
          )}
          <button
            type="button"
            onClick={() => loadData(true)}
            title="Refresh metrics"
            className="p-1.5 rounded-lg border border-slate-200 dark:border-[#2A2D31] text-slate-500 dark:text-[#9B9EA4] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#212327] transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Organiser Event Metrics */}
      <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard
          icon={Radio}
          label="Live Events"
          value={liveEvents}
          sub={liveEvents > 0 ? "Currently published" : undefined}
          iconBg="bg-[#3DD68C]/12"
          iconColor="text-[#3DD68C]"
          loading={loading}
        />
        <MetricCard
          icon={Calendar}
          label="Total Events"
          value={totalEvents}
          iconBg="bg-slate-100 dark:bg-white/5"
          iconColor="text-slate-600 dark:text-[#D0D0D1]"
          loading={loading}
        />
        <MetricCard
          icon={Clock}
          label="Upcoming Events"
          value={upcomingEvents}
          sub={upcomingEvents > 0 ? "Active schedule" : undefined}
          iconBg="bg-[#FE760B]/14"
          iconColor="text-[#FE760B]"
          loading={loading}
        />
        <MetricCard
          icon={Users}
          label="Total Capacity"
          value={totalGuestsCapacity.toLocaleString("en-IN")}
          sub="Across your events"
          iconBg="bg-[#FDE003]/10"
          iconColor="text-[#FDE003]"
          loading={loading}
        />
      </div>

      {/* Main Section: Event Management Studio */}
      <div className="w-full">
        <EventManagement />
      </div>
    </div>
  );
}
