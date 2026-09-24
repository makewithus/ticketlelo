"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Ticket, Calendar } from "lucide-react";
import Header from "@/components/Header";
import { getEvent } from "@/lib/firestore";
import { DynamicRegistrationForm } from "@/components/forms/dynamic-registration-form";

// Event registration (moved here from the landing page's inline "selectedEvent"
// view so the landing page can use the UI dev's markup untouched).
export default function RegisterPage() {
  const { eventId } = useParams();
  const [event, setEvent] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!eventId) return;
    (async () => {
      try {
        const data = await getEvent(eventId);
        setEvent(data ? { id: eventId, ...data } : null);
      } catch (error) {
        console.error("Failed to load event:", error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [eventId]);

  return (
    <div className="min-h-screen bg-black text-white relative overflow-x-hidden">
      <Header />
      <section className="relative pt-28 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-10 h-10 animate-spin text-[#FF6A00] mb-4" />
              <p className="text-gray-400">Loading event...</p>
            </div>
          ) : !event || event.isActive === false ? (
            <div className="text-center py-20">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-[#FF6A00]/10 border border-[#FF6A00]/20 rounded-2xl mb-6">
                <Calendar className="w-10 h-10 text-[#FFD60A]" />
              </div>
              <h3 className="text-2xl font-bold mb-2">Event not found</h3>
              <p className="text-gray-400 mb-6">
                This event is not available for registration.
              </p>
              <Link
                href="/#events"
                className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white border border-white/10 px-4 py-2 rounded-lg hover:border-[#FF6A00]/40 hover:bg-white/5 transition-all"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Events
              </Link>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <Link
                href="/#events"
                className="mb-8 inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white border border-white/10 px-4 py-2 rounded-lg hover:border-[#FF6A00]/40 hover:bg-white/5 transition-all"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Events
              </Link>
              <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-8">
                <div className="flex items-center gap-3 mb-2">
                  <div className="inline-flex items-center justify-center w-10 h-10 bg-[#FF6A00]/10 border border-[#FF6A00]/20 rounded-xl">
                    <Ticket className="w-5 h-5 text-[#FFD60A]" />
                  </div>
                  <h2 className="text-2xl font-bold">Register for {event.name}</h2>
                </div>
                <DynamicRegistrationForm eventId={event.id} event={event} />
              </div>
            </motion.div>
          )}
        </div>
      </section>
    </div>
  );
}
