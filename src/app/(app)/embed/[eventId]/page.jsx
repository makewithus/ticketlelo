"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Loader2, Ticket, CheckCircle2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
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
        const height = document.documentElement.scrollHeight || document.body.scrollHeight;
        window.parent.postMessage({ type: "ticketlelo:resize", height }, "*");
      }
    };

    notifyHeight();
    const timer = setTimeout(notifyHeight, 500);
    window.addEventListener("resize", notifyHeight);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", notifyHeight);
    };
  }, [event, loading]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[360px] p-8 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
        <p className="text-sm font-medium">Loading secure registration...</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center p-8 text-slate-600">
        <p className="font-semibold text-base mb-1">Event Not Available</p>
        <p className="text-xs text-slate-500">This event could not be found or is not accepting registrations.</p>
      </div>
    );
  }

  return (
    <div className={`p-4 sm:p-6 font-sans ${theme === "dark" ? "bg-slate-900 text-white" : "bg-white text-slate-900"}`}>
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 mb-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight">{event.name || event.title}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {event.location || "Venue"} • Secured by TicketLelo
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
          <ShieldCheck className="w-3.5 h-3.5" /> Official Embed
        </div>
      </div>

      {refCode && (
        <div className="mb-4 p-2.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg text-xs text-blue-700 dark:text-blue-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
          <span>Referral applied: <strong>{refCode}</strong></span>
        </div>
      )}

      {/* Embedded Dynamic Registration Form */}
      <DynamicRegistrationForm eventId={eventId} event={event} />
    </div>
  );
}
