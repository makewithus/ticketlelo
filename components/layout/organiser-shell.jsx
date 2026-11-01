"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  BarChart2,
  Bell,
  Calendar,
  ChevronRight,
  CreditCard,
  FormInput,
  Globe,
  Loader2,
  LogOut,
  MessageSquare,
  QrCode,
  Shield,
  Ticket,
  Users,
  Inbox,
  Building2,
  Sliders,
  Sparkles,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const LOGO_SRC = "/logo/ticketlelo-logo-nav.png";

export function OrganiserShell({ children, allowAnyUser = false }) {
  const { user, logout, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const hasAdminAccess =
    user?.isAdmin ||
    user?.role === "organiser" ||
    user?.role === "superAdmin" ||
    user?.email === "adil4ticketlelo@gmail.com";

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
      return;
    }
    if (!loading && user && !hasAdminAccess && !allowAnyUser) {
      router.push("/dashboard");
    }
  }, [loading, user, hasAdminAccess, allowAnyUser, router]);

  // Reset mobile drawer when pathname changes (official React pattern for state derived from props/routing)
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setMobileNavOpen(false);
  }

  // Body scroll lock & Escape key handling for mobile drawer
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setMobileNavOpen(false);
    };

    if (mobileNavOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [mobileNavOpen]);

  if (loading) {
    return (
      <div className="tl-system-theme flex items-center justify-center min-h-screen bg-slate-50 dark:bg-[#131517] transition-colors">
        <div className="flex flex-col items-center gap-4 opacity-0 animate-fade-in">
          <div className="tl-auth-icon flex h-14 w-14 items-center justify-center bg-[#FE760B] rounded-2xl shadow-sm">
            <Ticket className="h-7 w-7 text-white" />
          </div>
          <Loader2 className="h-6 w-6 animate-spin text-[#FE760B]" />
          <p className="text-sm text-slate-500 dark:text-[#9B9EA4]">
            Loading control room...
          </p>
        </div>
      </div>
    );
  }

  if (!user || (!hasAdminAccess && !allowAnyUser)) {
    return null;
  }

  const emailLower = (user?.email || "").toLowerCase().trim();
  const isSuperAdmin =
    user?.role === "superAdmin" ||
    emailLower === "adil4ticketlelo@gmail.com" ||
    emailLower === "superadmin@ticketlelo.com";

  const superAdminNav = isSuperAdmin
    ? [
        { href: "/superadmin/hosting-requests", icon: Inbox, label: "Hosting requests" },
        { href: "/superadmin/organisers", icon: Building2, label: "Organisers" },
        { href: "/superadmin/site-settings", icon: Sliders, label: "Site settings" },
      ]
    : [];

  const navItems = hasAdminAccess
    ? [
        { href: "/admin/overview", icon: Sparkles, label: "Event overview" },
        { href: "/admin/dashboard", icon: Calendar, label: "Events" },
        { href: "/activity", icon: Bell, label: "Activity" },
        { href: "/admin/form-generator", icon: FormInput, label: "Form generator" },
        { href: "/admin/registrations", icon: Users, label: "Registrations" },
        { href: "/admin/scanner", icon: QrCode, label: "QR scanner" },
        { href: "/admin/analytics", icon: BarChart2, label: "Analytics" },
        { href: "/admin/messages", icon: MessageSquare, label: "Messages" },
        { href: "/admin/customize", icon: Globe, label: "Customize event" },
        { href: "/account", icon: CreditCard, label: "Plan & account" },
      ]
    : [
        { href: "/dashboard", icon: Ticket, label: "My tickets" },
        { href: "/activity", icon: Bell, label: "Activity" },
        { href: "/account", icon: CreditCard, label: "Account" },
        { href: "/host-event", icon: Globe, label: "Host an event" },
      ];

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/login");
    } catch (e) {
      console.error("Logout error:", e);
    }
  };

  const getSectionTitle = () => {
    if (pathname === "/activity") return "Activity";
    if (pathname === "/account") return "Account";
    if (pathname === "/admin/dashboard") return "Events";
    if (pathname === "/admin/overview") return "Event Overview";
    if (pathname === "/admin/create-event") return "Create Event";
    if (pathname === "/admin/form-generator") return "Form generator";
    if (pathname === "/admin/registrations") return "Registrations";
    if (pathname === "/admin/scanner") return "QR scanner";
    if (pathname === "/admin/analytics") return "Analytics";
    if (pathname === "/admin/messages") return "Messages";
    if (pathname === "/admin/customize") return "Customize event";
    return pathname?.split("/")?.filter(Boolean)?.pop()?.replace(/-/g, " ") || "Dashboard";
  };

  // Reusable sidebar navigation content for desktop and mobile drawer
  const renderSidebarContent = (isMobile = false, onClose = () => {}) => (
    <div className="flex flex-col h-full justify-between">
      {/* Brand Header */}
      <div className="shrink-0 border-b border-slate-200 dark:border-[#2A2D31] p-4 sm:p-5 flex items-center justify-between">
        <Link href="/" className="group block" onClick={onClose}>
          <Image
            src={LOGO_SRC}
            alt="TicketLelo"
            width={90}
            height={30}
            className="h-[30px] w-auto object-contain"
            priority
          />
          <p className="mt-2 text-xs font-medium text-slate-500 dark:text-[#9B9EA4]">
            {hasAdminAccess ? "Organiser control room" : "Tickets control room"}
          </p>
        </Link>
        {isMobile && (
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-500 dark:text-[#9B9EA4] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#212327] border border-slate-200 dark:border-[#2A2D31] transition-colors"
            aria-label="Close navigation menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav Items List */}
      <nav className="flex-1 min-h-0 space-y-3 p-3 overflow-y-auto tl-sidebar-scroll">
        {isSuperAdmin && (
          <div className="mb-2 pb-2 border-b border-slate-200 dark:border-[#2A2D31]/60">
            <p className="tl-sidebar-label mb-2 px-3 text-[#FF4D4D] dark:text-[#FF6B6B] text-[10px] font-bold tracking-wider uppercase flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF4D4D] animate-pulse" />
              Super Admin Portal
            </p>
            <div className="space-y-1">
              {superAdminNav.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link key={item.href} href={item.href} prefetch={false} onClick={onClose}>
                    <div
                      className={`tl-sidebar-link group rounded-xl px-3 py-2 flex items-center gap-2.5 transition-colors ${
                        isActive
                          ? "bg-[#FE760B] text-[#131517] font-bold shadow-sm"
                          : "text-slate-700 dark:text-[#D0D0D1] hover:bg-slate-100 dark:hover:bg-[#212327] hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          isActive
                            ? "bg-[#131517]/20 text-[#131517]"
                            : "bg-slate-100 dark:bg-[#212327] text-slate-500 dark:text-[#9B9EA4] group-hover:text-slate-900 dark:group-hover:text-white"
                        }`}
                      >
                        <item.icon className="h-3.5 w-3.5" />
                      </div>
                      <span className="flex-1 text-xs truncate">{item.label}</span>
                      {isActive && <ChevronRight className="h-3.5 w-3.5 text-[#131517] shrink-0" />}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <p className="tl-sidebar-label mb-2 px-3 text-slate-500 dark:text-[#9B9EA4] text-[11px] font-semibold tracking-wider uppercase">
            {isSuperAdmin ? "Organiser Control Room" : "Navigation"}
          </p>
          <div className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link key={item.href} href={item.href} prefetch={false} onClick={onClose}>
                  <div
                    className={`tl-sidebar-link group rounded-xl px-3 py-2.5 flex items-center gap-3 transition-colors ${
                      isActive
                        ? "bg-[#FE760B] text-[#131517] font-semibold shadow-sm"
                        : "text-slate-700 dark:text-[#D0D0D1] hover:bg-slate-100 dark:hover:bg-[#212327] hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        isActive
                          ? "bg-[#131517]/20 text-[#131517]"
                          : "bg-slate-100 dark:bg-[#212327] text-slate-500 dark:text-[#9B9EA4] group-hover:text-slate-900 dark:group-hover:text-white"
                      }`}
                    >
                      <item.icon className="h-4 w-4" />
                    </div>
                    <span className="flex-1 text-sm truncate">{item.label}</span>
                    {isActive && <ChevronRight className="h-4 w-4 text-[#131517] shrink-0" />}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Sidebar Footer: Profile & Sign Out */}
      <div className="shrink-0 border-t border-slate-200 dark:border-[#2A2D31] p-3 sm:p-3.5 pb-3.5 sm:pb-4 bg-slate-50/70 dark:bg-[#1A1C1F] space-y-2.5">
        {/* User Profile Card */}
        <div className="flex items-center gap-2.5 p-2 rounded-xl bg-white dark:bg-[#212327] border border-slate-200 dark:border-[#2A2D31] shadow-sm">
          <div className="w-8 h-8 rounded-full bg-[#FE760B] text-[#131517] flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden shadow-sm">
            {user?.photoURL ? (
              <Image
                src={user.photoURL}
                alt={user?.email || "Avatar"}
                width={32}
                height={32}
                className="w-full h-full object-cover"
              />
            ) : (
              user?.fullName?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || "A"
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="tl-profile-name truncate text-xs font-bold text-slate-900 dark:text-white leading-tight">
              {user?.fullName || (isSuperAdmin ? "Super Admin" : "Organiser")}
            </p>
            <p className="tl-profile-email truncate text-[10px] text-slate-500 dark:text-[#9B9EA4] font-medium mt-0.5">
              {user?.email}
            </p>
          </div>
        </div>

        {(user?.role === "superAdmin" || user?.email === "adil4ticketlelo@gmail.com") && (
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-[#131517] border border-slate-200 dark:border-[#2A2D31]">
            <Link
              href="/superadmin/hosting-requests"
              prefetch={false}
              onClick={onClose}
              className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-[11px] font-medium text-slate-700 dark:text-[#D0D0D1] bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] hover:bg-slate-50 dark:hover:bg-[#212327] hover:border-[#FE760B]/40 hover:text-[#FE760B] dark:hover:text-white transition-all text-center group"
            >
              <Shield className="w-3.5 h-3.5 text-[#FE760B] group-hover:scale-105 transition-transform shrink-0" />
              <span className="truncate">Super Admin</span>
            </Link>
            <Link
              href="/dashboard"
              onClick={onClose}
              className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-[11px] font-medium text-slate-700 dark:text-[#D0D0D1] bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] hover:bg-slate-50 dark:hover:bg-[#212327] hover:border-[#FE760B]/40 hover:text-[#FE760B] dark:hover:text-white transition-all text-center group"
            >
              <Ticket className="w-3.5 h-3.5 text-[#FE760B] group-hover:scale-105 transition-transform shrink-0" />
              <span className="truncate">My Tickets</span>
            </Link>
          </div>
        )}

        {/* Status & Theme Row */}
        <div className="flex items-center justify-between px-0.5">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-[#10B981] border border-emerald-500/25">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
            <span>{isSuperAdmin ? "Super Admin" : "Organiser"}</span>
          </span>
          <ThemeToggle inline />
        </div>

        {/* Sign Out Button */}
        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-rose-200 dark:border-[#FF6B6B]/25 bg-rose-50/70 dark:bg-[#212327] text-rose-600 dark:text-[#FF6B6B] hover:bg-rose-100 dark:hover:bg-[#FF4D4D]/15 hover:border-rose-300 dark:hover:border-[#FF4D4D]/40 hover:text-rose-700 dark:hover:text-[#FF4D4D] transition-all text-xs font-bold shadow-sm cursor-pointer active:scale-[0.99]"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="tl-app-shell tl-system-theme bg-slate-50 dark:bg-[#131517] text-slate-900 dark:text-white min-h-screen transition-colors">
      {/* ── Desktop Left Sidebar (>= 1024px) ── */}
      <aside className="tl-sidebar hidden lg:flex h-screen max-h-[100dvh] w-72 shrink-0 bg-white dark:bg-[#1A1C1F] border-r border-slate-200 dark:border-[#2A2D31] flex-col justify-between overflow-hidden select-none sticky top-0 transition-colors">
        {renderSidebarContent(false)}
      </aside>

      {/* ── Mobile & Tablet Drawer (< 1024px) ── */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden animate-fade-in"
          onClick={() => setMobileNavOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 sm:w-80 max-w-[85vw] h-full max-h-[100dvh] bg-white dark:bg-[#1A1C1F] border-r border-slate-200 dark:border-[#2A2D31] flex flex-col justify-between overflow-hidden select-none shadow-2xl lg:hidden transition-transform duration-300 ease-in-out ${
          mobileNavOpen ? "translate-x-0" : "-translate-x-full pointer-events-none"
        }`}
      >
        {renderSidebarContent(true, () => setMobileNavOpen(false))}
      </aside>

      {/* ── Main Area with Unified Top Navigation ── */}
      <main className="tl-main flex-1 min-w-0 flex flex-col min-h-screen bg-slate-50 dark:bg-[#131517] transition-colors">
        <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#131517]/95 backdrop-blur-md border-b border-slate-200 dark:border-[#2A2D31] px-3.5 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-3 transition-colors">
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            {/* Hamburger trigger for mobile */}
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden p-1.5 sm:p-2 rounded-xl border border-slate-200 dark:border-[#2A2D31] bg-slate-100 dark:bg-[#1A1C1F] text-slate-700 dark:text-[#D0D0D1] hover:text-[#FE760B] transition-colors shrink-0"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Mobile Logo */}
            <Link href="/" className="lg:hidden shrink-0 flex items-center">
              <Image
                src={LOGO_SRC}
                alt="TicketLelo"
                width={76}
                height={24}
                className="h-5 sm:h-6 w-auto object-contain"
                priority
              />
            </Link>

            {/* Breadcrumb section title */}
            <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-[#9B9EA4] min-w-0">
              <span className="hidden sm:inline">Control room</span>
              <span className="text-slate-300 dark:text-[#2A2D31] hidden sm:inline">/</span>
              <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white capitalize truncate">
                {getSectionTitle()}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0 z-10">
            {/* Theme Toggle */}
            <ThemeToggle inline />

            {/* Activity Button */}
            <Link
              href="/activity"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors ${
                pathname === "/activity"
                  ? "bg-[#FE760B] text-[#131517] border-[#FE760B] font-semibold"
                  : "bg-slate-100 dark:bg-[#1A1C1F] border-slate-200 dark:border-[#2A2D31] text-slate-700 dark:text-[#D0D0D1] hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Activity</span>
            </Link>

            {/* My Tickets */}
            <Link
              href="/dashboard"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] text-xs text-slate-700 dark:text-[#D0D0D1] hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <Ticket className="w-3.5 h-3.5 text-[#FE760B]" />
              <span>Tickets</span>
            </Link>

            {/* User status badge */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31]">
              <div className="w-2 h-2 rounded-full bg-[#3DD68C]" />
              <span className="text-xs text-slate-700 dark:text-[#D0D0D1] truncate max-w-[140px]">{user?.email}</span>
            </div>
          </div>
        </header>

        <div className="tl-content flex-1 p-3.5 xs:p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
