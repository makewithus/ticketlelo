"use client";

import { Button } from "@/components/ui/button";
import {
  Calendar,
  MapPin,
  Download,
  CheckCircle,
  Clock,
} from "lucide-react";

export function TicketCard({ registration, event }) {
  const handleDownload = () => {
    const downloadUrl = `/api/generate-ticket/${registration.ticketId}`;
    window.open(downloadUrl, "_blank");
  };

  const isUsed = registration.status === "Used";

  return (
    <div
      className={`group relative h-full flex flex-col rounded-lg border overflow-hidden transition-all duration-300 card-hover shadow-[var(--tl-shadow)] ${
        isUsed
          ? "border-[var(--tl-line)] bg-white/80 opacity-90"
          : "border-[var(--tl-line)] bg-[var(--tl-paper)] hover:border-[#3157ff]/35"
      }`}
    >
      {/* Top gradient bar */}
      <div
        className={`h-1 ${isUsed ? "bg-[#008d46]" : "bg-[#3157ff]"}`}
      />

      <div className="p-6 flex flex-col flex-1">
        {/* Status Badge */}
        <div className="flex justify-between items-start mb-4">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${
              isUsed
                ? "bg-[#008d46]/10 text-[#008d46] border-[#008d46]/20"
                : "bg-[#3157ff]/10 text-[#3157ff] border-[#3157ff]/20"
            }`}
          >
            {isUsed ? (
              <CheckCircle className="w-3.5 h-3.5" />
            ) : (
              <Clock className="w-3.5 h-3.5" />
            )}
            {registration.status}
          </span>
        </div>

        {/* Event Details */}
        <h3 className="text-xl font-bold text-[#061a3f] mb-2 group-hover:text-[#3157ff] transition-colors line-clamp-1">
          {event.name}
        </h3>
        <p className="text-sm text-[rgba(6,26,63,0.64)] mb-4 line-clamp-2 min-h-[2.5rem]">
          {event.description}
        </p>

        {/* Event Info */}
        <div className="space-y-2.5 mb-5">
          <div className="flex items-center gap-3 text-sm">
            <div className="w-8 h-8 rounded-lg bg-[#3157ff]/10 flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4 text-[#3157ff]" />
            </div>
            <span className="text-[rgba(6,26,63,0.72)] truncate">
              {event.date?.toDate
                ? event.date.toDate().toLocaleDateString("en-IN", {
                    weekday: "short",
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })
                : new Date(event.date).toLocaleDateString("en-IN", {
                    weekday: "short",
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="w-8 h-8 rounded-lg bg-[#ff0084]/10 flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4 text-[#ff0084]" />
            </div>
            <span className="text-[rgba(6,26,63,0.72)] truncate">{event.location}</span>
          </div>
        </div>

        {/* Ticket ID */}
        <div className="bg-[#f8fafc] rounded-lg p-3 mb-5 border border-[var(--tl-line)]">
          <p className="text-xs text-[rgba(6,26,63,0.56)] mb-1">Ticket ID</p>
          <p className="text-sm font-mono font-medium text-[#061a3f] truncate">
            {registration.ticketId}
          </p>
        </div>

        {/* QR Code */}
        {registration.qrCode && (
          <div className="flex justify-center mb-5">
            <div className="p-3 bg-white rounded-lg border border-[var(--tl-line)] shadow-md">
              <img
                src={registration.qrCode}
                alt="QR Code"
                className="w-28 h-28"
              />
            </div>
          </div>
        )}

        {/* Spacer to push button to bottom */}
        <div className="flex-1" />

        {/* Download Button */}
        <Button
          onClick={handleDownload}
          className="tl-primary-action w-full h-11 gap-2 font-bold transition-all"
        >
          <Download className="w-4 h-4" /> Download Ticket
        </Button>

        {/* Used Info */}
        {isUsed && registration.usedAt && (
          <div className="mt-4 pt-4 border-t border-[var(--tl-line)]">
            <p className="text-xs text-[rgba(6,26,63,0.56)] flex items-center gap-1.5">
              <CheckCircle className="w-3 h-3 text-[#008d46]" />
              Used on{" "}
              {registration.usedAt?.toDate
                ? registration.usedAt.toDate().toLocaleString()
                : registration.usedAt
                  ? new Date(registration.usedAt).toLocaleString()
                  : "N/A"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
