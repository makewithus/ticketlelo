"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Ticket,
  Search,
  Filter,
  Layers,
  LayoutGrid,
  Menu,
  X,
  LogOut,
  Compass,
  Building2,
  Shield,
  Bell,
  User,
  CheckCircle2,
  Clock,
  Archive,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TicketCard } from "@/components/dashboard/ticket-card";
import { TicketDeckView } from "@/components/tickets/ticket-deck-view";
import { detectTicketTheme, parseTicketTitle } from "@/components/tickets/stub-ticket";
import { useAuth } from "@/context/auth-context";
import { getEvent, subscribeToUserRegistrations } from "@/lib/firestore";
import { formatTicketDate, getEventYear } from "@/lib/date-utils";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { BrandLoader } from "@/components/ui/brand-loader";
import { UserDashboardSkeleton } from "@/components/ui/skeleton";
import { getCachedItem, setCachedItem } from "@/lib/client-cache";

const LOGO_SRC = "/logo/ticketlelo-logo-nav.png";

export default function MyTicketsPage() {
  const { user, logout, loading: authLoading } = useAuth();
  const router = useRouter();

  const [registrations, setRegistrations] = useState([]);
  const [events, setEvents] = useState(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState("grid");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Fast-path client cache check on mount
  useEffect(() => {
    if (!user?.id) return;
    try {
      const cached = getCachedItem(`user_regs_${user.id}`);
      if (Array.isArray(cached) && cached.length > 0) {
        setRegistrations(cached);
        setIsLoading(false);
      }
    } catch {}
  }, [user?.id]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  // Authentication protection
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login?redirect=/my-tickets");
    }
  }, [user, authLoading, router]);

  // Subscribe to all registrations for the user across ALL events (METCON, PRAROHA, TechFest, etc.)
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
        if (user?.id) {
          setCachedItem(`user_regs_${user.id}`, regs, 10 * 60 * 1000);
        }
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [user?.id]);

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/");
    } catch (e) {
      console.error("Logout error:", e);
    }
  };

  const pendingCount = useMemo(
    () =>
      registrations.filter(
        (r) => r.status === "pending" || r.approvalStatus === "pending"
      ).length,
    [registrations]
  );

  const unusedCount = useMemo(
    () =>
      registrations.filter(
        (r) =>
          (r.status === "Unused" || r.status === "Going" || !r.status) &&
          r.status !== "pending" &&
          r.approvalStatus !== "pending"
      ).length,
    [registrations]
  );

  const usedCount = useMemo(
    () =>
      registrations.filter((r) => r.status === "Used" || r.status === "used")
        .length,
    [registrations]
  );

  // Filter & Search processing across all user events
  const filteredRegistrations = useMemo(() => {
    return registrations.filter((reg) => {
      // 1. Status Filter
      if (filter === "pending" && !(reg.status === "pending" || reg.approvalStatus === "pending")) {
        return false;
      }
      if (filter === "Unused") {
        const isUnused =
          (reg.status === "Unused" || reg.status === "Going" || !reg.status) &&
          reg.status !== "pending" &&
          reg.approvalStatus !== "pending";
        if (!isUnused) return false;
      }
      if (filter === "Used" && !(reg.status === "Used" || reg.status === "used")) {
        return false;
      }

      // 2. Search Query filter (event title, ticket id, attendee name)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const rawEvent = events.get(reg.eventId) || {};
        const eventName = (rawEvent.name || rawEvent.title || reg.eventName || reg.eventTitle || "").toLowerCase();
        const ticketId = (reg.ticketId || reg.id || "").toLowerCase();
        const attendee = (reg.attendeeName || reg.fullName || "").toLowerCase();
        if (!eventName.includes(q) && !ticketId.includes(q) && !attendee.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [registrations, events, filter, searchQuery]);

  if (authLoading && !user) {
    return <BrandLoader message="Loading TicketLelo..." fullScreen />;
  }

  if (isLoading || !user) {
    return <UserDashboardSkeleton />;
  }

  return (
    <main className="tl-system-theme min-h-screen bg-slate-50 dark:bg-[#131517] text-slate-900 dark:text-white transition-colors max-w-full overflow-x-clip">
      {/* ── Header ── */}
      <header className="sticky top-0 inset-x-0 z-50 border-b border-slate-200 dark:border-[#2A2D31] bg-slate-50/95 dark:bg-[#131517]/95 backdrop-blur-md overflow-hidden">
        <nav className="max-w-7xl mx-auto px-3.5 xs:px-4 sm:px-6 py-3 sm:py-3.5 flex justify-between items-center gap-2">
          <div className="flex items-center gap-2 sm:gap-6">
            {/* Mobile Hamburger Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="sm:hidden p-1.5 -ml-1 rounded-xl text-slate-700 dark:text-[#D0D0D1] hover:text-[#FE760B] hover:bg-slate-100 dark:hover:bg-[#212327] transition-colors cursor-pointer"
              aria-label="Open navigation sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>

            <Link href="/" className="flex items-center gap-2 group shrink-0">
              <img src={LOGO_SRC} alt="TicketLelo" className="h-6 sm:h-[30px] w-auto object-contain" />
            </Link>

            {/* Desktop Dashboard Navigation Links */}
            <div className="hidden md:flex items-center gap-1 bg-slate-100 dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] p-1 rounded-xl text-xs font-semibold">
              <Link
                href="/dashboard"
                className="px-3 py-1.5 rounded-lg text-slate-600 dark:text-[#9B9EA4] hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                Overview
              </Link>
              <Link
                href="/my-tickets"
                className="px-3 py-1.5 rounded-lg bg-[#FE760B] text-white shadow-xs font-bold"
              >
                My Tickets
              </Link>
              <Link
                href="/account"
                className="px-3 py-1.5 rounded-lg text-slate-600 dark:text-[#9B9EA4] hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                Account Settings
              </Link>
            </div>

            <Link
              href="/discover"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-700 dark:text-[#D0D0D1] hover:text-[#FE760B] dark:hover:text-white transition-colors"
            >
              <Compass className="w-3.5 h-3.5 text-[#FE760B]" />
              <span>Discover</span>
            </Link>

            {/* Admin / Organiser switches */}
            {(user?.role === "superAdmin" ||
              (user?.email || "").toLowerCase().trim() === "adil4ticketlelo@gmail.com" ||
              (user?.email || "").toLowerCase().trim() === "superadmin@ticketlelo.com") ? (
              <Link
                href="/superadmin"
                className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-[#FE760B] bg-[#FE760B]/10 hover:bg-[#FE760B]/20 border border-[#FE760B]/30 px-3 py-1.5 rounded-xl transition-colors"
              >
                <Shield className="w-3.5 h-3.5 text-[#FE760B]" />
                <span>Super Admin Suite</span>
              </Link>
            ) : (user?.role === "organiser" || user?.isAdmin) ? (
              <Link
                href="/admin/dashboard"
                className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-[#D0D0D1] bg-slate-100 dark:bg-[#1A1C1F] hover:bg-slate-200 dark:hover:bg-[#212327] border border-slate-200 dark:border-[#2A2D31] px-3 py-1.5 rounded-xl transition-colors"
              >
                <Building2 className="w-3.5 h-3.5 text-[#FE760B]" />
                <span>Organiser Portal</span>
              </Link>
            ) : null}
          </div>

          <div className="flex gap-2 sm:gap-3 items-center shrink-0">
            <ThemeToggle inline />

            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31]">
              <div className="w-2 h-2 rounded-full bg-[#3DD68C]" />
              <span className="text-xs font-semibold text-slate-700 dark:text-[#D0D0D1]">{user.email}</span>
            </div>

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

      {/* ── Mobile Sidebar Drawer ── */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity animate-fade-in"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />

          <aside className="fixed inset-y-0 left-0 w-[280px] max-w-[85vw] bg-white dark:bg-[#17191C] border-r border-slate-200 dark:border-[#2A2D31] flex flex-col justify-between shadow-2xl z-50 animate-slide-in-left overflow-y-auto">
            <div className="p-4 border-b border-slate-200 dark:border-[#2A2D31] flex items-center justify-between">
              <Link href="/" onClick={() => setMobileMenuOpen(false)}>
                <img src={LOGO_SRC} alt="TicketLelo" className="h-6 w-auto object-contain" />
              </Link>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-xl text-slate-500 dark:text-[#9B9EA4] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#212327] transition-colors cursor-pointer"
                aria-label="Close navigation sidebar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-6 flex-1 overflow-y-auto">
              <div>
                <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#71767B] mb-2">
                  My Dashboard
                </p>
                <nav className="space-y-1">
                  <Link
                    href="/dashboard"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-[#D0D0D1] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#212327] transition-colors"
                  >
                    <Layers className="w-4 h-4 text-[#9B9EA4] shrink-0" />
                    <span>Overview</span>
                  </Link>

                  <Link
                    href="/my-tickets"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-[#FE760B] bg-[#FE760B]/10 dark:bg-[#FE760B]/15 border border-[#FE760B]/30"
                  >
                    <Ticket className="w-4 h-4 text-[#FE760B] shrink-0" />
                    <span>My Tickets ({registrations.length})</span>
                  </Link>

                  <Link
                    href="/discover"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-[#D0D0D1] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#212327] transition-colors"
                  >
                    <Compass className="w-4 h-4 text-[#FE760B] shrink-0" />
                    <span>Discover Events</span>
                  </Link>

                  <Link
                    href="/activity"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-[#D0D0D1] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#212327] transition-colors"
                  >
                    <Bell className="w-4 h-4 text-[#9B9EA4] shrink-0" />
                    <span>Activity Notifications</span>
                  </Link>

                  <Link
                    href="/account"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-[#D0D0D1] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#212327] transition-colors"
                  >
                    <User className="w-4 h-4 text-[#9B9EA4] shrink-0" />
                    <span>Account Settings</span>
                  </Link>
                </nav>
              </div>

              {(user?.role === "organiser" || user?.isAdmin || user?.role === "superAdmin") && (
                <div className="pt-4 border-t border-slate-200 dark:border-[#2A2D31]">
                  <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#71767B] mb-2">
                    Host Portals
                  </p>
                  <div className="space-y-1">
                    <Link
                      href="/admin/dashboard"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-[#D0D0D1] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#212327] transition-colors"
                    >
                      <Building2 className="w-4 h-4 text-[#FE760B] shrink-0" />
                      <span>Organiser Dashboard</span>
                    </Link>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-[#2A2D31] bg-slate-50 dark:bg-[#131517] space-y-3">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {user?.fullName || "Guest User"}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-[#9B9EA4] truncate">
                    {user?.email}
                  </p>
                </div>
                <ThemeToggle inline />
              </div>

              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-[#FF6B6B] bg-rose-50 dark:bg-[#FF4D4D]/10 hover:bg-rose-100 dark:hover:bg-[#FF4D4D]/20 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ── Main Section ── */}
      <section className="pt-4 sm:pt-6 pb-8 px-3.5 xs:px-4 sm:px-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Subheader Title & View Mode Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-[#FE760B]/10 text-[#FE760B] border border-[#FE760B]/20">
                  Account Dashboard
                </span>
                <span className="text-xs text-slate-400 dark:text-[#71767B]">
                  • {registrations.length} total {registrations.length === 1 ? "pass" : "passes"}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                My Tickets
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-[#9B9EA4] mt-0.5 font-medium">
                All your tickets and passes across all events in one unified account dashboard.
              </p>
            </div>

            {/* View Switcher */}
            {registrations.length > 0 && (
              <div className="flex items-center self-start sm:self-auto bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] p-1 rounded-xl shadow-xs shrink-0">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    viewMode === "grid"
                      ? "bg-[#FE760B] text-white shadow-xs"
                      : "text-slate-600 dark:text-[#9B9EA4] hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Grid view</span>
                </button>
                <button
                  onClick={() => setViewMode("deck")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    viewMode === "deck"
                      ? "bg-[#FE760B] text-white shadow-xs"
                      : "text-slate-600 dark:text-[#9B9EA4] hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Deck view</span>
                </button>
              </div>
            )}
          </div>

          {/* Search and Filters Toolbar */}
          <div className="bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] rounded-2xl p-3 sm:p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#71767B]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tickets by event name, ticket ID, or attendee..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-[#131517] border border-slate-200 dark:border-[#2A2D31] rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-[#6C7075] focus:outline-hidden focus:border-[#FE760B] transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              <button
                onClick={() => setFilter("All")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  filter === "All"
                    ? "bg-[#FE760B] text-white shadow-xs"
                    : "bg-slate-100 dark:bg-[#212327] text-slate-600 dark:text-[#9B9EA4] hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                All ({registrations.length})
              </button>
              <button
                onClick={() => setFilter("Unused")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1 ${
                  filter === "Unused"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-slate-100 dark:bg-[#212327] text-slate-600 dark:text-[#9B9EA4] hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <CheckCircle2 className="w-3 h-3" />
                <span>Valid ({unusedCount})</span>
              </button>
              <button
                onClick={() => setFilter("pending")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1 ${
                  filter === "pending"
                    ? "bg-amber-600 text-white shadow-xs"
                    : "bg-slate-100 dark:bg-[#212327] text-slate-600 dark:text-[#9B9EA4] hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Clock className="w-3 h-3" />
                <span>Pending ({pendingCount})</span>
              </button>
              <button
                onClick={() => setFilter("Used")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1 ${
                  filter === "Used"
                    ? "bg-slate-700 text-white shadow-xs"
                    : "bg-slate-100 dark:bg-[#212327] text-slate-600 dark:text-[#9B9EA4] hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Archive className="w-3 h-3" />
                <span>Used ({usedCount})</span>
              </button>
            </div>
          </div>

          {/* ── Content View ── */}
          {filteredRegistrations.length === 0 ? (
            <div className="bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] rounded-2xl p-12 text-center max-w-md mx-auto shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-[#FE760B]/10 flex items-center justify-center mx-auto mb-4 border border-[#FE760B]/20">
                <Ticket className="w-7 h-7 text-[#FE760B]" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                {searchQuery
                  ? "No tickets matched your search"
                  : filter === "All"
                  ? "No tickets found"
                  : `No ${filter.toLowerCase()} tickets`}
              </h3>
              <p className="text-sm text-slate-600 dark:text-[#9B9EA4] mb-6">
                {searchQuery
                  ? `We couldn't find any tickets matching "${searchQuery}". Try searching with a different keyword.`
                  : "When you register for college festivals or community events on TicketLelo, all your tickets will appear here."}
              </p>
              <Link href="/discover">
                <Button className="bg-[#FE760B] hover:bg-[#FF8A2B] text-white font-bold h-10 px-5 rounded-xl text-sm transition-all shadow-sm cursor-pointer border-none">
                  Discover Live Events
                </Button>
              </Link>
            </div>
          ) : viewMode === "deck" ? (
            /* DECK VIEW */
            <div className="flex justify-center py-2">
              <TicketDeckView
                initialTickets={filteredRegistrations.map((reg, idx) => {
                  const rawEvent = events.get(reg.eventId) || {};
                  const eventName = rawEvent.name || rawEvent.title || reg.eventName || reg.eventTitle || "Tech Fest 2026";
                  const detectedTheme = rawEvent.theme || reg.theme || detectTicketTheme(eventName, rawEvent.category || reg.category);
                  const parsed = parseTicketTitle(eventName);
                  let displayTitle = parsed.line1.toUpperCase();
                  if (displayTitle === "PRAROHA") displayTitle = "PRARÖHA";
                  const isPending = reg.status === "pending" || reg.approvalStatus === "pending";
                  const subBadge = isPending
                    ? "PENDING"
                    : reg.status === "Used"
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
                    guest: String(reg.attendeeName || reg.fullName || user.fullName || "Guest Attendee"),
                    ticketId: String(reg.ticketId || `TKT-${reg.id?.slice(0, 8)}`),
                    qrCode: reg.qrCode,
                    entryLabel: isPending ? "PENDING APPROVAL" : "SCAN AT ENTRY",
                    isPending: isPending,
                    subBadge: subBadge,
                    price: rawEvent.price !== undefined ? rawEvent.price : reg.amount !== undefined ? reg.amount : null,
                  };
                })}
                onBack={() => setViewMode("grid")}
              />
            </div>
          ) : (
            /* GRID VIEW */
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
          )}
        </div>
      </section>
    </main>
  );
}
