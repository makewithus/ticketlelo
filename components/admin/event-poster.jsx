"use client";

import React from "react";

export function EventPoster({ event, className = "" }) {
  if (event?.coverImage || event?.image) {
    return (
      <div className={`relative rounded-xl overflow-hidden shrink-0 border border-[#2A2D31] bg-[#1A1C1F] ${className}`}>
        <img
          src={event.coverImage || event.image}
          alt={event.name || "Event cover"}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  const name = (event?.name || "").toLowerCase();
  const theme = (event?.theme || "").toLowerCase();

  const themeMap = {
    sunny: { bg: "#FE760B", sun: "#FDE003", text: "#131517" },
    sunset: { bg: "#EA580C", sun: "#FB923C", text: "#FFFFFF" },
    electric: { bg: "#1D4ED8", sun: "#38BDF8", text: "#FFFFFF" },
    neon: { bg: "#BE185D", sun: "#F43F5E", text: "#FFFFFF" },
    mint: { bg: "#047857", sun: "#34D399", text: "#FFFFFF" },
  };

  if (themeMap[theme]) {
    const t = themeMap[theme];
    return (
      <div
        className={`relative rounded-xl overflow-hidden shrink-0 flex flex-col justify-between p-3 select-none border border-[#2A2D31] shadow-inner ${className}`}
        style={{ backgroundColor: t.bg }}
      >
        <div
          className="absolute -top-4 -right-4 w-16 h-16 rounded-full"
          style={{ backgroundColor: t.sun }}
        />
        <div
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)",
            backgroundSize: "12px 12px",
          }}
        />
        <div className="relative z-10" />
        <div className="relative z-10 text-left">
          <span
            className="block font-black text-xs leading-tight tracking-tight uppercase line-clamp-2"
            style={{ color: t.text }}
          >
            {event?.name || "EVENT"}
          </span>
        </div>
      </div>
    );
  }

  // Tech Fest Artwork (Yellow/Orange sun + grid)
  if (name.includes("tech") || name.includes("fest")) {
    return (
      <div
        className={`relative rounded-xl overflow-hidden shrink-0 bg-[#E65C00] flex flex-col justify-between p-3 select-none border border-[#2A2D31] shadow-inner ${className}`}
      >
        {/* Sun circle */}
        <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full bg-[#FDE003]" />
        {/* Grid lines */}
        <div
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)",
            backgroundSize: "12px 12px",
          }}
        />
        <div className="relative z-10" />
        <div className="relative z-10 text-left">
          <span className="block font-black text-sm leading-tight text-[#131517] tracking-tight">
            TECH
          </span>
          <span className="block font-black text-xs leading-none text-[#131517] tracking-wider">
            FEST &apos;26
          </span>
        </div>
      </div>
    );
  }

  // Praroha Gaming Artwork (Cyan + Magenta diagonal stripes)
  if (name.includes("praroha") || name.includes("gaming") || name.includes("game")) {
    return (
      <div
        className={`relative rounded-xl overflow-hidden shrink-0 bg-[#0F1115] flex flex-col justify-between p-3 select-none border border-[#2A2D31] shadow-inner ${className}`}
      >
        {/* Diagonal stripes */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -right-8 top-10 w-40 h-3 bg-[#06B6D4] rotate-[-22deg]" />
          <div className="absolute -right-8 top-16 w-40 h-6 bg-[#EC4899] rotate-[-22deg]" />
        </div>
        <div className="relative z-10 text-left">
          <span className="block font-black text-xs leading-tight text-white tracking-wide">
            PRAROHA
          </span>
          <span className="block font-black text-sm leading-tight text-[#FDE003] tracking-wider">
            GAMING
          </span>
        </div>
        <div className="relative z-10" />
      </div>
    );
  }

  // Hackathon Kickoff Artwork (Yellow background with black { } and text)
  if (name.includes("hack") || name.includes("kickoff") || name.includes("code")) {
    return (
      <div
        className={`relative rounded-xl overflow-hidden shrink-0 bg-[#FDE003] flex flex-col justify-between p-3 select-none border border-[#2A2D31] shadow-inner ${className}`}
      >
        <div className="text-black font-mono font-black text-2xl leading-none pt-1">
          &#123; &#125;
        </div>
        <div className="text-left">
          <span className="block font-black text-xs leading-tight text-black tracking-tight">
            HACK
          </span>
          <span className="block font-bold text-[10px] leading-none text-black tracking-wider">
            KICKOFF
          </span>
        </div>
      </div>
    );
  }

  // Open Mic Night Artwork (Deep blue background with concentric orange sound circles)
  if (name.includes("mic") || name.includes("open") || name.includes("music") || name.includes("sprint")) {
    return (
      <div
        className={`relative rounded-xl overflow-hidden shrink-0 bg-[#1D4ED8] flex flex-col justify-between p-3 select-none border border-[#2A2D31] shadow-inner ${className}`}
      >
        {/* Concentric circles */}
        <div className="absolute top-1 right-2 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-blue-400/20 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-blue-300/30 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full bg-[#FE760B] flex items-center justify-center">
                <div className="w-4 h-4 rounded-full bg-[#FDE003]" />
              </div>
            </div>
          </div>
        </div>
        <div className="relative z-10" />
        <div className="relative z-10 text-left">
          <span className="block font-black text-xs leading-tight text-white tracking-wide">
            OPEN
          </span>
          <span className="block font-bold text-[10px] leading-none text-white/90 tracking-wider">
            MIC NIGHT
          </span>
        </div>
      </div>
    );
  }

  // Robotics Expo Artwork (Dark green background with neon wireframe tunnel)
  if (name.includes("robot") || name.includes("expo") || name.includes("ai")) {
    return (
      <div
        className={`relative rounded-xl overflow-hidden shrink-0 bg-[#06331E] flex flex-col justify-between p-3 select-none border border-[#2A2D31] shadow-inner ${className}`}
      >
        {/* Wireframe tunnel */}
        <div className="absolute top-2 right-2 w-14 h-12 border border-[#3DD68C]/50 rounded p-1 flex items-center justify-center">
          <div className="w-10 h-8 border border-[#3DD68C]/60 rounded p-1 flex items-center justify-center">
            <div className="w-6 h-5 border border-[#3DD68C] rounded" />
          </div>
        </div>
        <div className="relative z-10" />
        <div className="relative z-10 text-left">
          <span className="block font-black text-xs leading-tight text-white tracking-wide">
            ROBOTICS
          </span>
          <span className="block font-bold text-[10px] leading-none text-[#3DD68C] tracking-wider">
            EXPO
          </span>
        </div>
      </div>
    );
  }

  // Fallback brand graphic
  return (
    <div
      className={`relative rounded-xl overflow-hidden shrink-0 bg-[#1A1C1F] flex flex-col justify-between p-3 select-none border border-[#2A2D31] shadow-inner ${className}`}
    >
      <div className="w-6 h-6 rounded-lg bg-[#FE760B]/14 text-[#FE760B] flex items-center justify-center font-bold text-xs">
        TL
      </div>
      <div className="text-left">
        <span className="block font-bold text-xs leading-tight text-white line-clamp-2">
          {event?.name || "Event"}
        </span>
      </div>
    </div>
  );
}
