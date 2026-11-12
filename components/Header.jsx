"use client";

import { User, Building2, Shield, Compass } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { ThemeToggle } from "@/components/ui/theme-toggle";

import Image from "next/image";

import { useAuth } from "@/context/auth-context";

export default function Header() {
  const { user, loading } = useAuth();

  return (
    <>
      {/* ── Seamless Canvas Navigation Header ── */}
      <motion.header
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="fixed top-0 left-0 right-0 z-[100] mx-auto w-full max-w-full overflow-x-clip
          bg-slate-50/95 dark:bg-[#131517]/95 backdrop-blur-md
          border-b border-slate-200 dark:border-[#2A2D31]
          text-slate-900 dark:text-white py-2.5 sm:py-3 px-3.5 sm:px-6 lg:px-8
          flex items-center justify-between gap-2 sm:gap-4 transition-colors"
      >
        {/* Faint top glow only */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#FE760B]/20 to-transparent pointer-events-none" />

        {/* ── Official Wordmark Logo & Navigation Links ── */}
        <div className="flex items-center gap-2.5 sm:gap-6 shrink-0">
          <Link href="/" className="relative z-10 shrink-0 flex items-center group py-0.5">
            <Image
              src="/logo/ticketlelo-logo-nav.png"
              alt="TicketLelo"
              width={120}
              height={30}
              className="h-5 sm:h-[30px] w-auto object-contain transition-opacity group-hover:opacity-95"
              style={{ width: "auto", height: "auto" }}
              priority
            />
          </Link>

          <nav className="flex items-center gap-2.5 sm:gap-4 text-xs sm:text-sm font-medium">
            <Link
              href={
                user?.role === "organiser" || user?.role === "superAdmin" || user?.isAdmin
                  ? "/admin/dashboard"
                  : "/discover"
              }
              className="text-slate-600 dark:text-[#9B9EA4] hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Events
            </Link>
            <Link
              href="/discover"
              className="inline-flex items-center gap-1 sm:gap-1.5 text-slate-700 dark:text-white font-semibold hover:text-[#FE760B] dark:hover:text-[#FE760B] transition-colors"
            >
              <Compass className="w-3.5 h-3.5 text-[#FE760B]" />
              <span>Discover</span>
            </Link>
          </nav>
        </div>

        {/* ── Right Auth & Theme Controls ── */}
        <div className="flex items-center gap-1.5 xs:gap-2.5 relative z-10 shrink-0">
          {/* THEME TOGGLE */}
          <ThemeToggle inline />

          {loading ? (
            <div className="w-20 h-7 sm:h-8 rounded-xl bg-slate-200 dark:bg-[#1A1C1F] animate-pulse" />
          ) : user ? (
            <div className="flex items-center gap-1.5 xs:gap-2">
              <Link
                href={
                  user.role === "superAdmin"
                    ? "/superadmin"
                    : user.role === "organiser" || user.isAdmin
                    ? "/admin/dashboard"
                    : "/dashboard"
                }
                prefetch={false}
                className="bg-[#FE760B] hover:bg-[#FF8A2B] active:bg-[#FE760B] text-white dark:text-[#131517] font-semibold px-3 sm:px-4 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors text-xs sm:text-sm whitespace-nowrap shadow-none border-none"
              >
                <User className="w-3.5 h-3.5 text-white dark:text-[#131517] shrink-0" />
                <span>Dashboard</span>
              </Link>
            </div>
          ) : (
            <>
              <Link
                href="/host-event"
                prefetch={false}
                className="hidden sm:flex bg-slate-100 hover:bg-slate-200 dark:bg-[#1A1C1F] dark:hover:bg-[#212327] text-slate-700 dark:text-[#D0D0D1] hover:text-slate-900 dark:hover:text-white font-medium px-3 py-1.5 rounded-xl items-center gap-1.5 transition-all border border-slate-200 dark:border-[#2A2D31] text-xs sm:text-sm whitespace-nowrap"
              >
                <Building2 className="w-3.5 h-3.5 text-[#FE760B] shrink-0" />
                <span>Host Event</span>
              </Link>
              <Link
                href="/login"
                prefetch={false}
                className="bg-[#FE760B] hover:bg-[#FF8A2B] active:bg-[#FE760B] text-white dark:text-[#131517] font-semibold px-3 sm:px-4 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors text-xs sm:text-sm whitespace-nowrap shadow-none border-none"
              >
                <User className="w-3.5 h-3.5 text-white dark:text-[#131517] shrink-0" />
                <span>Sign In</span>
              </Link>
            </>
          )}
        </div>
      </motion.header>
    </>
  );
}

