"use client";

import { Shield, User, Building2 } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";

export default function Header() {
  return (
    <>
      {/* ── Floating Pill Header ── */}
      <motion.header
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="fixed top-0 left-0 right-0 z-[100] mx-auto w-full max-w-full
          bg-black/80 backdrop-blur-xl
          border-b border-[#FF6A00]/20
          text-white py-3 px-4 sm:px-6
          flex items-center justify-between gap-4
          shadow-[0_0_40px_rgba(254,118,11,0.12)]"
      >
        {/* Ambient glow */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#FF6A00]/5 via-transparent to-[#FFD60A]/5 pointer-events-none" />
        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.02] pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(rgba(52,211,153,0.6) 1px, transparent 1px),
                             linear-gradient(90deg, rgba(52,211,153,0.6) 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
          }}
        />

        {/* ── Logo Text ── */}
        <Link href="/" className="relative z-10 shrink-0">
          <span className="text-2xl font-bold bg-[#FF6A00] hover:bg-[#E65C00] bg-clip-text text-transparent">
            Ticketलेलो
          </span>
        </Link>

        {/* ── Right Auth Buttons ── */}
        <div className="flex items-center gap-1.5 relative z-10 shrink-0">
          <Link
            href="/super-admin-login"
            className="bg-white/5 hover:bg-white/10 text-white font-medium px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all border border-white/10 text-sm whitespace-nowrap"
          >
            <Shield className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Super Admin</span>
          </Link>
          <Link
            href="/organiser-login"
            className="bg-white/5 hover:bg-white/10 text-white font-medium px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all border border-white/10 text-sm whitespace-nowrap"
          >
            <Building2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Organiser</span>
          </Link>
          <Link
            href="/user-login"
            className="bg-[#FFD60A] hover:bg-[#FF6A00] hover:text-white text-white font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all text-sm shadow-lg shadow-[#FFD60A]/20 whitespace-nowrap"
          >
            <User className="w-3.5 h-3.5" />
            Sign In
          </Link>
        </div>
      </motion.header>
    </>
  );
}
