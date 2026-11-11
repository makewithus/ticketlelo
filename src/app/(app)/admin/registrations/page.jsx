"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  QrCode,
  Download,
  Search,
  CheckCircle2,
  Clock,
  Ticket,
  Loader2,
  Users,
  Mail,
  UserPlus,
  SlidersHorizontal,
  Check,
  X,
  ChevronDown,
  Plus,
  Calendar,
  AlertTriangle,
} from "lucide-react";
import { EventControlHeader } from "@/components/admin/event-control-header";
import { useAuth } from "@/context/auth-context";
import {
  getEvent,
  getEventsByOrganiser,
  getAllEvents,
  subscribeToEvent,
  subscribeToEventRegistrations,
  approveRegistration,
  declineRegistration,
} from "@/lib/firestore";
import * as XLSX from "xlsx";
import { GuestDetailsModal } from "@/components/admin/guest-details-modal";
import { WebScannerModal } from "@/components/admin/web-scanner-modal";
import { RegistrationsSkeleton } from "@/components/ui/skeleton";
import {
  setCachedOrganiserEvents,
  setCachedEvent,
  setCachedRegistrations,
} from "@/lib/client-cache";

function formatRelativeTime(ts) {
  if (!ts) return "recently";
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const diff = Date.now() - d.getTime();
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

export default function RegistrationsGuestsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  // Safe SSR hydration - avoids hydration mismatch
  const initialEventId = searchParams.get("eventId") || "";
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(initialEventId);
  const [event, setEvent] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEventDropdown, setShowEventDropdown] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedGuestIndex, setSelectedGuestIndex] = useState(null);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [targetScannerGuest, setTargetScannerGuest] = useState(null);
  const pageSize = 15;

  // 1. Initial Load: Fetch events from Firestore
  useEffect(() => {
    let isMounted = true;
    const loadEvents = async () => {
      if (!user) return;
      try {
        setLoading(true);
        // Correctly scope userId before checking user role
        const userId = user.uid || user.id || "";
        const emailLower = (user.email || "").toLowerCase().trim();
        const isSuperAdmin =
          user.role === "superAdmin" ||
          user.role === "superadmin" ||
          emailLower === "adil4ticketlelo@gmail.com" ||
          emailLower === "superadmin@ticketlelo.com";

        let list = [];
        if (isSuperAdmin) {
          // Super admin has full platform access to all events of all organisers
          list = (await getAllEvents()) || [];
        } else {
          list = await getEventsByOrganiser(userId);
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
        }

        const paramId = searchParams.get("eventId");
        // If a specific event is requested via paramId, attempt to load it
        if (paramId && !list.some((e) => e.id === paramId)) {
          try {
            const specificEv = await getEvent(paramId);
            if (specificEv && specificEv.id) {
              list.unshift(specificEv);
            }
          } catch (fetchErr) {
            console.warn("Could not load requested event from paramId:", fetchErr?.message || fetchErr);
          }
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

        // Determine which event to select:
        // Priority 1: query param ?eventId=... ONLY if it exists in uniqueList
        // Priority 2: localStorage admin_selected_event_id if it exists in uniqueList
        // Priority 3: first event in uniqueList
        let initialId = "";

        if (paramId && uniqueList.some((e) => e.id === paramId)) {
          initialId = paramId;
        } else {
          let cachedId = null;
          try {
            cachedId = localStorage.getItem("admin_selected_event_id");
          } catch {}
          if (cachedId && uniqueList.some((e) => e.id === cachedId)) {
            initialId = cachedId;
          } else if (uniqueList.length > 0) {
            initialId = uniqueList[0].id;
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
          // If paramId in URL was missing or pointing to a non-existent event, synchronize the URL to the valid event
          if (paramId && paramId !== initialId) {
            router.replace(`/admin/registrations?eventId=${initialId}`);
          }
        }
      } catch (err) {
        console.error("Failed to load events for registrations:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadEvents();
    return () => {
      isMounted = false;
    };
  }, [user, searchParams, router]);

  // 2. Real-time Subscription to event
  useEffect(() => {
    if (!selectedEventId) {
      const timer = setTimeout(() => setEvent(null), 0);
      return () => clearTimeout(timer);
    }
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
    if (!selectedEventId) {
      const timer = setTimeout(() => setRegistrations([]), 0);
      return () => clearTimeout(timer);
    }
    const unsub = subscribeToEventRegistrations(selectedEventId, (regs) => {
      const sorted = [...regs].sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
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
    setShowEventDropdown(false);
    try {
      localStorage.setItem("admin_selected_event_id", id);
    } catch {}
    const matched = events.find((e) => e.id === id);
    if (matched) {
      setEvent(matched);
      setCachedEvent(matched.id, matched);
    }
    router.replace(`/admin/registrations?eventId=${id}`);
  };

  // Real Stats
  const totalGuests = registrations.length;
  const rawCap = event?.capacity ?? event?.totalTickets ?? 150;
  const isUnlimited = typeof rawCap === "string" && (rawCap.toLowerCase().includes("unlimited") || rawCap.toLowerCase().includes("open"));
  const digits = String(rawCap || "").replace(/[^\d]/g, "");
  const parsedCap = digits ? parseInt(digits, 10) : 150;
  const totalCapacity = !isUnlimited && Number.isFinite(parsedCap) && parsedCap > 0 ? parsedCap : 150;
  const isCancelled = Boolean(event?.isCancelled || event?.status === "cancelled");
  const isCancellationPending = Boolean(event?.cancellationRequest?.status === "pending");

  const checkedInCount = useMemo(() => {
    return registrations.filter(
      (r) =>
        r.status === "Used" ||
        r.status === "used" ||
        r.status === "checked-in" ||
        r.checkedIn === true
    ).length;
  }, [registrations]);

  const declinedCount = useMemo(() => {
    return registrations.filter(
      (r) =>
        r.status === "declined" ||
        r.status === "Cancelled" ||
        r.status === "cancelled" ||
        r.approvalStatus === "declined"
    ).length;
  }, [registrations]);

  const pendingCount = useMemo(() => {
    return registrations.filter(
      (r) =>
        r.status === "pending" ||
        r.approvalStatus === "pending" ||
        r.paymentStatus === "pending"
    ).length;
  }, [registrations]);

  const goingCount = Math.max(0, totalGuests - checkedInCount - pendingCount - declinedCount);

  // Filtered registrations
  const filteredGuests = useMemo(() => {
    return registrations.filter((guest) => {
      const isCheckedIn =
        guest.status === "Used" ||
        guest.status === "used" ||
        guest.status === "checked-in" ||
        guest.checkedIn === true;
      const isDeclined =
        guest.status === "declined" ||
        guest.status === "Cancelled" ||
        guest.status === "cancelled" ||
        guest.approvalStatus === "declined";
      const isPending =
        !isCheckedIn &&
        !isDeclined &&
        (guest.status === "pending" ||
          guest.approvalStatus === "pending" ||
          guest.paymentStatus === "pending");
      const isGoing = !isCheckedIn && !isDeclined && !isPending;

      if (statusFilter === "going" && !isGoing) return false;
      if (statusFilter === "checked-in" && !isCheckedIn) return false;
      if (statusFilter === "pending" && !isPending) return false;
      if (statusFilter === "declined" && !isDeclined) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const name = (guest.fullName || guest.name || guest.attendeeName || "").toLowerCase();
        const email = (guest.email || guest.whatsappPhone || "").toLowerCase();
        const code = (guest.ticketId || guest.ticketCode || guest.id || "").toLowerCase();
        return name.includes(q) || email.includes(q) || code.includes(q);
      }
      return true;
    });
  }, [registrations, searchQuery, statusFilter]);

  const paginatedGuests = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredGuests.slice(start, start + pageSize);
  }, [filteredGuests, currentPage]);

  const totalPages = Math.max(1, Math.ceil(filteredGuests.length / pageSize));

  const handleExportExcel = () => {
    try {
      if (registrations.length === 0) {
        toast.info("No registrations to export");
        return;
      }
      const dataToExport = registrations.map((g) => ({
        "Ticket Code": g.ticketId || g.id,
        "Attendee Name": g.fullName || g.name || g.attendeeName || "Guest",
        "Email Address": g.email || "",
        Phone: g.whatsappPhone || g.phone || "",
        Status: g.status || "Unused",
        "Created At": g.createdAt?.toDate ? g.createdAt.toDate().toISOString() : String(g.createdAt || ""),
      }));

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Guests");
      const cleanTitle = (event?.name || "Event").replace(/[^a-zA-Z0-9]/g, "_");
      XLSX.writeFile(wb, `${cleanTitle}_Guest_List.xlsx`);
      toast.success("Guest list exported to Excel successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to export Excel");
    }
  };

  if (loading && !event) {
    return <RegistrationsSkeleton />;
  }

  // Consistent Empty State when no events exist in the database for this organiser
  if (!loading && (!event || events.length === 0)) {
    return (
      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8 min-h-screen text-slate-900 dark:text-white transition-colors pb-16">
        <EventControlHeader
          activeTab="Guests"
          eventTitle="No Events Found"
          isLive={false}
        />
        <div className="bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] rounded-3xl p-10 sm:p-14 max-w-lg mx-auto shadow-sm text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-[#FE760B]/10 border border-[#FE760B]/20 flex items-center justify-center text-[#FE760B] mx-auto">
            <Ticket className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1.5">No Events Found</h2>
            <p className="text-xs text-slate-500 dark:text-[#9B9EA4] leading-relaxed">
              No published or draft events are currently available for this organiser. Create an event to begin managing registrations and guest passes.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Link
              href="/admin/dashboard"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-[#212327] hover:bg-slate-200 dark:hover:bg-[#2A2D31] text-xs font-semibold text-slate-800 dark:text-white transition-colors"
            >
              Organiser Dashboard
            </Link>
            <Link
              href="/admin/create-event"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#FE760B] hover:bg-[#FF8A2B] text-white font-bold text-xs transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Create Event</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 min-h-screen text-slate-900 dark:text-white selection:bg-[#FE760B] selection:text-white pb-16 transition-colors">
      {/* ── Standard Navigation Header with Live Event Switcher matching Organiser Dashboard ── */}
      <EventControlHeader
        activeTab="Guests"
        eventTitle={event?.name || event?.title || ""}
        eventSlug={event?.slug || event?.id}
        eventId={selectedEventId}
        isLive={event?.status === "live" || event?.isActive}
        isCancelled={isCancelled}
        isCancellationPending={isCancellationPending}
        extraActions={
          events.length > 1 ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowEventDropdown(!showEventDropdown)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#1A1C1F] hover:bg-slate-100 dark:hover:bg-[#212327] border border-slate-200 dark:border-[#2A2D31] text-xs font-semibold text-slate-700 dark:text-white transition-colors shadow-2xs cursor-pointer"
                title="Switch active event"
              >
                <span>Switch Event ({events.length})</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-[#9B9EA4]" />
              </button>

              {showEventDropdown && (
                <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] shadow-2xl z-50 overflow-hidden py-1 divide-y divide-slate-100 dark:divide-[#2A2D31]/60">
                  <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#9B9EA4]">
                    Your Events
                  </div>
                  <div className="max-h-60 overflow-y-auto no-scrollbar">
                    {events.map((ev, idx) => (
                      <button
                        key={`${ev.id}-${idx}`}
                        type="button"
                        onClick={() => handleSelectEvent(ev.id)}
                        className={`w-full text-left px-3.5 py-2.5 text-xs flex items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer ${
                          ev.id === selectedEventId
                            ? "bg-[#FE760B]/10 text-[#FE760B] font-bold"
                            : "text-slate-800 dark:text-white"
                        }`}
                      >
                        <span className="truncate">{ev.name || ev.title || "Untitled Event"}</span>
                        {ev.id === selectedEventId && <Check className="w-3.5 h-3.5 shrink-0" />}
                      </button>
                    ))}
                  </div>
                  <div className="p-2">
                    <Link
                      href="/admin/create-event"
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#212327] hover:bg-slate-200 dark:hover:bg-[#2A2D31] text-xs font-medium text-slate-800 dark:text-white transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5 text-[#FE760B]" />
                      <span>Create New Event</span>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          ) : null
        }
      />

      {/* ── At a Glance Section with Database Counts ── */}
      <div className="bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] rounded-2xl p-5 shadow-sm transition-colors">
        <h2 className="text-base font-bold text-slate-900 dark:text-white mb-2">At a glance</h2>
        <div className="flex items-baseline justify-between mb-2">
          <p className="text-2xl font-black text-[#3DD68C] tracking-tight">
            {totalGuests}{" "}
            <span className="text-xs font-semibold text-slate-500 dark:text-[#9B9EA4]">guests</span>
          </p>
          <span className="text-xs text-slate-500 dark:text-[#9B9EA4] font-medium font-mono">
            {isUnlimited ? "cap ∞" : `cap ${totalCapacity}`}
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-[#2A2D31] overflow-hidden flex mb-2.5">
          <div
            className="h-full bg-[#3DD68C] transition-all duration-500"
            style={{ width: `${Math.min(100, (checkedInCount / Math.max(1, totalCapacity)) * 100)}%` }}
            title={`${checkedInCount} checked in`}
          />
          <div
            className="h-full bg-[#FE760B] transition-all duration-500"
            style={{ width: `${Math.min(100, (goingCount / Math.max(1, totalCapacity)) * 100)}%` }}
            title={`${goingCount} going`}
          />
          <div
            className="h-full bg-[#FDE003] transition-all duration-500"
            style={{ width: `${Math.min(100, (pendingCount / Math.max(1, totalCapacity)) * 100)}%` }}
            title={`${pendingCount} payment pending`}
          />
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs font-medium text-slate-600 dark:text-[#9B9EA4] flex-wrap">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3DD68C]" />
            <strong className="text-slate-900 dark:text-white">{checkedInCount}</strong> checked in
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FE760B]" />
            <strong className="text-slate-900 dark:text-white">{goingCount}</strong> going
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FDE003]" />
            <strong className="text-slate-900 dark:text-white">{pendingCount}</strong> payment pending
          </span>
        </div>
      </div>

      {/* ── 3 Action Cards matching Organiser Dashboard Design ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {/* Invite Guests */}
        {isCancelled ? (
          <div
            className="bg-slate-50 dark:bg-[#1A1C1F]/60 border border-slate-200 dark:border-[#2A2D31] rounded-2xl p-4 flex items-center gap-3.5 opacity-60 cursor-not-allowed"
            title="Invitations closed for cancelled event"
          >
            <div className="w-11 h-11 rounded-2xl bg-slate-200 dark:bg-[#212327] flex items-center justify-center text-slate-500 dark:text-[#9B9EA4] shrink-0">
              <Mail size={19} />
            </div>
            <div>
              <span className="text-sm font-bold text-slate-500 dark:text-[#9B9EA4] block">
                Invitations Closed
              </span>
              <span className="text-[11px] text-slate-400 dark:text-[#9B9EA4]/70">Event is cancelled</span>
            </div>
          </div>
        ) : (
          <Link
            href={`/admin/overview?eventId=${event?.id || ""}`}
            className="bg-white dark:bg-[#1A1C1F] hover:bg-slate-50 dark:hover:bg-[#212327] border border-slate-200 dark:border-[#2A2D31] hover:border-[#2B59FF]/50 rounded-2xl p-4 flex items-center gap-3.5 transition-all shadow-sm hover:shadow-[0_0_24px_rgba(43,89,255,0.25)] hover:scale-[1.01] group cursor-pointer"
          >
            <div className="w-11 h-11 rounded-2xl bg-[#2B59FF] flex items-center justify-center text-white shrink-0 shadow-md group-hover:scale-105 transition-transform">
              <Mail size={19} className="text-white fill-white/20" />
            </div>
            <div>
              <span className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-[#2B59FF] transition-colors block">
                Invite Guests
              </span>
              <span className="text-[11px] text-slate-500 dark:text-[#9B9EA4]">Share link or email</span>
            </div>
          </Link>
        )}

        {/* Check In Guests - Opens Web Scanner */}
        <button
          type="button"
          disabled={isCancelled}
          onClick={() => {
            if (isCancelled) return;
            setTargetScannerGuest(null);
            setShowScannerModal(true);
          }}
          className={`border rounded-2xl p-4 flex items-center gap-3.5 transition-all shadow-sm text-left ${
            isCancelled
              ? "bg-slate-50 dark:bg-[#1A1C1F]/60 border-slate-200 dark:border-[#2A2D31] cursor-not-allowed opacity-60"
              : "bg-white dark:bg-[#1A1C1F] hover:bg-slate-50 dark:hover:bg-[#212327] border-slate-200 dark:border-[#2A2D31] hover:border-[#22C55E]/50 hover:shadow-[0_0_24px_rgba(34,197,94,0.25)] hover:scale-[1.01] group cursor-pointer"
          }`}
        >
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-md ${
            isCancelled ? "bg-slate-200 dark:bg-[#212327] text-slate-400 dark:text-[#9B9EA4]" : "bg-[#22C55E] text-white group-hover:scale-105 transition-transform"
          }`}>
            <QrCode size={19} />
          </div>
          <div>
            <span className={`text-sm font-bold block ${isCancelled ? "text-slate-400 dark:text-[#9B9EA4]" : "text-slate-900 dark:text-white group-hover:text-[#22C55E] transition-colors"}`}>
              {isCancelled ? "Check-In Disabled" : "Check In Guests"}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-[#9B9EA4]">{isCancelled ? "Event cancelled" : "Web & mobile camera"}</span>
          </div>
        </button>

        {/* Guest List */}
        <div className="bg-white dark:bg-[#1A1C1F] hover:bg-slate-50 dark:hover:bg-[#212327] border border-slate-200 dark:border-[#2A2D31] hover:border-[#EAB308]/50 rounded-2xl p-4 flex items-center gap-3.5 transition-all shadow-sm hover:shadow-[0_0_24px_rgba(234,179,8,0.25)] hover:scale-[1.01] group cursor-pointer">
          <div className="w-11 h-11 rounded-2xl bg-[#EAB308] flex items-center justify-center text-white shrink-0 shadow-md group-hover:scale-105 transition-transform">
            <Users size={19} className="text-white fill-white/20" />
          </div>
          <div>
            <span className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-[#EAB308] transition-colors block">
              Guest List
            </span>
            <span className="text-[11px] text-slate-500 dark:text-[#9B9EA4]">Shown to guests</span>
          </div>
        </div>
      </div>

      {/* ── Guest List Section ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Guest List</h2>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-[#9B9EA4]">
            {!isCancelled && (
              <Link
                href={`/admin/overview?eventId=${event?.id || ""}`}
                className="p-1.5 rounded-lg hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                title="Invite or Add Guest"
              >
                <UserPlus size={16} />
              </Link>
            )}
            <button
              type="button"
              onClick={() => toast.info("Displaying full column view")}
              className="p-1.5 rounded-lg hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
              title="Table Columns"
            >
              <SlidersHorizontal size={16} />
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              className="p-1.5 rounded-lg hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
              title="Export to Excel"
            >
              <Download size={16} />
            </button>
          </div>
        </div>

        {/* Search & Filter bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
          {/* Search box */}
          <div className="relative flex-1">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#9B9EA4]"
            />
            <input
              type="text"
              placeholder="Search name, email or ticket ID"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-[#9B9EA4] outline-none focus:border-[#FE760B] transition-colors shadow-2xs"
            />
          </div>

          {/* Filter pills */}
          <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto no-scrollbar">
            {[
              { id: "all", label: "All" },
              { id: "going", label: "Going" },
              { id: "checked-in", label: "Checked in" },
              { id: "pending", label: `Pending${pendingCount > 0 ? ` (${pendingCount})` : ""}` },
              { id: "declined", label: "Declined" },
            ].map((pill) => {
              const isActive = statusFilter === pill.id;
              return (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => {
                    setStatusFilter(pill.id);
                    setCurrentPage(1);
                  }}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? "bg-slate-900 text-white dark:bg-white dark:text-black shadow-sm"
                      : "bg-white dark:bg-[#1A1C1F] text-slate-600 dark:text-[#9B9EA4] hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-[#2A2D31]"
                  }`}
                >
                  {pill.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Guest Rows */}
        <div className="bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] rounded-2xl divide-y divide-slate-100 dark:divide-[#2A2D31] overflow-hidden shadow-sm mb-4 transition-colors">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500 dark:text-[#9B9EA4] flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#FE760B]" />
              <span>Loading guests in real time...</span>
            </div>
          ) : paginatedGuests.length === 0 ? (
            <div className="py-16 px-4 text-center flex flex-col items-center justify-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-[#212327] border border-slate-200 dark:border-[#2A2D31] flex items-center justify-center text-slate-400 dark:text-[#9B9EA4]/70 mb-1">
                <Users size={28} />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">No Guests Yet</h3>
              <p className="text-xs text-slate-500 dark:text-[#9B9EA4] max-w-xs">
                Share the event or invite people to get started!
              </p>
            </div>
          ) : (
            paginatedGuests.map((guest, idx) => {
              const guestName = guest.fullName || guest.name || guest.attendeeName || "Guest Attendee";
              const guestEmail = guest.email || guest.whatsappPhone || "No email";
              const isCheckedIn =
                guest.status === "Used" ||
                guest.status === "used" ||
                guest.status === "checked-in" ||
                guest.checkedIn === true;
              const isDeclined =
                guest.status === "declined" ||
                guest.status === "Cancelled" ||
                guest.status === "cancelled" ||
                guest.approvalStatus === "declined";
              const isPending =
                !isCheckedIn &&
                !isDeclined &&
                (guest.status === "pending" ||
                  guest.approvalStatus === "pending" ||
                  guest.paymentStatus === "pending");
              const initials = getInitials(guestName);
              const avatarBg = getAvatarColor(guestName);
              const timeDisplay = formatRelativeTime(guest.createdAt);
              const ticketCode = guest.ticketId || guest.id;

              const globalIndex = (currentPage - 1) * pageSize + idx;

              return (
                <div
                  key={`${guest.id || guest.ticketId || "guest"}-${idx}`}
                  onClick={() => setSelectedGuestIndex(globalIndex)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedGuestIndex(globalIndex);
                    }
                  }}
                  className="p-4 flex items-center justify-between gap-3 hover:bg-slate-50/80 dark:hover:bg-[#212327]/70 active:bg-slate-100 dark:active:bg-[#212327] cursor-pointer transition-colors group"
                >
                  {/* Left: Avatar + Name + Email */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-full ${avatarBg} text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm`}
                    >
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white group-hover:text-[#FE760B] transition-colors truncate">
                        {guestName}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-[#9B9EA4] truncate font-mono">
                        {guestEmail}
                      </p>
                    </div>
                  </div>

                  {/* Right: Ticket Code + Status Pill / Actions + Time */}
                  <div className="flex items-center gap-3 sm:gap-5 shrink-0">
                    <span className="text-[11px] font-mono text-slate-400 dark:text-[#9B9EA4] hidden md:inline-block">
                      {ticketCode}
                    </span>

                    {/* Status Badge / Inline Action Buttons */}
                    {isCheckedIn ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-[#3DD68C] border border-[#3DD68C]/30 text-[11px] font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#3DD68C]" />
                        Checked In
                      </span>
                    ) : isDeclined ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/30 text-[11px] font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        Declined
                      </span>
                    ) : isPending ? (
                      isCancelled ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-500 border border-amber-500/30 text-[11px] font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          Pending (Locked)
                        </span>
                      ) : (
                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                setRegistrations((prev) =>
                                  prev.map((g) =>
                                    g.id === guest.id
                                      ? { ...g, status: "Going", approvalStatus: "approved" }
                                      : g
                                  )
                                );
                                await approveRegistration(guest.id);
                                toast.success(`${guestName} approved!`);
                              } catch (err) {
                                toast.error("Failed to approve guest");
                              }
                            }}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#3DD68C] hover:text-[#52e89f] transition-colors cursor-pointer py-1 px-1.5 rounded-md hover:bg-[#3DD68C]/10"
                          >
                            <Check size={13} strokeWidth={2.5} />
                            <span>Approve</span>
                          </button>
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                setRegistrations((prev) =>
                                  prev.map((g) =>
                                    g.id === guest.id
                                      ? { ...g, status: "declined", approvalStatus: "declined" }
                                      : g
                                  )
                                );
                                await declineRegistration(guest.id);
                                toast.error(`${guestName} declined`);
                              } catch (err) {
                                toast.error("Failed to decline guest");
                              }
                            }}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#EF4444] hover:text-[#f87171] transition-colors cursor-pointer py-1 px-1.5 rounded-md hover:bg-[#EF4444]/10"
                          >
                            <X size={13} strokeWidth={2.5} />
                            <span>Decline</span>
                          </button>
                        </div>
                      )
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-[#3DD68C] border border-[#3DD68C]/30 text-[11px] font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#3DD68C]" />
                        Going
                      </span>
                    )}

                    {/* Quick Identity Verify Button */}
                    <button
                      type="button"
                      disabled={isCancelled}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isCancelled) {
                          toast.info("Check-in is disabled because this event is cancelled.");
                          return;
                        }
                        setTargetScannerGuest(guest);
                        setShowScannerModal(true);
                      }}
                      className={`p-1.5 rounded-lg border transition-colors ${
                        isCancelled
                          ? "bg-slate-100 dark:bg-[#212327]/60 border-slate-200 dark:border-[#2A2D31] text-slate-400 dark:text-[#9B9EA4] opacity-50 cursor-not-allowed"
                          : "bg-slate-100 dark:bg-[#212327] hover:bg-slate-200 dark:hover:bg-[#2A2D31] border-slate-200 dark:border-[#2A2D31] text-[#3DD68C] cursor-pointer"
                      }`}
                      title={isCancelled ? "Check-in disabled (event cancelled)" : "Verify identity & check in"}
                    >
                      <QrCode size={13} />
                    </button>

                    {/* Relative Timestamp */}
                    <span className="text-[11px] text-slate-400 dark:text-[#9B9EA4] font-mono w-8 text-right">
                      {timeDisplay}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        {filteredGuests.length > 0 && (
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#9B9EA4] px-1">
            <span>
              Showing {paginatedGuests.length} of {filteredGuests.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#1A1C1F] hover:bg-slate-100 dark:hover:bg-[#212327] border border-slate-200 dark:border-[#2A2D31] text-slate-700 dark:text-white disabled:opacity-40 disabled:hover:bg-white dark:disabled:hover:bg-[#1A1C1F] transition-colors cursor-pointer shadow-2xs"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#1A1C1F] hover:bg-slate-100 dark:hover:bg-[#212327] border border-slate-200 dark:border-[#2A2D31] text-slate-700 dark:text-white disabled:opacity-40 disabled:hover:bg-white dark:disabled:hover:bg-[#1A1C1F] transition-colors cursor-pointer shadow-2xs"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Guest Details Drawer / Modal ── */}
      {selectedGuestIndex !== null && filteredGuests[selectedGuestIndex] && (
        <GuestDetailsModal
          isOpen={selectedGuestIndex !== null}
          onClose={() => setSelectedGuestIndex(null)}
          guest={filteredGuests[selectedGuestIndex]}
          allGuests={filteredGuests}
          currentIndex={selectedGuestIndex}
          onNavigate={(newIdx) => {
            setSelectedGuestIndex(newIdx);
            const targetPage = Math.floor(newIdx / pageSize) + 1;
            if (targetPage !== currentPage) {
              setCurrentPage(targetPage);
            }
          }}
          event={event}
          currentUser={user}
          onGuestUpdated={(updatedGuest) => {
            setRegistrations((prev) =>
              prev.map((g) => (g.id === updatedGuest.id ? { ...g, ...updatedGuest } : g))
            );
          }}
        />
      )}

      {/* ── Web QR Scanner Modal (verifies identity on web/mobile) ── */}
      <WebScannerModal
        isOpen={showScannerModal}
        onClose={() => {
          setShowScannerModal(false);
          setTargetScannerGuest(null);
        }}
        event={event}
        targetGuest={targetScannerGuest}
        onGuestVerified={(verified) => {
          setRegistrations((prev) =>
            prev.map((g) => (g.id === verified.id ? { ...g, ...verified } : g))
          );
        }}
      />
    </div>
  );
}
