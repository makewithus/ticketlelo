"use client";

import React, { useState, useEffect } from "react";
import { getThemeLook, getPosterLines } from "@/lib/theme-utils";

/**
 * EventBanner - The canonical, consistent event banner & poster component.
 * Ensures 100% visual parity across all pages in TicketLelo (Registration,
 * Event Overview, Customize Studio, Admin Dashboard, Analytics, and Embeds).
 *
 * @param {Object} props
 * @param {Object} props.event - The event object (containing name, title, bannerUrl, coverImage, themeColor, etc.)
 * @param {string} [props.aspect="square"] - "square" (1:1) | "video" (16:9) | "wide" (21:9) | "auto"
 * @param {string} [props.className=""] - Additional container classes
 * @param {boolean} [props.priority=false] - Eager image loading
 * @param {boolean} [props.showTitleOverlay=false] - Whether to show typography over custom uploaded banner image
 */
export function EventBanner({
  event,
  aspect = "square",
  className = "",
  priority = false,
  showTitleOverlay = false,
}) {
  const [imageError, setImageError] = useState(false);

  const rawImage =
    event?.bannerUrl ||
    event?.coverImage ||
    event?.posterUrl ||
    event?.imageUrl ||
    event?.image ||
    event?.thumbnail ||
    event?.banner ||
    null;

  useEffect(() => {
    setImageError(false);
  }, [rawImage]);

  // Ensure Unsplash images are never used per user instruction
  const isUnsplash =
    typeof rawImage === "string" &&
    (rawImage.includes("unsplash.com") || rawImage.includes("images.unsplash"));

  const validImage = !isUnsplash && typeof rawImage === "string" && rawImage.trim().length > 5 && !imageError;

  // Derive visual theme look with diverse fallback if not explicitly set
  const resolveFallbackTheme = () => {
    if (event?.themeColor || event?.themeHex) return event.themeColor || event.themeHex;
    if (event?.theme && event.theme !== "minimal") return event.theme;
    const cat = String(event?.category || "").toLowerCase();
    const title = String(event?.title || event?.name || "").toLowerCase();
    if (cat.includes("gaming") || title.includes("gaming") || title.includes("esport")) return "pink";
    if (cat.includes("tech") || title.includes("tech") || title.includes("dev") || title.includes("code")) return "blue";
    if (cat.includes("music") || cat.includes("concert") || title.includes("concert") || title.includes("mic")) return "yellow";
    if (title.includes("lab") || title.includes("workshop") || title.includes("bootcamp")) return "green";
    return "#FE760B";
  };

  const themeLook = getThemeLook(resolveFallbackTheme());

  const eventTitle = event?.title || event?.name || "Event";
  const posterLines = getPosterLines(
    eventTitle,
    event?.posterTextMode || "auto",
    event?.posterLine1,
    event?.posterLine2
  );

  const aspectClass =
    aspect === "square"
      ? "aspect-square"
      : aspect === "video" || aspect === "16/9"
      ? "aspect-[16/9]"
      : aspect === "wide"
      ? "aspect-[21/9]"
      : "";

  return (
    <div
      className={`w-full ${aspectClass} rounded-2xl overflow-hidden relative border border-slate-200 dark:border-[#2A2D31] transition-all select-none shadow-md flex flex-col justify-between ${className}`}
      style={{
        background: validImage ? "#131517" : themeLook.gradientCss,
      }}
    >
      {validImage ? (
        <>
          {/* Custom Uploaded Banner Image */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={rawImage}
            alt={eventTitle}
            loading={priority ? "eager" : "lazy"}
            onError={() => setImageError(true)}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-102"
          />

          {/* Optional Typography Overlay (only if explicitly enabled) */}
          {showTitleOverlay && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent p-4 sm:p-5 flex flex-col justify-end z-10">
              <h2 className="text-xl sm:text-2xl font-black tracking-tight leading-none uppercase text-white drop-shadow-md">
                {posterLines.line1}
                {posterLines.line2 && (
                  <>
                    <br />
                    <span className="text-[#FE760B]">{posterLines.line2}</span>
                  </>
                )}
              </h2>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Dynamic Theme Poster (Canonical Graphic Grid & Sun Sphere Aesthetic) */}
          {/* Glowing sun circle sphere in upper right */}
          <div
            className="w-40 h-40 rounded-full absolute -top-8 -right-8 pointer-events-none opacity-95 transition-colors"
            style={{ backgroundColor: themeLook.sun }}
          />

          {/* High-definition Grid Texture overlay */}
          <div
            className="absolute inset-0 pointer-events-none opacity-25"
            style={{
              backgroundImage: `linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)`,
              backgroundSize: "22px 22px",
            }}
          />

          {/* Top area spacer */}
          <div className="relative z-10" />

          {/* Bottom bold typographic block with padding avoiding right price pill */}
          <div className="relative z-10 p-4 sm:p-5 pr-16 sm:pr-20">
            <h2
              className="text-2xl sm:text-3xl font-black tracking-tight leading-[1.06] uppercase select-none drop-shadow-sm"
              style={{ color: themeLook.textColor || "#FFFFFF" }}
            >
              {posterLines.line1}
              {posterLines.line2 && (
                <>
                  <br />
                  <span>{posterLines.line2}</span>
                </>
              )}
            </h2>
          </div>
        </>
      )}
    </div>
  );
}

export default EventBanner;
