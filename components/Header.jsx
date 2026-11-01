"use client";

import { Shield, User, Building2, Ticket } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { ThemeToggle } from "@/components/ui/theme-toggle";

import Image from "next/image";

import { useAuth } from "@/context/auth-context";

export default function Header() {
  const { user } = useAuth();

  return (
    <>
      {/* ── Calm Canvas Navigation Header ── */}
      <motion.header
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="fixed top-0 left-0 right-0 z-[100] mx-auto w-full max-w-full
          bg-[#131517]/95 backdrop-blur-md
          border-b border-[#2A2D31]
          text-white py-3 px-4 sm:px-6 lg:px-8
          flex items-center justify-between gap-4"
      >
        {/* Faint top glow only */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#FE760B]/20 to-transparent pointer-events-none" />

        {/* ── Official Wordmark Logo (30px in nav, min 24px) ── */}
        <div className="flex items-center gap-2 xs:gap-3 sm:gap-6 shrink-0">
          <Link href="/" className="relative z-10 shrink-0 flex items-center group py-0.5">
            <Image
              src="/logo/ticketlelo-logo-nav.png"
              alt="TicketLelo"
              width={120}
              height={30}
              className="h-6 sm:h-[30px] w-auto object-contain transition-opacity group-hover:opacity-95"
              style={{ width: "auto", height: "auto" }}
              priority
            />
          </Link>

          <Link
            href="/e-tickets"
            className="flex items-center gap-1.5 text-xs font-semibold text-[#D0D0D1] hover:text-[#FE760B] px-1.5 xs:px-2.5 sm:px-3 py-1.5 rounded-xl hover:bg-[#1A1C1F] transition-colors"
          >
            <Ticket className="w-3.5 h-3.5 text-[#FE760B] shrink-0" />
            <span className="hidden xs:inline">E-tickets</span>
          </Link>
        </div>

        {/* ── Right Auth & Theme Controls ── */}
        <div className="flex items-center gap-1.5 xs:gap-2 relative z-10 shrink-0">
          {/* LIGHT MODE - Placed to the LEFT of Activity per brand guidelines */}
          <ThemeToggle inline />

          {/* Activity */}
          <Link
            href="/activity"
            className="flex items-center gap-1.5 px-2.5 xs:px-3 py-1.5 rounded-full bg-[#1A1C1F] border border-[#2A2D31] text-xs text-[#D0D0D1] hover:text-white transition-colors"
          >
            Activity
          </Link>

          {user ? (
            <Link
              href="/dashboard"
              className="bg-[#FE760B] hover:bg-[#FF8A2B] active:bg-[#FE760B] text-[#131517] font-semibold px-2.5 xs:px-3.5 sm:px-4 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors text-xs sm:text-sm whitespace-nowrap shadow-none border-none"
            >
              <User className="w-3.5 h-3.5 text-[#131517] shrink-0" />
              <span>Dashboard</span>
            </Link>
          ) : (
            <>
              <Link
                href="/host-event"
                className="hidden sm:flex bg-[#1A1C1F] hover:bg-[#212327] text-[#D0D0D1] hover:text-white font-medium px-3 py-1.5 rounded-xl items-center gap-1.5 transition-all border border-[#2A2D31] text-xs sm:text-sm whitespace-nowrap"
              >
                <Building2 className="w-3.5 h-3.5 text-[#FE760B] shrink-0" />
                <span>Host Event</span>
              </Link>
              <Link
                href="/login"
                className="bg-[#FE760B] hover:bg-[#FF8A2B] active:bg-[#FE760B] text-[#131517] font-semibold px-2.5 xs:px-3.5 sm:px-4 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors text-xs sm:text-sm whitespace-nowrap shadow-none border-none"
              >
                <User className="w-3.5 h-3.5 text-[#131517] shrink-0" />
                <span>Sign In</span>
              </Link>
            </>
          )}
        </div>
      </motion.header>
    </>
  );
}

