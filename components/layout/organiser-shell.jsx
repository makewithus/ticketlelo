"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { BrandLoader } from "@/components/ui/brand-loader";
import {
  Calendar,
  Globe,
  Loader2,
  LogOut,
  Sparkles,
  Ticket,
  Bell,
  Plus,
  Shield,
  ChevronDown,
  Compass,
  Menu,
  X,
  Building2,
  Inbox,
  Sliders,
  QrCode,
  Users,
  BarChart2,
  FormInput,
  MessageSquare,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const LOGO_SRC = "/logo/ticketlelo-logo-nav.png";

export function OrganiserShell({ children, allowAnyUser = false }) {
  const { user, logout, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [timeStr, setTimeStr] = useState("");

  const emailLower = (user?.email || "").toLowerCase().trim();
  const isSuperAdmin =
    user?.role === "superAdmin" ||
    emailLower === "adil4ticketlelo@gmail.com" ||
    emailLower === "superadmin@ticketlelo.com";

  const hasAdminAccess =
    user?.isAdmin ||
    user?.role === "organiser" ||
    isSuperAdmin;

  // Live IST Clock matching Image 3 (e.g. "10:57 pm IST")
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

  const hasUser = Boolean(user);

  useEffect(() => {
    if (!loading && !hasUser) {
      router.push("/login");
      return;
    }
    if (!loading && hasUser && !hasAdminAccess && !allowAnyUser) {
      router.push("/dashboard");
    }
  }, [loading, hasUser, hasAdminAccess, allowAnyUser, router]);

  // Close menus on route change
  const [prevPath, setPrevPath] = useState(pathname);
  if (prevPath !== pathname) {
    setPrevPath(pathname);
    setMobileMenuOpen(false);
    setProfileDropdownOpen(false);
  }

  // Lock body scroll when mobile menu drawer is open
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

  // Close dropdown on outside click or Escape
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest("[data-profile-dropdown]")) {
        setProfileDropdownOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setProfileDropdownOpen(false);
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

  if (loading) {
    return (
      <BrandLoader
        message="Loading..."
        fullScreen
      />
    );
  }

  if (!user || (!hasAdminAccess && !allowAnyUser)) {
    return null;
  }

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/login");
    } catch (e) {
      console.error("Logout error:", e);
    }
  };

  const displayName = user?.fullName || user?.name || user?.email?.split("@")[0] || "Adil M";
  const firstChar = (displayName || "A").trim().charAt(0).toUpperCase();
  const photoURL = user?.photoURL || "";

  const isEventsActive =
    pathname.startsWith("/admin/dashboard") ||
    pathname.startsWith("/admin/overview") ||
    pathname.startsWith("/admin/registrations") ||
    pathname.startsWith("/admin/scanner") ||
    pathname.startsWith("/admin/form-generator") ||
    pathname.startsWith("/admin/analytics") ||
    pathname.startsWith("/admin/messages");

  const isCreateEvent = pathname === "/admin/create-event";

  return (
    <div className={`tl-app-shell tl-system-theme min-h-screen flex flex-col transition-colors selection:bg-[#FE760B] selection:text-[#131517] w-full max-w-full overflow-x-hidden ${
      isCreateEvent
        ? "bg-[#432E01] text-white"
        : "bg-slate-50 dark:bg-[#131517] text-slate-900 dark:text-white"
    }`}>
      {/* ── Top Navigation Bar matching Image 2 & 3 (Centered Content Container, border removed / transparent) ── */}
      <header className={`sticky top-0 z-40 h-16 border-b transition-colors backdrop-blur-md ${
        isCreateEvent
          ? "bg-[#432E01]/90 text-white border-white/10"
          : "border-transparent bg-white/80 dark:bg-[#131517]/80"
      }`}>
        <div className="max-w-6xl mx-auto w-full h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          {/* Left Side: Brand Logo + Events + Discover */}
          <div className="flex items-center gap-6 sm:gap-8">
            <Link href="/admin/dashboard" prefetch={false} className="flex items-center gap-2 group">
              <Image
                src={LOGO_SRC}
                alt="TicketLelo"
                width={82}
                height={26}
                className="h-6 sm:h-7 w-auto object-contain transition-transform group-hover:scale-105"
                priority
              />
            </Link>

            {/* Navigation Links (Clean & crisp like Image 1, no chunky orange button backgrounds) */}
            <nav className="hidden md:flex items-center gap-4 sm:gap-6">
              <Link
                href="/admin/dashboard"
                prefetch={false}
                className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                  isEventsActive
                    ? "text-white font-semibold"
                    : "text-[#D0D0D1] hover:text-white"
                }`}
              >
                <Calendar className="w-3.5 h-3.5 text-[#9B9EA4]" />
                <span>Events</span>
              </Link>

              <Link
                href="/discover"
                prefetch={false}
                className={`flex items-center gap-1.5 text-xs font-medium transition-colors cursor-pointer ${
                  pathname === "/discover" || pathname.startsWith("/discover")
                    ? "text-white font-semibold"
                    : "text-[#D0D0D1] hover:text-white"
                }`}
              >
                <Compass className="w-3.5 h-3.5 text-[#9B9EA4]" />
                <span>Discover</span>
              </Link>
            </nav>
          </div>

          {/* Right Side: Live Clock + Theme Toggle + Activity Bell + Create Event CTA + Avatar */}
          <div className="flex items-center gap-2.5 sm:gap-3.5">
            {/* Live Clock */}
            {timeStr && (
              <span
                className="text-[12px] sm:text-[13px] font-sans font-medium text-[#9B9EA4] tracking-normal tabular-nums select-none hidden md:inline-block"
                suppressHydrationWarning
              >
                {timeStr}
              </span>
            )}

            {/* Theme Toggle (Light / Dark Mode matching Image 1) */}
            <ThemeToggle inline />

            {/* Activity Notifications Bell */}
            <Link
              href="/activity"
              title="Activity Notifications"
              className="relative p-1.5 text-[#D0D0D1] hover:text-white transition-colors cursor-pointer"
            >
              <Bell className="w-4 h-4" />
            </Link>

            {/* Create Event CTA (clean transparent text link, no orange bg, no border, no plus icon) */}
            <Link
              href="/admin/create-event"
              prefetch={false}
              className={`text-xs font-medium transition-colors cursor-pointer ${
                pathname === "/admin/create-event"
                  ? "text-white font-semibold"
                  : "text-[#D0D0D1] hover:text-white"
              }`}
            >
              <span>Create Event</span>
            </Link>

            {/* User Profile Avatar with Dropdown (Brand Orange bg-[#FE760B] matching top bars) */}
            <div className="relative" data-profile-dropdown>
              <button
                type="button"
                onClick={() => setProfileDropdownOpen((prev) => !prev)}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#FE760B] text-white font-bold text-xs flex items-center justify-center shadow-xs cursor-pointer hover:ring-2 ring-[#FE760B]/40 transition-all overflow-hidden select-none"
                title={displayName}
              >
                {photoURL && !avatarError ? (
                  <img
                    src={photoURL}
                    alt={displayName}
                    onError={() => setAvatarError(true)}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover rounded-full"
                  />
                ) : (
                  <span className="font-bold text-xs sm:text-sm text-white select-none">{firstChar}</span>
                )}
              </button>

              {/* Profile Dropdown Menu - Organiser only has Sign Out */}
              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] shadow-2xl p-2 z-50 animate-scale-in text-left">
                  <div className="p-2.5 border-b border-slate-100 dark:border-[#2A2D31]">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {displayName}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-[#9B9EA4] truncate mt-0.5">
                      {user?.email}
                    </p>
                    <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#FE760B]/15 text-[#FE760B] border border-[#FE760B]/30">
                      {isSuperAdmin ? "Super Admin" : "Organiser"}
                    </span>
                  </div>

                  <div className="pt-1.5 pb-0.5 space-y-1">
                    {isSuperAdmin && (
                      <Link
                        href="/superadmin"
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-[#FE760B] hover:bg-[#FE760B]/10 transition-colors"
                      >
                        <Shield className="w-3.5 h-3.5" />
                        <span>Super Admin Suite</span>
                      </Link>
                    )}
                    <Link
                      href="/dashboard"
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-[#D0D0D1] hover:bg-slate-100 dark:hover:bg-[#212327] transition-colors"
                    >
                      <Ticket className="w-3.5 h-3.5" />
                      <span>User Dashboard</span>
                    </Link>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-[#FF6B6B] hover:bg-rose-50 dark:hover:bg-[#FF4D4D]/10 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

          {/* Mobile Hamburger Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="md:hidden p-2 rounded-xl border border-transparent hover:border-slate-200 dark:hover:border-[#2A2D31] bg-slate-100/80 dark:bg-[#1A1C1F]/80 text-slate-700 dark:text-[#D0D0D1] hover:text-[#FE760B] transition-colors"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
        </div>
      </header>

      {/* ── Mobile Sidebar Drawer & Backdrop ── */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop Overlay */}
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity animate-fade-in"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Sidebar Drawer Panel */}
          <aside className="fixed inset-y-0 left-0 w-[290px] max-w-[85vw] bg-white dark:bg-[#17191C] border-r border-slate-200 dark:border-[#2A2D31] flex flex-col justify-between shadow-2xl z-50 animate-slide-in-left overflow-y-auto">
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-200 dark:border-[#2A2D31] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Image
                  src={LOGO_SRC}
                  alt="TicketLelo"
                  width={82}
                  height={26}
                  className="h-6 w-auto object-contain"
                  priority
                />
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FE760B]/10 text-[#FE760B] border border-[#FE760B]/30 select-none">
                  <span>Organiser</span>
                </span>
              </div>

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
                  Organiser Suite
                </p>
                <nav className="space-y-1">
                  <Link
                    href="/admin/dashboard"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      isEventsActive
                        ? "text-[#FE760B] bg-[#FE760B]/10 dark:bg-[#FE760B]/15 border border-[#FE760B]/30"
                        : "text-slate-600 dark:text-[#9B9EA4] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#212327]"
                    }`}
                  >
                    <Calendar className="w-4 h-4 shrink-0 text-[#FE760B]" />
                    <span>Events & Management</span>
                  </Link>

                  <Link
                    href="/discover"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      pathname === "/discover" || pathname.startsWith("/discover")
                        ? "text-[#FE760B] bg-[#FE760B]/10 dark:bg-[#FE760B]/15 border border-[#FE760B]/30"
                        : "text-slate-600 dark:text-[#9B9EA4] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#212327]"
                    }`}
                  >
                    <Compass className="w-4 h-4 shrink-0 text-[#9B9EA4]" />
                    <span>Discover Events</span>
                  </Link>

                  <Link
                    href="/admin/create-event"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      pathname === "/admin/create-event"
                        ? "text-[#FE760B] bg-[#FE760B]/10 dark:bg-[#FE760B]/15 border border-[#FE760B]/30"
                        : "text-slate-600 dark:text-[#9B9EA4] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#212327]"
                    }`}
                  >
                    <span>Create Event</span>
                  </Link>

                  <Link
                    href="/activity"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      pathname === "/activity"
                        ? "text-[#FE760B] bg-[#FE760B]/10 dark:bg-[#FE760B]/15 border border-[#FE760B]/30"
                        : "text-slate-600 dark:text-[#9B9EA4] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#212327]"
                    }`}
                  >
                    <Bell className="w-4 h-4 shrink-0 text-[#9B9EA4]" />
                    <span>Activity Notifications</span>
                  </Link>
                </nav>
              </div>

              {/* Portals Switch */}
              <div className="pt-4 border-t border-slate-200 dark:border-[#2A2D31]">
                <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#71767B] mb-2">
                  Switch Portals
                </p>
                <div className="space-y-1">
                  {isSuperAdmin && (
                    <Link
                      href="/superadmin"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-[#FE760B] bg-[#FE760B]/10 hover:bg-[#FE760B]/20 transition-colors"
                    >
                      <Shield className="w-4 h-4 shrink-0" />
                      <span>Super Admin Suite</span>
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

            {/* Bottom User Profile Section */}
            <div className="p-4 border-t border-slate-200 dark:border-[#2A2D31] bg-slate-50 dark:bg-[#131517] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-[#FE760B] flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden">
                    {photoURL && !avatarError ? (
                      <img
                        src={photoURL}
                        alt="Avatar"
                        onError={() => setAvatarError(true)}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      firstChar
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {displayName}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-[#9B9EA4] truncate">
                      {user?.email}
                    </p>
                  </div>
                </div>
                <ThemeToggle inline />
              </div>

              {timeStr && (
                <div className="text-[11px] text-slate-500 dark:text-[#9B9EA4] text-center font-mono">
                  {timeStr}
                </div>
              )}

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

      {/* ── Full Width Content Area (No Desktop Sidebar) ── */}
      <main className="flex-1 min-w-0 w-full transition-colors">
        {children}
      </main>
    </div>
  );
}

export default OrganiserShell;
