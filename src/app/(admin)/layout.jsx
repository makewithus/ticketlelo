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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-slate-600" />
          <p className="text-slate-600">Loading organiser panel...</p>
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
    <div className="min-h-screen bg-black flex">
      {/* Sidebar */}
      <aside className="w-64 bg-gradient-to-b from-black via-slate-950 to-black border-r border-[#FE760B]/20 text-white flex flex-col">
        <div className="p-6 border-b border-[#FE760B]/20">
          <h1 className="text-2xl font-bold text-white">
            Ticketलेलो
          </h1>
          <p className="text-sm text-[#FE760B] mt-1">Organiser Panel</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 text-slate-300 hover:text-[#FE760B] hover:bg-[#FE760B]/10 border border-transparent hover:border-[#FE760B]/20"
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Button>
            </Link>
          ))}
        </nav>

        {/* User Section */}
        <div className="p-4 border-t border-[#FE760B]/20 space-y-3">
          <div className="text-sm">
            <p className="text-slate-400">Logged in as</p>
            <p className="font-medium text-white truncate">{user?.email}</p>
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
      <main className="flex-1 overflow-auto bg-black">
        {children}
      </main>
    </div>
  );
}
