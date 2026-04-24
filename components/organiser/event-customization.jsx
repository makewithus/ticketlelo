"use client";

import { useState } from "react";
import {
  Link,
  Palette,
  ImageIcon,
  CheckCircle,
  AlertCircle,
  Loader2,
  Copy,
  Check,
  ExternalLink,
} from "lucide-react";

const PRESET_COLORS = [
  { hex: "#FF6A00", name: "Orange" },
  { hex: "#FFD60A", name: "Yellow" },
  { hex: "#3b82f6", name: "Blue" },
  { hex: "#22c55e", name: "Green" },
  { hex: "#a855f7", name: "Purple" },
  { hex: "#ef4444", name: "Red" },
  { hex: "#ec4899", name: "Pink" },
  { hex: "#000000", name: "Black" },
];

export default function EventCustomization({
  eventId,
  userId,
  event,
  onUpdate,
}) {
  const [slug, setSlug] = useState(event?.slug || "");
  const [themeColor, setThemeColor] = useState(event?.themeColor || "#FF6A00");
  const [bannerFile, setBannerFile] = useState(null);
  const [bannerPreview, setBannerPreview] = useState(event?.bannerUrl || null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState(event?.slug ? true : null);
  const [checkingSlug, setCheckingSlug] = useState(false);

  const eventUrl = slug ? `https://ticketlelo.in/${slug}` : null;

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

      // If event found but it's our own event, it's available
      if (data.success && data.event?.id === eventId) {
        setSlugAvailable(true);
      } else if (data.success) {
        setSlugAvailable(false); // Taken by another event
      } else {
        setSlugAvailable(true); // Not found = available
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
    reader.onload = (e) => setBannerPreview(e.target?.result);
    reader.readAsDataURL(file);
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (slug && slug.length < 3) {
      return setError("Slug must be at least 3 characters");
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("eventId", eventId);
      formData.append("userId", userId);
      formData.append("themeColor", themeColor);
      if (slug) formData.append("slug", slug);
      if (bannerFile) formData.append("banner", bannerFile);

      const res = await fetch("/api/events/customize", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      setSuccess("Event customization saved successfully!");
      setBannerFile(null);
      setSlugAvailable(true);
      onUpdate?.(data.updates);
    } catch (err) {
      setError(err.message || "Failed to save customization");
    } finally {
      setLoading(false);
    }
  };

  const copyUrl = async () => {
    if (!eventUrl) return;
    await navigator.clipboard.writeText(eventUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Event Page</h2>
        <p className="text-sm text-gray-500 mt-1">
          Customize how your event appears to participants
        </p>
      </div>

      {success && (
        <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
          <CheckCircle
            size={18}
            className="text-green-500 flex-shrink-0 mt-0.5"
          />
          <p className="text-sm text-green-700">{success}</p>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertCircle
            size={18}
            className="text-red-500 flex-shrink-0 mt-0.5"
          />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ===== Custom URL Slug ===== */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
              <Link size={18} className="text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Custom URL</h3>
              <p className="text-xs text-gray-500">
                Create a memorable link for your event
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="relative">
              <div className="flex rounded-xl overflow-hidden border border-gray-200 focus-within:border-[#FF6A00] focus-within:ring-2 focus-within:ring-[#FF6A00]/20 transition-all">
                <span className="flex items-center px-3 bg-gray-50 text-gray-400 text-sm border-r border-gray-200 whitespace-nowrap">
                  ticketlelo.in/
                </span>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  onBlur={() => slug && checkSlugAvailability(slug)}
                  placeholder="my-awesome-event"
                  className="flex-1 px-3 py-2.5 text-sm outline-none bg-white"
                  maxLength={60}
                />
                {checkingSlug && (
                  <span className="flex items-center pr-3">
                    <Loader2 size={14} className="animate-spin text-gray-400" />
                  </span>
                )}
                {!checkingSlug && slugAvailable === true && (
                  <span className="flex items-center pr-3 text-green-500">
                    <CheckCircle size={16} />
                  </span>
                )}
                {!checkingSlug && slugAvailable === false && (
                  <span className="flex items-center pr-3 text-red-500">
                    <AlertCircle size={16} />
                  </span>
                )}
              </div>
            </div>

            {slugAvailable === false && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertCircle size={12} />
                This URL is already taken
              </p>
            )}
            {slugAvailable === true && (
              <p className="text-xs text-green-500 flex items-center gap-1">
                <CheckCircle size={12} />
                URL is available!
              </p>
            )}

            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={generateSlug}
                className="px-3 py-1.5 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Auto-generate from name
              </button>
            </div>

            {eventUrl && (
              <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-xl border border-blue-100">
                <span className="text-xs text-blue-700 flex-1 truncate font-mono">
                  {eventUrl}
                </span>
                <button
                  type="button"
                  onClick={copyUrl}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-blue-200 rounded-lg text-xs text-blue-600 hover:bg-blue-50 transition-colors flex-shrink-0"
                >
                  {copied ? (
                    <>
                      <Check size={12} /> Copied!
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
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center">
              <Palette size={18} className="text-[#FF6A00]" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Theme Color</h3>
              <p className="text-xs text-gray-500">
                Choose your brand color for the event page
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Preset Colors */}
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setThemeColor(c.hex)}
                  title={c.name}
                  className={`w-9 h-9 rounded-xl flex-shrink-0 transition-all ${
                    themeColor === c.hex
                      ? "ring-3 ring-offset-2 ring-gray-400 scale-110"
                      : "hover:scale-105"
                  } ${c.hex === "#000000" ? "border border-gray-200" : ""}`}
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
                  className="w-10 h-10 rounded-xl cursor-pointer border-0 p-0.5"
                />
                <span className="text-sm text-gray-600">Custom color</span>
              </label>
              <code className="text-sm font-mono text-gray-500 bg-gray-100 px-2 py-1 rounded">
                {themeColor.toUpperCase()}
              </code>
            </div>

            {/* Preview */}
            <div
              className="h-12 rounded-xl flex items-center justify-center text-white font-semibold text-sm transition-colors"
              style={{ backgroundColor: themeColor }}
            >
              Preview: Register Now
            </div>
          </div>
        </div>

        {/* ===== Banner Upload ===== */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 bg-purple-50 rounded-xl flex items-center justify-center">
              <ImageIcon size={18} className="text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Event Banner</h3>
              <p className="text-xs text-gray-500">
                Upload a banner image (max 5MB, JPEG/PNG/WebP)
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {bannerPreview ? (
              <div className="relative">
                <img
                  src={bannerPreview}
                  alt="Banner preview"
                  className="w-full h-48 object-cover rounded-xl"
                />
                <button
                  type="button"
                  onClick={() => {
                    setBannerFile(null);
                    setBannerPreview(event?.bannerUrl || null);
                  }}
                  className="absolute top-2 right-2 w-7 h-7 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-black/80 transition-colors text-xs"
                >
                  ✕
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-[#FF6A00] hover:bg-orange-50/30 transition-all group">
                <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center group-hover:bg-orange-100 transition-colors">
                  <ImageIcon
                    size={22}
                    className="text-gray-400 group-hover:text-[#FF6A00] transition-colors"
                  />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-700">
                    Click to upload banner
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    JPEG, PNG, WebP up to 5MB. Recommended: 1200×400px
                  </p>
                </div>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleBannerChange}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>

        {/* Save Button */}
        <button
          type="submit"
          disabled={loading || (slug && slugAvailable === false)}
          className="w-full py-3.5 bg-[#FF6A00] text-white font-bold rounded-xl disabled:opacity-60 hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Saving Changes...
            </>
          ) : (
            "Save Event Customization"
          )}
        </button>
      </form>
    </div>
  );
}
