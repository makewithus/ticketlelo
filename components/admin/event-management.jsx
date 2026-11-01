"use client";

import { useState, useEffect } from "react";
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
import { SubEventModal } from "@/components/admin/sub-event-modal";
import { EventPoster } from "@/components/admin/event-poster";
import { EventCreateStudio } from "@/components/admin/event-create-studio";

export function EventManagement() {
  const { user } = useAuth();
  const router = useRouter();
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [subEventModalTarget, setSubEventModalTarget] = useState(null);
  const [canCreateEvent, setCanCreateEvent] = useState(true);
  const [planLimitInfo, setPlanLimitInfo] = useState(null);
  const [eventTab, setEventTab] = useState("upcoming");


  const checkEventCreationEligibility = async () => {
    if (!user) return;
    if (user.role === "superAdmin") {
      setCanCreateEvent(true);
      return;
    }

    if (user.role === "organiser") {
      try {
        let headers = {};
        try {
          if (auth?.currentUser) {
            const token = await auth.currentUser.getIdToken();
            if (token) headers.Authorization = `Bearer ${token}`;
          }
        } catch (_) {}

        const res = await fetch(
          `/api/plans/check?userId=${encodeURIComponent(user.id)}&action=createEvent`,
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
  };

  const loadEvents = async () => {
    try {
      let allEvents;

      // SuperAdmin sees all events
      if (user.role === "superAdmin") {
        allEvents = await getAllEvents();
      } else if (user.role === "organiser") {
        // Organisers only see their own events
        allEvents = await getEventsByOrganiser(user.id);
      } else {
        allEvents = [];
      }

      const uniqueEvents = [];
      const seenIds = new Set();
      for (const ev of (allEvents || [])) {
        if (ev && ev.id && !seenIds.has(ev.id)) {
          seenIds.add(ev.id);
          uniqueEvents.push(ev);
        }
      }

      setEvents(uniqueEvents);
    } catch (error) {
      console.error("Failed to load events:", error);
      toast.error("Failed to load events");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      const timer = setTimeout(() => {
        loadEvents();
        checkEventCreationEligibility();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [user]);

  const handleEdit = (event) => {
    setEditingEvent(event);
    setIsCreating(true);
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

  if (isCreating) {
    return (
      <EventCreateStudio
        editingEvent={editingEvent}
        onClose={resetForm}
        onSuccess={async () => {
          resetForm();
          await loadEvents();
          checkEventCreationEligibility();
        }}
      />
    );
  }

  if (isLoading && events.length === 0) {
    return (
      <div className="flex items-center justify-center p-20">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
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
        <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
          {/* Upcoming / Past Tab Pill */}
          <div className="flex items-center rounded-xl bg-[#1A1C1F] border border-[#2A2D31] p-1">
            <button
              type="button"
              onClick={() => setEventTab("upcoming")}
              className={`px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                eventTab === "upcoming"
                  ? "bg-[#212327] text-white shadow-sm"
                  : "text-[#9B9EA4] hover:text-white"
              }`}
            >
              Upcoming
            </button>
            <button
              type="button"
              onClick={() => setEventTab("past")}
              className={`px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                eventTab === "past"
                  ? "bg-[#212327] text-white shadow-sm"
                  : "text-[#9B9EA4] hover:text-white"
              }`}
            >
              Past
            </button>
          </div>

          {!isCreating && (
            <Button
              onClick={() => setIsCreating(true)}
              disabled={!canCreateEvent}
              className="gap-2 h-10 bg-[#FE760B] hover:bg-[#FE760B]/90 text-[#131517] font-semibold text-xs sm:text-sm px-4 rounded-xl shadow-none transition-colors disabled:opacity-50"
            >
              <Plus className="w-4 h-4 text-[#131517]" />
              {canCreateEvent ? "Create event" : "Event limit reached"}
            </Button>
          )}
        </div>
      </div>

      {/* Plan limit reached — upgrade CTA */}
      {!canCreateEvent && user?.role === "organiser" && (
        <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-6">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Zap className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-amber-900">
                You&apos;ve reached your event limit
              </p>
              <p className="text-sm text-amber-700 mt-1">
                {planLimitInfo?.reason ||
                  `Your current plan allows ${PLANS[user?.plan || "free"].eventsAllowed} event(s). Upgrade to create more.`}
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={() => router.push("/pricing")}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#FE760B] text-[#131517] font-semibold font-bold rounded-xl text-sm hover:opacity-90 transition-opacity"
                >
                  <Zap className="w-4 h-4" />
                  Upgrade Plan
                </button>
                <button
                  onClick={() => router.push("/host-event")}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-amber-200 text-amber-700 font-medium rounded-xl text-sm hover:bg-amber-50 transition-colors"
                >
                  Submit Hosting Request
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Timeline View matching Images 1 and 2 */}
      {!isCreating && (() => {
        // Partition real events
        const realUpcoming = events.filter((e) => {
          if (!e.date) return true;
          try {
            const d = e.date?.toDate ? e.date.toDate() : new Date(e.date);
            return d >= new Date(Date.now() - 24 * 60 * 60 * 1000);
          } catch {
            return true;
          }
        });

        const realPast = events.filter((e) => {
          if (!e.date) return false;
          try {
            const d = e.date?.toDate ? e.date.toDate() : new Date(e.date);
            return d < new Date(Date.now() - 24 * 60 * 60 * 1000);
          } catch {
            return false;
          }
        });

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
                  onClick={() => setIsCreating(true)}
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

        return (
          <div className="space-y-6">
            {activeList.map((event, idx) => {
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

              // Status badge
              const isLive = event.status === "live";
              const isDraft = event.status === "draft";
              const isEnded = eventTab === "past" || event.status === "ended";
              const isPublished =
                event.status === "published" || (!isLive && !isDraft && !isEnded);

              return (
                <div
                  key={`mgmt-event-${event.id || idx}`}
                  className="grid grid-cols-1 md:grid-cols-[140px_1fr] gap-4 items-start relative group"
                >
                  {/* Left Column: Date & Day Timeline */}
                  <div className="relative flex md:flex-col items-center md:items-end justify-between md:justify-start pr-4 text-left md:text-right pt-3">
                    <div>
                      <div className="text-base font-bold text-white leading-tight">
                        {datePart || "Upcoming"}
                      </div>
                      <div className="text-xs text-[#9B9EA4] mt-0.5">
                        {dayPart || ""}
                      </div>
                    </div>

                    {/* Timeline dot & vertical connector (Desktop) */}
                    <div className="hidden md:block absolute right-[-5px] top-4 w-2 h-2 rounded-full bg-[#3A3D42] border border-[#131517] z-10" />
                    {idx < activeList.length - 1 && (
                      <div className="hidden md:block absolute right-[-1px] top-6 bottom-[-24px] w-px border-r border-dotted border-[#2A2D31]" />
                    )}
                  </div>

                  {/* Right Event Card (Surface 1) */}
                  <div className="rounded-2xl border border-[#2A2D31] bg-[#1A1C1F] p-3.5 xs:p-4 sm:p-6 shadow-sm hover:border-[#3A3D42] transition-colors flex flex-col md:flex-row items-start justify-between gap-4 sm:gap-5">
                    {/* Event Details Left */}
                    <div className="flex-1 min-w-0 space-y-3">
                      {/* Meta Top Line: Time + Status Badge + Price */}
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="text-xs font-medium text-[#9B9EA4] font-mono">
                          {timePart}
                        </span>

                        {isLive && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FE760B]/14 text-[#FE760B] border border-[#FE760B]/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#FE760B] animate-pulse" />
                            LIVE
                          </span>
                        )}

                        {isPublished && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#3DD68C]/12 text-[#3DD68C] border border-[#3DD68C]/25">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#3DD68C]" />
                            Published
                          </span>
                        )}

                        {isDraft && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/7 text-[#D0D0D1] border border-[#2A2D31]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#D0D0D1]" />
                            Draft
                          </span>
                        )}

                        {isEnded && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/7 text-[#9B9EA4] border border-[#2A2D31]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#9B9EA4]" />
                            Ended
                          </span>
                        )}

                        {/* Price badge */}
                        {(event.price || event.totalTickets) && !isEnded && (
                          <span className="px-2 py-0.5 rounded bg-white/5 border border-white/5 text-xs font-mono text-[#D0D0D1]">
                            {event.price || (event.isPaid ? "Paid" : "Free")}
                          </span>
                        )}
                      </div>

                      {/* Event Title */}
                      <h3 className="text-xl font-bold text-white tracking-tight">
                        {event.name}
                      </h3>

                      {/* Venue / Location */}
                      {event.location && (
                        <div className="flex items-center gap-1.5 text-xs sm:text-sm text-[#9B9EA4]">
                          <MapPin className="w-3.5 h-3.5 text-[#9B9EA4] shrink-0" />
                          <span className="truncate">{event.location}</span>
                        </div>
                      )}

                      {/* Guests / Attendees line */}
                      <div className="flex items-center gap-2 pt-0.5 text-xs sm:text-sm text-[#9B9EA4]">
                        {event.avatars && event.avatars.length > 0 && (
                          <div className="flex -space-x-1.5 overflow-hidden">
                            {event.avatars.map((av, avIdx) => (
                              <div
                                key={avIdx}
                                className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white ring-2 ring-[#1A1C1F] ${av.bg}`}
                              >
                                {av.text}
                              </div>
                            ))}
                          </div>
                        )}
                        <span>
                          {event.attendeeDisplay ||
                            `${event.totalTickets || 100} guests capacity`}
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

                      {/* Actions line */}
                      {/* Actions line */}
                      <div className="flex items-center gap-2.5 pt-2 flex-wrap">
                        {isLive && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                try { localStorage.setItem("admin_selected_event_id", event.id); } catch {}
                                router.push(`/admin/scanner?eventId=${event.id}`);
                              }}
                              className="px-4 py-2 rounded-lg bg-[#FE760B] hover:bg-[#FE760B]/90 text-[#131517] font-semibold text-xs sm:text-sm transition-colors shadow-sm cursor-pointer"
                            >
                              Check In
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                try { localStorage.setItem("admin_selected_event_id", event.id); } catch {}
                                router.push(`/admin/overview?eventId=${event.id}`);
                              }}
                              className="px-4 py-2 rounded-lg bg-[#212327] hover:bg-[#2A2D31] text-white text-xs sm:text-sm font-medium border border-[#2A2D31] transition-colors cursor-pointer"
                            >
                              Manage Event →
                            </button>
                          </>
                        )}

                        {isPublished && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                try { localStorage.setItem("admin_selected_event_id", event.id); } catch {}
                                router.push(`/admin/registrations?eventId=${event.id}`);
                              }}
                              className="px-4 py-2 rounded-lg bg-[#212327] hover:bg-[#2A2D31] text-white text-xs sm:text-sm font-medium border border-[#2A2D31] transition-colors cursor-pointer"
                            >
                              Guests
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                try { localStorage.setItem("admin_selected_event_id", event.id); } catch {}
                                router.push(`/admin/overview?eventId=${event.id}`);
                              }}
                              className="px-4 py-2 rounded-lg bg-[#212327] hover:bg-[#2A2D31] text-white text-xs sm:text-sm font-medium border border-[#2A2D31] transition-colors cursor-pointer"
                            >
                              Manage Event →
                            </button>
                          </>
                        )}

                        {isDraft && (
                          <>
                            <div className="h-8 w-24 rounded-lg bg-[#212327] border border-[#2A2D31] flex items-center justify-center text-xs text-[#9B9EA4]">
                              Preview
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                toast.success(`Publishing ${event.name}`);
                              }}
                              className="px-4 py-2 rounded-lg bg-[#212327] hover:bg-[#2A2D31] text-white text-xs sm:text-sm font-medium border border-[#2A2D31] transition-colors"
                            >
                              Publish
                            </button>
                          </>
                        )}

                        {isEnded && (
                          <>
                            <button
                              type="button"
                              onClick={() => router.push("/admin/analytics")}
                              className="px-4 py-2 rounded-lg bg-[#212327] hover:bg-[#2A2D31] text-white text-xs sm:text-sm font-medium border border-[#2A2D31] transition-colors"
                            >
                              View insights
                            </button>
                            <button
                              type="button"
                              onClick={() => router.push("/admin/registrations")}
                              className="px-4 py-2 rounded-lg bg-[#212327] hover:bg-[#2A2D31] text-white text-xs sm:text-sm font-medium border border-[#2A2D31] transition-colors"
                            >
                              Guest list
                            </button>
                          </>
                        )}

                        {/* Optional quick edit/delete buttons for real events */}
                        <div className="flex items-center gap-1.5 ml-auto">
                          <button
                            type="button"
                            onClick={() => setSubEventModalTarget(event)}
                            title="Manage tracks"
                            className="p-2 rounded-lg bg-[#212327] hover:bg-[#2A2D31] text-[#9B9EA4] hover:text-white border border-[#2A2D31]"
                          >
                            <Layers className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEdit(event)}
                            title="Edit"
                            className="p-2 rounded-lg bg-[#212327] hover:bg-[#2A2D31] text-[#9B9EA4] hover:text-white border border-[#2A2D31]"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(event.id)}
                            title="Delete"
                            className="p-2 rounded-lg bg-[#212327] hover:bg-[#FF6B6B]/10 text-[#9B9EA4] hover:text-[#FF6B6B] border border-[#2A2D31]"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Right Artwork Poster */}
                    <EventPoster
                      event={event}
                      className="w-28 h-28 sm:w-32 sm:h-32 self-center md:self-start"
                    />
                  </div>
                </div>
              );
            })}
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
