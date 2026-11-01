"use client";

import React from "react";
import { SvgBarcode } from "@/components/tickets/wide-ticket";

/**
 * TicketGuidelinesCard: Exact match to Card 2 (Bottom Card) of the official pass
 * Contains TicketLelo branding, Code 128 barcode, OFFICIAL TICKET NO., and
 * the 5 official Event Entry & Verification Guidelines.
 */
export function TicketGuidelinesCard({
  registration = {},
  event = {},
  className = "",
}) {
  const ticketId =
    registration.ticketId || registration.id || "TKT-HONEY-003";
  const eventName = (
    event.name ||
    event.title ||
    registration.eventName ||
    registration.eventTitle ||
    "EVENT PASS"
  ).toUpperCase();

  const guidelines = [
    "1. Present the QR code or Barcode at the entry gate on mobile or printed pass.",
    "2. Each entry pass is cryptographically signed and valid for one-time admission.",
    "3. Keep this pass safe and avoid sharing full ticket codes publicly.",
    "4. In case of gate verification issues, contact the event desk with your Ticket ID.",
    `5. Event: ${eventName} • Organized on TicketLelo.`,
  ];

  return (
    <div
      className={`w-full max-w-4xl mx-auto bg-white text-black border-2 border-black/80 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-md overflow-hidden select-none ${className}`}
    >
      <div className="flex flex-col md:flex-row items-stretch gap-4 md:gap-6">
        {/* Left Column: Logo, Barcode, Official Ticket No. */}
        <div className="w-full md:w-[38%] flex flex-col justify-between items-center text-center pb-4 md:pb-0 md:pr-6 border-b md:border-b-0 md:border-r-2 border-dashed border-gray-300">
          {/* TicketLelo Official Logo */}
          <div className="w-full flex justify-center mb-3">
            <img
              src="/email_logo.png"
              alt="TicketLelo Logo"
              className="h-10 sm:h-12 w-auto object-contain"
            />
          </div>

          {/* Barcode */}
          <div className="w-full flex justify-center items-center py-2 h-14 sm:h-16">
            <SvgBarcode
              value={ticketId}
              height={50}
              orientation="horizontal"
              className="h-12 sm:h-14 w-full max-w-[240px]"
            />
          </div>

          {/* Official Ticket No. */}
          <div className="w-full flex items-center justify-center gap-3 pt-2 text-[10px] sm:text-xs font-mono font-bold text-black tracking-wider">
            <span>OFFICIAL TICKET NO.</span>
            <span className="font-extrabold">{ticketId}</span>
          </div>
        </div>

        {/* Right Column: Guidelines */}
        <div className="w-full md:w-[62%] flex flex-col justify-between relative pl-0 md:pl-2">
          <div>
            <h3 className="text-sm sm:text-base md:text-lg font-black uppercase text-black tracking-tight mb-3 sm:mb-4">
              EVENT ENTRY &amp; VERIFICATION GUIDELINES
            </h3>
            <ol className="space-y-1.5 sm:space-y-2 text-[11px] sm:text-xs md:text-[13px] text-black/90 font-medium leading-relaxed">
              {guidelines.map((line, idx) => (
                <li key={idx} className="flex items-start">
                  <span>{line}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Ticket Icon Bottom Right */}
          <div className="w-full flex justify-end mt-3 sm:mt-4">
            <img
              src="/ticket.png"
              alt="TicketLelo Pass"
              className="w-5 h-5 sm:w-6 sm:h-6 object-contain opacity-90"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
