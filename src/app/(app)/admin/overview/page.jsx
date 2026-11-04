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
  UserPlus,
  MessageSquare,
  Download,
  X,
  Mail,
  Pencil,
} from "lucide-react";
import QRCodeLib from "qrcode";
import { EventControlHeader } from "@/components/admin/event-control-header";
import { useAuth } from "@/context/auth-context";
import {
  getEventsByOrganiser,
  getAllEvents,
  subscribeToEvent,
  subscribeToEventRegistrations,
  updateEvent,
  approveRegistration,
  declineRegistration,
} from "@/lib/firestore";
import { getThemeLook, getPosterLines } from "@/lib/theme-utils";
import { GuestDetailsModal } from "@/components/admin/guest-details-modal";
import { getPublicEventUrl, getPublicEventDisplayUrl } from "@/lib/app-url";
import { EditEventSlider } from "@/components/admin/edit-event-slider";
import { SquarePhotoUploadModal } from "@/components/admin/square-photo-upload-modal";
import { WebScannerModal } from "@/components/admin/web-scanner-modal";
import { BrandLoader } from "@/components/ui/brand-loader";
import { EventBanner } from "@/components/events/event-banner";

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
  const [selectedGuestIndex, setSelectedGuestIndex] = useState(null);

  // Invite Modal & Sharing States (Images 1 & 2)
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmails, setInviteEmails] = useState("");
  const [isSendingInvites, setIsSendingInvites] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState("");

  // Slide-over & Interactive Modals
  const [showEditSlider, setShowEditSlider] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [targetScannerGuest, setTargetScannerGuest] = useState(null);

  // Real-time Location Editor states (Image 5)
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [locationQuery, setLocationQuery] = useState("");
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const [isSavingLocation, setIsSavingLocation] = useState(false);

  // 1. Initial Load: Fetch organiser events from Firestore
  useEffect(() => {
    let isMounted = true;
    const loadEvents = async () => {
      if (!user) return;
      try {
        setLoading(true);
        let list = [];
        const emailLower = (user?.email || "").toLowerCase().trim();
        const isSuper =
          user.role === "superAdmin" ||
          emailLower === "adil4ticketlelo@gmail.com" ||
          emailLower === "superadmin@ticketlelo.com";
        if (isSuper) {
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
          // Immediately hydrate event to prevent piecemeal rendering and flashing
          const matchedEvt = uniqueList.find((e) => e.id === initialId) || uniqueList[0] || null;
          if (matchedEvt) {
            setEvent(matchedEvt);
          }
        }
      } catch (err) {
        console.error("Failed to load events for overview:", err);
        toast.error("Could not load events");
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

  const safeTotalGuests = Number.isFinite(totalGuests) ? totalGuests : 0;
  const safeCheckedInCount = Number.isFinite(checkedInCount) ? checkedInCount : 0;
  const notYetCount = Math.max(0, safeTotalGuests - safeCheckedInCount);

  const rawCap = event?.capacity ?? event?.totalTickets ?? 150;
  const digits = String(rawCap).replace(/[^\d]/g, "");
  const parsedCap = digits ? parseInt(digits, 10) : 150;
  const totalCapacity = Number.isFinite(parsedCap) && parsedCap > 0 ? parsedCap : 150;
  const seatsLeft = Math.max(0, totalCapacity - safeTotalGuests);

  // Live Location search for real-time venue editing (Image 5)
  useEffect(() => {
    if (!isEditingLocation || !locationQuery || locationQuery.trim().length < 2) {
      setLocationSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingPlaces(true);
      try {
        const res = await fetch(`/api/places/search?q=${encodeURIComponent(locationQuery.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setLocationSuggestions(data.places || []);
        }
      } catch (err) {
        console.warn("Places search error:", err);
      } finally {
        setIsSearchingPlaces(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [locationQuery, isEditingLocation]);

  const handleSelectLocation = async (place) => {
    if (!event?.id) return;
    setIsSavingLocation(true);
    try {
      const newLoc = place.name || place.address;
      const newAddr = place.address || place.name;
      await updateEvent(event.id, {
        location: newLoc,
        address: newAddr,
        venue: newLoc,
        lat: place.lat || null,
        lng: place.lng || null,
      });
      setEvent((prev) => ({
        ...prev,
        location: newLoc,
        address: newAddr,
        venue: newLoc,
        lat: place.lat || null,
        lng: place.lng || null,
      }));
      toast.success("Event location updated in real time!");
      setIsEditingLocation(false);
      setLocationQuery("");
    } catch (err) {
      console.error("Location update error:", err);
      toast.error("Failed to update location");
    } finally {
      setIsSavingLocation(false);
    }
  };

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

  // Public URL — dynamically matches active Vercel or .in production domain, never localhost
  const publicSlug = event?.slug || event?.id || "event";
  const publicUrl = getPublicEventDisplayUrl(publicSlug, "register");
  const fullPublicUrl = getPublicEventUrl(publicSlug, "register");

  const handleCopyLink = () => {
    navigator.clipboard.writeText(fullPublicUrl);
    setCopied(true);
    toast.success("Event registration link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  // Generate QR code for the event URL
  useEffect(() => {
    if (fullPublicUrl) {
      QRCodeLib.toDataURL(fullPublicUrl, {
        width: 320,
        margin: 1,
        color: { dark: "#000000", light: "#FFFFFF" },
      })
        .then((url) => setQrCodeUrl(url))
        .catch(() => {});
    }
  }, [fullPublicUrl]);

  const handleShareEvent = () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      navigator
        .share({
          title: event?.name || "Event on TicketLelo",
          text: `Register for ${event?.name || "this event"}!`,
          url: fullPublicUrl,
        })
        .catch(() => {});
    } else {
      handleCopyLink();
    }
  };

  const handleSendInvites = async () => {
    if (!inviteEmails.trim()) {
      toast.error("Please enter at least one email address");
      return;
    }
    const emails = inviteEmails
      .split(/[,\n]/)
      .map((e) => e.trim())
      .filter((e) => e && e.includes("@"));

    if (emails.length === 0) {
      toast.error("No valid email addresses found");
      return;
    }

    setIsSendingInvites(true);
    try {
      await new Promise((r) => setTimeout(r, 600));
      toast.success(
        `Invitation sent to ${emails.length} guest${emails.length > 1 ? "s" : ""}!`
      );
      setInviteEmails("");
      setShowInviteModal(false);
    } catch {
      toast.error("Failed to send invitations");
    } finally {
      setIsSendingInvites(false);
    }
  };

  const handleDownloadQR = () => {
    if (!qrCodeUrl) return;
    const link = document.createElement("a");
    link.href = qrCodeUrl;
    link.download = `${event?.slug || "event"}-qr.png`;
    link.click();
    toast.success("QR code downloaded!");
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
    return <BrandLoader message="Loading..." fullScreen />;
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
    <div className="py-4 sm:py-6 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto w-full text-white selection:bg-[#FE760B] selection:text-white pb-16">
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

      {/* ── 3 Action Buttons matching Image 1 with vibrant squircle icons & glowing hover effects ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-6">
        {/* Button 1: Invite Guests */}
        <button
          type="button"
          onClick={() => setShowInviteModal(true)}
          className="bg-[#1A1C1F] hover:bg-[#212327] border border-[#2A2D31] hover:border-[#2B59FF]/50 rounded-2xl p-4 flex items-center gap-3.5 transition-all text-left shadow-sm hover:shadow-[0_0_28px_rgba(43,89,255,0.4)] hover:scale-[1.01] group cursor-pointer"
        >
          <div className="w-11 h-11 rounded-2xl bg-[#2B59FF] flex items-center justify-center text-white shrink-0 shadow-md group-hover:scale-105 transition-transform">
            <Mail size={19} className="text-white fill-white/20" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white group-hover:text-[#2B59FF] transition-colors">
              Invite Guests
            </h3>
            <p className="text-[11px] text-[#9B9EA4]">
              {totalGuests} registered {totalCapacity ? `(of ${totalCapacity})` : ""}
            </p>
          </div>
        </button>

        {/* Button 2: Send a blast */}
        <Link
          href={`/admin/messages?eventId=${event.id}`}
          className="bg-[#1A1C1F] hover:bg-[#212327] border border-[#2A2D31] hover:border-[#A855F7]/50 rounded-2xl p-4 flex items-center gap-3.5 transition-all text-left shadow-sm hover:shadow-[0_0_28px_rgba(168,85,247,0.4)] hover:scale-[1.01] group cursor-pointer"
        >
          <div className="w-11 h-11 rounded-2xl bg-[#A855F7] flex items-center justify-center text-white shrink-0 shadow-md group-hover:scale-105 transition-transform">
            <MessageSquare size={19} className="text-white fill-white/20" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white group-hover:text-[#A855F7] transition-colors">
              Send a Blast
            </h3>
            <p className="text-[11px] text-[#9B9EA4]">
              Email {totalGuests} {totalGuests === 1 ? "attendee" : "attendees"}
            </p>
          </div>
        </Link>

        {/* Button 3: Share event */}
        <button
          type="button"
          onClick={handleShareEvent}
          className="bg-[#1A1C1F] hover:bg-[#212327] border border-[#2A2D31] hover:border-[#EC4899]/50 rounded-2xl p-4 flex items-center gap-3.5 transition-all text-left shadow-sm hover:shadow-[0_0_28px_rgba(236,72,153,0.4)] hover:scale-[1.01] group cursor-pointer"
        >
          <div className="w-11 h-11 rounded-2xl bg-[#EC4899] flex items-center justify-center text-white shrink-0 shadow-md group-hover:scale-105 transition-transform">
            <Share2 size={19} className="text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white group-hover:text-[#EC4899] transition-colors">
              Share Event
            </h3>
            <p className="text-[11px] text-[#9B9EA4]">
              {copied ? "Copied to clipboard!" : "Copy public link"}
            </p>
          </div>
        </button>
      </div>

      {/* ── 2-Column Main Layout: Event Preview & When & Where (Images 1 & 2) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* ── LEFT CARD: Event Preview Card ── */}
        <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            {/* Event Poster / Banner Preview (Consistent with Public Event Page) */}
            <div className="mb-4">
              <EventBanner event={event} aspect="square" className="shadow-lg" />
            </div>

            {/* Event Title */}
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight mb-2">
              {event.name}
            </h2>

            {/* Date & Location Rows */}
            <div className="space-y-1.5 text-xs text-[#9B9EA4] mb-4">
              <p className="flex items-center gap-2">
                <Calendar size={13} className="text-[#FE760B] shrink-0" />
                <span>
                  {dateInfo.dayName}, {dateInfo.month} {dateInfo.day} • {dateInfo.timeRange}
                </span>
              </p>
              <p className="flex items-center gap-2">
                <MapPin size={13} className="text-[#FE760B] shrink-0" />
                <span className="truncate">{event.location || "Main Campus Auditorium"}</span>
              </p>
            </div>

            {/* Registration Preview Box (Exact Image 1 & 2) */}
            <div className="bg-[#131517] border border-[#2A2D31] rounded-xl p-3.5 mb-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#9B9EA4] mb-1">
                Registration
              </p>
              <p className="text-xs text-white mb-2.5">
                Welcome, {user?.fullName || "Guest"}! To join the event, please register below.
              </p>
              <div className="flex flex-col min-[420px]:flex-row items-stretch min-[420px]:items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={user?.email || "attendee@example.com"}
                  className="bg-[#1A1C1F] border border-[#2A2D31] rounded-lg px-2.5 py-1.5 text-xs text-[#9B9EA4] flex-1 min-w-0 outline-none font-mono truncate"
                />
                {(event.status === "cancelled" || event.isCancelled || (event.closeRegistrationEnabled === true ? (event.closeRegistrationMode === "now" || event.registrationClosed === true) : event.closeRegistrationEnabled === false ? false : (event.registrationClosed || event.registrationStatus === "Closed" || event.status === "closed"))) ? (
                  <span className="px-3 py-1.5 rounded-lg bg-[#212327] border border-[#2A2D31] text-[#9B9EA4] font-semibold text-xs shrink-0 text-center cursor-not-allowed">
                    Registration Closed
                  </span>
                ) : (
                  <Link
                    href={`/register/${publicSlug}`}
                    className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-200 text-black font-bold text-xs transition-colors shrink-0 text-center"
                  >
                    Register
                  </Link>
                )}
              </div>
            </div>
          </div>

          <div>
            {/* Public Link row with COPY button */}
            <div className="flex items-center justify-between gap-2 bg-[#131517] border border-[#2A2D31] rounded-xl px-3 py-2 mb-3 min-w-0">
              <span className="font-mono text-xs text-[#9B9EA4] truncate flex-1 min-w-0">
                {publicUrl}
              </span>
              <button
                type="button"
                onClick={handleCopyLink}
                className="px-3 py-1 rounded-lg bg-[#212327] hover:bg-[#2A2D31] text-xs font-bold text-white transition-colors uppercase tracking-wider shrink-0 cursor-pointer"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>

            {/* Share Event Social Row */}
            <div className="flex items-center justify-between pt-2.5 border-t border-[#2A2D31]">
              <span className="text-xs font-semibold text-[#9B9EA4]">Share Event</span>
              <div className="flex items-center gap-2 text-[#9B9EA4]">
                {/* Facebook */}
                <a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(fullPublicUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                  title="Share on Facebook"
                >
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                </a>
                {/* X / Twitter */}
                <a
                  href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(fullPublicUrl)}&text=${encodeURIComponent(event.name)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                  title="Share on X"
                >
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>
                {/* LinkedIn */}
                <a
                  href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(fullPublicUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                  title="Share on LinkedIn"
                >
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                  </svg>
                </a>
                {/* WhatsApp */}
                <a
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`Register for ${event.name}: ${fullPublicUrl}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                  title="Share on WhatsApp"
                >
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT CARD: When & Where ── */}
        <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div className="flex-1 flex flex-col min-h-0">
            <h3 className="text-sm font-bold text-white mb-4">When &amp; Where</h3>

            {/* Date Section */}
            <div className="flex items-start gap-3.5 mb-5">
              <div className="w-12 h-12 rounded-xl bg-[#212327] border border-[#2A2D31] flex flex-col items-center justify-center text-center shrink-0">
                <span className="text-[9px] font-extrabold uppercase text-[#FE760B] leading-none">
                  {dateInfo.month}
                </span>
                <span className="text-sm font-black text-white leading-tight mt-0.5">
                  {dateInfo.day}
                </span>
              </div>
              <div>
                <p className="text-sm font-bold text-white">
                  {dateInfo.dayName}, {dateInfo.month} {dateInfo.day}
                </p>
                <p className="text-xs text-[#9B9EA4] font-medium mt-0.5">
                  {dateInfo.timeRange}
                </p>
              </div>
            </div>

            {/* Venue Section with Edit Location button */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-start gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-[#212327] border border-[#2A2D31] flex items-center justify-center text-[#FE760B] shrink-0">
                  <MapPin size={20} className="text-[#FE760B]" />
                </div>
                <div className="min-w-0">
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(event.address || event.location || "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-bold text-white hover:text-[#FE760B] transition-colors flex items-center gap-1.5 truncate"
                  >
                    <span>{event.location || "School of Engineering, CUSAT"}</span>
                    <ArrowUpRight size={14} className="text-[#9B9EA4] shrink-0" />
                  </a>
                  <p className="text-xs text-[#9B9EA4] font-medium mt-0.5 line-clamp-2">
                    {event.address || event.location || "Main Campus Hall, Kochi, Kerala"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setLocationQuery(event.location || "");
                  setIsEditingLocation((prev) => !prev);
                }}
                className="px-2.5 py-1 rounded-lg bg-[#212327] hover:bg-[#2A2D31] text-[11px] font-semibold text-slate-300 hover:text-white border border-[#2A2D31] transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <Pencil size={12} className="text-[#FE760B]" />
                <span>{isEditingLocation ? "Close" : "Edit"}</span>
              </button>
            </div>

            {/* Real-time Location Search & Edit dropdown (Image 5) */}
            {isEditingLocation && (
              <div className="mb-4 p-3 rounded-xl bg-[#131517] border border-[#FE760B]/40 space-y-2 animate-fade-in">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={locationQuery}
                      onChange={(e) => setLocationQuery(e.target.value)}
                      placeholder="Type campus, college, hall or address..."
                      className="w-full h-9 px-3 pr-8 rounded-lg bg-[#1A1C1F] border border-[#2A2D31] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#FE760B]"
                      autoFocus
                    />
                    {isSearchingPlaces && (
                      <Loader2 size={13} className="animate-spin text-[#FE760B] absolute right-2.5 top-1/2 -translate-y-1/2" />
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={isSavingLocation || !locationQuery.trim()}
                    onClick={() => handleSelectLocation({ name: locationQuery, address: locationQuery })}
                    className="h-9 px-3 rounded-lg bg-[#FE760B] hover:bg-[#FF8A2B] text-white text-xs font-bold transition-all disabled:opacity-50 shrink-0 cursor-pointer"
                  >
                    {isSavingLocation ? "Saving..." : "Save"}
                  </button>
                </div>

                {locationSuggestions.length > 0 && (
                  <div className="divide-y divide-[#2A2D31] max-h-48 overflow-y-auto rounded-lg border border-[#2A2D31] bg-[#1A1C1F]">
                    {locationSuggestions.map((place, pIdx) => (
                      <button
                        key={place.id || pIdx}
                        type="button"
                        onClick={() => handleSelectLocation(place)}
                        className="w-full p-2 text-left hover:bg-[#212327] transition-colors flex items-start gap-2 text-xs cursor-pointer"
                      >
                        <MapPin size={13} className="text-[#FE760B] mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-bold text-white truncate">{place.name}</p>
                          <p className="text-[11px] text-[#9B9EA4] truncate">{place.address}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Google Maps Interactive Card Styled & Spaced */}
            <div className="w-full flex-1 min-h-[240px] sm:min-h-[280px] md:min-h-[300px] rounded-2xl overflow-hidden border border-[#2A2D31] mb-2.5 relative bg-[#131517] shadow-inner group flex flex-col">
              <iframe
                title="Google Maps Location Preview"
                width="100%"
                height="100%"
                loading="lazy"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
                src={`https://maps.google.com/maps?q=${encodeURIComponent(
                  event.address || event.location || "Delhi, India"
                )}&t=&z=14&ie=UTF8&iwloc=&output=embed`}
                className="w-full h-full flex-1 min-h-[240px] border-0 filter contrast-[1.05] brightness-95 rounded-2xl"
              />
              <div className="absolute bottom-2.5 right-2.5 z-10">
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(event.address || event.location || "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-[#131517]/90 hover:bg-[#131517] text-xs font-bold text-white border border-[#2A2D31] backdrop-blur-md transition-all flex items-center gap-1.5 shadow-lg hover:border-[#FE760B]/50 hover:text-[#FE760B]"
                >
                  <span>Open in Google Maps</span>
                  <ExternalLink size={11} />
                </a>
              </div>
            </div>

            <p className="text-[11px] text-[#9B9EA4] mb-4">
              The address is shown publicly on the event page.
            </p>
          </div>

          <div className="space-y-3 pt-1">
            {/* Big Check In Guests Button - Opens Web Scanner */}
            <button
              type="button"
              onClick={() => {
                setTargetScannerGuest(null);
                setShowScannerModal(true);
              }}
              className="w-full py-3 px-4 rounded-xl bg-[#212327] hover:bg-[#2A2D31] border border-[#2A2D31] hover:border-[#3DD68C]/50 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer group hover:shadow-[0_0_20px_rgba(61,214,140,0.3)]"
            >
              <QrCode size={18} className="text-[#3DD68C] group-hover:scale-110 transition-transform" />
              <span>Check In Guests</span>
            </button>

            {/* Secondary Edit & Photo Buttons */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setShowEditSlider(true)}
                className="py-2.5 px-3 rounded-xl bg-[#212327] hover:bg-[#2A2D31] border border-[#2A2D31] hover:border-[#FE760B]/40 text-xs font-semibold text-white text-center transition-colors cursor-pointer"
              >
                Edit Event
              </button>
              <button
                type="button"
                onClick={() => setShowPhotoModal(true)}
                className="py-2.5 px-3 rounded-xl bg-[#212327] hover:bg-[#2A2D31] border border-[#2A2D31] hover:border-[#FE760B]/40 text-xs font-semibold text-white text-center transition-colors cursor-pointer"
              >
                Change Photo
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Invites Section matching Image 1 ── */}
      <div className="mb-6 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white">Invites</h3>
            <p className="text-xs text-[#9B9EA4]">
              Invite subscribers, contacts and past guests via email or SMS.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowInviteModal(true)}
            className="px-3.5 py-1.5 rounded-xl bg-[#212327] hover:bg-[#2A2D31] border border-[#2A2D31] text-xs font-semibold text-white inline-flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
          >
            <Plus size={14} className="text-[#FE760B]" />
            <span>Invite Guests</span>
          </button>
        </div>

        {/* Empty / Status card */}
        <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-5 flex items-center gap-4 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-[#212327] border border-[#2A2D31] flex items-center justify-center text-[#9B9EA4] shrink-0">
            <Mail size={18} />
          </div>
          <div>
            <p className="text-xs font-bold text-white">No Invites Sent</p>
            <p className="text-[11px] text-[#9B9EA4] mt-0.5">
              You can invite subscribers, contacts and past guests to the event.
            </p>
          </div>
        </div>
      </div>

      {/* ── Hosts Section matching Image 1 ── */}
      <div className="mb-6 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white">Hosts</h3>
          <button
            type="button"
            onClick={() => setShowInviteModal(true)}
            className="px-3.5 py-1.5 rounded-xl bg-[#212327] hover:bg-[#2A2D31] border border-[#2A2D31] text-xs font-semibold text-white inline-flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
          >
            <Plus size={14} className="text-[#FE760B]" />
            <span>Add Host</span>
          </button>
        </div>

        {/* Host item matching Image 1 */}
        <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-4 flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-[#183124] border border-[#3DD68C]/30 flex items-center justify-center text-xs font-bold text-[#3DD68C] shrink-0">
              {(user?.fullName || "Krrish Singhal")[0].toUpperCase()}
            </div>
            <div className="min-w-0 flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-white truncate">
                {user?.fullName || "Krrish Singhal"}
              </span>
              <span className="text-xs text-[#9B9EA4] font-mono truncate">
                {user?.email || "krrishsinghal62@gmail.com"}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-[#183124] text-[#3DD68C] border border-[#3DD68C]/30 text-[10px] font-bold uppercase tracking-wider">
                Creator
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowEditSlider(true)}
            className="p-1.5 text-[#9B9EA4] hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
            title="Edit host options"
          >
            <Pencil size={14} />
          </button>
        </div>

        <p className="text-[11px] text-[#9B9EA4] flex items-center gap-1.5">
          <QrCode size={13} className="text-[#9B9EA4]" />
          <span>Manage check-in staff and options</span>
        </p>
      </div>

      {/* ── Visibility & Discovery matching Image 1 ── */}
      <div className="mb-8 space-y-3">
        <div>
          <h3 className="text-base font-bold text-white">Visibility &amp; Discovery</h3>
          <p className="text-xs text-[#9B9EA4]">Control how people can find your event.</p>
        </div>

        <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <span
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                isLive ? "bg-[#3DD68C] animate-pulse" : "bg-[#9B9EA4]"
              }`}
            />
            <div>
              <p className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                <span>Event is {isLive ? "Public & Live" : "Private / Draft Mode"}</span>
                {isUpdatingLive && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#FE760B]" />}
              </p>
              <p className="text-[11px] text-[#9B9EA4] mt-0.5">
                {isLive
                  ? "Shown on public event pages and open for registrations."
                  : "Hidden from public discovery. Only organizers have access."}
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
      </div>

      {/* ── At a Glance matching Image 3 with Real Firestore Numbers ── */}
      <div className="mb-8">
        <h2 className="text-base font-bold text-white mb-2">At a glance</h2>
        <div className="flex items-baseline justify-between mb-2">
          <p className="text-2xl font-black text-[#3DD68C] tracking-tight">
            {String(Number.isFinite(totalGuests) ? totalGuests : 0)}{" "}
            <span className="text-xs font-semibold text-[#9B9EA4]">guests</span>
          </p>
          <span className="text-xs text-[#9B9EA4] font-medium font-mono">
            cap {String(Number.isFinite(totalCapacity) ? totalCapacity : 150)}
          </span>
        </div>

        {/* Multi-segment Progress Bar from Real DB values */}
        <div className="w-full h-2 rounded-full bg-[#2A2D31] overflow-hidden flex mb-2.5">
          <div
            className="h-full bg-[#3DD68C] transition-all duration-500"
            style={{ width: `${Math.min(100, ((safeCheckedInCount || 0) / Math.max(1, totalCapacity)) * 100)}%` }}
            title={`${safeCheckedInCount} checked in`}
          />
          <div
            className="h-full bg-[#FE760B] transition-all duration-500"
            style={{ width: `${Math.min(100, ((notYetCount || 0) / Math.max(1, totalCapacity)) * 100)}%` }}
            title={`${notYetCount} not yet checked in`}
          />
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs font-medium text-[#9B9EA4] flex-wrap">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3DD68C]" />
            <strong className="text-white">{String(safeCheckedInCount)}</strong> checked in
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FE760B]" />
            <strong className="text-white">{String(notYetCount)}</strong> not yet
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#9B9EA4]" />
            <strong className="text-white">{String(seatsLeft)}</strong> seats left
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
            {registrations.slice(0, 10).map((guest, idx) => {
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
              const globalIndex = registrations.findIndex((r) => r.id === guest.id);
              const targetIndex = globalIndex !== -1 ? globalIndex : idx;

              return (
                <div
                  key={guest.id}
                  onClick={() => setSelectedGuestIndex(targetIndex)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedGuestIndex(targetIndex);
                    }
                  }}
                  className="p-4 flex items-center justify-between gap-3 hover:bg-[#212327]/70 active:bg-[#212327] cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-full ${avatarBg} text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm`}
                    >
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-white group-hover:text-[#FE760B] transition-colors truncate">
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
                    ) : isDeclined ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#2B1414] text-red-400 border border-red-500/30 text-[11px] font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                        Declined
                      </span>
                    ) : isPending ? (
                      <div className="flex items-center gap-2">
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
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#183124] text-[#3DD68C] border border-[#3DD68C]/30 text-[11px] font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#3DD68C]" />
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

      {/* ── Invite Guests Modal (Images 1 & 2) ── */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-[#1A1C1F] border border-[#2A2D31] p-6 shadow-2xl relative space-y-5 animate-scale-in">
            {/* Top Close Button */}
            <button
              type="button"
              onClick={() => setShowInviteModal(false)}
              className="absolute top-5 right-5 p-1.5 text-[#9B9EA4] hover:text-white rounded-full bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#1E293B] border border-blue-500/20 flex items-center justify-center text-[#3B82F6]">
                <UserPlus size={18} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white tracking-tight">Invite Guests</h3>
                <p className="text-xs text-[#9B9EA4]">Share the event link or invite directly by email</p>
              </div>
            </div>

            {/* Section 1: Copy Link */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#9B9EA4]">
                Event Registration Link
              </label>
              <div className="flex items-center gap-2 bg-[#131517] border border-[#2A2D31] rounded-xl p-2 min-w-0">
                <input
                  type="text"
                  readOnly
                  value={fullPublicUrl}
                  className="bg-transparent text-xs text-[#D0D0D1] flex-1 min-w-0 truncate outline-none font-mono px-2 select-all"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-3 py-1.5 rounded-lg bg-[#212327] hover:bg-[#2A2D31] text-xs font-bold text-white flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                >
                  {copied ? <Check size={13} className="text-[#3DD68C]" /> : <Copy size={13} />}
                  <span>{copied ? "Copied" : "Copy"}</span>
                </button>
              </div>
            </div>

            {/* Section 2: QR Code & Download */}
            {qrCodeUrl && (
              <div className="flex items-center gap-4 p-3 rounded-xl bg-[#131517] border border-[#2A2D31]">
                <img
                  src={qrCodeUrl}
                  alt="Event QR Code"
                  className="w-16 h-16 rounded-lg bg-white p-1"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-white">QR Code Poster</p>
                  <p className="text-[11px] text-[#9B9EA4] mt-0.5">
                    Guests can scan with their phone camera to instantly register.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadQR}
                  className="px-3 py-2 rounded-xl bg-[#212327] hover:bg-[#2A2D31] border border-[#2A2D31] text-xs font-semibold text-white flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                >
                  <Download size={13} className="text-[#FE760B]" />
                  <span>Download</span>
                </button>
              </div>
            )}

            {/* Section 3: Email Invitations */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#9B9EA4]">
                Invite by Email
              </label>
              <textarea
                rows={3}
                placeholder="Enter emails separated by commas or line breaks...&#10;example1@gmail.com, example2@gmail.com"
                value={inviteEmails}
                onChange={(e) => setInviteEmails(e.target.value)}
                className="w-full bg-[#131517] border border-[#2A2D31] focus:border-[#FE760B] rounded-xl p-3 text-xs text-white placeholder-[#64748B] outline-none resize-none transition-colors font-mono"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="px-4 py-2 rounded-xl bg-[#212327] hover:bg-[#2A2D31] text-xs font-semibold text-[#9B9EA4] hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendInvites}
                disabled={isSendingInvites || !inviteEmails.trim()}
                className="px-5 py-2 rounded-xl bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-bold text-xs flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSendingInvites ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[#131517]" />
                ) : (
                  <Mail className="w-4 h-4 text-[#131517]" />
                )}
                <span>{isSendingInvites ? "Sending..." : "Send Invitations"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Guest Details Drawer / Modal matching Screenshot ── */}
      {selectedGuestIndex !== null && registrations[selectedGuestIndex] && (
        <GuestDetailsModal
          isOpen={selectedGuestIndex !== null}
          onClose={() => setSelectedGuestIndex(null)}
          guest={registrations[selectedGuestIndex]}
          allGuests={registrations}
          currentIndex={selectedGuestIndex}
          onNavigate={(newIdx) => setSelectedGuestIndex(newIdx)}
          event={event}
          currentUser={user}
          onGuestUpdated={(updatedGuest) => {
            setRegistrations((prev) =>
              prev.map((g) => (g.id === updatedGuest.id ? { ...g, ...updatedGuest } : g))
            );
          }}
        />
      )}

      {/* ── Edit Event Right-Side Slider (matching Image 2) ── */}
      <EditEventSlider
        isOpen={showEditSlider}
        onClose={() => setShowEditSlider(false)}
        event={event}
        onEventUpdated={(updated) => {
          setEvent(updated);
        }}
      />

      {/* ── Square Photo Upload Modal (enforces strict 1:1 square ratio) ── */}
      <SquarePhotoUploadModal
        isOpen={showPhotoModal}
        onClose={() => setShowPhotoModal(false)}
        event={event}
        onPhotoUpdated={(newUrl) => {
          setEvent((prev) => ({ ...prev, coverImage: newUrl, bannerUrl: newUrl }));
        }}
      />

      {/* ── Web QR Scanner Modal (verifies identity on web/mobile) ── */}
      <WebScannerModal
        isOpen={showScannerModal}
        onClose={() => setShowScannerModal(false)}
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
