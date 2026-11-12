"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  Ticket,
  Calendar,
  MapPin,
  Clock,
  Tag,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Info,
  Layers,
  Navigation,
  Share2,
  Users,
  Compass,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { BrandLoader } from "@/components/ui/brand-loader";
import { EventPageSkeleton } from "@/components/ui/skeleton";
import { getCachedEvent, setCachedEvent } from "@/lib/client-cache";
import { EventBanner } from "@/components/events/event-banner";
import { getEvent, subscribeToEvent } from "@/lib/firestore";
import { getMajorEventBySlug } from "@/lib/events-engine";
import { resolveEventTheme } from "@/lib/theme-utils";
import { getSubEventsForEvent } from "@/lib/sub-events";
import { getCombosForEvent } from "@/lib/combos";
import { VenueMap } from "@/components/common/venue-map";
import { DynamicRegistrationForm } from "@/components/forms/dynamic-registration-form";
import { formatEventDate } from "@/lib/date-utils";

export default function RegisterPage() {
  const { eventId } = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const referralCode = searchParams?.get("ref") || searchParams?.get("referralCode") || "";
  const { user, loading: authLoading } = useAuth();
  // Safe SSR hydration - avoids hydration mismatch
  const [event, setEvent] = useState(null);
  const [subEvents, setSubEvents] = useState([]);
  const [combos, setCombos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeStr, setTimeStr] = useState("");

  // Live IST Clock
  useEffect(() => {
    function updateClock() {
      try {
        const now = new Date();
        const time = now.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
          timeZone: "Asia/Kolkata",
        });
        setTimeStr(`${time.toLowerCase()} IST`);
      } catch {
        const now = new Date();
        const time = now.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });
        setTimeStr(`${time.toLowerCase()} IST`);
      }
    }
    updateClock();
    const interval = setInterval(updateClock, 15000);
    return () => clearInterval(interval);
  }, []);

  // Real-time Event Subscription & Data Loading
  useEffect(() => {
    if (!eventId) return;
    let unsub = null;
    let isMounted = true;

    // Fast-path client cache check on mount (runs after hydration, so zero SSR mismatch)
    try {
      const cached = getCachedEvent(eventId);
      if (cached && isMounted) {
        setEvent(cached);
        setIsLoading(false);
      }
    } catch {}

    (async () => {
      try {
        // Resolve event by ID or Slug
        let resolvedDoc = await getEvent(eventId).catch(() => null);
        if (!resolvedDoc) {
          resolvedDoc = await getMajorEventBySlug(eventId).catch(() => null);
        }

        // If event resolved and has a public slug, redirect directly to /e/[slug] for full public event experience
        if (resolvedDoc?.slug) {
          router.replace(`/e/${resolvedDoc.slug}`);
          return;
        }

        const targetEventId = resolvedDoc?.id || eventId;

        // Fetch sub-events and combos initially
        const [subEventsData, combosData] = await Promise.all([
          getSubEventsForEvent(targetEventId).catch(() => []),
          getCombosForEvent(targetEventId).catch(() => []),
        ]);

        if (!isMounted) return;
        setSubEvents(Array.isArray(subEventsData) ? subEventsData : []);
        setCombos(Array.isArray(combosData) ? combosData : []);

        if (resolvedDoc) {
          setEvent(resolvedDoc);
          setCachedEvent(targetEventId, resolvedDoc);
          setIsLoading(false);
        }

        // Real-time listener for instant theme & details synchronization
        unsub = subscribeToEvent(
          targetEventId,
          (docData) => {
            if (docData && isMounted) {
              setEvent(docData);
              setCachedEvent(targetEventId, docData);
              setIsLoading(false);
            }
          },
          async (err) => {
            console.warn("Real-time listener failed, falling back to static getEvent:", err);
            const fallback = await getEvent(targetEventId).catch(() => null);
            if (fallback && isMounted) {
              setEvent(fallback);
              setIsLoading(false);
            }
          }
        );

        if (!resolvedDoc) {
          const initial = await getEvent(targetEventId).catch(() => null);
          if (initial && isMounted) {
            setEvent(initial);
            setCachedEvent(targetEventId, initial);
            setIsLoading(false);
          }
        }
      } catch (error) {
        console.error("Failed to load event data:", error);
        if (isMounted) setIsLoading(false);
      }
    })();

    return () => {
      isMounted = false;
      if (typeof unsub === "function") {
        unsub();
      }
    };
  }, [eventId, router]);

  // Derive theme properties with canonical Minimal Theme as default / when selected
  const theme = useMemo(() => resolveEventTheme(event), [event]);
  const pageBg =
    theme?.pageBg ||
    (event?.theme === "minimal" || event?.themeName?.toLowerCase() === "minimal"
      ? "#432E01"
      : "#131517");
  const themeAccent = theme?.color || theme?.hex || "#FE760B";

  // Dynamic full-page background synchronization to ensure zero static color mismatch
  useEffect(() => {
    if (typeof document !== "undefined") {
      const prevHtmlBg = document.documentElement.style.backgroundColor;
      const prevBodyBg = document.body.style.backgroundColor;

      document.documentElement.style.backgroundColor = pageBg;
      document.body.style.backgroundColor = pageBg;
      document.documentElement.style.setProperty("--register-page-bg", pageBg);
      document.documentElement.style.setProperty("--register-theme-accent", themeAccent);

      return () => {
        document.documentElement.style.backgroundColor = prevHtmlBg;
        document.body.style.backgroundColor = prevBodyBg;
        document.documentElement.style.removeProperty("--register-page-bg");
        document.documentElement.style.removeProperty("--register-theme-accent");
      };
    }
  }, [pageBg, themeAccent]);

  const formattedDate = event ? formatEventDate(event.date || event.startDate) : "";
  const isPaid = Boolean(event?.isPaid && (event?.price || event?.amount));
  const priceDisplay = isPaid ? `₹${event?.price || event?.amount}` : "Free Pass";
  const broadLocation =
    event?.locationVenue ||
    (event?.venue && !event.venue.includes(",") ? event.venue : null) ||
    (event?.location ? event.location.split(",")[0].trim() : null) ||
    event?.venue ||
    "Campus Venue";

  if (isLoading && !event) {
    return <EventPageSkeleton />;
  }

  return (
    <div
      className="min-h-screen text-white relative selection:bg-[#FE760B] selection:text-[#131517] overflow-x-hidden transition-colors duration-300"
      style={{
        backgroundColor: pageBg,
      }}
    >
      {/* ── Seamless Integrated Header matching Theme Background ── */}
      <header
        className="sticky top-0 z-40 w-full border-b transition-colors backdrop-blur-md"
        style={{
          backgroundColor: `${pageBg}F0`,
          borderColor: "rgba(255, 255, 255, 0.12)",
        }}
      >
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Left: Brand Logo + Nav Links */}
          <div className="flex items-center gap-6 sm:gap-8">
            <Link href="/" prefetch={false} className="shrink-0 flex items-center group py-0.5">
              <Image
                src="/logo/ticketlelo-logo-nav.png"
                alt="TicketLelo"
                width={88}
                height={28}
                className="h-6 sm:h-7 w-auto object-contain transition-transform group-hover:scale-105"
                priority
              />
            </Link>
            <nav className="hidden sm:flex items-center gap-4 sm:gap-6 text-xs sm:text-sm font-medium">
              <Link
                href="/#events"
                className="text-white/80 hover:text-white transition-colors"
              >
                Events
              </Link>
              <Link
                href="/discover"
                className="inline-flex items-center gap-1.5 text-white font-semibold hover:text-[#FE760B] transition-colors"
              >
                <Compass className="w-3.5 h-3.5 text-[#FE760B]" />
                <span>Discover</span>
              </Link>
            </nav>
          </div>

          {/* Right: Live Clock + Theme Toggle + User Avatar / Sign In */}
          <div className="flex items-center gap-3 sm:gap-4">
            {timeStr && (
              <span
                className="text-[12px] sm:text-[13px] font-sans font-medium text-white/70 tracking-normal tabular-nums select-none hidden md:inline-block"
                suppressHydrationWarning
              >
                {timeStr}
              </span>
            )}
            <ThemeToggle inline />
            {authLoading ? (
              <div className="w-8 h-8 rounded-full bg-white/10 animate-pulse" />
            ) : user ? (
              <Link
                href={
                  user.role === "superAdmin"
                    ? "/superadmin"
                    : user.role === "organiser" || user.isAdmin
                    ? "/admin/dashboard"
                    : "/dashboard"
                }
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#FE760B] text-white font-bold text-xs flex items-center justify-center shadow-xs overflow-hidden"
                title={user.displayName || user.fullName || user.email}
              >
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt="Avatar"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover rounded-full"
                  />
                ) : (
                  (user.displayName || user.fullName || user.email || "U").trim().charAt(0).toUpperCase()
                )}
              </Link>
            ) : (
              <Link
                href="/login"
                className="px-3.5 py-1.5 rounded-xl bg-white/10 border border-white/20 text-xs font-semibold text-white hover:bg-white/20 transition-all shadow-sm"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="relative z-10 py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {isLoading ? (
          <div className="py-24 flex items-center justify-center min-h-[60vh]">
            <BrandLoader message="Loading..." fullScreen={false} />
          </div>
        ) : !event || event.isActive === false ? (
          <div className="text-center py-20 max-w-md mx-auto">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-[#FDE003]/10 border border-[#FDE003]/20 rounded-2xl mb-6">
              <Calendar className="w-10 h-10 text-[#FDE003]" />
            </div>
            <h3 className="text-2xl font-bold mb-2 text-white">Event unavailable</h3>
            <p className="text-white/70 mb-6 text-sm">
              This event is either past, archived, or currently not accepting registrations.
            </p>
            <Link
              href="/#events"
              className="inline-flex items-center gap-2 text-sm text-white bg-white/10 border border-white/20 px-5 py-2.5 rounded-xl hover:border-[#FE760B]/40 hover:bg-white/15 transition-all shadow-sm"
            >
              <ArrowLeft className="w-4 h-4 text-[#FE760B]" />
              <span>Back to events catalog</span>
            </Link>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-8"
          >
            {/* ── Breadcrumb & Status Ribbon ── */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
              <Link
                href="/#events"
                className="inline-flex items-center gap-2 text-sm font-semibold text-white/90 hover:text-white bg-white/[0.08] hover:bg-white/[0.14] border border-white/15 px-4 py-2 rounded-xl transition-all shadow-sm group backdrop-blur-md"
              >
                <ArrowLeft className="w-4 h-4 text-[#FE760B] group-hover:-translate-x-1 transition-transform" />
                <span>Back to events</span>
              </Link>

              <div className="flex items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm backdrop-blur-md">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  ● Registration open
                </span>
                {event.category && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30 backdrop-blur-md">
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
                <div
                  className="relative rounded-2xl overflow-hidden border p-6 sm:p-8 shadow-xl backdrop-blur-md transition-all"
                  style={{
                    backgroundColor: theme.cardBg || "rgba(255, 255, 255, 0.08)",
                    borderColor: theme.cardBorder || "rgba(255, 255, 255, 0.12)",
                  }}
                >
                  <div className="-mx-6 -mt-6 sm:-mx-8 sm:-mt-8 mb-6 overflow-hidden">
                    <EventBanner event={event} aspect="video" priority className="rounded-none sm:rounded-t-2xl border-none max-h-72" />
                  </div>

                  <div className="relative z-10 space-y-3">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-[#FE760B]/20 border border-[#FE760B]/30 text-[#FE760B] text-xs font-semibold uppercase tracking-wider">
                      <Ticket className="w-3.5 h-3.5 text-[#FE760B]" />
                      <span>Official event pass</span>
                    </div>

                    <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
                      {event.name || event.title}
                    </h1>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-white/80 pt-1">
                      {event.organiserName && (
                        <p className="flex items-center gap-1.5">
                          <span className="text-white/50">By</span>
                          <span className="font-semibold text-white">{event.organiserName}</span>
                          <span className="inline-flex items-center text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded font-mono font-bold">
                            Verified
                          </span>
                        </p>
                      )}
                      {event.totalTickets && (
                        <p className="flex items-center gap-1 text-xs text-white/70">
                          <Users className="w-3.5 h-3.5 text-white/50" />
                          <span>
                            {String(event.capacity || event.totalTickets).toLowerCase().includes("unlimited") || Number(event.totalTickets) >= 9999
                              ? "Open Access (Unlimited spots)"
                              : `${Math.max(0, Number(event.totalTickets) - Number(event.attendeesCount || event.registeredGuestsCount || 0))} spots left`}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Logistics Matrix (4 Highlights) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Date & Time */}
                  <div
                    className="p-4 rounded-2xl border flex items-start gap-3.5 transition-all shadow-md backdrop-blur-md hover:border-white/30"
                    style={{
                      backgroundColor: theme.cardBg || "rgba(255, 255, 255, 0.08)",
                      borderColor: theme.cardBorder || "rgba(255, 255, 255, 0.12)",
                    }}
                  >
                    <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-300 border border-blue-500/30 shrink-0">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white/60 uppercase tracking-wider">Date & Time</p>
                      <p className="text-sm font-bold text-white mt-0.5 truncate">{formattedDate}</p>
                      <p className="text-xs text-white/75 mt-0.5">{event.time || event.startTime || "Schedule below"}</p>
                    </div>
                  </div>

                  {/* Venue Location */}
                  <div
                    className="p-4 rounded-2xl border flex items-start gap-3.5 transition-all shadow-md backdrop-blur-md hover:border-white/30"
                    style={{
                      backgroundColor: theme.cardBg || "rgba(255, 255, 255, 0.08)",
                      borderColor: theme.cardBorder || "rgba(255, 255, 255, 0.12)",
                    }}
                  >
                    <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white/60 uppercase tracking-wider">Venue Location</p>
                      <p className="text-sm font-bold text-white mt-0.5 truncate">{broadLocation}</p>
                      <p className="text-xs text-white/75 mt-0.5 truncate">{event.subVenue || event.room || event.city || "Check gate on arrival"}</p>
                    </div>
                  </div>

                  {/* Ticket Pricing */}
                  <div
                    className="p-4 rounded-2xl border flex items-start gap-3.5 transition-all shadow-md backdrop-blur-md hover:border-white/30"
                    style={{
                      backgroundColor: theme.cardBg || "rgba(255, 255, 255, 0.08)",
                      borderColor: theme.cardBorder || "rgba(255, 255, 255, 0.12)",
                    }}
                  >
                    <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                      <Tag className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white/60 uppercase tracking-wider">Admission Type</p>
                      <p className="text-sm font-bold text-white mt-0.5">{priceDisplay}</p>
                      <p className="text-xs text-white/75 mt-0.5">
                        {isPaid ? "Tax-inclusive (18% GST)" : "Complimentary Registration"}
                      </p>
                    </div>
                  </div>

                  {/* QR Entry */}
                  <div
                    className="p-4 rounded-2xl border flex items-start gap-3.5 transition-all shadow-md backdrop-blur-md hover:border-white/30"
                    style={{
                      backgroundColor: theme.cardBg || "rgba(255, 255, 255, 0.08)",
                      borderColor: theme.cardBorder || "rgba(255, 255, 255, 0.12)",
                    }}
                  >
                    <div className="p-2.5 rounded-xl bg-[#FE760B]/20 text-[#FE760B] border border-[#FE760B]/30 shrink-0">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white/60 uppercase tracking-wider">Digital Pass</p>
                      <p className="text-sm font-bold text-white mt-0.5">Cryptographic QR</p>
                      <p className="text-xs text-white/75 mt-0.5">Instant PDF & Wallet ticket</p>
                    </div>
                  </div>
                </div>

                {/* About This Event Card */}
                <div
                  className="p-6 sm:p-7 rounded-2xl border space-y-4 shadow-md backdrop-blur-md"
                  style={{
                    backgroundColor: theme.cardBg || "rgba(255, 255, 255, 0.08)",
                    borderColor: theme.cardBorder || "rgba(255, 255, 255, 0.12)",
                  }}
                >
                  <div className="flex items-center gap-2 text-white font-bold text-lg border-b border-white/10 pb-3">
                    <Info className="w-5 h-5 text-blue-400" />
                    <h2>About this event</h2>
                  </div>
                  <div className="prose max-w-none text-white/85 text-sm sm:text-base leading-relaxed whitespace-pre-line">
                    {event.description || (
                      <p>
                        Welcome to {event.name || "this event"}! Register below to reserve your entry pass. Upon completing your registration, you will receive an official PDF ticket containing your signed HMAC-SHA-256 QR code for rapid contactless entry at the gate.
                      </p>
                    )}
                  </div>
                </div>

                {/* Included Sub-Events / Tracks (if available) */}
                {subEvents && subEvents.length > 0 && (
                  <div
                    className="p-6 sm:p-7 rounded-2xl border space-y-4 shadow-md backdrop-blur-md"
                    style={{
                      backgroundColor: theme.cardBg || "rgba(255, 255, 255, 0.08)",
                      borderColor: theme.cardBorder || "rgba(255, 255, 255, 0.12)",
                    }}
                  >
                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                      <div className="flex items-center gap-2 text-white font-bold text-lg">
                        <Layers className="w-5 h-5 text-[#FE760B]" />
                        <h2>Included tracks & sessions</h2>
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#FE760B]/20 text-[#FE760B] border border-[#FE760B]/30">
                        {subEvents.length} Tracks
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {subEvents.map((sub) => (
                        <div
                          key={sub.id}
                          className="p-3.5 rounded-xl bg-white/[0.05] border border-white/10 space-y-1.5 hover:border-white/30 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-sm font-bold text-white truncate">{sub.title}</h4>
                            <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 shrink-0">
                              {sub.trackType || "Track"}
                            </span>
                          </div>
                          <p className="text-xs text-white/70 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-white/50 shrink-0" />
                            <span>{sub.startTime || "10:00 AM"} - {sub.endTime || "01:00 PM"}</span>
                          </p>
                          {sub.venue && (
                            <p className="text-xs text-white/70 flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-white/50 shrink-0" />
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
                  <div
                    className="p-6 sm:p-7 rounded-2xl border space-y-4 shadow-md backdrop-blur-md"
                    style={{
                      backgroundColor: theme.cardBg || "rgba(255, 255, 255, 0.08)",
                      borderColor: theme.cardBorder || "rgba(255, 255, 255, 0.12)",
                    }}
                  >
                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                      <div className="flex items-center gap-2 text-white font-bold text-lg">
                        <Sparkles className="w-5 h-5 text-amber-400" />
                        <h2>Festival passes & bundles</h2>
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {combos.length} Passes Available
                      </span>
                    </div>

                    <div className="space-y-3">
                      {combos.map((combo) => (
                        <div
                          key={combo.id}
                          className="p-4 rounded-xl bg-white/[0.05] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-white/30 transition-colors"
                        >
                          <div>
                            <h4 className="text-sm font-bold text-white">{combo.title}</h4>
                            <p className="text-xs text-white/70 mt-0.5">{combo.description || "All-access multi-track festival ticket"}</p>
                            {combo.perks && combo.perks.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {combo.perks.slice(0, 3).map((perk, idx) => (
                                  <span key={idx} className="text-[10px] px-2 py-0.5 rounded bg-white/10 border border-white/15 text-white/80">
                                    {perk}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="sm:text-right shrink-0">
                            <span className="text-base font-extrabold text-[#FE760B] tabular-nums">₹{combo.price || 0}</span>
                            <span className="block text-[11px] text-white/50">Tax Incl.</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Interactive Venue Map */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-white font-bold text-lg px-1">
                    <Navigation className="w-5 h-5 text-emerald-400" />
                    <h2>Venue & navigation</h2>
                  </div>
                  <VenueMap
                    venueName={event.locationVenue || broadLocation || event.venue || event.name}
                    subVenue={event.subVenue || event.room}
                    address={event.locationAddress || event.address || event.venueAddress || event.location}
                    city={event.city || ""}
                    latitude={event.latitude || event.lat || null}
                    longitude={event.longitude || event.lng || null}
                    themeColor={themeAccent}
                  />
                </div>
              </div>

              {/* ── RIGHT COLUMN: Sticky Registration & Checkout Drawer (5 Cols) ── */}
              <div className="lg:col-span-5 lg:sticky lg:top-24">
                <div
                  className="rounded-2xl border p-6 sm:p-7 shadow-2xl backdrop-blur-xl transition-all"
                  style={{
                    backgroundColor: theme.cardBg || "rgba(255, 255, 255, 0.08)",
                    borderColor: theme.cardBorder || "rgba(255, 255, 255, 0.12)",
                  }}
                >
                  <div className="border-b border-white/10 pb-5 mb-6 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/10 border border-white/15 text-white text-xs font-semibold">
                        <Ticket className="w-3.5 h-3.5 text-[#FE760B]" />
                        <span>Attendee registration</span>
                      </div>
                      <span className="text-xs font-bold text-white bg-white/10 border border-white/15 px-2.5 py-1 rounded-full">
                        {priceDisplay}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-xl font-bold text-white tracking-tight">
                        Register for {event.name || "Event"}
                      </h3>
                      <p className="text-xs text-white/70 mt-1">
                        Fill in your details below to generate your entry ticket and credentials.
                      </p>
                    </div>
                  </div>

                  {/* Dynamic Form Embed */}
                  <DynamicRegistrationForm
                    eventId={event.id}
                    event={event}
                    themeColor={themeAccent}
                    defaultReferralCode={referralCode}
                  />

                  {/* Micro Trust Strip */}
                  <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-[11px] text-white/60">
                    <span className="flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      100% secure checkout
                    </span>
                    <span>TicketLelo verified</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
