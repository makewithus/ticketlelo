"use client";

import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import {
  LogOut,
  ExternalLink,
  Building2,
  Ticket,
  Loader2,
  Inbox,
  Sliders,
  Calendar,
  Users,
  QrCode,
  BarChart2,
  MessageSquare,
  Globe,
  Bell,
  CreditCard,
  FormInput,
  Shield,
  ChevronRight,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const LOGO_SRC = "/logo/ticketlelo-logo-nav.png";

export default function SuperAdminLayout({ children }) {
  const { user, logout, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const emailLower = (user?.email || "").toLowerCase().trim();
  const isSuperAdmin =
    user?.role === "superAdmin" ||
    emailLower === "adil4ticketlelo@gmail.com" ||
    emailLower === "superadmin@ticketlelo.com";

  useEffect(() => {
    if (!loading && (!user || !isSuperAdmin)) {
      router.push("/login");
    }
  }, [loading, user, isSuperAdmin, router]);

  if (loading) {
    return (
      <div className="tl-system-theme flex items-center justify-center min-h-screen bg-[#131517]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-[#FE760B]" />
          <p className="text-[#9B9EA4] text-sm">Loading super admin panel...</p>
        </div>
      </div>
    );
  }

  if (!user || !isSuperAdmin) {
    return null;
  }

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // Top header subtabs matching user's screenshot
  const topSubtabs = [
    { href: "/superadmin/hosting-requests", label: "Requests" },
    { href: "/superadmin/organisers", label: "Organisers" },
    { href: "/superadmin/site-settings", label: "Site settings" },
  ];

  // Sidebar navigation sections for all portals
  const superAdminNav = [
    {
      href: "/superadmin/hosting-requests",
      icon: Inbox,
      label: "Hosting requests",
    },
    {
      href: "/superadmin/organisers",
      icon: Building2,
      label: "Organisers",
    },
    {
      href: "/superadmin/site-settings",
      icon: Sliders,
      label: "Site settings",
    },
  ];

  const organiserPortalNav = [
    { href: "/admin/overview", icon: Sparkles, label: "Event overview" },
    { href: "/admin/dashboard", icon: Calendar, label: "All events" },
    { href: "/admin/form-generator", icon: FormInput, label: "Form builder" },
    { href: "/admin/registrations", icon: Users, label: "Registrations" },
    { href: "/admin/scanner", icon: QrCode, label: "QR scanner" },
    { href: "/admin/analytics", icon: BarChart2, label: "Analytics" },
    { href: "/admin/messages", icon: MessageSquare, label: "Messages" },
    { href: "/admin/customize", icon: Globe, label: "Customize event" },
  ];

  const attendeePortalNav = [
    { href: "/dashboard", icon: Ticket, label: "My tickets" },
    { href: "/activity", icon: Bell, label: "Activity" },
    { href: "/account", icon: CreditCard, label: "Account & plan" },
  ];

  const getGmailStyleInitial = () => {
    const name = (user?.displayName || user?.name || "").trim();
    if (name && name.toLowerCase() !== "super admin") {
      return name[0].toUpperCase();
    }
    const email = (user?.email || "").trim();
    if (email) {
      return email[0].toUpperCase();
    }
    return "A";
  };

  const userInitial = getGmailStyleInitial();

  const getSectionTitle = () => {
    if (pathname.includes("/superadmin/organisers")) return "Organisers";
    if (pathname.includes("/superadmin/site-settings")) return "Site settings";
    return "Hosting requests";
  };

  return (
    <div className="tl-app-shell tl-system-theme bg-[#131517] min-h-screen flex selection:bg-[#FE760B] selection:text-[#131517]">
      {/* ── Left Sidebar: Full Portal Navigation ── */}
      <aside className="tl-sidebar h-screen max-h-[100dvh] w-72 shrink-0 bg-[#1A1C1F] border-r border-[#2A2D31] flex flex-col justify-between overflow-hidden select-none">
        {/* Brand Header */}
        <div className="shrink-0 border-b border-[#2A2D31] p-4 sm:p-5">
          <Link href="/superadmin/hosting-requests" className="group block">
            <div className="flex items-center gap-3">
              <Image
                src={LOGO_SRC}
                alt="TicketLelo"
                width={90}
                height={30}
                className="h-[30px] w-auto object-contain"
                priority
              />
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FF4D4D]/10 text-[#FF6B6B] border border-[#FF6B6B]/25">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF4D4D] animate-pulse" />
                <span>Super admin</span>
              </div>
            </div>
            <p className="mt-2 text-xs font-medium text-[#9B9EA4]">
              Super admin control room
            </p>
          </Link>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 min-h-0 space-y-4 p-3 overflow-y-auto tl-sidebar-scroll">
            {/* Section 1: Super Admin Portal */}
            <div>
              <p className="tl-sidebar-label mb-1.5 px-3 text-[#9B9EA4] text-[10px] font-bold tracking-wider uppercase">
                Super Admin Portal
              </p>
              <div className="space-y-1">
                {superAdminNav.map((item) => {
                  const cleanPath = (pathname || "").replace(/\/+$/, "");
                  const cleanHref = item.href.replace(/\/+$/, "");
                  const isActive =
                    cleanPath === cleanHref ||
                    (cleanHref === "/superadmin/hosting-requests" &&
                      (cleanPath === "/superadmin" || cleanPath === ""));

                  return (
                    <Link key={item.href} href={item.href}>
                      <div
                        className={`tl-sidebar-link group rounded-xl px-3 py-2 flex items-center gap-2.5 transition-colors ${
                          isActive
                            ? "bg-[#FE760B] text-[#131517] font-bold"
                            : "text-[#D0D0D1] hover:bg-[#212327] hover:text-white"
                        }`}
                      >
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            isActive
                              ? "bg-[#131517]/20 text-[#131517]"
                              : "bg-[#212327] text-[#9B9EA4] group-hover:text-white"
                          }`}
                        >
                          <item.icon className="h-3.5 w-3.5" />
                        </div>
                        <span className="flex-1 text-xs">{item.label}</span>
                        {isActive && (
                          <ChevronRight className="h-3.5 w-3.5 text-[#131517]" />
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Section 2: Organiser Portal (Check & Inspect) */}
            <div>
              <div className="flex items-center justify-between px-3 mb-1.5">
                <p className="tl-sidebar-label text-[#9B9EA4] text-[10px] font-bold tracking-wider uppercase">
                  Organiser Portal
                </p>
                <Link
                  href="/admin/overview"
                  className="text-[10px] text-[#FE760B] hover:underline font-semibold flex items-center gap-0.5"
                >
                  <span>Open</span>
                  <ArrowRight size={10} />
                </Link>
              </div>
              <div className="space-y-1">
                {organiserPortalNav.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link key={item.href} href={item.href}>
                      <div
                        className={`tl-sidebar-link group rounded-xl px-3 py-2 flex items-center gap-2.5 transition-colors ${
                          isActive
                            ? "bg-[#FE760B] text-[#131517] font-bold"
                            : "text-[#9B9EA4] hover:bg-[#212327] hover:text-white"
                        }`}
                      >
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            isActive
                              ? "bg-[#131517]/20 text-[#131517]"
                              : "bg-[#212327]/60 text-[#9B9EA4] group-hover:text-white"
                          }`}
                        >
                          <item.icon className="h-3.5 w-3.5" />
                        </div>
                        <span className="flex-1 text-xs truncate">
                          {item.label}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Section 3: Attendee Portal */}
            <div>
              <p className="tl-sidebar-label mb-1.5 px-3 text-[#9B9EA4] text-[10px] font-bold tracking-wider uppercase">
                Attendee Portal
              </p>
              <div className="space-y-1">
                {attendeePortalNav.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link key={item.href} href={item.href}>
                      <div
                        className={`tl-sidebar-link group rounded-xl px-3 py-2 flex items-center gap-2.5 transition-colors ${
                          isActive
                            ? "bg-[#FE760B] text-[#131517] font-bold"
                            : "text-[#9B9EA4] hover:bg-[#212327] hover:text-white"
                        }`}
                      >
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            isActive
                              ? "bg-[#131517]/20 text-[#131517]"
                              : "bg-[#212327]/60 text-[#9B9EA4] group-hover:text-white"
                          }`}
                        >
                          <item.icon className="h-3.5 w-3.5" />
                        </div>
                        <span className="flex-1 text-xs">{item.label}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Section 4: Public Site */}
            <div>
              <p className="tl-sidebar-label mb-1.5 px-3 text-[#9B9EA4] text-[10px] font-bold tracking-wider uppercase">
                Public Site
              </p>
              <Link href="/" target="_blank" rel="noopener noreferrer">
                <div className="tl-sidebar-link group rounded-xl px-3 py-2 flex items-center gap-2.5 text-[#9B9EA4] hover:bg-[#212327] hover:text-white transition-colors">
                  <div className="w-7 h-7 rounded-lg bg-[#212327]/60 flex items-center justify-center shrink-0 text-[#9B9EA4] group-hover:text-white">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </div>
                  <span className="flex-1 text-xs">Explore events</span>
                </div>
              </Link>
            </div>
          </nav>

        {/* Sidebar Footer: Profile & Sign Out */}
        <div className="shrink-0 border-t border-[#2A2D31] p-3 sm:p-3.5 pb-3.5 sm:pb-4 bg-[#1A1C1F] space-y-2.5">
          {/* User Profile Card */}
          <div className="flex items-center gap-2.5 p-2 rounded-xl bg-[#212327] border border-[#2A2D31] shadow-sm">
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
                userInitial
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="tl-profile-name truncate text-xs font-bold text-white leading-tight">
                {user?.displayName || user?.name || "Super Admin"}
              </p>
              <p className="tl-profile-email truncate text-[10px] text-[#9B9EA4] font-medium mt-0.5">
                {user?.email}
              </p>
            </div>
          </div>

          {/* Role badge & Theme switch row */}
          <div className="flex items-center justify-between px-0.5">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/25">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
              <span>Super Admin</span>
            </span>
            <ThemeToggle inline />
          </div>

          {/* Sign Out Button */}
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-[#FF6B6B]/25 bg-[#212327] text-[#FF6B6B] hover:bg-[#FF4D4D]/15 hover:border-[#FF4D4D]/40 hover:text-[#FF4D4D] transition-all text-xs font-bold shadow-sm cursor-pointer active:scale-[0.99]"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* ── Main Area with Header matching Image ── */}
      <main className="tl-main flex-1 min-w-0 flex flex-col min-h-screen">
        <header className="h-16 border-b border-[#2A2D31]/60 px-4 sm:px-8 flex items-center justify-between bg-[#131517] sticky top-0 z-40">
          <div className="flex items-center gap-6 sm:gap-8">
            {/* Navigation Tabs matching Image */}
            <nav className="flex items-center gap-1 sm:gap-2">
              {topSubtabs.map((item) => {
                const cleanPath = (pathname || "").replace(/\/+$/, "");
                const cleanItemHref = item.href.replace(/\/+$/, "");
                const isActive =
                  cleanPath === cleanItemHref ||
                  (cleanItemHref === "/superadmin/hosting-requests" &&
                    (cleanPath === "/superadmin" || cleanPath === ""));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                      isActive
                        ? "text-white font-semibold bg-[#212327]/60"
                        : "text-[#9B9EA4] hover:text-white"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right side: Organiser link, View site, User Avatar */}
          <div className="flex items-center gap-3 sm:gap-5">
            <Link
              href="/admin/overview"
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#1A1C1F] hover:bg-[#212327] border border-[#2A2D31] text-xs font-semibold text-[#FE760B] transition-colors"
            >
              <Sparkles size={12} />
              <span>Organiser portal</span>
            </Link>

            <Link
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-[#9B9EA4] hover:text-white flex items-center gap-1 transition-colors"
            >
              <span>View site</span>
              <ExternalLink className="w-3 h-3 text-[#9B9EA4]" />
            </Link>

            {/* Circular avatar with dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="w-8 h-8 rounded-full bg-[#212327] border border-[#2A2D31] hover:border-[#FE760B]/50 flex items-center justify-center text-xs font-bold text-white shadow-sm cursor-pointer transition-all overflow-hidden select-none"
                title={user?.email || "Account"}
              >
                {user?.photoURL ? (
                  <Image
                    src={user.photoURL}
                    alt={user?.email || "Account"}
                    width={32}
                    height={32}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="font-bold text-xs">{userInitial}</span>
                )}
              </button>

              {showUserMenu && (
                <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl bg-[#1A1C1F] border border-[#2A2D31] p-3 shadow-2xl z-50 animate-scale-in space-y-3">
                  <div className="border-b border-[#2A2D31] pb-2.5 flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-[#212327] border border-[#2A2D31] flex items-center justify-center text-xs font-bold text-[#FE760B] shrink-0">
                      {userInitial}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] text-[#9B9EA4]">Signed in as</div>
                      <div className="text-xs font-bold text-white truncate">
                        {user?.email}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Link
                      href="/admin/overview"
                      onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-[#D0D0D1] hover:text-white hover:bg-white/5 transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#FE760B]" />
                      <span>Event control room</span>
                    </Link>

                    <Link
                      href="/admin/dashboard"
                      onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-[#D0D0D1] hover:text-white hover:bg-white/5 transition-colors"
                    >
                      <Building2 className="w-3.5 h-3.5 text-[#FE760B]" />
                      <span>Organiser dashboard</span>
                    </Link>

                    <Link
                      href="/dashboard"
                      onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-[#D0D0D1] hover:text-white hover:bg-white/5 transition-colors"
                    >
                      <Ticket className="w-3.5 h-3.5 text-[#FE760B]" />
                      <span>My tickets</span>
                    </Link>
                  </div>

                  <div className="pt-1 border-t border-[#2A2D31] flex items-center justify-between">
                    <span className="text-[11px] text-[#9B9EA4]">Theme</span>
                    <ThemeToggle inline />
                  </div>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-[#FF6B6B] hover:bg-[#FF6B6B]/10 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content area */}
        <div className="tl-content flex-1 p-4 sm:p-6 lg:p-8 w-full max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
