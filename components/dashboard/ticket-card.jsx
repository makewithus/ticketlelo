"use client";

import { useState } from "react";
import { StubTicket } from "@/components/tickets/stub-ticket";
import { WideTicket } from "@/components/tickets/wide-ticket";
import { TicketFullPreviewModal } from "@/components/tickets/ticket-full-preview-modal";
import { toast } from "sonner";
import { Layers } from "lucide-react";

export function TicketCard({ registration, event }) {
  const [certLoading, setCertLoading] = useState(false);
  const [showFullPreview, setShowFullPreview] = useState(false);

  const handleDownload = () => {
    const downloadUrl = `/api/generate-ticket/${registration.ticketId}`;
    window.open(downloadUrl, "_blank");
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

  const isUsed =
    registration.status === "Used" || registration.status === "used";

  const isWide =
    event?.ticketDesign === "wide" ||
    registration?.ticketDesign === "wide" ||
    event?.ticketLayout === "wide" ||
    registration?.ticketLayout === "wide";

  return (
    <div className="w-full flex flex-col">
      <div
        onClick={() => setShowFullPreview(true)}
        className="cursor-pointer group/card transition-transform hover:scale-[1.005]"
        title="Click to view full length ticket"
      >
        {isWide ? (
          <WideTicket
            registration={registration}
            event={event}
            interactive={true}
            showActions={true}
            onDownload={handleDownload}
            onCertificate={isUsed ? handleGetCertificate : null}
          />
        ) : (
          <StubTicket
            registration={registration}
            event={event}
            interactive={true}
            showActions={true}
            onDownload={handleDownload}
            onCertificate={isUsed ? handleGetCertificate : null}
          />
        )}
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
          <div className="mt-2.5 bg-[#1A1C1F] rounded-xl p-3 border border-[#2A2D31]">
            <p className="text-xs font-semibold text-[#FE760B] flex items-center gap-1.5 mb-1.5">
              <Layers className="w-3.5 h-3.5 text-[#FE760B]" />
              Included Track Entitlements (
              {registration.entitledTrackNames.length}):
            </p>
            <div className="flex flex-wrap gap-1.5">
              {registration.entitledTrackNames.map((track, i) => (
                <span
                  key={i}
                  className="text-[10px] font-semibold bg-[#212327] text-[#061A3F] dark:text-[#D0D0D1] px-2.5 py-0.5 rounded-md border border-[#2A2D31]"
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
