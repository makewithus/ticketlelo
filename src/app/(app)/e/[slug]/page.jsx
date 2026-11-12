"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { BrandLoader } from "@/components/ui/brand-loader";
import { EventPageSkeleton } from "@/components/ui/skeleton";
import { getCachedEvent, setCachedEvent } from "@/lib/client-cache";
import { EventBanner } from "@/components/events/event-banner";
import {
  ArrowLeft,
  Loader2,
  Calendar,
  MapPin,
  Clock,
  Tag,
  ShieldCheck,
  CheckCircle2,
  Share2,
  ExternalLink,
  Users,
  AlertCircle,
  Globe,
  Ticket,
  Layers,
  Sparkles,
  Info,
  Navigation,
} from "lucide-react";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getMajorEventBySlug, getMajorEvent } from "@/lib/events-engine";
import { getSubEventsForEvent } from "@/lib/sub-events";
import { getCombosForEvent } from "@/lib/combos";
import { DynamicRegistrationForm } from "@/components/forms/dynamic-registration-form";
import { formatEventDate, parseFirestoreDate } from "@/lib/date-utils";
import { VenueMap } from "@/components/common/venue-map";
import { useAuth } from "@/context/auth-context";
import { getThemeLook, resolveEventTheme } from "@/lib/theme-utils";
import { getPosterLines } from "@/components/admin/event-create-studio";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { EmbedRegistrationModal } from "@/components/embed/embed-registration-modal";

export default function PublicEventBySlugPage() {
  const { user, loading: authLoading } = useAuth();
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const slug = params?.slug;
  const referralCode = searchParams?.get("ref") || "";

  // Safe SSR hydration - avoids hydration mismatch
  const [event, setEvent] = useState(null);
  const [organizerUser, setOrganizerUser] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [subEvents, setSubEvents] = useState([]);
  const [combos, setCombos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showExternalModal, setShowExternalModal] = useState(false);
  const [currentTime, setCurrentTime] = useState("1:04 PM GMT+5:30");
  const [mounted, setMounted] = useState(false);
  const [hostImageError, setHostImageError] = useState(false);

  // Live local time formatted matching Image 1
  useEffect(() => {
    const mountTimer = setTimeout(() => setMounted(true), 0);
    const updateTime = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
      const offsetMin = -now.getTimezoneOffset();
      const isIST = offsetMin === 330;
      let tzSuffix = "GMT";
      if (isIST) {
        tzSuffix = "IST";
      } else {
        const sign = offsetMin >= 0 ? "+" : "-";
        const hours = Math.floor(Math.abs(offsetMin) / 60);
        const mins = Math.abs(offsetMin) % 60;
        tzSuffix = `GMT${sign}${hours}${mins ? `:${mins.toString().padStart(2, "0")}` : ":00"}`;
      }
      setCurrentTime(`${timeStr} ${tzSuffix}`);
    };
    updateTime();
    const timer = setInterval(updateTime, 10000);
    return () => {
      clearTimeout(mountTimer);
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!slug) return;
    let isMounted = true;

    // Fast-path client cache check on mount (runs after hydration, so zero SSR mismatch)
    let hasCached = false;
    try {
      const cached = getCachedEvent(slug);
      if (cached && isMounted) {
        hasCached = true;
        setEvent(cached);
        setIsLoading(false);
      }
    } catch {}

    (async () => {
      try {
        if (!hasCached) {
          setIsLoading(true);
        }
        let subEventsData = null;
        let combosData = null;
        let eventData = await getMajorEventBySlug(slug);
        if (!eventData) {
          eventData = await getMajorEvent(slug);
        }

        if (!eventData) {
          if (isMounted) {
            setNotFound(true);
            setIsLoading(false);
          }
          return;
        }

        const [fetchedSubs, fetchedCombos] = await Promise.all([
          getSubEventsForEvent(eventData.id).catch(() => []),
          getCombosForEvent(eventData.id).catch(() => []),
        ]);
        subEventsData = fetchedSubs;
        combosData = fetchedCombos;

        // Fetch host info via authoritative server route (Firebase Admin)
        let organizerDocData = null;
        const organizerUid = eventData.createdBy || eventData.organizerId || eventData.userId;
        try {
          const hostRes = await fetch(
            `/api/events/host-info?eventId=${encodeURIComponent(eventData.id)}&slug=${encodeURIComponent(slug)}&uid=${encodeURIComponent(organizerUid || "")}`
          );
          if (hostRes.ok) {
            const hostJson = await hostRes.json();
            if (hostJson?.host && (hostJson.host.name || hostJson.host.email || hostJson.host.photoURL)) {
              organizerDocData = {
                fullName: hostJson.host.name,
                displayName: hostJson.host.name,
                email: hostJson.host.email,
                photoURL: hostJson.host.photoURL,
              };
            }
          }
        } catch (hErr) {
          console.warn("[e/slug] Could not fetch authoritative host info:", hErr);
        }

        if (!organizerDocData && organizerUid) {
          try {
            const uSnap = await getDoc(doc(db, "users", organizerUid));
            if (uSnap.exists()) {
              organizerDocData = uSnap.data();
            }
          } catch (err) {
            console.warn("Could not fetch organizer document:", err);
          }
        }

        // Fetch real registrations only if authorized organizer or superAdmin
        let enrichedRegistrations = [];
        const emailLower = (user?.email || "").toLowerCase().trim();
        const canReadRegistrations = Boolean(
          user &&
          (user.role === "superAdmin" ||
            user.role === "superadmin" ||
            emailLower === "adil4ticketlelo@gmail.com" ||
            emailLower === "superadmin@ticketlelo.com" ||
            user.uid === eventData.organizerId ||
            user.uid === eventData.createdBy ||
            user.id === eventData.organizerId ||
            user.id === eventData.createdBy)
        );

        if (canReadRegistrations) {
          try {
            const regQ = query(
              collection(db, "registrations"),
              where("eventId", "==", eventData.id)
            );
            const regSnap = await getDocs(regQ);
            const rawRegs = regSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

            const attendeeUserIds = [...new Set(rawRegs.map((r) => r.userId).filter(Boolean))];
            const attendeeUserMap = {};
            if (attendeeUserIds.length > 0) {
              await Promise.all(
                attendeeUserIds.map(async (uid) => {
                  try {
                    const aDoc = await getDoc(doc(db, "users", uid));
                    if (aDoc.exists()) {
                      attendeeUserMap[uid] = aDoc.data();
                    }
                  } catch {}
                })
              );
            }

            enrichedRegistrations = rawRegs.map((r) => {
              const uData = r.userId ? attendeeUserMap[r.userId] : null;
              return {
                ...r,
                photoURL: r.photoURL || uData?.photoURL || "",
                fullName: r.fullName || r.name || uData?.fullName || "Guest Attendee",
                email: r.email || uData?.email || "",
              };
            });
          } catch (regErr) {
            console.warn("Could not fetch registrations:", regErr);
          }
        }

        if (isMounted) {
          setEvent(eventData);
          if (slug) setCachedEvent(slug, eventData);
          if (eventData?.id) setCachedEvent(eventData.id, eventData);
          setOrganizerUser(organizerDocData);
          setRegistrations(enrichedRegistrations);
          setSubEvents(subEventsData || []);
          setCombos(combosData || []);
          setIsLoading(false);
        }
      } catch (err) {
        console.error("[e/slug] Failed to fetch public event:", err);
        if (isMounted) {
          setNotFound(true);
          setIsLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [slug]);

  // Real-time synchronization for event status and registrations
  useEffect(() => {
    if (!event?.id || !db) return;

    let unsubEvent = null;
    let unsubRegs = null;

    try {
      unsubEvent = onSnapshot(
        doc(db, "events", event.id),
        (snap) => {
          if (snap.exists()) {
            const data = { id: snap.id, ...snap.data() };
            setEvent((prev) => ({ ...(prev || {}), ...data }));
            if (slug) {
              setCachedEvent(slug, data);
            }
          }
        },
        (err) => console.warn("Real-time event sync warning:", err?.message)
      );
    } catch (err) {
      console.warn("Could not bind real-time event listener:", err);
    }

    const emailLower = (user?.email || "").toLowerCase().trim();
    const canListenRegistrations = Boolean(
      user &&
      (user.role === "superAdmin" ||
        user.role === "superadmin" ||
        emailLower === "adil4ticketlelo@gmail.com" ||
        emailLower === "superadmin@ticketlelo.com" ||
        user.uid === event.organizerId ||
        user.uid === event.createdBy ||
        user.id === event.organizerId ||
        user.id === event.createdBy)
    );

    if (canListenRegistrations) {
      try {
        const q = query(
          collection(db, "registrations"),
          where("eventId", "==", event.id)
        );
        unsubRegs = onSnapshot(
          q,
          (snap) => {
            const freshRegs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            setRegistrations((prev) => {
              if (prev.length === freshRegs.length) return prev;
              return freshRegs;
            });
          },
          (err) => console.warn("Real-time registrations sync warning:", err?.message)
        );
      } catch (err) {
        console.warn("Could not bind real-time registrations listener:", err);
      }
    }

    return () => {
      if (typeof unsubEvent === "function") unsubEvent();
      if (typeof unsubRegs === "function") unsubRegs();
    };
  }, [event?.id]);

  // Derive theme properties unconditionally matching React Rules of Hooks
  const eventTheme = useMemo(() => resolveEventTheme(event), [event]);
  const themeAccent = eventTheme?.color || eventTheme?.hex || event?.themeColor || "#FE760B";
  const pageBg =
    eventTheme?.pageBg ||
    (event?.theme === "minimal" || event?.themeName?.toLowerCase() === "minimal"
      ? "#432E01"
      : "#131517");
  const themeLook = getThemeLook(event?.themeColor || event?.theme || themeAccent);

  // Dynamic full-page background synchronization matching organizer's chosen theme
  useEffect(() => {
    if (typeof document !== "undefined" && pageBg) {
      const prevHtmlBg = document.documentElement.style.backgroundColor;
      const prevBodyBg = document.body.style.backgroundColor;

      document.documentElement.style.backgroundColor = pageBg;
      document.body.style.backgroundColor = pageBg;
      document.documentElement.style.setProperty("--event-page-bg", pageBg);
      document.documentElement.style.setProperty("--event-theme-accent", themeAccent);

      return () => {
        document.documentElement.style.backgroundColor = prevHtmlBg;
        document.body.style.backgroundColor = prevBodyBg;
        document.documentElement.style.removeProperty("--event-page-bg");
        document.documentElement.style.removeProperty("--event-theme-accent");
      };
    }
  }, [pageBg, themeAccent]);

  if (isLoading && !event) {
    return <EventPageSkeleton />;
  }

  if (notFound || !event) {
    return (
      <div className="min-h-screen bg-[#131517] text-white flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-400 border border-red-500/20 flex items-center justify-center">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Event Not Found</h1>
        <p className="text-[#9B9EA4] text-xs">
          The event <code className="px-1.5 py-0.5 rounded bg-[#212327] text-white font-mono text-xs">{slug}</code> does not exist or has not been published yet.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black font-semibold text-xs hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Return to Homepage
        </Link>
      </div>
    );
  }

  // Safe Date parsing - guarantees no NaN errors in React children
  const parsedDate = parseFirestoreDate(event.startDate || event.date) || new Date();
  const eventDateObj = !isNaN(parsedDate.getTime()) ? parsedDate : new Date();
  const monthShort = eventDateObj.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  const dayNum = String(eventDateObj.getDate());
  const weekdayDate = eventDateObj.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" });

  const formattedTimeRange = event.startTime
    ? `${event.startTime}${event.endTime ? ` – ${event.endTime}` : ""} GMT+5:30`
    : event.time
    ? `${event.time} GMT+5:30`
    : "10:00 AM – 5:00 PM GMT+5:30";

  const rawSeats = event.globalCapacity ?? event.capacity ?? event.maxCapacity;
  const isUnlimitedCapacity =
    typeof rawSeats === "string"
      ? rawSeats.toLowerCase().includes("unlimited") || rawSeats.toLowerCase().includes("open")
      : event.isUnlimitedCapacity === true || event.limitCapacity === false;

  const digits = String(rawSeats || "").replace(/[^\d]/g, "");
  const parsedCap = digits ? parseInt(digits, 10) : 0;
  const totalSeats = !isUnlimitedCapacity && !isNaN(parsedCap) && parsedCap > 0 ? parsedCap : 0;
  const hasCapacityLimit = totalSeats > 0;
  const takenSeats = Math.max(Number(event.allocatedSeats || 0), registrations.length);
  const seatsLeft = hasCapacityLimit ? Math.max(0, totalSeats - takenSeats) : null;

  const isEventCancelled = Boolean(
    event.status === "cancelled" || event.isCancelled
  );
  const isEventEnded = Boolean(
    event.status === "ended" || event.status === "completed" || event.isEnded === true
  );

  // Authoritative explicit closure evaluation:
  // If closeRegistrationEnabled is explicitly false, closure rule is disabled and registration is open.
  let isRegistrationClosedExplicit = false;
  if (event.closeRegistrationEnabled === true) {
    if (event.closeRegistrationMode === "now" || event.registrationClosed === true) {
      isRegistrationClosedExplicit = true;
    }
  } else if (event.closeRegistrationEnabled === false) {
    isRegistrationClosedExplicit = false;
  } else {
    // Fallback for older event records before closeRegistrationEnabled field was introduced
    isRegistrationClosedExplicit = Boolean(
      (event.registrationClosed === true && event.registrationStatus !== "Open") ||
      (event.isRegistrationClosed === true && event.registrationStatus !== "Open") ||
      event.registrationStatus === "Closed" ||
      event.registrationStatus === "closed" ||
      event.status === "closed"
    );
  }

  const isCapacityClosed = Boolean(
    event.closeRegistrationEnabled === true &&
    event.closeRegistrationMode === "capacity" &&
    typeof event.closeRegistrationCapacity === "number" &&
    Number(event.closeRegistrationCapacity) > 0 &&
    takenSeats >= Number(event.closeRegistrationCapacity)
  );
  const isGlobalCapacityReached = Boolean(
    hasCapacityLimit && seatsLeft !== null && seatsLeft <= 0
  );
  const isClosedForRegistration =
    isEventCancelled ||
    isEventEnded ||
    isRegistrationClosedExplicit ||
    isCapacityClosed ||
    isGlobalCapacityReached;

  const priceDisplay = event.price !== undefined && event.price !== "" ? (event.price.toString().startsWith("₹") ? event.price : `₹${event.price}`) : "Free";

  const eventTitle = (event.name || event.title || "Event").trim();
  const posterLines = getPosterLines(
    eventTitle,
    event.posterTextMode || "auto",
    event.posterTextMode === "custom" ? event.posterLine1 : "",
    event.posterTextMode === "custom" ? event.posterLine2 : ""
  );

  // Sanitize out stale generic defaults like "School of Engineering" or "support@ticketlelo.com"
  const cleanOrgName =
    event.organizerName && event.organizerName !== "School of Engineering"
      ? event.organizerName
      : null;
  const cleanOrgEmail =
    event.organizerEmail && event.organizerEmail !== "support@ticketlelo.com"
      ? event.organizerEmail
      : null;

  const organizerName =
    organizerUser?.name ||
    organizerUser?.fullName ||
    organizerUser?.displayName ||
    cleanOrgName ||
    (event.hostName && event.hostName !== "School of Engineering" ? event.hostName : null) ||
    (organizerUser?.email ? organizerUser.email.split("@")[0] : null) ||
    (cleanOrgEmail ? cleanOrgEmail.split("@")[0] : null) ||
    "Host";

  const organizerEmail =
    organizerUser?.email ||
    cleanOrgEmail ||
    (event.hostEmail && event.hostEmail !== "support@ticketlelo.com" ? event.hostEmail : null) ||
    (event.contactEmail && event.contactEmail !== "support@ticketlelo.com" ? event.contactEmail : null) ||
    (event.email && event.email !== "support@ticketlelo.com" ? event.email : null) ||
    "";

  const organizerPhoto =
    organizerUser?.photoURL ||
    event.organizerPhotoUrl ||
    event.hostPhotoUrl ||
    null;

  const broadLocation =
    event.locationVenue ||
    (event.venue && !event.venue.includes(",") ? event.venue : null) ||
    (event.location ? event.location.split(",")[0].trim() : null) ||
    event.venue ||
    "Main Campus Venue";

  const AVATAR_COLORS = [
    "bg-blue-600",
    "bg-purple-600",
    "bg-emerald-600",
    "bg-amber-600",
    "bg-pink-600",
    "bg-indigo-600",
    "bg-teal-600",
  ];

  const attendeeCount = registrations.length;
  let attendeeSummaryText = "";
  if (attendeeCount === 1) {
    attendeeSummaryText = registrations[0].fullName;
  } else if (attendeeCount === 2) {
    attendeeSummaryText = `${registrations[0].fullName} and ${registrations[1].fullName}`;
  } else if (attendeeCount > 2) {
    attendeeSummaryText = `${registrations[0].fullName}, ${registrations[1].fullName} and ${attendeeCount - 2} ${
      attendeeCount - 2 === 1 ? "other" : "others"
    }`;
  }

  return (
    <div
      className="min-h-screen text-slate-900 dark:text-white selection:bg-[#FE760B] selection:text-white flex flex-col relative transition-colors duration-300 overflow-x-clip w-full max-w-full"
      style={{
        backgroundColor: pageBg,
      }}
    >
      {/* Top Navigation - Transparent & seamless without harsh dividing line */}
      <header className="sticky top-0 z-40 bg-transparent border-b border-transparent px-3.5 sm:px-6 lg:px-8 py-2.5 sm:py-3.5 transition-colors max-w-full overflow-hidden">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-2 sm:gap-3">
          {/* Left: Brand Icon + Navigation Links */}
          <div className="flex items-center gap-2.5 sm:gap-6 shrink-0">
            <Link href="/" className="inline-flex items-center gap-2 group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo/ticketlelo-logo-nav.png"
                alt="TicketLelo"
                className="h-5 sm:h-7 w-auto object-contain"
              />
            </Link>
            <nav className="flex items-center gap-2.5 sm:gap-5 text-xs sm:text-sm font-medium">
              <Link
                href="/"
                className="text-slate-900 dark:text-white font-semibold transition-colors"
              >
                Events
              </Link>
              <Link
                href="/discover"
                className="text-slate-500 dark:text-[#9B9EA4] hover:text-[#FE760B] dark:hover:text-[#FE760B] transition-colors"
              >
                Discover
              </Link>
            </nav>
          </div>

          {/* Right: Live time + Create Event + ThemeToggle + Account / Sign in */}
          <div className="flex items-center gap-2 sm:gap-3.5">
            <span
              className="text-[12px] sm:text-[13px] font-sans font-medium text-slate-500 dark:text-[#9B9EA4] tracking-normal tabular-nums select-none"
              suppressHydrationWarning
            >
              {mounted ? currentTime : "11:42 pm IST"}
            </span>

            <Link
              href="/host-event"
              className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-white hover:text-[#FE760B] transition-colors whitespace-nowrap"
            >
              Create Event
            </Link>

            <ThemeToggle inline />

            {authLoading ? (
              <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-[#212327] animate-pulse" />
            ) : user ? (
              <div className="flex items-center gap-2">
                <Link
                  href={
                    user.role === "superAdmin"
                      ? "/superadmin"
                      : user.role === "organiser" || user.isAdmin
                      ? "/admin/dashboard"
                      : "/dashboard"
                  }
                  aria-label="Dashboard"
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#FE760B] text-white font-bold text-xs flex items-center justify-center hover:opacity-90 transition-opacity shrink-0 shadow-xs overflow-hidden"
                >
                  {user?.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.fullName || user.email || "User"}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover rounded-full"
                    />
                  ) : (
                    (user.fullName || user.name || user.email || "U").trim().charAt(0).toUpperCase()
                  )}
                </Link>
              </div>
            ) : (
              <Link
                href="/login"
                className="bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-[#212327] dark:hover:bg-[#2A2D31] border border-slate-200 dark:border-[#2A2D31] dark:text-white text-xs font-semibold px-3.5 py-1.5 rounded-xl transition-all shadow-sm"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="relative z-10 flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Event Status Notification: Cancelled or Postponed */}
        {event.status === "cancelled" || event.isCancelled ? (
          <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-start gap-3 text-red-500 dark:text-red-400">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold">Event Cancelled</h3>
              <p className="text-xs text-red-600/90 dark:text-red-300/80 mt-0.5 leading-relaxed">
                This event has been cancelled by the organiser. Registrations are closed and no further registrations will be accepted.
              </p>
            </div>
          </div>
        ) : event.status === "postponed" || event.isPostponed ? (
          <div className="mb-6 p-4 rounded-2xl bg-[#FE760B]/10 border border-[#FE760B]/30 flex items-start gap-3 text-[#FE760B]">
            <Clock className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold">Event Postponed — Updated Dates Announced</h3>
              <p className="text-xs text-[#D0D0D1] mt-0.5 leading-relaxed">
                The organiser has postponed this event to new dates. Please review the updated schedule below.
                {event.postponedNote && (
                  <span className="block mt-1 font-medium text-white italic">
                    &ldquo;{event.postponedNote}&rdquo;
                  </span>
                )}
              </p>
            </div>
          </div>
        ) : null}

        {/* ── Breadcrumb & Registration Status Ribbon ── */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-[#2A2D31] pb-5 mb-8">
          <Link
            href="/#events"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-[#9B9EA4] hover:text-slate-900 dark:hover:text-white bg-white dark:bg-[#1A1C1F] hover:bg-slate-100 dark:hover:bg-[#212327] border border-slate-200 dark:border-[#2A2D31] px-4 py-2 rounded-xl transition-all shadow-sm group"
          >
            <ArrowLeft className="w-4 h-4 text-[#FE760B] group-hover:-translate-x-1 transition-transform" />
            <span>Back to events</span>
          </Link>

          <div className="flex items-center gap-2.5">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold shadow-sm ${
                isClosedForRegistration
                  ? "bg-red-500/10 text-red-500 border border-red-500/20"
                  : ""
              }`}
              style={
                !isClosedForRegistration
                  ? {
                      backgroundColor: `${themeAccent}18`,
                      borderColor: `${themeAccent}35`,
                      color: themeAccent,
                      borderWidth: "1px",
                    }
                  : undefined
              }
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isClosedForRegistration ? "bg-red-500" : "animate-pulse"
                }`}
                style={!isClosedForRegistration ? { backgroundColor: themeAccent } : undefined}
              />
              {isClosedForRegistration
                ? "● Registration closed"
                : hasCapacityLimit
                ? `● ${seatsLeft ?? 0} spots left`
                : "● Registration open"}
            </span>
            {event.category && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-600 dark:text-[#7AA2FF] border border-blue-500/20">
                {event.category}
              </span>
            )}
          </div>
        </div>

        {/* ── Master 2-Column Responsive Layout ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* ── LEFT COLUMN: Event Story, Logistics & Map (7 Cols) ── */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Event Hero Card */}
            <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-[#2A2D31] bg-white dark:bg-[#1A1C1F] p-6 sm:p-8 shadow-sm dark:shadow-xl">
              <div className="-mx-6 -mt-6 sm:-mx-8 sm:-mt-8 mb-6 overflow-hidden">
                <EventBanner event={event} aspect="video" priority className="rounded-none sm:rounded-t-2xl border-none max-h-72" />
              </div>

              <div className="relative z-10 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div
                    className="inline-flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider"
                    style={{
                      backgroundColor: `${themeAccent}15`,
                      borderColor: `${themeAccent}30`,
                      color: themeAccent,
                      borderWidth: "1px",
                    }}
                  >
                    <Ticket className="w-3.5 h-3.5" style={{ color: themeAccent }} />
                    <span>Official event pass</span>
                  </div>
                  <div
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold"
                    style={{
                      backgroundColor: `${themeAccent}15`,
                      borderColor: `${themeAccent}30`,
                      color: themeAccent,
                      borderWidth: "1px",
                    }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: themeAccent }} />
                    <span>Happening now</span>
                  </div>
                </div>

                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight">
                  {eventTitle}
                </h1>

                {/* HOSTED BY Section */}
                <div className="flex items-center gap-3 pt-3 border-t border-slate-100 dark:border-[#2A2D31]/60">
                  {organizerPhoto && !hostImageError ? (
                    <img
                      src={organizerPhoto}
                      alt={organizerName}
                      referrerPolicy="no-referrer"
                      onError={() => setHostImageError(true)}
                      className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-white/20 shadow-xs shrink-0"
                    />
                  ) : (
                    <div
                      className="w-10 h-10 rounded-full text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-xs"
                      style={{ backgroundColor: themeAccent }}
                    >
                      {(organizerName || "Host").slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {organizerName}
                      </span>
                      <span
                        className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded font-mono font-bold"
                        style={{
                          backgroundColor: `${themeAccent}15`,
                          borderColor: `${themeAccent}30`,
                          color: themeAccent,
                          borderWidth: "1px",
                        }}
                      >
                        Verified
                      </span>
                    </div>
                    {organizerEmail && (
                      <a
                        href={`mailto:${organizerEmail}`}
                        className="text-[11px] hover:underline truncate block font-medium"
                        style={{ color: themeAccent }}
                      >
                        {organizerEmail}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Logistics Matrix (4 Cards) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Date & Time */}
              <div className="p-4 rounded-2xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] flex items-start gap-3.5 hover:border-[#FE760B]/30 transition-colors shadow-sm">
                <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-[#7AA2FF] border border-blue-500/20 shrink-0">
                  <Calendar className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-500 dark:text-[#9B9EA4] uppercase tracking-wider">Date & Time</p>
                  <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 truncate">{weekdayDate}</p>
                  <p className="text-xs text-slate-600 dark:text-[#9B9EA4] mt-0.5 truncate">{formattedTimeRange}</p>
                </div>
              </div>

              {/* Venue Location */}
              <div className="p-4 rounded-2xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] flex items-start gap-3.5 hover:border-[#FE760B]/30 transition-colors shadow-sm">
                <div
                  className="p-2.5 rounded-xl shrink-0"
                  style={{
                    backgroundColor: `${themeAccent}15`,
                    borderColor: `${themeAccent}30`,
                    color: themeAccent,
                    borderWidth: "1px",
                  }}
                >
                  <MapPin className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-500 dark:text-[#9B9EA4] uppercase tracking-wider">Venue Location</p>
                  <a
                    href={event.locationUrl || `https://maps.google.com/?q=${encodeURIComponent((event.venue || event.location || "") + " " + (event.city || ""))}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-bold text-slate-900 dark:text-white hover:text-[#FE760B] transition-colors mt-0.5 block truncate group"
                  >
                    <span>{event.venue || event.location || "Campus Venue"}</span>
                    <span className="ml-1 text-[10px] text-[#FE760B]">↗</span>
                  </a>
                  <p className="text-xs text-slate-600 dark:text-[#9B9EA4] mt-0.5 truncate">
                    {event.city || event.subVenue || "Campus Venue"}
                  </p>
                </div>
              </div>

              {/* Ticket Pricing */}
              <div className="p-4 rounded-2xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] flex items-start gap-3.5 hover:border-[#FE760B]/30 transition-colors shadow-sm">
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-[#FDE003] border border-amber-500/20 shrink-0">
                  <Tag className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-500 dark:text-[#9B9EA4] uppercase tracking-wider">Admission Type</p>
                  <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">{priceDisplay}</p>
                  <p className="text-xs text-slate-600 dark:text-[#9B9EA4] mt-0.5">
                    {event.isPaid ? "Tax-inclusive (18% GST)" : "Complimentary Registration"}
                  </p>
                </div>
              </div>

              {/* Digital Pass */}
              <div className="p-4 rounded-2xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] flex items-start gap-3.5 hover:border-[#FE760B]/30 transition-colors shadow-sm">
                <div className="p-2.5 rounded-xl bg-[#FE760B]/10 text-[#FE760B] border border-[#FE760B]/20 shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-500 dark:text-[#9B9EA4] uppercase tracking-wider">Digital Pass</p>
                  <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">Cryptographic QR</p>
                  <p className="text-xs text-slate-600 dark:text-[#9B9EA4] mt-0.5">Instant PDF & Wallet ticket</p>
                </div>
              </div>
            </div>

            {/* About This Event Card */}
            <div className="p-6 sm:p-7 rounded-2xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] space-y-4 shadow-sm">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-lg border-b border-slate-200 dark:border-[#2A2D31] pb-3">
                <Info className="w-5 h-5 text-blue-500 dark:text-[#7AA2FF]" />
                <h2>About this event</h2>
              </div>
              <div className="prose max-w-none text-slate-600 dark:text-[#9B9EA4] text-sm sm:text-base leading-relaxed whitespace-pre-line">
                {event.description || (
                  <p>
                    Welcome to {eventTitle}! Register to reserve your entry pass. Upon completing your registration, you will receive an official PDF ticket containing your signed QR code for rapid contactless entry.
                  </p>
                )}
              </div>
            </div>

            {/* Attendees Going Section */}
            <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] space-y-3 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-[#9B9EA4]">
                {attendeeCount} GOING
              </p>
              {attendeeCount > 0 ? (
                <div className="flex items-center">
                  <div className="flex items-center -space-x-2 shrink-0">
                    {registrations.slice(0, 6).map((reg, idx) => (
                      reg.photoURL ? (
                        <img
                          key={reg.id || idx}
                          src={reg.photoURL}
                          alt={reg.fullName}
                          referrerPolicy="no-referrer"
                          title={reg.fullName}
                          className="w-8 h-8 rounded-full object-cover border-2 border-white dark:border-[#131517] shadow-xs"
                        />
                      ) : (
                        <div
                          key={reg.id || idx}
                          title={reg.fullName}
                          className={`w-8 h-8 rounded-full border-2 border-white dark:border-[#131517] flex items-center justify-center text-[10px] font-bold text-white shadow-xs ${
                            AVATAR_COLORS[idx % AVATAR_COLORS.length]
                          }`}
                        >
                          {String(reg.fullName || "A").charAt(0).toUpperCase()}
                        </div>
                      )
                    ))}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-[#9B9EA4] ml-3 truncate">
                    {attendeeSummaryText}
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-[#9B9EA4]">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>Be the first to claim a pass and join!</span>
                </div>
              )}
            </div>

            {/* Included Sub-Events / Tracks (if available) */}
            {subEvents && subEvents.length > 0 && (
              <div className="p-6 sm:p-7 rounded-2xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] space-y-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#2A2D31] pb-3">
                  <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-lg">
                    <Layers className="w-5 h-5 text-[#FE760B]" />
                    <h2>Included tracks & sessions</h2>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#FE760B]/10 text-[#FE760B] border border-[#FE760B]/20">
                    {subEvents.length} Tracks
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {subEvents.map((sub) => (
                    <div
                      key={sub.id}
                      className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#212327] border border-slate-200 dark:border-[#2A2D31] space-y-1.5 hover:border-[#FE760B]/30 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">{sub.title}</h4>
                        <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-[#7AA2FF] border border-blue-500/20 shrink-0">
                          {sub.trackType || "Track"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-[#9B9EA4] flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-[#5C6066] shrink-0" />
                        <span>{sub.startTime || "10:00 AM"} - {sub.endTime || "01:00 PM"}</span>
                      </p>
                      {sub.venue && (
                        <p className="text-xs text-slate-600 dark:text-[#9B9EA4] flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 dark:text-[#5C6066] shrink-0" />
                          <span className="truncate">{sub.venue}</span>
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Combos & All-Access Bundles (if available) */}
            {combos && combos.length > 0 && (
              <div className="p-6 sm:p-7 rounded-2xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] space-y-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#2A2D31] pb-3">
                  <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-lg">
                    <Sparkles className="w-5 h-5 text-amber-500 dark:text-[#FDE003]" />
                    <h2>Festival passes & bundles</h2>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-[#FDE003] border border-amber-500/20">
                    {combos.length} Passes Available
                  </span>
                </div>

                <div className="space-y-3">
                  {combos.map((combo) => (
                    <div
                      key={combo.id}
                      className="p-4 rounded-xl bg-slate-50 dark:bg-[#212327] border border-slate-200 dark:border-[#2A2D31] flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-[#FE760B]/30 transition-colors"
                    >
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">{combo.title}</h4>
                        <p className="text-xs text-slate-600 dark:text-[#9B9EA4] mt-0.5">{combo.description || "All-access multi-track festival ticket"}</p>
                        {combo.perks && combo.perks.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {combo.perks.slice(0, 3).map((perk, idx) => (
                              <span key={idx} className="text-[10px] px-2 py-0.5 rounded bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] text-slate-600 dark:text-[#9B9EA4]">
                                {perk}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="sm:text-right shrink-0">
                        <span className="text-base font-extrabold text-[#FE760B] tabular-nums">₹{combo.price || 0}</span>
                        <span className="block text-[11px] text-slate-400 dark:text-[#5C6066]">Tax Incl.</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Interactive Venue Map */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-lg px-1">
                <Navigation className="w-5 h-5" style={{ color: themeAccent }} />
                <h2>Venue & navigation</h2>
              </div>
              <VenueMap
                venueName={event.venue || event.location || event.title}
                subVenue={event.subVenue || event.room}
                address={event.address || event.venueAddress || event.venue || event.location}
                city={event.city || ""}
                latitude={event.latitude || event.lat || null}
                longitude={event.longitude || event.lng || null}
              />
            </div>

            {/* Host Contact & Report Links */}
            <div className="pt-4 border-t border-slate-200 dark:border-[#2A2D31]/60 flex items-center justify-between text-xs text-slate-500 dark:text-[#9B9EA4]">
              <button
                type="button"
                onClick={() => {
                  window.location.href = `mailto:${organizerEmail}?subject=Inquiry about ${encodeURIComponent(eventTitle)}`;
                }}
                className="hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                Contact the host
              </button>
              <span className="text-slate-400 dark:text-[#2A2D31]">•</span>
              <button
                type="button"
                onClick={() => {
                  window.location.href = `mailto:safety@ticketlelo.com?subject=Report Event: ${encodeURIComponent(eventTitle)}`;
                }}
                className="hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                Report event
              </button>
            </div>
          </div>

          {/* ── RIGHT COLUMN: Dedicated Vertical Registration Drawer (5 Cols) ── */}
          <div className="lg:col-span-5 lg:sticky lg:top-24 w-full max-w-xl mx-auto">
            <div className="rounded-2xl border border-slate-200 dark:border-[#2A2D31] bg-white dark:bg-[#1A1C1F] p-5 sm:p-7 shadow-xl">
              
              {/* Header row */}
              <div className="border-b border-slate-200 dark:border-[#2A2D31] pb-4 mb-5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 dark:bg-[#212327] border border-slate-200 dark:border-[#2A2D31] text-slate-800 dark:text-white text-xs font-semibold">
                    <Ticket className="w-3.5 h-3.5 text-[#FE760B]" />
                    <span>Attendee registration</span>
                  </div>
                  <span className="text-xs font-bold text-slate-800 dark:text-white bg-slate-100 dark:bg-[#212327] border border-slate-200 dark:border-[#2A2D31] px-2.5 py-1 rounded-full">
                    {priceDisplay}
                  </span>
                </div>

                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                    Register for {eventTitle}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-[#9B9EA4] mt-0.5">
                    Fill in your details below to generate your entry ticket and credentials.
                  </p>
                </div>
              </div>

              {/* Spot Availability Banner */}
              <div className="bg-slate-50 dark:bg-[#131517] border border-slate-200 dark:border-[#2A2D31] rounded-xl p-3 flex items-start gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-[#212327] border border-slate-200 dark:border-[#2A2D31] flex items-center justify-center shrink-0">
                  <Clock size={16} className="text-[#9B9EA4]" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                    {isClosedForRegistration
                      ? "Registration Closed"
                      : hasCapacityLimit
                      ? seatsLeft === 0
                        ? "Event Sold Out / Fully Booked"
                        : seatsLeft === 1
                        ? "Only 1 Spot Remaining!"
                        : seatsLeft <= 10
                        ? `Only ${seatsLeft} Spots Remaining`
                        : `${seatsLeft} Spots Available`
                      : "Spots Available — Open Access"}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-[#9B9EA4] mt-0.5">
                    {isClosedForRegistration
                      ? "Registrations for this event have closed."
                      : hasCapacityLimit && seatsLeft === 0
                      ? "Registrations for this event have reached maximum capacity."
                      : "Hurry up and register before the event fills up!"}
                  </p>
                </div>
              </div>

              {/* User email badge if signed in */}
              {user && (
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-[#131517] border border-slate-200 dark:border-[#2A2D31] rounded-xl px-3 py-2 mb-4">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: themeAccent }} />
                  <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                    {user?.fullName || user?.name || "Attendee"}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-[#9B9EA4] font-mono truncate">
                    {user?.email}
                  </span>
                </div>
              )}

              {/* College / Team External Form Embed Banner if configured */}
              {event?.embedRegistrationMode === "custom_iframe" && event?.customFormEmbedUrl && (
                <div className="mb-4 p-3 rounded-xl bg-orange-500/10 border border-orange-500/25 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Globe size={13} className="text-[#FE760B]" />
                      College / Team Portal Form Available
                    </span>
                    <span className="text-[10px] text-[#FE760B] font-semibold bg-[#FE760B]/15 px-2 py-0.5 rounded-full">
                      Integrated
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-[#9B9EA4]">
                    The host has embedded their official college event form. You can register via their interactive portal or through TicketLelo below.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowExternalModal(true)}
                    className="w-full py-2 px-3 rounded-xl bg-[#FE760B] hover:bg-[#FE760B]/90 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Globe size={13} />
                    <span>Open College Form Portal (Modal)</span>
                  </button>
                </div>
              )}

              {/* Dynamic Registration Form */}
              <div className="mt-1">
                <DynamicRegistrationForm
                  eventId={event.id}
                  event={event}
                  themeColor={themeAccent}
                  subEvents={subEvents}
                  combos={combos}
                  defaultReferralCode={referralCode}
                />
              </div>

              {/* Micro Trust Strip */}
              <div className="mt-5 pt-4 border-t border-slate-200 dark:border-[#2A2D31] flex items-center justify-between text-[11px] text-slate-500 dark:text-[#9B9EA4]">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" style={{ color: themeAccent }} />
                  100% secure checkout
                </span>
                <span>TicketLelo verified</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* External College / Team Form Modal */}
      {event && (
        <EmbedRegistrationModal
          isOpen={showExternalModal}
          onClose={() => setShowExternalModal(false)}
          event={event}
        />
      )}
    </div>
  );
}
