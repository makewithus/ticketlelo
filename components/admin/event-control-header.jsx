"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Ticket, ArrowUpRight } from "lucide-react";
import { getEvent } from "@/lib/firestore";

export function EventControlHeader({
  activeTab = "Overview",
  eventTitle = "Tech Fest 2026",
  eventSlug = "tech-fest-2026",
  eventId = null,
  isLive = true,
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

  const [resolvedTitle, setResolvedTitle] = useState(eventTitle);
  const [resolvedSlug, setResolvedSlug] = useState(
    eventSlug !== "tech-fest-2026" ? eventSlug : ""
  );

  useEffect(() => {
    if (eventTitle && eventTitle !== "Tech Fest 2026") {
      setResolvedTitle(eventTitle);
    }
  }, [eventTitle]);

  useEffect(() => {
    if (eventSlug && eventSlug !== "tech-fest-2026") {
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
      getEvent(currentEventId)
        .then((ev) => {
          if (ev) {
            if (ev.name || ev.title) setResolvedTitle(ev.name || ev.title);
            if (ev.slug) setResolvedSlug(ev.slug);
            else setResolvedSlug(ev.id);
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
    { name: "Blasts", href: getHref("/admin/messages") },
    { name: "Insights", href: getHref("/admin/analytics") },
    { name: "Payouts", href: getHref("/admin/payments") },
    { name: "More", href: getHref("/admin/customize") },
  ];

  return (
    <div className="w-full text-[#061A3F] dark:text-white selection:bg-[#FE760B] selection:text-white">
      {/* ── 1. Breadcrumbs & Event Header matching All Images ── */}
      <div className="mb-6">
        <Link
          href="/admin/dashboard"
          className="inline-flex items-center gap-1.5 text-xs text-[#FE760B] font-semibold hover:underline mb-1.5 transition-colors"
        >
          <Ticket size={13} className="shrink-0" />
          <span>Events &gt;</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold text-[#061A3F] dark:text-white tracking-tight">
              {resolvedTitle}
            </h1>
            {isLive && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FE760B]/12 text-[#FE760B] border border-[#FE760B]/30 text-[11px] font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FE760B]" />
                LIVE
              </span>
            )}
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
