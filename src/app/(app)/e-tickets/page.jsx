"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { StubTicket } from "@/components/tickets/stub-ticket";
import { WideTicket } from "@/components/tickets/wide-ticket";
import { TicketDeckView } from "@/components/tickets/ticket-deck-view";
import { useAuth } from "@/context/auth-context";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { subscribeToUserRegistrations, getEvent } from "@/lib/firestore";
import {
  Sparkles,
  Ticket,
  Sliders,
  CheckCircle2,
  Calendar,
  MapPin,
  Tag,
  User,
  ArrowRight,
  Layers,
  LayoutTemplate,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLoader } from "@/components/ui/brand-loader";

// The 4 canonical tickets from the official reference design
const CANONICAL_TICKETS = [
  {
    event: {
      name: "TECH FEST 2026",
      theme: "tech",
      date: new Date(2026, 9, 29, 12, 0, 0), // THU 29 OCT 2026 12:00 PM
      time: "12:00 PM",
      location: "MAIN AUDITORIUM",
      price: 199,
    },
    registration: {
      ticketId: "TKT-1793-AB12C",
      attendeeName: "Aarav Kumar",
      ticketTier: "GENERAL",
      amount: 199,
      status: "Valid",
      qrPayload: "TLSEC:v1|evt=techfest-2026|tkt=TKT-1793-AB12C|name=Aarav Kumar",
    },
  },
  {
    event: {
      name: "PRAROHA GAMING",
      theme: "gaming",
      date: new Date(2026, 10, 7, 10, 0, 0), // SAT 07 NOV 2026 10:00 AM
      time: "10:00 AM",
      location: "SCHOOL OF ENGINEERING",
      price: 0,
    },
    registration: {
      ticketId: "TKT-1801-PG07K",
      attendeeName: "Sneha Nair",
      ticketTier: "FREE ENTRY",
      amount: 0,
      status: "Valid",
      qrPayload: "TLSEC:v1|evt=praroha-gaming|tkt=TKT-1801-PG07K|name=Sneha Nair",
    },
  },
  {
    event: {
      name: "OPEN MIC NIGHT",
      theme: "mic",
      date: new Date(2026, 9, 28, 19, 0, 0), // WED 28 OCT 2026 7:00 PM
      time: "7:00 PM",
      location: "AMPHITHEATRE",
      price: null,
    },
    registration: {
      ticketId: "TKT-1764-QM3QX",
      attendeeName: "Priya Sharma",
      ticketTier: "GENERAL",
      amount: null,
      status: "Valid",
      qrPayload: "TLSEC:v1|evt=open-mic-night|tkt=TKT-1764-QM3QX|name=Priya Sharma",
    },
  },
  {
    event: {
      name: "ROBOTICS EXPO",
      theme: "robotics",
      date: new Date(2026, 9, 12, 11, 0, 0), // MON 12 OCT 2026 11:00 AM
      time: "11:00 AM",
      location: "INNOVATION LAB",
      price: null,
    },
    registration: {
      ticketId: "TKT-1749-RX902",
      attendeeName: "Vikram Singh",
      ticketTier: "GENERAL",
      amount: null,
      status: "Valid",
      qrPayload: "TLSEC:v1|evt=robotics-expo|tkt=TKT-1749-RX902|name=Vikram Singh",
    },
  },
];

export default function ETicketsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("deck");
  const [wideTornState, setWideTornState] = useState({});
  const [customDesign, setCustomDesign] = useState("stub"); // 'stub' | 'wide'

  useEffect(() => {
    if (typeof window !== "undefined") {
      const t = new URLSearchParams(window.location.search).get("tab");
      if (t) setActiveTab(t);
    }
  }, []);

  // User's own registered tickets if logged in
  const [userRegistrations, setUserRegistrations] = useState([]);
  const [userEvents, setUserEvents] = useState(new Map());
  const [loadingUserTickets, setLoadingUserTickets] = useState(true);

  // Custom Interactive Ticket Generator State
  const [customForm, setCustomForm] = useState({
    name: "PRAROHA 2027",
    attendeeName: "Krrish Sharma",
    date: "2027-03-12",
    time: "10:30 AM",
    location: "CAMPUS AUDITORIUM",
    ticketTier: "FULL FEST PASS",
    price: "499",
    theme: "tech",
    ticketId: "TKT-2027-PR88X",
  });

  useEffect(() => {
    let isMounted = true;
    if (!user?.id) return;
    const unsubscribe = subscribeToUserRegistrations(user.id, async (regs) => {
      if (!isMounted) return;
      setUserRegistrations(regs);
      const eventsMap = new Map();
      for (const reg of regs) {
        if (!eventsMap.has(reg.eventId)) {
          const ev = await getEvent(reg.eventId);
          if (ev && isMounted) eventsMap.set(reg.eventId, ev);
        }
      }
      if (isMounted) {
        setUserEvents(eventsMap);
        setLoadingUserTickets(false);
      }
    });

    return () => {
      isMounted = false;
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [user?.id]);

  return (
    <main className="min-h-screen bg-[#131517] text-white selection:bg-[#FE760B]/30 selection:text-white pb-24 overflow-x-hidden">
      {/* Container matching screenshot */}
      <div className="max-w-3xl mx-auto px-3 xs:px-4 sm:px-6 pt-6 sm:pt-14">
        {/* Top Logo & Right Controls */}
        <div className="mb-5 sm:mb-6 flex items-center justify-between">
          <Link href="/" className="inline-block group">
            <Image
              src="/logo/ticketlelo-logo-nav.png"
              alt="TicketLelo"
              width={130}
              height={32}
              className="h-7 sm:h-8 w-auto object-contain transition-opacity group-hover:opacity-90"
              priority
            />
          </Link>

          <div className="flex items-center gap-2">
            {/* LIGHT MODE - Placed to the LEFT of Activity per brand guidelines */}
            <ThemeToggle inline />
            <Link
              href="/activity"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1A1C1F] border border-[#2A2D31] text-xs text-[#D0D0D1] hover:text-white transition-colors"
            >
              Activity
            </Link>
          </div>
        </div>

        {/* Page Title & Subtitle matching image */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight mb-2">
            E-tickets
          </h1>
          <p className="text-[#9B9EA4] text-xs sm:text-base font-normal leading-relaxed">
            Ticket designs for TicketLelo events. Click a stub to tear it off, like at check-in.
          </p>
        </div>

        {/* Navigation Mode Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 sm:mb-8 pb-4 border-b border-[#2A2D31]">
          <div className="flex items-center gap-1.5 bg-[#1A1C1F] p-1 rounded-xl border border-[#2A2D31] max-w-full overflow-x-auto scrollbar-none">
            <button
              onClick={() => setActiveTab("showcase")}
              className={`shrink-0 px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "showcase"
                  ? "bg-[#FE760B] text-[#131517] shadow-sm font-semibold"
                  : "text-[#D0D0D1] hover:text-white hover:bg-[#212327]"
              }`}
            >
              Stub Tickets (Image 1)
            </button>
            <button
              onClick={() => setActiveTab("wide")}
              className={`shrink-0 px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "wide"
                  ? "bg-[#FE760B] text-[#131517] shadow-sm font-semibold"
                  : "text-[#D0D0D1] hover:text-white hover:bg-[#212327]"
              }`}
            >
              Wide Tickets (Image 2)
            </button>
            <button
              onClick={() => setActiveTab("deck")}
              className={`shrink-0 px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "deck"
                  ? "bg-[#FE760B] text-[#131517] shadow-sm font-semibold"
                  : "text-[#D0D0D1] hover:text-white hover:bg-[#212327]"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Mobile Deck (Image 3)
            </button>
            <button
              onClick={() => setActiveTab("custom")}
              className={`shrink-0 px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "custom"
                  ? "bg-[#FE760B] text-[#131517] shadow-sm font-semibold"
                  : "text-[#D0D0D1] hover:text-white hover:bg-[#212327]"
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              Dynamic Generator
            </button>
            {user && (
              <button
                onClick={() => setActiveTab("live")}
                className={`shrink-0 px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === "live"
                    ? "bg-[#FE760B] text-[#131517] shadow-sm font-semibold"
                    : "text-[#D0D0D1] hover:text-white hover:bg-[#212327]"
                }`}
              >
                <Ticket className="w-3.5 h-3.5" />
                My Account Tickets ({userRegistrations.length})
              </button>
            )}
          </div>

          <div className="text-[11px] sm:text-xs text-[#9B9EA4] flex items-center gap-1.5 shrink-0">
            <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
            <span>Smooth vertical animation active</span>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════
            TAB 0: INTERACTIVE DECK (Exact Image 1 & 2 Representation)
            ══════════════════════════════════════════════════ */}
        {activeTab === "deck" && (
          <div className="flex flex-col items-center justify-center py-4 opacity-0 animate-fade-in">
            <TicketDeckView />
          </div>
        )}

        {/* ══════════════════════════════════════════════════
            TAB 1: CANONICAL SHOWCASE (Exact Image Representation)
            ══════════════════════════════════════════════════ */}
        {activeTab === "showcase" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white font-semibold text-lg sm:text-xl">
                Stub tickets
              </h2>
              <span className="text-xs text-[#9B9EA4]">
                4 reference designs • Click any stub
              </span>
            </div>

            <div className="space-y-6 sm:space-y-7">
              {CANONICAL_TICKETS.map((item, index) => (
                <div
                  key={index}
                  className="opacity-0 animate-fade-in-up"
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  <StubTicket
                    event={item.event}
                    registration={item.registration}
                    theme={item.event.theme}
                    interactive={true}
                    showActions={false}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════
            TAB: WIDE TICKETS SHOWCASE (Exact Image 2 Match)
            ══════════════════════════════════════════════════ */}
        {activeTab === "wide" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white font-semibold text-lg sm:text-xl">
                Wide tickets
              </h2>
              <span className="text-xs text-[#9B9EA4] font-mono">
                720 × 200 - QR or name panel + art + barcode stub
              </span>
            </div>

            <div className="space-y-6 sm:space-y-7">
              {CANONICAL_TICKETS.map((item, index) => (
                <div
                  key={index}
                  className="opacity-0 animate-fade-in-up"
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  <WideTicket
                    event={item.event}
                    registration={item.registration}
                    theme={item.event.theme}
                    interactive={true}
                    showActions={false}
                    leftVariant={item.event.theme === "gaming" ? "details" : "qr"}
                    onTearChange={(torn) =>
                      setWideTornState((prev) => ({
                        ...prev,
                        [item.registration.ticketId]: torn,
                      }))
                    }
                  />
                </div>
              ))}
            </div>

            <div className="mt-8 pt-4 border-t border-[#2A2D31] text-xs text-[#9B9EA4] font-mono">
              {Object.values(wideTornState).filter(Boolean).length} of {CANONICAL_TICKETS.length} stubs torn off
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════
            TAB 2: DYNAMIC TICKET GENERATOR
            ══════════════════════════════════════════════════ */}
        {activeTab === "custom" && (
          <div className="space-y-8 animate-fade-in">
            {/* Live Preview Card */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-white font-semibold text-lg flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#FE760B]" />
                    Live Dynamic Preview
                  </h2>
                  <span className="text-xs text-[#9B9EA4]">
                    Updates instantaneously as you type
                  </span>
                </div>

                {/* Format toggle: Stub vs Wide */}
                <div className="flex items-center gap-1.5 bg-[#1A1C1F] p-1 rounded-xl border border-[#2A2D31]">
                  <button
                    type="button"
                    onClick={() => setCustomDesign("stub")}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      customDesign === "stub"
                        ? "bg-[#FE760B] text-[#131517] shadow-sm font-bold"
                        : "text-[#D0D0D1] hover:text-white"
                    }`}
                  >
                    Stub Ticket
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomDesign("wide")}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      customDesign === "wide"
                        ? "bg-[#FE760B] text-[#131517] shadow-sm font-bold"
                        : "text-[#D0D0D1] hover:text-white"
                    }`}
                  >
                    Wide Ticket
                  </button>
                </div>
              </div>

              <div className="p-4 bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl flex justify-center">
                {customDesign === "wide" ? (
                  <WideTicket
                    event={{
                      name: customForm.name,
                      location: customForm.location,
                      date: new Date(customForm.date),
                      time: customForm.time,
                      price: customForm.price,
                      theme: customForm.theme,
                      ticketDesign: "wide",
                    }}
                    registration={{
                      ticketId: customForm.ticketId,
                      attendeeName: customForm.attendeeName,
                      ticketTier: customForm.ticketTier,
                      amount: customForm.price,
                      status: "Valid",
                    }}
                    theme={customForm.theme}
                    interactive={true}
                    showActions={true}
                  />
                ) : (
                  <StubTicket
                    event={{
                      name: customForm.name,
                      location: customForm.location,
                      date: new Date(customForm.date),
                      time: customForm.time,
                      price: customForm.price,
                      theme: customForm.theme,
                      ticketDesign: "stub",
                    }}
                    registration={{
                      ticketId: customForm.ticketId,
                      attendeeName: customForm.attendeeName,
                      ticketTier: customForm.ticketTier,
                      amount: customForm.price,
                      status: "Valid",
                    }}
                    theme={customForm.theme}
                    interactive={true}
                    showActions={true}
                  />
                )}
              </div>
            </div>

            {/* Dynamic Controls Form sitting on Surface 1 */}
            <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-6">
              <h3 className="text-base font-semibold text-white mb-4">
                Configure Dynamic Ticket Values
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {/* Event Name */}
                <div>
                  <label className="block text-[#9B9EA4] mb-1.5 font-medium uppercase tracking-wider text-[11px]">
                    Event Name (Heading)
                  </label>
                  <input
                    type="text"
                    value={customForm.name}
                    onChange={(e) =>
                      setCustomForm({ ...customForm, name: e.target.value })
                    }
                    className="w-full bg-[#212327] border border-[#2A2D31] text-white px-3.5 py-2.5 rounded-xl focus:border-[#FE760B] focus:outline-none transition-colors"
                    placeholder="Enter event name"
                  />
                </div>

                {/* Attendee Name */}
                <div>
                  <label className="block text-[#9B9EA4] mb-1.5 font-medium uppercase tracking-wider text-[11px]">
                    Attendee Name
                  </label>
                  <input
                    type="text"
                    value={customForm.attendeeName}
                    onChange={(e) =>
                      setCustomForm({
                        ...customForm,
                        attendeeName: e.target.value,
                      })
                    }
                    className="w-full bg-[#212327] border border-[#2A2D31] text-white px-3.5 py-2.5 rounded-xl focus:border-[#FE760B] focus:outline-none transition-colors"
                    placeholder="Enter attendee name"
                  />
                </div>

                {/* Venue */}
                <div>
                  <label className="block text-[#9B9EA4] mb-1.5 font-medium uppercase tracking-wider text-[11px]">
                    Venue / Hall
                  </label>
                  <input
                    type="text"
                    value={customForm.location}
                    onChange={(e) =>
                      setCustomForm({ ...customForm, location: e.target.value })
                    }
                    className="w-full bg-[#212327] border border-[#2A2D31] text-white px-3.5 py-2.5 rounded-xl focus:border-[#FE760B] focus:outline-none transition-colors"
                    placeholder="Enter venue or hall name"
                  />
                </div>

                {/* Ticket Tier */}
                <div>
                  <label className="block text-[#9B9EA4] mb-1.5 font-medium uppercase tracking-wider text-[11px]">
                    Ticket Tier
                  </label>
                  <input
                    type="text"
                    value={customForm.ticketTier}
                    onChange={(e) =>
                      setCustomForm({
                        ...customForm,
                        ticketTier: e.target.value,
                      })
                    }
                    className="w-full bg-[#212327] border border-[#2A2D31] text-white px-3.5 py-2.5 rounded-xl focus:border-[#FE760B] focus:outline-none transition-colors"
                    placeholder="Enter ticket tier"
                  />
                </div>

                {/* Price */}
                <div>
                  <label className="block text-[#9B9EA4] mb-1.5 font-medium uppercase tracking-wider text-[11px]">
                    Price (₹ or Free Entry)
                  </label>
                  <input
                    type="text"
                    value={customForm.price}
                    onChange={(e) =>
                      setCustomForm({ ...customForm, price: e.target.value })
                    }
                    className="w-full bg-[#212327] border border-[#2A2D31] text-white px-3.5 py-2.5 rounded-xl focus:border-[#FE760B] focus:outline-none transition-colors"
                    placeholder="Enter ticket price or Free Entry"
                  />
                </div>

                {/* Ticket ID */}
                <div>
                  <label className="block text-[#9B9EA4] mb-1.5 font-medium uppercase tracking-wider text-[11px]">
                    Ticket ID (JetBrains Mono)
                  </label>
                  <input
                    type="text"
                    value={customForm.ticketId}
                    onChange={(e) =>
                      setCustomForm({ ...customForm, ticketId: e.target.value })
                    }
                    className="w-full bg-[#212327] border border-[#2A2D31] text-white font-mono px-3.5 py-2.5 rounded-xl focus:border-[#FE760B] focus:outline-none transition-colors"
                    placeholder="Enter ticket ID"
                  />
                </div>

                {/* Theme Selector */}
                <div className="sm:col-span-2">
                  <label className="block text-[#9B9EA4] mb-2 font-medium uppercase tracking-wider text-[11px]">
                    Choose Visual Theme
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {[
                      { key: "tech", label: "Orange Tech", color: "#FE760B" },
                      { key: "gaming", label: "Purple Gaming", color: "#4B2E9C" },
                      { key: "mic", label: "Red Open Mic", color: "#DE334C" },
                      { key: "robotics", label: "Teal Robotics", color: "#0E746D" },
                    ].map((th) => (
                      <button
                        key={th.key}
                        type="button"
                        onClick={() =>
                          setCustomForm({ ...customForm, theme: th.key })
                        }
                        className={`p-2.5 rounded-xl border flex items-center gap-2 transition-all ${
                          customForm.theme === th.key
                            ? "border-[#FE760B] bg-[#212327] ring-1 ring-[#FE760B]"
                            : "border-[#2A2D31] bg-[#1A1C1F] hover:bg-[#212327]"
                        }`}
                      >
                        <span
                          className="w-4 h-4 rounded-full shrink-0"
                          style={{ backgroundColor: th.color }}
                        />
                        <span className="text-xs font-medium text-white truncate">
                          {th.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════
            TAB 3: USER'S LIVE ACCOUNT TICKETS
            ══════════════════════════════════════════════════ */}
        {activeTab === "live" && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold text-lg sm:text-xl">
                My Registered Passes
              </h2>
              <Link
                href="/dashboard"
                className="text-xs text-[#FF9A4D] hover:underline flex items-center gap-1"
              >
                Go to Full Dashboard <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {loadingUserTickets ? (
              <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-12 text-center min-h-[220px] flex items-center justify-center">
                <BrandLoader message="Loading..." fullScreen={false} size="sm" />
              </div>
            ) : userRegistrations.length === 0 ? (
              <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-10 text-center">
                <Ticket className="w-10 h-10 text-[#FE760B] mx-auto mb-3 opacity-80" />
                <h3 className="text-lg font-bold text-white mb-1">
                  No tickets found
                </h3>
                <p className="text-sm text-[#9B9EA4] mb-5 max-w-sm mx-auto">
                  You haven&apos;t registered for any events yet. Check out the
                  showcase designs or browse upcoming college fests!
                </p>
                <Button
                  onClick={() => setActiveTab("showcase")}
                  className="bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-semibold text-xs px-4 h-9 rounded-xl"
                >
                  View Showcase Designs
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                {userRegistrations.map((reg, i) => {
                  const ev = userEvents.get(reg.eventId) || {
                    name: "Festival Event",
                    location: "Main Campus",
                    date: new Date(),
                  };
                  return (
                    <div key={reg.id || i} className="animate-fade-in-up">
                      {(reg.ticketDesign === "wide" || ev.ticketDesign === "wide") ? (
                        <WideTicket
                          event={ev}
                          registration={reg}
                          interactive={true}
                          showActions={true}
                        />
                      ) : (
                        <StubTicket
                          event={ev}
                          registration={reg}
                          interactive={true}
                          showActions={true}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Footer brand attribution */}
        <div className="mt-16 pt-8 border-t border-[#2A2D31] flex flex-col sm:flex-row items-center justify-between text-xs text-[#9B9EA4] gap-4">
          <p>
            TicketLelo Official E-Tickets • Designed per{" "}
            <span className="text-[#D0D0D1] font-mono">branding.md</span>
          </p>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-white transition-colors">
              Home
            </Link>
            <Link href="/dashboard" className="hover:text-white transition-colors">
              User Dashboard
            </Link>
            <Link href="/pricing" className="hover:text-white transition-colors">
              Pricing
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
