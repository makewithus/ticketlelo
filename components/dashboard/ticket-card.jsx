"use client";

import { Button } from "@/components/ui/button";
import {
  Calendar,
  MapPin,
  Download,
  CheckCircle,
  Clock,
  QrCode,
} from "lucide-react";

export function TicketCard({ registration, event }) {
  const handleDownload = () => {
    const downloadUrl = `/api/generate-ticket/${registration.ticketId}`;
    window.open(downloadUrl, "_blank");
  };

  const isUsed = registration.status === "Used";

  return (
    <div
      className={`group relative h-full flex flex-col rounded-2xl border overflow-hidden transition-all duration-300 card-hover ${
        isUsed
          ? "border-slate-800 bg-slate-900/40"
          : "border-slate-800 bg-slate-900/60 hover:border-[#FF6A00]/40"
      }`}
    >
      {/* Top gradient bar */}
      <div
        className={`h-1 ${isUsed ? "bg-[#FF6A00] hover:bg-[#E65C00]" : "bg-[#FF6A00] hover:bg-[#E65C00]"}`}
      />

      <div className="p-6 flex flex-col flex-1">
        {/* Status Badge */}
        <div className="flex justify-between items-start mb-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#FF6A00]/10 text-[#FF6A00] border border-[#FF6A00]/20">
            {isUsed ? (
              <CheckCircle className="w-3.5 h-3.5" />
            ) : (
              <Clock className="w-3.5 h-3.5" />
            )}
            {registration.status}
          </span>
        </div>

        {/* Event Details */}
        <h3 className="text-xl font-bold text-white mb-2 group-hover:text-[#FFD60A] transition-colors line-clamp-1">
          {event.name}
        </h3>
        <p className="text-sm text-slate-400 mb-4 line-clamp-2 min-h-[2.5rem]">
          {event.description}
        </p>

        {/* Event Info */}
        <div className="space-y-2.5 mb-5">
          <div className="flex items-center gap-3 text-sm">
            <div className="w-8 h-8 rounded-lg bg-[#FF6A00]/10 flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4 text-[#FF6A00]" />
            </div>
            <span className="text-slate-300 truncate">
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
            <div className="w-8 h-8 rounded-lg bg-[#FFD60A]/10 flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4 text-[#FFD60A]" />
            </div>
            <span className="text-slate-300 truncate">{event.location}</span>
          </div>
        </div>

        {/* Ticket ID */}
        <div className="bg-slate-800/50 rounded-xl p-3 mb-5 border border-slate-700/50">
          <p className="text-xs text-slate-500 mb-1">Ticket ID</p>
          <p className="text-sm font-mono font-medium text-[#FF6A00] truncate">
            {registration.ticketId}
          </p>
        </div>

        {/* QR Code */}
        {registration.qrCode && (
          <div className="flex justify-center mb-5">
            <div className="p-3 bg-white rounded-xl shadow-md shadow-[#FF6A00]/10">
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
          className="w-full h-11 gap-2 bg-[#FF6A00] hover:bg-[#E65C00] text-white font-bold shadow-lg shadow-[#FF6A00]/20 transition-all rounded-xl"
        >
          <Download className="w-4 h-4" /> Download Ticket
        </Button>

        {/* Used Info */}
        {isUsed && registration.usedAt && (
          <div className="mt-4 pt-4 border-t border-slate-800">
            <p className="text-xs text-slate-500 flex items-center gap-1.5">
              <CheckCircle className="w-3 h-3 text-[#FF6A00]" />
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
