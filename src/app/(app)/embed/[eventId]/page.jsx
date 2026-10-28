"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Loader2, Ticket, CheckCircle2, ShieldCheck, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getEvent } from "@/lib/firestore";
import { DynamicRegistrationForm } from "@/components/forms/dynamic-registration-form";

export default function EmbedRegistrationPage() {
  const { eventId } = useParams();
  const searchParams = useSearchParams();
  const refCode = searchParams.get("ref");
  const theme = searchParams.get("theme") || "light";

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId) return;
    (async () => {
      try {
        setLoading(true);
        const data = await getEvent(eventId);
        setEvent(data ? { id: eventId, ...data } : null);
      } catch (err) {
        console.error("Embed event load error:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [eventId]);

  // Notify parent window of height changes for auto-resizing
  useEffect(() => {
    const notifyHeight = () => {
      if (typeof window !== "undefined" && window.parent) {
        const card = document.getElementById("tl-embed-card");
        const height = card ? card.scrollHeight + 80 : (document.documentElement.scrollHeight || document.body.scrollHeight);
        window.parent.postMessage({ type: "ticketlelo:resize", height }, "*");
      }
    };

    notifyHeight();
    const timer = setTimeout(notifyHeight, 300);

    let observer = null;
    if (typeof ResizeObserver !== "undefined") {
      const card = document.getElementById("tl-embed-card");
      if (card) {
        observer = new ResizeObserver(() => notifyHeight());
        observer.observe(card);
      }
    }

    window.addEventListener("resize", notifyHeight);
    return () => {
      clearTimeout(timer);
      if (observer) observer.disconnect();
      window.removeEventListener("resize", notifyHeight);
    };
  }, [event, loading]);

  if (loading) {
    return (
      <div className={`tl-auth-page min-h-screen flex flex-col items-center justify-center p-8 ${theme === "dark" ? "dark bg-[#070D1E] text-white" : ""}`}>
        <div className="tl-auth-icon inline-flex items-center justify-center w-16 h-16 rounded-2xl mx-auto mb-4 bg-[#3157ff] shadow-[0_14px_28px_rgba(49,87,255,0.22)]">
          <Loader2 className="w-8 h-8 animate-spin text-white" />
        </div>
        <p className="text-base font-bold text-[#061a3f] dark:text-white">Loading Registration...</p>
        <p className="text-xs text-[rgba(6,26,63,0.64)] dark:text-slate-400 mt-1">Securing your booking session</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className={`tl-auth-page min-h-screen flex flex-col items-center justify-center p-8 text-center ${theme === "dark" ? "dark bg-[#070D1E] text-white" : ""}`}>
        <div className="tl-auth-icon inline-flex items-center justify-center w-16 h-16 rounded-2xl mx-auto mb-4 bg-[#3157ff] shadow-[0_14px_28px_rgba(49,87,255,0.22)]">
          <Ticket className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-extrabold text-[#061a3f] dark:text-white mb-2">Event Not Available</h2>
        <p className="text-xs text-[rgba(6,26,63,0.64)] dark:text-slate-400 max-w-xs mx-auto">
          This event could not be found or is currently not accepting registrations.
        </p>
      </div>
    );
  }

  const isDark = theme === "dark";

  return (
    <div
      id="tl-embed-root"
      className={`tl-auth-page min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 transition-colors ${
        isDark ? "dark bg-[#070D1E] text-slate-100" : ""
      }`}
    >
      <div className="w-full max-w-md mx-auto">
        {/* Back to Home Link (from Image 2) */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-[rgba(6,26,63,0.64)] dark:text-slate-400 hover:text-[#061a3f] dark:hover:text-white transition-colors mb-6 group text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Back to Home</span>
        </Link>

        {/* Card (Matching Image 2 Organiser Portal) */}
        <div
          id="tl-embed-card"
          className="tl-auth-card p-8 rounded-2xl w-full bg-white dark:bg-slate-900 border border-[var(--tl-line)] dark:border-slate-800 shadow-[0_18px_45px_rgba(6,26,63,0.08)]"
        >
          {/* Header */}
          <div className="text-center mb-8">
            <div className="tl-auth-icon inline-flex items-center justify-center w-16 h-16 rounded-2xl mx-auto mb-4 bg-[#3157ff] shadow-[0_14px_28px_rgba(49,87,255,0.22)]">
              <Ticket className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-extrabold text-[#061a3f] dark:text-white mb-2 tracking-tight">
              {event.name || event.title}
            </h1>
            <p className="text-[rgba(6,26,63,0.64)] dark:text-slate-400 text-sm">
              {event.location || "Venue"} • Secured by TicketLelo
            </p>

            {refCode && (
              <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-[#eef2ff] dark:bg-blue-950/40 border border-[#c7d2fe] dark:border-blue-800 rounded-full text-xs text-[#3157ff] dark:text-blue-300 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Referral applied: <strong>{refCode}</strong></span>
              </div>
            )}
          </div>

          {/* Embedded Dynamic Registration Form */}
          <DynamicRegistrationForm eventId={eventId} event={event} />

          {/* Footer (from Image 2) */}
          <div className="mt-6 pt-6 border-t border-[var(--tl-line)] dark:border-slate-800 text-center">
            <p className="text-sm text-[rgba(6,26,63,0.64)] dark:text-slate-400">
              Want to host an event?{" "}
              <Link
                href="/host-event"
                className="text-[#3157ff] hover:text-[#173cf4] font-medium transition-colors"
              >
                Apply here
              </Link>
            </p>
          </div>
        </div>

        {/* Subtext below card (from Image 2) */}
        <p className="text-center text-xs text-[rgba(6,26,63,0.54)] dark:text-slate-500 mt-6">
          Looking for a different portal?{" "}
          <Link href="/" className="text-[#3157ff] hover:underline font-medium">
            Go to homepage
          </Link>
        </p>
      </div>
    </div>
  );
}
