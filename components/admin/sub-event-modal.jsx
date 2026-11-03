"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StyledDropdown } from "@/components/ui/styled-dropdown";
import {
  Loader2,
  Plus,
  Trash2,
  Calendar,
  Clock,
  MapPin,
  Video,
  X,
  Layers,
  CheckCircle,
  Tag,
} from "lucide-react";
import { toast } from "sonner";
import {
  createSubEvent,
  getSubEventsForEvent,
  updateSubEvent,
  deleteSubEvent,
  calculateRemainingSubEventCapacity,
} from "@/lib/sub-events";

const TRACK_TYPES = [
  { value: "workshop", label: "Technical Workshop" },
  { value: "hackathon", label: "Hackathon / Buildathon" },
  { value: "pro_show", label: "Pro Show / Concert" },
  { value: "conference", label: "Keynote / Conference" },
  { value: "competition", label: "Gaming / Competition" },
  { value: "webinar", label: "Online Webinar / Stream" },
  { value: "general", label: "General Track" },
];

const PRICING_MODES = [
  { value: "paid", label: "Standalone Paid Ticket" },
  { value: "free", label: "Free Registration" },
  { value: "combo_only", label: "Combo-Only (Included in Bundles)" },
  { value: "pass_only", label: "Fest Pass-Only (VIP/Full Pass)" },
];

export const TIME_OPTIONS = [
  "12:00 AM", "12:30 AM", "01:00 AM", "01:30 AM", "02:00 AM", "02:30 AM",
  "03:00 AM", "03:30 AM", "04:00 AM", "04:30 AM", "05:00 AM", "05:30 AM",
  "06:00 AM", "06:30 AM", "07:00 AM", "07:30 AM", "08:00 AM", "08:30 AM",
  "09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM",
  "12:00 PM", "12:30 PM", "01:00 PM", "01:30 PM", "02:00 PM", "02:30 PM",
  "03:00 PM", "03:30 PM", "04:00 PM", "04:30 PM", "05:00 PM", "05:30 PM",
  "06:00 PM", "06:30 PM", "07:00 PM", "07:30 PM", "08:00 PM", "08:30 PM",
  "09:00 PM", "09:30 PM", "10:00 PM", "10:30 PM", "11:00 PM", "11:30 PM",
];

export function parseTimeToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== "string") return null;
  const clean = timeStr.trim().toUpperCase();
  const match = clean.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const modifier = match[3];

  if (modifier === "PM" && hours < 12) hours += 12;
  if (modifier === "AM" && hours === 12) hours = 0;

  return hours * 60 + minutes;
}

export function SubEventModal({ event, isOpen, onClose }) {
  const [subEvents, setSubEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [editingSubEvent, setEditingSubEvent] = useState(null);

  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    description: "",
    trackType: "workshop",
    date: "",
    startTime: "10:00 AM",
    endTime: "01:00 PM",
    venue: "",
    isVirtual: false,
    virtualMeetingUrl: "",
    virtualMeetingPasscode: "",
    capacity: 100,
    standalonePrice: 299,
    pricingMode: "paid",
  });

  const loadSubEvents = async () => {
    setIsLoading(true);
    try {
      const items = await getSubEventsForEvent(event.id);
      setSubEvents(items);
    } catch (err) {
      console.error("Failed to load sub-events:", err);
      toast.error("Could not load sub-events.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (event && isOpen) {
      const timer = setTimeout(() => {
        loadSubEvents();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [event, isOpen]);

  const handleCreateOrUpdate = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error("Sub-event title is required.");
      return;
    }

    const startM = parseTimeToMinutes(formData.startTime);
    const endM = parseTimeToMinutes(formData.endTime);
    if (startM !== null && endM !== null && endM <= startM) {
      toast.error("End time must be after start time");
      return;
    }

    try {
      setIsLoading(true);
      if (editingSubEvent) {
        await updateSubEvent(editingSubEvent.id, {
          ...formData,
          capacity: Number(formData.capacity) || 0,
          standalonePrice: Number(formData.standalonePrice) || 0,
        });
        toast.success("Sub-event updated successfully.");
      } else {
        await createSubEvent({
          parentEventId: event.id,
          organizationId: event.organizationId || null,
          ...formData,
        });
        toast.success("Sub-event created successfully.");
      }

      resetForm();
      await loadSubEvents();
    } catch (err) {
      console.error("Failed to save sub-event:", err);
      toast.error(err.message || "Failed to save sub-event.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (subEventId) => {
    if (!confirm("Are you sure you want to delete this sub-event? Active tickets may be affected.")) {
      return;
    }
    try {
      setIsLoading(true);
      await deleteSubEvent(subEventId);
      toast.success("Sub-event deleted.");
      await loadSubEvents();
    } catch (err) {
      console.error("Error deleting sub-event:", err);
      toast.error("Failed to delete sub-event.");
    } finally {
      setIsLoading(false);
    }
  };

  const startEdit = (sub) => {
    setEditingSubEvent(sub);
    setFormData({
      title: sub.title || "",
      slug: sub.slug || "",
      description: sub.description || "",
      trackType: sub.trackType || "workshop",
      date: sub.date || "",
      startTime: sub.startTime || "10:00 AM",
      endTime: sub.endTime || "01:00 PM",
      venue: sub.venue || "",
      isVirtual: Boolean(sub.isVirtual),
      virtualMeetingUrl: sub.virtualMeetingUrl || "",
      virtualMeetingPasscode: sub.virtualMeetingPasscode || "",
      capacity: sub.capacity || 100,
      standalonePrice: sub.standalonePrice || 0,
      pricingMode: sub.pricingMode || "paid",
    });
    setIsCreating(true);
  };

  const resetForm = () => {
    setEditingSubEvent(null);
    setIsCreating(false);
    setFormData({
      title: "",
      slug: "",
      description: "",
      trackType: "workshop",
      date: "",
      startTime: "10:00 AM",
      endTime: "01:00 PM",
      venue: "",
      isVirtual: false,
      virtualMeetingUrl: "",
      virtualMeetingPasscode: "",
      capacity: 100,
      standalonePrice: 299,
      pricingMode: "paid",
    });
  };

  // Prevent background body scrolling when modal is open
  useEffect(() => {
    if (!isOpen || !event) return;

    const originalOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;

    const scrollBarWidth =
      window.innerWidth - document.documentElement.clientWidth;
    if (scrollBarWidth > 0) {
      document.body.style.paddingRight = `${scrollBarWidth}px`;
    }

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.style.paddingRight = originalPaddingRight;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, event, onClose]);

  if (!isOpen || !event) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto overscroll-contain"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-[#0b132b] text-white rounded-xl border border-slate-700 w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden overscroll-contain"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-700 flex items-center justify-between bg-slate-900/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Sub-Events &amp; Room Tracks</h2>
              <p className="text-xs text-slate-400">
                Major Event: <span className="text-blue-400 font-medium">{event.name || event.title}</span> (Total Capacity: {event.totalTickets || event.globalCapacity || "N/A"})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 overscroll-contain touch-pan-y">
          {!isCreating ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-sm text-slate-200">
                    Configured Tracks ({subEvents.length})
                  </h3>
                  <p className="text-xs text-slate-400">
                    Each sub-event has independent capacity, scheduling, and optional standalone tickets.
                  </p>
                </div>
                <Button
                  onClick={() => setIsCreating(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-xs flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Add Sub-Event
                </Button>
              </div>

              {isLoading ? (
                <div className="py-12 flex justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                </div>
              ) : subEvents.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-slate-700 rounded-lg bg-slate-900/30">
                  <Layers className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm text-slate-300 font-medium">No sub-events configured yet.</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Add individual activities, workshops, concerts, or hackathons to this festival.
                  </p>
                  <Button
                    onClick={() => setIsCreating(true)}
                    variant="outline"
                    className="mt-4 border-slate-700 text-xs"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Create First Sub-Event
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {subEvents.map((sub) => {
                    const remaining = calculateRemainingSubEventCapacity(sub);
                    return (
                      <div
                        key={sub.id}
                        className="p-4 rounded-lg border border-slate-800 bg-slate-900/60 hover:border-slate-700 transition space-y-3"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-950/60 border border-blue-800/40 px-2 py-0.5 rounded-full">
                              {sub.trackType.replace("_", " ")}
                            </span>
                            <h4 className="font-bold text-sm text-white mt-1.5">{sub.title}</h4>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => startEdit(sub)}
                              className="text-xs text-slate-400 hover:text-blue-400 px-2 py-1 rounded bg-slate-800/50"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(sub.id)}
                              className="text-xs text-red-400 hover:text-red-300 p-1 rounded hover:bg-red-950/40"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 pt-1 border-t border-slate-800/60">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-slate-500" />
                            <span>{sub.startTime} – {sub.endTime}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-slate-500" />
                            <span className="truncate">{sub.venue || "Main Venue"}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/60">
                          <span className="font-semibold text-emerald-400">
                            {sub.pricingMode === "free"
                              ? "Free"
                              : sub.pricingMode === "combo_only"
                              ? "Combo Only"
                              : sub.pricingMode === "pass_only"
                              ? "Fest Pass Only"
                              : `₹${sub.standalonePrice}`}
                          </span>
                          <span className="text-slate-400">
                            Capacity: <strong className="text-white">{sub.capacity}</strong> ({remaining} left)
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleCreateOrUpdate} className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="font-semibold text-sm text-slate-200">
                  {editingSubEvent ? "Edit Sub-Event Track" : "New Sub-Event Track"}
                </h3>
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs text-slate-400 hover:text-white hover:bg-slate-800 px-3 py-1.5 rounded-lg border border-transparent hover:border-slate-700 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Track Title *</label>
                  <Input
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g. AI & ML Hands-on Workshop"
                    className="bg-slate-900 border-slate-700 text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Track Category</label>
                  <StyledDropdown
                    value={formData.trackType}
                    options={TRACK_TYPES}
                    onChange={(val) => setFormData({ ...formData, trackType: val })}
                    className="w-full"
                    buttonClassName="h-10 px-3 rounded-md bg-slate-900 border-slate-700 text-sm text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Description</label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Outline topics covered, prerequisites, or session highlights."
                  className="bg-slate-900 border-slate-700 text-sm h-20"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Session Date</label>
                  <div className="relative">
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full h-10 px-3 pr-9 rounded-md bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 [color-scheme:dark]"
                    />
                    <Calendar className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Start Time</label>
                  <StyledDropdown
                    icon={Clock}
                    value={formData.startTime}
                    options={TIME_OPTIONS.map((t) => ({ value: t, label: t }))}
                    onChange={(val) => setFormData({ ...formData, startTime: val })}
                    className="w-full"
                    buttonClassName="h-10 px-3 rounded-md bg-slate-900 border-slate-700 text-sm text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">End Time</label>
                  <StyledDropdown
                    icon={Clock}
                    value={formData.endTime}
                    options={TIME_OPTIONS.map((t) => ({ value: t, label: t }))}
                    onChange={(val) => setFormData({ ...formData, endTime: val })}
                    className="w-full"
                    buttonClassName={`h-10 px-3 rounded-md bg-slate-900 text-sm ${
                      parseTimeToMinutes(formData.endTime) !== null &&
                      parseTimeToMinutes(formData.startTime) !== null &&
                      parseTimeToMinutes(formData.endTime) <= parseTimeToMinutes(formData.startTime)
                        ? "border-amber-500 text-amber-200"
                        : "border-slate-700 text-white"
                    }`}
                  />
                </div>

                {parseTimeToMinutes(formData.endTime) !== null &&
                  parseTimeToMinutes(formData.startTime) !== null &&
                  parseTimeToMinutes(formData.endTime) <= parseTimeToMinutes(formData.startTime) && (
                    <div className="md:col-span-3 -mt-1">
                      <p className="text-[11px] text-amber-400 font-medium flex items-center gap-1.5">
                        <span>⚠️ End time must be after start time ({formData.startTime}).</span>
                      </p>
                    </div>
                  )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Venue / Room</label>
                  <Input
                    value={formData.venue}
                    onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                    placeholder="e.g. Hall A - Tech Block"
                    className="bg-slate-900 border-slate-700 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Room Capacity *</label>
                  <Input
                    type="number"
                    min="1"
                    required
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                    className="bg-slate-900 border-slate-700 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Standalone Price (₹)</label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.standalonePrice}
                    onChange={(e) => setFormData({ ...formData, standalonePrice: e.target.value })}
                    className="bg-slate-900 border-slate-700 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Ticketing / Pricing Mode</label>
                <StyledDropdown
                  value={formData.pricingMode}
                  options={PRICING_MODES}
                  onChange={(val) => setFormData({ ...formData, pricingMode: val })}
                  className="w-full"
                  buttonClassName="h-10 px-3 rounded-md bg-slate-900 border-slate-700 text-sm text-white"
                />
              </div>

              {/* Virtual / Hybrid Webinar Section */}
              <div className="p-4 rounded-lg border border-slate-800 bg-slate-900/40 space-y-3">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isVirtual}
                    onChange={(e) => setFormData({ ...formData, isVirtual: e.target.checked })}
                    className="rounded border-slate-700 text-blue-600 focus:ring-0"
                  />
                  <span>Virtual / Online Session (Gated Meeting Link)</span>
                </label>

                {formData.isVirtual && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Meeting URL (Google Meet / Zoom)</label>
                      <Input
                        type="url"
                        value={formData.virtualMeetingUrl}
                        onChange={(e) => setFormData({ ...formData, virtualMeetingUrl: e.target.value })}
                        placeholder="https://meet.google.com/xyz"
                        className="bg-slate-900 border-slate-700 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Passcode (optional)</label>
                      <Input
                        value={formData.virtualMeetingPasscode}
                        onChange={(e) => setFormData({ ...formData, virtualMeetingPasscode: e.target.value })}
                        placeholder="e.g. TECH2027"
                        className="bg-slate-900 border-slate-700 text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={resetForm}
                  className="border border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-xs font-semibold text-slate-300 hover:text-white px-4 py-2 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-xs font-semibold"
                >
                  {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
                  {editingSubEvent ? "Update Sub-Event" : "Save Sub-Event"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(modalContent, document.body)
    : modalContent;
}
