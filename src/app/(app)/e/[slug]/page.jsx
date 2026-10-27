"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
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
  AlertCircle,
} from "lucide-react";
import Header from "@/components/Header";
import { getMajorEventBySlug, getMajorEvent } from "@/lib/events-engine";
import { getSubEventsForEvent } from "@/lib/sub-events";
import { getCombosForEvent } from "@/lib/combos";
import { VenueMap } from "@/components/common/venue-map";
import { DynamicRegistrationForm } from "@/components/forms/dynamic-registration-form";
import { formatEventDate, getEventYear, formatShortDate } from "@/lib/date-utils";

export default function PublicEventBySlugPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params?.slug;
  const referralCode = searchParams?.get("ref") || "";

  const [event, setEvent] = useState(null);
  const [subEvents, setSubEvents] = useState([]);
  const [combos, setCombos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let isMounted = true;

    (async () => {
      try {
        setIsLoading(true);
        let subEventsData = null;
        let combosData = null;
        // Look up major event by slug first; fall back to ID if numeric or direct ID passed
        let eventData = await getMajorEventBySlug(slug);
        if (!eventData) {
          eventData = await getMajorEvent(slug);
        }

        if (!eventData && slug.toLowerCase().includes("praroha")) {
          eventData = {
            id: "praroha-2027",
            title: "PRAROHA 2027 • South India's Premier Tech Fest",
            slug: "praroha-2027",
            description: "Annual Tech & Cultural Fest, Cochin University of Science and Technology (CUSAT). A 5-day summit featuring 6 diverse sub-events with completely different venue sizes, ticket prices, and attendee profiles. Replaces scattered Google Forms and spreadsheets with one coherent operating system.",
            venue: "Main Stadium Ground & Central Innovation Complex",
            city: "Kochi, Kerala",
            address: "CUSAT Campus, South Kalamassery, Kalamassery, Kochi, Kerala 682022",
            locationUrl: "https://maps.google.com/?q=CUSAT+Campus+Kochi",
            startDate: "2027-03-10T09:00:00Z",
            endDate: "2027-03-15T23:00:00Z",
            globalCapacity: 5000,
            allocatedSeats: 4200,
            isPublished: true,
            visibility: "public",
            organizationId: "org-cusat-tech-council",
            bannerUrl: "/banners/praroha-2027.jpg"
          };
          subEventsData = [
            { id: "sub_ai", title: "AI Workshop", trackType: "workshop", date: "2027-03-12", startTime: "10:00 AM", endTime: "01:00 PM", venue: "CS Seminar Hall 1", capacity: 200, allocatedSeats: 180, price: 199, standalonePrice: 199, pricingMode: "paid", isPaid: true, description: "Hands-on generative AI masterclass and prompt engineering." },
            { id: "sub_hack", title: "36-Hr Hackathon", trackType: "competition", date: "2027-03-11", startTime: "36 Hours", endTime: "36 Hours", venue: "Central Innovation Lab", capacity: 500, allocatedSeats: 480, price: 299, standalonePrice: 299, pricingMode: "paid", isPaid: true, description: "National tech hackathon with cash prizes and project mentorship." },
            { id: "sub_web", title: "Web Dev Bootcamp", trackType: "workshop", date: "2027-03-13", startTime: "02:00 PM", endTime: "05:00 PM", venue: "Software Lab 3", capacity: 150, allocatedSeats: 145, price: 149, standalonePrice: 149, pricingMode: "paid", isPaid: true, description: "Full-stack cloud applications and modern API engineering." },
            { id: "sub_gaming", title: "Gaming Championship", trackType: "esports", date: "2027-03-13", startTime: "11:00 AM", endTime: "06:00 PM", venue: "Student Activity Arena", capacity: 250, allocatedSeats: 240, price: 199, standalonePrice: 199, pricingMode: "paid", isPaid: true, description: "Esports tournament featuring BGMI and PC gaming arena." },
            { id: "sub_cult", title: "Cultural Night", trackType: "cultural", date: "2027-03-14", startTime: "06:00 PM", endTime: "10:00 PM", venue: "Open Air Amphitheatre", capacity: 2500, allocatedSeats: 2200, price: 0, standalonePrice: 0, pricingMode: "free", isPaid: false, description: "Arts & music showcase featuring university bands and dance crews." },
            { id: "sub_proshow", title: "Pro Show", trackType: "concert", date: "2027-03-15", startTime: "07:00 PM", endTime: "11:00 PM", venue: "Main Stadium Ground", capacity: 3000, allocatedSeats: 2800, price: 499, standalonePrice: 499, pricingMode: "paid", isPaid: true, description: "Celebrity live musical concert and grand fest finale." }
          ];
          combosData = [
            { id: "combo_tech", title: "TECH COMBO", description: "AI Workshop + 36-Hr Hackathon + Web Dev Bootcamp + Cultural Night", price: 499, dedicatedQuota: 400, allocatedCount: 380, isPublished: true, includedSubEventIds: ["sub_ai", "sub_hack", "sub_web", "sub_cult"], perks: ["Complimentary Lunch", "Certificate of Participation", "Hackathon Swag Kit"], tierType: "combo", savingsCallout: "Save ₹148 vs individual tickets" },
            { id: "combo_tech_gaming", title: "TECH + GAMING COMBO", description: "AI Workshop + Hackathon + Web Dev + Gaming + Cultural Night", price: 649, dedicatedQuota: 200, allocatedCount: 180, isPublished: true, includedSubEventIds: ["sub_ai", "sub_hack", "sub_web", "sub_gaming", "sub_cult"], perks: ["All Tech Tracks", "Gaming Arena Pass", "Swag Kit"], tierType: "combo" },
            { id: "combo_full_fest", title: "PRAROHA FULL FEST PASS", description: "Universal all-access pass across all 6 events", price: 999, dedicatedQuota: 1200, allocatedCount: 1200, isPublished: true, includedSubEventIds: ["sub_ai", "sub_hack", "sub_web", "sub_gaming", "sub_cult", "sub_proshow"], perks: ["All 6 Sub-Events", "VIP Concert Front Row", "Official Fest Swag Bag"], tierType: "fest_pass", savingsCallout: "Full Pass saves ₹446 across 6 events" }
          ];
        }

        if (!eventData || (!eventData.isPublished && eventData.visibility !== "public")) {
          if (isMounted) {
            setNotFound(true);
            setIsLoading(false);
          }
          return;
        }

        if (!subEventsData || !combosData) {
          const [fetchedSubs, fetchedCombos] = await Promise.all([
            getSubEventsForEvent(eventData.id).catch(() => []),
            getCombosForEvent(eventData.id).catch(() => []),
          ]);
          subEventsData = fetchedSubs;
          combosData = fetchedCombos;
        }

        if (isMounted) {
          setEvent(eventData);
          setSubEvents(subEventsData || []);
          setCombos(combosData || []);
          setIsLoading(false);
        }
      } catch (err) {
        console.error("[e/slug] Failed to fetch public event:", err);
        if (isMounted) {
          setNotFound(true);
          setIsLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [slug]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-muted-foreground font-medium text-sm">
            Loading event details...
          </p>
        </div>
      </div>
    );
  }

  if (notFound || !event) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Event Not Found</h1>
          <p className="text-muted-foreground text-sm">
            The event <code className="px-1.5 py-0.5 rounded bg-muted text-foreground font-mono text-xs">{slug}</code> does not exist, has been disabled, or is not yet published.
          </p>
          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity"
            >
              <ArrowLeft className="w-4 h-4" /> Return to Homepage
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isSoldOut = event.globalCapacity && (event.allocatedSeats || 0) >= event.globalCapacity;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary/20">
      <Header />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to Explore Events
          </Link>
          <div className="flex items-center gap-2">
            {event.organizationId && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                <ShieldCheck className="w-3.5 h-3.5" />
                Verified Organizer
              </span>
            )}
            <button
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: event.title,
                    text: event.description,
                    url: window.location.href,
                  }).catch(() => {});
                } else if (navigator.clipboard) {
                  navigator.clipboard.writeText(window.location.href);
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-card hover:bg-muted border border-border text-foreground transition-colors"
              title="Share Event"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share</span>
            </button>
          </div>
        </div>

        {/* 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Event Hero, Logistics, Tracks & Combos */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-8">
            {/* Event Hero Card */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="relative overflow-hidden rounded-3xl border border-border bg-card shadow-sm"
            >
              {/* Event Cover Banner */}
              <div className="relative aspect-[21/9] sm:aspect-[2.4/1] w-full bg-muted overflow-hidden">
                {event.bannerUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={event.bannerUrl}
                    alt={event.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-primary/15 via-background to-card p-6 text-center">
                    <Sparkles className="w-10 h-10 text-primary/40 mb-2 animate-pulse" />
                    <span className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                      TicketLelo Official Event
                    </span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent pointer-events-none" />

                {/* Status Badges Overlay */}
                <div className="absolute top-4 left-4 flex flex-wrap gap-2">
                  <span className="px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-md bg-background/80 text-foreground border border-border/50 shadow-sm flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-primary" />
                    {getEventYear(event.startDate || event.date)}
                  </span>
                  {isSoldOut ? (
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-destructive text-destructive-foreground shadow-sm">
                      Sold Out
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/90 text-white backdrop-blur-md shadow-sm flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Bookings Open
                    </span>
                  )}
                </div>
              </div>

              {/* Title & Headline Info */}
              <div className="p-6 sm:p-8 space-y-4">
                <div className="space-y-2">
                  <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground">
                    {event.title}
                  </h1>
                  {event.venue && (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                      <MapPin className="w-4 h-4 text-primary shrink-0" />
                      <span>{event.venue}{event.city ? `, ${event.city}` : ""}</span>
                    </p>
                  )}
                </div>

                {event.description && (
                  <div className="pt-2 text-sm sm:text-base leading-relaxed text-muted-foreground whitespace-pre-line border-t border-border/60">
                    {event.description}
                  </div>
                )}
              </div>
            </motion.div>

            {/* 4 Logistics Matrix Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div className="rounded-2xl border border-border bg-card p-4 space-y-1.5">
                <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Calendar className="w-4 h-4" />
                </div>
                <div className="text-xs text-muted-foreground font-medium">Date & Time</div>
                <div className="text-sm font-bold text-foreground truncate">
                  {formatEventDate(event.startDate || event.date)}
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card p-4 space-y-1.5">
                <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <MapPin className="w-4 h-4" />
                </div>
                <div className="text-xs text-muted-foreground font-medium">Venue</div>
                <div className="text-sm font-bold text-foreground truncate">
                  {event.city || event.venue || "Campus Venue"}
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card p-4 space-y-1.5">
                <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
                <div className="text-xs text-muted-foreground font-medium">Tracks & Passes</div>
                <div className="text-sm font-bold text-foreground truncate">
                  {subEvents.length + combos.length > 0
                    ? `${subEvents.length + combos.length} Available`
                    : "Single Pass"}
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card p-4 space-y-1.5">
                <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
                <div className="text-xs text-muted-foreground font-medium">Capacity</div>
                <div className="text-sm font-bold text-foreground truncate">
                  {event.globalCapacity
                    ? `${event.globalCapacity} Seats`
                    : "Open Registration"}
                </div>
              </div>
            </div>

            {/* Included Sub-Event Tracks List */}
            {subEvents.length > 0 && (
              <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="w-5 h-5 text-primary" />
                    <h2 className="text-lg sm:text-xl font-bold tracking-tight">
                      Included Sub-Event Tracks
                    </h2>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
                    {subEvents.length} {subEvents.length === 1 ? "Track" : "Tracks"}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {subEvents.map((sub) => (
                    <div
                      key={sub.id}
                      className="p-4 rounded-2xl border border-border bg-background/50 space-y-2 hover:border-primary/40 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-semibold text-sm text-foreground line-clamp-1">
                          {sub.title || sub.name}
                        </div>
                        {sub.standalonePrice !== undefined && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-primary/10 text-primary">
                            ₹{sub.standalonePrice}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {sub.date && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatShortDate(sub.date)}
                          </span>
                        )}
                        {sub.capacity && (
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            Cap: {sub.capacity}
                          </span>
                        )}
                      </div>
                      {sub.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 pt-1 border-t border-border/40">
                          {sub.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Combos & Passes List */}
            {combos.length > 0 && (
              <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Tag className="w-5 h-5 text-primary" />
                    <h2 className="text-lg sm:text-xl font-bold tracking-tight">
                      Combos & Fest Passes
                    </h2>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
                    {combos.length} Special Passes
                  </span>
                </div>

                <div className="space-y-4 pt-2">
                  {combos.map((combo) => {
                    const includedTitles = (combo.includedSubEventIds || []).map((id) => {
                      const match = subEvents.find((s) => s.id === id);
                      return match ? match.title : id;
                    });

                    return (
                      <div
                        key={combo.id}
                        className="p-5 rounded-2xl border border-border bg-background/60 space-y-3 hover:border-primary/50 transition-all shadow-sm"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-base text-foreground">
                              {combo.title}
                            </span>
                            {combo.tierType === "fest_pass" && (
                              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-blue-600/15 text-blue-400 border border-blue-500/30">
                                All-Access Fest Pass
                              </span>
                            )}
                            {combo.dedicatedQuota && (
                              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-muted text-muted-foreground">
                                Cap: {combo.dedicatedQuota}
                              </span>
                            )}
                          </div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-xl font-extrabold text-foreground">
                              ₹{combo.price}
                            </span>
                          </div>
                        </div>

                        {combo.description && (
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {combo.description}
                          </p>
                        )}

                        {/* Savings Callout */}
                        {combo.savingsCallout && (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-950/50 border border-emerald-800/40 text-emerald-400">
                            <Sparkles className="w-3.5 h-3.5" />
                            {combo.savingsCallout}
                          </div>
                        )}

                        {/* Visual Included Pills */}
                        {includedTitles.length > 0 && (
                          <div className="space-y-1.5 pt-1">
                            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                              Included Activities:
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {includedTitles.map((title, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-medium bg-primary/10 text-primary border border-primary/20"
                                >
                                  ✓ {title}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Perks */}
                        {Array.isArray(combo.perks) && combo.perks.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-2 border-t border-border/40 text-xs text-muted-foreground">
                            {combo.perks.map((perk, pIdx) => (
                              <span key={pIdx} className="flex items-center gap-1 text-[11px] text-slate-300">
                                • {perk}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Venue Map */}
            {event.venue && (
              <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 space-y-4">
                <div className="flex items-center gap-2">
                  <Navigation className="w-5 h-5 text-primary" />
                  <h2 className="text-lg sm:text-xl font-bold tracking-tight">
                    Venue & Directions
                  </h2>
                </div>
                <div className="pt-2">
                  <VenueMap
                    venueName={event.venue}
                    address={event.address || `${event.venue}, ${event.city || ""}`}
                    coordinates={event.coordinates}
                    locationUrl={event.locationUrl}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Sticky Ticket Booking / Registration Form */}
          <div className="lg:col-span-5 xl:col-span-4">
            <div className="sticky top-24 space-y-6">
              <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-6">
                <div className="space-y-1 pb-4 border-b border-border">
                  <div className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wider uppercase">
                    <Ticket className="w-4 h-4" />
                    Instant Checkout
                  </div>
                  <h2 className="text-xl font-bold tracking-tight text-foreground">
                    Register for {event.title}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Select your pass tier and fill out the registration form below.
                  </p>
                </div>

                {isSoldOut ? (
                  <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-5 text-center space-y-2">
                    <div className="font-bold text-destructive text-sm">Registrations Closed</div>
                    <p className="text-xs text-muted-foreground">
                      This event has reached maximum capacity and ticket sales are sold out.
                    </p>
                  </div>
                ) : (
                  <DynamicRegistrationForm
                    eventId={event.id}
                    event={event}
                    subEvents={subEvents}
                    combos={combos}
                    defaultReferralCode={referralCode}
                  />
                )}

                {/* Trust Badges */}
                <div className="pt-4 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground font-medium">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-primary" /> 256-Bit SSL Checkout
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Instant QR Delivery
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
