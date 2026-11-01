"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  LogOut,
  Ticket,
  Filter,
  CalendarDays,
  TicketCheck,
  Search,
  Shield,
  Building2,
} from "lucide-react";
import { TicketCard } from "@/components/dashboard/ticket-card";
import { TicketDeckView } from "@/components/tickets/ticket-deck-view";
import { detectTicketTheme, parseTicketTitle } from "@/components/tickets/stub-ticket";
import { useAuth } from "@/context/auth-context";
import { getEvent, subscribeToUserRegistrations } from "@/lib/firestore";
import { formatShortDate, formatTicketDate, getEventYear } from "@/lib/date-utils";
import Link from "next/link";
import { Layers, LayoutGrid } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const LOGO_SRC = "/logo/ticketlelo-logo-nav.png";

export default function DashboardPage() {
  const { user, logout, loading: authLoading } = useAuth();
  const router = useRouter();
  const [registrations, setRegistrations] = useState([]);
  const [events, setEvents] = useState(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      return "deck";
    }
    return "grid";
  });

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.replace("/login?redirect=/dashboard");
        return;
      }

      let isMounted = true;
      const verifySession = async () => {
        try {
          const { auth } = await import("@/lib/firebase");
          const currentUser = auth.currentUser;
          if (!currentUser) {
            if (isMounted) {
              await logout();
              router.replace("/login?redirect=/dashboard&reason=session_expired");
            }
            return;
          }
          const tokenResult = await currentUser.getIdTokenResult();
          const expirationTime = new Date(tokenResult.expirationTime).getTime();
          if (expirationTime <= Date.now()) {
            if (isMounted) {
              await logout();
              router.replace("/login?redirect=/dashboard&reason=session_expired");
            }
          }
        } catch (err) {
          console.warn("Session check error on dashboard:", err);
          if (isMounted) {
            await logout();
            router.replace("/login?redirect=/dashboard&reason=session_expired");
          }
        }
      };

      verifySession();
      return () => {
        isMounted = false;
      };
    }
  }, [user, authLoading, router, logout]);

  useEffect(() => {
    let isMounted = true;
    if (!user?.id) {
      const timer = setTimeout(() => {
        if (isMounted) setIsLoading(false);
      }, 0);
      return () => {
        isMounted = false;
        clearTimeout(timer);
      };
    }
    const unsubscribe = subscribeToUserRegistrations(user.id, async (regs) => {
      if (!isMounted) return;
      setRegistrations(regs);
      const uniqueEventIds = Array.from(new Set(regs.map((r) => r.eventId).filter(Boolean)));
      const eventsMap = new Map();
      await Promise.all(
        uniqueEventIds.map(async (eventId) => {
          const event = await getEvent(eventId);
          if (event) {
            eventsMap.set(eventId, event);
          }
        })
      );
      if (isMounted) {
        setEvents(eventsMap);
        setIsLoading(false);
      }
    });
    return () => {
      isMounted = false;
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [user]);

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/");
    } catch (e) {
      console.error("Logout error:", e);
    }
  };

  if (authLoading || isLoading || !user) {
    return (
      <main className="tl-system-theme flex min-h-screen items-center justify-center bg-slate-50 dark:bg-[#131517] transition-colors">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="flex h-14 w-14 items-center justify-center bg-[#FE760B] rounded-2xl shadow-none">
            <Ticket className="w-7 h-7 text-white" />
          </div>
          <Loader2 className="w-6 h-6 animate-spin text-[#FE760B]" />
          <p className="text-sm text-slate-500 dark:text-[#9B9EA4]">Loading your tickets...</p>
        </div>
      </main>
    );
  }

  const filteredRegistrations = registrations.filter((reg) => {
    if (filter === "All") return true;
    return reg.status === filter;
  });

  const unusedCount = registrations.filter((r) => r.status === "Unused").length;
  const usedCount = registrations.filter((r) => r.status === "Used").length;

  return (
    <main className="tl-system-theme min-h-screen bg-slate-50 dark:bg-[#131517] text-slate-900 dark:text-white transition-colors">
      {/* Header */}
      <header className="sticky top-0 inset-x-0 z-50 border-b border-slate-200 dark:border-[#2A2D31] bg-slate-50/95 dark:bg-[#131517]/95 backdrop-blur-md">
        <nav className="max-w-7xl mx-auto px-3.5 xs:px-4 sm:px-6 py-3 sm:py-3.5 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2 group shrink-0">
            <img src={LOGO_SRC} alt="TicketLelo" className="h-6 sm:h-[30px] w-auto object-contain" />
          </Link>

          <div className="flex gap-2 sm:gap-3 items-center shrink-0">
            {/* Quick Multi-Portal Access for Super Admin */}
            {(user?.role === "superAdmin" || user?.email === "adil4ticketlelo@gmail.com") && (
              <div className="hidden md:flex items-center gap-1.5 p-1 rounded-full bg-slate-100 dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31]">
                <Link
                  href="/superadmin"
                  className="px-2.5 py-1 rounded-full text-xs font-medium text-slate-700 dark:text-[#D0D0D1] bg-white dark:bg-[#212327] border border-slate-200 dark:border-[#2A2D31] hover:bg-slate-200 dark:hover:bg-[#2A2D31] hover:border-[#FE760B]/40 hover:!text-[#FE760B] dark:hover:!text-white transition-all flex items-center gap-1.5 group"
                >
                  <Shield className="w-3 h-3 text-[#FE760B] group-hover:scale-105 transition-transform" />
                  <span>Super Admin</span>
                </Link>
                <Link
                  href="/admin/dashboard"
                  className="px-2.5 py-1 rounded-full text-xs font-medium text-slate-700 dark:text-[#D0D0D1] hover:bg-slate-200 dark:hover:bg-[#212327] hover:border-slate-300 dark:hover:border-[#2A2D31] hover:!text-[#FE760B] dark:hover:!text-white transition-all flex items-center gap-1.5 group"
                >
                  <Building2 className="w-3 h-3 text-[#FE760B] group-hover:scale-105 transition-transform" />
                  <span>Organiser</span>
                </Link>
              </div>
            )}

            {/* THEME TOGGLE */}
            <ThemeToggle inline />

            {/* User Profile */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31]">
              <div className="w-2 h-2 rounded-full bg-[#3DD68C]" />
              <span className="text-xs font-semibold text-slate-700 dark:text-[#D0D0D1]">{user.email}</span>
            </div>

            {/* Sign Out */}
            <Button
              onClick={handleLogout}
              variant="outline"
              className="h-8 sm:h-9 px-2.5 sm:px-3 gap-1.5 border-slate-200 dark:border-[#2A2D31] bg-slate-100 dark:bg-[#1A1C1F] text-slate-700 dark:text-[#D0D0D1] hover:text-[#FF6B6B] hover:border-[#FF6B6B]/30 hover:bg-[#FF6B6B]/10 transition-all rounded-xl text-xs font-semibold cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" /> <span className="hidden xs:inline">Sign Out</span>
            </Button>
          </div>
        </nav>
      </header>

      <section className="pt-2 sm:pt-3 pb-3 sm:pb-4 px-3 xs:px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          {/* Welcome & Stats Command Center Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3 sm:mb-3.5 opacity-0 animate-fade-in-up">
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Welcome, <span className="text-[#FE760B]">{user.fullName || "Guest"}</span>
              </h1>
              <p className="text-slate-600 dark:text-[#9B9EA4] text-xs sm:text-sm mt-0.5 font-medium">
                Your tickets control room — all event passes in one place.
              </p>
            </div>

            {/* Compact, Sleek Metric Pills */}
            <div className="grid grid-cols-3 gap-2 sm:gap-2.5 w-full md:w-auto">
              <div className="bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] rounded-xl px-2.5 xs:px-3 py-1.5 sm:py-2 flex items-center justify-between gap-1.5 sm:gap-2.5 shadow-sm">
                <div className="min-w-0">
                  <p className="text-[8px] xs:text-[9.5px] text-slate-500 dark:text-[#9B9EA4] font-bold uppercase tracking-wider whitespace-nowrap">Total</p>
                  <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white leading-none mt-0.5">{registrations.length}</p>
                </div>
                <div className="w-7 h-7 shrink-0 rounded-lg bg-[#FE760B]/10 text-[#FE760B] flex items-center justify-center border border-[#FE760B]/20">
                  <Ticket className="w-3.5 h-3.5" />
                </div>
              </div>

              <div className="bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] rounded-xl px-2.5 xs:px-3 py-1.5 sm:py-2 flex items-center justify-between gap-1.5 sm:gap-2.5 shadow-sm">
                <div className="min-w-0">
                  <p className="text-[8px] xs:text-[9.5px] text-slate-500 dark:text-[#9B9EA4] font-bold uppercase tracking-wider whitespace-nowrap">Upcoming</p>
                  <p className="text-lg sm:text-xl font-bold text-emerald-600 dark:text-[#10B981] leading-none mt-0.5">{unusedCount}</p>
                </div>
                <div className="w-7 h-7 shrink-0 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-[#10B981] flex items-center justify-center border border-emerald-500/20">
                  <CalendarDays className="w-3.5 h-3.5" />
                </div>
              </div>

              <div className="bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] rounded-xl px-2.5 xs:px-3 py-1.5 sm:py-2 flex items-center justify-between gap-1.5 sm:gap-2.5 shadow-sm">
                <div className="min-w-0">
                  <p className="text-[8px] xs:text-[9.5px] text-slate-500 dark:text-[#9B9EA4] font-bold uppercase tracking-wider whitespace-nowrap">Used</p>
                  <p className="text-lg sm:text-xl font-bold text-slate-700 dark:text-[#D0D0D1] leading-none mt-0.5">{usedCount}</p>
                </div>
                <div className="w-7 h-7 shrink-0 rounded-lg bg-slate-100 dark:bg-[#212327] text-slate-600 dark:text-[#9B9EA4] flex items-center justify-center border border-slate-200 dark:border-[#2A2D31]">
                  <TicketCheck className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          </div>

          {/* Filter Tabs & View Mode Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 mb-2 sm:mb-2.5 opacity-0 animate-fade-in-up stagger-2">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-500 dark:text-[#9B9EA4] mr-0.5" />
              {[
                { key: "All", label: `All (${registrations.length})` },
                { key: "Unused", label: `Upcoming (${unusedCount})` },
                { key: "Used", label: `Used (${usedCount})` },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`px-3 py-1 sm:py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    filter === f.key
                      ? "bg-[#FE760B] text-white dark:text-[#131517] shadow-none"
                      : "bg-white dark:bg-[#1A1C1F] text-slate-700 dark:text-[#D0D0D1] border border-slate-200 dark:border-[#2A2D31] hover:bg-slate-100 dark:hover:bg-[#212327] hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* View Mode Switcher */}
            <div className="flex items-center bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] p-0.5 rounded-lg shadow-sm">
              <button
                onClick={() => setViewMode("deck")}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === "deck"
                    ? "bg-slate-100 dark:bg-[#212327] text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-500 dark:text-[#9B9EA4] hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Deck view</span>
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === "grid"
                    ? "bg-slate-100 dark:bg-[#212327] text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-500 dark:text-[#9B9EA4] hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Grid view</span>
              </button>
            </div>
          </div>

          {/* VIEW: DECK VIEW */}
          {viewMode === "deck" ? (
            filteredRegistrations.length === 0 ? (
              <div className="bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] rounded-2xl p-12 text-center max-w-md mx-auto opacity-0 animate-fade-in shadow-sm">
                <div className="w-14 h-14 rounded-2xl bg-[#FE760B]/10 flex items-center justify-center mx-auto mb-4 border border-[#FE760B]/20">
                  <Ticket className="w-7 h-7 text-[#FE760B]" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                  {filter === "All" ? "No tickets yet" : `No ${filter.toLowerCase()} tickets`}
                </h3>
                <p className="text-sm text-slate-600 dark:text-[#9B9EA4] mb-6">
                  {filter === "All"
                    ? "When you register for college festivals or community events, your passes will appear here."
                    : `You have no tickets currently matching the "${filter}" filter.`}
                </p>
                {filter === "All" && (
                  <Link href="/">
                    <Button className="bg-[#FE760B] hover:bg-[#FF8A2B] text-white dark:text-[#131517] font-semibold h-10 px-5 rounded-xl text-sm transition-colors border-none shadow-none">
                      Browse events
                    </Button>
                  </Link>
                )}
              </div>
            ) : (
              <div className="flex justify-center py-0 opacity-0 animate-fade-in">
                <TicketDeckView
                  initialTickets={filteredRegistrations.map((reg, idx) => {
                    const rawEvent = events.get(reg.eventId) || {};
                    const eventName = rawEvent.name || rawEvent.title || reg.eventName || reg.eventTitle || "Tech Fest 2026";
                    const detectedTheme = rawEvent.theme || reg.theme || detectTicketTheme(eventName, rawEvent.category || reg.category);
                    const parsed = parseTicketTitle(eventName);
                    let displayTitle = parsed.line1.toUpperCase();
                    if (displayTitle === "PRAROHA") displayTitle = "PRARÖHA";
                    const subTitle = parsed.line2 ? parsed.line2.toUpperCase() : (reg.ticketTier || reg.ticketType || "PASS");
                    const year = parsed.year || getEventYear(rawEvent.date || reg.eventDate, "2026");
                    const subBadge = reg.status === "Used"
                      ? "USED"
                      : (rawEvent.price === 0 || reg.amount === 0 ? "FREE" : reg.amount ? `₹${reg.amount}` : (reg.ticketTier || "PASS"));

                    return {
                      id: reg.id || `reg_${idx}`,
                      title: eventName,
                      theme: detectedTheme,
                      date: formatTicketDate(rawEvent.date || reg.eventDate),
                      time: typeof rawEvent.time === "string" ? rawEvent.time : typeof reg.eventTime === "string" ? reg.eventTime : "12:00 PM",
                      venue: String(rawEvent.location || rawEvent.venue || reg.venue || reg.location || "MAIN AUDITORIUM"),
                      ticketType: String(reg.ticketTier || reg.tierName || reg.ticketType || "GENERAL PASS"),
                      guest: String(reg.attendeeName || reg.fullName || user.fullName || "Adil M"),
                      ticketId: String(reg.ticketId || `TKT-${reg.id?.slice(0, 8)}`),
                      qrCode: reg.qrCode,
                      entryLabel: "SCAN AT ENTRY",
                      subBadge: subBadge,
                      price: rawEvent.price !== undefined ? rawEvent.price : reg.amount !== undefined ? reg.amount : null,
                    };
                  })}
                  onBack={() => setViewMode("grid")}
                />
              </div>
            )
          ) : (
            /* VIEW: GRID VIEW */
            filteredRegistrations.length === 0 ? (
              <div className="bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] rounded-2xl p-12 text-center max-w-md mx-auto opacity-0 animate-fade-in shadow-sm">
                <div className="w-14 h-14 rounded-2xl bg-[#FE760B]/10 flex items-center justify-center mx-auto mb-4 border border-[#FE760B]/20">
                  <Ticket className="w-7 h-7 text-[#FE760B]" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                  {filter === "All" ? "No tickets yet" : `No ${filter.toLowerCase()} tickets`}
                </h3>
                <p className="text-sm text-slate-600 dark:text-[#9B9EA4] mb-6">
                  {filter === "All"
                    ? "When you register for college festivals or community events, your QR passes will appear here."
                    : `You have no tickets currently matching the "${filter}" filter.`}
                </p>
                {filter === "All" && (
                  <Link href="/">
                    <Button className="bg-[#FE760B] hover:bg-[#FF8A2B] text-white dark:text-[#131517] font-semibold h-10 px-5 rounded-xl text-sm transition-colors border-none shadow-none">
                      Browse events
                    </Button>
                  </Link>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {filteredRegistrations.map((registration, i) => {
                  const rawEvent = events.get(registration.eventId) || {};
                  const event = {
                    ...rawEvent,
                    name: rawEvent.name || rawEvent.title || registration.eventName || registration.eventTitle || "Tech Fest 2026",
                    location: rawEvent.location || rawEvent.venue || registration.venue || registration.location || "Main Auditorium",
                    date: rawEvent.date || rawEvent.startDate || registration.eventDate || registration.createdAt?.toDate?.() || new Date(),
                    time: rawEvent.time || registration.eventTime || registration.time || "12:00 PM",
                    price: rawEvent.price !== undefined ? rawEvent.price : registration.amount !== undefined ? registration.amount : registration.amountPaid !== undefined ? registration.amountPaid : 199,
                    category: rawEvent.category || registration.category,
                    theme: rawEvent.theme || registration.theme,
                    ticketDesign: registration.ticketDesign || rawEvent.ticketDesign || rawEvent.ticketLayout || registration.ticketLayout || "stub",
                  };
                  return (
                    <div
                      key={registration.id}
                      className={`opacity-0 animate-fade-in-up stagger-${Math.min(i + 1, 6)} h-full`}
                    >
                      <TicketCard registration={registration} event={event} />
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      </section>
    </main>
  );
}
