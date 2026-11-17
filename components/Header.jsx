"use client";

import { useState } from "react";
import { User, Building2, Compass, Menu, X, Calendar, Tag, Shield } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import Image from "next/image";
import { useAuth } from "@/context/auth-context";

export default function Header() {
  const { user, loading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      {/* ── Seamless Canvas Navigation Header ── */}
      <motion.header
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="fixed top-0 left-0 right-0 z-[100] mx-auto w-full max-w-full
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

          <nav className="hidden md:flex items-center gap-2.5 sm:gap-4 text-xs sm:text-sm font-medium">
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
            <Link
              href="/pricing"
              className="text-slate-600 dark:text-[#9B9EA4] hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Pricing
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
                prefetch={true}
                className="bg-[#FE760B] hover:bg-[#FF8A2B] active:bg-[#FE760B] text-white font-semibold px-3 sm:px-4 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors text-xs sm:text-sm whitespace-nowrap shadow-none border-none min-h-[36px]"
              >
                <User className="w-3.5 h-3.5 text-white shrink-0" />
                <span>Dashboard</span>
              </Link>
            </div>
          ) : (
            <>
              <Link
                href="/host-event"
                prefetch={true}
                className="hidden sm:flex bg-slate-100 hover:bg-slate-200 dark:bg-[#1A1C1F] dark:hover:bg-[#212327] text-slate-700 dark:text-[#D0D0D1] hover:text-slate-900 dark:hover:text-white font-medium px-3 py-1.5 rounded-xl items-center gap-1.5 transition-all border border-slate-200 dark:border-[#2A2D31] text-xs sm:text-sm whitespace-nowrap min-h-[36px]"
              >
                <Building2 className="w-3.5 h-3.5 text-[#FE760B] shrink-0" />
                <span>Host Event</span>
              </Link>
              <Link
                href="/login"
                prefetch={true}
                className="bg-[#FE760B] hover:bg-[#FF8A2B] active:bg-[#FE760B] text-white font-semibold px-3 sm:px-4 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors text-xs sm:text-sm whitespace-nowrap shadow-none border-none min-h-[36px]"
              >
                <User className="w-3.5 h-3.5 text-white shrink-0" />
                <span>Sign In</span>
              </Link>
            </>
          )}

          {/* Mobile Hamburger Toggle Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label="Toggle navigation menu"
            className="md:hidden p-2 rounded-xl text-slate-700 dark:text-[#9B9EA4] hover:bg-slate-100 dark:hover:bg-[#1A1C1F] border border-transparent hover:border-slate-200 dark:hover:border-[#2A2D31] transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5 text-[#FE760B]" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </motion.header>

      {/* ── Mobile Navigation Drawer ── */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="fixed top-[52px] sm:top-[57px] left-0 right-0 z-[99] md:hidden
              bg-white/98 dark:bg-[#131517]/98 backdrop-blur-xl
              border-b border-slate-200 dark:border-[#2A2D31] shadow-2xl
              px-4 py-3.5 space-y-1.5"
          >
            <Link
              href="/"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-[#1A1C1F] transition-colors"
            >
              <Calendar className="w-4 h-4 text-[#FE760B]" />
              <span>Events Home</span>
            </Link>
            <Link
              href="/discover"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold bg-[#FE760B]/12 text-[#FE760B] border border-[#FE760B]/25 transition-colors"
            >
              <Compass className="w-4 h-4 text-[#FE760B]" />
              <span>Discover Hub</span>
            </Link>
            <Link
              href="/host-event"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-[#1A1C1F] transition-colors"
            >
              <Building2 className="w-4 h-4 text-[#FE760B]" />
              <span>Host an Event</span>
            </Link>
            <Link
              href="/pricing"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-[#1A1C1F] transition-colors"
            >
              <Tag className="w-4 h-4 text-[#FE760B]" />
              <span>Plans &amp; Pricing</span>
            </Link>
            {user && (user.role === "superAdmin" || user.email === "adil4ticketlelo@gmail.com") && (
              <Link
                href="/superadmin"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold bg-[#FE760B]/10 text-[#FE760B] border border-[#FE760B]/20 transition-colors"
              >
                <Shield className="w-4 h-4 text-[#FE760B]" />
                <span>Super Admin Suite</span>
              </Link>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
