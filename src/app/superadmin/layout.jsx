"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { LogOut, Shield, Users, FileText } from "lucide-react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

export default function SuperAdminLayout({ children }) {
  const { user, logout, loading } = useAuth();
  const router = useRouter();

  // Check if user is super admin
  useEffect(() => {
    if (!loading && (!user || user.role !== "superAdmin")) {
      router.push("/");
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-slate-600" />
          <p className="text-slate-600">Loading super admin panel...</p>
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
      router.push("/");
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
  ];

  return (
    <div className="min-h-screen bg-black flex">
      {/* Sidebar */}
      <aside className="w-64 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border-r border-emerald-500/20 text-white flex flex-col">
        <div className="p-6 border-b border-emerald-500/20">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-6 h-6 text-emerald-400" />
            <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
              Ticketलेलो
            </h1>
          </div>
          <p className="text-sm text-emerald-400 font-semibold">
            Super Admin Panel
          </p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 text-slate-300 hover:text-emerald-400 hover:bg-emerald-500/10 border border-transparent hover:border-emerald-500/20"
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Button>
            </Link>
          ))}
        </nav>

        {/* User Section */}
        <div className="p-4 border-t border-emerald-500/20 space-y-3">
          <div className="text-sm">
            <p className="text-slate-400">Logged in as</p>
            <p className="font-medium text-white truncate">{user?.email}</p>
            <p className="text-xs text-emerald-400 mt-1">Super Administrator</p>
          </div>
          <Button
            onClick={handleLogout}
            className="w-full justify-start gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        {children}
      </main>
    </div>
  );
}
