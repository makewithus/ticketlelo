"use client";

import { HostingRequestForm } from "@/components/forms/hosting-request-form";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";

import { useAuth } from "@/context/auth-context";

export default function HostEventPage() {
  const { user, loading } = useAuth();

  return (
    <div className="min-h-screen bg-[#131517] text-[#FFFFFF] selection:bg-[#FE760B] selection:text-white w-full max-w-full overflow-x-clip relative">
      {/* Background Ambience: faint top glow per brand guidelines */}
      <div className="absolute top-0 inset-x-0 h-80 bg-gradient-to-b from-[#FE760B]/10 via-[#FE760B]/5 to-transparent pointer-events-none" />

      {/* Top Navigation */}
      <header className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 pb-4 flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-[#9B9EA4] hover:text-white transition-colors group shrink-0">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="hidden xs:inline">Back to TicketLelo</span>
          <span className="xs:hidden">Back</span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <ThemeToggle inline />
          {loading ? (
            <div className="w-20 h-7 rounded-lg bg-[#212327] animate-pulse" />
          ) : user ? (
            <Link
              href={
                user.role === "superAdmin" ||
                user.email === "adil4ticketlelo@gmail.com" ||
                user.email === "superadmin@ticketlelo.com"
                  ? "/superadmin"
                  : user.role === "organiser" || user.isAdmin
                  ? "/admin/dashboard"
                  : "/dashboard"
              }
              prefetch={false}
              className="px-3 sm:px-3.5 py-1.5 rounded-lg bg-[#212327] border border-[#2A2D31] text-xs font-semibold text-white hover:bg-[#2A2D31] hover:border-[#FE760B]/40 transition-all flex items-center gap-2 shadow-sm max-w-[180px] sm:max-w-none"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
              <span className="truncate">Dashboard</span>
            </Link>
          ) : (
            <Link
              href="/login"
              prefetch={false}
              className="px-3.5 py-1.5 rounded-lg bg-[#FE760B] hover:bg-[#FF8A2B] text-xs font-bold text-white transition-colors shadow-sm whitespace-nowrap"
            >
              Sign in
            </Link>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        <HostingRequestForm />
      </main>
    </div>
  );
}

