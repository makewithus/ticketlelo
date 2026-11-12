"use client";

import { useState } from "react";
import Link from "next/link";
import { StubTicket } from "@/components/tickets/stub-ticket";
import { WideTicket } from "@/components/tickets/wide-ticket";
import { TicketFullPreviewModal } from "@/components/tickets/ticket-full-preview-modal";
import { toast } from "sonner";
import {
  Layers,
  Ticket,
  Eye,
  Download,
  Award,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { formatTicketDate } from "@/lib/date-utils";

export function TicketCard({ registration, event = {} }) {
  const [certLoading, setCertLoading] = useState(false);
  const [showFullPreview, setShowFullPreview] = useState(false);

  const handleDownload = (e) => {
    e?.stopPropagation?.();
    const downloadUrl = `/api/generate-ticket/${registration.ticketId}`;
    window.open(downloadUrl, "_blank");
  };

  const handleGetCertificate = async (e) => {
    e?.stopPropagation?.();
    try {
      setCertLoading(true);
      const res = await fetch("/api/certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId: registration.ticketId,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to generate certificate");
      }
      toast.success("Certificate issued! Opening verified credential...");
      window.open(
        `/verify-certificate/${data.certificate.certificateId}`,
        "_blank"
      );
    } catch (err) {
      toast.error(
        err.message ||
          "Certificate unavailable (attendance verification required)"
      );
    } finally {
      setCertLoading(false);
    }
  };

  const isPending =
    registration.status === "pending" ||
    registration.approvalStatus === "pending";

  const isUsed =
    registration.status === "Used" ||
    registration.status === "used" ||
    registration.checkedIn === true;

  const isWide =
    event?.ticketDesign === "wide" ||
    registration?.ticketDesign === "wide" ||
    event?.ticketLayout === "wide" ||
    registration?.ticketLayout === "wide";

  const eventName =
    event?.name ||
    event?.title ||
    registration?.eventName ||
    registration?.eventTitle ||
    "Event Pass";

  const eventImage =
    event?.bannerUrl ||
    event?.coverImage ||
    event?.posterUrl ||
    event?.imageUrl ||
    event?.image ||
    event?.ticketBgUrl ||
    registration?.bannerUrl ||
    null;

  const eventDate = event?.date || event?.startDate || registration?.eventDate;
  const eventTime = event?.time || event?.startTime || registration?.eventTime || "";
  const venue =
    event?.location ||
    event?.venue ||
    registration?.venue ||
    registration?.location ||
    "Venue TBA";
  const ticketType =
    registration?.ticketTier ||
    registration?.tierName ||
    registration?.ticketType ||
    "General Pass";
  const ticketId = registration?.ticketId || `TKT-${registration?.id?.slice(0, 8) || "001"}`;

  return (
    <div className="w-full flex flex-col bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] rounded-2xl p-3.5 sm:p-5 shadow-sm transition-all hover:border-slate-300 dark:hover:border-[#383C42]">
      {/* ── Top Header Strip: Event Image, Title, Venue, and Status ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-3 border-b border-slate-100 dark:border-[#2A2D31]/70">
        <div className="flex items-center gap-3 min-w-0">
          {eventImage ? (
            <img
              src={eventImage}
              alt={eventName}
              className="w-12 h-12 rounded-xl object-cover shrink-0 border border-slate-200 dark:border-[#2A2D31] shadow-xs"
            />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-[#FE760B]/10 border border-[#FE760B]/20 flex items-center justify-center shrink-0 text-[#FE760B] font-black text-sm">
              <Ticket className="w-6 h-6" />
            </div>
          )}
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate" title={eventName}>
              {eventName}
            </h3>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-[#9B9EA4] truncate mt-0.5">
              <span className="flex items-center gap-1 shrink-0">
                <Calendar className="w-3.5 h-3.5 text-[#FE760B]" />
                {formatTicketDate(eventDate)}
              </span>
              {eventTime && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1 shrink-0">
                    <Clock className="w-3.5 h-3.5 text-[#FE760B]" />
                    {eventTime}
                  </span>
                </>
              )}
              <span>•</span>
              <span className="flex items-center gap-1 truncate" title={venue}>
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{venue}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2 shrink-0">
          {isPending ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/10 text-amber-500 border border-amber-500/25">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Pending Approval</span>
            </span>
          ) : isUsed ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-500/15 text-slate-400 border border-slate-500/30">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Used / Admitted</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Valid Pass</span>
            </span>
          )}
        </div>
      </div>

      {/* ── Ticket Graphic Preview (Clickable to view full preview) ── */}
      <div
        onClick={() => setShowFullPreview(true)}
        className="cursor-pointer group/card transition-transform hover:scale-[1.003]"
        title="Click to view full length ticket"
      >
        {isWide ? (
          <WideTicket
            registration={registration}
            event={event}
            interactive={true}
            showActions={false}
            onDownload={handleDownload}
            onCertificate={isUsed ? handleGetCertificate : null}
          />
        ) : (
          <StubTicket
            registration={registration}
            event={event}
            interactive={true}
            showActions={false}
            onDownload={handleDownload}
            onCertificate={isUsed ? handleGetCertificate : null}
          />
        )}
      </div>

      {/* ── Bottom Action Toolbar ── */}
      <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-[#2A2D31]/70 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-[#9B9EA4]">
          <span className="font-semibold text-slate-700 dark:text-[#D0D0D1]">{ticketType}</span>
          <span>•</span>
          <span className="font-mono text-[#FE760B] font-bold">{ticketId}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Primary "View Ticket" button */}
          <button
            type="button"
            onClick={() => setShowFullPreview(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#FE760B] hover:bg-[#FF8A2B] text-white transition-all shadow-sm cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>View Ticket</span>
          </button>

          {/* Standalone ticket details link */}
          <Link
            href={`/tickets/${registration.ticketId}`}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-[#212327] hover:bg-slate-200 dark:hover:bg-[#2A2D31] text-slate-700 dark:text-[#D0D0D1] transition-all cursor-pointer border border-slate-200 dark:border-[#2A2D31]"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Details</span>
          </Link>

          {/* Download PDF button */}
          <button
            type="button"
            onClick={handleDownload}
            title="Download PDF Pass"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-[#212327] hover:bg-slate-200 dark:hover:bg-[#2A2D31] text-slate-700 dark:text-[#D0D0D1] transition-all cursor-pointer border border-slate-200 dark:border-[#2A2D31]"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">PDF</span>
          </button>

          {/* Verified Certificate button if checked-in */}
          {isUsed && (
            <button
              type="button"
              onClick={handleGetCertificate}
              disabled={certLoading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-all cursor-pointer"
            >
              <Award className="w-3.5 h-3.5" />
              <span>{certLoading ? "Issuing..." : "Certificate"}</span>
            </button>
          )}
        </div>
      </div>

      <TicketFullPreviewModal
        isOpen={showFullPreview}
        onClose={() => setShowFullPreview(false)}
        ticket={registration}
        event={event}
        design={isWide ? "wide" : "stub"}
      />

      {/* Entitlements / Track snapshot if combo or fest pass */}
      {Array.isArray(registration.entitledTrackNames) &&
        registration.entitledTrackNames.length > 0 && (
          <div className="mt-3 bg-slate-50 dark:bg-[#151719] rounded-xl p-3 border border-slate-200 dark:border-[#2A2D31]">
            <p className="text-xs font-semibold text-[#FE760B] flex items-center gap-1.5 mb-1.5">
              <Layers className="w-3.5 h-3.5 text-[#FE760B]" />
              Included Track Entitlements ({registration.entitledTrackNames.length}):
            </p>
            <div className="flex flex-wrap gap-1.5">
              {registration.entitledTrackNames.map((track, i) => (
                <span
                  key={i}
                  className="text-[10px] font-semibold bg-white dark:bg-[#212327] text-slate-700 dark:text-[#D0D0D1] px-2.5 py-0.5 rounded-md border border-slate-200 dark:border-[#2A2D31]"
                >
                  {track}
                </span>
              ))}
            </div>
          </div>
        )}
    </div>
  );
}

export default TicketCard;
