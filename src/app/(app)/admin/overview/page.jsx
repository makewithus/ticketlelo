"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Users,
  Send,
  Share2,
  Calendar,
  MapPin,
  Copy,
  Check,
  CheckCircle2,
  ExternalLink,
  QrCode,
  Sparkles,
  Loader2,
  ChevronDown,
  Plus,
  ArrowUpRight,
  Clock,
} from "lucide-react";
import { EventControlHeader } from "@/components/admin/event-control-header";
import { useAuth } from "@/context/auth-context";
import {
  getEventsByOrganiser,
  getAllEvents,
  subscribeToEvent,
  subscribeToEventRegistrations,
  updateEvent,
} from "@/lib/firestore";
import { getThemeLook, getPosterLines } from "@/lib/theme-utils";

const THEMES = [
  { id: "sunset", name: "Sunset", color: "#FE760B", bg: "#FE760B", sun: "#FB923C", text: "#131517" },
  { id: "sunny", name: "Sunny", color: "#FDE003", bg: "#FE760B", sun: "#FDE003", text: "#131517" },
  { id: "electric", name: "Electric", color: "#2B59FF", bg: "#1D4ED8", sun: "#38BDF8", text: "#FFFFFF" },
  { id: "neon", name: "Neon", color: "#EC4899", bg: "#BE185D", sun: "#F43F5E", text: "#FFFFFF" },
  { id: "mint", name: "Mint", color: "#10B981", bg: "#047857", sun: "#34D399", text: "#FFFFFF" },
];

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

export default function EventOverviewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [event, setEvent] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showEventDropdown, setShowEventDropdown] = useState(false);
  const [isUpdatingLive, setIsUpdatingLive] = useState(false);

  // 1. Initial Load: Fetch organiser events from Firestore
  useEffect(() => {
    let isMounted = true;
    const loadEvents = async () => {
      if (!user) return;
      try {
        setLoading(true);
        let list = [];
        if (user.role === "superAdmin") {
          list = await getAllEvents();
        } else {
          list = await getEventsByOrganiser(user.id);
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

        // Determine which event to select:
        // Priority 1: query param ?eventId=...
        // Priority 2: localStorage admin_selected_event_id
        // Priority 3: first event in list
        const paramId = searchParams.get("eventId");
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
        }
      } catch (err) {
        console.error("Failed to load events for overview:", err);
        toast.error("Could not load events from database");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadEvents();
    return () => {
      isMounted = false;
    };
  }, [user, searchParams]);

  // 2. Real-time Subscription to the selected event document
  useEffect(() => {
    if (!selectedEventId) {
      setEvent(null);
      return;
    }

    const unsubscribeEvent = subscribeToEvent(selectedEventId, (updatedEvent) => {
      if (updatedEvent) {
        setEvent(updatedEvent);
      }
    });

    return () => {
      if (typeof unsubscribeEvent === "function") unsubscribeEvent();
    };
  }, [selectedEventId]);

  // 3. Real-time Subscription to registrations for this event
  useEffect(() => {
    if (!selectedEventId) {
      setRegistrations([]);
      return;
    }

    const unsubscribeRegs = subscribeToEventRegistrations(
      selectedEventId,
      (liveRegistrations) => {
        // Sort registrations by createdAt descending
        const sorted = [...liveRegistrations].sort((a, b) => {
          const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
          const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
          return timeB - timeA;
        });
        setRegistrations(sorted);
      }
    );

    return () => {
      if (typeof unsubscribeRegs === "function") unsubscribeRegs();
    };
  }, [selectedEventId]);

  // Handle switching active event
  const handleSelectEvent = (id) => {
    setSelectedEventId(id);
    setShowEventDropdown(false);
    try {
      localStorage.setItem("admin_selected_event_id", id);
    } catch {}
    router.replace(`/admin/overview?eventId=${id}`);
  };

  // Real-time calculations from Firestore data
  const totalGuests = registrations.length;
  const checkedInCount = useMemo(() => {
    return registrations.filter(
      (r) =>
        r.status === "Used" ||
        r.status === "used" ||
        r.status === "checked-in" ||
        r.checkedIn === true
    ).length;
  }, [registrations]);

  const notYetCount = Math.max(0, totalGuests - checkedInCount);
  const totalCapacity = parseInt(event?.capacity || event?.totalTickets || 150, 10);
  const seatsLeft = Math.max(0, totalCapacity - totalGuests);

  // Status toggle: live vs draft
  const isLive =
    event?.status === "live" ||
    (event?.isActive !== false && event?.status !== "draft");

  const handleToggleLive = async () => {
    if (!event?.id || isUpdatingLive) return;
    const nextState = !isLive;
    setIsUpdatingLive(true);
    try {
      await updateEvent(event.id, {
        status: nextState ? "live" : "draft",
        isActive: nextState,
        published: nextState,
      });
      toast.success(
        nextState
          ? "Event is now LIVE — visible to the public!"
          : "Event is now unlisted / draft."
      );
    } catch (err) {
      console.error("Failed to update event live status:", err);
      toast.error("Failed to change event visibility");
    } finally {
      setIsUpdatingLive(false);
    }
  };

  // Public URL
  const publicSlug = event?.slug || event?.id || "event";
  const publicUrl = `ticketlelo.in/register/${publicSlug}`;
  const fullPublicUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/register/${publicSlug}`
      : `https://${publicUrl}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(fullPublicUrl);
    setCopied(true);
    toast.success("Event registration link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  // Theme & Poster Typography
  const selectedTheme = getThemeLook(event?.themeColor || event?.theme || "#FE760B");

  const posterLines = getPosterLines(
    event?.name || "Event Name",
    event?.posterTextMode || "auto",
    event?.posterLine1,
    event?.posterLine2
  );

  // Parse formatted date and time
  const dateInfo = useMemo(() => {
    if (!event) return { month: "OCT", day: "29", dayName: "Today", timeRange: "12:00 PM – 5:00 PM GMT+5:30" };
    let month = "TBA";
    let day = "—";
    let dayName = "Upcoming";

    try {
      const rawDate = event.date?.toDate
        ? event.date.toDate()
        : event.startDate
        ? new Date(event.startDate)
        : null;

      if (rawDate && !isNaN(rawDate.getTime())) {
        month = rawDate.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
        day = String(rawDate.getDate()).padStart(2, "0");
        const todayStr = new Date().toDateString();
        dayName =
          rawDate.toDateString() === todayStr
            ? "Today"
            : rawDate.toLocaleDateString("en-US", { weekday: "long" });
      }
    } catch {}

    const startTime = event.startTime || "12:00 PM";
    const endTime = event.endTime || "5:00 PM";
    const tz = event.timezone || "GMT+5:30";
    const timeRange = `${startTime} – ${endTime} ${tz}`;

    return { month, day, dayName, timeRange };
  }, [event]);

  if (loading && !event) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-white min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#FE760B] mb-3" />
        <p className="text-xs text-[#9B9EA4] font-medium">Loading event data in real time...</p>
      </div>
    );
  }

  // If no events found in database for this user
  if (!loading && (!event || events.length === 0)) {
    return (
      <div className="py-8 sm:py-12 px-4 max-w-4xl mx-auto w-full text-white text-center">
        <EventControlHeader activeTab="Overview" eventTitle="No Events Found" isLive={false} />
        <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-3xl p-10 sm:p-14 max-w-lg mx-auto shadow-xl">
          <div className="w-14 h-14 rounded-2xl bg-[#FE760B]/10 border border-[#FE760B]/20 flex items-center justify-center text-[#FE760B] mx-auto mb-4">
            <Calendar className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">No Events Created Yet</h2>
          <p className="text-xs text-[#9B9EA4] leading-relaxed mb-6">
            You don&apos;t have any active events in the database. Create your first event to start accepting registrations and tracking live check-ins.
          </p>
          <Link
            href="/admin/create-event"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#FE760B] hover:bg-[#FE760B]/90 text-[#131517] font-bold text-sm transition-all shadow-lg"
          >
            <Plus className="w-4 h-4" />
            <span>Create First Event</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="py-4 sm:py-6 px-3 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full text-white selection:bg-[#FE760B] selection:text-white pb-16">
      {/* ── Standard Navigation Header with Live Event Switcher ── */}
      <EventControlHeader
        activeTab="Overview"
        eventTitle={event.name}
        eventSlug={event.slug || event.id}
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
                          ev.id === selectedEventId ? "bg-[#FE760B]/10 text-[#FE760B] font-bold" : "text-white"
                        }`}
                      >
                        <span className="truncate">{ev.name}</span>
                        {ev.id === selectedEventId && <Check className="w-3.5 h-3.5 shrink-0" />}
                      </button>
                    ))}
                  </div>
                  <div className="p-2">
                    <Link
                      href="/admin/create-event"
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#212327] hover:bg-[#2A2D31] text-xs font-medium text-white transition-colors"
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

      {/* ── 3 Quick Action Cards matching Image 3 with Real DB Counts ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-6">
        {/* Card 1: Guests */}
        <Link
          href={`/admin/registrations?eventId=${event.id}`}
          className="bg-[#1A1C1F] hover:bg-[#212327] border border-[#2A2D31] hover:border-[#3A3D42] rounded-2xl p-4 flex items-center gap-3.5 transition-all group shadow-sm"
        >
          <div className="w-10 h-10 rounded-xl bg-[#212327] group-hover:bg-[#2A2D31] border border-[#2A2D31] flex items-center justify-center text-[#9B9EA4] group-hover:text-white transition-colors">
            <Users size={18} className="text-[#7AA2FF]" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white group-hover:text-[#FE760B] transition-colors">
              Guests
            </h3>
            <p className="text-[11px] text-[#9B9EA4]">
              {totalGuests} registered {totalCapacity ? `(of ${totalCapacity})` : ""}
            </p>
          </div>
        </Link>

        {/* Card 2: Send a blast */}
        <Link
          href={`/admin/messages?eventId=${event.id}`}
          className="bg-[#1A1C1F] hover:bg-[#212327] border border-[#2A2D31] hover:border-[#3A3D42] rounded-2xl p-4 flex items-center gap-3.5 transition-all group shadow-sm"
        >
          <div className="w-10 h-10 rounded-xl bg-[#2A1D13] border border-[#FE760B]/20 flex items-center justify-center text-[#FE760B] transition-colors">
            <Send size={17} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white group-hover:text-[#FE760B] transition-colors">
              Send a blast
            </h3>
            <p className="text-[11px] text-[#9B9EA4]">
              Email {totalGuests} {totalGuests === 1 ? "attendee" : "attendees"}
            </p>
          </div>
        </Link>

        {/* Card 3: Share event */}
        <button
          type="button"
          onClick={handleCopyLink}
          className="bg-[#1A1C1F] hover:bg-[#212327] border border-[#2A2D31] hover:border-[#3A3D42] rounded-2xl p-4 flex items-center gap-3.5 transition-all group text-left shadow-sm cursor-pointer"
        >
          <div className="w-10 h-10 rounded-xl bg-[#271B2B] border border-purple-500/20 flex items-center justify-center text-purple-400 transition-colors">
            <Share2 size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white group-hover:text-[#FE760B] transition-colors">
              Share event
            </h3>
            <p className="text-[11px] text-[#9B9EA4]">
              {copied ? "Copied to clipboard!" : "Copy public link"}
            </p>
          </div>
        </button>
      </div>

      {/* ── Main Event Feature Card matching Image 3 with Real DB Data & Poster ── */}
      <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-5 sm:p-6 mb-6 shadow-xl">
        <div className="grid grid-cols-1 md:grid-cols-[210px_1fr] gap-6 items-center">
          {/* Poster Preview: Either custom cover image OR procedural theme poster with user typography */}
          <div className="w-full max-w-[210px] aspect-[4/3] sm:aspect-[3/4] rounded-2xl overflow-hidden relative shadow-lg border border-[#2A2D31] mx-auto md:mx-0 select-none">
            {event.coverImage || event.bannerUrl ? (
              <img
                src={event.coverImage || event.bannerUrl}
                alt={event.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                className="w-full h-full relative flex flex-col justify-between p-4 overflow-hidden"
                style={{
                  background: selectedTheme.gradientCss || selectedTheme.bg,
                }}
              >
                {/* Sun quarter circle */}
                <div
                  className="w-32 h-32 rounded-full absolute -top-8 -right-8 pointer-events-none opacity-90 transition-colors"
                  style={{ backgroundColor: selectedTheme.sun }}
                />
                {/* Grid overlay */}
                <div
                  className="absolute inset-0 pointer-events-none opacity-20"
                  style={{
                    backgroundImage:
                      "linear-gradient(#000 1.5px, transparent 1.5px), linear-gradient(90deg, #000 1.5px, transparent 1.5px)",
                    backgroundSize: "16px 16px",
                  }}
                />
                <div className="relative z-10" />
                <div
                  className="relative z-10 w-full"
                  style={{ textAlign: event.posterAlign || "left" }}
                >
                  <span
                    className="block font-black leading-[0.92] tracking-tight uppercase break-words"
                    style={{
                      color:
                        event.posterTextColor === "dark"
                          ? "#131517"
                          : event.posterTextColor === "light"
                          ? "#FFFFFF"
                          : selectedTheme.text,
                      fontSize: `${Math.min(30, event.posterFontSize || 26)}px`,
                    }}
                  >
                    {posterLines.line1}
                  </span>
                  {posterLines.line2 && (
                    <span
                      className="block font-black leading-[0.92] tracking-tight uppercase mt-1 break-words"
                      style={{
                        color:
                          event.posterTextColor === "dark"
                            ? "#131517"
                            : event.posterTextColor === "light"
                            ? "#FFFFFF"
                            : selectedTheme.text,
                        fontSize: `${Math.min(
                          24,
                          Math.round((event.posterFontSize || 26) * 0.88)
                        )}px`,
                      }}
                    >
                      {posterLines.line2}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Details & Actions from DB */}
          <div className="space-y-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#9B9EA4] mb-2">
                WHEN &amp; WHERE
              </p>

              {/* Real Date */}
              <div className="flex items-center gap-3 mb-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#212327] border border-[#2A2D31] flex flex-col items-center justify-center text-center shrink-0">
                  <span className="text-[8px] font-extrabold uppercase text-[#FE760B] leading-none">
                    {dateInfo.month}
                  </span>
                  <span className="text-xs font-bold text-white leading-tight">
                    {dateInfo.day}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-bold text-white leading-snug">
                    {dateInfo.dayName}
                  </p>
                  <p className="text-[11px] text-[#9B9EA4] font-mono">
                    {dateInfo.timeRange}
                  </p>
                </div>
              </div>

              {/* Real Location */}
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#212327] border border-[#2A2D31] flex items-center justify-center text-[#9B9EA4] shrink-0">
                  <MapPin size={16} />
                </div>
                <div>
                  <p className="text-xs font-bold text-white leading-snug">
                    {event.location || "Virtual / Online Event"}
                  </p>
                  <p className="text-[11px] text-[#9B9EA4]">
                    {event.locationType === "virtual"
                      ? "Online Web Stream / Meeting"
                      : event.timezoneCity
                      ? `${event.timezoneCity}, India`
                      : "Main Campus Venue"}
                  </p>
                </div>
              </div>
            </div>

            {/* Public Link Box with Copy Button */}
            <div className="flex items-center gap-2 bg-[#212327] border border-[#2A2D31] rounded-xl px-3 py-2">
              <input
                type="text"
                readOnly
                value={publicUrl}
                className="bg-transparent border-none text-xs text-[#D0D0D1] flex-1 outline-none font-mono select-all"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className="px-3 py-1 rounded-lg bg-[#2A2D31] hover:bg-[#34383E] text-white text-xs font-semibold transition-colors shrink-0 cursor-pointer"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2.5 flex-wrap pt-1">
              <Link
                href={`/admin/scanner?eventId=${event.id}`}
                className="px-4 py-2 rounded-xl bg-[#FE760B] hover:bg-[#FE760B]/90 text-[#131517] font-bold text-xs sm:text-sm transition-all shadow-sm inline-flex items-center gap-1.5"
              >
                <QrCode className="w-4 h-4 text-[#131517]" />
                <span>Check in guests</span>
              </Link>
              <Link
                href={`/admin/create-event?eventId=${event.id}`}
                className="px-4 py-2 rounded-xl bg-[#212327] hover:bg-[#2A2D31] border border-[#2A2D31] text-white font-medium text-xs sm:text-sm transition-colors"
              >
                Edit event
              </Link>
              <Link
                href={`/admin/customize?eventId=${event.id}`}
                className="px-4 py-2 rounded-xl bg-[#212327] hover:bg-[#2A2D31] border border-[#2A2D31] text-white font-medium text-xs sm:text-sm transition-colors"
              >
                Change banner
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── Status Banner matching Image 3 with Real Firestore Live Toggle ── */}
      <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4 mb-8 shadow-sm">
        <div className="flex items-center gap-3">
          <span
            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
              isLive ? "bg-[#3DD68C] animate-pulse" : "bg-[#9B9EA4]"
            }`}
          />
          <div>
            <p className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
              <span>Event is {isLive ? "live — visible to the public" : "unlisted / draft mode"}</span>
              {isUpdatingLive && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#FE760B]" />}
            </p>
            <p className="text-[11px] text-[#9B9EA4] mt-0.5">
              {isLive
                ? "Guests can discover your event and register for tickets online."
                : "Event is hidden from public view. Only organizers can access it."}
            </p>
          </div>
        </div>

        {/* Real-time Toggle switch */}
        <button
          type="button"
          disabled={isUpdatingLive}
          onClick={handleToggleLive}
          className={`w-12 h-6 rounded-full transition-colors relative p-0.5 shrink-0 cursor-pointer disabled:opacity-50 ${
            isLive ? "bg-[#FE760B]" : "bg-[#2A2D31]"
          }`}
          aria-label="Toggle event live visibility"
        >
          <div
            className={`w-5 h-5 rounded-full bg-white transition-transform ${
              isLive ? "translate-x-6" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {/* ── At a Glance matching Image 3 with Real Firestore Numbers ── */}
      <div className="mb-8">
        <h2 className="text-base font-bold text-white mb-2">At a glance</h2>
        <div className="flex items-baseline justify-between mb-2">
          <p className="text-2xl font-black text-[#3DD68C] tracking-tight">
            {totalGuests}{" "}
            <span className="text-xs font-semibold text-[#9B9EA4]">guests</span>
          </p>
          <span className="text-xs text-[#9B9EA4] font-medium font-mono">
            cap {totalCapacity}
          </span>
        </div>

        {/* Multi-segment Progress Bar from Real DB values */}
        <div className="w-full h-2 rounded-full bg-[#2A2D31] overflow-hidden flex mb-2.5">
          <div
            className="h-full bg-[#3DD68C] transition-all duration-500"
            style={{ width: `${Math.min(100, (checkedInCount / Math.max(1, totalCapacity)) * 100)}%` }}
            title={`${checkedInCount} checked in`}
          />
          <div
            className="h-full bg-[#FE760B] transition-all duration-500"
            style={{ width: `${Math.min(100, (notYetCount / Math.max(1, totalCapacity)) * 100)}%` }}
            title={`${notYetCount} not yet checked in`}
          />
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs font-medium text-[#9B9EA4] flex-wrap">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3DD68C]" />
            <strong className="text-white">{checkedInCount}</strong> checked in
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FE760B]" />
            <strong className="text-white">{notYetCount}</strong> not yet
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#9B9EA4]" />
            <strong className="text-white">{seatsLeft}</strong> seats left
          </span>
        </div>
      </div>

      {/* ── Recent Registrations matching Image 3 with Real Firestore Database Data ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-white">Recent registrations</h2>
            <span className="text-xs bg-white/10 text-[#D0D0D1] px-2 py-0.5 rounded-full font-mono font-semibold">
              {registrations.length}
            </span>
          </div>
          <Link
            href={`/admin/registrations?eventId=${event.id}`}
            className="text-xs font-semibold text-[#FE760B] hover:underline transition-colors"
          >
            View all ({registrations.length})
          </Link>
        </div>

        {registrations.length === 0 ? (
          <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-8 text-center shadow-sm">
            <Users className="w-8 h-8 text-[#9B9EA4] mx-auto mb-2.5 opacity-60" />
            <h3 className="text-sm font-bold text-white mb-1">No Registrations Yet</h3>
            <p className="text-xs text-[#9B9EA4] max-w-sm mx-auto mb-4">
              When guests register for &ldquo;{event.name}&rdquo;, their ticket details and check-in status will appear here in real time.
            </p>
            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#212327] hover:bg-[#2A2D31] text-xs font-semibold text-white border border-[#2A2D31] transition-colors cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5 text-[#FE760B]" />
              <span>Copy Registration Link</span>
            </button>
          </div>
        ) : (
          <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl divide-y divide-[#2A2D31] overflow-hidden shadow-sm">
            {registrations.slice(0, 10).map((guest) => {
              const guestName = guest.fullName || guest.name || guest.attendeeName || "Guest Attendee";
              const guestEmail = guest.email || guest.whatsappPhone || "No email";
              const isCheckedIn =
                guest.status === "Used" ||
                guest.status === "used" ||
                guest.status === "checked-in" ||
                guest.checkedIn === true;
              const isPending = guest.status === "pending" || guest.paymentStatus === "pending";
              const initials = getInitials(guestName);
              const avatarBg = getAvatarColor(guestName);
              const timeDisplay = formatRelativeTime(guest.createdAt);

              return (
                <div
                  key={guest.id}
                  className="p-4 flex items-center justify-between gap-3 hover:bg-[#212327]/40 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-full ${avatarBg} text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm`}
                    >
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-white truncate">
                        {guestName}
                      </p>
                      <p className="text-[11px] text-[#9B9EA4] truncate font-mono">
                        {guestEmail}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                    {isCheckedIn ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#183124] text-[#3DD68C] border border-[#3DD68C]/30 text-[11px] font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#3DD68C]" />
                        Checked In
                      </span>
                    ) : isPending ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#2C2614] text-[#FDE003] border border-[#FDE003]/30 text-[11px] font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#FDE003]" />
                        Payment pending
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#192738] text-[#7AA2FF] border border-[#7AA2FF]/30 text-[11px] font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#7AA2FF]" />
                        Going
                      </span>
                    )}

                    <span className="text-[11px] text-[#9B9EA4] font-mono w-9 text-right">
                      {timeDisplay}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
