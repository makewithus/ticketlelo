"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { LogOut, Calendar, Users, QrCode, FormInput } from "lucide-react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { BrandLoader } from "@/components/ui/brand-loader";
import { useState, useEffect } from "react";

export default function OrganiserLayout({ children }) {
  const { user, logout, loading, refreshUser } = useAuth();
  const router = useRouter();
  const [verifying, setVerifying] = useState(false);

  // Check if user is organiser/admin with fallback re-verification
  useEffect(() => {
    let isMounted = true;
    const checkAccess = async () => {
      const emailLower = (user?.email || "").toLowerCase().trim();
      const hasAdminAccess =
        user?.isAdmin ||
        user?.role === "organiser" ||
        user?.role === "superAdmin" ||
        emailLower === "adil4ticketlelo@gmail.com" ||
        emailLower === "superadmin@ticketlelo.com";

      if (!loading && (!user || !hasAdminAccess)) {
        if (user && refreshUser) {
          setVerifying(true);
          try {
            const freshUser = await refreshUser();
            if (
              freshUser?.isAdmin ||
              freshUser?.role === "organiser" ||
              freshUser?.role === "superAdmin"
            ) {
              if (isMounted) setVerifying(false);
              return;
            }
          } catch (e) {
            console.warn("Could not re-verify organizer role:", e);
          }
          if (isMounted) setVerifying(false);
        }
        if (isMounted) router.push("/login");
      }
    };

    checkAccess();
    return () => {
      isMounted = false;
    };
  }, [loading, user, router, refreshUser]);

  if (loading || verifying) {
    return <BrandLoader message="Loading..." fullScreen />;
  }

  const emailLower = (user?.email || "").toLowerCase().trim();
  const hasAdminAccess =
    user?.isAdmin ||
    user?.role === "organiser" ||
    user?.role === "superAdmin" ||
    emailLower === "adil4ticketlelo@gmail.com" ||
    emailLower === "superadmin@ticketlelo.com";
  if (!user || !hasAdminAccess) {
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

  const navItems = [
    { href: "/admin/dashboard", icon: Calendar, label: "Create Event" },
    { href: "/admin/form-generator", icon: FormInput, label: "Form Generator" },
    { href: "/admin/registrations", icon: Users, label: "Registrations" },
    { href: "/admin/scanner", icon: QrCode, label: "QR Scanner" },
  ];

  return (
    <div className="tl-app-shell tl-system-theme">
      {/* Sidebar */}
      <aside className="tl-sidebar h-screen max-h-[100dvh] w-72 shrink-0 flex flex-col justify-between overflow-hidden select-none">
        <div className="shrink-0 p-6 border-b border-[var(--tl-line)]">
          <h1 className="tl-brand-word text-2xl">
            Ticket<span className="tl-brand-accent">Lelo</span>
          </h1>
          <p className="text-sm text-[rgba(6,26,63,0.64)] mt-1">Organiser Panel</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 min-h-0 p-4 space-y-2 overflow-y-auto tl-sidebar-scroll">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <Button
                variant="ghost"
                className="tl-sidebar-link w-full justify-start"
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Button>
            </Link>
          ))}
        </nav>

        {/* User Section */}
        <div className="shrink-0 p-4 pb-4 sm:pb-5 border-t border-[var(--tl-line)] space-y-3">
          <div className="text-sm">
            <p className="text-[rgba(6,26,63,0.56)]">Logged in as</p>
            <p className="font-medium text-[#061a3f] truncate">{user?.email}</p>
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
        {children}
      </main>
    </div>
  );
}
