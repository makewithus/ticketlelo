"use client";

import { use, useEffect, useState } from "react";
import Link from "next/image";
import NextLink from "next/link";
import {
  Ticket,
  Printer,
  Download,
  CalendarPlus,
  ArrowLeft,
  Loader2,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StubTicket } from "@/components/tickets/stub-ticket";
import { WideTicket } from "@/components/tickets/wide-ticket";
import { TicketGuidelinesCard } from "@/components/tickets/ticket-guidelines-card";
import { generateICS } from "@/lib/calendar";
import { parseFirestoreDate } from "@/lib/date-utils";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function TicketViewPage({ params }) {
  const unwrappedParams = use(params);
  const ticketId = unwrappedParams.ticketId;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ticketData, setTicketData] = useState(null);
  const [eventData, setEventData] = useState(null);

  useEffect(() => {
    let isMounted = true;
    async function fetchTicket() {
      try {
        setLoading(true);
        const res = await fetch(`/api/tickets/${ticketId}`);
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Ticket not found");
        }
        if (isMounted) {
          setTicketData(data.ticket);
          setEventData(data.event);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || "Failed to load ticket details");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    if (ticketId) {
      fetchTicket();
    }
    return () => {
      isMounted = false;
    };
  }, [ticketId]);

  const handleDownload = () => {
    window.open(`/api/generate-ticket/${ticketId}`, "_blank");
  };

  const handlePrint = () => {
    window.print();
  };

  const handleAddToCalendar = () => {
    if (!eventData) return;
    try {
      const eventDate = parseFirestoreDate(eventData.date) || new Date();
      const icsData = generateICS({
        title: eventData.name || "Festival Event",
        description: `${eventData.description || ""}\nTicket ID: ${ticketId}`,
        location: eventData.location || "Venue Location",
        startDate: eventDate,
      });

      const blob = new Blob([icsData], { type: "text/calendar;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `${(eventData.name || "event").replace(/\s+/g, "_")}.ics`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Calendar invite downloaded (.ics)");
    } catch {
      toast.error("Failed to generate calendar invite");
    }
  };

  const isWide = eventData?.ticketDesign === "wide";

  if (loading) {
    return (
      <main className="min-h-screen bg-[#131517] text-white flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[#FE760B]/10 border border-[#FE760B]/20 flex items-center justify-center">
            <Ticket className="w-6 h-6 text-[#FE760B]" />
          </div>
          <Loader2 className="w-6 h-6 animate-spin text-[#FE760B]" />
          <p className="text-sm text-[#9B9EA4]">Loading digital entry pass...</p>
        </div>
      </main>
    );
  }

  if (error || !ticketData) {
    return (
      <main className="min-h-screen bg-[#131517] text-white flex items-center justify-center p-4">
        <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-8 max-w-md w-full text-center">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
            <Ticket className="w-6 h-6 text-red-500" />
          </div>
          <h2 className="text-xl font-bold mb-2">Pass Not Found</h2>
          <p className="text-sm text-[#9B9EA4] mb-6">
            {error || "We could not find an entry pass with this ID. Please verify your link or check your dashboard."}
          </p>
          <NextLink href="/dashboard">
            <Button className="bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-bold text-xs h-9 px-5 rounded-xl">
              Go to My Tickets
            </Button>
          </NextLink>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#131517] text-white selection:bg-[#FE760B]/30 selection:text-white pb-20 print:bg-white print:text-black print:pb-0">
      {/* ── PRINT-SPECIFIC CSS ── */}
      <style jsx global>{`
        @media print {
          body {
            background-color: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          nav,
          header,
          footer,
          .print-hide,
          button {
            display: none !important;
          }
          .print-ticket-container {
            display: flex !important;
            flex-direction: column !important;
            justify-content: center !important;
            align-items: center !important;
            gap: 24px !important;
            min-height: auto !important;
            padding: 16px !important;
            box-shadow: none !important;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
        }
      `}</style>

      {/* ── TOP NAV BAR (Hidden when printing) ── */}
      <nav className="border-b border-[#2A2D31] bg-[#131517]/90 backdrop-blur-md sticky top-0 z-50 print-hide">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <NextLink
            href="/dashboard"
            className="flex items-center gap-2 text-xs font-semibold text-[#D0D0D1] hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-[#FE760B]" />
            <span>Dashboard</span>
          </NextLink>

          <NextLink href="/" className="flex items-center gap-1.5">
            <img
              src="/logo/ticketlelo-logo-nav.png"
              alt="TicketLelo"
              className="h-6 sm:h-7 w-auto object-contain"
            />
          </NextLink>

          <div className="flex items-center gap-2">
            <ThemeToggle inline />
          </div>
        </div>
      </nav>

      {/* ── MAIN CONTENT ── */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12">
        {/* Verification Banner */}
        <div className="print-hide mb-8 p-4 rounded-2xl bg-[#1A1C1F] border border-[#2A2D31] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#3DD68C]/15 border border-[#3DD68C]/30 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-[#3DD68C]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-white">
                  Verified Official Entry Pass
                </span>
                <span className="bg-[#3DD68C]/15 text-[#3DD68C] text-[10px] font-black px-2 py-0.5 rounded-md uppercase">
                  {ticketData.status || "VALID"}
                </span>
              </div>
              <p className="text-xs text-[#9B9EA4] mt-0.5">
                Official organizer credentials. Ready to present at entry gate.
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              onClick={handlePrint}
              size="sm"
              className="flex-1 sm:flex-initial h-9 bg-white hover:bg-gray-100 text-black font-bold text-xs rounded-xl gap-1.5 cursor-pointer shadow-sm"
            >
              <Printer className="w-4 h-4 text-black" />
              <span>Print Pass</span>
            </Button>
            <Button
              onClick={handleDownload}
              size="sm"
              variant="outline"
              className="flex-1 sm:flex-initial h-9 bg-[#212327] border-[#2A2D31] text-white hover:bg-[#2A2D31] text-xs rounded-xl gap-1.5 cursor-pointer"
            >
              <Download className="w-4 h-4 text-[#FE760B]" />
              <span>PDF</span>
            </Button>
            <Button
              onClick={handleAddToCalendar}
              size="sm"
              variant="outline"
              className="h-9 px-3 bg-[#212327] border-[#2A2D31] text-white hover:bg-[#2A2D31] text-xs rounded-xl cursor-pointer"
              title="Add to Calendar"
            >
              <CalendarPlus className="w-4 h-4 text-[#7AA2FF]" />
            </Button>
          </div>
        </div>

        {/* ── TICKET PASS & GUIDELINES CONTAINER (Exact Match to Reference Cards 1 & 2) ── */}
        <div className="print-ticket-container flex flex-col items-center gap-6 py-4">
          {/* Card 1: Main Event Pass */}
          {isWide ? (
            <WideTicket
              registration={ticketData}
              event={eventData}
              interactive={true}
              showActions={false}
            />
          ) : (
            <StubTicket
              registration={ticketData}
              event={eventData}
              interactive={true}
              showActions={false}
            />
          )}

          {/* Card 2: Official Entry & Verification Guidelines */}
          <TicketGuidelinesCard
            registration={ticketData}
            event={eventData}
          />
        </div>

        {/* Entry Instructions */}
        <div className="print-hide mt-10 max-w-2xl mx-auto p-5 bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl text-xs text-[#9B9EA4] space-y-2.5">
          <h4 className="font-bold text-white text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#FE760B]" />
            Entry Instructions
          </h4>
          <ul className="list-disc pl-5 space-y-1.5 leading-relaxed">
            <li>
              Present the QR code or Barcode stub on your mobile screen or bring a printed copy.
            </li>
            <li>
              Screen brightness should be turned up for optical barcode and QR scanners at entry.
            </li>
            <li>
              This ticket is unique to your registration (<strong className="text-white font-mono">{ticketId}</strong>).
            </li>
          </ul>
        </div>
      </div>
    </main>
  );
}
