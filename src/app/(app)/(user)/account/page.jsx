"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
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
  Building2,
  Menu,
  X,
  LogOut,
  LayoutDashboard,
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { getPlan } from "@/lib/plans";
import { getEventsByOrganiser, subscribeToUserRegistrations } from "@/lib/firestore";
import { BrandLoader } from "@/components/ui/brand-loader";

const LOGO_SRC = "/logo/ticketlelo-logo-nav.png";

export default function AccountPage() {
  const { user, logout, loading: authLoading } = useAuth();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname() || "/account";
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [registrations, setRegistrations] = useState([]);
  const [loadingRegistrations, setLoadingRegistrations] = useState(true);
  const [appearance, setAppearance] = useState("dark");
  const [currentTime, setCurrentTime] = useState("1:04 PM IST");
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

  const emailLower = (user?.email || "").toLowerCase().trim();
  const superAdminEnv = (process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL || process.env.SUPER_ADMIN_EMAIL || "").toLowerCase().trim();
  const isSuperAdmin =
    user?.role === "superAdmin" ||
    user?.role === "superadmin" ||
    Boolean(user?.isAdmin) ||
    emailLower === "adil4ticketlelo@gmail.com" ||
    emailLower === "superadmin@ticketlelo.com" ||
    (superAdminEnv && emailLower === superAdminEnv);

  const hasOrganiserAccess = isSuperAdmin || user?.role === "organiser" || user?.role === "organizer" || Boolean(user?.isAdmin);
  const isOrganiser = hasOrganiserAccess;

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
    const uid = user?.id || user?.uid;
    if (!uid || !isOrganiser) {
      setLoadingEvents(false);
      return;
    }
    setLoadingEvents(true);
    try {
      const data = await getEventsByOrganiser(uid);
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
  }, [user, isOrganiser]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Load registrations for user / attendee
  useEffect(() => {
    const uid = user?.id || user?.uid;
    if (!uid) {
      setLoadingRegistrations(false);
      return;
    }
    try {
      const unsub = subscribeToUserRegistrations(uid, (regs) => {
        setRegistrations(Array.isArray(regs) ? regs : []);
        setLoadingRegistrations(false);
      });
      return () => unsub?.();
    } catch (e) {
      console.warn("Registrations subscription notice:", e);
      setLoadingRegistrations(false);
    }
  }, [user]);

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

  if (authLoading || !user) {
    return <BrandLoader message="Loading account..." fullScreen />;
  }

  return (
    <div className="tl-system-theme min-h-screen bg-slate-50 dark:bg-[#131517] text-slate-900 dark:text-white transition-colors flex flex-col w-full max-w-full overflow-x-clip">
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
                {photoURL ? (
                  <img
                    src={photoURL}
                    alt={displayName}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover rounded-full"
                  />
                ) : (
                  <span className="font-bold text-xs sm:text-sm text-white">{firstChar}</span>
                )}
              </button>

              {showUserMenu && (
                <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] p-3 shadow-2xl z-50 animate-scale-in space-y-3 text-left">
                  {/* User Profile Card */}
                  <div className="border-b border-slate-100 dark:border-[#2A2D31] pb-2.5 flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-[#FE760B] flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden">
                      {photoURL ? (
                        <img
                          src={photoURL}
                          alt="Avatar"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        firstChar
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {displayName}
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
                      className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-[#D0D0D1] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#212327] transition-colors"
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
                    className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-[#D0D0D1] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#212327] transition-colors"
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
                    {displayName}
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
