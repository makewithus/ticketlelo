"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  Ticket,
  Calendar,
  MapPin,
  Clock,
  Tag,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Info,
  Layers,
  Navigation,
  Share2,
  Users,
} from "lucide-react";
import Header from "@/components/Header";
import { getEvent } from "@/lib/firestore";
import { getSubEventsForEvent } from "@/lib/sub-events";
import { getCombosForEvent } from "@/lib/combos";
import { VenueMap } from "@/components/common/venue-map";
import { DynamicRegistrationForm } from "@/components/forms/dynamic-registration-form";
import { formatEventDate } from "@/lib/date-utils";

export default function RegisterPage() {
  const { eventId } = useParams();
  const [event, setEvent] = useState(null);
  const [subEvents, setSubEvents] = useState([]);
  const [combos, setCombos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!eventId) return;
    (async () => {
      try {
        const [eventData, subEventsData, combosData] = await Promise.all([
          getEvent(eventId).catch(() => null),
          getSubEventsForEvent(eventId).catch(() => []),
          getCombosForEvent(eventId).catch(() => []),
        ]);

        setEvent(eventData ? { id: eventId, ...eventData } : null);
        setSubEvents(Array.isArray(subEventsData) ? subEventsData : []);
        setCombos(Array.isArray(combosData) ? combosData : []);
      } catch (error) {
        console.error("Failed to load event data:", error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [eventId]);

  const formattedDate = event ? formatEventDate(event.date || event.startDate) : "";
  const isPaid = Boolean(event?.isPaid && (event?.price || event?.amount));
  const priceDisplay = isPaid ? `₹${event?.price || event?.amount}` : "Free Pass";

  return (
    <div className="min-h-screen bg-[#070D1E] text-slate-100 relative selection:bg-blue-600 selection:text-white overflow-x-hidden">
      {/* Ambient background glow accents */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/10 rounded-full blur-[140px]" />
        <div className="absolute top-1/3 -right-40 w-96 h-96 bg-amber-500/5 rounded-full blur-[140px]" />
        <div className="absolute bottom-10 left-1/3 w-96 h-96 bg-emerald-500/5 rounded-full blur-[140px]" />
      </div>

      <Header />

      <main className="relative z-10 pt-28 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] py-20">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4">
              <Loader2 className="w-7 h-7 animate-spin text-blue-400" />
            </div>
            <p className="text-base font-semibold text-white">Loading Event Details...</p>
            <p className="text-xs text-slate-400 mt-1">Fetching registration fields and seat inventory</p>
          </div>
        ) : !event || event.isActive === false ? (
          <div className="text-center py-20 max-w-md mx-auto">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-amber-500/10 border border-amber-500/20 rounded-2xl mb-6">
              <Calendar className="w-10 h-10 text-amber-400" />
            </div>
            <h3 className="text-2xl font-bold mb-2 text-white">Event Unavailable</h3>
            <p className="text-slate-400 mb-6 text-sm">
              This event is either past, archived, or currently not accepting registrations.
            </p>
            <Link
              href="/#events"
              className="inline-flex items-center gap-2 text-sm text-slate-200 hover:text-white bg-slate-900 border border-slate-700 px-5 py-2.5 rounded-xl hover:border-blue-500/40 hover:bg-slate-800 transition-all shadow-sm"
            >
              <ArrowLeft className="w-4 h-4 text-blue-400" />
              <span>Back to Events Catalog</span>
            </Link>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-8"
          >
            {/* ── Breadcrumb & Status Ribbon ── */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
              <Link
                href="/#events"
                className="inline-flex items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-800 px-4 py-2 rounded-xl transition-all shadow-sm group"
              >
                <ArrowLeft className="w-4 h-4 text-blue-400 group-hover:-translate-x-1 transition-transform" />
                <span>Back to Events</span>
              </Link>

              <div className="flex items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Registration Open
                </span>
                {event.category && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-300 border border-blue-500/20">
                    {event.category}
                  </span>
                )}
              </div>
            </div>

            {/* ── Master 2-Column Responsive Layout ── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* ── LEFT COLUMN: Event Story, Logistics & Map (7 Cols) ── */}
              <div className="lg:col-span-7 space-y-6">
                {/* Event Hero Card */}
                <div className="relative rounded-3xl overflow-hidden border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900/80 to-[#0B132B] p-6 sm:p-8 shadow-xl">
                  {event.imageUrl || event.bannerUrl ? (
                    <div className="relative -mx-6 -mt-6 sm:-mx-8 sm:-mt-8 mb-6 h-60 sm:h-72 overflow-hidden">
                      <img
                        src={event.imageUrl || event.bannerUrl}
                        alt={event.name}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent" />
                    </div>
                  ) : (
                    <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-blue-600/15 via-amber-500/10 to-transparent rounded-bl-full pointer-events-none" />
                  )}

                  <div className="relative z-10 space-y-3">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-300 text-xs font-semibold uppercase tracking-wider">
                      <Ticket className="w-3.5 h-3.5 text-blue-400" />
                      <span>Official Event Pass</span>
                    </div>

                    <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
                      {event.name || event.title}
                    </h1>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-400 pt-1">
                      {event.organiserName && (
                        <p className="flex items-center gap-1.5">
                          <span className="text-slate-500">By</span>
                          <span className="font-semibold text-slate-200">{event.organiserName}</span>
                          <span className="inline-flex items-center text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded font-mono font-bold">
                            Verified
                          </span>
                        </p>
                      )}
                      {event.totalTickets && (
                        <p className="flex items-center gap-1 text-xs text-slate-400">
                          <Users className="w-3.5 h-3.5 text-slate-500" />
                          <span>{event.totalTickets} Total Capacity</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Logistics Matrix (4 Highlights) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Date & Time */}
                  <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80 flex items-start gap-3.5 hover:border-slate-700/80 transition-colors">
                    <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Date & Time</p>
                      <p className="text-sm font-bold text-white mt-0.5 truncate">{formattedDate}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{event.time || event.startTime || "Schedule below"}</p>
                    </div>
                  </div>

                  {/* Venue Location */}
                  <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80 flex items-start gap-3.5 hover:border-slate-700/80 transition-colors">
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Venue Location</p>
                      <p className="text-sm font-bold text-white mt-0.5 truncate">{event.location || event.venue || "Campus Venue"}</p>
                      <p className="text-xs text-slate-400 mt-0.5 truncate">{event.subVenue || event.room || "Check gate on arrival"}</p>
                    </div>
                  </div>

                  {/* Ticket Pricing */}
                  <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80 flex items-start gap-3.5 hover:border-slate-700/80 transition-colors">
                    <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                      <Tag className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Admission Type</p>
                      <p className="text-sm font-bold text-white mt-0.5">{priceDisplay}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {isPaid ? "Tax-inclusive (18% GST)" : "Complimentary Registration"}
                      </p>
                    </div>
                  </div>

                  {/* QR Entry */}
                  <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80 flex items-start gap-3.5 hover:border-slate-700/80 transition-colors">
                    <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 shrink-0">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Digital Pass</p>
                      <p className="text-sm font-bold text-white mt-0.5">Cryptographic QR</p>
                      <p className="text-xs text-slate-400 mt-0.5">Instant PDF & Wallet ticket</p>
                    </div>
                  </div>
                </div>

                {/* About This Event Card */}
                <div className="p-6 sm:p-7 rounded-3xl bg-slate-900/60 border border-slate-800/90 space-y-4">
                  <div className="flex items-center gap-2 text-white font-bold text-lg border-b border-slate-800 pb-3">
                    <Info className="w-5 h-5 text-blue-400" />
                    <h2>About This Event</h2>
                  </div>
                  <div className="prose prose-invert max-w-none text-slate-300 text-sm sm:text-base leading-relaxed whitespace-pre-line">
                    {event.description || (
                      <p>
                        Welcome to {event.name || "this event"}! Register below to reserve your entry pass. Upon completing your registration, you will receive an official PDF ticket containing your signed HMAC-SHA-256 QR code for rapid contactless entry at the gate.
                      </p>
                    )}
                  </div>
                </div>

                {/* Included Sub-Events / Tracks (if available) */}
                {subEvents && subEvents.length > 0 && (
                  <div className="p-6 sm:p-7 rounded-3xl bg-slate-900/60 border border-slate-800/90 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div className="flex items-center gap-2 text-white font-bold text-lg">
                        <Layers className="w-5 h-5 text-amber-400" />
                        <h2>Included Tracks & Sessions</h2>
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                        {subEvents.length} Tracks
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {subEvents.map((sub) => (
                        <div
                          key={sub.id}
                          className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-1.5 hover:border-slate-700 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-sm font-bold text-white truncate">{sub.title}</h4>
                            <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20 shrink-0">
                              {sub.trackType || "Track"}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span>{sub.startTime || "10:00 AM"} - {sub.endTime || "01:00 PM"}</span>
                          </p>
                          {sub.venue && (
                            <p className="text-xs text-slate-400 flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                              <span className="truncate">{sub.venue}</span>
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Combos & All-Access Bundles (if available) */}
                {combos && combos.length > 0 && (
                  <div className="p-6 sm:p-7 rounded-3xl bg-slate-900/60 border border-slate-800/90 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div className="flex items-center gap-2 text-white font-bold text-lg">
                        <Sparkles className="w-5 h-5 text-purple-400" />
                        <h2>Festival Passes & Bundles</h2>
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20">
                        {combos.length} Passes Available
                      </span>
                    </div>

                    <div className="space-y-3">
                      {combos.map((combo) => (
                        <div
                          key={combo.id}
                          className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-purple-500/40 transition-colors"
                        >
                          <div>
                            <h4 className="text-sm font-bold text-white">{combo.title}</h4>
                            <p className="text-xs text-slate-400 mt-0.5">{combo.description || "All-access multi-track festival ticket"}</p>
                            {combo.perks && combo.perks.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {combo.perks.slice(0, 3).map((perk, idx) => (
                                  <span key={idx} className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                                    {perk}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="sm:text-right shrink-0">
                            <span className="text-base font-extrabold text-amber-400">₹{combo.price || 0}</span>
                            <span className="block text-[11px] text-slate-500">Tax Incl.</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Interactive Venue Map */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-white font-bold text-lg px-1">
                    <Navigation className="w-5 h-5 text-emerald-400" />
                    <h2>Venue & Navigation</h2>
                  </div>
                  <VenueMap
                    venueName={event.location || event.venue || event.name}
                    subVenue={event.subVenue || event.room}
                    address={event.venueAddress || event.location}
                  />
                </div>

                {/* Trust Badges */}
                <div className="p-6 rounded-3xl bg-slate-950/50 border border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                  <div className="space-y-1.5">
                    <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-400 mx-auto flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <p className="text-xs font-bold text-white">Guaranteed Entry</p>
                    <p className="text-[11px] text-slate-400 leading-normal">
                      Scan-ready QR pass delivered directly to your inbox.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-400 mx-auto flex items-center justify-center">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <p className="text-xs font-bold text-white">Secure Registration</p>
                    <p className="text-[11px] text-slate-400 leading-normal">
                      Encrypted connection with authenticated credentials.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <div className="w-8 h-8 rounded-full bg-amber-500/10 text-amber-400 mx-auto flex items-center justify-center">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <p className="text-xs font-bold text-white">Digital Certificate</p>
                    <p className="text-[11px] text-slate-400 leading-normal">
                      Verified attendance certificate unlocked upon check-in.
                    </p>
                  </div>
                </div>
              </div>

              {/* ── RIGHT COLUMN: Sticky Registration & Checkout Drawer (5 Cols) ── */}
              <div className="lg:col-span-5 lg:sticky lg:top-24">
                <div className="rounded-3xl border border-slate-800/90 bg-slate-950/90 backdrop-blur-2xl p-6 sm:p-7 shadow-2xl shadow-blue-950/30">
                  <div className="border-b border-slate-800/80 pb-5 mb-6 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gradient-to-r from-blue-600/15 to-emerald-500/15 border border-blue-500/30 text-blue-300 text-xs font-bold">
                        <Ticket className="w-3.5 h-3.5 text-blue-400" />
                        <span>Attendee Registration</span>
                      </div>
                      <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                        {priceDisplay}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-xl font-bold text-white tracking-tight">
                        Register for {event.name || "Event"}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        Fill in your details below to generate your entry ticket and credentials.
                      </p>
                    </div>
                  </div>

                  {/* Dynamic Form Embed */}
                  <DynamicRegistrationForm eventId={event.id} event={event} />

                  {/* Micro Trust Strip */}
                  <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500/80" />
                      100% Secure Checkout
                    </span>
                    <span>TicketLelo Verified</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
