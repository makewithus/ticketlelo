"use client";

import { HostingRequestForm } from "@/components/forms/hosting-request-form";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import Link from "next/link";
import { useState } from "react";

export default function HostEventPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="tl-host-page min-h-screen bg-[#f7f5ee] text-[#061a3f] overflow-x-hidden">
      <header className="sticky top-0 z-50 grid grid-cols-[minmax(64px,96px)_minmax(0,1fr)_44px_44px] sm:grid-cols-[140px_minmax(0,1fr)_150px_48px_56px] md:grid-cols-[168px_minmax(0,1fr)_180px_48px_68px] items-center gap-1.5 px-2 py-1 bg-[#f7f5ee]/90 backdrop-blur-xl">
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
          className="hidden sm:flex min-h-12 md:min-h-[68px] rounded-full bg-[#3157ff] text-white items-center justify-center px-3 md:px-6 text-center text-base md:text-xl font-extrabold leading-tight"
        >
          Organiser Login
        </Link>

        <ThemeToggle inline compact className="justify-self-center" />

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
            <button aria-label="Close menu" className="fixed inset-0 z-[70] cursor-default bg-[#061a3f]/35" onClick={() => setMenuOpen(false)} />
            <nav id="host-event-menu" aria-label="Main menu" className="fixed right-0 top-0 z-[80] flex h-[100dvh] w-[min(29.6875rem,100vw)] max-h-[100dvh] flex-col gap-1 overflow-y-auto bg-[#3157ff] px-6 pb-8 pt-24 text-left shadow-2xl sm:px-10">
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setMenuOpen(false)}
                className="absolute right-5 top-5 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/30 text-white transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <X size={24} aria-hidden="true" />
              </button>
              <Link href="/#do" onClick={() => setMenuOpen(false)} className="block w-full py-3 text-2xl font-semibold leading-tight text-white">About TicketLelo</Link>
              <Link href="/#what" onClick={() => setMenuOpen(false)} className="block w-full py-3 text-2xl font-semibold leading-tight text-white">How it Works</Link>
              <Link href="/#pricing" onClick={() => setMenuOpen(false)} className="block w-full py-3 text-2xl font-semibold leading-tight text-white">Pricing &amp; Features</Link>
              <Link href="/#contact" onClick={() => setMenuOpen(false)} className="block w-full py-3 text-2xl font-semibold leading-tight text-white">Contact Us</Link>
              <div className="mt-auto flex flex-col gap-1 border-t border-white/20 pt-5">
                <Link href="/" onClick={() => setMenuOpen(false)} className="block w-full py-2 text-lg font-semibold text-white">Back to TicketLelo</Link>
                <Link href="/organiser-login" onClick={() => setMenuOpen(false)} className="block w-full py-2 text-lg font-semibold text-white">Organiser Login</Link>
                <Link href="/user-login" onClick={() => setMenuOpen(false)} className="block w-full py-2 text-lg font-semibold text-white">Sign In</Link>
              </div>
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
