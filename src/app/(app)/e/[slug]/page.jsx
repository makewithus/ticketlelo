"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
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
} from "lucide-react";
import { getMajorEventBySlug, getMajorEvent } from "@/lib/events-engine";
import { getSubEventsForEvent } from "@/lib/sub-events";
import { getCombosForEvent } from "@/lib/combos";
import { DynamicRegistrationForm } from "@/components/forms/dynamic-registration-form";
import { formatEventDate } from "@/lib/date-utils";
import { useAuth } from "@/context/auth-context";
import { getThemeLook } from "@/lib/theme-utils";
import { getPosterLines } from "@/components/admin/event-create-studio";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function PublicEventBySlugPage() {
  const { user } = useAuth();
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const slug = params?.slug;
  const referralCode = searchParams?.get("ref") || "";

  const [event, setEvent] = useState(null);
  const [subEvents, setSubEvents] = useState([]);
  const [combos, setCombos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
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
      const sign = offsetMin >= 0 ? "+" : "-";
      const hours = Math.floor(Math.abs(offsetMin) / 60);
      const mins = Math.abs(offsetMin) % 60;
      const gmt = `GMT${sign}${hours}${mins ? `:${mins.toString().padStart(2, "0")}` : ":00"}`;
      setCurrentTime(`${timeStr} ${gmt}`);
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

        // Demo fallback for Tech Fest 2026 if slug matches
        if (!eventData && (slug.toLowerCase().includes("tech") || slug.toLowerCase().includes("fest"))) {
          eventData = {
            id: "tech-fest-2026",
            title: "Tech Fest 2026",
            slug: "tech-fest-2026",
            description: "[Event description from the organiser — what's happening, who it's for and what to bring. Shown exactly as written in Create Event.]",
            venue: "Main Auditorium",
            city: "School of Engineering",
            locationUrl: "https://maps.google.com/?q=Main+Auditorium",
            startDate: "2026-10-29T12:00:00Z",
            endDate: "2026-10-29T17:00:00Z",
            globalCapacity: 150,
            allocatedSeats: 86,
            price: 199,
            isPaid: true,
            isPublished: true,
            visibility: "public",
            organizerName: "School of Engineering",
          };
        } else if (!eventData && slug.toLowerCase().includes("praroha")) {
          eventData = {
            id: "praroha-2027",
            title: "PRAROHA 2027",
            slug: "praroha-2027",
            description: "Annual Tech & Cultural Fest. A multi-day summit featuring workshops, hackathons, and esports.",
            venue: "Main Stadium Ground & Central Innovation Complex",
            city: "Kochi, Kerala",
            startDate: "2027-03-10T09:00:00Z",
            globalCapacity: 5000,
            allocatedSeats: 4200,
            price: 199,
            isPaid: true,
            isPublished: true,
            visibility: "public",
            organizerName: "School of Engineering",
          };
        }

        if (!eventData || (!eventData.isPublished && eventData.visibility !== "public")) {
          if (isMounted) {
            setNotFound(true);
            setIsLoading(false);
          }
          return;
        }

        if (!subEventsData || !combosData) {
          const [fetchedSubs, fetchedCombos] = await Promise.all([
            getSubEventsForEvent(eventData.id).catch(() => []),
            getCombosForEvent(eventData.id).catch(() => []),
          ]);
          subEventsData = fetchedSubs;
          combosData = fetchedCombos;
        }

        if (isMounted) {
          setEvent(eventData);
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#131517] text-white flex flex-col items-center justify-center p-6 space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-[#FE760B]" />
        <p className="text-xs text-[#9B9EA4]">Loading event...</p>
      </div>
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
  const eventDateObj = event.startDate ? new Date(event.startDate) : (event.date ? new Date(event.date) : new Date(2026, 9, 29));
  const monthShort = eventDateObj.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  const dayNum = eventDateObj.getDate();
  const weekdayDate = eventDateObj.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" });

  const totalSeats = event.globalCapacity || 150;
  const takenSeats = event.allocatedSeats || 86;
  const seatsLeft = Math.max(0, totalSeats - takenSeats);
  const priceDisplay = event.price !== undefined ? `₹${event.price}` : "₹199";

  const themeLook = getThemeLook(event.themeColor || event.theme || "#FE760B");
  const posterLines = getPosterLines(event.title || event.name || "Tech Fest '26");

  return (
    <div className="min-h-screen bg-[#131517] text-white selection:bg-[#FE760B] selection:text-white flex flex-col relative">
      {/* Proper warm ambient lighting matching Image 1 */}
      <div className="pointer-events-none fixed top-0 left-0 w-full h-[650px] overflow-hidden z-0 select-none">
        {/* Soft top-left ambient wash across the viewport corner */}
        <div
          className="absolute -top-36 -left-32 w-[600px] sm:w-[780px] h-[600px] sm:h-[780px] rounded-full"
          style={{
            background: `radial-gradient(circle, ${themeLook.hex}2b 0%, ${themeLook.hex}14 35%, ${themeLook.hex}05 60%, transparent 75%)`,
            filter: "blur(75px)",
          }}
        />
        {/* Focused warm backlight directly behind the event artwork & logo */}
        <div className="max-w-5xl mx-auto relative h-full">
          <div
            className="absolute top-2 -left-12 w-[440px] h-[440px] rounded-full"
            style={{
              background: `radial-gradient(circle, ${themeLook.hex}26 0%, ${themeLook.hex}0d 45%, transparent 70%)`,
              filter: "blur(55px)",
            }}
          />
        </div>
      </div>

      {/* Top Navigation matching Image 1 */}
      <header className="relative z-20 border-b border-[#2A2D31]/60 px-4 sm:px-8 py-2.5 sm:py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          {/* Left: Logo + Explore events */}
          <div className="flex items-center gap-6">
            <Link href="/" className="inline-flex items-center">
              <img
                src="/logo/ticketlelo-logo-nav.png"
                alt="TicketLelo"
                className="h-6 w-auto object-contain"
              />
            </Link>
            <Link
              href="/"
              className="text-xs sm:text-sm font-medium text-[#D0D0D1] hover:text-white transition-colors"
            >
              Explore events
            </Link>
          </div>

          {/* Right: Live time + ThemeToggle + Sign in / Account */}
          <div className="flex items-center gap-3 sm:gap-4">
            <span
              className="text-[12px] sm:text-[13px] font-sans font-medium text-[#9B9EA4] tracking-normal tabular-nums select-none"
              suppressHydrationWarning
            >
              {mounted ? currentTime : "1:04 PM GMT+5:30"}
            </span>

            <ThemeToggle inline />

            {user ? (
              <div className="flex items-center gap-2">
                <Link
                  href="/admin/dashboard"
                  className="bg-[#212327] hover:bg-[#2A2D31] border border-[#2A2D31] text-white text-xs font-semibold px-3 py-1.5 rounded-xl transition-all"
                >
                  Create Event
                </Link>
                <Link
                  href="/dashboard"
                  className="w-7 h-7 rounded-full bg-[#FE760B] text-[#131517] font-bold text-xs flex items-center justify-center hover:opacity-90 transition-opacity"
                >
                  {(user.fullName || user.email || "U").charAt(0).toUpperCase()}
                </Link>
              </div>
            ) : (
              <Link
                href="/login"
                className="bg-[#212327] hover:bg-[#2A2D31] border border-[#2A2D31] text-white text-xs font-semibold px-3.5 py-1.5 rounded-xl transition-all shadow-sm"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Layout matching Image 1 */}
      <main className="relative z-10 flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-4 sm:py-6">
        <div className="grid grid-cols-1 md:grid-cols-[210px_1fr] gap-6 lg:gap-8 items-start">
          
          {/* Left Column: Poster, Host, Attendees */}
          <div className="w-full max-w-[210px] space-y-4 mx-auto md:mx-0">
            {/* Poster Card matching Image 1 */}
            <div
              className="w-full aspect-[3/4] rounded-2xl overflow-hidden p-4 flex flex-col justify-between relative shadow-2xl border border-[#2A2D31] transition-all"
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
                      className="text-3xl font-black tracking-tight leading-none uppercase select-none drop-shadow-sm"
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

            {/* HOSTED BY Section matching Image 1 */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#9B9EA4] mb-1.5">
                HOSTED BY
              </p>
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-[#FE760B] text-white flex items-center justify-center text-[11px] font-bold shrink-0 shadow-sm">
                  SE
                </div>
                <span className="text-xs font-bold text-white">
                  {event.organizerName || "School of Engineering"}
                </span>
              </div>
            </div>

            {/* 86 GOING Attendees Section matching Image 1 */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#9B9EA4] mb-1.5">
                {takenSeats} GOING
              </p>
              <div className="flex items-center">
                {/* 5 Stacked avatar circles */}
                <div className="flex items-center -space-x-1 shrink-0">
                  <div className="w-5 h-5 rounded-full bg-blue-600 border border-[#131517] flex items-center justify-center text-[9px] font-bold text-white">
                    AK
                  </div>
                  <div className="w-5 h-5 rounded-full bg-purple-600 border border-[#131517] flex items-center justify-center text-[9px] font-bold text-white">
                    PS
                  </div>
                  <div className="w-5 h-5 rounded-full bg-teal-600 border border-[#131517] flex items-center justify-center text-[9px] font-bold text-white">
                    RM
                  </div>
                  <div className="w-5 h-5 rounded-full bg-amber-600 border border-[#131517] flex items-center justify-center text-[9px] font-bold text-white">
                    SN
                  </div>
                  <div className="w-5 h-5 rounded-full bg-pink-600 border border-[#131517] flex items-center justify-center text-[9px] font-bold text-white">
                    VS
                  </div>
                </div>
                <p className="text-[11px] text-[#9B9EA4] ml-2.5 truncate">
                  Aarav Kumar, Priya Sharma and {Math.max(1, takenSeats - 2)} others
                </p>
              </div>
            </div>

            {/* Contact Host / Report Links matching Image 1 */}
            <div className="pt-1 space-y-1">
              <button
                type="button"
                onClick={() => {
                  window.location.href = `mailto:support@ticketlelo.com?subject=Inquiry about ${encodeURIComponent(event.title)}`;
                }}
                className="text-[11px] text-[#9B9EA4] hover:text-white transition-colors block"
              >
                Contact the host
              </button>
              <button
                type="button"
                onClick={() => {
                  window.location.href = `mailto:safety@ticketlelo.com?subject=Report Event: ${encodeURIComponent(event.title)}`;
                }}
                className="text-[11px] text-[#9B9EA4] hover:text-white transition-colors block"
              >
                Report event
              </button>
            </div>
          </div>

          {/* Right Column: Headline, Logistics, Registration Card, About, Location */}
          <div className="space-y-3.5">
            
            {/* Status Pill: Happening now */}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#2A1D13] text-[#FE760B] border border-[#FE760B]/30 text-[11px] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FE760B]" />
              <span>Happening now</span>
            </div>

            {/* Event Title */}
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
              {event.title}
            </h1>

            {/* Date & Time Block */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#212327] border border-[#2A2D31] flex flex-col items-center justify-center text-center shrink-0">
                <span className="text-[8px] font-bold uppercase tracking-wider text-[#9B9EA4] leading-none">
                  {monthShort}
                </span>
                <span className="text-xs font-bold text-white leading-tight">
                  {dayNum}
                </span>
              </div>
              <div>
                <p className="text-xs font-semibold text-white leading-snug">
                  {weekdayDate}
                </p>
                <p className="text-[11px] text-[#9B9EA4]">
                  12:00 PM – 5:00 PM GMT+5:30
                </p>
              </div>
            </div>

            {/* Location Block */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#212327] border border-[#2A2D31] flex items-center justify-center text-[#9B9EA4] shrink-0">
                <MapPin className="w-3.5 h-3.5" />
              </div>
              <div>
                <a
                  href={event.locationUrl || "https://maps.google.com"}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-white hover:text-[#FE760B] transition-colors inline-flex items-center gap-1 leading-snug"
                >
                  <span>{event.venue || "Main Auditorium"}</span>
                  <span className="text-[10px]">↗</span>
                </a>
                <p className="text-[11px] text-[#9B9EA4]">
                  {event.city || "School of Engineering"}
                </p>
              </div>
            </div>

            {/* Registration Card strictly matching Image 1 */}
            <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-4 sm:p-5 shadow-xl">
              {/* Header row */}
              <div className="flex items-center justify-between pb-2.5 border-b border-[#2A2D31]">
                <span className="text-xs font-semibold text-[#9B9EA4]">
                  Registration
                </span>
                <div className="inline-flex items-center gap-1.5 text-xs text-[#9B9EA4]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FDE003]" />
                  <span>{seatsLeft} of {totalSeats} seats left</span>
                </div>
              </div>

              {/* Subhead and price */}
              <div className="flex items-start justify-between gap-4 py-2.5">
                <p className="text-xs text-[#D0D0D1] leading-snug">
                  Welcome! Register below to get your QR ticket by email.
                </p>
                <span className="text-base sm:text-lg font-bold text-white shrink-0">
                  {priceDisplay}
                </span>
              </div>

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

            {/* ABOUT EVENT Section strictly matching Image 1 */}
            <div className="pt-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#9B9EA4] mb-1.5">
                ABOUT EVENT
              </p>
              <p className="text-xs text-[#D0D0D1] leading-relaxed whitespace-pre-line">
                {event.description || "[Event description from the organiser — what's happening, who it's for and what to bring. Shown exactly as written in Create Event.]"}
              </p>
            </div>

            {/* LOCATION Section strictly matching Image 1 */}
            <div className="pt-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#9B9EA4] mb-1.5">
                LOCATION
              </p>
              <div>
                <p className="text-xs font-semibold text-white">
                  {event.venue || "Main Auditorium"}
                </p>
                <p className="text-[11px] text-[#9B9EA4] mt-0.5">
                  {event.city || "School of Engineering"}
                </p>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
