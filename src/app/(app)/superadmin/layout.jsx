"use client";

import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { LogOut, Users, FileText, Settings } from "lucide-react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

const LOGO_SRC = "/logo/Ticket%E0%A4%B2%E0%A5%87%E0%A4%B2%E0%A5%8B-final.png";

export default function SuperAdminLayout({ children }) {
  const { user, logout, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  // Check if user is super admin
  useEffect(() => {
    if (!loading && (!user || user.role !== "superAdmin")) {
      router.push("/super-admin-login");
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="tl-system-theme flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-[#3157ff]" />
          <p className="text-[rgba(6,26,63,0.64)]">Loading super admin panel...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== "superAdmin") {
    return null;
  }

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/super-admin-login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const navItems = [
    {
      href: "/superadmin/hosting-requests",
      icon: FileText,
      label: "Hosting Requests",
    },
    { href: "/superadmin/organisers", icon: Users, label: "Organisers" },
    { href: "/superadmin/site-settings", icon: Settings, label: "Site Settings" },
  ];

  return (
    <div className="tl-app-shell tl-system-theme">
      {/* Sidebar */}
      <aside className="tl-sidebar">
        <div className="p-6 border-b border-[var(--tl-line)]">
          <Link href="/" className="group block">
            <img
              src={LOGO_SRC}
              alt="TicketLelo"
              className="h-12 w-auto object-contain"
            />
          </Link>
          <p className="text-sm text-[rgba(6,26,63,0.64)] font-semibold">
            Super Admin Panel
          </p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={`tl-sidebar-link ${
                    isActive ? "tl-sidebar-link-active" : ""
                  }`}
                >
                  <div className="tl-sidebar-icon">
                    <item.icon
                      className={`w-4 h-4 ${
                        isActive ? "text-white" : "text-[#061a3f]"
                      }`}
                    />
                  </div>
                  <span className="flex-1">{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>

        {/* User Section */}
        <div className="p-4 border-t border-[var(--tl-line)] space-y-3">
          <div className="text-sm">
            <p className="text-[rgba(6,26,63,0.56)]">Logged in as</p>
            <p className="font-medium text-[#061a3f] truncate">{user?.email}</p>
            <p className="text-xs text-[#3157ff] mt-1">Super Administrator</p>
          </div>
          <Button
            onClick={handleLogout}
            className="w-full justify-start gap-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="tl-main">
        <div className="tl-content">{children}</div>
      </main>
    </div>
  );
}
