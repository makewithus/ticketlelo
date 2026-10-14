"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { LogOut, Calendar, Users, QrCode, FormInput } from "lucide-react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

export default function OrganiserLayout({ children }) {
  const { user, logout, loading } = useAuth();
  const router = useRouter();

  // Check if user is organiser/admin
  useEffect(() => {
    if (!loading && (!user || !user.isAdmin)) {
      router.push("/organiser-login");
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="tl-system-theme flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-[#3157ff]" />
          <p className="text-[rgba(6,26,63,0.64)]">Loading organiser panel...</p>
        </div>
      </div>
    );
  }

  if (!user || !user.isAdmin) {
    return null;
  }

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/organiser-login");
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
      <aside className="tl-sidebar">
        <div className="p-6 border-b border-[var(--tl-line)]">
          <h1 className="tl-brand-word text-2xl">
            Ticket<span className="tl-brand-accent">Lelo</span>
          </h1>
          <p className="text-sm text-[rgba(6,26,63,0.64)] mt-1">Organiser Panel</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
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
        <div className="p-4 border-t border-[var(--tl-line)] space-y-3">
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
