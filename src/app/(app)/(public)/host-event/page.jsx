"use client";

import { HostingRequestForm } from "@/components/forms/hosting-request-form";
import { ArrowUpRight, Menu } from "lucide-react";
import Link from "next/link";

export default function HostEventPage() {
  return (
    <div className="min-h-screen bg-[#f7f5ee] text-[#061a3f] overflow-x-hidden">
      <header className="sticky top-0 z-50 grid grid-cols-[118px_1fr_58px] md:grid-cols-[168px_1fr_220px_72px] items-center gap-1.5 px-2 py-1 bg-[#f7f5ee]/90 backdrop-blur-xl">
        <Link href="/" className="flex items-center">
          <img src="/logo/Ticket%E0%A4%B2%E0%A5%87%E0%A4%B2%E0%A5%8B-final.png" alt="TicketLelo" className="w-28 md:w-40 object-contain" />
        </Link>

        <Link
          href="/"
          className="min-h-[58px] md:min-h-[68px] rounded-full bg-[#ff0084] text-white px-5 md:px-8 flex items-center justify-between gap-4 font-extrabold leading-none"
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
          className="min-h-[58px] md:min-h-[68px] rounded-full bg-[#3157ff] text-white flex items-center justify-center"
          type="button"
          aria-label="Open menu"
        >
          <Menu size={30} strokeWidth={3} />
        </button>
      </header>

      <section className="relative py-8 md:py-12 px-4 sm:px-6 lg:px-8">
        <HostingRequestForm />
      </section>
    </div>
  );
}
