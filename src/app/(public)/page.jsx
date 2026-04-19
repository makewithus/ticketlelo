"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useVelocity,
  useAnimationFrame,
  useMotionValue,
} from "framer-motion";
import {
  Ticket,
  QrCode,
  Users,
  Calendar,
  ChevronDown,
  ArrowRight,
  Zap,
  Shield,
  MapPin,
  Loader2,
  ArrowLeft,
  Sparkles,
  FormInput,
} from "lucide-react";
import React from "react";
import { getActiveEvents } from "@/lib/firestore";
import { DynamicRegistrationForm } from "@/components/forms/dynamic-registration-form";
import Header from "@/components/Header";
import { Spotlight } from "@/components/Spotlight";
import ShimmerButton from "@/components/ShimmerButton";
import TicketAnimation from "@/components/TicketAnimation";

// ─────────────────────────────────────────────
// Scroll Velocity Ticker
// ─────────────────────────────────────────────

const wrap = (min, max, v) => {
  const rangeSize = max - min;
  return ((((v - min) % rangeSize) + rangeSize) % rangeSize) + min;
};

const ScrollVelocityContext = React.createContext(null);

function ScrollVelocityContainer({ children, className, ...props }) {
  const { scrollY } = useScroll();
  const scrollVelocity = useVelocity(scrollY);
  const smoothVelocity = useSpring(scrollVelocity, {
    damping: 50,
    stiffness: 400,
  });
  const velocityFactor = useTransform(smoothVelocity, (v) => {
    const sign = v < 0 ? -1 : 1;
    return sign * Math.min(5, (Math.abs(v) / 1000) * 5);
  });
  return (
    <ScrollVelocityContext.Provider value={velocityFactor}>
      <div className={`relative w-full ${className || ""}`} {...props}>
        {children}
      </div>
    </ScrollVelocityContext.Provider>
  );
}

function ScrollVelocityRowImpl({
  children,
  baseVelocity = 5,
  direction = 1,
  className,
  velocityFactor,
  ...props
}) {
  const containerRef = useRef(null);
  const blockRef = useRef(null);
  const [numCopies, setNumCopies] = useState(3);
  const baseX = useMotionValue(0);
  const baseDirectionRef = useRef(direction >= 0 ? 1 : -1);
  const currentDirectionRef = useRef(direction >= 0 ? 1 : -1);
  const unitWidth = useMotionValue(0);
  const isInViewRef = useRef(true);
  const isPageVisibleRef = useRef(true);
  const prefersReducedMotionRef = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    const block = blockRef.current;
    if (!container || !block) return;
    const updateSizes = () => {
      const bw = block.scrollWidth || 0;
      unitWidth.set(bw);
      if (bw > 0) {
        const copies = Math.max(
          3,
          Math.ceil((container.offsetWidth * 2) / bw) + 2,
        );
        setNumCopies(copies);
      }
    };
    updateSizes();
    const ro = new ResizeObserver(updateSizes);
    ro.observe(container);
    ro.observe(block);
    const io = new IntersectionObserver(([e]) => {
      isInViewRef.current = e.isIntersecting;
    });
    io.observe(container);
    const handleVis = () => {
      isPageVisibleRef.current = document.visibilityState === "visible";
    };
    document.addEventListener("visibilitychange", handleVis, { passive: true });
    handleVis();
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handlePRM = () => {
      prefersReducedMotionRef.current = mq.matches;
    };
    mq.addEventListener("change", handlePRM);
    handlePRM();
    return () => {
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", handleVis);
      mq.removeEventListener("change", handlePRM);
    };
  }, [unitWidth]);

  const x = useTransform(
    [baseX, unitWidth],
    ([v, bw]) => `${-wrap(0, Number(bw) || 1, Number(v) || 0)}px`,
  );

  useAnimationFrame((_, delta) => {
    if (!isInViewRef.current || !isPageVisibleRef.current) return;
    const dt = delta / 1000;
    const vf = velocityFactor.get();
    const absVf = Math.min(5, Math.abs(vf));
    if (absVf > 0.1)
      currentDirectionRef.current =
        baseDirectionRef.current * (vf >= 0 ? 1 : -1);
    const bw = unitWidth.get() || 0;
    if (bw <= 0) return;
    const speed = (bw * baseVelocity) / 100;
    baseX.set(
      baseX.get() +
        currentDirectionRef.current *
          speed *
          (1 + (prefersReducedMotionRef.current ? 0 : absVf)) *
          dt,
    );
  });

  return (
    <div
      ref={containerRef}
      className={`w-full overflow-hidden ${className || ""}`}
      style={{ whiteSpace: "nowrap" }}
      {...props}
    >
      <motion.div
        className="inline-flex transform-gpu will-change-transform select-none items-center"
        style={{ x }}
      >
        {Array.from({ length: numCopies }).map((_, i) => (
          <div
            key={i}
            ref={i === 0 ? blockRef : null}
            aria-hidden={i !== 0}
            className="inline-flex shrink-0 items-center"
          >
            {children}
          </div>
        ))}
      </motion.div>
    </div>
  );
}

function ScrollVelocityRow({
  children,
  baseVelocity = 5,
  direction = 1,
  className,
  ...props
}) {
  const shared = React.useContext(ScrollVelocityContext);
  const { scrollY } = useScroll();
  const lv = useVelocity(scrollY);
  const ls = useSpring(lv, { damping: 50, stiffness: 400 });
  const lvf = useTransform(
    ls,
    (v) => (v < 0 ? -1 : 1) * Math.min(5, (Math.abs(v) / 1000) * 5),
  );
  const factor = shared || lvf;
  return (
    <ScrollVelocityRowImpl
      {...props}
      velocityFactor={factor}
      baseVelocity={baseVelocity}
      direction={direction}
      className={className}
    >
      {children}
    </ScrollVelocityRowImpl>
  );
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────
export default function HomePage() {
  const router = useRouter();
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [prefetchedForms, setPrefetchedForms] = useState({});

  useEffect(() => {
    const loadEvents = async () => {
      try {
        const activeEvents = await getActiveEvents();
        setEvents(activeEvents);
      } catch (error) {
        console.error("Failed to load events:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadEvents();
  }, []);

  // Prefetch form on hover for instant loading
  const prefetchForm = async (eventId) => {
    // Skip if already prefetched (check if key exists, not just truthy value)
    if (eventId in prefetchedForms) {
      console.log(`[Prefetch] ✅ Form already cached for event: ${eventId}`);
      return;
    }

    console.log(`[Prefetch] 🚀 Prefetching form for event: ${eventId}`);
    const startTime = Date.now();

    try {
      const response = await fetch(`/api/get-custom-form?eventId=${eventId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.form) {
          setPrefetchedForms((prev) => ({
            ...prev,
            [eventId]: data.form,
          }));
          const prefetchTime = Date.now() - startTime;
          console.log(
            `[Prefetch] ✅ Form cached in ${prefetchTime}ms for event: ${eventId}`,
          );
        } else if (data.success && !data.form) {
          // No custom form - mark as "no form" so we don't keep trying
          console.log(`[Prefetch] ℹ️ No custom form found - will use default`);
          setPrefetchedForms((prev) => ({
            ...prev,
            [eventId]: null, // Explicitly set to null to prevent re-fetching
          }));
        }
      }
    } catch (error) {
      console.log(`[Prefetch] ⚠️ Failed to prefetch form:`, error.message);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white relative overflow-x-hidden">
      {/* ── Fixed Grid Background ── */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(to right, #4f4f4f2e 1px, transparent 1px), linear-gradient(to bottom, #4f4f4f2e 1px, transparent 1px)",
          backgroundSize: "14px 24px",
          WebkitMaskImage:
            "radial-gradient(ellipse 60% 50% at 50% 0%, #000 70%, transparent 110%)",
          maskImage:
            "radial-gradient(ellipse 60% 50% at 50% 0%, #000 70%, transparent 110%)",
        }}
      />

      {/* ── Spotlight ── */}
      <Spotlight
        gradientFirst="radial-gradient(68.54% 68.72% at 55.02% 31.46%, hsla(142, 71%, 85%, .08) 0, hsla(142, 71%, 55%, .02) 50%, hsla(142, 71%, 45%, 0) 80%)"
        gradientSecond="radial-gradient(50% 50% at 50% 50%, hsla(142, 71%, 85%, .06) 0, hsla(142, 71%, 55%, .02) 80%, transparent 100%)"
        gradientThird="radial-gradient(50% 50% at 50% 50%, hsla(142, 71%, 85%, .04) 0, hsla(142, 71%, 45%, .02) 80%, transparent 100%)"
        translateY={-350}
        width={560}
        height={1380}
        smallWidth={240}
        duration={7}
        xOffset={100}
      />

      {/* ── Ambient Glow Blobs ── */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#FE760B]/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#FEDF05]/10 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-[#FE760B]/5 rounded-full blur-3xl animate-pulse delay-500" />
      </div>

      {/* ── Header ── */}
      <Header />

      {/* ════════════════════════════════════════
          HERO
      ════════════════════════════════════════ */}
      <section className="relative w-full pt-20 sm:pt-24 pb-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center min-h-[500px]">
            {/* Left — text */}
            <div className="order-2 lg:order-1 flex flex-col">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#FE760B]/10 border border-[#FE760B]/20 rounded-md mb-6 w-fit"
              >
                <Sparkles className="w-4 h-4 text-[#FEDF05] shrink-0" />
                <span className="text-sm font-medium text-[#FE760B]">
                  India&apos;s Smartest Event Platform
                </span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight"
              >
                Event Registration,
                <br />
                <span className="text-[#FE760B]">MADE EFFORTLESS!</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="text-lg sm:text-xl text-gray-400 mb-8 max-w-lg leading-relaxed"
              >
                Register for events, receive your digital ticket with QR code
                instantly on email, and walk in like a VIP.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="flex flex-col sm:flex-row gap-4"
              >
                <a href="#events">
                  <ShimmerButton className="px-8 py-4">
                    Browse Events
                    <ArrowRight className="w-5 h-5" />
                  </ShimmerButton>
                </a>
                <Link href="/host-event">
                  <button className="px-8 py-4 bg-white/5 border border-white/10 text-white font-semibold rounded-lg flex items-center gap-2 hover:bg-white/10 transition-all">
                    Host Your Event
                  </button>
                </Link>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.4 }}
                transition={{ delay: 1.4, duration: 0.6 }}
                className="mt-10 flex items-center gap-2 animate-bounce"
              >
                <ChevronDown className="w-5 h-5 text-[#FE760B]" />
                <span className="text-xs text-gray-500 tracking-widest uppercase">
                  Scroll to explore
                </span>
              </motion.div>
            </div>

            {/* Right — ticket animation */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.15, ease: "easeOut" }}
              className="order-1 lg:order-2 flex items-center justify-center"
            >
              <TicketAnimation />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          SCROLL TICKER
      ════════════════════════════════════════ */}
      <section className="relative overflow-hidden py-3">
        <ScrollVelocityContainer>
          <ScrollVelocityRow
            baseVelocity={8}
            direction={1}
            className="text-2xl sm:text-4xl font-bold text-[#FE760B]/20"
          >
            <span className="px-6">Digital Passes</span>
            <span className="px-2 text-[#FEDF05]/30">•</span>
            <span className="px-6">QR Codes</span>
            <span className="px-2 text-[#FEDF05]/30">•</span>
            <span className="px-6">Ticketलेलो</span>
            <span className="px-2 text-[#FEDF05]/30">•</span>
            <span className="px-6">Free Registration</span>
            <span className="px-2 text-[#FEDF05]/30">•</span>
          </ScrollVelocityRow>
          <ScrollVelocityRow
            baseVelocity={8}
            direction={-1}
            className="text-2xl sm:text-4xl font-bold text-[#FE760B]/20"
          >
            <span className="px-6">Instant Tickets</span>
            <span className="px-2 text-[#FEDF05]/30">•</span>
            <span className="px-6">Event Pass</span>
            <span className="px-2 text-[#FEDF05]/30">•</span>
            <span className="px-6">Secure Entry</span>
            <span className="px-2 text-[#FEDF05]/30">•</span>
            <span className="px-6">Smart Platform</span>
            <span className="px-2 text-[#FEDF05]/30">•</span>
          </ScrollVelocityRow>
        </ScrollVelocityContainer>
      </section>

      {/* ════════════════════════════════════════
          HOST YOUR EVENT
      ════════════════════════════════════════ */}
      <section className="relative py-16 sm:py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <div className="inline-flex items-center justify-center w-20 h-20 bg-[#FE760B]/10 border-2 border-[#FE760B]/30 rounded-2xl mb-6">
              <Sparkles className="w-10 h-10 text-[#FEDF05]" />
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6">
              Want to Host Your Event?
            </h2>
            <p className="text-lg sm:text-xl text-gray-300 mb-8 max-w-2xl mx-auto leading-relaxed">
              Join Ticketलेलो and take your event management to the next level.
              Create custom forms, track registrations, scan QR codes, and more!
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10 max-w-3xl mx-auto">
              {[
                { icon: FormInput, text: "Custom Forms" },
                { icon: Users, text: "Track Registrations" },
                { icon: QrCode, text: "QR Scanner" },
              ].map((item, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-lg p-4"
                >
                  <item.icon className="w-5 h-5 text-[#FEDF05] flex-shrink-0" />
                  <span className="text-sm font-medium">{item.text}</span>
                </motion.div>
              ))}
            </div>

            <Link href="/host-event">
              <ShimmerButton className="px-10 py-5 text-lg">
                Host Your Event
                <ArrowRight className="w-5 h-5" />
              </ShimmerButton>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          EVENTS
      ════════════════════════════════════════ */}
      <section
        id="events"
        className="relative py-16 sm:py-24 px-4 sm:px-6 lg:px-8 bg-zinc-950 scroll-mt-20"
      >
        <div className="max-w-7xl mx-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-10 h-10 animate-spin text-[#FE760B] mb-4" />
              <p className="text-gray-400">Loading events...</p>
            </div>
          ) : events.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-20"
            >
              <div className="inline-flex items-center justify-center w-20 h-20 bg-[#FE760B]/10 border border-[#FE760B]/20 rounded-2xl mb-6">
                <Calendar className="w-10 h-10 text-[#FEDF05]" />
              </div>
              <h3 className="text-2xl font-bold mb-2">No Events Yet</h3>
              <p className="text-gray-400">
                Check back soon for upcoming events!
              </p>
            </motion.div>
          ) : selectedEvent ? (
            /* Registration Form */
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="max-w-2xl mx-auto"
            >
              <button
                onClick={() => setSelectedEvent(null)}
                className="mb-8 flex items-center gap-2 text-sm text-gray-400 hover:text-white border border-white/10 px-4 py-2 rounded-lg hover:border-[#FE760B]/40 hover:bg-white/5 transition-all"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Events
              </button>
              <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-8">
                <div className="flex items-center gap-3 mb-2">
                  <div className="inline-flex items-center justify-center w-10 h-10 bg-[#FE760B]/10 border border-[#FE760B]/20 rounded-xl">
                    <Ticket className="w-5 h-5 text-[#FEDF05]" />
                  </div>
                  <h2 className="text-2xl font-bold">
                    Register for {selectedEvent.name}
                  </h2>
                </div>
                <DynamicRegistrationForm
                  eventId={selectedEvent.id}
                  event={selectedEvent}
                  {...(selectedEvent.id in prefetchedForms && {
                    initialForm: prefetchedForms[selectedEvent.id],
                  })}
                />
              </div>
            </motion.div>
          ) : (
            /* Events Grid */
            <div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                viewport={{ once: true }}
                className="text-center mb-12 sm:mb-16"
              >
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
                  Upcoming <span className="text-[#FE760B]">Events</span>
                </h2>
                <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto">
                  Pick an event and register in seconds
                </p>
              </motion.div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
                {events.map((event, index) => (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: (index % 6) * 0.07 }}
                    viewport={{ once: true }}
                    onMouseEnter={() => prefetchForm(event.id)}
                    onClick={() => setSelectedEvent(event)}
                    className="group relative bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 hover:border-[#FE760B]/40 rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 flex flex-col hover:shadow-[0_0_30px_rgba(254,118,11,0.12)]"
                  >
                    <div className="h-0.5 bg-gradient-to-r from-[#FE760B] to-[#FEDF05] opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="p-6 flex flex-col flex-1">
                      <h3 className="text-xl font-bold mb-2 group-hover:text-[#FE760B] transition-colors line-clamp-1">
                        {event.name}
                      </h3>
                      <p className="text-gray-400 text-sm mb-5 line-clamp-2 min-h-[2.5rem] leading-relaxed">
                        {event.description}
                      </p>
                      <div className="space-y-3 mb-6">
                        <div className="flex items-center gap-3 text-sm">
                          <div className="w-8 h-8 rounded-lg bg-[#FE760B]/10 border border-[#FE760B]/20 flex items-center justify-center shrink-0">
                            <Calendar className="w-4 h-4 text-[#FEDF05]" />
                          </div>
                          <span className="text-gray-300 truncate">
                            {event.date?.toDate
                              ? event.date
                                  .toDate()
                                  .toLocaleDateString("en-IN", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  })
                              : new Date(event.date).toLocaleDateString(
                                  "en-IN",
                                  {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  },
                                )}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <div className="w-8 h-8 rounded-lg bg-[#FE760B]/10 border border-[#FE760B]/20 flex items-center justify-center shrink-0">
                            <MapPin className="w-4 h-4 text-[#FEDF05]" />
                          </div>
                          <span className="text-gray-300 truncate">
                            {event.location}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <div className="w-8 h-8 rounded-lg bg-[#FE760B]/10 border border-[#FE760B]/20 flex items-center justify-center shrink-0">
                            <Ticket className="w-4 h-4 text-[#FEDF05]" />
                          </div>
                          <span className="text-gray-300">
                            {event.totalTickets} tickets available
                          </span>
                        </div>
                      </div>
                      <div className="mt-auto">
                        <button className="w-full py-3 bg-[#FEDF05] text-black font-bold rounded-lg flex items-center justify-center gap-2 group-hover:bg-[#FE760B] group-hover:text-white transition-all">
                          Register Now
                          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ════════════════════════════════════════
          HOW IT WORKS
      ════════════════════════════════════════ */}
      <section
        id="how-it-works"
        className="relative py-16 sm:py-24 px-4 sm:px-6 lg:px-8"
      >
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="text-center mb-12 sm:mb-16"
          >
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
              How It Works
            </h2>
            <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto">
              Get your event pass in three simple steps
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
            {[
              {
                step: "01",
                icon: Users,
                title: "Select Event",
                desc: "Browse upcoming events and choose the one you want to attend.",
              },
              {
                step: "02",
                icon: Ticket,
                title: "Fill Details",
                desc: "Complete the registration form with your details in seconds.",
              },
              {
                step: "03",
                icon: Zap,
                title: "Get Your Pass",
                desc: "Receive your QR code ticket instantly via email and download.",
              },
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="relative"
              >
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-[#FE760B]/10 border border-[#FE760B]/20 rounded-xl mb-6">
                    <item.icon className="w-8 h-8 text-[#FEDF05]" />
                  </div>
                  <div className="text-sm font-bold text-[#FE760B] mb-3 tracking-widest">
                    STEP {item.step}
                  </div>
                  <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                  <p className="text-gray-400 leading-relaxed">{item.desc}</p>
                </div>
                {index < 2 && (
                  <div className="hidden md:block absolute top-8 left-full w-full h-px bg-gradient-to-r from-zinc-700 to-transparent" />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          CTA
      ════════════════════════════════════════ */}
      <section className="relative py-16 sm:py-24 px-4 sm:px-6 lg:px-8 bg-zinc-950">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6">
              Ready to Get Started?
            </h2>
            <p className="text-lg sm:text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
              Browse events, register in seconds, and get your digital pass
              instantly.
            </p>
            <a href="#events">
              <button className="px-10 py-4 bg-[#FEDF05] text-black font-bold rounded-lg text-lg inline-flex items-center gap-2 hover:bg-[#FE760B] hover:text-white transition-all shadow-lg shadow-[#FEDF05]/20">
                Browse Events
                <ArrowRight className="w-5 h-5" />
              </button>
            </a>
          </motion.div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          FOOTER
      ════════════════════════════════════════ */}
      <footer className="relative border-t border-zinc-900 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div>
              <div className="text-xl font-bold mb-1">
                Ticket<span className="text-[#FE760B]">लेलो</span>
              </div>
              <div className="text-sm text-gray-500">
                © {new Date().getFullYear()} Ticketलेलो. All rights reserved.
              </div>
            </div>
            <p className="text-gray-500 text-sm">
              Want to host an event?{" "}
              <Link
                href="/host-event"
                className="text-[#FE760B] hover:text-[#FEDF05] transition-colors font-semibold"
              >
                Submit a hosting request
              </Link>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
