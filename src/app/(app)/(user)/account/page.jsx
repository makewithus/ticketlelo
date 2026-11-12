"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { useTheme } from "next-themes";
import {
  Bell,
  Ticket,
  User,
  Compass,
  Calendar,
  Sparkles,
  ArrowRight,
  ExternalLink,
  Shield,
} from "lucide-react";
import { getPlan } from "@/lib/plans";
import { getEventsByOrganiser, subscribeToUserRegistrations } from "@/lib/firestore";
import { BrandLoader } from "@/components/ui/brand-loader";

export default function AccountPage() {
  const { user, logout, loading: authLoading } = useAuth();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [registrations, setRegistrations] = useState([]);
  const [loadingRegistrations, setLoadingRegistrations] = useState(true);
  const [appearance, setAppearance] = useState("dark");
  const [currentTime, setCurrentTime] = useState("1:04 PM IST");

  const emailLower = (user?.email || "").toLowerCase().trim();
  const isSuperAdmin =
    user?.role === "superAdmin" ||
    user?.role === "superadmin" ||
    Boolean(user?.isAdmin) ||
    emailLower === "adil4ticketlelo@gmail.com" ||
    emailLower === "superadmin@ticketlelo.com";

  const isOrganiser = isSuperAdmin || user?.role === "organiser" || user?.role === "organizer";

  const currentPlanId = user?.plan || "free";
  const plan = getPlan(currentPlanId);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login?redirect=/account");
    }
  }, [user, authLoading, router]);

  // Live IST clock
  useEffect(() => {
    const updateTime = () => {
      try {
        const now = new Date();
        const time = now.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
          timeZone: "Asia/Kolkata",
        });
        setCurrentTime(`${time.toLowerCase()} IST`);
      } catch {
        const now = new Date();
        const time = now.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });
        setCurrentTime(`${time.toLowerCase()} IST`);
      }
    };
    updateTime();
    const timer = setInterval(updateTime, 15000);
    return () => clearInterval(timer);
  }, []);

  // Sync appearance with theme
  useEffect(() => {
    if (theme) {
      const timer = setTimeout(() => setAppearance(theme), 0);
      return () => clearTimeout(timer);
    }
  }, [theme]);

  // Load real non-deleted events for organiser / superAdmin
  const loadEvents = useCallback(async () => {
    if (!user?.id || !isOrganiser) {
      setLoadingEvents(false);
      return;
    }
    setLoadingEvents(true);
    try {
      const data = await getEventsByOrganiser(user.id);
      const filtered = (data || []).filter(
        (e) => !e.isDeleted && !e.deleted && e.status !== "deleted"
      );
      setEvents(filtered);
    } catch (e) {
      console.error("Failed to load user events:", e);
      setEvents([]);
    } finally {
      setLoadingEvents(false);
    }
  }, [user?.id, isOrganiser]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Load registrations for user / attendee
  useEffect(() => {
    if (!user?.id) {
      setLoadingRegistrations(false);
      return;
    }
    try {
      const unsub = subscribeToUserRegistrations(user.id, (regs) => {
        setRegistrations(Array.isArray(regs) ? regs : []);
        setLoadingRegistrations(false);
      });
      return () => unsub?.();
    } catch (e) {
      console.warn("Registrations subscription notice:", e);
      setLoadingRegistrations(false);
    }
  }, [user?.id]);

  const displayName = user?.fullName || user?.name || (isOrganiser ? "Organiser" : "TicketLelo Member");
  const displayEmail = user?.email || "";
  const firstChar = (displayName || "U").trim().charAt(0).toUpperCase();
  const photoURL = user?.photoURL || "";

  // Real stats for organiser
  const eventsCount = events.length;
  const eventsLimit = currentPlanId === "starter" ? 3 : currentPlanId === "pro" ? 10 : currentPlanId === "fest" ? 999 : 1;
  const isOverLimit = eventsLimit < 999 && eventsCount > eventsLimit;
  const largestGuestCount = events.length > 0
    ? Math.max(0, ...events.map((e) => Number(e.registrationsCount || e.attendeesCount || 0)))
    : 0;

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/login");
    } catch (e) {
      console.error("Logout error:", e);
    }
  };

  if (authLoading || !user) {
    return <BrandLoader message="Loading account..." fullScreen />;
  }

  return (
    <div className="min-h-screen bg-[#131517] text-white selection:bg-[#FE760B] selection:text-white flex flex-col w-full max-w-full overflow-x-clip">
      {/* ── Top Header Navigation Bar ── */}
      <header className="relative z-20 w-full border-b border-[#2A2D31]/60 px-4 sm:px-6 lg:px-8 py-3">
        <div className="w-full flex items-center justify-between">
          {/* Left: Logo & Navigation Tabs */}
          <div className="flex items-center gap-6 sm:gap-8">
            <Link href="/" className="shrink-0 flex items-center group py-0.5">
              <img
                src="/logo/ticketlelo-logo-nav.png"
                alt="TicketLelo"
                className="h-6 sm:h-7 w-auto object-contain transition-opacity group-hover:opacity-95"
              />
            </Link>

            {/* Desktop Dashboard Navigation Links */}
            <div className="hidden md:flex items-center gap-1 bg-[#1A1C1F] border border-[#2A2D31] p-1 rounded-xl text-xs font-semibold">
              <Link
                href="/dashboard"
                className="px-3 py-1.5 rounded-lg text-[#9B9EA4] hover:text-white transition-colors"
              >
                Overview
              </Link>
              <Link
                href="/my-tickets"
                className="px-3 py-1.5 rounded-lg text-[#9B9EA4] hover:text-white transition-colors"
              >
                My Tickets
              </Link>
              <Link
                href="/account"
                className="px-3 py-1.5 rounded-lg bg-[#FE760B] text-white shadow-xs font-bold"
              >
                Account Settings
              </Link>
            </div>

            <nav className="flex items-center gap-4 sm:gap-6">
              <Link
                href="/"
                className="flex items-center gap-1.5 text-xs font-medium text-[#D0D0D1] hover:text-white transition-colors"
              >
                <Ticket className="w-3.5 h-3.5 text-[#9B9EA4]" />
                <span>Events</span>
              </Link>
              <Link
                href="/discover"
                className="flex items-center gap-1.5 text-xs font-medium text-white transition-colors"
              >
                <Compass className="w-3.5 h-3.5 text-[#FE760B]" />
                <span>Discover</span>
              </Link>
            </nav>
          </div>

          {/* Right: Live Time + Action + Bell + Avatar */}
          <div className="flex items-center gap-3 sm:gap-4">
            <span
              className="text-[12px] sm:text-[13px] font-sans font-medium text-[#9B9EA4] tracking-normal tabular-nums select-none hidden md:inline-block"
              suppressHydrationWarning
            >
              {currentTime}
            </span>

            {isOrganiser ? (
              <Link
                href="/admin/dashboard"
                className="text-xs font-medium text-[#D0D0D1] hover:text-white transition-colors cursor-pointer"
              >
                Create Event
              </Link>
            ) : (
              <Link
                href="/host-event"
                className="text-xs font-medium text-[#FE760B] hover:text-[#FF8A2B] transition-colors cursor-pointer"
              >
                Host an Event
              </Link>
            )}

            {/* Notification Bell */}
            <Link
              href="/activity"
              title="Notifications"
              className="relative p-1.5 text-[#D0D0D1] hover:text-white transition-colors"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#FE760B] border-2 border-[#131517]" />
            </Link>

            {/* Profile Avatar Circle */}
            <div
              title={displayName}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#FE760B] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs overflow-hidden"
            >
              {photoURL ? (
                <img
                  src={photoURL}
                  alt={displayName}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                firstChar
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── Main Content Area ── */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Header: Title */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Account
          </h1>
          {isSuperAdmin && (
            <Link
              href="/superadmin"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#FE760B]/60 text-[#FE760B] hover:bg-[#FE760B]/10 text-xs font-semibold transition-all"
            >
              <Shield className="w-3.5 h-3.5 text-[#FE760B]" />
              <span>Super Admin Suite</span>
            </Link>
          )}
        </div>

        {/* 1. User Profile Card */}
        <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-full bg-[#FE760B] flex items-center justify-center text-white font-bold text-base shrink-0 shadow-xs overflow-hidden">
              {photoURL ? (
                <img
                  src={photoURL}
                  alt={displayName}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                firstChar
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white tracking-tight">
                  {displayName}
                </h2>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#212327] border border-[#2A2D31] text-[11px] text-[#9B9EA4] font-normal">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isSuperAdmin
                        ? "bg-[#FE760B]"
                        : isOrganiser
                        ? "bg-[#3DD68C]"
                        : "bg-[#9B9EA4]"
                    }`}
                  />
                  <span>
                    {isSuperAdmin
                      ? "Super Admin"
                      : isOrganiser
                      ? `${plan.name} plan`
                      : "Attendee"}
                  </span>
                </div>
              </div>
              <p className="text-xs text-[#9B9EA4] font-normal mt-0.5">
                {displayEmail}
              </p>
            </div>
          </div>

          {isOrganiser ? (
            <Link
              href="/pricing"
              className="bg-[#FE760B] hover:bg-[#FF8A2B] text-white font-medium text-xs px-4 py-2 rounded-xl transition-all shadow-md shadow-[#FE760B]/20 text-center shrink-0"
            >
              Upgrade plan
            </Link>
          ) : (
            <Link
              href="/my-tickets"
              className="bg-[#212327] hover:bg-[#2A2D31] border border-[#2A2D31] text-white font-medium text-xs px-4 py-2 rounded-xl transition-all text-center shrink-0"
            >
              My Tickets →
            </Link>
          )}
        </div>

        {/* 2. ORGANISER ONLY: Real Usage Section */}
        {isOrganiser && (
          <div>
            <h2 className="text-sm font-bold text-white mb-2.5">Usage</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Events Usage Card */}
              <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#9B9EA4] font-normal">Events</span>
                  <span className="text-sm font-bold text-white">
                    {eventsCount}{" "}
                    <span className="text-[#9B9EA4] font-normal text-xs">
                      / {eventsLimit >= 999 ? "Unlimited" : eventsLimit}
                    </span>
                  </span>
                </div>
                {/* Progress bar */}
                <div className="h-1.5 w-full bg-[#2A2D31] rounded-full overflow-hidden mt-3 mb-2.5">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isOverLimit
                        ? "bg-[#FF6B6B] w-full"
                        : "bg-[#3DD68C]"
                    }`}
                    style={{
                      width: isOverLimit
                        ? "100%"
                        : `${Math.min(100, Math.max(10, (eventsCount / (eventsLimit || 1)) * 100))}%`,
                    }}
                  />
                </div>
                {isOverLimit ? (
                  <div className="flex items-center gap-1.5 text-xs text-[#FF6B6B] font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B6B]" />
                    <span>Over limit — upgrade to create more events</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs text-[#3DD68C] font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#3DD68C]" />
                    <span>
                      {eventsLimit >= 999
                        ? "Unlimited event hosting enabled"
                        : `${Math.max(0, eventsLimit - eventsCount)} event slot${
                            eventsLimit - eventsCount === 1 ? "" : "s"
                          } remaining`}
                    </span>
                  </div>
                )}
              </div>

              {/* Guests per event Card */}
              <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#9B9EA4] font-normal">Guests per event</span>
                  <span className="text-sm font-bold text-white">
                    {plan?.maxAttendees && plan.maxAttendees < 9999
                      ? plan.maxAttendees
                      : "300"}{" "}
                    <span className="text-[#9B9EA4] font-normal text-xs">max</span>
                  </span>
                </div>
                {/* Progress bar */}
                <div className="h-1.5 w-full bg-[#2A2D31] rounded-full overflow-hidden mt-3 mb-2.5">
                  <div
                    className="h-full rounded-full bg-[#3DD68C] transition-all"
                    style={{
                      width: `${Math.min(100, Math.max(8, (largestGuestCount / (plan?.maxAttendees || 300)) * 100))}%`,
                    }}
                  />
                </div>
                <div className="flex items-center gap-1.5 text-xs text-[#3DD68C] font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#3DD68C]" />
                  <span>
                    {largestGuestCount > 0
                      ? `Largest event: ${largestGuestCount} guests`
                      : "No registered guests yet"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. ORGANISER ONLY: Real Events Section */}
        {isOrganiser && (
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h2 className="text-sm font-bold text-white">Your events</h2>
              <Link
                href="/admin/dashboard"
                className="text-xs text-[#9B9EA4] hover:text-white transition-colors flex items-center gap-1 font-semibold"
              >
                Manage in Dashboard →
              </Link>
            </div>

            {loadingEvents ? (
              <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-8 text-center text-xs text-[#9B9EA4]">
                Loading your events...
              </div>
            ) : events.length === 0 ? (
              <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-8 text-center space-y-3">
                <p className="text-sm font-semibold text-white">No events created yet</p>
                <p className="text-xs text-[#9B9EA4] max-w-sm mx-auto">
                  You haven&apos;t created any events under this organiser account.
                </p>
                <div className="pt-1">
                  <Link
                    href="/admin/create-event"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FE760B] hover:bg-[#FF8A2B] text-white text-xs font-semibold shadow-xs transition-all"
                  >
                    <span>Create Your First Event</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl divide-y divide-[#2A2D31] overflow-hidden">
                {events.map((ev) => {
                  const isLive = ev.status === "live" || ev.published === true;
                  const isDraft = ev.status === "draft" || ev.isActive === false;

                  return (
                    <div
                      key={ev.id}
                      className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-[#212327]/40 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Thumbnail */}
                        <div className="w-9 h-9 rounded-lg shrink-0 bg-[#212327] border border-[#2A2D31] flex items-center justify-center text-xs font-bold text-[#FE760B] overflow-hidden relative">
                          {ev.bannerUrl || ev.coverImage || ev.posterUrl ? (
                            <img
                              src={ev.bannerUrl || ev.coverImage || ev.posterUrl}
                              alt={ev.name || ev.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Calendar className="w-4 h-4 text-[#9B9EA4]" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <Link
                            href={`/admin/overview?eventId=${ev.id}`}
                            className="text-sm font-medium text-white hover:text-[#FE760B] transition-colors truncate block"
                          >
                            {ev.name || ev.title || "Untitled Event"}
                          </Link>
                          <p className="text-xs text-[#9B9EA4] font-normal mt-0.5 truncate">
                            {ev.location || ev.locationVenue || "No venue set"}
                          </p>
                        </div>
                      </div>

                      {/* Status pill on right */}
                      <div className="shrink-0 flex items-center gap-2">
                        {isLive ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#3DD68C]/15 border border-[#3DD68C]/30 text-[#3DD68C] text-xs font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#3DD68C]" />
                            <span>Live</span>
                          </span>
                        ) : isDraft ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#212327] border border-[#2A2D31] text-[#9B9EA4] text-xs font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#9B9EA4]" />
                            <span>Draft</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FE760B]/15 border border-[#FE760B]/30 text-[#FE760B] text-xs font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#FE760B]" />
                            <span>Published</span>
                          </span>
                        )}
                        <Link
                          href={`/admin/overview?eventId=${ev.id}`}
                          className="text-xs text-[#9B9EA4] hover:text-white px-2 py-1 rounded-lg border border-[#2A2D31] hover:bg-[#212327] transition-colors hidden sm:inline-block"
                        >
                          Manage
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 4. ATTENDEE / USER ONLY: My Tickets & Registrations Section */}
        {!isOrganiser && (
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h2 className="text-sm font-bold text-white">Your Tickets & Registrations</h2>
              <Link
                href="/my-tickets"
                className="text-xs text-[#9B9EA4] hover:text-white transition-colors flex items-center gap-1 font-semibold"
              >
                View all passes →
              </Link>
            </div>

            {loadingRegistrations ? (
              <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-8 text-center text-xs text-[#9B9EA4]">
                Checking your registered passes...
              </div>
            ) : registrations.length === 0 ? (
              <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-8 text-center space-y-3">
                <div className="w-10 h-10 rounded-xl bg-[#FE760B]/10 border border-[#FE760B]/20 flex items-center justify-center mx-auto text-[#FE760B]">
                  <Ticket className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">No active tickets yet</h3>
                  <p className="text-xs text-[#9B9EA4] mt-1 max-w-sm mx-auto">
                    When you register for workshops, hackathons, concerts, or fests, your tickets and QR passes will appear here.
                  </p>
                </div>
                <div className="pt-1">
                  <Link
                    href="/discover"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FE760B] hover:bg-[#FF8A2B] text-white text-xs font-semibold shadow-xs transition-all"
                  >
                    <Compass className="w-3.5 h-3.5" />
                    <span>Explore Events</span>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl divide-y divide-[#2A2D31] overflow-hidden">
                {registrations.slice(0, 4).map((reg) => (
                  <div
                    key={reg.id}
                    className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-[#212327]/40 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg shrink-0 bg-[#212327] border border-[#2A2D31] flex items-center justify-center text-[#FE760B]">
                        <Ticket className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {reg.eventName || reg.eventTitle || "Registered Event"}
                        </p>
                        <p className="text-xs text-[#9B9EA4] font-normal mt-0.5 truncate font-mono">
                          {reg.ticketId || reg.id}
                        </p>
                      </div>
                    </div>
                    <Link
                      href="/my-tickets"
                      className="text-xs text-[#FE760B] hover:text-[#FF8A2B] font-semibold shrink-0"
                    >
                      View Pass →
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 5. ATTENDEE / USER ONLY: Host On TicketLelo Promotion Banner */}
        {!isOrganiser && (
          <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#FE760B]" />
                <h3 className="text-sm font-semibold text-white">Want to organize your own event?</h3>
              </div>
              <p className="text-xs text-[#9B9EA4] max-w-md">
                Launch your college fest, tech meetup, or club conference. Get customizable registration pages, QR ticket scanners, and automated emails.
              </p>
            </div>
            <Link
              href="/host-event"
              className="bg-[#212327] hover:bg-[#2A2D31] border border-[#2A2D31] text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-all whitespace-nowrap text-center shrink-0"
            >
              Request Hosting Access →
            </Link>
          </div>
        )}

        {/* 6. Preferences Section */}
        <div>
          <h2 className="text-sm font-bold text-white mb-2.5">Preferences</h2>
          <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-white">Appearance</p>
              <p className="text-xs text-[#9B9EA4] font-normal mt-0.5">
                Matches the Dark Mode switch across TicketLelo
              </p>
            </div>

            {/* Segmented control: Dark | Light | System */}
            <div className="bg-[#212327] border border-[#2A2D31] p-1 rounded-xl flex items-center gap-1 text-xs shrink-0 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => {
                  setAppearance("dark");
                  setTheme("dark");
                }}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  appearance === "dark"
                    ? "bg-[#2A2D31] text-white font-semibold shadow-sm"
                    : "text-[#9B9EA4] hover:text-white font-normal"
                }`}
              >
                Dark
              </button>
              <button
                type="button"
                onClick={() => {
                  setAppearance("light");
                  setTheme("light");
                }}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  appearance === "light"
                    ? "bg-[#2A2D31] text-white font-semibold shadow-sm"
                    : "text-[#9B9EA4] hover:text-white font-normal"
                }`}
              >
                Light
              </button>
              <button
                type="button"
                onClick={() => {
                  setAppearance("system");
                  setTheme("system");
                }}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  appearance === "system"
                    ? "bg-[#2A2D31] text-white font-semibold shadow-sm"
                    : "text-[#9B9EA4] hover:text-white font-normal"
                }`}
              >
                System
              </button>
            </div>
          </div>
        </div>

        {/* 7. ORGANISER ONLY: Plan comparison Section */}
        {isOrganiser && (
          <div>
            <h2 className="text-sm font-bold text-white mb-2.5">
              Plan comparison
            </h2>
            <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-xs">
                  <thead>
                    <tr className="border-b border-[#2A2D31] text-[10px] sm:text-[11px] uppercase tracking-wider text-[#9B9EA4]">
                      <th className="text-left px-4 sm:px-5 py-3 font-semibold whitespace-nowrap min-w-[140px]">
                        FEATURE
                      </th>
                      <th className="text-center px-4 py-3 font-bold text-[#FE760B] bg-[#2A1D13]/50 whitespace-nowrap">
                        FREE · CURRENT
                      </th>
                      <th className="text-center px-4 py-3 font-semibold text-[#9B9EA4] whitespace-nowrap">
                        STARTER
                      </th>
                      <th className="text-center px-4 py-3 font-semibold text-[#9B9EA4] whitespace-nowrap">
                        PRO
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2A2D31]">
                    <tr>
                      <td className="px-4 sm:px-5 py-3 text-[#D0D0D1] font-normal">Events</td>
                      <td className="px-4 py-3 text-center font-bold text-sm bg-[#2A1D13]/30 text-white">1</td>
                      <td className="px-4 py-3 text-center text-[#D0D0D1] font-normal">3</td>
                      <td className="px-4 py-3 text-center text-[#D0D0D1] font-normal">10</td>
                    </tr>
                    <tr>
                      <td className="px-4 sm:px-5 py-3 text-[#D0D0D1] font-normal">Guests / event</td>
                      <td className="px-4 py-3 text-center font-bold text-sm bg-[#2A1D13]/30 text-white">300</td>
                      <td className="px-4 py-3 text-center text-[#D0D0D1] font-normal">1,000</td>
                      <td className="px-4 py-3 text-center text-[#D0D0D1] font-normal">Unlimited</td>
                    </tr>
                    <tr>
                      <td className="px-4 sm:px-5 py-3 text-[#D0D0D1] font-normal">Payments & coupons</td>
                      <td className="px-4 py-3 text-center text-[#9B9EA4] bg-[#2A1D13]/30 font-normal">—</td>
                      <td className="px-4 py-3 text-center text-[#3DD68C] font-bold">Yes</td>
                      <td className="px-4 py-3 text-center text-[#3DD68C] font-bold">Yes</td>
                    </tr>
                    <tr>
                      <td className="px-4 sm:px-5 py-3 text-[#D0D0D1] font-normal">Branding & custom URL</td>
                      <td className="px-4 py-3 text-center text-[#9B9EA4] bg-[#2A1D13]/30 font-normal">—</td>
                      <td className="px-4 py-3 text-center text-[#3DD68C] font-bold">Yes</td>
                      <td className="px-4 py-3 text-center text-[#3DD68C] font-bold">Yes</td>
                    </tr>
                    <tr>
                      <td className="px-4 sm:px-5 py-3 text-[#D0D0D1] font-normal">Insights & blasts</td>
                      <td className="px-4 py-3 text-center text-[#9B9EA4] bg-[#2A1D13]/30 font-normal">—</td>
                      <td className="px-4 py-3 text-center text-[#3DD68C] font-bold">Yes</td>
                      <td className="px-4 py-3 text-center text-[#3DD68C] font-bold">Advanced</td>
                    </tr>
                    <tr>
                      <td className="px-4 sm:px-5 py-3 text-[#D0D0D1] font-normal">Priority support</td>
                      <td className="px-4 py-3 text-center text-[#9B9EA4] bg-[#2A1D13]/30 font-normal">—</td>
                      <td className="px-4 py-3 text-center text-[#9B9EA4] font-normal">—</td>
                      <td className="px-4 py-3 text-center text-[#3DD68C] font-bold">Yes</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 8. Sign Out Bar */}
        <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-4 flex items-center justify-between mt-6">
          <span className="text-xs text-[#9B9EA4] font-normal">
            Sign out of TicketLelo on this device
          </span>
          <button
            type="button"
            onClick={handleLogout}
            className="bg-[#212327] hover:bg-[#2A2D31] border border-[#2A2D31] text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all cursor-pointer"
          >
            Sign out
          </button>
        </div>
      </main>
    </div>
  );
}
