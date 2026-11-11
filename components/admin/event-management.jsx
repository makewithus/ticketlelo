/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Plus,
  Edit,
  Trash2,
  Calendar,
  MapPin,
  Zap,
  Layers,
  QrCode,
  Users,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Clock,
  Lock,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import {
  getAllEvents,
  getEventsByOrganiser,
  deleteEvent,
} from "@/lib/firestore";
import { db, auth } from "@/lib/firebase";
import { useAuth } from "@/context/auth-context";
import { PLANS } from "@/lib/plans";
import { BrandLoader } from "@/components/ui/brand-loader";
import { Skeleton } from "@/components/ui/skeleton";
import { getCachedOrganiserEvents, setCachedOrganiserEvents, setCachedEvent } from "@/lib/client-cache";
import { EventBanner } from "@/components/events/event-banner";
import { SubEventModal } from "@/components/admin/sub-event-modal";

export function EventManagement() {
  const { user } = useAuth();
  const router = useRouter();
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
  const [isLoading, setIsLoading] = useState(() => events.length === 0);
  const [isCreating, setIsCreating] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [subEventModalTarget, setSubEventModalTarget] = useState(null);
  const [canCreateEvent, setCanCreateEvent] = useState(true);
  const [planLimitInfo, setPlanLimitInfo] = useState(null);
  const [eventTab, setEventTab] = useState("upcoming");
  const [currentPage, setCurrentPage] = useState(1);
  const EVENTS_PER_PAGE = 5;


  const userId = user?.id;
  const emailLower = (user?.email || "").toLowerCase().trim();
  const isSuperAdmin =
    user?.role === "superAdmin" ||
    user?.role === "superadmin" ||
    emailLower === "adil4ticketlelo@gmail.com" ||
    emailLower === "superadmin@ticketlelo.com";
  const userRole = isSuperAdmin ? "superAdmin" : user?.role;

  const checkEventCreationEligibility = useCallback(async () => {
    if (!userId) return;
    if (userRole === "superAdmin") {
      setCanCreateEvent(true);
      return;
    }

    if (userRole === "organiser") {
      try {
        let headers = {};
        try {
          if (auth?.currentUser) {
            const token = await auth.currentUser.getIdToken();
            if (token) headers.Authorization = `Bearer ${token}`;
          }
        } catch (_) {}

        const res = await fetch(
          `/api/plans/check?userId=${encodeURIComponent(userId)}&action=createEvent`,
          {
            headers,
            cache: "no-store",
          },
        );

        if (!res.ok) {
          setCanCreateEvent(true);
          return;
        }

        const data = await res.json();
        if (data && data.allowed === false) {
          setCanCreateEvent(false);
          setPlanLimitInfo(data);
        } else {
          setCanCreateEvent(true);
          setPlanLimitInfo(null);
        }
      } catch (err) {
        console.warn("Could not verify event creation eligibility:", err);
        setCanCreateEvent(true);
      }
    }
  }, [userId, userRole]);

  const loadEvents = useCallback(async () => {
    try {
      let allEvents;

      // SuperAdmin sees all events
      if (userRole === "superAdmin") {
        allEvents = await getAllEvents();
      } else if (userRole === "organiser" && userId) {
        // Organisers only see their own events
        allEvents = await getEventsByOrganiser(userId);
      } else {
        allEvents = [];
      }

      const uniqueEvents = [];
      const seen = new Set();
      for (const ev of (allEvents || [])) {
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
          uniqueEvents.push(ev);
        }
      }

      setEvents(uniqueEvents);
      if (userId) {
        setCachedOrganiserEvents(userId, uniqueEvents);
      }
    } catch (error) {
      console.error("Failed to load events:", error);
      toast.error("Failed to load events");
    } finally {
      setIsLoading(false);
    }
  }, [userId, userRole]);

  useEffect(() => {
    if (userId) {
      const timer = setTimeout(() => {
        loadEvents();
        checkEventCreationEligibility();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [userId, loadEvents, checkEventCreationEligibility]);

  const handleEdit = (event) => {
    try {
      localStorage.setItem("admin_selected_event_id", event.id);
      setCachedEvent(event.id, event);
    } catch {}
    router.push(`/admin/create-event?eventId=${event.id}`);
  };

  const handleDelete = async (eventId) => {
    if (!confirm("Are you sure you want to delete this event?")) return;
    try {
      await deleteEvent(eventId);
      toast.success("Event deleted successfully");
      await loadEvents();
      checkEventCreationEligibility();
    } catch (error) {
      console.error("Error deleting event:", error);
      toast.error("Failed to delete event");
    }
  };

  const resetForm = () => {
    setEditingEvent(null);
    setIsCreating(false);
  };

  const [now] = useState(() => Date.now());

  const realUpcoming = useMemo(() => {
    const cutoff = new Date(now - 24 * 60 * 60 * 1000);
    return events.filter((e) => {
      if (!e.date) return true;
      try {
        const d = e.date?.toDate ? e.date.toDate() : new Date(e.date);
        return d >= cutoff;
      } catch {
        return true;
      }
    });
  }, [events, now]);

  const realPast = useMemo(() => {
    const cutoff = new Date(now - 24 * 60 * 60 * 1000);
    return events.filter((e) => {
      if (!e.date) return false;
      try {
        const d = e.date?.toDate ? e.date.toDate() : new Date(e.date);
        return d < cutoff;
      } catch {
        return false;
      }
    });
  }, [events, now]);

  useEffect(() => {
    if (isCreating) {
      if (editingEvent?.id) {
        router.push(`/admin/create-event?eventId=${editingEvent.id}`);
      } else {
        router.push("/admin/create-event");
      }
      setIsCreating(false);
    }
  }, [isCreating, editingEvent, router]);

  if (isCreating) {
    return null;
  }

  if (isLoading && events.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <Skeleton className="h-8 w-32 rounded-xl" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 w-48 sm:w-64 rounded-xl" />
            <Skeleton className="h-10 w-32 rounded-xl" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((card) => (
            <div
              key={card}
              className="bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] rounded-2xl overflow-hidden shadow-sm flex flex-col justify-between"
            >
              <div className="w-full h-44 sm:h-48 bg-slate-100 dark:bg-[#131517]">
                <Skeleton className="w-full h-full rounded-none" />
              </div>
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-5 w-24 rounded-full" />
                  <Skeleton className="h-4 w-16 rounded-md" />
                </div>
                <Skeleton className="h-5 w-3/4 rounded-lg" />
                <Skeleton className="h-3.5 w-1/2 rounded-md" />
                <div className="space-y-1.5 pt-1">
                  <Skeleton className="h-2 w-full rounded-full" />
                </div>
              </div>
              <div className="p-4 border-t border-slate-100 dark:border-[#2A2D31] flex items-center justify-between gap-2">
                <Skeleton className="h-8 flex-1 rounded-xl" />
                <Skeleton className="h-8 w-20 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Events
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {/* Upcoming / Past Tab Switcher */}
          <div className="inline-flex items-center bg-[#1A1C1F] border border-[#2A2D31] rounded-xl p-1 gap-1">
            <button
              type="button"
              onClick={() => {
                setEventTab("upcoming");
                setCurrentPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                eventTab === "upcoming"
                  ? "bg-[#212327] text-white shadow-sm font-bold border border-[#2A2D31]"
                  : "text-[#9B9EA4] hover:text-white"
              }`}
            >
              Upcoming ({realUpcoming.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setEventTab("past");
                setCurrentPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                eventTab === "past"
                  ? "bg-[#212327] text-white shadow-sm font-bold border border-[#2A2D31]"
                  : "text-[#9B9EA4] hover:text-white"
              }`}
            >
              Past ({realPast.length})
            </button>
          </div>

          {/* + Create event button matching Events section design */}
          <button
            type="button"
            onClick={() => router.push("/admin/create-event")}
            disabled={!canCreateEvent}
            className="px-3.5 py-1.5 rounded-xl bg-[#FE760B] hover:bg-[#FF8A2B] text-xs font-bold text-white transition-all cursor-pointer shadow-sm flex items-center gap-1.5 disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create event</span>
          </button>
        </div>
      </div>

      {/* Plan limit reached — upgrade CTA styled for both light and dark modes */}
      {!canCreateEvent && user?.role === "organiser" && (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-500/20 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-[#1E1B17] dark:to-[#171412] p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="w-10 h-10 bg-amber-100 dark:bg-amber-500/15 border border-transparent dark:border-amber-500/30 rounded-xl flex items-center justify-center flex-shrink-0">
              <Zap className="w-5 h-5 text-amber-600 dark:text-[#FE760B]" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-amber-900 dark:text-amber-100 text-base">
                You&apos;ve reached your event limit
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-200/80 mt-1">
                {planLimitInfo?.reason ||
                  `Your current plan allows ${PLANS[user?.plan || "free"].eventsAllowed} event(s). Upgrade to create more.`}
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={() => router.push("/pricing")}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-bold rounded-xl text-sm transition-all shadow-sm cursor-pointer"
                >
                  <Zap className="w-4 h-4" />
                  Upgrade Plan
                </button>
                <button
                  onClick={() => router.push("/host-event")}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#212327] border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-200 font-semibold rounded-xl text-sm hover:bg-amber-50 dark:hover:bg-[#2A2D31] transition-colors cursor-pointer"
                >
                  Submit Hosting Request
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Events List View */}
      {!isCreating && (() => {
        const activeList = eventTab === "upcoming" ? realUpcoming : realPast;

        if (activeList.length === 0) {
          return (
            <div className="rounded-2xl border border-[#2A2D31] bg-[#1A1C1F] p-12 text-center max-w-lg mx-auto">
              <div className="w-12 h-12 rounded-2xl bg-[#FE760B]/10 border border-[#FE760B]/20 flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-6 h-6 text-[#FE760B]" />
              </div>
              <h4 className="text-base font-bold text-white mb-1.5">
                {eventTab === "upcoming" ? "No upcoming events" : "No past events"}
              </h4>
              <p className="text-xs text-[#9B9EA4] mb-6 leading-relaxed">
                {eventTab === "upcoming"
                  ? "Create your first event to start accepting registrations and managing tickets."
                  : "Past and completed events will appear here once they conclude."}
              </p>
              {eventTab === "upcoming" && (
                <Button
                  onClick={() => router.push("/admin/create-event")}
                  disabled={!canCreateEvent}
                  className="h-10 bg-[#FE760B] hover:bg-[#FE760B]/90 text-[#131517] font-semibold text-xs px-5 rounded-xl shadow-none inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4 text-[#131517]" />
                  Create event
                </Button>
              )}
            </div>
          );
        }

        const totalItems = activeList.length;
        const totalPages = Math.max(1, Math.ceil(totalItems / EVENTS_PER_PAGE));
        const safePage = Math.min(Math.max(1, currentPage), totalPages);
        const paginatedList = activeList.slice(
          (safePage - 1) * EVENTS_PER_PAGE,
          safePage * EVENTS_PER_PAGE
        );
        const startItem = (safePage - 1) * EVENTS_PER_PAGE + 1;
        const endItem = Math.min(safePage * EVENTS_PER_PAGE, totalItems);

        return (
          <div className="space-y-6">
            <div className="space-y-4">
              {paginatedList.map((event, idx) => {
                // Calculate date parts
                let datePart = event.dateDisplay;
                let dayPart = event.dayDisplay;
                let timePart = event.timeDisplay || "12:00 PM";

                if (!datePart && event.date) {
                  try {
                    const d = event.date?.toDate
                      ? event.date.toDate()
                      : new Date(event.date);
                    const isToday =
                      d.toDateString() === new Date().toDateString();
                    datePart = isToday
                      ? "Today"
                      : d.toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        });
                    dayPart = d.toLocaleDateString("en-IN", { weekday: "long" });
                    timePart = d.toLocaleTimeString("en-IN", {
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    });
                  } catch {
                    datePart = "Upcoming";
                    dayPart = "";
                  }
                }

                // Mutually exclusive status badge
                const isCancelled = Boolean(event.isCancelled || event.status === "cancelled");
                const isCancelPending = Boolean(event.cancellationRequest?.status === "pending");
                const isLive = !isCancelled && event.status === "live";
                const isEnded = !isCancelled && (eventTab === "past" || event.status === "ended");
                const isDraft = !isCancelled && event.status === "draft";
                const isPublished = !isCancelled && !isLive && !isEnded && !isDraft;

                return (
                  <div
                    key={`mgmt-event-${event.id || idx}`}
                    className={`rounded-2xl border p-4 sm:p-5 shadow-sm transition-all group ${
                      isCancelled
                        ? "border-rose-500/30 bg-[#1A1C1F]/80"
                        : "border-[#2A2D31] bg-[#1A1C1F] hover:border-[#3A3D42]"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                      {/* Left: Date Badge + Details */}
                      <div className="flex items-start gap-3.5 sm:gap-4 flex-1 min-w-0 w-full sm:w-auto">
                        {/* Clean Date Tile */}
                        <div className="w-16 sm:w-20 shrink-0 flex flex-col items-center justify-center py-2.5 px-1.5 rounded-xl bg-[#212327] border border-[#2A2D31] text-center">
                          <span className={`text-xs sm:text-sm font-black uppercase ${isCancelled ? "text-rose-500" : "text-[#FE760B]"}`}>
                            {datePart || "Upcoming"}
                          </span>
                          <span className="text-[11px] text-[#9B9EA4] font-medium mt-0.5 truncate max-w-full">
                            {dayPart || timePart}
                          </span>
                        </div>

                        {/* Event Details */}
                        <div className="space-y-1.5 flex-1 min-w-0">
                          {/* Meta Line: Status + Price + Time */}
                          <div className="flex items-center gap-2 flex-wrap">
                            {isCancelled && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                Cancelled
                              </span>
                            )}
                            {isCancelPending && !isCancelled && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 animate-pulse">
                                <Clock className="w-3 h-3 text-amber-500" />
                                Cancellation Requested
                              </span>
                            )}
                            {isLive && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FE760B]/14 text-[#FE760B] border border-[#FE760B]/30">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#FE760B] animate-pulse" />
                                LIVE
                              </span>
                            )}
                            {isPublished && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#3DD68C]/12 text-[#3DD68C] border border-[#3DD68C]/25">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#3DD68C]" />
                                Published
                              </span>
                            )}
                            {isDraft && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-white/7 text-[#D0D0D1] border border-[#2A2D31]">
                                Draft
                              </span>
                            )}
                            {isEnded && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-white/7 text-[#9B9EA4] border border-[#2A2D31]">
                                Ended
                              </span>
                            )}

                            {(event.price || event.totalTickets) && (
                              <span className="px-2 py-0.5 rounded bg-white/5 border border-white/5 text-[11px] font-mono text-[#D0D0D1]">
                                {event.price || (event.isPaid ? "Paid" : "Free")}
                              </span>
                            )}

                            <span className="text-xs text-[#9B9EA4] font-mono">
                              {timePart}
                            </span>
                          </div>

                          {/* Event Title */}
                          <h3 className={`text-base sm:text-lg font-bold transition-colors truncate ${isCancelled ? "text-white/80 line-through decoration-rose-500/50" : "text-white group-hover:text-[#FE760B]"}`}>
                            {event.name || event.title || "Untitled Event"}
                          </h3>

                          {/* Venue / Location */}
                          {event.location && (
                            <div className="flex items-center gap-1.5 text-xs text-[#9B9EA4] truncate">
                              <MapPin className="w-3.5 h-3.5 text-[#9B9EA4] shrink-0" />
                              <span className="truncate">{event.location}</span>
                            </div>
                          )}

                          {/* Guests / Capacity */}
                          <div className="flex items-center gap-2 text-xs text-[#9B9EA4]">
                            <Users className="w-3.5 h-3.5 text-[#9B9EA4] shrink-0" />
                            <span>
                              {event.attendeeDisplay || (
                                event.limitCapacity === false || event.capacity === "Unlimited" || event.totalTickets === 9999
                                  ? "Open Access (Unlimited)"
                                  : `${event.totalTickets || event.maxCapacity || 100} guests capacity`
                              )}
                              {event.checkedInDisplay && (
                                <>
                                  {" · "}
                                  <span className="text-[#3DD68C] font-semibold">
                                    {event.checkedInDisplay}
                                  </span>
                                </>
                              )}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Event banner / poster thumbnail */}
                      <div className="hidden sm:block w-24 h-24 rounded-xl overflow-hidden shrink-0 border border-[#2A2D31] bg-[#212327]">
                        <EventBanner
                          event={event}
                          aspect="square"
                          className="w-full h-full rounded-xl border-none shadow-none"
                        />
                      </div>
                    </div>

                    {/* Bottom Action Bar */}
                    <div className="flex items-center justify-between gap-2 pt-3.5 mt-3.5 border-t border-[#2A2D31] flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isCancelled ? (
                          <button
                            type="button"
                            onClick={() => {
                              try {
                                localStorage.setItem("admin_selected_event_id", event.id);
                                setCachedEvent(event.id, event);
                              } catch {}
                              router.push(`/admin/overview?eventId=${event.id}`);
                            }}
                            className="px-3.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                          >
                            <span>View Event (Cancelled)</span>
                            <span>→</span>
                          </button>
                        ) : isLive ? (
                          <button
                            type="button"
                            onClick={() => {
                              try {
                                localStorage.setItem("admin_selected_event_id", event.id);
                                setCachedEvent(event.id, event);
                              } catch {}
                              router.push(`/admin/scanner?eventId=${event.id}`);
                            }}
                            className="px-3.5 py-1.5 rounded-xl bg-[#FE760B] hover:bg-[#FF8A2B] text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                            <span>Check In</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              try {
                                localStorage.setItem("admin_selected_event_id", event.id);
                                setCachedEvent(event.id, event);
                              } catch {}
                              router.push(`/admin/overview?eventId=${event.id}`);
                            }}
                            className="px-3.5 py-1.5 rounded-xl bg-[#212327] hover:bg-[#2A2D31] text-white text-xs font-semibold border border-[#2A2D31] hover:border-[#FE760B]/40 transition-colors flex items-center gap-1.5 cursor-pointer"
                          >
                            <span>Manage Event</span>
                            <span>→</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            try {
                              localStorage.setItem("admin_selected_event_id", event.id);
                              setCachedEvent(event.id, event);
                            } catch {}
                            router.push(`/admin/registrations?eventId=${event.id}`);
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-[#212327] hover:bg-[#2A2D31] text-white text-xs font-semibold border border-[#2A2D31] hover:border-[#3DD68C]/40 transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <Users className="w-3.5 h-3.5 text-[#3DD68C]" />
                          <span>Guests</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            try {
                              localStorage.setItem("admin_selected_event_id", event.id);
                              setCachedEvent(event.id, event);
                            } catch {}
                            router.push(`/admin/analytics?eventId=${event.id}`);
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-[#212327] hover:bg-[#2A2D31] text-[#9B9EA4] hover:text-white text-xs font-semibold border border-[#2A2D31] hover:border-[#2B59FF]/40 transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <BarChart3 className="w-3.5 h-3.5 text-[#2B59FF]" />
                          <span>Insights</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {!isCancelled && (
                          <button
                            type="button"
                            onClick={() => setSubEventModalTarget(event)}
                            title="Manage tracks / sub-events"
                            className="p-2 rounded-lg bg-[#212327] hover:bg-[#2A2D31] text-[#9B9EA4] hover:text-white border border-[#2A2D31] hover:border-[#FE760B]/30 transition-colors cursor-pointer"
                          >
                            <Layers className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleEdit(event)}
                          title={isCancelled ? "View event details" : "Edit event"}
                          className="p-2 rounded-lg bg-[#212327] hover:bg-[#2A2D31] text-[#9B9EA4] hover:text-white border border-[#2A2D31] hover:border-[#FE760B]/30 transition-colors cursor-pointer"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        {!isCancelled && (
                          <button
                            type="button"
                            onClick={() => handleDelete(event.id)}
                            title="Delete event"
                            className="p-2 rounded-lg bg-[#212327] hover:bg-rose-950/40 text-[#9B9EA4] hover:text-rose-400 border border-[#2A2D31] hover:border-rose-500/30 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls — Exactly 5 per page */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-6 border-t border-[#2A2D31] text-xs">
                <span className="text-[#9B9EA4] font-medium">
                  Showing <strong className="text-white">{startItem}</strong> to{" "}
                  <strong className="text-white">{endItem}</strong> of{" "}
                  <strong className="text-white">{totalItems}</strong> events
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={safePage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="px-2.5 py-1.5 rounded-lg border border-[#2A2D31] bg-[#1A1C1F] text-slate-300 hover:text-white hover:bg-[#212327] disabled:opacity-40 disabled:pointer-events-none transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Previous</span>
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                    const isActive = pageNum === safePage;
                    return (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          isActive
                            ? "bg-[#FE760B] text-white shadow-sm"
                            : "bg-[#1A1C1F] border border-[#2A2D31] text-[#9B9EA4] hover:text-white hover:bg-[#212327]"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    disabled={safePage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="px-2.5 py-1.5 rounded-lg border border-[#2A2D31] bg-[#1A1C1F] text-slate-300 hover:text-white hover:bg-[#212327] disabled:opacity-40 disabled:pointer-events-none transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Child Sub-Events Modal */}
      <SubEventModal
        event={subEventModalTarget}
        isOpen={!!subEventModalTarget}
        onClose={() => setSubEventModalTarget(null)}
      />
    </div>
  );
}
