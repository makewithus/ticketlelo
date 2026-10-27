"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

  if (!isOpen || !event) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-[#0b132b] text-white rounded-xl border border-slate-700 w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-700 flex items-center justify-between bg-slate-900/50">
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
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
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
                <Button
                  type="button"
                  variant="ghost"
                  onClick={resetForm}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </Button>
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
                  <select
                    value={formData.trackType}
                    onChange={(e) => setFormData({ ...formData, trackType: e.target.value })}
                    className="w-full h-10 px-3 rounded-md bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {TRACK_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
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
                  <Input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="bg-slate-900 border-slate-700 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Start Time</label>
                  <Input
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    placeholder="10:00 AM"
                    className="bg-slate-900 border-slate-700 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">End Time</label>
                  <Input
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    placeholder="01:00 PM"
                    className="bg-slate-900 border-slate-700 text-sm"
                  />
                </div>
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
                <select
                  value={formData.pricingMode}
                  onChange={(e) => setFormData({ ...formData, pricingMode: e.target.value })}
                  className="w-full h-10 px-3 rounded-md bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none"
                >
                  {PRICING_MODES.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
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
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForm}
                  className="border-slate-700 text-xs text-slate-300"
                >
                  Cancel
                </Button>
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
}
