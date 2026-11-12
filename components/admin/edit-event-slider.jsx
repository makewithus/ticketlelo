"use client";

import { useState, useEffect, useRef } from "react";
import {
  X,
  ChevronsRight,
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
  Users,
  ShieldCheck,
  Tag,
  DollarSign,
  Ticket,
} from "lucide-react";
import { toast } from "sonner";
import { IoTicket } from "react-icons/io5";
import { updateEvent } from "@/lib/firestore";
import { setCachedEvent, setCachedOrganiserEvents, getCachedOrganiserEvents } from "@/lib/client-cache";

const THEME_PALETTE = [
  { name: "Orange", hex: "#FE760B" },
  { name: "Gold", hex: "#EAB308" },
  { name: "Emerald", hex: "#10B981" },
  { name: "Teal", hex: "#14B8A6" },
  { name: "Blue", hex: "#3B82F6" },
  { name: "Purple", hex: "#8B5CF6" },
];

const FONTS = [
  { id: "New Spirit", name: "New Spirit", fontClass: "font-serif" },
  { id: "Inter", name: "Inter", fontClass: "font-sans" },
  { id: "Outfit", name: "Outfit", fontClass: "font-sans font-bold" },
  { id: "Roboto", name: "Roboto", fontClass: "font-sans" },
  { id: "JetBrains Mono", name: "JetBrains Mono", fontClass: "font-mono" },
];

export function EditEventSlider({ isOpen, onClose, event, onEventUpdated }) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    startDate: "",
    startTime: "09:00 am",
    endDate: "",
    endTime: "05:00 pm",
    timezone: "GMT+05:30 Kolkata",
    locationType: "in-person", // "in-person" | "virtual"
    location: "",
    address: "",
    virtualLink: "",
    isPaid: false,
    price: "",
    limitCapacity: false,
    maxCapacity: 150,
    enableWaitlist: false,
    requireApproval: false,
    ticketDesign: "stub", // "stub" | "wide"
    themeColor: "#FE760B",
    fontFamily: "New Spirit",
  });

  const [isUpdating, setIsUpdating] = useState(false);
  const colorInputRef = useRef(null);

  useEffect(() => {
    if (event) {
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

      const hasPrice =
        event.isPaid ||
        (event.price &&
          String(event.price).toLowerCase() !== "free" &&
          Number(event.price) > 0);

      const isCapacityRestricted =
        event.limitCapacity !== false &&
        Boolean(
          event.limitCapacity ||
            (event.maxCapacity && Number(event.maxCapacity) < 9999)
        );

      setFormData({
        name: event.name || event.title || "",
        description: event.description || "",
        startDate: startD,
        startTime: event.startTime || "09:00 am",
        endDate: endD,
        endTime: event.endTime || "05:00 pm",
        timezone: event.timezone || "GMT+05:30 Kolkata",
        locationType: event.locationType || "in-person",
        location: event.locationVenue || event.location || "",
        address: event.address || "",
        virtualLink: event.virtualLink || "",
        isPaid: Boolean(hasPrice),
        price: event.price ? String(event.price).replace(/[^\d.]/g, "") : "",
        limitCapacity: Boolean(isCapacityRestricted),
        maxCapacity:
          event.maxCapacity && Number(event.maxCapacity) < 9999
            ? Number(event.maxCapacity)
            : event.capacity && Number(event.capacity) < 9999
            ? Number(event.capacity)
            : 150,
        enableWaitlist: Boolean(event.enableWaitlist),
        requireApproval: Boolean(event.requireApproval),
        ticketDesign: event.ticketDesign || "stub",
        themeColor: event.themeColor || event.theme || "#FE760B",
        fontFamily: event.fontFamily || "New Spirit",
      });
    }
  }, [event]);

  if (!isOpen || !event) return null;

  const handleUpdateEvent = async (e) => {
    if (e) e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Event name is required");
      return;
    }

    setIsUpdating(true);
    try {
      const numericPrice = formData.isPaid ? Number(formData.price) || 0 : 0;
      const numericCapacity = formData.limitCapacity
        ? Math.max(1, Number(formData.maxCapacity) || 150)
        : 9999;

      const payload = {
        name: formData.name.trim(),
        title: formData.name.trim(),
        description: formData.description.trim(),
        startDate: formData.startDate,
        startTime: formData.startTime,
        endDate: formData.endDate,
        endTime: formData.endTime,
        timezone: formData.timezone,
        locationType: formData.locationType,
        location: formData.location.trim(),
        locationVenue: formData.location.trim(),
        address: formData.address.trim(),
        virtualLink: formData.virtualLink.trim(),
        isPaid: formData.isPaid,
        price: numericPrice,
        ticketPrice: numericPrice,
        limitCapacity: formData.limitCapacity,
        maxCapacity: numericCapacity,
        capacity: numericCapacity,
        totalTickets: numericCapacity,
        enableWaitlist: formData.enableWaitlist,
        requireApproval: formData.requireApproval,
        ticketDesign: formData.ticketDesign,
        themeColor: formData.themeColor,
        theme: formData.themeColor,
        fontFamily: formData.fontFamily,
      };

      await updateEvent(event.id, payload);

      const updatedEvent = { ...event, ...payload };
      setCachedEvent(event.id, updatedEvent);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(`admin_cached_event_${event.id}`, JSON.stringify(updatedEvent));
        } catch {}
      }

      const uId = event.createdBy || event.userId || event.organiserId;
      if (uId) {
        const cachedList = getCachedOrganiserEvents(uId) || [];
        const filtered = cachedList.filter((e) => e.id !== event.id);
        setCachedOrganiserEvents(uId, [updatedEvent, ...filtered]);
      }

      if (typeof onEventUpdated === "function") {
        onEventUpdated(updatedEvent);
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
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Slide-over panel matching Image 2 */}
      <div className="relative w-full max-w-xl bg-[#1A1C1F] border-l border-[#2A2D31] text-white shadow-2xl flex flex-col h-full z-10 animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2A2D31] bg-[#1A1C1F]/90 backdrop-blur-md sticky top-0 z-10">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-white hover:text-[#FE760B] transition-colors p-1 -ml-1 rounded-lg hover:bg-white/5 cursor-pointer"
            title="Collapse slider"
          >
            <ChevronsRight size={18} className="text-[#9B9EA4]" />
            <span className="text-base tracking-tight font-extrabold">Edit Event</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#9B9EA4] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            aria-label="Close edit drawer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Form Content */}
        <form onSubmit={handleUpdateEvent} className="flex-1 overflow-y-auto p-5 space-y-6 no-scrollbar">
          {/* ── 1. Basic Info ── */}
          <div className="space-y-3.5">
            <h3 className="text-sm font-bold text-white tracking-tight">Basic Info</h3>
            <div>
              <label className="text-xs font-semibold text-[#9B9EA4] mb-1.5 block">
                Event Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter event title"
                className="w-full bg-[#131517] border border-[#2A2D31] focus:border-[#FE760B] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#64748B] outline-none transition-colors font-medium"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-[#9B9EA4] mb-1.5 block">
                Description
              </label>
              <textarea
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe what attendees can expect from your event..."
                className="w-full bg-[#131517] border border-[#2A2D31] focus:border-[#FE760B] rounded-xl p-3 text-xs text-white placeholder-[#64748B] outline-none resize-none transition-colors"
              />
            </div>
          </div>

          <div className="h-px bg-[#2A2D31]/80" />

          {/* ── 2. Ticket Pricing (Switch Paid to Free / Change Price) ── */}
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <IoTicket size={16} className="text-[#FE760B]" />
                <h3 className="text-sm font-bold text-white tracking-tight">Ticket Pricing</h3>
              </div>
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                formData.isPaid
                  ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                  : "bg-emerald-500/10 text-[#3DD68C] border-[#3DD68C]/30"
              }`}>
                {formData.isPaid ? "Paid Event" : "Free Entry"}
              </span>
            </div>

            <div className="bg-[#131517] border border-[#2A2D31] rounded-2xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-white">Free Entry</p>
                  <p className="text-[11px] text-[#9B9EA4] mt-0.5">
                    Set free admission or charge a fixed ticket price per attendee
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, isPaid: !formData.isPaid })}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                    !formData.isPaid ? "bg-[#3DD68C]" : "bg-[#2A2D31]"
                  }`}
                >
                  <span
                    className={`block w-5 h-5 rounded-full bg-white transition-transform ${
                      !formData.isPaid ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>

              {formData.isPaid && (
                <div className="pt-3 border-t border-[#2A2D31] flex items-center justify-between">
                  <div>
                    <label className="text-xs font-semibold text-white block">
                      Ticket Price (INR)
                    </label>
                    <span className="text-[11px] text-[#9B9EA4]">
                      Attendees will be billed this amount at checkout
                    </span>
                  </div>
                  <div className="relative w-32">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-[#FE760B]">
                      ₹
                    </span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      placeholder="Enter ticket price"
                      className="w-full bg-[#1A1C1F] border border-[#2A2D31] focus:border-[#FE760B] rounded-xl pl-7 pr-3 py-2 text-xs font-bold text-white outline-none"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="h-px bg-[#2A2D31]/80" />

          {/* ── 3. Capacity & Waitlist ── */}
          <div className="space-y-3.5">
            <div className="flex items-center gap-2">
              <Users size={15} className="text-[#FE760B]" />
              <h3 className="text-sm font-bold text-white tracking-tight">Capacity &amp; Attendance</h3>
            </div>

            <div className="bg-[#131517] border border-[#2A2D31] rounded-2xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-white">Limit Event Capacity</p>
                  <p className="text-[11px] text-[#9B9EA4] mt-0.5">
                    Close registrations when total approved spots are filled
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setFormData({ ...formData, limitCapacity: !formData.limitCapacity })
                  }
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                    formData.limitCapacity ? "bg-[#FE760B]" : "bg-[#2A2D31]"
                  }`}
                >
                  <span
                    className={`block w-5 h-5 rounded-full bg-white transition-transform ${
                      formData.limitCapacity ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>

              {formData.limitCapacity && (
                <div className="pt-3 border-t border-[#2A2D31] flex items-center justify-between">
                  <div>
                    <label className="text-xs font-semibold text-white block">
                      Max Capacity Spots
                    </label>
                    <span className="text-[11px] text-[#9B9EA4]">
                      Total allowed tickets/registrations
                    </span>
                  </div>
                  <input
                    type="number"
                    min="1"
                    value={formData.maxCapacity}
                    onChange={(e) =>
                      setFormData({ ...formData, maxCapacity: parseInt(e.target.value, 10) || 150 })
                    }
                    className="w-24 bg-[#1A1C1F] border border-[#2A2D31] focus:border-[#FE760B] rounded-xl px-3 py-2 text-xs font-bold text-white text-center outline-none font-mono"
                  />
                </div>
              )}

              <div className="pt-3 border-t border-[#2A2D31] flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-white">Over-Capacity Waitlist</p>
                  <p className="text-[11px] text-[#9B9EA4] mt-0.5">
                    Allow guests to queue in waitlist once maximum spots are booked
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setFormData({ ...formData, enableWaitlist: !formData.enableWaitlist })
                  }
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                    formData.enableWaitlist ? "bg-[#FE760B]" : "bg-[#2A2D31]"
                  }`}
                >
                  <span
                    className={`block w-5 h-5 rounded-full bg-white transition-transform ${
                      formData.enableWaitlist ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          <div className="h-px bg-[#2A2D31]/80" />

          {/* ── 4. Host Approval ── */}
          <div className="space-y-3.5">
            <div className="flex items-center gap-2">
              <ShieldCheck size={15} className="text-[#FE760B]" />
              <h3 className="text-sm font-bold text-white tracking-tight">Security &amp; Approvals</h3>
            </div>

            <div className="bg-[#131517] border border-[#2A2D31] rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-white">Require Host Approval</p>
                <p className="text-[11px] text-[#9B9EA4] mt-0.5">
                  Registrations require manual review before issuing final tickets
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setFormData({ ...formData, requireApproval: !formData.requireApproval })
                }
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                  formData.requireApproval ? "bg-[#FE760B]" : "bg-[#2A2D31]"
                }`}
              >
                <span
                  className={`block w-5 h-5 rounded-full bg-white transition-transform ${
                    formData.requireApproval ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="h-px bg-[#2A2D31]/80" />

          {/* ── 5. Date & Time ── */}
          <div className="space-y-3.5">
            <div className="flex items-center gap-2">
              <Clock size={15} className="text-[#FE760B]" />
              <h3 className="text-sm font-bold text-white tracking-tight">Date &amp; Time</h3>
            </div>

            <div className="bg-[#131517] border border-[#2A2D31] rounded-2xl p-3.5 space-y-3">
              {/* Start Row */}
              <div className="flex items-center gap-3">
                <div className="w-3 flex justify-center">
                  <span className="w-2 h-2 rounded-full bg-[#FE760B]" />
                </div>
                <span className="text-xs font-semibold text-[#9B9EA4] w-12">Start</span>
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
                  placeholder="09:00 am"
                  className="bg-[#1A1C1F] border border-[#2A2D31] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none w-24 text-center font-mono"
                />
              </div>

              {/* End Row */}
              <div className="flex items-center gap-3">
                <div className="w-3 flex justify-center">
                  <span className="w-2 h-2 rounded-full border border-[#9B9EA4]" />
                </div>
                <span className="text-xs font-semibold text-[#9B9EA4] w-12">End</span>
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
                  placeholder="05:00 pm"
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

          {/* ── 6. Location ── */}
          <div className="space-y-3.5">
            <div className="flex items-center gap-2">
              <MapPin size={15} className="text-[#FE760B]" />
              <h3 className="text-sm font-bold text-white tracking-tight">Location</h3>
            </div>

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
                  placeholder="Enter venue or campus location"
                  className="w-full bg-[#131517] border border-[#2A2D31] focus:border-[#FE760B] rounded-xl px-3.5 py-2 text-xs text-white placeholder-[#64748B] outline-none transition-colors"
                />
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Full Address / City"
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

          <div className="h-px bg-[#2A2D31]/80" />

          {/* ── 7. Ticket Layout & Template ── */}
          <div className="space-y-3.5">
            <div className="flex items-center gap-2">
              <IoTicket size={16} className="text-[#FE760B]" />
              <h3 className="text-sm font-bold text-white tracking-tight">Ticket Layout &amp; Template</h3>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, ticketDesign: "stub" })}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  formData.ticketDesign === "stub"
                    ? "bg-[#131517] border-[#FE760B] shadow-md"
                    : "bg-[#131517] border-[#2A2D31] hover:border-[#383C42]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Stub tickets</span>
                  {formData.ticketDesign === "stub" && (
                    <span className="w-2 h-2 rounded-full bg-[#FE760B]" />
                  )}
                </div>
                <p className="text-[10px] text-[#9B9EA4] mt-1 leading-tight">
                  Standard stub ticket with dark QR check-in panel
                </p>
              </button>

              <button
                type="button"
                onClick={() => setFormData({ ...formData, ticketDesign: "deck" })}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  formData.ticketDesign === "deck" || formData.ticketDesign === "wide"
                    ? "bg-[#131517] border-[#FE760B] shadow-md"
                    : "bg-[#131517] border-[#2A2D31] hover:border-[#383C42]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Deck View tickets</span>
                  {(formData.ticketDesign === "deck" || formData.ticketDesign === "wide") && (
                    <span className="w-2 h-2 rounded-full bg-[#FE760B]" />
                  )}
                </div>
                <p className="text-[10px] text-[#9B9EA4] mt-1 leading-tight">
                  Interactive collectible deck pass with QR tear notch
                </p>
              </button>
            </div>
          </div>

          <div className="h-px bg-[#2A2D31]/80" />

          {/* ── 8. Ticket Background & Accent Theme Color ── */}
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Palette size={15} className="text-[#FE760B]" />
                <h3 className="text-sm font-bold text-white tracking-tight">Theme Color</h3>
              </div>
              <span className="text-xs font-mono text-[#FE760B] font-bold">
                {formData.themeColor}
              </span>
            </div>

            <div className="bg-[#131517] border border-[#2A2D31] rounded-2xl p-3.5 space-y-3">
              <div className="flex items-center gap-2.5 flex-wrap">
                {THEME_PALETTE.map((swatch) => (
                  <button
                    key={swatch.hex}
                    type="button"
                    onClick={() => setFormData({ ...formData, themeColor: swatch.hex })}
                    className={`w-7 h-7 rounded-full transition-transform cursor-pointer relative ${
                      formData.themeColor.toLowerCase() === swatch.hex.toLowerCase()
                        ? "scale-110 ring-2 ring-white ring-offset-2 ring-offset-[#131517]"
                        : "hover:scale-105"
                    }`}
                    style={{ backgroundColor: swatch.hex }}
                    title={swatch.name}
                  />
                ))}

                {/* Conic Gradient Color Wheel Swatch */}
                <button
                  type="button"
                  onClick={() => colorInputRef.current?.click()}
                  className="w-7 h-7 rounded-full relative cursor-pointer hover:scale-105 transition-transform flex items-center justify-center shadow-md"
                  style={{
                    background:
                      "conic-gradient(from 0deg, red, yellow, lime, aqua, blue, magenta, red)",
                  }}
                  title="Open Color Wheel"
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-white shadow-sm" />
                </button>

                <input
                  ref={colorInputRef}
                  type="color"
                  value={formData.themeColor}
                  onChange={(e) => setFormData({ ...formData, themeColor: e.target.value })}
                  className="sr-only"
                />
              </div>

              <div className="pt-2 border-t border-[#2A2D31] flex items-center justify-between text-xs">
                <span className="text-[#9B9EA4]">Custom HEX</span>
                <input
                  type="text"
                  value={formData.themeColor}
                  onChange={(e) => setFormData({ ...formData, themeColor: e.target.value })}
                  className="bg-[#1A1C1F] border border-[#2A2D31] rounded-lg px-2.5 py-1 text-xs text-white font-mono uppercase text-right w-24 outline-none focus:border-[#FE760B]"
                />
              </div>
            </div>
          </div>

          <div className="h-px bg-[#2A2D31]/80" />

          {/* ── 9. Typography & Font Family ── */}
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Type size={15} className="text-[#FE760B]" />
                <h3 className="text-sm font-bold text-white tracking-tight">Typography Font</h3>
              </div>
              <span className="text-xs font-semibold text-white">
                {formData.fontFamily}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {FONTS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFormData({ ...formData, fontFamily: f.id })}
                  className={`py-2 px-3 rounded-xl border text-center transition-all cursor-pointer ${
                    formData.fontFamily === f.id
                      ? "bg-[#FE760B] text-[#131517] border-[#FE760B] font-bold shadow-md"
                      : "bg-[#131517] border-[#2A2D31] text-[#9B9EA4] hover:text-white"
                  }`}
                >
                  <span className={`text-xs block ${f.fontClass}`}>{f.name}</span>
                </button>
              ))}
            </div>
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
            className="flex-1 py-2.5 px-4 rounded-xl bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer disabled:opacity-50"
          >
            {isUpdating ? (
              <Loader2 className="w-4 h-4 animate-spin text-[#131517]" />
            ) : (
              <CheckCircle2 size={16} className="text-[#131517]" />
            )}
            <span>{isUpdating ? "Updating..." : "Update Event"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}