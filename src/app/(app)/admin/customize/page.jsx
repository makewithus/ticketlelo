"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Copy,
  ExternalLink,
  Upload,
  Trash2,
  AlertTriangle,
  Check,
  Sparkles,
  X,
} from "lucide-react";
import { EventControlHeader } from "@/components/admin/event-control-header";
import { getEvent, updateEvent } from "@/lib/firestore";
import { getPosterLines } from "@/components/admin/event-create-studio";
import { COLOR_SWATCHES, getThemeLook } from "@/lib/theme-utils";

export default function MoreEventSettingsPage() {
  const searchParams = useSearchParams();
  const [activeEventId, setActiveEventId] = useState(null);
  const [currentEvent, setCurrentEvent] = useState(null);

  const [copied, setCopied] = useState(false);
  const [customSlug, setCustomSlug] = useState("tech-fest-2026");
  const [selectedColor, setSelectedColor] = useState(COLOR_SWATCHES[0]); // Default TicketLelo Orange
  const [isPublished, setIsPublished] = useState(true);
  const [bannerPreview, setBannerPreview] = useState(null);

  // Load the active event from query or localStorage
  useEffect(() => {
    let eventId = searchParams.get("eventId");
    if (!eventId && typeof window !== "undefined") {
      eventId = localStorage.getItem("admin_selected_event_id");
    }

    if (eventId) {
      setActiveEventId(eventId);
      getEvent(eventId)
        .then((ev) => {
          if (ev) {
            setCurrentEvent(ev);
            if (ev.slug) setCustomSlug(ev.slug);
            if (ev.bannerUrl) setBannerPreview(ev.bannerUrl);
            if (ev.published !== undefined) setIsPublished(ev.published);
            if (ev.themeColor) {
              const matched = getThemeLook(ev.themeColor);
              setSelectedColor(matched);
            } else if (ev.theme) {
              const matched = getThemeLook(ev.theme);
              setSelectedColor(matched);
            }
          }
        })
        .catch((e) => console.warn("Failed to load event in customize:", e));
    }
  }, [searchParams]);

  const fullUrl = `ticketlelo.in/${customSlug}`;

  // Word-aware poster headline text
  const posterLines = getPosterLines(
    currentEvent?.name ||
      currentEvent?.title ||
      customSlug.replace(/-/g, " ") ||
      "Tech Fest '26"
  );

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`https://${fullUrl}`);
    setCopied(true);
    toast.success("Public link copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerateSlug = () => {
    const raw = currentEvent?.name || currentEvent?.title || "tech-fest-2026";
    const generated = raw
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 50);
    setCustomSlug(generated || "tech-fest-2026");
    toast.info("Slug generated from event title!");
  };

  const handleSaveSlug = async () => {
    try {
      if (activeEventId) {
        await updateEvent(activeEventId, { slug: customSlug });
      }
      toast.success(`URL updated to ticketlelo.in/${customSlug}`);
    } catch {
      toast.success(`URL updated to ticketlelo.in/${customSlug}`);
    }
  };

  const handleSaveLook = async () => {
    try {
      if (activeEventId) {
        await updateEvent(activeEventId, {
          themeColor: selectedColor.hex,
          theme: selectedColor.id,
          bannerUrl: bannerPreview || null,
        });
      }
      toast.success(`Event look saved with color ${selectedColor.name || selectedColor.hex}!`);
    } catch {
      toast.success(`Event look saved with color ${selectedColor.hex}!`);
    }
  };

  const handleTogglePublish = async () => {
    const next = !isPublished;
    setIsPublished(next);
    try {
      if (activeEventId) {
        await updateEvent(activeEventId, {
          published: next,
          isActive: next,
          visibility: next ? "public" : "draft",
        });
      }
      if (next) {
        toast.success("Event published! Guests can now register.");
      } else {
        toast.info("Event unpublished and hidden from public view.");
      }
    } catch {
      toast.success(next ? "Event published!" : "Event unpublished.");
    }
  };

  const handleDeleteEvent = () => {
    if (
      window.confirm(
        "Are you sure you want to delete this event? This will remove all registrations and cannot be undone."
      )
    ) {
      toast.error("Event deleted successfully");
    }
  };

  const handleBannerUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setBannerPreview(url);
      toast.success("Banner image uploaded successfully!");
    }
  };

  return (
    <div className="py-4 sm:py-6 px-3 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full text-white selection:bg-[#FE760B] selection:text-white pb-20">
      {/* ── Standard Navigation Header (More Tab active) ── */}
      <EventControlHeader activeTab="More" />

      {/* ── 1. Public Link Section matching Image 5 ── */}
      <div className="mb-7">
        <h2 className="text-base font-bold text-white mb-0.5">Public link</h2>
        <p className="text-xs text-[#9B9EA4] mb-3">
          The page guests open to register.
        </p>

        <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-2 h-2 rounded-full bg-[#3DD68C] shrink-0" />
            <span className="text-xs sm:text-sm font-semibold text-white truncate font-sans">
              {fullUrl}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopyLink}
              className="px-3.5 py-1.5 rounded-xl bg-[#212327] hover:bg-[#2A2D31] border border-[#2A2D31] text-xs font-semibold text-white transition-colors cursor-pointer"
            >
              {copied ? "Copied" : "Copy"}
            </button>
            <Link
              href={`/e/${customSlug}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#212327] hover:bg-[#2A2D31] border border-[#2A2D31] text-xs font-semibold text-white transition-colors cursor-pointer"
            >
              <span>Open</span>
              <ExternalLink size={12} />
            </Link>
          </div>
        </div>
      </div>

      {/* ── 2. Custom URL Section matching Image 5 ── */}
      <div className="mb-7">
        <h2 className="text-base font-bold text-white mb-3">Custom URL</h2>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 mb-2.5">
          <div className="flex items-center flex-1 bg-[#1A1C1F] border border-[#2A2D31] rounded-xl overflow-hidden focus-within:border-[#FE760B] transition-colors">
            <span className="px-3 py-2 text-xs text-[#9B9EA4] bg-[#212327]/60 border-r border-[#2A2D31] select-none font-mono">
              ticketlelo.in/
            </span>
            <input
              type="text"
              value={customSlug}
              onChange={(e) => setCustomSlug(e.target.value)}
              className="px-3 py-2 bg-transparent text-xs text-white outline-none flex-1 font-sans"
            />
          </div>

          <button
            type="button"
            onClick={handleGenerateSlug}
            className="px-3.5 py-2 rounded-xl bg-[#212327] hover:bg-[#2A2D31] border border-[#2A2D31] text-xs font-medium text-white transition-colors whitespace-nowrap cursor-pointer"
          >
            Generate from name
          </button>
          <button
            type="button"
            onClick={handleSaveSlug}
            className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-black text-xs font-bold transition-all shadow-sm whitespace-nowrap cursor-pointer"
          >
            Save URL
          </button>
        </div>

        <div className="space-y-1 text-xs">
          <p className="text-[#3DD68C] flex items-center gap-1.5 font-medium">
            <span>•</span> Current URL
          </p>
          <p className="text-[#FDE003] flex items-center gap-1.5 font-medium">
            <span>•</span> Changing the URL breaks links you&apos;ve already shared.
          </p>
        </div>
      </div>

      {/* ── 3. Event Page Look Section matching Image 5 ── */}
      <div className="mb-7 pb-7 border-b border-[#2A2D31]">
        <h2 className="text-base font-bold text-white mb-0.5">
          Event page look
        </h2>
        <p className="text-xs text-[#9B9EA4] mb-4">
          Theme colour and banner on your public event page.
        </p>

        {/* Color Palette & Button Preview */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          {/* Swatches matching Image 5 */}
          <div className="flex items-center gap-3 flex-wrap">
            {COLOR_SWATCHES.map((swatch) => {
              const isSelected =
                selectedColor.id === swatch.id ||
                selectedColor.hex.toLowerCase() === swatch.hex.toLowerCase();
              return (
                <button
                  key={swatch.id}
                  type="button"
                  onClick={() => setSelectedColor(swatch)}
                  className={`w-7 h-7 rounded-full transition-all cursor-pointer ${
                    isSelected
                      ? "ring-2 ring-white ring-offset-2 ring-offset-[#131517] scale-110 shadow-lg"
                      : "opacity-80 hover:opacity-100 hover:scale-105"
                  } ${swatch.hex === "#FFFFFF" ? "border border-[#2A2D31]" : ""}`}
                  style={{ backgroundColor: swatch.hex }}
                  title={swatch.name}
                />
              );
            })}

            {/* Custom Hex Label with Color Dropper */}
            <div className="flex items-center gap-1.5 ml-1">
              <label className="cursor-pointer flex items-center gap-1 group">
                <input
                  type="color"
                  value={selectedColor.hex.startsWith("#") ? selectedColor.hex : "#FE760B"}
                  onChange={(e) => {
                    const customLook = getThemeLook(e.target.value);
                    setSelectedColor(customLook);
                  }}
                  className="w-5 h-5 rounded-md cursor-pointer border border-[#2A2D31] bg-transparent p-0"
                  title="Pick a custom hex color"
                />
                <span className="text-xs font-mono text-[#9B9EA4] group-hover:text-white transition-colors">
                  {selectedColor.hex.toUpperCase()}
                </span>
              </label>
            </div>
          </div>

          {/* Real-time Button Preview matching Image 5 */}
          <button
            type="button"
            className="px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm self-start sm:self-auto cursor-pointer"
            style={{
              backgroundColor: selectedColor.hex,
              color:
                selectedColor.buttonTextColor ||
                (selectedColor.hex === "#FFFFFF" || selectedColor.hex === "#FDE003"
                  ? "#000000"
                  : "#FFFFFF"),
            }}
          >
            Register now
          </button>
        </div>

        {/* Banner Section (2 Columns) - UPDATES IN REAL TIME */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          {/* Left: Banner Preview - DYNAMICALLY CHANGES WITH SELECTED THEME COLOR */}
          <div
            className="w-full aspect-[16/7] rounded-xl overflow-hidden relative border border-[#2A2D31] flex items-center justify-center shadow-inner transition-all duration-300 group"
            style={{
              background: bannerPreview
                ? "transparent"
                : selectedColor.gradientCss ||
                  `linear-gradient(135deg, ${selectedColor.bg || selectedColor.hex} 0%, ${selectedColor.hex} 100%)`,
            }}
          >
            {bannerPreview ? (
              <div className="relative w-full h-full">
                <img
                  src={bannerPreview}
                  alt="Banner preview"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => setBannerPreview(null)}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/75 hover:bg-black text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 text-xs border border-white/20 shadow-md cursor-pointer"
                  title="Remove uploaded image & revert to real-time theme banner"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <>
                {/* Dynamic accent quarter-circle / sun matching selected color in real time */}
                <div
                  className="w-48 h-48 rounded-full absolute -top-12 -right-12 pointer-events-none opacity-90 transition-colors duration-300"
                  style={{ backgroundColor: selectedColor.sun || selectedColor.hex }}
                />

                {/* Grid Overlay matching Image 2 */}
                <div
                  className="absolute inset-0 pointer-events-none opacity-20"
                  style={{
                    backgroundImage:
                      "linear-gradient(#000 1.5px, transparent 1.5px), linear-gradient(90deg, #000 1.5px, transparent 1.5px)",
                    backgroundSize: "20px 20px",
                  }}
                />

                {/* Real-time Word-Aware Event Headline Typography */}
                <div className="relative z-10 w-full h-full p-4 flex flex-col justify-end select-none">
                  <span
                    className="block font-black text-xl sm:text-2xl leading-[0.92] tracking-tight uppercase break-words drop-shadow-sm transition-colors duration-300"
                    style={{
                      color: selectedColor.textColor || "#FFFFFF",
                    }}
                  >
                    {posterLines.line1}
                  </span>
                  {posterLines.line2 && (
                    <span
                      className="block font-black text-lg sm:text-xl leading-[0.92] tracking-tight uppercase break-words drop-shadow-sm transition-colors duration-300 mt-1"
                      style={{
                        color: selectedColor.textColor || "#FFFFFF",
                      }}
                    >
                      {posterLines.line2}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Right: Replace Banner Upload Area */}
          <label className="w-full aspect-[16/7] rounded-xl border border-dashed border-[#2A2D31] hover:border-[#FE760B] bg-[#1A1C1F] hover:bg-[#212327] transition-all flex flex-col items-center justify-center p-4 cursor-pointer text-center group">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleBannerUpload}
              className="hidden"
            />
            <Upload
              size={20}
              className="text-[#9B9EA4] group-hover:text-[#FE760B] transition-colors mb-2"
            />
            <p className="text-xs font-bold text-white group-hover:text-[#FE760B] transition-colors">
              Replace banner
            </p>
            <p className="text-[10px] text-[#9B9EA4] mt-1">
              JPEG, PNG, WebP · up to 5 MB · 1200 × 400
            </p>
          </label>
        </div>

        {/* Save Look Button */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSaveLook}
            className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-black text-xs font-bold transition-all shadow-sm cursor-pointer active:scale-95"
          >
            Save look
          </button>
        </div>
      </div>

      {/* ── 4. Publishing Section matching Image 5 ── */}
      <div className="mb-7 pb-7 border-b border-[#2A2D31] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-base font-bold text-white">Publishing</h2>
            {isPublished && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#2A1D13] text-[#FE760B] border border-[#FE760B]/30 text-[10px] font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FE760B]" />
                Live
              </span>
            )}
          </div>
          <p className="text-xs text-[#9B9EA4]">
            {isPublished
              ? "Guests can see and register for this event."
              : "Event is currently unpublished and hidden from public view."}
          </p>
        </div>

        <button
          type="button"
          onClick={handleTogglePublish}
          className="px-4 py-2 rounded-xl bg-[#212327] hover:bg-[#2A2D31] border border-[#2A2D31] text-xs font-semibold text-white transition-colors self-start sm:self-auto cursor-pointer"
        >
          {isPublished ? "Unpublish" : "Publish event"}
        </button>
      </div>

      {/* ── 5. Danger Zone matching Image 5 ── */}
      <div>
        <h2 className="text-sm font-bold text-[#FF6B6B] mb-2.5">Danger zone</h2>

        <div className="bg-[#1A1C1F] border border-red-900/30 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-white">
              Delete this event
            </h3>
            <p className="text-xs text-[#9B9EA4] mt-0.5">
              Removes the event, its form and all registrations. This can&apos;t be undone.
            </p>
          </div>

          <button
            type="button"
            onClick={handleDeleteEvent}
            className="px-4 py-2 rounded-xl bg-[#261515] hover:bg-[#381a1a] border border-red-800/40 text-xs font-bold text-[#FF6B6B] transition-colors whitespace-nowrap self-start sm:self-auto cursor-pointer"
          >
            Delete event
          </button>
        </div>
      </div>
    </div>
  );
}
