"use client";

import React from "react";
import Image from "next/image";

/**
 * Branded TicketLelo Animated Logo Loader
 * Uses the official TicketLelo logo with smooth branded breathing animation.
 * Strictly NO generic spinners, orbit rings, or dashed borders.
 *
 * Always perfectly centered vertically and horizontally in the middle of
 * the screen or parent container.
 */
export function BrandLoader({
  message = "Loading...",
  subMessage = "",
  fullScreen = false,
  center = true,
  size = "default", // "sm" | "default" | "lg"
  className = "",
  minHeight = "",
}) {
  const sizeMap = {
    sm: {
      logoWidth: 100,
      logoHeight: 36,
      text: "text-xs",
    },
    default: {
      logoWidth: 140,
      logoHeight: 50,
      text: "text-sm",
    },
    lg: {
      logoWidth: 180,
      logoHeight: 64,
      text: "text-base",
    },
  };

  const currentSize = sizeMap[size] || sizeMap.default;

  const content = (
    <div className="flex flex-col items-center justify-center text-center p-4 select-none">
      {/* TicketLelo Logo with Smooth Breathing / Pulse Animation */}
      <div className="relative flex items-center justify-center mb-3">
        {/* Subtle Warm Amber Glow Behind Logo */}
        <div
          className="absolute -inset-4 rounded-full bg-[#FE760B]/15 blur-xl pointer-events-none animate-pulse"
          style={{ animationDuration: "2.4s" }}
        />

        {/* Logo Image */}
        <div
          className="relative transition-all duration-700 ease-in-out animate-pulse"
          style={{ animationDuration: "1.8s" }}
        >
          <Image
            src="/logo/ticketlelo-logo-nav.png"
            alt="TicketLelo"
            width={currentSize.logoWidth}
            height={currentSize.logoHeight}
            className="object-contain filter drop-shadow(0 4px 12px rgba(254,118,11,0.25))"
            priority
          />
        </div>
      </div>

      {/* Clean Status Message */}
      {message && (
        <div className="space-y-0.5 mt-1">
          <p className={`font-semibold text-slate-800 dark:text-[#E2E8F0] tracking-wide ${currentSize.text}`}>
            {message}
          </p>
          {subMessage && (
            <p className="text-[11px] text-slate-500 dark:text-[#9B9EA4]">
              {subMessage}
            </p>
          )}
        </div>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div
        className={`fixed inset-0 z-50 bg-slate-50 dark:bg-[#131517] text-slate-900 dark:text-white flex flex-col items-center justify-center p-6 transition-colors select-none ${className}`}
      >
        {content}
      </div>
    );
  }

  const heightClass = minHeight
    ? minHeight
    : !center
    ? ""
    : size === "sm"
    ? "min-h-[160px]"
    : "min-h-[70vh] sm:min-h-[75vh]";

  return (
    <div
      className={`w-full flex-1 flex flex-col items-center justify-center text-center p-6 select-none ${heightClass} ${className}`}
    >
      {content}
    </div>
  );
}

export default BrandLoader;
