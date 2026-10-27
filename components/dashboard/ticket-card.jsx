import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  MapPin,
  Download,
  CheckCircle,
  Clock,
  Award,
  CalendarPlus,
  Loader2,
  Layers,
} from "lucide-react";
import { generateICS } from "@/lib/calendar";
import { toast } from "sonner";
import { parseFirestoreDate, formatShortDate, formatDateTime } from "@/lib/date-utils";

export function TicketCard({ registration, event }) {
  const [certLoading, setCertLoading] = useState(false);

  const handleDownload = () => {
    const downloadUrl = `/api/generate-ticket/${registration.ticketId}`;
    window.open(downloadUrl, "_blank");
  };

  const handleAddToCalendar = () => {
    try {
      const eventDate = parseFirestoreDate(event.date) || new Date();
      const icsData = generateICS({
        title: event.name || "Festival Event",
        description: `${event.description || ""}\nTicket ID: ${registration.ticketId}`,
        location: event.location || "Venue Location",
        startDate: eventDate,
      });

      const blob = new Blob([icsData], { type: "text/calendar;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${(event.name || "event").replace(/\s+/g, "_")}.ics`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Calendar invite downloaded (.ics)");
    } catch (err) {
      toast.error("Failed to generate calendar invite");
    }
  };

  const handleGetCertificate = async () => {
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
      window.open(`/verify-certificate/${data.certificate.certificateId}`, "_blank");
    } catch (err) {
      toast.error(err.message || "Certificate unavailable (attendance verification required)");
    } finally {
      setCertLoading(false);
    }
  };

  const isUsed = registration.status === "Used" || registration.status === "used";


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
              {formatShortDate(event.date, "Date TBA")}
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

        {/* Entitlements / Track snapshot if combo or fest pass */}
        {Array.isArray(registration.entitledTrackNames) && registration.entitledTrackNames.length > 0 && (
          <div className="bg-blue-50/70 dark:bg-blue-950/40 rounded-lg p-2.5 mb-4 border border-blue-200/60 dark:border-blue-800/40">
            <p className="text-xs font-semibold text-blue-900 dark:text-blue-300 flex items-center gap-1.5 mb-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              Included Track Entitlements ({registration.entitledTrackNames.length}):
            </p>
            <div className="flex flex-wrap gap-1">
              {registration.entitledTrackNames.map((track, i) => (
                <span key={i} className="text-[10px] font-medium bg-white dark:bg-slate-900 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                  {track}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2 w-full">
          <Button
            onClick={handleDownload}
            className="tl-primary-action w-full h-10 gap-2 font-bold transition-all text-sm"
          >
            <Download className="w-4 h-4" /> Download PDF Ticket
          </Button>

          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={handleAddToCalendar}
              variant="outline"
              className="h-9 text-xs font-semibold gap-1.5 border-[var(--tl-line)] hover:bg-slate-50"
            >
              <CalendarPlus className="w-3.5 h-3.5 text-[#3157ff]" /> Calendar (.ics)
            </Button>

            <Button
              onClick={() => {
                const orderId = registration.orderId || registration.ticketId;
                window.open(`/api/invoices/${orderId}`, "_blank");
              }}
              variant="outline"
              className="h-9 text-xs font-semibold gap-1.5 border-[var(--tl-line)] hover:bg-slate-50"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" /> Tax Invoice
            </Button>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={async () => {
                try {
                  const res = await fetch(`/api/wallet/apple/${registration.ticketId}`);
                  const data = await res.json();
                  if (data.requiresCredentials) {
                    toast.info("Apple Wallet requires production Apple Developer certificate configuration.");
                  } else {
                    toast.success("Apple Wallet pass generated!");
                  }
                } catch {
                  toast.error("Failed to load Apple Wallet pass");
                }
              }}
              variant="ghost"
              className="flex-1 h-8 text-[11px] font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg"
            >
              Apple Wallet
            </Button>

            <Button
              onClick={async () => {
                try {
                  const res = await fetch(`/api/wallet/google/${registration.ticketId}`);
                  const data = await res.json();
                  if (data.requiresCredentials) {
                    toast.info("Google Wallet requires production Issuer Account configuration.");
                  } else if (data.passResult?.saveUrl) {
                    window.open(data.passResult.saveUrl, "_blank");
                  } else {
                    toast.success("Google Wallet pass ready!");
                  }
                } catch {
                  toast.error("Failed to load Google Wallet pass");
                }
              }}
              variant="ghost"
              className="flex-1 h-8 text-[11px] font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg"
            >
              Google Wallet
            </Button>

            {isUsed && (
              <Button
                onClick={handleGetCertificate}
                disabled={certLoading}
                className="flex-1 h-8 text-[11px] font-semibold gap-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg"
              >
                {certLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Award className="w-3 h-3 text-amber-300" />
                )}
                Certificate
              </Button>
            )}
          </div>
        </div>

        {/* Used Info */}
        {isUsed && registration.usedAt && (
          <div className="mt-4 pt-4 border-t border-[var(--tl-line)]">
            <p className="text-xs text-[rgba(6,26,63,0.56)] flex items-center gap-1.5">
              <CheckCircle className="w-3 h-3 text-[#008d46]" />
              Used on {formatDateTime(registration.usedAt, "N/A")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
