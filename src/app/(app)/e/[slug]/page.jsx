"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { BrandLoader } from "@/components/ui/brand-loader";
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
import { formatEventDate } from "@/lib/date-utils";
import { useAuth } from "@/context/auth-context";
import { getThemeLook } from "@/lib/theme-utils";
import { getPosterLines } from "@/components/admin/event-create-studio";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { AnimatedRadialBackground } from "@/components/effects/AnimatedRadialBackground";
import { EmbedRegistrationModal } from "@/components/embed/embed-registration-modal";

export default function PublicEventBySlugPage() {
  const { user } = useAuth();
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const slug = params?.slug;
  const referralCode = searchParams?.get("ref") || "";

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

    (async () => {
      try {
        setIsLoading(true);
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

        // Fetch organizer doc from users collection
        let organizerDocData = null;
        const organizerUid = eventData.createdBy || eventData.organizerId || eventData.userId;
        if (organizerUid) {
          try {
            const uSnap = await getDoc(doc(db, "users", organizerUid));
            if (uSnap.exists()) {
              organizerDocData = uSnap.data();
            }
          } catch (err) {
            console.warn("Could not fetch organizer document:", err);
          }
        }

        // Fetch real registrations for this event to get actual attendees and Google profile pics
        let enrichedRegistrations = [];
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

        if (isMounted) {
          setEvent(eventData);
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
          }
        },
        (err) => console.warn("Real-time event sync warning:", err?.message)
      );
    } catch (err) {
      console.warn("Could not bind real-time event listener:", err);
    }

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

    return () => {
      if (typeof unsubEvent === "function") unsubEvent();
      if (typeof unsubRegs === "function") unsubRegs();
    };
  }, [event?.id]);

  if (isLoading) {
    return (
      <BrandLoader
        message="Loading event"
        subMessage="TicketLelo Verified Experience"
        fullScreen
      />
    );
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

  // Date parsing
  const eventDateObj = event.startDate ? new Date(event.startDate) : (event.date ? new Date(event.date) : new Date());
  const monthShort = eventDateObj.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  const dayNum = eventDateObj.getDate();
  const weekdayDate = eventDateObj.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" });

  const formattedTimeRange = event.startTime
    ? `${event.startTime}${event.endTime ? ` – ${event.endTime}` : ""} GMT+5:30`
    : event.time
    ? `${event.time} GMT+5:30`
    : "10:00 AM – 5:00 PM GMT+5:30";

  const totalSeats = Number(event.globalCapacity || event.capacity || event.maxCapacity || 0);
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

  const themeLook = getThemeLook(event.themeColor || event.theme || "#FE760B");
  const posterLines = getPosterLines(event.title || event.name || "Event");

  const organizerName =
    organizerUser?.fullName ||
    organizerUser?.displayName ||
    event.organizerName ||
    "School of Engineering";
  const organizerEmail =
    organizerUser?.email ||
    event.organizerEmail ||
    event.contactEmail ||
    event.email ||
    "support@ticketlelo.com";
  const organizerPhoto =
    organizerUser?.photoURL ||
    event.organizerPhotoUrl ||
    event.hostPhotoUrl ||
    null;

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
    <div className="min-h-screen bg-slate-50 dark:bg-[#08090B] text-slate-900 dark:text-white selection:bg-[#FE760B] selection:text-white flex flex-col relative transition-colors overflow-x-clip w-full max-w-full">
      {/* ── Animated Futuristic RGB Radial Light-Streak Background ── */}
      <AnimatedRadialBackground />

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

            {user ? (
              <div className="flex items-center gap-2">
                <Link
                  href="/dashboard"
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
      <main className="relative z-10 flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-4 sm:py-6">
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

        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] lg:grid-cols-[300px_1fr] gap-6 lg:gap-8 items-start">
          
          {/* Left Column: Square Poster, Host, Attendees, About Event, Tags */}
          <div className="w-full max-w-sm sm:max-w-md md:max-w-[300px] space-y-5 mx-auto md:mx-0 md:pt-8 lg:pt-10">
            {/* Poster Card (Perfect Square 1:1) */}
            <div
              className="w-full aspect-square rounded-2xl overflow-hidden p-5 flex flex-col justify-between relative shadow-xl border border-slate-200 dark:border-[#2A2D31] transition-all"
              style={{
                background: event.bannerUrl ? "transparent" : themeLook.gradientCss,
              }}
            >
              {event.bannerUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={event.bannerUrl}
                  alt={event.title}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <>
                  {/* Glowing sun circle graphic in upper right matching theme */}
                  <div
                    className="w-36 h-36 rounded-full absolute -top-8 -right-8 pointer-events-none opacity-90 transition-colors"
                    style={{ backgroundColor: themeLook.sun }}
                  />
                  
                  {/* Subtle Grid overlay */}
                  <div
                    className="absolute inset-0 pointer-events-none opacity-20"
                    style={{
                      backgroundImage: `linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)`,
                      backgroundSize: "20px 20px",
                    }}
                  />

                  {/* Top area spacer */}
                  <div className="relative z-10" />

                  {/* Bottom bold typographic block */}
                  <div className="relative z-10">
                    <h2
                      className="text-2xl sm:text-3xl font-black tracking-tight leading-none uppercase select-none drop-shadow-sm"
                      style={{ color: themeLook.textColor || "#FFFFFF" }}
                    >
                      {posterLines.line1}
                      {posterLines.line2 && (
                        <>
                          <br />
                          {posterLines.line2}
                        </>
                      )}
                    </h2>
                  </div>
                </>
              )}
            </div>

            {/* HOSTED BY Section with Google Profile Pic & Email */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#9B9EA4]">
                HOSTED BY
              </p>
              <div className="flex items-center gap-2.5">
                {organizerPhoto ? (
                  <img
                    src={organizerPhoto}
                    alt={organizerName}
                    referrerPolicy="no-referrer"
                    className="w-9 h-9 rounded-full object-cover border border-slate-200 dark:border-white/20 shadow-xs shrink-0"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#FE760B] to-amber-500 text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-xs">
                    {organizerName.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-bold text-slate-900 dark:text-white truncate block">
                    {organizerName}
                  </span>
                  {organizerEmail && (
                    <a
                      href={`mailto:${organizerEmail}`}
                      className="text-[11px] text-[#FE760B] hover:underline truncate block font-medium"
                    >
                      {organizerEmail}
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Attendees Section with Real Google Profile Pics & Count */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#9B9EA4]">
                {attendeeCount} GOING
              </p>
              {attendeeCount > 0 ? (
                <div className="flex items-center">
                  <div className="flex items-center -space-x-1.5 shrink-0">
                    {registrations.slice(0, 5).map((reg, idx) => (
                      reg.photoURL ? (
                        <img
                          key={reg.id || idx}
                          src={reg.photoURL}
                          alt={reg.fullName}
                          referrerPolicy="no-referrer"
                          title={reg.fullName}
                          className="w-6 h-6 rounded-full object-cover border border-white dark:border-[#131517] shadow-xs"
                        />
                      ) : (
                        <div
                          key={reg.id || idx}
                          title={reg.fullName}
                          className={`w-6 h-6 rounded-full border border-white dark:border-[#131517] flex items-center justify-center text-[9px] font-bold text-white shadow-xs ${
                            AVATAR_COLORS[idx % AVATAR_COLORS.length]
                          }`}
                        >
                          {reg.fullName.charAt(0).toUpperCase()}
                        </div>
                      )
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-[#9B9EA4] ml-2.5 truncate">
                    {attendeeSummaryText}
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-[#9B9EA4]">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>Be the first to claim a pass and join!</span>
                </div>
              )}
            </div>

            {/* ABOUT EVENT Section (Desktop Left Column) */}
            <div className="hidden md:block pt-1 space-y-1.5 border-t border-slate-200/60 dark:border-[#2A2D31]/60">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#9B9EA4]">
                ABOUT EVENT
              </p>
              <p className="text-xs text-slate-700 dark:text-[#D0D0D1] leading-relaxed whitespace-pre-line">
                {event.description || "Event description from the organiser — what's happening, who it's for and what to bring. Shown exactly as written in Create Event."}
              </p>
            </div>

            {/* Contact Host / Report Links & Category Tags */}
            <div className="pt-1 space-y-1.5 hidden md:block border-t border-slate-200/60 dark:border-[#2A2D31]/60">
              <button
                type="button"
                onClick={() => {
                  window.location.href = `mailto:${organizerEmail}?subject=Inquiry about ${encodeURIComponent(event.title)}`;
                }}
                className="text-[11px] text-slate-500 dark:text-[#9B9EA4] hover:text-slate-900 dark:hover:text-white transition-colors block text-left cursor-pointer"
              >
                Contact the host
              </button>
              <button
                type="button"
                onClick={() => {
                  window.location.href = `mailto:safety@ticketlelo.com?subject=Report Event: ${encodeURIComponent(event.title)}`;
                }}
                className="text-[11px] text-slate-500 dark:text-[#9B9EA4] hover:text-slate-900 dark:hover:text-white transition-colors block text-left cursor-pointer"
              >
                Report event
              </button>
              <div className="pt-1 flex flex-wrap gap-1.5">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-[#212327] border border-slate-200 dark:border-[#2A2D31] text-[11px] font-medium text-slate-600 dark:text-[#9B9EA4]">
                  #{event.category || "Tech"}
                </span>
                {event.isPaid ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-[#FE760B]/10 border border-[#FE760B]/20 text-[11px] font-semibold text-[#FE760B]">
                    {priceDisplay}
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-semibold text-emerald-500">
                    Free Entry
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Headline, Logistics, Registration Card, Mobile About, Location */}
          <div className="space-y-4">
            
            {/* Status Pill: Happening now */}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FE760B]/10 text-[#FE760B] border border-[#FE760B]/30 text-[11px] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FE760B] animate-pulse" />
              <span>Happening now</span>
            </div>

            {/* Event Title */}
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight">
              {event.title}
            </h1>

            {/* Date & Time Block */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-100 dark:bg-[#212327] border border-slate-200 dark:border-[#2A2D31] flex flex-col items-center justify-center text-center shrink-0 shadow-sm">
                <span className="text-[8px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#9B9EA4] leading-none">
                  {monthShort}
                </span>
                <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-tight">
                  {dayNum}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white leading-snug truncate">
                  {weekdayDate}
                </p>
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-[#9B9EA4] truncate">
                  {formattedTimeRange}
                </p>
              </div>
            </div>

            {/* Location Block */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-100 dark:bg-[#212327] border border-slate-200 dark:border-[#2A2D31] flex items-center justify-center text-slate-500 dark:text-[#9B9EA4] shrink-0 shadow-sm">
                <MapPin className="w-4 h-4 text-[#FE760B]" />
              </div>
              <div className="min-w-0 flex-1">
                <a
                  href={event.locationUrl || `https://maps.google.com/?q=${encodeURIComponent((event.venue || event.location || "") + " " + (event.city || ""))}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white hover:text-[#FE760B] transition-colors inline-flex items-center gap-1 leading-snug group"
                >
                  <span className="truncate">{event.venue || event.location || "Main Stadium Ground & Central Innovation Complex"}</span>
                  <span className="text-[10px] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform">↗</span>
                </a>
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-[#9B9EA4] truncate">
                  {event.city || "Campus Venue"}
                </p>
              </div>
            </div>

            {/* Registration Card */}
            <div className="bg-white/95 dark:bg-[#1A1C1F]/90 backdrop-blur-md border border-slate-200 dark:border-[#2A2D31] rounded-2xl p-4 sm:p-5 shadow-2xl transition-colors">
              {/* Header row */}
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-[#2A2D31]">
                <span className="text-xs font-semibold text-slate-600 dark:text-[#9B9EA4]">
                  Registration
                </span>
                <div className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-[#9B9EA4]">
                  <span className={`w-1.5 h-1.5 rounded-full ${isClosedForRegistration ? "bg-red-500" : "bg-[#FE760B] animate-pulse"}`} />
                  <span>
                    {isClosedForRegistration
                      ? "Registration Closed"
                      : hasCapacityLimit
                      ? `${seatsLeft} of ${totalSeats} spots left`
                      : "Registrations Open"}
                  </span>
                </div>
              </div>

              {/* Spot Availability Banner */}
              <div className="bg-slate-50 dark:bg-[#131517] border border-slate-200 dark:border-[#2A2D31] rounded-xl p-3 flex items-start gap-3 my-3">
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

              {/* Welcome text */}
              <p className="text-xs text-slate-700 dark:text-[#D0D0D1] mb-2.5">
                Welcome, {user?.fullName || "Guest"}! To join the event, please register below.
              </p>

              {/* User email badge if signed in */}
              {user && (
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-[#131517] border border-slate-200 dark:border-[#2A2D31] rounded-xl px-3 py-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-[#10B981] shrink-0" />
                  <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                    {user?.fullName || "Attendee"}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-[#9B9EA4] font-mono truncate">
                    {user?.email}
                  </span>
                </div>
              )}

              {/* College / Team External Form Embed Banner if configured */}
              {event?.embedRegistrationMode === "custom_iframe" && event?.customFormEmbedUrl && (
                <div className="mb-3 p-3 rounded-xl bg-orange-500/10 border border-orange-500/25 flex flex-col gap-2">
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
                    className="w-full py-2 px-3 rounded-xl bg-[#FE760B] hover:bg-[#FE760B]/90 text-black text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
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
                  subEvents={subEvents}
                  combos={combos}
                  defaultReferralCode={referralCode}
                />
              </div>
            </div>

            {/* Mobile About Event Section */}
            <div className="pt-3 md:hidden">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#9B9EA4] mb-1.5">
                ABOUT EVENT
              </p>
              <p className="text-xs sm:text-sm text-slate-700 dark:text-[#D0D0D1] leading-relaxed whitespace-pre-line">
                {event.description || "Event description from the organiser — what's happening, who it's for and what to bring. Shown exactly as written in Create Event."}
              </p>
            </div>

            {/* Mobile Footer Links */}
            <div className="pt-6 pb-2 border-t border-slate-200 dark:border-[#2A2D31]/60 flex items-center justify-between text-xs text-slate-500 dark:text-[#9B9EA4] md:hidden">
              <button
                type="button"
                onClick={() => {
                  window.location.href = `mailto:${organizerEmail}?subject=Inquiry about ${encodeURIComponent(event.title)}`;
                }}
                className="hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                Contact the host
              </button>
              <span className="text-slate-400 dark:text-[#2A2D31]">•</span>
              <button
                type="button"
                onClick={() => {
                  window.location.href = `mailto:safety@ticketlelo.com?subject=Report Event: ${encodeURIComponent(event.title)}`;
                }}
                className="hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                Report event
              </button>
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
