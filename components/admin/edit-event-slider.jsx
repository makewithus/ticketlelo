"use client";

import { useState, useEffect } from "react";
import {
  X,
  ChevronRight,
  ChevronsRight,
  Sparkles,
  Check,
  CheckCircle2,
  Calendar,
  Clock,
  MapPin,
  Video,
  Globe,
  Loader2,
  Palette,
  Type,
  Layout,
} from "lucide-react";
import { toast } from "sonner";
import { updateEvent } from "@/lib/firestore";

const APPEARANCE_THEMES = [
  {
    id: "minimal",
    name: "Minimal",
    previewBg: "bg-[#1E2024]",
    accent: "bg-white",
    hasTextMock: true,
  },
  {
    id: "quantum",
    name: "Quantum",
    previewBg: "bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500",
    accent: "bg-white/90",
    hasTextMock: true,
  },
  {
    id: "ambient",
    name: "Ambient",
    previewBg: "bg-gradient-to-br from-[#0F172A] via-[#1E1B4B] to-[#311042]",
    accent: "bg-purple-300/80",
    hasTextMock: true,
  },
  {
    id: "texture",
    name: "Texture",
    isNew: true,
    previewBg: "bg-gradient-to-r from-amber-100 via-rose-100 to-teal-100",
    accent: "bg-slate-700/60",
    hasTextMock: true,
  },
  {
    id: "emoji",
    name: "Emoji",
    previewBg: "bg-gradient-to-br from-purple-400 via-pink-400 to-amber-300",
    emojis: "🥳 😎",
  },
];

const FONTS = [
  { id: "new-spirit", name: "New Spirit" },
  { id: "inter", name: "Inter" },
  { id: "outfit", name: "Outfit" },
  { id: "roboto", name: "Roboto" },
  { id: "mono", name: "JetBrains Mono" },
];

export function EditEventSlider({ isOpen, onClose, event, onEventUpdated }) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    appearanceTheme: "minimal",
    themeColor: "#FE760B",
    style: "—",
    font: "New Spirit",
    display: "Auto",
    startDate: "",
    startTime: "11:30 pm",
    endDate: "",
    endTime: "12:30 am",
    timezone: "GMT+05:30 Kolkata",
    locationType: "in-person", // "in-person" | "virtual"
    location: "",
    address: "",
    virtualLink: "",
  });

  const [isUpdating, setIsUpdating] = useState(false);
  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);

  useEffect(() => {
    if (event) {
      // Format start date
      let startD = "";
      try {
        const rawDate = event.date?.toDate
          ? event.date.toDate()
          : event.startDate
          ? new Date(event.startDate)
          : new Date();
        startD = rawDate.toISOString().split("T")[0];
      } catch {
        startD = new Date().toISOString().split("T")[0];
      }

      let endD = startD;
      try {
        if (event.endDate) {
          const rawEnd = event.endDate?.toDate
            ? event.endDate.toDate()
            : new Date(event.endDate);
          endD = rawEnd.toISOString().split("T")[0];
        }
      } catch {}

      setFormData({
        name: event.name || "",
        description: event.description || "",
        appearanceTheme: event.appearanceTheme || "minimal",
        themeColor: event.themeColor || event.theme || "#FE760B",
        style: event.cardStyle || "—",
        font: event.fontFamily || "New Spirit",
        display: event.displayMode || "Auto",
        startDate: startD,
        startTime: event.startTime || "11:30 pm",
        endDate: endD,
        endTime: event.endTime || "12:30 am",
        timezone: event.timezone || "GMT+05:30 Kolkata",
        locationType: event.locationType || "in-person",
        location: event.location || "",
        address: event.address || "",
        virtualLink: event.virtualLink || "",
      });
    }
  }, [event]);

  if (!isOpen || !event) return null;

  const handleSuggestDescription = () => {
    setIsGeneratingDesc(true);
    setTimeout(() => {
      const eventName = formData.name || "College Festival";
      const descriptions = [
        `Join us for ${eventName} — the ultimate gathering celebrating innovation, technology, and community! Featuring hands-on workshops, keynote speakers, networking sessions, and live showcases. Reserve your spot today!`,
        `Welcome to ${eventName}! An immersive experience designed to inspire, connect, and elevate future creators and leaders. Don't miss out on exclusive passes and high-energy sessions.`,
        `Get ready for ${eventName} at ${formData.location || "campus"}! Experience top-tier tech competitions, workshops, and interactive exhibits. RSVP now to secure your access ticket.`,
      ];
      const randomDesc = descriptions[Math.floor(Math.random() * descriptions.length)];
      setFormData((prev) => ({ ...prev, description: randomDesc }));
      setIsGeneratingDesc(false);
      toast.success("Description generated!");
    }, 450);
  };

  const handleUpdateEvent = async (e) => {
    if (e) e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Event name is required");
      return;
    }

    setIsUpdating(true);
    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        appearanceTheme: formData.appearanceTheme,
        themeColor: formData.themeColor,
        cardStyle: formData.style,
        fontFamily: formData.font,
        displayMode: formData.display,
        startDate: formData.startDate,
        startTime: formData.startTime,
        endDate: formData.endDate,
        endTime: formData.endTime,
        timezone: formData.timezone,
        locationType: formData.locationType,
        location: formData.location.trim(),
        address: formData.address.trim(),
        virtualLink: formData.virtualLink.trim(),
      };

      await updateEvent(event.id, payload);

      if (typeof onEventUpdated === "function") {
        onEventUpdated({ ...event, ...payload });
      }

      toast.success("Event updated successfully!");
      onClose();
    } catch (err) {
      console.error("Failed to update event:", err);
      toast.error("Failed to update event details");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Slide-over panel matching Image 2 */}
      <div className="relative w-full max-w-lg bg-[#1A1C1F] border-l border-[#2A2D31] text-white shadow-2xl flex flex-col h-full z-10 animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2A2D31] bg-[#1A1C1F]/90 backdrop-blur-md sticky top-0 z-10">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-white hover:text-[#FE760B] transition-colors p-1 -ml-1 rounded-lg hover:bg-white/5 cursor-pointer"
            title="Collapse slider"
          >
            <ChevronsRight size={18} className="text-[#9B9EA4]" />
            <span className="text-base tracking-tight">Edit Event</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#9B9EA4] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Form Content */}
        <form onSubmit={handleUpdateEvent} className="flex-1 overflow-y-auto p-5 space-y-6 no-scrollbar">
          {/* ── 1. Basic Info ── */}
          <div className="space-y-3.5">
            <h3 className="text-sm font-bold text-white tracking-tight">Basic Info</h3>

            {/* Event Name */}
            <div>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Event Title"
                className="w-full bg-[#131517] border border-[#2A2D31] focus:border-[#FE760B] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#64748B] outline-none transition-colors"
                required
              />
            </div>

            {/* Description & AI Suggestion Button */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-[#9B9EA4]">Description</label>
                <button
                  type="button"
                  onClick={handleSuggestDescription}
                  disabled={isGeneratingDesc}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#9B9EA4] hover:text-[#FE760B] transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Sparkles size={12} className={isGeneratingDesc ? "animate-spin text-[#FE760B]" : "text-[#FE760B]"} />
                  <span>{isGeneratingDesc ? "Generating..." : "Suggest Description"}</span>
                </button>
              </div>
              <textarea
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Tell guests about your event..."
                className="w-full bg-[#131517] border border-[#2A2D31] focus:border-[#FE760B] rounded-xl p-3 text-xs text-white placeholder-[#64748B] outline-none resize-none transition-colors"
              />
            </div>
          </div>

          <div className="h-px bg-[#2A2D31]/80" />

          {/* ── 2. Appearance ── */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white tracking-tight">Appearance</h3>

            {/* Style Cards Carousel */}
            <div className="flex items-center gap-2.5 overflow-x-auto pb-1 no-scrollbar">
              {APPEARANCE_THEMES.map((theme) => {
                const isSelected = formData.appearanceTheme === theme.id;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, appearanceTheme: theme.id })}
                    className={`flex-shrink-0 flex flex-col items-center gap-1.5 group cursor-pointer focus:outline-none`}
                  >
                    <div
                      className={`w-20 h-14 rounded-xl ${theme.previewBg} p-2 relative flex flex-col justify-between overflow-hidden border-2 transition-all ${
                        isSelected
                          ? "border-[#FE760B] shadow-md scale-105"
                          : "border-[#2A2D31] group-hover:border-[#383C42]"
                      }`}
                    >
                      {theme.isNew && (
                        <span className="absolute top-1 right-1 px-1 py-0.2 rounded bg-rose-500 text-[8px] font-black uppercase text-white leading-none">
                          NEW
                        </span>
                      )}

                      {theme.hasTextMock && (
                        <div className="w-full h-full flex flex-col justify-center gap-1">
                          <div className={`w-1/2 h-1.5 rounded ${theme.accent}`} />
                          <div className="w-3/4 h-1 rounded bg-white/30" />
                          <div className="w-2/3 h-1 rounded bg-white/20" />
                        </div>
                      )}

                      {theme.emojis && (
                        <div className="w-full h-full flex items-center justify-center text-sm">
                          <span>{theme.emojis}</span>
                        </div>
                      )}
                    </div>
                    <span
                      className={`text-[11px] font-medium transition-colors ${
                        isSelected ? "text-white font-bold" : "text-[#9B9EA4]"
                      }`}
                    >
                      {theme.name}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* 2x2 Grid of Customization Dropdowns matching Image 2 */}
            <div className="grid grid-cols-2 gap-2.5">
              {/* Colour */}
              <div className="bg-[#131517] border border-[#2A2D31] rounded-xl px-3 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-4 h-4 rounded-full shrink-0 border border-white/20"
                    style={{ backgroundColor: formData.themeColor }}
                  />
                  <span className="text-xs text-[#9B9EA4] font-medium">Colour</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    value={formData.themeColor}
                    onChange={(e) => setFormData({ ...formData, themeColor: e.target.value })}
                    className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                    title="Choose theme color"
                  />
                  <span className="text-xs font-semibold text-white">Custom</span>
                </div>
              </div>

              {/* Style */}
              <div className="bg-[#131517] border border-[#2A2D31] rounded-xl px-3 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-4 h-4 rounded-full bg-[#2A2D31] shrink-0" />
                  <span className="text-xs text-[#9B9EA4] font-medium">Style</span>
                </div>
                <select
                  value={formData.style}
                  onChange={(e) => setFormData({ ...formData, style: e.target.value })}
                  className="bg-transparent text-xs font-semibold text-white outline-none cursor-pointer text-right"
                >
                  <option value="—" className="bg-[#1A1C1F]">
                    —
                  </option>
                  <option value="Modern" className="bg-[#1A1C1F]">
                    Modern
                  </option>
                  <option value="Minimal" className="bg-[#1A1C1F]">
                    Minimal
                  </option>
                  <option value="Bold" className="bg-[#1A1C1F]">
                    Bold
                  </option>
                </select>
              </div>

              {/* Font */}
              <div className="bg-[#131517] border border-[#2A2D31] rounded-xl px-3 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-serif font-black text-[#9B9EA4]">Ag</span>
                  <span className="text-xs text-[#9B9EA4] font-medium">Font</span>
                </div>
                <select
                  value={formData.font}
                  onChange={(e) => setFormData({ ...formData, font: e.target.value })}
                  className="bg-transparent text-xs font-semibold text-white outline-none cursor-pointer text-right max-w-[90px] truncate"
                >
                  {FONTS.map((f) => (
                    <option key={f.id} value={f.name} className="bg-[#1A1C1F]">
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Display */}
              <div className="bg-[#131517] border border-[#2A2D31] rounded-xl px-3 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-4 h-4 rounded-full border border-[#9B9EA4] shrink-0" />
                  <span className="text-xs text-[#9B9EA4] font-medium">Display</span>
                </div>
                <select
                  value={formData.display}
                  onChange={(e) => setFormData({ ...formData, display: e.target.value })}
                  className="bg-transparent text-xs font-semibold text-white outline-none cursor-pointer text-right"
                >
                  <option value="Auto" className="bg-[#1A1C1F]">
                    Auto
                  </option>
                  <option value="Poster" className="bg-[#1A1C1F]">
                    Poster
                  </option>
                  <option value="Card" className="bg-[#1A1C1F]">
                    Card
                  </option>
                </select>
              </div>
            </div>
          </div>

          <div className="h-px bg-[#2A2D31]/80" />

          {/* ── 3. Time ── */}
          <div className="space-y-3.5">
            <h3 className="text-sm font-bold text-white tracking-tight">Time</h3>

            <div className="bg-[#131517] border border-[#2A2D31] rounded-2xl p-3.5 space-y-3">
              {/* Start Row */}
              <div className="flex items-center gap-3">
                <div className="w-3 flex justify-center">
                  <span className="w-2 h-2 rounded-full bg-[#FE760B]" />
                </div>
                <span className="text-xs font-semibold text-[#9B9EA4] w-10">Start</span>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="bg-[#1A1C1F] border border-[#2A2D31] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none flex-1 font-mono"
                />
                <input
                  type="text"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  placeholder="11:30 pm"
                  className="bg-[#1A1C1F] border border-[#2A2D31] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none w-24 text-center font-mono"
                />
              </div>

              {/* End Row */}
              <div className="flex items-center gap-3">
                <div className="w-3 flex justify-center">
                  <span className="w-2 h-2 rounded-full border border-[#9B9EA4]" />
                </div>
                <span className="text-xs font-semibold text-[#9B9EA4] w-10">End</span>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="bg-[#1A1C1F] border border-[#2A2D31] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none flex-1 font-mono"
                />
                <input
                  type="text"
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  placeholder="12:30 am"
                  className="bg-[#1A1C1F] border border-[#2A2D31] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none w-24 text-center font-mono"
                />
              </div>

              {/* Timezone Row */}
              <div className="pt-2 border-t border-[#2A2D31] flex items-center justify-between text-xs text-[#9B9EA4]">
                <div className="flex items-center gap-2">
                  <Globe size={13} className="text-[#9B9EA4]" />
                  <span>Timezone</span>
                </div>
                <input
                  type="text"
                  value={formData.timezone}
                  onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                  className="bg-transparent text-xs text-right font-medium text-white outline-none"
                />
              </div>
            </div>
          </div>

          <div className="h-px bg-[#2A2D31]/80" />

          {/* ── 4. Location ── */}
          <div className="space-y-3.5">
            <h3 className="text-sm font-bold text-white tracking-tight">Location</h3>

            {/* In Person vs Virtual Toggles */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, locationType: "in-person" })}
                className={`p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                  formData.locationType === "in-person"
                    ? "bg-[#131517] border-[#3DD68C] text-white"
                    : "bg-[#131517] border-[#2A2D31] text-[#9B9EA4] hover:text-white"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[#183124] border border-[#3DD68C]/30 flex items-center justify-center text-[#3DD68C]">
                    <MapPin size={14} />
                  </div>
                  <span className="text-xs font-bold">In Person</span>
                </div>
                {formData.locationType === "in-person" && (
                  <Check size={15} className="text-[#3DD68C]" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setFormData({ ...formData, locationType: "virtual" })}
                className={`p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                  formData.locationType === "virtual"
                    ? "bg-[#131517] border-[#3B82F6] text-white"
                    : "bg-[#131517] border-[#2A2D31] text-[#9B9EA4] hover:text-white"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[#1E293B] border border-blue-500/30 flex items-center justify-center text-[#3B82F6]">
                    <Video size={14} />
                  </div>
                  <span className="text-xs font-bold">Virtual</span>
                </div>
                {formData.locationType === "virtual" && (
                  <Check size={15} className="text-[#3B82F6]" />
                )}
              </button>
            </div>

            {/* Inputs based on type */}
            {formData.locationType === "in-person" ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Venue Name (e.g. KIET Group of Institutions)"
                  className="w-full bg-[#131517] border border-[#2A2D31] focus:border-[#FE760B] rounded-xl px-3.5 py-2 text-xs text-white placeholder-[#64748B] outline-none transition-colors"
                />
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Full Address (e.g. Delhi-NCR, Meerut Rd, Ghaziabad)"
                  className="w-full bg-[#131517] border border-[#2A2D31] focus:border-[#FE760B] rounded-xl px-3.5 py-2 text-xs text-white placeholder-[#64748B] outline-none transition-colors"
                />
              </div>
            ) : (
              <div>
                <input
                  type="url"
                  value={formData.virtualLink}
                  onChange={(e) => setFormData({ ...formData, virtualLink: e.target.value })}
                  placeholder="Virtual Meeting Link (Zoom, Google Meet, YouTube)"
                  className="w-full bg-[#131517] border border-[#2A2D31] focus:border-[#FE760B] rounded-xl px-3.5 py-2 text-xs text-white placeholder-[#64748B] outline-none transition-colors"
                />
              </div>
            )}
          </div>
        </form>

        {/* Sticky Bottom Action Bar matching Image 2 */}
        <div className="p-4 border-t border-[#2A2D31] bg-[#1A1C1F] sticky bottom-0 z-10 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-[#212327] hover:bg-[#2A2D31] text-xs font-semibold text-[#9B9EA4] hover:text-white transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleUpdateEvent}
            disabled={isUpdating}
            className="flex-1 py-2.5 px-4 rounded-xl bg-[#212327] hover:bg-[#2A2D31] border border-[#2A2D31] hover:border-[#FE760B]/40 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer disabled:opacity-50"
          >
            {isUpdating ? (
              <Loader2 className="w-4 h-4 animate-spin text-[#FE760B]" />
            ) : (
              <CheckCircle2 size={16} className="text-[#3DD68C]" />
            )}
            <span>{isUpdating ? "Updating..." : "Update Event"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
