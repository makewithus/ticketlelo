"use client";

import { HostingRequestForm } from "@/components/forms/hosting-request-form";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";

import { useAuth } from "@/context/auth-context";

export default function HostEventPage() {
  const { user, loading } = useAuth();

  return (
    <div className="min-h-screen bg-[#131517] text-[#FFFFFF] selection:bg-[#FE760B] selection:text-white">
      {/* Background Ambience: faint top glow per brand guidelines */}
      <div className="absolute top-0 inset-x-0 h-80 bg-gradient-to-b from-[#FE760B]/10 via-[#FE760B]/5 to-transparent pointer-events-none" />

      {/* Top Navigation */}
      <header className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-sm text-[#9B9EA4] hover:text-white transition-colors group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Back to TicketLelo</span>
        </Link>

        <div className="flex items-center gap-3">
          <ThemeToggle inline />
          {!loading && user ? (
            <Link
              href={user.role === "organiser" || user.role === "superAdmin" ? "/admin/dashboard" : "/dashboard"}
              prefetch={false}
              className="px-3.5 py-1.5 rounded-lg bg-[#212327] border border-[#2A2D31] text-xs font-medium text-white hover:bg-[#2A2D31] transition-colors flex items-center gap-2"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>{user.fullName ? user.fullName.split(" ")[0] : "Dashboard"}</span>
            </Link>
          ) : (
            <Link
              href="/login?redirect=/host-event"
              prefetch={false}
              className="px-3.5 py-1.5 rounded-lg bg-[#212327] border border-[#2A2D31] text-xs font-medium text-white hover:bg-[#2A2D31] transition-colors"
            >
              Sign in
            </Link>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <HostingRequestForm />
      </main>
    </div>
  );
}

