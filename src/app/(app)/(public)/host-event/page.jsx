"use client";

import { HostingRequestForm } from "@/components/forms/hosting-request-form";
import { ArrowUpRight, Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function HostEventPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="tl-host-page min-h-screen bg-[#f7f5ee] text-[#061a3f] overflow-x-hidden">
      <header className="sticky top-0 z-50 grid grid-cols-[minmax(76px,118px)_minmax(0,1fr)_48px] md:grid-cols-[168px_1fr_220px_72px] items-center gap-1.5 px-2 py-1 bg-[#f7f5ee]/90 backdrop-blur-xl">
        <Link href="/" className="flex items-center">
          <img src="/logo/Ticket%E0%A4%B2%E0%A5%87%E0%A4%B2%E0%A5%8B-final.png" alt="TicketLelo" className="w-28 md:w-40 object-contain" />
        </Link>

        <Link
          href="/"
          className="min-w-0 min-h-[58px] md:min-h-[68px] rounded-full bg-[#ff0084] text-white px-3 sm:px-5 md:px-8 flex items-center justify-between gap-2 sm:gap-4 font-extrabold leading-none"
        >
          <span className="hidden md:inline text-2xl font-normal">Host request portal</span>
          <span className="text-sm md:text-lg">Back to TicketLelo</span>
          <ArrowUpRight size={22} strokeWidth={2.6} />
        </Link>

        <Link
          href="/organiser-login"
          className="hidden md:flex min-h-[68px] rounded-full bg-[#3157ff] text-white items-center justify-center px-8 text-xl font-extrabold"
        >
          Organiser Login
        </Link>

        <button
          className="relative z-[61] min-h-[48px] md:min-h-[68px] rounded-full bg-[#3157ff] text-white flex items-center justify-center"
          type="button"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls="host-event-menu"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={28} strokeWidth={3} /> : <Menu size={30} strokeWidth={3} />}
        </button>
        {menuOpen && (
          <>
            <button aria-label="Close menu" className="fixed inset-0 z-[59] cursor-default bg-[#061a3f]/35" onClick={() => setMenuOpen(false)} />
            <nav id="host-event-menu" aria-label="Main menu" className="absolute right-2 top-[calc(100%+0.5rem)] z-[60] w-[min(22rem,calc(100vw-1rem))] rounded-2xl border border-[#061a3f]/10 bg-[#fffdfa] p-3 shadow-2xl">
              <Link href="/" onClick={() => setMenuOpen(false)} className="block rounded-xl px-4 py-3 font-bold text-[#061a3f] hover:bg-[#f3f0e8]">Back to TicketLelo</Link>
              <Link href="/organiser-login" onClick={() => setMenuOpen(false)} className="block rounded-xl px-4 py-3 font-bold text-[#061a3f] hover:bg-[#f3f0e8]">Organiser Login</Link>
              <Link href="/user-login" onClick={() => setMenuOpen(false)} className="block rounded-xl px-4 py-3 font-bold text-[#061a3f] hover:bg-[#f3f0e8]">Sign In</Link>
            </nav>
          </>
        )}
      </header>

      <section className="relative py-8 md:py-12 px-4 sm:px-6 lg:px-8">
        <HostingRequestForm />
      </section>
    </div>
  );
}
