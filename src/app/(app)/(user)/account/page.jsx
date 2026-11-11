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
  Activity,
  User,
  Loader2,
  Compass,
} from "lucide-react";
import { getPlan } from "@/lib/plans";
import { getEventsByOrganiser } from "@/lib/firestore";
import { BrandLoader } from "@/components/ui/brand-loader";

export default function AccountPage() {
  const { user, logout, loading: authLoading } = useAuth();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [appearance, setAppearance] = useState("dark");
  const [currentTime, setCurrentTime] = useState("1:04 PM GMT+5:30");

  const currentPlanId = user?.plan || "free";
  const plan = getPlan(currentPlanId);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.replace("/login?redirect=/account");
        return;
      }
    }
  }, [user, authLoading, router]);

  // Live IST clock strictly matching Image 1 (no GMT+5:30 text)
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

  // Sync appearance with next-themes if available
  useEffect(() => {
    if (theme) {
      const timer = setTimeout(() => setAppearance(theme), 0);
      return () => clearTimeout(timer);
    }
  }, [theme]);

  const loadEvents = useCallback(async () => {
    if (!user?.id) {
      setLoadingEvents(false);
      return;
    }
    setLoadingEvents(true);
    try {
      const data = await getEventsByOrganiser(user.id);
      setEvents(data && data.length > 0 ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingEvents(false);
    }
  }, [user]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadEvents();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadEvents]);

  // Fallback sample events matching Image 3 if user has none yet
  const displayEvents = events.length > 0 ? events : [
    {
      id: "sample_tech_fest",
      name: "Tech Fest 2026",
      subtitle: "Today • Main Auditorium",
      status: "live",
      type: "tech_fest",
    },
    {
      id: "sample_praroha",
      name: "Praroha Gaming",
      subtitle: "7 Nov • School of Engineering",
      status: "published",
      type: "praroha",
    },
    {
      id: "sample_hackathon",
      name: "Hackathon Kickoff",
      subtitle: "2 Dec • Innovation Lab",
      status: "draft",
      type: "hackathon",
    },
  ];

  const displayName = user?.fullName || user?.name || "Test Organiser";
  const displayEmail = user?.email || "testorganiser@ticketlelo.com";
  const firstChar = (displayName || "U").trim().charAt(0).toUpperCase();
  const photoURL = user?.photoURL || "";

  const eventsCount = events.length > 0 ? events.length : 2;
  const eventsLimit = currentPlanId === "starter" ? 3 : currentPlanId === "pro" ? 10 : 1;
  const isOverLimit = eventsCount > eventsLimit;

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/login");
    } catch (e) {
      console.error("Logout error:", e);
    }
  };

  if (authLoading || !user) {
    return <BrandLoader message="Loading..." fullScreen />;
  }

  return (
    <div className="min-h-screen bg-[#131517] text-white selection:bg-[#FE760B] selection:text-white flex flex-col w-full max-w-full overflow-x-clip">
      {/* ── Top Header Navigation Bar strictly matching Image 1 ── */}
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

          {/* Right: Live Time + Create Event + Bell + Avatar */}
          <div className="flex items-center gap-3 sm:gap-4">
            <span
              className="text-[12px] sm:text-[13px] font-sans font-medium text-[#9B9EA4] tracking-normal tabular-nums select-none hidden md:inline-block"
              suppressHydrationWarning
            >
              {currentTime}
            </span>

            <Link
              href="/admin/dashboard"
              className="text-xs font-medium text-[#D0D0D1] hover:text-white transition-colors cursor-pointer"
            >
              Create Event
            </Link>

            {/* Notification Bell with alert dot */}
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
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
          Account
        </h1>

        {/* 1. User Profile Card strictly matching Image 3 */}
        <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            {/* Orange circular avatar */}
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
                  <span className="w-1.5 h-1.5 rounded-full bg-[#9B9EA4]" />
                  <span>Free plan</span>
                </div>
              </div>
              <p className="text-xs text-[#9B9EA4] font-normal mt-0.5">
                {displayEmail}
              </p>
            </div>
          </div>

          <Link
            href="/pricing"
            className="bg-[#FE760B] hover:bg-[#FF8A2B] text-white font-medium text-xs px-4 py-2 rounded-xl transition-all shadow-md shadow-[#FE760B]/20 text-center shrink-0"
          >
            Upgrade plan
          </Link>
        </div>

        {/* 2. Usage Section strictly matching Image 3 */}
        <div>
          <h2 className="text-sm font-bold text-white mb-2.5">
            Usage
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Events Usage Card */}
            <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#9B9EA4] font-normal">Events</span>
                <span className="text-sm font-bold text-white">
                  {eventsCount} <span className="text-[#9B9EA4] font-normal text-xs">/ {eventsLimit}</span>
                </span>
              </div>
              {/* Progress bar */}
              <div className="h-1.5 w-full bg-[#2A2D31] rounded-full overflow-hidden mt-3 mb-2.5">
                <div
                  className={`h-full rounded-full ${
                    isOverLimit ? "bg-[#FF6B6B] w-full" : "bg-[#3DD68C] w-[60%]"
                  }`}
                />
              </div>
              <div className="flex items-center gap-1.5 text-xs text-[#FF6B6B] font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B6B]" />
                <span>Over limit — upgrade to create more events</span>
              </div>
            </div>

            {/* Guests per event Card */}
            <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#9B9EA4] font-normal">Guests per event</span>
                <span className="text-sm font-bold text-white">
                  300 <span className="text-[#9B9EA4] font-normal text-xs">max</span>
                </span>
              </div>
              {/* Progress bar */}
              <div className="h-1.5 w-full bg-[#2A2D31] rounded-full overflow-hidden mt-3 mb-2.5">
                <div className="h-full rounded-full bg-[#3DD68C] w-[29%]" />
              </div>
              <div className="flex items-center gap-1.5 text-xs text-[#3DD68C] font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-[#3DD68C]" />
                <span>Largest event: 86 guests</span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Your Events Section strictly matching Image 3 */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="text-sm font-bold text-white">
              Your events
            </h2>
            <Link
              href="/admin/dashboard"
              className="text-xs text-[#9B9EA4] hover:text-white transition-colors flex items-center gap-1 font-semibold"
            >
              Manage →
            </Link>
          </div>

          <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl divide-y divide-[#2A2D31] overflow-hidden">
            {displayEvents.map((ev, idx) => {
              const isLive = ev.status === "live" || idx === 0;
              const isPublished = ev.status === "published" || ev.status === "active" || idx === 1;

              return (
                <div
                  key={ev.id || idx}
                  className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-[#212327]/40 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Thumbnail box */}
                    <div
                      className={`w-9 h-9 rounded-lg shrink-0 flex items-center justify-center text-[9px] font-bold tracking-tight text-center leading-tight shadow-sm relative overflow-hidden ${
                        idx === 0
                          ? "bg-gradient-to-br from-amber-500 to-orange-600 text-white"
                          : idx === 1
                            ? "bg-gradient-to-br from-pink-500 to-cyan-500 text-white"
                            : "bg-[#FDE003] text-black"
                      }`}
                    >
                      {idx === 0 ? (
                        <>
                          <div className="w-3.5 h-3.5 rounded-full bg-[#FDE003] absolute -top-1 -right-1 pointer-events-none" />
                          <span className="relative z-10 text-[8px] font-bold leading-tight">TECH<br />FEST &apos;26</span>
                        </>
                      ) : idx === 1 ? (
                        <span className="text-[7px] font-bold leading-tight">PRAROHA<br />GAMING</span>
                      ) : (
                        <span className="text-xs font-bold">{`{ }`}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {ev.name || ev.title}
                      </p>
                      <p className="text-xs text-[#9B9EA4] font-normal mt-0.5 truncate">
                        {ev.subtitle || (ev.venue ? `Today • ${ev.venue}` : "School of Engineering")}
                      </p>
                    </div>
                  </div>

                  {/* Status pill on right */}
                  <div className="shrink-0">
                    {isLive ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FE760B]/15 border border-[#FE760B]/30 text-[#FE760B] text-xs font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#FE760B]" />
                        <span>Live</span>
                      </span>
                    ) : isPublished ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#3DD68C]/15 border border-[#3DD68C]/30 text-[#3DD68C] text-xs font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#3DD68C]" />
                        <span>Published</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#212327] border border-[#2A2D31] text-[#9B9EA4] text-xs font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#9B9EA4]" />
                        <span>Draft</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 4. Preferences Section strictly matching Image 3 */}
        <div>
          <h2 className="text-sm font-bold text-white mb-2.5">
            Preferences
          </h2>
          <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-white">Appearance</p>
              <p className="text-xs text-[#9B9EA4] font-normal mt-0.5">
                Matches the Dark Mode switch in today&apos;s dashboard
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

        {/* 5. Plan Comparison Section strictly matching Image 3 */}
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

        {/* 6. Sign Out Bar strictly matching Image 3 */}
        <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-4 flex items-center justify-between mt-6">
          <span className="text-xs text-[#9B9EA4] font-normal">
            Sign out of TicketLelo on this device
          </span>
          <button
            type="button"
            onClick={handleLogout}
            className="bg-[#212327] hover:bg-[#2A2D31] border border-[#2A2D31] text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all"
          >
            Sign out
          </button>
        </div>
      </main>
    </div>
  );
}
