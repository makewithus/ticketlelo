"use client";

import { useState } from "react";
import {
  Link as LinkIcon,
  Palette,
  ImageIcon,
  CheckCircle,
  AlertCircle,
  Loader2,
  Copy,
  Check,
  ExternalLink,
  X,
  Ticket,
} from "lucide-react";
import { getThemeLook } from "@/lib/theme-utils";
import { getPosterLines } from "@/components/admin/event-create-studio";
import { getPublicBaseUrl, getCleanDomain } from "@/lib/app-url";

const PRESET_COLORS = [
  { hex: "#FE760B", name: "Ticket Orange" },
  { hex: "#FDE003", name: "Sunny Yellow" },
  { hex: "#3DD68C", name: "Success Green" },
  { hex: "#7AA2FF", name: "Electric Blue" },
  { hex: "#FF6B6B", name: "Coral Red" },
  { hex: "#A855F7", name: "Purple" },
  { hex: "#EC4899", name: "Pink" },
  { hex: "#000000", name: "Black" },
];

export default function EventCustomization({
  eventId,
  userId,
  event,
  onUpdate,
}) {
  const [slug, setSlug] = useState(event?.slug || "");
  const [themeColor, setThemeColor] = useState(event?.themeColor || "#FE760B");
  const [ticketDesign, setTicketDesign] = useState(event?.ticketDesign || "stub");
  const [bannerFile, setBannerFile] = useState(null);
  const [bannerPreview, setBannerPreview] = useState(event?.bannerUrl || null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState(event?.slug ? true : null);
  const [checkingSlug, setCheckingSlug] = useState(false);

  const domain = getCleanDomain(getPublicBaseUrl());
  const eventUrl = slug ? `${getPublicBaseUrl()}/${slug}` : null;

  const generateSlug = () => {
    if (!event?.name) return;
    const generated = event.name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 50);
    setSlug(generated);
    setSlugAvailable(null);
  };

  const checkSlugAvailability = async (value) => {
    if (!value || value.length < 3) {
      setSlugAvailable(null);
      return;
    }
    setCheckingSlug(true);
    try {
      const res = await fetch(
        `/api/events/customize?slug=${encodeURIComponent(value)}`,
      );
      const data = await res.json();

      if (data.success && data.event?.id === eventId) {
        setSlugAvailable(true);
      } else if (data.success) {
        setSlugAvailable(false);
      } else {
        setSlugAvailable(true);
      }
    } catch {
      setSlugAvailable(null);
    } finally {
      setCheckingSlug(false);
    }
  };

  const handleSlugChange = (value) => {
    const clean = value.toLowerCase().replace(/[^a-z0-9-]/g, "");
    setSlug(clean);
    setSlugAvailable(null);
  };

  const handleBannerChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError("Banner image must be under 5MB");
      return;
    }

    setBannerFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setBannerPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const copyUrl = async () => {
    if (!eventUrl) return;
    try {
      await navigator.clipboard.writeText(eventUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const formData = new FormData();
      formData.append("eventId", eventId);
      if (userId) formData.append("userId", userId);
      formData.append("slug", slug);
      formData.append("themeColor", themeColor);
      formData.append("ticketDesign", ticketDesign);
      if (bannerFile) formData.append("banner", bannerFile);

      const res = await fetch("/api/events/customize", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save customization");

      setSuccess("Event page customization saved successfully");
      onUpdate?.(data.event);
    } catch (err) {
      setError(err.message || "Failed to save");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">
          Event page
        </h2>
        <p className="text-sm text-[#9B9EA4] mt-1">
          Customize how your event appears to participants
        </p>
      </div>

      {success && (
        <div className="flex items-start gap-3 p-4 bg-[#3DD68C]/12 border border-[#3DD68C]/25 rounded-xl">
          <CheckCircle
            size={18}
            className="text-[#3DD68C] flex-shrink-0 mt-0.5"
          />
          <p className="text-sm text-[#3DD68C]">{success}</p>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 p-4 bg-[#FF6B6B]/12 border border-[#FF6B6B]/25 rounded-xl">
          <AlertCircle
            size={18}
            className="text-[#FF6B6B] flex-shrink-0 mt-0.5"
          />
          <p className="text-sm text-[#FF9A9A]">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ===== Custom URL Slug ===== */}
        <div className="bg-[#1A1C1F] rounded-2xl border border-[#2A2D31] shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 bg-[#212327] border border-[#2A2D31] rounded-xl flex items-center justify-center">
              <LinkIcon size={18} className="text-[#FE760B]" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Custom URL</h3>
              <p className="text-xs text-[#9B9EA4]">
                Create a memorable link for your event
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="relative">
              <div className="flex rounded-xl overflow-hidden border border-[#2A2D31] bg-[#212327] focus-within:border-[#FE760B] focus-within:ring-1 focus-within:ring-[#FE760B] transition-all">
                <span className="flex items-center px-3.5 bg-[#2A2D31] text-[#9B9EA4] text-xs font-mono border-r border-[#2A2D31] whitespace-nowrap">
                  {domain}/
                </span>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  onBlur={() => slug && checkSlugAvailability(slug)}
                  placeholder="my-awesome-event"
                  className="flex-1 px-3 py-2.5 text-sm outline-none bg-transparent text-white placeholder-[#9B9EA4]"
                  maxLength={60}
                />
                {checkingSlug && (
                  <span className="flex items-center pr-3">
                    <Loader2 size={14} className="animate-spin text-[#9B9EA4]" />
                  </span>
                )}
                {!checkingSlug && slugAvailable === true && (
                  <span className="flex items-center pr-3 text-[#3DD68C]">
                    <CheckCircle size={16} />
                  </span>
                )}
                {!checkingSlug && slugAvailable === false && (
                  <span className="flex items-center pr-3 text-[#FF6B6B]">
                    <AlertCircle size={16} />
                  </span>
                )}
              </div>
            </div>

            {slugAvailable === false && (
              <p className="text-xs text-[#FF9A9A] flex items-center gap-1">
                <AlertCircle size={12} />
                This URL is already taken
              </p>
            )}
            {slugAvailable === true && (
              <p className="text-xs text-[#3DD68C] flex items-center gap-1">
                <CheckCircle size={12} />
                URL is available!
              </p>
            )}

            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={generateSlug}
                className="px-3 py-1.5 text-xs bg-[#212327] text-[#D0D0D1] border border-[#2A2D31] rounded-lg hover:bg-[#2A2D31] hover:text-white transition-colors"
              >
                Auto-generate from name
              </button>
            </div>

            {eventUrl && (
              <div className="flex items-center gap-2 p-3 bg-[#212327] rounded-xl border border-[#2A2D31]">
                <span className="text-xs text-[#FE760B] flex-1 truncate font-mono">
                  {eventUrl}
                </span>
                <button
                  type="button"
                  onClick={copyUrl}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1A1C1F] border border-[#2A2D31] rounded-lg text-xs text-[#D0D0D1] hover:text-white transition-colors flex-shrink-0"
                >
                  {copied ? (
                    <>
                      <Check size={12} className="text-[#3DD68C]" /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy size={12} /> Copy
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ===== Theme Color ===== */}
        <div className="bg-[#1A1C1F] rounded-2xl border border-[#2A2D31] shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 bg-[#212327] border border-[#2A2D31] rounded-xl flex items-center justify-center">
              <Palette size={18} className="text-[#FE760B]" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Theme color</h3>
              <p className="text-xs text-[#9B9EA4]">
                Choose your brand color for the event page
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Preset Colors */}
            <div className="flex flex-wrap gap-2.5">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setThemeColor(c.hex)}
                  title={c.name}
                  className={`w-9 h-9 rounded-xl flex-shrink-0 transition-all ${
                    themeColor.toLowerCase() === c.hex.toLowerCase()
                      ? "ring-2 ring-offset-2 ring-white ring-offset-[#1A1C1F] scale-110"
                      : "hover:scale-105 opacity-80 hover:opacity-100"
                  } ${c.hex === "#000000" ? "border border-[#2A2D31]" : ""}`}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>

            {/* Custom Color Picker */}
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="color"
                  value={themeColor}
                  onChange={(e) => setThemeColor(e.target.value)}
                  className="w-9 h-9 rounded-xl cursor-pointer border border-[#2A2D31] bg-transparent p-0.5"
                />
                <span className="text-sm text-[#D0D0D1]">Custom color</span>
              </label>
              <code className="text-xs font-mono text-[#D0D0D1] bg-[#212327] border border-[#2A2D31] px-2.5 py-1 rounded-lg">
                {themeColor.toUpperCase()}
              </code>
            </div>

            {/* Preview */}
            <div
              className="h-11 rounded-xl flex items-center justify-center text-[#131517] font-semibold text-sm transition-colors shadow-sm"
              style={{ backgroundColor: themeColor }}
            >
              Preview: Register Now
            </div>
          </div>
        </div>

        {/* ===== Banner Upload ===== */}
        <div className="bg-[#1A1C1F] rounded-2xl border border-[#2A2D31] shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 bg-[#212327] border border-[#2A2D31] rounded-xl flex items-center justify-center">
              <ImageIcon size={18} className="text-[#FE760B]" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Event banner</h3>
              <p className="text-xs text-[#9B9EA4]">
                Upload a banner image (max 5MB, JPEG/PNG/WebP)
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Live Real-Time Banner Preview */}
            {(() => {
              const liveLook = getThemeLook(themeColor);
              const liveLines = getPosterLines(event?.name || slug || "Tech Fest '26");
              return (
                <div
                  className="w-full aspect-[16/7] max-h-52 rounded-xl overflow-hidden relative border border-[#2A2D31] flex items-center justify-center shadow-inner transition-all duration-300 group"
                  style={{
                    background: bannerPreview ? "transparent" : liveLook.gradientCss,
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
                        onClick={() => {
                          setBannerFile(null);
                          setBannerPreview(null);
                        }}
                        className="absolute top-2 right-2 w-7 h-7 bg-black/75 hover:bg-black text-white rounded-full flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 text-xs border border-white/20 shadow-md cursor-pointer"
                        aria-label="Remove banner image"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div
                        className="w-48 h-48 rounded-full absolute -top-12 -right-12 pointer-events-none opacity-90 transition-colors duration-300"
                        style={{ backgroundColor: liveLook.sun }}
                      />
                      <div
                        className="absolute inset-0 pointer-events-none opacity-20"
                        style={{
                          backgroundImage:
                            "linear-gradient(#000 1.5px, transparent 1.5px), linear-gradient(90deg, #000 1.5px, transparent 1.5px)",
                          backgroundSize: "20px 20px",
                        }}
                      />
                      <div className="relative z-10 w-full h-full p-4 flex flex-col justify-end select-none">
                        <span
                          className="block font-black text-xl leading-[0.92] tracking-tight uppercase break-words drop-shadow-sm transition-colors duration-300"
                          style={{ color: liveLook.textColor || "#FFFFFF" }}
                        >
                          {liveLines.line1}
                        </span>
                        {liveLines.line2 && (
                          <span
                            className="block font-black text-lg leading-[0.92] tracking-tight uppercase break-words drop-shadow-sm transition-colors duration-300 mt-1"
                            style={{ color: liveLook.textColor || "#FFFFFF" }}
                          >
                            {liveLines.line2}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })()}

            {/* Upload or replace banner file input */}
            <label className="flex items-center justify-center gap-2 p-3 border border-dashed border-[#2A2D31] hover:border-[#FE760B] rounded-xl cursor-pointer bg-[#212327]/40 hover:bg-[#212327] transition-all group">
              <ImageIcon
                size={18}
                className="text-[#9B9EA4] group-hover:text-[#FE760B] transition-colors"
              />
              <span className="text-xs font-semibold text-white group-hover:text-[#FE760B] transition-colors">
                {bannerPreview ? "Replace custom banner image" : "Upload custom banner image (Optional)"}
              </span>
              <span className="text-[11px] text-[#9B9EA4]">· JPEG, PNG, WebP up to 5MB</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleBannerChange}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* ===== Ticket Layout Template (Stub vs Wide) ===== */}
        <div className="bg-[#1A1C1F] rounded-2xl border border-[#2A2D31] shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 bg-[#212327] border border-[#2A2D31] rounded-xl flex items-center justify-center">
              <Ticket size={18} className="text-[#FE760B]" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Ticket Template</h3>
              <p className="text-xs text-[#9B9EA4]">
                Choose how passes are designed for attendees. Editable anytime.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Stub tickets */}
            <button
              type="button"
              onClick={() => setTicketDesign("stub")}
              className={`p-4 rounded-xl border text-left transition-all cursor-pointer relative ${
                ticketDesign === "stub"
                  ? "border-[#FE760B] bg-[#FE760B]/10 ring-1 ring-[#FE760B]"
                  : "border-[#2A2D31] bg-[#212327] hover:border-[#3A3D42]"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#FE760B]" />
                  Stub tickets (Default)
                </span>
                {ticketDesign === "stub" && (
                  <Check className="w-4 h-4 text-[#FE760B]" />
                )}
              </div>
              <p className="text-[11px] text-[#9B9EA4] leading-relaxed">
                Standard horizontal pass with right QR check-in stub.
              </p>
              <div className="mt-2.5 h-6 rounded-md border border-[#2A2D31] flex overflow-hidden bg-black/40 text-[8px] font-mono">
                <div className="flex-1 bg-[#FE760B]/80 flex items-center justify-center text-black font-extrabold">ART</div>
                <div className="w-8 bg-[#201207] border-l border-dashed border-white/30 flex items-center justify-center text-[#FDE003] font-bold">QR</div>
              </div>
            </button>

            {/* Wide tickets */}
            <button
              type="button"
              onClick={() => setTicketDesign("wide")}
              className={`p-4 rounded-xl border text-left transition-all cursor-pointer relative ${
                ticketDesign === "wide"
                  ? "border-[#FE760B] bg-[#FE760B]/10 ring-1 ring-[#FE760B]"
                  : "border-[#2A2D31] bg-[#212327] hover:border-[#3A3D42]"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#3DD68C]" />
                  Wide tickets
                </span>
                {ticketDesign === "wide" && (
                  <Check className="w-4 h-4 text-[#FE760B]" />
                )}
              </div>
              <p className="text-[11px] text-[#9B9EA4] leading-relaxed">
                3-panel pass with art center, QR and vertical barcode stub.
              </p>
              <div className="mt-2.5 h-6 rounded-md border border-[#2A2D31] flex overflow-hidden bg-black/40 text-[8px] font-mono">
                <div className="w-7 bg-white text-black font-bold flex items-center justify-center">QR</div>
                <div className="flex-1 bg-[#FE760B]/80 flex items-center justify-center text-black font-extrabold border-x border-dashed border-black/30">ART</div>
                <div className="w-7 bg-white text-black font-bold flex items-center justify-center">||||</div>
              </div>
            </button>
          </div>
        </div>

        {/* Save Button (High contrast dark text on #FE760B) */}
        <button
          type="submit"
          disabled={loading || (slug && slugAvailable === false)}
          className="w-full py-3.5 bg-[#FE760B] hover:bg-[#FE760B]/90 text-[#131517] font-semibold text-sm rounded-xl disabled:opacity-50 transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin text-[#131517]" />
              Saving changes...
            </>
          ) : (
            "Save event customization"
          )}
        </button>
      </form>
    </div>
  );
}
