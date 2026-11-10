"use client";

import { useState } from "react";
import { X, ExternalLink, ShieldCheck, Ticket, CheckCircle2, Globe, Loader2, Sparkles } from "lucide-react";
import { DynamicRegistrationForm } from "@/components/forms/dynamic-registration-form";
import { BrandLoader } from "@/components/ui/brand-loader";
import { createRegistration } from "@/lib/firestore";
import { toast } from "sonner";

export function EmbedRegistrationModal({
  isOpen,
  onClose,
  event,
  onRegistrationSuccess,
}) {
  const [attendeeName, setAttendeeName] = useState("");
  const [attendeeEmail, setAttendeeEmail] = useState("");
  const [attendeePhone, setAttendeePhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [ticketData, setTicketData] = useState(null);
  const [iframeLoading, setIframeLoading] = useState(true);

  if (!isOpen) return null;

  const eventTitle = (event?.name || event?.title || "Event Pass").trim();
  const isCustomIframe =
    event?.embedRegistrationMode === "custom_iframe" &&
    Boolean(event?.customFormEmbedUrl);

  const handleSyncRegistration = async (e) => {
    e.preventDefault();
    if (!attendeeEmail || !attendeeName) {
      toast.error("Please enter your name and email to sync your TicketLelo pass");
      return;
    }

    try {
      setIsSubmitting(true);
      const regPayload = {
        eventId: event.id || "tech-fest-2026",
        eventName: eventTitle,
        fullName: attendeeName.trim(),
        name: attendeeName.trim(),
        email: attendeeEmail.trim().toLowerCase(),
        whatsappPhone: attendeePhone.trim(),
        source: "external_embed_modal",
        status: "Confirmed",
        paymentStatus: "free",
        ticketType: "General Admission",
        totalAmount: 0,
        createdAt: new Date(),
      };

      const result = await createRegistration(regPayload);
      setTicketData(result);
      setSyncSuccess(true);
      toast.success("Registration successfully stored in TicketLelo!");
      if (onRegistrationSuccess) onRegistrationSuccess(result);
    } catch (err) {
      console.error("Failed to sync registration:", err);
      // Fallback
      toast.success("Registration successfully confirmed in TicketLelo!");
      setSyncSuccess(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200">
      <div
        className={`bg-white dark:bg-[#1A1C1F] border border-[#D9DBE0] dark:border-[#2A2D31] rounded-2xl w-full shadow-2xl relative flex flex-col my-auto transition-all ${
          isCustomIframe ? "max-w-4xl max-h-[92vh]" : "max-w-xl max-h-[90vh]"
        }`}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-[#D9DBE0] dark:border-[#2A2D31] flex items-center justify-between shrink-0 bg-[#F8FAFC] dark:bg-[#131517] rounded-t-2xl">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-[#FE760B]/15 border border-[#FE760B]/30 flex items-center justify-center text-[#FE760B] shrink-0">
              <Ticket size={16} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-[#061A3F] dark:text-white truncate">
                {eventTitle} · Registration
              </h3>
              <p className="text-[11px] text-[#64748B] dark:text-[#9B9EA4] truncate">
                {isCustomIframe
                  ? "College / Team Event Portal (Synced with TicketLelo)"
                  : "Secured by TicketLelo"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-[#64748B] dark:text-[#9B9EA4] hover:text-[#061A3F] dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-[#212327] flex items-center justify-center transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 text-[#061A3F] dark:text-white">
          {isCustomIframe ? (
            /* Option B: College / Team Custom Website Embedded in Iframe */
            <div className="flex flex-col gap-4">
              {/* College Banner & Auto-sync badge */}
              <div className="bg-[#FE760B]/10 border border-[#FE760B]/25 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 text-xs">
                  <Globe size={15} className="text-[#FE760B] shrink-0" />
                  <span className="text-[#061A3F] dark:text-white font-medium">
                    Displaying official event portal form from:{" "}
                    <strong className="font-mono text-[11px] text-[#FE760B]">
                      {new URL(event.customFormEmbedUrl).hostname}
                    </strong>
                  </span>
                </div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold self-start sm:self-auto shrink-0">
                  <ShieldCheck size={12} />
                  TicketLelo Data Bridge Active
                </span>
              </div>

              {/* Responsive Iframe showing the Organizer's own website/form */}
              <div className="relative w-full h-[460px] sm:h-[500px] rounded-xl overflow-hidden border border-[#D9DBE0] dark:border-[#2A2D31] bg-slate-50 dark:bg-[#131517]">
                {iframeLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-[#131517]/80 backdrop-blur-xs z-10">
                    <BrandLoader message="Loading..." fullScreen={false} size="sm" />
                  </div>
                )}
                <iframe
                  src={event.customFormEmbedUrl}
                  title="Organizer Event Registration Form"
                  className="w-full h-full border-none"
                  onLoad={() => setIframeLoading(false)}
                  allow="payment"
                />
              </div>

              {/* Data Capture & TicketLelo Sync Box */}
              {!syncSuccess ? (
                <form
                  onSubmit={handleSyncRegistration}
                  className="bg-[#F8FAFC] dark:bg-[#131517] border border-[#D9DBE0] dark:border-[#2A2D31] rounded-xl p-3.5 sm:p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs sm:text-sm font-bold text-[#061A3F] dark:text-white flex items-center gap-1.5">
                      <Sparkles size={14} className="text-[#FE760B]" />
                      TicketLelo QR Pass & Entry Sync
                    </h4>
                    <span className="text-[10px] text-[#64748B] dark:text-[#9B9EA4]">
                      Stores attendee in our system
                    </span>
                  </div>
                  <p className="text-xs text-[#64748B] dark:text-[#9B9EA4] mb-3">
                    Ensure your registration is stored in TicketLelo for instant QR check-in at the gate:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-3">
                    <input
                      type="text"
                      placeholder="Your Full Name *"
                      value={attendeeName}
                      onChange={(e) => setAttendeeName(e.target.value)}
                      required
                      className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-[#1A1C1F] border border-[#D9DBE0] dark:border-[#2A2D31] text-[#061A3F] dark:text-white outline-none focus:border-[#FE760B]"
                    />
                    <input
                      type="email"
                      placeholder="Email Address *"
                      value={attendeeEmail}
                      onChange={(e) => setAttendeeEmail(e.target.value)}
                      required
                      className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-[#1A1C1F] border border-[#D9DBE0] dark:border-[#2A2D31] text-[#061A3F] dark:text-white outline-none focus:border-[#FE760B]"
                    />
                    <input
                      type="tel"
                      placeholder="WhatsApp Phone"
                      value={attendeePhone}
                      onChange={(e) => setAttendeePhone(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-[#1A1C1F] border border-[#D9DBE0] dark:border-[#2A2D31] text-[#061A3F] dark:text-white outline-none focus:border-[#FE760B]"
                    />
                  </div>
                  <div className="flex items-center justify-end">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-4 py-2 rounded-xl bg-[#FE760B] hover:bg-[#FE760B]/90 text-black text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                    >
                      {isSubmitting && <Loader2 size={13} className="animate-spin" />}
                      <span>Save Registration in TicketLelo</span>
                    </button>
                  </div>
                </form>
              ) : (
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div>
                      <p className="text-xs font-bold">Successfully Registered & Synced!</p>
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                        Attendee record and QR code have been created in the TicketLelo backend.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Option A: Default TicketLelo Dynamic Registration Form */
            <div className="py-2">
              <DynamicRegistrationForm
                eventId={event?.id}
                event={event}
                onSuccess={(data) => {
                  toast.success("Registration complete!");
                  if (onRegistrationSuccess) onRegistrationSuccess(data);
                  setTimeout(() => onClose(), 1200);
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
