"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Ticket, ArrowUpRight, AlertTriangle, Clock } from "lucide-react";
import { getEvent } from "@/lib/firestore";
import { getCachedEvent, setCachedEvent } from "@/lib/client-cache";

export function EventControlHeader({
  activeTab = "Overview",
  eventTitle = "",
  eventSlug = "",
  eventId = null,
  isLive = true,
  isCancelled: propIsCancelled = null,
  isCancellationPending: propIsCancelPending = null,
  extraActions = null,
}) {
  const searchParams = useSearchParams();
  const urlEventId = searchParams ? searchParams.get("eventId") : null;
  const [storedEventId, setStoredEventId] = useState(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("admin_selected_event_id");
      if (stored) setStoredEventId(stored);
    }
  }, []);

  const currentEventId = eventId || urlEventId || storedEventId;

  const [resolvedTitle, setResolvedTitle] = useState(() => {
    if (eventTitle && eventTitle !== "Tech Fest 2026") return eventTitle;
    if (typeof window !== "undefined") {
      const id = eventId || (typeof window !== "undefined" ? localStorage.getItem("admin_selected_event_id") : null);
      if (id) {
        const cached = getCachedEvent(id);
        if (cached?.name || cached?.title) return (cached.name || cached.title).trim();
      }
    }
    return eventTitle || "";
  });
  const [resolvedSlug, setResolvedSlug] = useState(() => {
    if (eventSlug && eventSlug !== "tech-fest-2026") return eventSlug;
    return "";
  });
  const [eventCancelled, setEventCancelled] = useState(Boolean(propIsCancelled));
  const [eventCancelPending, setEventCancelPending] = useState(Boolean(propIsCancelPending));

  useEffect(() => {
    if (propIsCancelled !== null) setEventCancelled(Boolean(propIsCancelled));
  }, [propIsCancelled]);

  useEffect(() => {
    if (propIsCancelPending !== null) setEventCancelPending(Boolean(propIsCancelPending));
  }, [propIsCancelPending]);

  useEffect(() => {
    if (eventTitle) {
      setResolvedTitle(eventTitle);
    }
  }, [eventTitle]);

  useEffect(() => {
    if (eventSlug) {
      setResolvedSlug(eventSlug);
    }
  }, [eventSlug]);

  useEffect(() => {
    if (currentEventId) {
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("admin_selected_event_id", currentEventId);
        } catch {}
      }

      // Fast cache check
      const cached = getCachedEvent(currentEventId);
      if (cached && (cached.name || cached.title)) {
        setResolvedTitle((cached.name || cached.title).trim());
        if (cached.slug) setResolvedSlug(cached.slug);
      }

      getEvent(currentEventId)
        .then((ev) => {
          if (ev) {
            const canonical = (ev.name || ev.title || "").trim();
            if (canonical) {
              setResolvedTitle(canonical);
              setCachedEvent(currentEventId, ev);
            }
            if (ev.slug) setResolvedSlug(ev.slug);
            else setResolvedSlug(ev.id);
            setEventCancelled(Boolean(ev.isCancelled || ev.status === "cancelled"));
            setEventCancelPending(Boolean(ev.cancellationRequest?.status === "pending"));
          }
        })
        .catch(() => {});
    }
  }, [currentEventId]);

  const getHref = (base) => {
    if (currentEventId) return `${base}?eventId=${currentEventId}`;
    return base;
  };

  const navTabs = [
    { name: "Overview", href: getHref("/admin/overview") },
    { name: "Guests", href: getHref("/admin/registrations") },
    { name: "Registration", href: getHref("/admin/form-generator") },
    { name: "Ambassadors", href: "/admin/programs" },
    { name: "Blasts", href: getHref("/admin/messages") },
    { name: "Insights", href: getHref("/admin/analytics") },
    { name: "Payouts", href: getHref("/admin/payments") },
    { name: "Support", href: getHref("/admin/support") },
    { name: "More", href: getHref("/admin/customize") },
  ];

  return (
    <div className="w-full text-[#061A3F] dark:text-white selection:bg-[#FE760B] selection:text-white">
      {/* ── 1. Breadcrumbs & Event Header matching All Images ── */}
      <div className="mb-4">
        <Link
          href="/admin/dashboard"
          className="inline-flex items-center gap-1.5 text-xs text-[#FE760B] font-semibold hover:underline mb-1.5 transition-colors"
        >
          <Ticket size={13} className="shrink-0" />
          <span>Events &gt;</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-bold text-[#061A3F] dark:text-white tracking-tight">
              {resolvedTitle}
            </h1>
            {eventCancelled ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30 text-[11px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                CANCELLED
              </span>
            ) : eventCancelPending ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[11px] font-bold animate-pulse">
                <Clock size={11} />
                CANCELLATION UNDER REVIEW
              </span>
            ) : isLive ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FE760B]/12 text-[#FE760B] border border-[#FE760B]/30 text-[11px] font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FE760B]" />
                LIVE
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {extraActions}

            {/* Event Page Link button */}
            <Link
              href={`/e/${resolvedSlug || currentEventId || ""}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#1A1C1F] hover:bg-slate-100 dark:hover:bg-[#212327] border border-[#D9DBE0] dark:border-[#2A2D31] text-xs font-semibold text-[#1E293B] dark:text-[#D0D0D1] hover:text-[#061A3F] dark:hover:text-white transition-colors shadow-sm"
            >
              <span>Event Page</span>
              <ArrowUpRight size={13} className="shrink-0" />
            </Link>
          </div>
        </div>
      </div>

      {/* ── Cancelled / Under Review Sticky Alert Banner ── */}
      {eventCancelled && (
        <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-white flex items-start gap-3 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <h4 className="text-sm font-bold text-rose-400">
              This event has been cancelled — View-Only Mode
            </h4>
            <p className="text-xs text-rose-200/80 leading-relaxed">
              Registrations and ticket sales are permanently closed. You can view all attendee records, transactions, and analytics, but no further actions, edits, or check-ins can be made.
            </p>
          </div>
        </div>
      )}

      {eventCancelPending && !eventCancelled && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-white flex items-start gap-3 shadow-xs">
          <Clock className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <h4 className="text-sm font-bold text-amber-400">
              Cancellation Ticket Under Super Admin Review
            </h4>
            <p className="text-xs text-amber-200/80 leading-relaxed">
              Your cancellation request for this paid event has been submitted to Super Admin for verification. The event operations remain locked until reviewed.
            </p>
          </div>
        </div>
      )}

      {/* ── 2. Event Subtabs matching All Images ── */}
      <div className="border-b border-[#D9DBE0] dark:border-[#2A2D31] mb-6 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-5 sm:gap-7 min-w-max text-xs sm:text-sm">
          {navTabs.map((tab) => {
            const isActive = tab.name.toLowerCase() === activeTab.toLowerCase();
            return (
              <Link
                key={tab.name}
                href={tab.href}
                className={`pb-3 font-medium transition-colors relative block ${
                  isActive
                    ? "text-[#061A3F] dark:text-white font-bold"
                    : "text-[#64748B] dark:text-[#9B9EA4] hover:text-[#061A3F] dark:hover:text-white"
                }`}
              >
                {tab.name}
                {isActive && (
                  <div className="absolute bottom-0 inset-x-0 h-0.5 bg-[#FE760B] rounded-full" />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
