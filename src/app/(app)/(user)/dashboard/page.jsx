"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
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
  Compass,
  Menu,
  X,
  Bell,
  User,
  LayoutDashboard,
} from "lucide-react";
import { TicketCard } from "@/components/dashboard/ticket-card";
import { detectTicketTheme, parseTicketTitle } from "@/components/tickets/stub-ticket";
import { useAuth } from "@/context/auth-context";
import { getEvent, subscribeToUserRegistrations } from "@/lib/firestore";
import { formatShortDate, formatTicketDate, getEventYear } from "@/lib/date-utils";
import Link from "next/link";
import { Layers, LayoutGrid } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { BrandLoader } from "@/components/ui/brand-loader";
import { UserDashboardSkeleton } from "@/components/ui/skeleton";
import { getCachedItem, setCachedItem } from "@/lib/client-cache";

const LOGO_SRC = "/logo/ticketlelo-logo-nav.png";

export default function DashboardPage() {
  const { user, logout, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname() || "/dashboard";
  // Safe SSR hydration - avoids hydration mismatch
  const [registrations, setRegistrations] = useState([]);
  const [events, setEvents] = useState(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [viewMode, setViewMode] = useState("deck");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Close dropdown on outside click or Escape
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest("[data-user-dropdown]")) {
        setShowUserMenu(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setShowUserMenu(false);
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("click", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Fast-path client cache check on mount (runs after hydration, so zero SSR mismatch)
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

  // Close on Escape key
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("ticketlelo_last_active", String(Date.now()));
      } catch (_) {}
    }
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login?redirect=/dashboard");
    }
  }, [user, authLoading, router]);

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

  if (authLoading && !user) {
    return <BrandLoader message="Loading..." fullScreen />;
  }

  if (isLoading || !user) {
    return <UserDashboardSkeleton />;
  }

  const pendingCount = registrations.filter(
    (r) => r.status === "pending" || r.approvalStatus === "pending"
  ).length;
  const unusedCount = registrations.filter(
    (r) =>
      (r.status === "Unused" || r.status === "Going" || !r.status) &&
      r.status !== "pending" &&
      r.approvalStatus !== "pending"
  ).length;
  const usedCount = registrations.filter(
    (r) => r.status === "Used" || r.status === "used"
  ).length;

  const filteredRegistrations = registrations.filter((reg) => {
    if (filter === "All") return true;
    if (filter === "pending") {
      return reg.status === "pending" || reg.approvalStatus === "pending";
    }
    if (filter === "Unused") {
      return (
        (reg.status === "Unused" || reg.status === "Going" || !reg.status) &&
        reg.status !== "pending" &&
        reg.approvalStatus !== "pending"
      );
    }
    if (filter === "Used") {
      return reg.status === "Used" || reg.status === "used";
    }
    return reg.status === filter;
  });

  const emailLower = (user?.email || "").toLowerCase().trim();
  const superAdminEnv = (process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL || process.env.SUPER_ADMIN_EMAIL || "").toLowerCase().trim();
  const isSuperAdmin =
    user?.role === "superAdmin" ||
    user?.role === "superadmin" ||
    emailLower === "adil4ticketlelo@gmail.com" ||
    emailLower === "superadmin@ticketlelo.com" ||
    (superAdminEnv && emailLower === superAdminEnv);

  const hasOrganiserAccess = isSuperAdmin || user?.role === "organiser" || user?.role === "organizer" || Boolean(user?.isAdmin);

  const getGmailStyleInitial = () => {
    const name = (user?.displayName || user?.fullName || user?.name || "").trim();
    if (name) return name[0].toUpperCase();
    if (user?.email) return user.email[0].toUpperCase();
    return "U";
  };
  const userInitial = getGmailStyleInitial();

  const userTabs = [
    {
      href: "/dashboard",
      label: "Overview",
      icon: LayoutDashboard,
    },
    {
      href: "/my-tickets",
      label: "My Tickets",
      icon: Ticket,
      badge: registrations.length,
    },
    {
      href: "/account",
      label: "Account Settings",
      icon: User,
    },
    {
      href: "/discover",
      label: "Discover",
      icon: Compass,
    },
  ];

  return (
    <main className="tl-system-theme min-h-screen bg-slate-50 dark:bg-[#131517] text-slate-900 dark:text-white transition-colors max-w-full overflow-x-clip">
      {/* ── Top Navigation Bar (matching Super Admin layout) ── */}
      <header className="border-b border-slate-200 dark:border-[#2A2D31]/80 bg-white/95 dark:bg-[#131517]/95 backdrop-blur-md sticky top-0 z-40 transition-colors">
        <div className="w-full max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-6 h-16 flex items-center justify-between gap-2 sm:gap-3 lg:gap-4">
          {/* Left: Mobile Hamburger + Brand Logo */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Mobile / Tablet Hamburger Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-1 rounded-xl text-slate-700 dark:text-[#D0D0D1] hover:text-[#FE760B] hover:bg-slate-100 dark:hover:bg-[#212327] transition-colors cursor-pointer"
              aria-label="Open navigation sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>

            <Link href="/dashboard" prefetch={false} className="flex items-center gap-2.5 group shrink-0">
              <Image
                src={LOGO_SRC}
                alt="TicketLelo"
                width={82}
                height={26}
                className="h-6 sm:h-7 w-auto object-contain transition-transform group-hover:scale-105"
                priority
              />
            </Link>
          </div>

          {/* Center: Desktop Navigation Tabs */}
          <nav className="hidden lg:flex items-center gap-1 xl:gap-1.5 overflow-x-auto no-scrollbar py-1.5 px-1 min-w-0 flex-1 justify-start xl:justify-[safe_center] 2xl:justify-center scroll-smooth overscroll-x-contain">
            {userTabs.map((item) => {
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={false}
                  className={`flex items-center gap-1.5 px-2.5 xl:px-3 py-1.5 rounded-xl text-xs xl:text-[13px] font-semibold transition-all whitespace-nowrap shrink-0 border select-none ${
                    isActive
                      ? "text-[#FE760B] bg-[#FE760B]/10 dark:bg-[#FE760B]/15 border-[#FE760B]/30 shadow-xs"
                      : "text-slate-600 dark:text-[#9B9EA4] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#212327] border-transparent"
                  }`}
                >
                  <item.icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="whitespace-nowrap">{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 min-w-[18px] text-center rounded-full text-[10px] font-bold bg-[#FE760B] text-white shrink-0 leading-none">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right: Theme Toggle and Profile Dropdown (matching Super Admin layout) */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <ThemeToggle inline className="[&>span]:hidden 2xl:[&>span]:inline" />

            {/* Profile Avatar with Dropdown */}
            <div className="relative" data-user-dropdown>
              <button
                type="button"
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="w-8 h-8 rounded-full bg-[#FE760B] text-white font-bold text-xs flex items-center justify-center shadow-xs cursor-pointer hover:ring-2 ring-[#FE760B]/40 transition-all overflow-hidden select-none"
                title={user?.email || "Account"}
              >
                {user?.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user?.email || "Avatar"}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover rounded-full"
                  />
                ) : (
                  <span className="font-bold text-xs sm:text-sm text-white">{userInitial}</span>
                )}
              </button>

              {showUserMenu && (
                <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] p-3 shadow-2xl z-50 animate-scale-in space-y-3 text-left">
                  {/* User Profile Card */}
                  <div className="border-b border-slate-100 dark:border-[#2A2D31] pb-2.5 flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-[#FE760B] flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden">
                      {user?.photoURL ? (
                        <img
                          src={user.photoURL}
                          alt="Avatar"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        userInitial
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {user?.displayName || user?.fullName || "User"}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-[#9B9EA4] truncate">
                        {user?.email}
                      </div>
                      <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-[#FE760B]/15 text-[#FE760B] border border-[#FE760B]/30">
                        {isSuperAdmin ? "Super Admin" : hasOrganiserAccess ? "Organiser" : "User"}
                      </span>
                    </div>
                  </div>

                  {/* Switch Portals exactly like Super Admin */}
                  <div className="space-y-1">
                    <p className="px-2 text-[10px] font-bold text-slate-400 dark:text-[#9B9EA4] uppercase tracking-wider">
                      Switch Portals
                    </p>
                    {isSuperAdmin && (
                      <Link
                        href="/superadmin"
                        onClick={() => setShowUserMenu(false)}
                        className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-[#D0D0D1] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#212327] transition-colors"
                      >
                        <Shield className="w-3.5 h-3.5 text-[#FE760B]" />
                        <span>Super Admin Suite</span>
                      </Link>
                    )}

                    {hasOrganiserAccess && (
                      <Link
                        href="/admin/dashboard"
                        onClick={() => setShowUserMenu(false)}
                        className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-[#D0D0D1] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#212327] transition-colors"
                      >
                        <Building2 className="w-3.5 h-3.5 text-[#FE760B]" />
                        <span>Organiser Dashboard</span>
                      </Link>
                    )}

                    <Link
                      href="/dashboard"
                      onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-semibold text-[#FE760B] bg-[#FE760B]/10 dark:bg-[#FE760B]/15 font-bold"
                    >
                      <Ticket className="w-3.5 h-3.5 text-[#FE760B]" />
                      <span>User Dashboard</span>
                    </Link>
                  </div>

                  {/* Sign out */}
                  <div className="pt-1.5 border-t border-slate-100 dark:border-[#2A2D31]">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-[#FF6B6B] hover:bg-rose-50 dark:hover:bg-[#FF4D4D]/10 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── Mobile Sidebar Drawer & Backdrop (matching Super Admin layout) ── */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity animate-fade-in"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Sidebar Drawer Panel */}
          <aside className="fixed inset-y-0 left-0 w-[290px] max-w-[85vw] bg-white dark:bg-[#17191C] border-r border-slate-200 dark:border-[#2A2D31] flex flex-col justify-between shadow-2xl z-50 animate-slide-in-left overflow-y-auto">
            {/* Top Section */}
            <div className="p-4 border-b border-slate-200 dark:border-[#2A2D31] flex items-center justify-between">
              <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2.5">
                <Image
                  src={LOGO_SRC}
                  alt="TicketLelo"
                  width={82}
                  height={26}
                  className="h-6 w-auto object-contain"
                  priority
                />
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

            {/* Navigation Links */}
            <div className="p-4 space-y-6 flex-1 overflow-y-auto">
              <div>
                <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#71767B] mb-2">
                  Navigation
                </p>
                <nav className="space-y-1">
                  {userTabs.map((item) => {
                    const isActive = pathname === item.href;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        prefetch={false}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all border ${
                          isActive
                            ? "text-[#FE760B] bg-[#FE760B]/10 dark:bg-[#FE760B]/15 border-[#FE760B]/30 shadow-xs"
                            : "text-slate-600 dark:text-[#9B9EA4] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#212327] border-transparent"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <item.icon className="w-4 h-4 shrink-0" />
                          <span>{item.label}</span>
                        </div>
                        {item.badge !== undefined && item.badge > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FE760B] text-white shrink-0 leading-none">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </nav>
              </div>

              {/* Switch Portals */}
              <div className="pt-4 border-t border-slate-200 dark:border-[#2A2D31]">
                <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#71767B] mb-2">
                  Switch Portals
                </p>
                <div className="space-y-1">
                  {isSuperAdmin && (
                    <Link
                      href="/superadmin"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-[#D0D0D1] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#212327] transition-colors"
                    >
                      <Shield className="w-4 h-4 text-[#FE760B] shrink-0" />
                      <span>Super Admin Suite</span>
                    </Link>
                  )}

                  {hasOrganiserAccess && (
                    <Link
                      href="/admin/dashboard"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-[#D0D0D1] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#212327] transition-colors"
                    >
                      <Building2 className="w-4 h-4 text-[#FE760B] shrink-0" />
                      <span>Organiser Dashboard</span>
                    </Link>
                  )}

                  <Link
                    href="/dashboard"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-[#FE760B] bg-[#FE760B]/10 font-bold"
                  >
                    <Ticket className="w-4 h-4 text-[#FE760B] shrink-0" />
                    <span>User Dashboard</span>
                  </Link>
                </div>
              </div>
            </div>

            {/* Bottom Section */}
            <div className="p-4 border-t border-slate-200 dark:border-[#2A2D31] bg-slate-50 dark:bg-[#131517] space-y-3">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {user?.displayName || user?.fullName || "User"}
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

      <section className="pt-2 sm:pt-3 pb-3 sm:pb-4 px-3 xs:px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          {/* Welcome Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 sm:mb-4 opacity-0 animate-fade-in-up">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-[#FE760B]/10 text-[#FE760B] border border-[#FE760B]/20">
                  Account Dashboard • Overview
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Welcome, <span className="text-[#FE760B]">{user.fullName || "Guest"}</span>
              </h1>
              <p className="text-slate-600 dark:text-[#9B9EA4] text-xs sm:text-sm mt-0.5 font-medium">
                Your tickets control room — all event passes in one place.
              </p>
            </div>
          </div>

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5 opacity-0 animate-fade-in-up">
            <Link
              href="/my-tickets"
              className="group bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] hover:border-[#FE760B]/40 rounded-2xl p-3.5 sm:p-4 shadow-xs transition-all"
            >
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold text-slate-500 dark:text-[#9B9EA4] uppercase tracking-wider">Total Passes</p>
                <Ticket className="w-4 h-4 text-[#FE760B] group-hover:scale-110 transition-transform" />
              </div>
              <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">{registrations.length}</p>
              <p className="text-[11px] text-[#FE760B] mt-1 font-semibold flex items-center gap-1">View all in My Tickets &rarr;</p>
            </Link>

            <div className="bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] rounded-2xl p-3.5 sm:p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold text-slate-500 dark:text-[#9B9EA4] uppercase tracking-wider">Active Passes</p>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              </div>
              <p className="text-xl sm:text-2xl font-black text-emerald-500 mt-1">{unusedCount}</p>
              <p className="text-[11px] text-slate-500 dark:text-[#9B9EA4] mt-1">Confirmed &amp; ready</p>
            </div>

            <div className="bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] rounded-2xl p-3.5 sm:p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold text-slate-500 dark:text-[#9B9EA4] uppercase tracking-wider">Pending</p>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              </div>
              <p className="text-xl sm:text-2xl font-black text-amber-500 mt-1">{pendingCount}</p>
              <p className="text-[11px] text-slate-500 dark:text-[#9B9EA4] mt-1">Awaiting approval</p>
            </div>

            <div className="bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] rounded-2xl p-3.5 sm:p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold text-slate-500 dark:text-[#9B9EA4] uppercase tracking-wider">Used / Past</p>
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
              </div>
              <p className="text-xl sm:text-2xl font-black text-slate-400 mt-1">{usedCount}</p>
              <p className="text-[11px] text-slate-500 dark:text-[#9B9EA4] mt-1">Admitted events</p>
            </div>
          </div>

          {/* Tickets List */}
          {filteredRegistrations.length === 0 ? (
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
                <Link href="/discover">
                  <Button className="bg-[#FE760B] hover:bg-[#FF8A2B] text-white font-bold h-10 px-5 rounded-xl text-sm transition-all shadow-sm cursor-pointer border-none">
                    Discover live events
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
          )}
        </div>
      </section>
    </main>
  );
}
