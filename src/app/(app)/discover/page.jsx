/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useMemo, useCallback, useRef, Suspense, memo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Calendar,
  MapPin,
  Clock,
  Ticket,
  ArrowRight,
  Share2,
  Sparkles,
  Filter,
  Compass,
  Check,
  Eye,
  Users,
  Building2,
  ExternalLink,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Rows3,
  ListFilter,
  X,
  Radio,
  Flame,
  Laptop,
  Gamepad2,
  Music,
  GraduationCap,
  Sparkle,
  ArrowUpRight,
  Shield,
  Menu,
  Zap,
  Code2,
  QrCode,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/auth-context";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { StubTicket } from "@/components/tickets/stub-ticket";
import {
  formatEventDate,
  getEventLiveStatus,
  getEventDateRange,
  parseFirestoreDate,
} from "@/lib/date-utils";
import { BrandLoader } from "@/components/ui/brand-loader";
import { Skeleton } from "@/components/ui/skeleton";
import { getCachedItem, setCachedItem } from "@/lib/client-cache";
import { EventBanner } from "@/components/events/event-banner";

// Category definitions with icons and matching tag filters
const CATEGORIES = [
  { id: "all", label: "All Events", icon: Compass },
  { id: "live", label: "Live Now", icon: Radio },
  { id: "upcoming", label: "Upcoming", icon: Calendar },
  { id: "popular", label: "Featured & Popular", icon: Flame },
  { id: "tech", label: "Tech & AI", icon: Laptop },
  { id: "dev", label: "Dev & Hackathons", icon: Sparkles },
  { id: "gaming", label: "Gaming & Esports", icon: Gamepad2 },
  { id: "shows", label: "Shows & Concerts", icon: Music },
  { id: "campus", label: "Campus & College", icon: GraduationCap },
  { id: "free", label: "Free Entry", icon: Ticket },
  { id: "paid", label: "Paid Passes", icon: Sparkle },
];

// Procedural graphic gradients for events without banners
const PROCEDURAL_PALETTES = [
  {
    bg: "from-[#131517] via-[#1F1915] to-[#2E1807]",
    accent: "#FE760B",
    border: "border-[#FE760B]/30",
    badge: "bg-[#FE760B]/20 text-[#FE760B]",
    tag: "Tech",
  },
  {
    bg: "from-[#131517] via-[#101A29] to-[#0A2540]",
    accent: "#3B82F6",
    border: "border-[#3B82F6]/30",
    badge: "bg-[#3B82F6]/20 text-[#60A5FA]",
    tag: "Meetup",
  },
  {
    bg: "from-[#131517] via-[#1B122B] to-[#2A1647]",
    accent: "#8B5CF6",
    border: "border-[#8B5CF6]/30",
    badge: "bg-[#8B5CF6]/20 text-[#A78BFA]",
    tag: "Gaming",
  },
  {
    bg: "from-[#131517] via-[#0E241B] to-[#0B3524]",
    accent: "#10B981",
    border: "border-[#10B981]/30",
    badge: "bg-[#10B981]/20 text-[#34D399]",
    tag: "Workshop",
  },
  {
    bg: "from-[#131517] via-[#26101E] to-[#3B122C]",
    accent: "#EC4899",
    border: "border-[#EC4899]/30",
    badge: "bg-[#EC4899]/20 text-[#F472B6]",
    tag: "Cultural",
  },
];

// Isolated Live IST Clock component so 1-second interval does not trigger page re-renders
const LiveISTClock = memo(function LiveISTClock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
          timeZone: "Asia/Kolkata",
        }) + " IST"
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!time) return null;
  return (
    <span className="hidden lg:flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-[#9B9EA4] bg-slate-100 dark:bg-[#1A1C1F] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#2A2D31]">
      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
      {time}
    </span>
  );
});

// Structural equality check to avoid redundant state updates
function areEventsIdentical(prev, next) {
  if (!Array.isArray(prev) || !Array.isArray(next)) return false;
  if (prev.length !== next.length) return false;
  for (let i = 0; i < prev.length; i++) {
    if ((prev[i]?.id || prev[i]?.slug) !== (next[i]?.id || next[i]?.slug)) {
      return false;
    }
  }
  return true;
}

// Animated number counter with smooth easing (count-up effect)
function AnimatedCounter({ end = 0, duration = 1400, suffix = "", prefix = "" }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const target = Number(end) || 0;
    if (target === 0) return;

    let startTimestamp = null;
    let animationFrameId = null;

    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const elapsed = timestamp - startTimestamp;
      const progress = Math.min(elapsed / duration, 1);
      // Smooth easeOutCubic curve
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(easeOut * target);
      setCount(current);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step);
      } else {
        setCount(target);
      }
    };

    animationFrameId = requestAnimationFrame(step);
    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [end, duration]);

  return (
    <span className="tabular-nums font-black">
      {prefix}
      {count}
      {suffix}
    </span>
  );
}

function DiscoverEventsPageContent() {
  const { user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const refCode = searchParams?.get("ref") || searchParams?.get("referralCode") || "";
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Safe SSR hydration - avoids hydration mismatch
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortBy, setSortBy] = useState("date-asc");
  const [previewEvent, setPreviewEvent] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [viewMode, setViewMode] = useState("grid");
  const categoryScrollRef = useRef(null);
  const searchInputRef = useRef(null);

  // Keyboard shortcut: Press "/" to focus search bar
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleScrollCategories = (direction) => {
    if (categoryScrollRef.current) {
      categoryScrollRef.current.scrollBy({
        left: direction === "left" ? -260 : 260,
        behavior: "smooth",
      });
    }
  };

  // Referral code attribution and instant target event resolution
  useEffect(() => {
    if (!refCode || !refCode.trim()) return;
    let isMounted = true;

    // Immediately cache referral code in client storage and cookie
    try {
      const normalized = refCode.trim().toUpperCase();
      localStorage.setItem("ticketlelo_ref_code", normalized);
      document.cookie = `ticketlelo_ref_code=${encodeURIComponent(normalized)}; path=/; max-age=2592000; SameSite=Lax`;
    } catch (_) {}

    // Resolve target event associated with this referral code
    fetch(`/api/referral/validate?code=${encodeURIComponent(refCode.trim())}`)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data?.valid && data?.targetUrl) {
          setIsRedirecting(true);
          router.replace(data.targetUrl);
        }
      })
      .catch((err) => {
        console.warn("[discover] Referral target resolution notice:", err);
      });

    return () => {
      isMounted = false;
    };
  }, [refCode, router]);

  // Fetch real-time active events from database & API
  useEffect(() => {
    let isMounted = true;
    let unsubscribeFirestore = null;

    // Fast-path client cache check on mount (runs after hydration, so zero SSR mismatch)
    try {
      const cached = getCachedItem("discover_events");
      if (Array.isArray(cached) && cached.length > 0 && isMounted) {
        setEvents(cached);
        setIsLoading(false);
      }
    } catch {}

    function deduplicateEvents(list) {
      if (!Array.isArray(list)) return [];
      const seen = new Set();
      const unique = [];
      for (const item of list) {
        if (!item) continue;
        const key = item.id || item.slug;
        if (key) {
          if (seen.has(key)) continue;
          seen.add(key);
        }
        unique.push(item);
      }
      return unique;
    }

    async function initializeEvents() {
      // 1. Initial fast load from API
      try {
        const res = await fetch("/api/events/active", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          const list = data.events || (Array.isArray(data) ? data : []);
          if (isMounted && Array.isArray(list)) {
            const deduped = deduplicateEvents(list);
            setEvents((prev) => {
              if (areEventsIdentical(prev, deduped)) return prev;
              return deduped;
            });
            setCachedItem("discover_events", deduped, 15 * 60 * 1000);
            setIsLoading(false);
          }
        }
      } catch (err) {
        console.warn("Fast events fetch notice:", err);
      }

      // 2. Real-time live Firestore subscription for continuous live updates
      try {
        const { db } = await import("@/lib/firebase");
        const { collection, onSnapshot } = await import("firebase/firestore");
        unsubscribeFirestore = onSnapshot(
          collection(db, "events"),
          (snapshot) => {
            if (!isMounted) return;
            const liveEvents = snapshot.docs
              .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
              .filter((ev) => {
                if (ev.isActive === false || ev.visibility === "draft" || ev.status === "draft") {
                  return false;
                }
                return (
                  ev.isActive === true ||
                  ev.published === true ||
                  ev.status === "published" ||
                  ev.visibility === "public" ||
                  (!("isActive" in ev) && !("status" in ev))
                );
              })
              .map((ev) => {
                function safeToISO(inputVal) {
                  if (!inputVal) return new Date().toISOString();
                  try {
                    if (typeof inputVal?.toDate === "function") {
                      const d = inputVal.toDate();
                      if (!isNaN(d.getTime())) return d.toISOString();
                    }
                    if (typeof inputVal?.seconds === "number") {
                      const d = new Date(inputVal.seconds * 1000);
                      if (!isNaN(d.getTime())) return d.toISOString();
                    }
                    if (inputVal instanceof Date) {
                      if (!isNaN(inputVal.getTime())) return inputVal.toISOString();
                    }
                    if (typeof inputVal === "string") {
                      const d = new Date(inputVal);
                      if (!isNaN(d.getTime())) return d.toISOString();
                    }
                  } catch (e) {
                    console.warn("Invalid date value, falling back:", inputVal);
                  }
                  return new Date().toISOString();
                }

                let dateStr = new Date().toISOString();
                if (ev.date) {
                  dateStr = safeToISO(ev.date);
                } else if (ev.startDate) {
                  const timeStr = ev.startTime ? ` ${ev.startTime}` : "";
                  const combined = `${ev.startDate}${timeStr}`;
                  dateStr = safeToISO(combined);
                }

                return {
                  id: ev.id,
                  title: ev.name || ev.title || ev.eventName || "Live Event",
                  name: ev.name || ev.title || ev.eventName || "Live Event",
                  description:
                    typeof ev.description === "string"
                      ? ev.description
                      : ev.description?.text || "",
                  location: ev.location || ev.venue || "Location to be announced",
                  locationVenue: ev.locationVenue || ev.location || "",
                  locationAddress: ev.locationAddress || "",
                  locationType: ev.locationType || "in-person",
                  date: dateStr,
                  startDate: ev.startDate || null,
                  startTime: ev.startTime || null,
                  endDate: ev.endDate || null,
                  endTime: ev.endTime || null,
                  totalTickets: (() => {
                    const raw = ev.totalTickets ?? ev.capacity ?? ev.maxCapacity ?? 150;
                    if (typeof raw === "number" && !isNaN(raw)) return raw;
                    const d = String(raw || "").replace(/[^\d]/g, "");
                    const p = d ? parseInt(d, 10) : 150;
                    return !isNaN(p) && p > 0 ? p : 150;
                  })(),
                  capacity: ev.capacity || ev.maxCapacity || ev.totalTickets || 150,
                  coverImage: ev.coverImage || ev.bannerUrl || ev.posterUrl || ev.image || ev.imageUrl || "",
                  bannerUrl: ev.bannerUrl || ev.coverImage || ev.posterUrl || ev.image || ev.imageUrl || "",
                  posterUrl: ev.posterUrl || ev.bannerUrl || ev.coverImage || "",
                  ticketBgUrl: ev.ticketBgUrl || "",
                  theme: ev.theme || "minimal",
                  themeColor: ev.themeColor || ev.themeHex || "#FE760B",
                  price: ev.price || (ev.isPaid ? "Paid" : "Free"),
                  isPaid: Boolean(ev.isPaid),
                  slug: ev.slug || ev.id,
                  category: ev.category || (ev.isPaid ? "Featured" : "Popular"),
                  tags: Array.isArray(ev.tags) ? ev.tags : [],
                  ticketDesign: ev.ticketDesign || "stub",
                };
              });

            const dedupedLive = deduplicateEvents(liveEvents);
            setEvents((prev) => {
              if (areEventsIdentical(prev, dedupedLive)) return prev;
              return dedupedLive;
            });
            setCachedItem("discover_events", dedupedLive, 15 * 60 * 1000);
            setIsLoading(false);
          },
          (err) => {
            console.warn("Firestore onSnapshot error:", err.message);
            if (isMounted) setIsLoading(false);
          }
        );
      } catch (e) {
        console.warn("Could not bind real-time snapshot:", e);
        if (isMounted) setIsLoading(false);
      }
    }

    initializeEvents();

    return () => {
      isMounted = false;
      if (unsubscribeFirestore) unsubscribeFirestore();
    };
  }, []);

  // Copy shareable event link
  const handleCopyLink = useCallback((e, ev) => {
    e.stopPropagation();
    e.preventDefault();
    const url = `${window.location.origin}/e/${ev.slug || ev.id}`;
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopiedId(ev.id);
        toast.success("Event link copied to clipboard!");
        setTimeout(() => setCopiedId(null), 2500);
      })
      .catch(() => {
        toast.error("Could not copy link");
      });
  }, []);

  // Filter & Search Logic
  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      const title = (ev.title || ev.name || "").toLowerCase();
      const desc = (ev.description || "").toLowerCase();
      const loc = (ev.location || ev.locationVenue || "").toLowerCase();
      const cat = (ev.category || "").toLowerCase();
      const tags = Array.isArray(ev.tags) ? ev.tags.join(" ").toLowerCase() : "";
      const search = searchTerm.trim().toLowerCase();

      // Search match
      const matchesSearch =
        !search ||
        title.includes(search) ||
        desc.includes(search) ||
        loc.includes(search) ||
        cat.includes(search) ||
        tags.includes(search);

      if (!matchesSearch) return false;

      // Category match
      if (selectedCategory === "all") return true;
      if (selectedCategory === "live") {
        const timing = getEventLiveStatus(ev);
        return timing.isLive;
      }
      if (selectedCategory === "upcoming") {
        const timing = getEventLiveStatus(ev);
        return timing.isUpcoming;
      }
      if (selectedCategory === "popular") {
        return cat.includes("popular") || cat.includes("featured");
      }
      if (selectedCategory === "tech") {
        return (
          cat.includes("tech") ||
          title.includes("tech") ||
          desc.includes("tech") ||
          desc.includes("ai") ||
          title.includes("ai")
        );
      }
      if (selectedCategory === "dev") {
        return (
          title.includes("developer") ||
          title.includes("dev") ||
          title.includes("sprint") ||
          title.includes("hackathon") ||
          desc.includes("dev") ||
          title.includes("bootcamp") ||
          desc.includes("code")
        );
      }
      if (selectedCategory === "gaming") {
        return (
          cat.includes("gaming") ||
          title.includes("gaming") ||
          title.includes("esports") ||
          desc.includes("game")
        );
      }
      if (selectedCategory === "shows") {
        return (
          cat.includes("standup") ||
          cat.includes("concert") ||
          title.includes("concert") ||
          title.includes("open mic") ||
          title.includes("music")
        );
      }
      if (selectedCategory === "campus") {
        return (
          loc.includes("university") ||
          loc.includes("college") ||
          loc.includes("iit") ||
          loc.includes("nit") ||
          loc.includes("kiet") ||
          loc.includes("cusat") ||
          title.includes("fest")
        );
      }
      if (selectedCategory === "free") {
        return (
          !ev.isPaid ||
          String(ev.price).toLowerCase() === "free" ||
          ev.price === 0 ||
          ev.price === "0"
        );
      }
      if (selectedCategory === "paid") {
        return (
          ev.isPaid ||
          (ev.price &&
            String(ev.price).toLowerCase() !== "free" &&
            ev.price !== 0 &&
            ev.price !== "0")
        );
      }

      return true;
    });
  }, [events, searchTerm, selectedCategory]);

  // Metrics summary
  const metrics = useMemo(() => {
    let liveCount = 0;
    let upcomingCount = 0;
    let endedCount = 0;
    let freeCount = 0;
    let campusCount = 0;

    for (const ev of events) {
      const timing = getEventLiveStatus(ev);
      if (timing.isLive) liveCount++;
      else if (timing.isUpcoming) upcomingCount++;
      else if (timing.isEnded) endedCount++;

      const isFree =
        !ev.isPaid ||
        String(ev.price).toLowerCase() === "free" ||
        ev.price === 0 ||
        ev.price === "0";
      if (isFree) freeCount++;

      const isCampus = /(university|college|iit|nit|kiet|cusat|campus|fest)/i.test(
        (ev.location || "") + " " + (ev.locationVenue || "") + " " + (ev.title || "")
      );
      if (isCampus) campusCount++;
    }

    return {
      total: events.length,
      liveCount,
      upcomingCount,
      endedCount,
      freeCount,
      campusCount,
    };
  }, [events]);

  // Real-time category counts
  const categoryCounts = useMemo(() => {
    const counts = { all: events.length };
    counts.live = metrics.liveCount;
    counts.upcoming = metrics.upcomingCount;
    counts.free = metrics.freeCount;
    counts.paid = Math.max(0, events.length - metrics.freeCount);

    counts.popular = events.filter((e) => {
      const c = (e.category || "").toLowerCase();
      return c.includes("popular") || c.includes("featured") || e.isPopular || e.featured;
    }).length;

    counts.tech = events.filter((e) => {
      const c = (e.category || "").toLowerCase();
      const t = (e.title || e.name || "").toLowerCase();
      const d = (e.description || "").toLowerCase();
      return c.includes("tech") || t.includes("tech") || d.includes("tech") || d.includes("ai") || t.includes("ai");
    }).length;

    counts.dev = events.filter((e) => {
      const t = (e.title || e.name || "").toLowerCase();
      const d = (e.description || "").toLowerCase();
      return (
        t.includes("developer") || t.includes("dev") || t.includes("hackathon") ||
        t.includes("sprint") || d.includes("dev") || d.includes("code")
      );
    }).length;

    counts.gaming = events.filter((e) => {
      const c = (e.category || "").toLowerCase();
      const t = (e.title || e.name || "").toLowerCase();
      const d = (e.description || "").toLowerCase();
      return c.includes("gaming") || t.includes("gaming") || t.includes("esports") || d.includes("game");
    }).length;

    counts.shows = events.filter((e) => {
      const c = (e.category || "").toLowerCase();
      const t = (e.title || e.name || "").toLowerCase();
      return c.includes("concert") || c.includes("standup") || t.includes("concert") || t.includes("music") || t.includes("open mic");
    }).length;

    counts.campus = metrics.campusCount;

    return counts;
  }, [events, metrics]);

  // Sort logic (Strict priority: Live events first -> Upcoming by date -> Ended at bottom)
  const sortedEvents = useMemo(() => {
    const list = [...filteredEvents];

    const getEventTimestamp = (ev, useEnd = false) => {
      const range = getEventDateRange(ev);
      if (useEnd && range.end) return range.end.getTime();
      if (range.start) return range.start.getTime();
      const raw = ev.startDate || ev.date || ev.eventDate;
      const parsed = parseFirestoreDate(raw);
      if (parsed) return parsed.getTime();
      return useEnd ? 0 : Number.MAX_SAFE_INTEGER;
    };

    const getStatusRank = (ev) => {
      const timing = getEventLiveStatus(ev);
      if (timing.isLive) return 0;       // Tier 0: LIVE NOW (highest priority!)
      if (timing.isUpcoming) return 1;   // Tier 1: UPCOMING
      return 2;                          // Tier 2: ENDED / PAST
    };

    list.sort((a, b) => {
      const rankA = getStatusRank(a);
      const rankB = getStatusRank(b);

      // 1. Primary sorting: Live (0) -> Upcoming (1) -> Ended (2)
      if (rankA !== rankB) {
        return rankA - rankB;
      }

      // 2. Secondary sorting within the same status tier:
      if (sortBy === "date-asc" || sortBy === "live-upcoming") {
        if (rankA === 0) {
          // LIVE: soonest ending or latest starting
          return getEventTimestamp(a) - getEventTimestamp(b);
        }
        if (rankA === 1) {
          // UPCOMING: soonest upcoming date first (today -> tomorrow -> next week...)
          return getEventTimestamp(a) - getEventTimestamp(b);
        }
        // ENDED: newest ended first (most recent past event at top of ended section)
        return getEventTimestamp(b, true) - getEventTimestamp(a, true);
      }

      if (sortBy === "date-desc") {
        // Furthest date first
        return getEventTimestamp(b) - getEventTimestamp(a);
      }

      if (sortBy === "name-asc") {
        return (a.title || a.name || "").localeCompare(b.title || b.name || "");
      }

      if (sortBy === "capacity-desc") {
        const getCapNum = (item) => {
          const raw = item?.capacity ?? item?.totalTickets ?? item?.maxCapacity;
          if (typeof raw === "string" && raw.toLowerCase().includes("unlimited")) return 999999;
          const digits = String(raw || "").replace(/[^\d]/g, "");
          const parsed = digits ? parseInt(digits, 10) : 0;
          return Number.isFinite(parsed) ? parsed : 0;
        };
        return getCapNum(b) - getCapNum(a);
      }

      if (sortBy === "price-asc") {
        return (a.isPaid ? 1 : 0) - (b.isPaid ? 1 : 0);
      }

      return 0;
    });

    return list;
  }, [filteredEvents, sortBy]);

  if (isRedirecting) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#131517] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-[#FE760B]/15 text-[#FE760B] flex items-center justify-center mb-4 animate-pulse">
          <Compass className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          Redirecting to event registration...
        </h2>
        <p className="text-xs text-slate-500 dark:text-[#9B9EA4] mt-1">
          Applying referral code <span className="font-mono font-bold text-[#FE760B]">{refCode}</span>
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#131517] text-slate-900 dark:text-white transition-colors selection:bg-[#FE760B] selection:text-white overflow-x-clip w-full max-w-full relative">
      {/* ── Top Navigation Bar ── */}
      <header className="sticky top-0 z-50 w-full max-w-full border-b border-slate-200 dark:border-[#2A2D31] bg-white/90 dark:bg-[#131517]/90 backdrop-blur-md transition-colors overflow-hidden">
        <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4">
          {/* Logo & Main Nav */}
          <div className="flex items-center gap-6 sm:gap-8">
            <Link href="/" className="flex items-center group py-1">
              <Image
                src="/logo/ticketlelo-logo-nav.png"
                alt="TicketLelo"
                width={130}
                height={32}
                className="h-6 sm:h-7 w-auto object-contain transition-opacity group-hover:opacity-95"
                priority
              />
            </Link>

            <nav className="hidden md:flex items-center gap-2">
              <Link
                href={
                  user?.role === "organiser" || user?.role === "superAdmin" || user?.isAdmin
                    ? "/admin/dashboard"
                    : "/discover"
                }
                className="px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium text-slate-600 dark:text-[#9B9EA4] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1A1C1F] transition-all"
              >
                Events
              </Link>
              <Link
                href="/discover"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold bg-[#FE760B]/15 text-[#FE760B] border border-[#FE760B]/30 transition-all shadow-sm"
              >
                <Compass className="w-3.5 h-3.5 text-[#FE760B]" />
                <span>Discover</span>
              </Link>
              <Link
                href="/host-event"
                className="px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium text-slate-600 dark:text-[#9B9EA4] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1A1C1F] transition-all"
              >
                Host Event
              </Link>
            </nav>
          </div>

          {/* Right Controls: IST Clock + Theme Toggle + Auth */}
          <div className="flex items-center gap-2.5 sm:gap-4">
            <LiveISTClock />

            <ThemeToggle inline />

            {authLoading ? (
              <div className="w-24 h-8 rounded-xl bg-slate-200 dark:bg-[#1A1C1F] animate-pulse" />
            ) : user ? (
              <div className="flex items-center gap-2">
                {(user.role === "superAdmin" || user.email === "adil4ticketlelo@gmail.com") && (
                  <Link
                    href="/superadmin"
                    className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FE760B]/10 hover:bg-[#FE760B]/20 border border-[#FE760B]/30 text-xs font-bold text-[#FE760B] transition-all"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>Super Admin</span>
                  </Link>
                )}
                <Link
                  href={
                    user.role === "superAdmin"
                      ? "/superadmin"
                      : user.role === "organiser" || user.isAdmin
                      ? "/admin/dashboard"
                      : "/dashboard"
                  }
                  className="flex items-center gap-2 pl-2 pr-3 py-1 rounded-xl bg-slate-100 dark:bg-[#1A1C1F] hover:bg-slate-200 dark:hover:bg-[#212327] border border-slate-200 dark:border-[#2A2D31] text-xs font-semibold transition-all group"
                >
                  {user.photoURL && !avatarError ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || "User"}
                      referrerPolicy="no-referrer"
                      className="w-6 h-6 rounded-full object-cover border border-[#FE760B]/40"
                      onError={() => setAvatarError(true)}
                    />
                  ) : (
                    <span className="w-6 h-6 rounded-full bg-[#22C55E] text-white flex items-center justify-center text-[11px] font-bold">
                      {(user.displayName || user.email || "U").charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="hidden sm:inline text-slate-700 dark:text-slate-200 group-hover:text-[#FE760B] transition-colors">
                    Dashboard
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#FE760B] group-hover:translate-x-0.5 transition-all" />
                </Link>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="bg-[#FE760B] hover:bg-[#FF8A2B] text-white font-bold px-3.5 py-1.5 rounded-xl text-xs sm:text-sm transition-all shadow-sm flex items-center gap-1.5"
                >
                  <Ticket className="w-3.5 h-3.5 shrink-0" />
                  <span>Sign In</span>
                </Link>
              </div>
            )}

            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-xl text-slate-600 dark:text-[#9B9EA4] hover:bg-slate-100 dark:hover:bg-[#1A1C1F]"
              aria-label="Toggle navigation"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden border-t border-slate-200 dark:border-[#2A2D31] bg-white dark:bg-[#131517] px-4 py-3 space-y-1.5 overflow-hidden"
            >
              <Link
                href="/"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1A1C1F]"
              >
                <Calendar className="w-4 h-4 text-[#FE760B]" />
                <span>Events Home</span>
              </Link>
              <Link
                href="/discover"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-bold bg-[#FE760B]/15 text-[#FE760B]"
              >
                <Compass className="w-4 h-4 text-[#FE760B]" />
                <span>Discover Hub</span>
              </Link>
              <Link
                href="/host-event"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1A1C1F]"
              >
                <Building2 className="w-4 h-4 text-[#FE760B]" />
                <span>Host an Event</span>
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ── Hero Showcase Section (Image 2 - Animated Hero with Live Counters) ── */}
      <section className="relative pt-10 sm:pt-16 pb-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto overflow-hidden">
        {/* Ambient multi-layer glow and subtle grid */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-72 bg-gradient-to-b from-[#FE760B]/18 via-[#FF8A2B]/8 to-transparent blur-3xl pointer-events-none rounded-full" />
        <div className="absolute top-1/3 left-1/4 w-72 h-72 bg-emerald-500/10 blur-3xl pointer-events-none rounded-full" />
        <div className="absolute inset-0 bg-[radial-gradient(#2A2D31_1px,transparent_1px)] [background-size:24px_24px] opacity-30 pointer-events-none" />

        <div className="relative text-center max-w-4xl mx-auto space-y-4">
          {/* Top Live Radar Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#1A1C1F]/90 border border-[#FE760B]/30 shadow-lg shadow-[#FE760B]/10 backdrop-blur-md mb-1 animate-fade-in">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FE760B] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FE760B]" />
            </span>
            <span className="text-[11px] font-extrabold text-white tracking-wider uppercase">
              TICKETLELO DISCOVERY RADAR
            </span>
            <span className="text-[#9B9EA4] text-[10px]">•</span>
            <span className="text-[11px] font-semibold text-[#FE760B]">
              {metrics.liveCount > 0 ? `${metrics.liveCount} Live Now` : "Live & Upcoming Experiences"}
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 dark:text-white leading-[1.12]">
            Experience Every Moment. <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-[#FE760B] via-[#FF8A2B] to-[#FDE003] bg-clip-text text-transparent">
              Participate Live.
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-600 dark:text-[#9B9EA4] max-w-2xl mx-auto font-normal leading-relaxed">
            Browse curated developer meetups, collegiate tech fests, esports showdowns, and workshops across India. Tear off digital passes and reserve your spot instantly.
          </p>

          {/* 4 Interactive Glassmorphic Metric Cards with Animated Counters */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 pt-6 max-w-5xl mx-auto text-left w-full">
            {/* Card 1: Live & Total Events */}
            <div className="bg-gradient-to-b from-[#1C1E22] to-[#141619] p-4 sm:p-5 rounded-2xl border border-[#2A2D33] hover:border-[#FE760B]/50 transition-all duration-300 shadow-md hover:shadow-xl hover:shadow-[#FE760B]/10 hover:-translate-y-1 flex flex-col justify-between group">
              <div className="flex items-center justify-between">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform border ${
                    metrics.liveCount > 0
                      ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                      : "bg-[#FE760B]/15 border-[#FE760B]/25 text-[#FE760B]"
                  }`}
                >
                  {metrics.liveCount > 0 ? (
                    <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
                  ) : (
                    <Flame className="w-4 h-4 text-[#FE760B]" />
                  )}
                </div>
                {metrics.liveCount > 0 ? (
                  <span className="flex items-center gap-1.5 text-[10px] font-extrabold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 rounded-full shadow-xs">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                    </span>
                    {metrics.liveCount} Live
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-[#FE760B] bg-[#FE760B]/10 border border-[#FE760B]/25 px-2.5 py-0.5 rounded-full">
                    Active
                  </span>
                )}
              </div>
              <div className="mt-4">
                <div className="text-[10px] sm:text-[11px] font-bold text-[#9B9EA4] uppercase tracking-wider">
                  {metrics.liveCount > 0 ? "Live Events" : "Curated Events"}
                </div>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    <AnimatedCounter
                      end={metrics.liveCount > 0 ? metrics.liveCount : events.length}
                    />
                  </span>
                  <span className="text-xs font-semibold text-[#9B9EA4]">
                    {metrics.liveCount > 0 ? "Active Now" : "+ Listed"}
                  </span>
                </div>
              </div>
            </div>

            {/* Card 2: Free Entry */}
            <div className="bg-gradient-to-b from-[#1C1E22] to-[#141619] p-4 sm:p-5 rounded-2xl border border-[#2A2D33] hover:border-emerald-500/50 transition-all duration-300 shadow-md hover:shadow-xl hover:shadow-emerald-500/10 hover:-translate-y-1 flex flex-col justify-between group">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Ticket className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                  Free Access
                </span>
              </div>
              <div className="mt-4">
                <div className="text-[10px] sm:text-[11px] font-bold text-[#9B9EA4] uppercase tracking-wider">
                  Free Entry
                </div>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    <AnimatedCounter end={metrics.freeCount} />
                  </span>
                  <span className="text-xs font-semibold text-[#9B9EA4]">Passes</span>
                </div>
              </div>
            </div>

            {/* Card 3: Campus & Hubs */}
            <div className="bg-gradient-to-b from-[#1C1E22] to-[#141619] p-4 sm:p-5 rounded-2xl border border-[#2A2D33] hover:border-amber-400/50 transition-all duration-300 shadow-md hover:shadow-xl hover:shadow-amber-400/10 hover:-translate-y-1 flex flex-col justify-between group">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-amber-400/15 border border-amber-400/30 text-amber-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/30 px-2.5 py-0.5 rounded-full">
                  Pan-India
                </span>
              </div>
              <div className="mt-4">
                <div className="text-[10px] sm:text-[11px] font-bold text-[#9B9EA4] uppercase tracking-wider">
                  Campus &amp; Hubs
                </div>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    <AnimatedCounter
                      end={metrics.campusCount || Math.max(1, Math.round(events.length * 0.4))}
                    />
                  </span>
                  <span className="text-xs font-semibold text-[#9B9EA4]">Venues</span>
                </div>
              </div>
            </div>

            {/* Card 4: Pass Delivery */}
            <div className="bg-gradient-to-b from-[#1C1E22] to-[#141619] p-4 sm:p-5 rounded-2xl border border-[#2A2D33] hover:border-purple-400/50 transition-all duration-300 shadow-md hover:shadow-xl hover:shadow-purple-400/10 hover:-translate-y-1 flex flex-col justify-between group">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-400/30 text-purple-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <QrCode className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-bold text-purple-400 bg-purple-500/10 border border-purple-400/30 px-2.5 py-0.5 rounded-full">
                  Instant
                </span>
              </div>
              <div className="mt-4">
                <div className="text-[10px] sm:text-[11px] font-bold text-[#9B9EA4] uppercase tracking-wider">
                  Pass Delivery
                </div>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    Instant QR
                  </span>
                  <span className="text-xs font-semibold text-[#9B9EA4]">Digital</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Search & Filter Control Hub (Image 3 - Redesigned Command Dock) ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8 space-y-4 w-full">
        <div className="bg-[#1A1C1F]/95 backdrop-blur-2xl p-4 sm:p-5 rounded-3xl border border-[#2A2D31] shadow-2xl space-y-4 w-full">
          {/* Top Row: Search input dock & Sort / View toggles */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 w-full">
            {/* Search Input Container */}
            <div className="relative flex-1 min-w-0 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#FE760B] transition-colors" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search events by title, venue, city, tech stack, or tags..."
                className="w-full pl-11 pr-24 py-3 rounded-2xl bg-[#131517] border border-[#2A2D31] text-xs sm:text-sm text-white placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#FE760B]/40 focus:border-[#FE760B] transition-all shadow-inner"
              />
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                {searchTerm ? (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="p-1 rounded-lg text-[#9B9EA4] hover:text-white hover:bg-[#212327] transition-all cursor-pointer"
                    title="Clear search"
                  >
                    <X className="w-4 h-4" />
                  </button>
                ) : (
                  <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-mono text-[#9B9EA4] bg-[#212327] border border-[#2A2D31] rounded-md shadow-xs pointer-events-none">
                    / to search
                  </kbd>
                )}
              </div>
            </div>

            {/* Sort Dropdown & View Mode Segmented Control */}
            <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0 justify-between sm:justify-end">
              {/* Custom Sort Select */}
              <div className="relative flex-1 sm:flex-initial">
                <div className="relative flex items-center">
                  <ListFilter className="w-3.5 h-3.5 text-[#FE760B] absolute left-3.5 pointer-events-none" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full sm:w-auto appearance-none pl-9 pr-9 py-2.5 rounded-2xl bg-[#131517] border border-[#2A2D31] text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-[#FE760B]/40 cursor-pointer transition-all hover:bg-[#1A1C1F]"
                  >
                    <option value="date-asc">Date: Live &amp; Upcoming First</option>
                    <option value="date-desc">Date: Furthest / Latest First</option>
                    <option value="name-asc">Title: A to Z</option>
                    <option value="capacity-desc">Capacity: Highest First</option>
                    <option value="price-asc">Price: Free Passes First</option>
                  </select>
                  <ChevronDown className="absolute right-3 w-3.5 h-3.5 text-[#9B9EA4] pointer-events-none" />
                </div>
              </div>

              {/* View Mode Toggle (Grid vs Compact List) */}
              <div className="flex items-center p-1 bg-[#131517] border border-[#2A2D31] rounded-2xl shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={`p-2 rounded-xl text-xs transition-all cursor-pointer ${
                    viewMode === "grid"
                      ? "bg-[#FE760B] text-[#131517] font-bold shadow-xs"
                      : "text-[#9B9EA4] hover:text-white"
                  }`}
                  title="Grid View"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={`p-2 rounded-xl text-xs transition-all cursor-pointer ${
                    viewMode === "list"
                      ? "bg-[#FE760B] text-[#131517] font-bold shadow-xs"
                      : "text-[#9B9EA4] hover:text-white"
                  }`}
                  title="List View"
                >
                  <Rows3 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Middle Row: Category Filter Slider with Navigation Chevrons */}
          <div className="relative flex items-center gap-2 pt-1 border-t border-[#2A2D31]">
            {/* Scroll Left Button */}
            <button
              type="button"
              onClick={() => handleScrollCategories("left")}
              className="hidden sm:flex shrink-0 w-8 h-8 rounded-xl bg-[#212327] hover:bg-[#2A2D31] text-[#9B9EA4] hover:text-white border border-[#2A2D31] items-center justify-center transition-all cursor-pointer active:scale-95"
              title="Scroll left"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Scrollable Category Pills */}
            <div
              ref={categoryScrollRef}
              className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth py-1 w-full"
            >
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const isActive = selectedCategory === cat.id;
                const count = categoryCounts[cat.id] ?? 0;
                const isLivePill = cat.id === "live";

                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all select-none cursor-pointer shrink-0 ${
                      isActive
                        ? "bg-gradient-to-r from-[#FE760B] to-[#FF8A2B] text-[#131517] shadow-lg shadow-[#FE760B]/25 scale-[1.02]"
                        : "bg-[#212327] hover:bg-[#2A2D31] text-[#9B9EA4] hover:text-white border border-[#2A2D31]"
                    }`}
                  >
                    <span className="relative flex items-center justify-center">
                      <Icon
                        className={`w-3.5 h-3.5 ${
                          isActive
                            ? "text-[#131517]"
                            : isLivePill
                            ? "text-emerald-400"
                            : "text-[#FE760B]"
                        }`}
                      />
                      {isLivePill && count > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                        </span>
                      )}
                    </span>
                    <span>{cat.label}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                        isActive
                          ? "bg-[#131517]/25 text-[#131517]"
                          : "bg-[#131517] text-[#9B9EA4]"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Scroll Right Button */}
            <button
              type="button"
              onClick={() => handleScrollCategories("right")}
              className="hidden sm:flex shrink-0 w-8 h-8 rounded-xl bg-[#212327] hover:bg-[#2A2D31] text-[#9B9EA4] hover:text-white border border-[#2A2D31] items-center justify-center transition-all cursor-pointer active:scale-95"
              title="Scroll right"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Trending Chips (using clean SVG icons, zero emojis) */}
          <div className="flex flex-wrap items-center gap-1.5 pt-2.5 border-t border-[#2A2D31]/60 text-xs">
            <span className="text-[11px] font-bold text-[#FE760B] uppercase tracking-wider flex items-center gap-1 mr-1">
              <Flame className="w-3.5 h-3.5 text-[#FE760B]" />
              <span>Trending:</span>
            </span>

            <button
              type="button"
              onClick={() => setSelectedCategory("live")}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedCategory === "live"
                  ? "bg-emerald-500 text-black shadow-md shadow-emerald-500/20"
                  : "bg-[#212327] hover:bg-[#2A2D31] text-emerald-400 hover:text-emerald-300 border border-emerald-500/30"
              }`}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>
              <span>Live Now</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedCategory("campus")}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedCategory === "campus"
                  ? "bg-[#FE760B] text-black font-bold shadow-md shadow-[#FE760B]/20"
                  : "bg-[#212327] hover:bg-[#2A2D31] text-[#D0D0D1] hover:text-white border border-[#2A2D31]"
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5 text-amber-400" />
              <span>College Fests</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedCategory("dev")}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedCategory === "dev"
                  ? "bg-[#FE760B] text-black font-bold shadow-md shadow-[#FE760B]/20"
                  : "bg-[#212327] hover:bg-[#2A2D31] text-[#D0D0D1] hover:text-white border border-[#2A2D31]"
              }`}
            >
              <Code2 className="w-3.5 h-3.5 text-sky-400" />
              <span>Hackathons</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedCategory("free")}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedCategory === "free"
                  ? "bg-[#FE760B] text-black font-bold shadow-md shadow-[#FE760B]/20"
                  : "bg-[#212327] hover:bg-[#2A2D31] text-[#D0D0D1] hover:text-white border border-[#2A2D31]"
              }`}
            >
              <Ticket className="w-3.5 h-3.5 text-emerald-400" />
              <span>Free Entry</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedCategory("gaming")}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedCategory === "gaming"
                  ? "bg-[#FE760B] text-black font-bold shadow-md shadow-[#FE760B]/20"
                  : "bg-[#212327] hover:bg-[#2A2D31] text-[#D0D0D1] hover:text-white border border-[#2A2D31]"
              }`}
            >
              <Gamepad2 className="w-3.5 h-3.5 text-purple-400" />
              <span>Esports LAN</span>
            </button>
          </div>
        </div>

        {/* Results Counter & Active Filter Indicators */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs font-medium text-[#9B9EA4] px-1 gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span>
              Showing <strong className="text-white font-bold">{sortedEvents.length}</strong> of{" "}
              {events.length} listed events
            </span>
            {metrics.liveCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {metrics.liveCount} Live Now
              </span>
            )}
            {searchTerm && (
              <span className="bg-[#FE760B]/15 text-[#FE760B] border border-[#FE760B]/30 px-2 py-0.5 rounded-md font-semibold flex items-center gap-1">
                <span>&ldquo;{searchTerm}&rdquo;</span>
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="hover:text-white cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedCategory !== "all" && (
              <span className="bg-[#212327] text-white border border-[#2A2D31] px-2 py-0.5 rounded-md font-semibold flex items-center gap-1">
                <span>{CATEGORIES.find((c) => c.id === selectedCategory)?.label || selectedCategory}</span>
                <button
                  type="button"
                  onClick={() => setSelectedCategory("all")}
                  className="hover:text-[#FE760B] cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>

          {(searchTerm || selectedCategory !== "all") && (
            <button
              onClick={() => {
                setSearchTerm("");
                setSelectedCategory("all");
              }}
              className="text-[#FE760B] hover:text-[#FF8A2B] font-bold flex items-center gap-1 self-start sm:self-auto cursor-pointer transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Reset All Filters
            </button>
          )}
        </div>
      </section>

      {/* ── Main Events Grid / List in "Div Format" ── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        {/* Live Radar Spotlight Alert Banner (when live events exist and no narrowing search) */}
        {metrics.liveCount > 0 && selectedCategory === "all" && !searchTerm && (
          <div className="mb-6 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-[#1A1C1F] to-[#1A1C1F] border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0 shadow-md shadow-emerald-950/50">
                <Radio className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                    </span>
                    Live Now on TicketLelo
                  </span>
                  <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {metrics.liveCount} {metrics.liveCount === 1 ? "Event Active" : "Events Active"}
                  </span>
                </div>
                <p className="text-xs text-[#9B9EA4] mt-0.5">
                  These events are currently taking place across campuses &amp; hubs. Join right now or check digital passes.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedCategory("live")}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-extrabold text-xs transition-all flex items-center gap-1.5 shrink-0 self-stretch sm:self-auto justify-center cursor-pointer shadow-md shadow-emerald-500/25 ring-1 ring-emerald-400/50"
            >
              <Zap className="w-3.5 h-3.5" />
              Filter Live Events
            </button>
          </div>
        )}

        {isLoading && events.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-4 animate-fade-in">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] rounded-2xl overflow-hidden shadow-sm space-y-3 pb-4"
              >
                <div className="w-full h-44 bg-slate-100 dark:bg-[#131517]">
                  <Skeleton className="w-full h-full rounded-none" />
                </div>
                <div className="px-4 space-y-2">
                  <Skeleton className="h-3.5 w-28 rounded-md" />
                  <Skeleton className="h-5 w-3/4 rounded-lg" />
                  <Skeleton className="h-3 w-1/2 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        ) : sortedEvents.length === 0 ? (
          /* Empty Search State */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-[#1A1C1F] rounded-3xl border border-slate-200 dark:border-[#2A2D31] p-12 text-center max-w-lg mx-auto space-y-4 my-8"
          >
            <div className="w-16 h-16 rounded-2xl bg-[#FE760B]/15 text-[#FE760B] flex items-center justify-center mx-auto">
              <Compass className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
              No matching events found
            </h3>
            <p className="text-sm text-slate-500 dark:text-[#9B9EA4]">
              We couldn&apos;t find any events matching your current filters or search query. Try broadening your keywords or resetting filters.
            </p>
            <button
              onClick={() => {
                setSearchTerm("");
                setSelectedCategory("all");
              }}
              className="bg-[#FE760B] hover:bg-[#FF8A2B] text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-all cursor-pointer"
            >
              View All Events
            </button>
          </motion.div>
        ) : (
          /* Event Cards Container: Responsive Grid or List Layout */
          <div
            id="events-container"
            className={
              viewMode === "grid"
                ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
                : "flex flex-col gap-4"
            }
          >
            {sortedEvents.map((ev, index) => {
              const palette = PROCEDURAL_PALETTES[index % PROCEDURAL_PALETTES.length];
              const dateDisplay = formatEventDate(ev.startDate || ev.date);
              const timing = getEventLiveStatus(ev);
              const isPaid = ev.isPaid || (ev.price && String(ev.price).toLowerCase() !== "free" && ev.price !== 0 && ev.price !== "0");
              const priceLabel = isPaid ? (typeof ev.price === "number" ? `₹${ev.price}` : String(ev.price).startsWith("₹") ? ev.price : `₹${ev.price}`) : "Free";
              const stableKey = ev.id || ev.slug || `event-${index}`;
              const eventHref = `/e/${ev.slug || ev.id}${refCode ? `?ref=${encodeURIComponent(refCode)}#register` : ""}`;

              // Robust capacity calculation - eliminates any possible NaN
              const rawCap = ev.capacity ?? ev.totalTickets ?? ev.maxCapacity;
              const rawCapStr = String(rawCap ?? "").trim().toLowerCase();
              const isExplicitUnlimited =
                rawCapStr === "unlimited" ||
                rawCapStr === "open" ||
                rawCapStr === "open access" ||
                ev.isUnlimitedCapacity === true;

              let capacityLabel = "Open Access";
              let progressPercent = 0;
              let spotsLeft = null;

              if (isExplicitUnlimited) {
                capacityLabel = "Open Access";
                progressPercent = 0;
              } else {
                const digits = String(rawCap ?? "").replace(/[^\d]/g, "");
                let num = digits ? parseInt(digits, 10) : NaN;
                if (isNaN(num) || num <= 0 || num >= 9999) {
                  const fromTickets = String(ev.totalTickets || "").replace(/[^\d]/g, "");
                  const tVal = fromTickets ? parseInt(fromTickets, 10) : NaN;
                  if (!isNaN(tVal) && tVal > 0 && tVal < 9999) {
                    num = tVal;
                  } else {
                    const fromMax = String(ev.maxCapacity || "").replace(/[^\d]/g, "");
                    const mVal = fromMax ? parseInt(fromMax, 10) : NaN;
                    if (!isNaN(mVal) && mVal > 0) {
                      num = mVal;
                    } else {
                      num = 150;
                    }
                  }
                }
                const takenSeats = Number(
                  ev.ticketsSold ||
                  ev.registrationsCount ||
                  ev.attendeesCount ||
                  ev.totalRegistrations ||
                  0
                );
                spotsLeft = Math.max(0, num - takenSeats);
                capacityLabel = `${spotsLeft} spots left`;
                progressPercent = num > 0 ? Math.min(100, Math.round((takenSeats / num) * 100)) : 0;
              }

              // Render: Grid Card vs Horizontal List Card
              if (viewMode === "list") {
                return (
                  <div
                    key={stableKey}
                    className={`group relative bg-white dark:bg-[#1A1C1F] rounded-3xl border transition-all duration-300 shadow-sm hover:shadow-xl flex flex-col md:flex-row overflow-hidden hover:-translate-y-0.5 ${
                      timing.isLive
                        ? "border-emerald-500/60 ring-2 ring-emerald-500/25 shadow-emerald-950/40"
                        : "border-slate-200 dark:border-[#2A2D31] hover:border-[#FE760B]/50 hover:shadow-[#FE760B]/10"
                    }`}
                  >
                    {/* Left Banner Thumbnail */}
                    <div className="relative h-48 md:h-auto md:w-80 shrink-0 overflow-hidden bg-slate-900 select-none">
                      <EventBanner
                        event={ev}
                        aspect="auto"
                        className="w-full h-full rounded-none border-none shadow-none"
                      />

                      {/* Badge Bar */}
                      <div className="absolute top-3 left-3 flex items-center gap-2 z-10 pointer-events-none">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-transparent border border-amber-500/40 text-amber-500 backdrop-blur-xs">
                          {ev.isPopular || ev.featured ? "POPULAR" : ev.category || "EVENT"}
                        </span>

                        {timing.isLive ? (
                          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-emerald-500/50 text-emerald-300 text-[10px] font-bold shadow-md shadow-emerald-950/40">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                            </span>
                            <span>LIVE</span>
                          </div>
                        ) : timing.isEnded ? (
                          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-zinc-400 text-[10px] font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                            <span>ENDED</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white text-[10px] font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                            <span>UPCOMING</span>
                          </div>
                        )}
                      </div>

                      {/* Ticket Preview Icon */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewEvent(ev);
                        }}
                        title="Interactive Ticket Preview & Tear"
                        className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white border border-white/10 flex items-center justify-center transition-all shadow-md backdrop-blur-md cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Middle Details Body */}
                    <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between space-y-3">
                      <div className="space-y-1.5">
                        <Link
                          href={eventHref}
                          className="block group-hover:text-[#FE760B] transition-colors"
                        >
                          <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white line-clamp-1 tracking-tight">
                            {ev.title || ev.name}
                          </h3>
                        </Link>
                        <p className="text-xs sm:text-sm text-slate-500 dark:text-[#9B9EA4] line-clamp-2 leading-relaxed">
                          {ev.description || "Join fellow developers, creators, and enthusiasts for this curated experience."}
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-[#2A2D31]">
                        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 font-medium">
                          <Calendar className="w-3.5 h-3.5 text-[#FE760B] shrink-0" />
                          <span className="truncate">{dateDisplay || "Date announced soon"}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 font-medium">
                          <MapPin className="w-3.5 h-3.5 text-[#FE760B] shrink-0" />
                          <span className="truncate">
                            {ev.locationVenue || ev.location || "Venue announced on pass"}
                          </span>
                        </div>
                      </div>

                      {/* Capacity bar */}
                      <div className="pt-1">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-[#9B9EA4] mb-1">
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3 text-[#FE760B]" />
                            <span>{capacityLabel}</span>
                          </span>
                          {timing.isEnded ? (
                            <span className="text-zinc-500 font-bold">Closed</span>
                          ) : spotsLeft === 0 && !isExplicitUnlimited ? (
                            <span className="text-rose-500 font-bold">Sold Out</span>
                          ) : (
                            <span className="text-emerald-500 font-bold">Passes Open</span>
                          )}
                        </div>
                        {!isExplicitUnlimited && (
                          <div className="w-full h-1.5 bg-slate-100 dark:bg-[#131517] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-[#FE760B] to-[#FF8A2B] rounded-full transition-all duration-300"
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Action & Pricing Dock */}
                    <div className="p-5 sm:p-6 md:w-56 shrink-0 flex flex-col justify-between items-stretch md:border-l border-t md:border-t-0 border-slate-100 dark:border-[#2A2D31] bg-slate-50/50 dark:bg-[#131517]/50 gap-4">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-[#9B9EA4]">
                          Pass Price
                        </div>
                        <div className={`text-2xl font-black mt-0.5 ${isPaid ? "text-[#FE760B]" : "text-emerald-400"}`}>
                          {priceLabel}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Link
                          href={eventHref}
                          className={`w-full font-extrabold py-2.5 px-4 rounded-xl text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all shadow-md group/btn ${
                            timing.isLive
                              ? "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black shadow-emerald-500/25 ring-1 ring-emerald-400/50"
                              : timing.isEnded
                              ? "bg-[#212327] hover:bg-[#2A2D31] text-[#9B9EA4] hover:text-white border border-[#2A2D31]"
                              : "bg-[#FE760B] hover:bg-[#FF8A2B] text-white shadow-[#FE760B]/20"
                          }`}
                        >
                          {timing.isLive ? (
                            <>
                              <span className="w-2 h-2 rounded-full bg-black animate-ping" />
                              <span>Join Live Event</span>
                              <ArrowRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
                            </>
                          ) : timing.isEnded ? (
                            <>
                              <span>View Details</span>
                              <ArrowRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
                            </>
                          ) : (
                            <>
                              <span>Participate Now</span>
                              <ArrowRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
                            </>
                          )}
                        </Link>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setPreviewEvent(ev)}
                            title="Interactive Ticket Preview & Tear"
                            className="flex-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#1A1C1F] dark:hover:bg-[#212327] border border-slate-200 dark:border-[#2A2D31] text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-[#FE760B] dark:hover:text-[#FE760B] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Ticket className="w-3.5 h-3.5" />
                            <span>Preview Ticket</span>
                          </button>
                          <button
                            onClick={(e) => handleCopyLink(e, ev)}
                            title="Share event link"
                            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#1A1C1F] dark:hover:bg-[#212327] border border-slate-200 dark:border-[#2A2D31] text-slate-700 dark:text-slate-200 hover:text-[#FE760B] dark:hover:text-[#FE760B] transition-colors cursor-pointer"
                          >
                            {copiedId === ev.id ? (
                              <Check className="w-4 h-4 text-emerald-500" />
                            ) : (
                              <Share2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              // Standard Grid Card
              return (
                <div
                  key={stableKey}
                  className={`group relative bg-white dark:bg-[#1A1C1F] rounded-3xl border transition-all duration-300 shadow-sm hover:shadow-xl flex flex-col overflow-hidden hover:-translate-y-1.5 ${
                    timing.isLive
                      ? "border-emerald-500/60 ring-2 ring-emerald-500/30 shadow-lg shadow-emerald-950/40"
                      : "border-slate-200 dark:border-[#2A2D31] hover:border-[#FE760B]/50 hover:shadow-[#FE760B]/10"
                  }`}
                >
                  {/* ── Top Poster Graphic / Visual Banner ── */}
                  <div className="relative h-52 sm:h-56 w-full shrink-0 overflow-hidden bg-slate-900 select-none">
                    <EventBanner
                      event={ev}
                      aspect="auto"
                      className="w-full h-full rounded-none border-none shadow-none"
                    />

                    {/* Badge Bar inside graphic */}
                    <div className="absolute top-3 left-3 flex items-center gap-2 z-10 pointer-events-none">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-transparent border border-amber-500/40 text-amber-500 backdrop-blur-xs">
                        {ev.isPopular || ev.featured ? "POPULAR" : ev.category || "EVENT"}
                      </span>

                      {timing.isLive ? (
                        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-emerald-500/50 text-emerald-300 text-[10px] font-bold shadow-md shadow-emerald-950/40">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                          </span>
                          <span>LIVE</span>
                        </div>
                      ) : timing.isEnded ? (
                        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-zinc-400 text-[10px] font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                          <span>ENDED</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white text-[10px] font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                          <span>UPCOMING</span>
                        </div>
                      )}
                    </div>

                    {/* Price Pill Overlay */}
                    <div className="absolute bottom-3 right-3 z-20 pointer-events-none">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-black shadow-lg ${
                          isPaid
                            ? "bg-[#FE760B] text-white"
                            : "bg-[#10B981] text-[#131517]"
                        }`}
                      >
                        {priceLabel}
                      </span>
                    </div>

                    {/* Quick Ticket Preview Icon Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewEvent(ev);
                      }}
                      title="Interactive Ticket Preview & Tear"
                      className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white border border-white/10 flex items-center justify-center transition-all shadow-md backdrop-blur-md cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* ── Event Details Body ── */}
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      {/* Title */}
                      <Link
                        href={eventHref}
                        className="block group-hover:text-[#FE760B] transition-colors"
                      >
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white line-clamp-1 tracking-tight">
                          {ev.title || ev.name}
                        </h3>
                      </Link>

                      {/* Description snippet */}
                      <p className="text-xs text-slate-500 dark:text-[#9B9EA4] line-clamp-2 leading-relaxed">
                        {ev.description || "Join fellow developers, creators, and enthusiasts for this curated experience."}
                      </p>
                    </div>

                    {/* Meta Rows (Date & Location) */}
                    <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-[#2A2D31]">
                      {/* Date & Time */}
                      <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 font-medium">
                        <Calendar className="w-3.5 h-3.5 text-[#FE760B] shrink-0" />
                        <span className="truncate">{dateDisplay || "Date announced soon"}</span>
                      </div>

                      {/* Venue / City */}
                      <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 font-medium">
                        <MapPin className="w-3.5 h-3.5 text-[#FE760B] shrink-0" />
                        <span className="truncate">
                          {ev.locationVenue || ev.location || "Venue announced on pass"}
                        </span>
                      </div>

                      {/* Capacity Info & Progress Bar */}
                      <div className="pt-1">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-[#9B9EA4] mb-1">
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3 text-[#FE760B]" />
                            <span>{capacityLabel}</span>
                          </span>
                          {timing.isEnded ? (
                            <span className="text-zinc-500 font-bold">Closed</span>
                          ) : spotsLeft === 0 && !isExplicitUnlimited ? (
                            <span className="text-rose-500 font-bold">Sold Out</span>
                          ) : (
                            <span className="text-emerald-500 font-bold">Passes Open</span>
                          )}
                        </div>
                        {!isExplicitUnlimited && (
                          <div className="w-full h-1.5 bg-slate-100 dark:bg-[#131517] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-[#FE760B] to-[#FF8A2B] rounded-full transition-all duration-300"
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ── Action Buttons ── */}
                    <div className="pt-2 flex items-center gap-2">
                      {/* Primary Participate CTA */}
                      <Link
                        href={eventHref}
                        className={`flex-1 font-extrabold py-2.5 px-4 rounded-xl text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all shadow-md group/btn ${
                          timing.isLive
                            ? "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black shadow-emerald-500/25 ring-1 ring-emerald-400/50"
                            : timing.isEnded
                            ? "bg-[#212327] hover:bg-[#2A2D31] text-[#9B9EA4] hover:text-white border border-[#2A2D31]"
                            : "bg-[#FE760B] hover:bg-[#FF8A2B] active:bg-[#FE760B] text-white shadow-[#FE760B]/20"
                        }`}
                      >
                        {timing.isLive ? (
                          <>
                            <span className="w-2 h-2 rounded-full bg-black animate-ping" />
                            <span>Join Live Event</span>
                            <ArrowRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
                          </>
                        ) : timing.isEnded ? (
                          <>
                            <span>View Event</span>
                            <ArrowRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
                          </>
                        ) : (
                          <>
                            <span>Participate Now</span>
                            <ArrowRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
                          </>
                        )}
                      </Link>

                      {/* Interactive Ticket Preview Modal Button */}
                      <button
                        onClick={() => setPreviewEvent(ev)}
                        title="Interactive Ticket Preview & Tear"
                        className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#131517] dark:hover:bg-[#212327] border border-slate-200 dark:border-[#2A2D31] text-slate-700 dark:text-slate-200 hover:text-[#FE760B] dark:hover:text-[#FE760B] transition-colors cursor-pointer"
                      >
                        <Ticket className="w-4 h-4" />
                      </button>

                      {/* Share Button */}
                      <button
                        onClick={(e) => handleCopyLink(e, ev)}
                        title="Share event link"
                        className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#131517] dark:hover:bg-[#212327] border border-slate-200 dark:border-[#2A2D31] text-slate-700 dark:text-slate-200 hover:text-[#FE760B] dark:hover:text-[#FE760B] transition-colors cursor-pointer"
                      >
                        {copiedId === ev.id ? (
                          <Check className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <Share2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ── Interactive Ticket Preview Modal with Tear Feature ── */}
      <AnimatePresence>
        {previewEvent && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPreviewEvent(null)}
              className="fixed inset-0 bg-black/80 backdrop-blur-md"
            />

            {/* Modal Dialog */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full max-w-2xl bg-white dark:bg-[#1A1C1F] rounded-3xl border border-slate-200 dark:border-[#2A2D31] shadow-2xl p-5 sm:p-7 z-10 space-y-6 max-h-[92vh] overflow-y-auto no-scrollbar"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#2A2D31]">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#FE760B]/15 text-[#FE760B] flex items-center justify-center">
                    <Ticket className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Live Digital Ticket Preview
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-[#9B9EA4]">
                      Try tearing the stub below with sound &amp; haptic feedback!
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setPreviewEvent(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#212327] transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Physical Stub Ticket Mounting */}
              <div className="flex justify-center py-2 overflow-x-auto w-full max-w-full">
                <StubTicket
                  event={previewEvent}
                  registration={{
                    id: `PASS-${previewEvent.id?.slice(0, 8)}`,
                    ticketId: `TL-${previewEvent.id?.slice(0, 6)?.toUpperCase()}`,
                    name: user?.displayName || user?.name || "Attendee Guest",
                    email: user?.email || "attendee@ticketlelo.com",
                    tierName: previewEvent.isPaid ? "Standard Entry" : "General Admission",
                    tierPrice: previewEvent.price || "Free",
                    status: "Confirmed",
                  }}
                  interactive={true}
                  showActions={false}
                />
              </div>

              {/* Event Metadata Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-[#131517] border border-slate-200 dark:border-[#2A2D31] text-xs">
                <div>
                  <span className="text-slate-400 dark:text-[#64748B] block font-medium">Event Title</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {previewEvent.title || previewEvent.name}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-[#64748B] block font-medium">Date &amp; Time</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {formatEventDate(previewEvent.startDate || previewEvent.date)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-[#64748B] block font-medium">Venue</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {previewEvent.locationVenue || previewEvent.location}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-[#64748B] block font-medium">Admission Cost</span>
                  <span className="font-bold text-[#FE760B]">
                    {previewEvent.price || (previewEvent.isPaid ? "Paid" : "Free Access")}
                  </span>
                </div>
              </div>

              {/* Modal CTAs */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <Link
                  href={`/e/${previewEvent.slug || previewEvent.id}`}
                  onClick={() => setPreviewEvent(null)}
                  className="bg-[#FE760B] hover:bg-[#FF8A2B] text-white font-bold px-6 py-2.5 rounded-xl text-xs sm:text-sm flex items-center gap-2 shadow-md shadow-[#FE760B]/20"
                >
                  <span>Proceed to Register &amp; Participate</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-200 dark:border-[#2A2D31] bg-white dark:bg-[#131517] py-8 text-xs text-slate-500 dark:text-[#9B9EA4]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900 dark:text-white">TicketLelo</span>
            <span>&bull;</span>
            <span>Discover all live events and claim instant digital passes.</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-[#FE760B] transition-colors">
              Events
            </Link>
            <Link href="/host-event" className="hover:text-[#FE760B] transition-colors">
              Host Event
            </Link>
            <Link href="/terms" className="hover:text-[#FE760B] transition-colors">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-[#FE760B] transition-colors">
              Privacy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function DiscoverEventsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F8FAFC] dark:bg-[#131517]" />}>
      <DiscoverEventsPageContent />
    </Suspense>
  );
}
