"use client";

import { Shield, User, Building2 } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function Header() {
  return (
    <>
      {/* ── Floating Pill Header ── */}
      <motion.header
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="fixed top-0 left-0 right-0 z-[100] mx-auto w-full max-w-full
          bg-slate-950/90 backdrop-blur-xl
          border-b border-slate-800/80
          text-white py-3 px-4 sm:px-6 lg:px-8
          flex items-center justify-between gap-4
          shadow-[0_4px_30px_rgba(0,0,0,0.4)]"
      >
        {/* Ambient glow */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 via-transparent to-amber-500/5 pointer-events-none" />

        {/* ── Logo Text ── */}
        <Link href="/" className="relative z-10 shrink-0 flex items-center gap-2 group">
          <span className="text-2xl font-black bg-gradient-to-r from-[#FF6A00] to-[#FFD60A] bg-clip-text text-transparent group-hover:brightness-110 transition-all">
            Ticketलेलो
          </span>
          <span className="hidden md:inline-flex px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400">
            Platform
          </span>
        </Link>

        {/* ── Right Auth Buttons ── */}
        <div className="flex items-center gap-2 relative z-10 shrink-0">
          <Link
            href="/super-admin-login"
            className="bg-white/5 hover:bg-white/10 text-slate-200 hover:text-white font-medium px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all border border-white/10 text-xs sm:text-sm whitespace-nowrap"
          >
            <Shield className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">Super Admin</span>
          </Link>
          <Link
            href="/organiser-login"
            className="bg-white/5 hover:bg-white/10 text-slate-200 hover:text-white font-medium px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all border border-white/10 text-xs sm:text-sm whitespace-nowrap"
          >
            <Building2 className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Organiser</span>
          </Link>
          <Link
            href="/user-login"
            className="bg-gradient-to-r from-[#FF6A00] to-[#E65C00] hover:from-[#E65C00] hover:to-[#FF6A00] text-white font-semibold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all text-xs sm:text-sm shadow-md shadow-[#FF6A00]/20 whitespace-nowrap"
          >
            <User className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </Link>
          <div className="pl-1 border-l border-slate-800">
            <ThemeToggle inline compact className="h-9 w-9 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white" />
          </div>
        </div>
      </motion.header>
    </>
  );
}

