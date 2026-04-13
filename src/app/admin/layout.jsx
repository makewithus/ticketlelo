"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import {
  LogOut,
  Calendar,
  Users,
  QrCode,
  Ticket,
  ChevronRight,
  Sun,
  Moon,
  Loader2,
  FormInput,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default function AdminLayout({ children }) {
  const { user, logout, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Check if user should have access
    const hasAdminAccess = user?.isAdmin || user?.role === "organiser";

    if (!loading && (!user || !hasAdminAccess)) {
      console.log("❌ No admin access, redirecting to homepage");
      router.push("/");
    }

    // Redirect super admin to super admin panel
    if (!loading && user && user.role === "superAdmin") {
      console.log("🔀 Super admin detected, redirecting to super admin panel");
      router.push("/superadmin");
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-emerald-50 dark:bg-[#0a0c1c]">
        <div className="flex flex-col items-center gap-4 opacity-0 animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-2xl shadow-emerald-500/30 animate-pulse-glow">
            <Ticket className="w-8 h-8 text-white" />
          </div>
          <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
          <p className="text-gray-500 dark:text-slate-400">
            Loading admin panel...
          </p>
        </div>
      </div>
    );
  }

  // Check if user has admin access (either isAdmin flag OR organiser role)
  const hasAdminAccess = user?.isAdmin || user?.role === "organiser";

  if (!user || !hasAdminAccess) {
    return null;
  }

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/");
    } catch (e) {
      console.error("Logout error:", e);
    }
  };

  const navItems = [
    { href: "/admin/dashboard", icon: Calendar, label: "Create Event" },
    { href: "/admin/form-generator", icon: FormInput, label: "Form Generator" },
    { href: "/admin/registrations", icon: Users, label: "Registrations" },
    { href: "/admin/scanner", icon: QrCode, label: "QR Scanner" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0c1c] flex text-gray-900 dark:text-white transition-colors">
      {/* Sidebar */}
      <aside className="w-72 border-r border-emerald-100 dark:border-slate-800 bg-white dark:bg-[#0d0f1f] flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-emerald-100 dark:border-slate-800">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div>
              <span className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">
                Ticket<span className="text-emerald-500">लेलो</span>
              </span>
              <p className="text-xs text-gray-400 dark:text-slate-500">
                Organiser Panel
              </p>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1.5">
          <p className="text-xs font-semibold text-gray-400 dark:text-slate-600 uppercase tracking-wider mb-3 px-3">
            Navigation
          </p>
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                    isActive
                      ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20"
                      : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-emerald-50/50 dark:hover:bg-slate-800/50 border border-transparent"
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                      isActive
                        ? "bg-emerald-100 dark:bg-emerald-500/20"
                        : "bg-gray-100 dark:bg-slate-800/50 group-hover:bg-emerald-50 dark:group-hover:bg-slate-800"
                    }`}
                  >
                    <item.icon
                      className={`w-4 h-4 ${isActive ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400 dark:text-slate-500 group-hover:text-emerald-500 dark:group-hover:text-slate-300"}`}
                    />
                  </div>
                  <span className="flex-1">{item.label}</span>
                  {isActive && (
                    <ChevronRight className="w-4 h-4 text-emerald-500" />
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* User Section */}
        <div className="p-4 border-t border-emerald-100 dark:border-slate-800 space-y-3">
          {/* Theme toggle */}
          {mounted && (
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-emerald-50/50 dark:hover:bg-slate-800/50 border border-transparent transition-all"
            >
              <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-slate-800/50 flex items-center justify-center">
                {theme === "dark" ? (
                  <Sun className="w-4 h-4 text-amber-400" />
                ) : (
                  <Moon className="w-4 h-4 text-emerald-500" />
                )}
              </div>
              <span className="flex-1 text-left">
                {theme === "dark" ? "Light Mode" : "Dark Mode"}
              </span>
            </button>
          )}

          <div className="flex items-center gap-3 px-2">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-xs font-bold text-white shadow-lg shadow-emerald-500/20">
              {user?.fullName?.charAt(0)?.toUpperCase() || "A"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {user?.fullName || "Admin"}
              </p>
              <p className="text-xs text-gray-400 dark:text-slate-500 truncate">
                {user?.email}
              </p>
            </div>
          </div>
          <Button
            onClick={handleLogout}
            variant="outline"
            className="w-full h-10 gap-2 border-emerald-200 dark:border-slate-800 text-gray-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-500/30 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all rounded-xl"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
