"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import Link from "next/link";
import {
  BarChart2,
  Calendar,
  ChevronRight,
  CreditCard,
  FormInput,
  Globe,
  Loader2,
  LogOut,
  MessageSquare,
  Moon,
  QrCode,
  Sun,
  Ticket,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";

const LOGO_SRC = "/logo/Ticket%E0%A4%B2%E0%A5%87%E0%A4%B2%E0%A5%8B-final.png";

export function OrganiserShell({ children }) {
  const { user, logout, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const hasAdminAccess = user?.isAdmin || user?.role === "organiser";

    if (!loading && (!user || !hasAdminAccess)) {
      router.push("/organiser-login");
    }

    if (!loading && user?.role === "superAdmin") {
      router.push("/superadmin");
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="tl-system-theme flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 opacity-0 animate-fade-in">
          <div className="tl-auth-icon flex h-16 w-16 items-center justify-center animate-pulse-glow">
            <Ticket className="h-8 w-8 text-white" />
          </div>
          <Loader2 className="h-6 w-6 animate-spin text-[#3157ff]" />
          <p className="text-sm text-[rgba(6,26,63,0.64)]">
            Loading organiser panel...
          </p>
        </div>
      </div>
    );
  }

  const hasAdminAccess = user?.isAdmin || user?.role === "organiser";

  if (!user || !hasAdminAccess) {
    return null;
  }

  const navItems = [
    { href: "/admin/dashboard", icon: Calendar, label: "Create Event" },
    { href: "/admin/form-generator", icon: FormInput, label: "Form Generator" },
    { href: "/admin/registrations", icon: Users, label: "Registrations" },
    { href: "/admin/scanner", icon: QrCode, label: "QR Scanner" },
    { href: "/admin/analytics", icon: BarChart2, label: "Analytics" },
    { href: "/admin/messages", icon: MessageSquare, label: "Messages" },
    { href: "/admin/customize", icon: Globe, label: "Customize Event" },
    { href: "/account", icon: CreditCard, label: "Plan & Account" },
  ];

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/organiser-login");
    } catch (e) {
      console.error("Logout error:", e);
    }
  };

  return (
    <div className="tl-app-shell tl-system-theme">
      <aside className="tl-sidebar">
        <div className="border-b border-[var(--tl-line)] p-6">
          <Link href="/" className="group block">
            <img
              src={LOGO_SRC}
              alt="TicketLelo"
              className="h-12 w-auto object-contain"
            />
            <p className="mt-1 text-xs text-[rgba(6,26,63,0.56)]">
              Organiser Panel
            </p>
          </Link>
        </div>

        <nav className="flex-1 space-y-1.5 p-4">
          <p className="tl-sidebar-label mb-3 px-3">Navigation</p>
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={`tl-sidebar-link group ${
                    isActive ? "tl-sidebar-link-active" : ""
                  }`}
                >
                  <div className="tl-sidebar-icon">
                    <item.icon
                      className={`h-4 w-4 ${
                        isActive ? "text-white" : "text-[#061a3f]"
                      }`}
                    />
                  </div>
                  <span className="flex-1">{item.label}</span>
                  {isActive && <ChevronRight className="h-4 w-4 text-white" />}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="space-y-3 border-t border-[var(--tl-line)] p-4">
          {mounted && (
            <button
              type="button"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="tl-sidebar-link w-full"
            >
              <div className="tl-sidebar-icon">
                {theme === "dark" ? (
                  <Sun className="h-4 w-4 text-[#061a3f]" />
                ) : (
                  <Moon className="h-4 w-4 text-[#061a3f]" />
                )}
              </div>
              <span className="flex-1 text-left">
                {theme === "dark" ? "Light Mode" : "Dark Mode"}
              </span>
            </button>
          )}

          <div className="flex items-center gap-3 px-2">
            <div className="tl-user-avatar">
              {user?.fullName?.charAt(0)?.toUpperCase() || "A"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-[#061a3f]">
                {user?.fullName || "Admin"}
              </p>
              <p className="truncate text-xs text-[rgba(6,26,63,0.56)]">
                {user?.email}
              </p>
            </div>
          </div>

          <Button
            onClick={handleLogout}
            variant="outline"
            className="h-10 w-full gap-2 rounded-lg border-[var(--tl-line)] text-[#061a3f] transition-all hover:border-red-300 hover:bg-red-50 hover:text-red-600"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </aside>

      <main className="tl-main">
        <div className="tl-content">{children}</div>
      </main>
    </div>
  );
}
