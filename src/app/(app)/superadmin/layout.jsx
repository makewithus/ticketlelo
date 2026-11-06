"use client";

import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import {
  LogOut,
  Building2,
  Ticket,
  Inbox,
  Sliders,
  Mail,
  CreditCard,
  LayoutDashboard,
  Menu,
  X,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { BrandLoader } from "@/components/ui/brand-loader";
import { subscribeToPendingHostingRequestsCount } from "@/lib/hosting-requests";

const LOGO_SRC = "/logo/ticketlelo-logo-nav.png";

export default function SuperAdminLayout({ children }) {
  const { user, logout, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

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

  useEffect(() => {
    if (!user || !isSuperAdmin) return;
    const unsub = subscribeToPendingHostingRequestsCount(
      (count) => {
        setPendingCount(count);
      },
      (err) => {
        console.warn("Failed to subscribe to pending requests count:", err);
      },
    );
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, [user, isSuperAdmin]);

  // Close menus on route change
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setShowUserMenu(false);
    setMobileSidebarOpen(false);
  }

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    if (mobileSidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileSidebarOpen]);

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
        setMobileSidebarOpen(false);
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
    return <BrandLoader message="Loading..." fullScreen />;
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

  const getGmailStyleInitial = () => {
    const name = (user?.displayName || user?.fullName || user?.name || "").trim();
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

  // Top navigation tabs for Super Admin portal
  const topTabs = [
    {
      href: "/superadmin/hosting-requests",
      label: "Hosting requests",
      icon: Inbox,
      badge: pendingCount,
    },
    { href: "/superadmin/organisers", label: "Organisers", icon: Building2 },
    { href: "/superadmin/site-settings", label: "Site settings", icon: Sliders },
    { href: "/superadmin/emails", label: "Email monitoring", icon: Mail },
    { href: "/superadmin/payments", label: "Payments", icon: CreditCard },
  ];

  return (
    <div className="tl-app-shell tl-system-theme bg-slate-50 dark:bg-[#131517] text-slate-900 dark:text-white min-h-screen flex flex-col selection:bg-[#FE760B] selection:text-[#131517] transition-colors w-full max-w-full overflow-x-clip">
      {/* ── Top Navigation Bar (Full width, with mobile hamburger & sidebar drawer) ── */}
      <header className="border-b border-slate-200 dark:border-[#2A2D31]/80 bg-white/95 dark:bg-[#131517]/95 backdrop-blur-md sticky top-0 z-40 transition-colors">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Left: Mobile Hamburger + Brand Logo + Super Admin Pill */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Mobile Hamburger Button */}
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="md:hidden p-2 -ml-2 rounded-xl text-slate-700 dark:text-[#D0D0D1] hover:text-[#FE760B] hover:bg-slate-100 dark:hover:bg-[#212327] transition-colors cursor-pointer"
              aria-label="Open navigation sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>

            <Link href="/superadmin/hosting-requests" prefetch={false} className="flex items-center gap-2.5 group">
              <Image
                src={LOGO_SRC}
                alt="TicketLelo"
                width={82}
                height={26}
                className="h-6 sm:h-7 w-auto object-contain transition-transform group-hover:scale-105"
                priority
              />
            </Link>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FF4D4D]/10 text-[#FF6B6B] border border-[#FF6B6B]/30 select-none">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF4D4D] animate-pulse" />
              <span>Super Admin</span>
            </span>
          </div>

          {/* Center: Desktop Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 flex-1 justify-center max-w-4xl">
            {topTabs.map((item) => {
              const cleanPath = (pathname || "").replace(/\/+$/, "");
              const cleanItemHref = item.href.replace(/\/+$/, "");
              const isActive =
                cleanPath === cleanItemHref ||
                (cleanItemHref === "/superadmin/hosting-requests" && (cleanPath === "/superadmin" || cleanPath === ""));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={false}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap shrink-0 ${
                    isActive
                      ? "text-[#FE760B] bg-[#FE760B]/10 dark:bg-[#FE760B]/15 border border-[#FE760B]/30"
                      : "text-slate-600 dark:text-[#9B9EA4] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#212327]"
                  }`}
                >
                  <item.icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-[#FE760B] text-white">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right: Theme Toggle and Profile Dropdown */}
          <div className="flex items-center gap-2 sm:gap-3.5 shrink-0">
            <ThemeToggle inline />

            {/* Profile Avatar with Dropdown */}
            <div className="relative" data-user-dropdown>
              <button
                type="button"
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="w-8 h-8 rounded-full bg-[#FE760B] text-white font-bold text-xs flex items-center justify-center shadow-xs cursor-pointer hover:ring-2 ring-[#FE760B]/40 transition-all overflow-hidden select-none"
                title={user?.email || "Super Admin"}
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
                        {user?.displayName || user?.fullName || "Super Admin"}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-[#9B9EA4] truncate">
                        {user?.email}
                      </div>
                      <span className="inline-block mt-1 px-2 py-0.2 rounded-full text-[9px] font-bold uppercase tracking-wider bg-[#FF4D4D]/15 text-[#FF6B6B] border border-[#FF6B6B]/30">
                        Super Admin
                      </span>
                    </div>
                  </div>

                  {/* Switch to Organiser and User Dashboards */}
                  <div className="space-y-1">
                    <p className="px-2 text-[10px] font-bold text-slate-400 dark:text-[#9B9EA4] uppercase tracking-wider">
                      Switch Portals
                    </p>
                    <Link
                      href="/admin/dashboard"
                      onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-[#D0D0D1] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#212327] transition-colors"
                    >
                      <Building2 className="w-3.5 h-3.5 text-[#FE760B]" />
                      <span>Organiser Dashboard</span>
                    </Link>

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

      {/* ── Mobile Sidebar Drawer & Backdrop ── */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity animate-fade-in"
            onClick={() => setMobileSidebarOpen(false)}
            aria-hidden="true"
          />

          {/* Sidebar Drawer Panel */}
          <aside className="fixed inset-y-0 left-0 w-[290px] max-w-[85vw] bg-white dark:bg-[#17191C] border-r border-slate-200 dark:border-[#2A2D31] flex flex-col justify-between shadow-2xl z-50 animate-slide-in-left overflow-y-auto">
            {/* Top Section */}
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
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FF4D4D]/10 text-[#FF6B6B] border border-[#FF6B6B]/30 select-none">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FF4D4D] animate-pulse" />
                  <span>Super Admin</span>
                </span>
              </div>

              <button
                type="button"
                onClick={() => setMobileSidebarOpen(false)}
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
                  {topTabs.map((item) => {
                    const cleanPath = (pathname || "").replace(/\/+$/, "");
                    const cleanItemHref = item.href.replace(/\/+$/, "");
                    const isActive =
                      cleanPath === cleanItemHref ||
                      (cleanItemHref === "/superadmin/hosting-requests" && (cleanPath === "/superadmin" || cleanPath === ""));

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        prefetch={false}
                        onClick={() => setMobileSidebarOpen(false)}
                        className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                          isActive
                            ? "text-[#FE760B] bg-[#FE760B]/10 dark:bg-[#FE760B]/15 border border-[#FE760B]/30"
                            : "text-slate-600 dark:text-[#9B9EA4] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#212327]"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <item.icon className="w-4 h-4 shrink-0" />
                          <span>{item.label}</span>
                        </div>
                        {item.badge !== undefined && item.badge > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FE760B] text-white">
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
                  <Link
                    href="/admin/dashboard"
                    onClick={() => setMobileSidebarOpen(false)}
                    className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-[#D0D0D1] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#212327] transition-colors"
                  >
                    <Building2 className="w-4 h-4 text-[#FE760B] shrink-0" />
                    <span>Organiser Dashboard</span>
                  </Link>

                  <Link
                    href="/dashboard"
                    onClick={() => setMobileSidebarOpen(false)}
                    className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-[#D0D0D1] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#212327] transition-colors"
                  >
                    <Ticket className="w-4 h-4 text-[#FE760B] shrink-0" />
                    <span>User Dashboard</span>
                  </Link>
                </div>
              </div>
            </div>

            {/* Bottom Footer Section */}
            <div className="p-4 border-t border-slate-200 dark:border-[#2A2D31] bg-slate-50 dark:bg-[#131517] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
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
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {user?.displayName || user?.fullName || "Super Admin"}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-[#9B9EA4] truncate">
                      {user?.email}
                    </p>
                  </div>
                </div>
                <ThemeToggle inline />
              </div>

              <button
                type="button"
                onClick={() => {
                  setMobileSidebarOpen(false);
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

      {/* ── Main Full-Width Content Area ── */}
      <main className="flex-1 min-w-0 w-full transition-colors max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  );
}
