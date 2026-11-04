"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Loader2, Ticket, CheckCircle2, ShieldCheck, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getEvent } from "@/lib/firestore";
import { DynamicRegistrationForm } from "@/components/forms/dynamic-registration-form";
import { BrandLoader } from "@/components/ui/brand-loader";

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
    return <BrandLoader message="Loading..." fullScreen />;
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-[#131517] text-white flex flex-col items-center justify-center p-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mx-auto mb-4 bg-[#FE760B] text-[#131517] shadow-sm">
          <Ticket className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Event not available</h2>
        <p className="text-xs text-[#9B9EA4] max-w-xs mx-auto">
          This event could not be found or is currently not accepting registrations.
        </p>
      </div>
    );
  }

  return (
    <div
      id="tl-embed-root"
      className="min-h-screen bg-[#131517] text-white flex flex-col items-center justify-center p-4 sm:p-6 transition-colors"
    >
      <div className="w-full max-w-md mx-auto">
        {/* Back to Home Link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-[#9B9EA4] hover:text-white transition-colors mb-6 group text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Back to home</span>
        </Link>

        {/* Card */}
        <div
          id="tl-embed-card"
          className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-4 xs:p-6 sm:p-8 w-full shadow-xl"
        >
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mx-auto mb-4 bg-[#FE760B] text-[#131517] shadow-sm">
              <Ticket className="w-8 h-8" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2 tracking-tight">
              {event.name || event.title}
            </h1>
            <p className="text-[#9B9EA4] text-sm">
              {event.location || "Venue"} • Secured by TicketLelo
            </p>

            {refCode && (
              <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-[#3DD68C]/15 border border-[#3DD68C]/30 text-[#3DD68C] rounded-full text-xs font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Referral applied: <strong>{refCode}</strong></span>
              </div>
            )}
          </div>

          {/* Embedded Dynamic Registration Form */}
          <DynamicRegistrationForm eventId={eventId} event={event} />

          {/* Footer */}
          <div className="mt-6 pt-6 border-t border-[#2A2D31] text-center">
            <p className="text-sm text-[#9B9EA4]">
              Want to host an event?{" "}
              <Link
                href="/host-event"
                className="text-[#FF9A4D] hover:text-[#FE760B] font-medium transition-colors"
              >
                Apply here
              </Link>
            </p>
          </div>
        </div>

        {/* Subtext below card */}
        <p className="text-center text-xs text-[#9B9EA4] mt-6">
          Looking for a different portal?{" "}
          <Link href="/" className="text-[#FF9A4D] hover:underline font-medium">
            Go to homepage
          </Link>
        </p>
      </div>
    </div>
  );
}
