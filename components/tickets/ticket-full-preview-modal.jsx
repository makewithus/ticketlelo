"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Ticket as TicketIcon } from "lucide-react";
import { StubTicket } from "./stub-ticket";
import { WideTicket } from "./wide-ticket";

export function TicketFullPreviewModal({
  isOpen,
  onClose,
  ticket,
  event,
  design = "stub",
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || (!ticket && !event) || !mounted || typeof document === "undefined") return null;

  const eventData = event || {
    name: ticket?.title || ticket?.name || "Event Pass",
    title: ticket?.title || ticket?.name || "Event Pass",
    date: ticket?.date || "2026-11-07",
    time: ticket?.time || "12:00 PM",
    location: ticket?.venue || ticket?.location || "Main Auditorium",
    theme: ticket?.theme || "tech",
    price: ticket?.price !== undefined ? ticket.price : "Free",
    ticketDesign: design || ticket?.ticketDesign || "stub",
  };

  const regData = ticket || {
    ticketId: "TKT-1793-PREVIEW",
    attendeeName: "Attendee Pass",
    status: "Valid Pass",
  };

  const isWide = design === "wide" || eventData?.ticketDesign === "wide";

  const modalContent = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-6 overflow-y-auto animate-fade-in select-none"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Full Ticket Pass Preview"
    >
      <div
        className="relative w-full max-w-5xl bg-[#141619] border border-[#2A2D31] rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl space-y-4 my-auto overflow-hidden animate-scale-in max-h-[92dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#2A2D31] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#FE760B]/10 border border-[#FE760B]/20 flex items-center justify-center text-[#FE760B]">
              <TicketIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white">
                Full Ticket Pass Preview
              </h3>
              <p className="text-[11px] text-[#9B9EA4]">
                Full length unclipped physical ticket view
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#9B9EA4] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Full Length Scrollable Ticket Render */}
        <div className="py-2 overflow-x-auto overflow-y-auto flex-1 flex justify-center no-scrollbar">
          <div className="w-full max-w-[780px] min-w-[300px]">
            {isWide ? (
              <WideTicket
                event={eventData}
                registration={regData}
                interactive={true}
                showActions={false}
              />
            ) : (
              <StubTicket
                event={eventData}
                registration={regData}
                interactive={true}
                showActions={false}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

export default TicketFullPreviewModal;

