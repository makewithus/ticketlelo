"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { authFetch } from "@/lib/auth";
import {
  Users,
  Plus,
  Search,
  Sparkles,
  Calendar,
  Award,
  Layers,
  ArrowRight,
  Loader2,
  CheckCircle,
  Clock,
  AlertCircle,
  X,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function OrganizerProgramsListPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [availableEvents, setAvailableEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    name: "",
    eventId: "",
    description: "",
    college: "",
    startDate: "",
    endDate: "",
    basePointsPerTicket: 10,
    paidMultiplier: 2,
  });

  useEffect(() => {
    if (!user) return;
    let isCancelled = false;
    const loadEvents = async () => {
      setLoadingEvents(true);
      try {
        const res = await authFetch("/api/events?limit=100");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.events) && data.events.length > 0) {
            if (!isCancelled) setAvailableEvents(data.events);
            setLoadingEvents(false);
            return;
          }
        }
      } catch (err) {
        console.warn("API events load error:", err?.message);
      }

      // Client-side fallback to getEventsByOrganiser
      try {
        const { getEventsByOrganiser } = await import("@/lib/firestore");
        const clientEvents = await getEventsByOrganiser(user.uid);
        if (Array.isArray(clientEvents) && clientEvents.length > 0 && !isCancelled) {
          setAvailableEvents(clientEvents);
        }
      } catch (clientErr) {
        console.warn("Client events fallback error:", clientErr?.message);
      } finally {
        if (!isCancelled) setLoadingEvents(false);
      }
    };

    loadEvents();
    return () => {
      isCancelled = true;
    };
  }, [user, isCreateOpen]);

  const fetchPrograms = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await authFetch("/api/organizer/programs");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to load ambassador programs");
      }
      const data = await res.json();
      setPrograms(data.programs || []);
    } catch (err) {
      console.error("Failed to fetch programs:", err);
      toast.error(err.message || "Failed to load ambassador programs");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPrograms();
  }, [fetchPrograms]);

  const handleCreate = async (e) => {
    e.preventDefault();
    const programTitle = (formData.title || formData.name || "").trim();
    if (!programTitle) {
      toast.error("Please enter a program title");
      return;
    }
    setCreating(true);
    try {
      const res = await authFetch("/api/organizer/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: programTitle,
          name: programTitle,
          eventId: formData.eventId || null,
          description: formData.description.trim(),
          college: formData.college.trim(),
          startDate: formData.startDate || null,
          endDate: formData.endDate || null,
          pointsRules: {
            basePointsPerTicket: Number(formData.basePointsPerTicket) || 10,
            paidMultiplier: Number(formData.paidMultiplier) || 2,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create program");
      }

      toast.success("Ambassador program created successfully!");
      setIsCreateOpen(false);
      setFormData({
        title: "",
        name: "",
        eventId: "",
        description: "",
        college: "",
        startDate: "",
        endDate: "",
        basePointsPerTicket: 10,
        paidMultiplier: 2,
      });
      fetchPrograms();
      if (data.program?.id) {
        router.push(`/admin/programs/${data.program.id}`);
      }
    } catch (err) {
      toast.error(err.message || "Could not create program");
    } finally {
      setCreating(false);
    }
  };

  // Filtered Programs
  const filteredPrograms = programs.filter((p) => {
    const matchesSearch =
      (p.title || p.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.college || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Aggregated Stats
  const totalAmbassadors = programs.reduce((sum, p) => sum + (p.stats?.totalAmbassadors || p.ambassadorsCount || 0), 0);
  const totalPoints = programs.reduce((sum, p) => sum + (p.stats?.totalPointsIssued || 0), 0);
  const totalEvents = programs.reduce((sum, p) => sum + (p.connectedEventsCount || p.connectedEvents?.length || 0), 0);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* ── 1. Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-[#FE760B]/12 text-[#FE760B] border border-[#FE760B]/25">
              <Sparkles className="w-3 h-3 text-[#FE760B]" />
              Marketing & Growth
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Campus Ambassador Programs
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-[#9B9EA4] mt-1 max-w-2xl">
            Empower student creators and campus ambassadors to promote your events, award verified points, and track community-led ticket growth.
          </p>
        </div>

        <Button
          onClick={() => setIsCreateOpen(true)}
          className="w-full sm:w-auto bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-semibold text-xs h-10 px-4 rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer self-stretch sm:self-auto"
        >
          <Plus className="w-4 h-4 text-[#131517]" />
          <span>Create Program</span>
        </Button>
      </div>

      {/* ── 2. Summary Metrics ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-[#1A1C1F] rounded-2xl border border-slate-200 dark:border-[#2A2D31] p-3.5 sm:p-5 flex items-center gap-3 sm:gap-3.5 shadow-xs">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-orange-500/10 text-[#FE760B] flex items-center justify-center shrink-0 border border-[#FE760B]/20">
            <Layers className="w-4 h-4 sm:w-5 sm:h-5 text-[#FE760B]" />
          </div>
          <div className="min-w-0">
            <div className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
              {programs.length}
            </div>
            <div className="text-[11px] sm:text-xs text-slate-500 dark:text-[#9B9EA4] mt-0.5 truncate">Total Programs</div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#1A1C1F] rounded-2xl border border-slate-200 dark:border-[#2A2D31] p-3.5 sm:p-5 flex items-center gap-3 sm:gap-3.5 shadow-xs">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0 border border-emerald-500/20">
            <Users className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500" />
          </div>
          <div className="min-w-0">
            <div className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
              {totalAmbassadors}
            </div>
            <div className="text-[11px] sm:text-xs text-slate-500 dark:text-[#9B9EA4] mt-0.5 truncate">Active Ambassadors</div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#1A1C1F] rounded-2xl border border-slate-200 dark:border-[#2A2D31] p-3.5 sm:p-5 flex items-center gap-3 sm:gap-3.5 shadow-xs">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[#FE760B]/10 text-[#FE760B] flex items-center justify-center shrink-0 border border-[#FE760B]/20">
            <Award className="w-4 h-4 sm:w-5 sm:h-5 text-[#FE760B]" />
          </div>
          <div className="min-w-0">
            <div className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
              {totalPoints.toLocaleString("en-IN")}
            </div>
            <div className="text-[11px] sm:text-xs text-slate-500 dark:text-[#9B9EA4] mt-0.5 truncate">Points Distributed</div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#1A1C1F] rounded-2xl border border-slate-200 dark:border-[#2A2D31] p-3.5 sm:p-5 flex items-center gap-3 sm:gap-3.5 shadow-xs">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20">
            <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
          </div>
          <div className="min-w-0">
            <div className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
              {totalEvents}
            </div>
            <div className="text-[11px] sm:text-xs text-slate-500 dark:text-[#9B9EA4] mt-0.5 truncate">Connected Events</div>
          </div>
        </div>
      </div>

      {/* ── 3. Filters & Search ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#9B9EA4]" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search programs by name or campus..."
            className="pl-10 h-10 bg-white dark:bg-[#1A1C1F] border-slate-200 dark:border-[#2A2D31] text-xs rounded-xl focus:border-[#FE760B] w-full"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
          {["all", "published", "draft", "paused", "archived"].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-colors whitespace-nowrap cursor-pointer shrink-0 ${
                statusFilter === st
                  ? "bg-[#FE760B] text-[#131517]"
                  : "bg-white dark:bg-[#1A1C1F] text-slate-600 dark:text-[#9B9EA4] border border-slate-200 dark:border-[#2A2D31] hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* ── 4. Programs List ── */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#FE760B] mb-3" />
          <p className="text-xs text-slate-500 dark:text-[#9B9EA4]">Loading ambassador programs...</p>
        </div>
      ) : filteredPrograms.length === 0 ? (
        <div className="py-16 px-4 bg-white dark:bg-[#1A1C1F] rounded-2xl border border-slate-200 dark:border-[#2A2D31] text-center max-w-md mx-auto space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-orange-500/10 text-[#FE760B] flex items-center justify-center mx-auto">
            <Users className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            {searchQuery || statusFilter !== "all" ? "No matching programs found" : "No ambassador programs yet"}
          </h2>
          <p className="text-xs text-slate-500 dark:text-[#9B9EA4]">
            {searchQuery || statusFilter !== "all"
              ? "Try adjusting your search filters or status criteria."
              : "Create your first campus ambassador program to start recruiting student champions for your upcoming events."}
          </p>
          {!searchQuery && statusFilter === "all" && (
            <Button
              onClick={() => setIsCreateOpen(true)}
              className="bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-semibold text-xs h-9 px-4 rounded-xl mt-2 cursor-pointer"
            >
              <Plus className="w-4 h-4 mr-1 text-[#131517]" />
              Create First Program
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredPrograms.map((program) => {
            const statusConfig = {
              published: { bg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25", label: "Published" },
              draft: { bg: "bg-slate-500/10 text-slate-400 border-slate-500/25", label: "Draft" },
              paused: { bg: "bg-amber-500/10 text-amber-400 border-amber-500/25", label: "Paused" },
              archived: { bg: "bg-zinc-500/10 text-zinc-400 border-zinc-500/25", label: "Archived" },
            }[program.status] || { bg: "bg-slate-500/10 text-slate-400 border-slate-500/25", label: program.status };

            return (
              <div
                key={program.id}
                onClick={() => router.push(`/admin/programs/${program.id}`)}
                className="bg-white dark:bg-[#1A1C1F] rounded-2xl border border-slate-200 dark:border-[#2A2D31] p-5 hover:border-[#FE760B]/40 transition-all cursor-pointer group flex flex-col justify-between space-y-4 shadow-xs"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusConfig.bg}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      {statusConfig.label}
                    </span>
                    <span className="text-[11px] text-slate-400 dark:text-[#9B9EA4]">
                      {program.connectedEventsCount || program.connectedEvents?.length || 0} Events Linked
                    </span>
                  </div>

                  <h2 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-[#FE760B] transition-colors line-clamp-1">
                    {program.title || program.name || "Untitled Program"}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-[#9B9EA4] mt-1 line-clamp-2">
                    {program.description || "Campus ambassador incentive program with structured referral codes and rewards."}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-[#2A2D31]/80 grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 rounded-xl bg-slate-50 dark:bg-[#212327]">
                    <div className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                      {program.stats?.totalAmbassadors || program.ambassadorsCount || 0}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-[#9B9EA4] mt-0.5">Ambassadors</div>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50 dark:bg-[#212327]">
                    <div className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                      {(program.stats?.totalPointsIssued || 0).toLocaleString("en-IN")}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-[#9B9EA4] mt-0.5">Points</div>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50 dark:bg-[#212327]">
                    <div className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                      {program.stats?.pendingApplications || 0}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-[#9B9EA4] mt-0.5">Pending Apps</div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs font-semibold text-[#FE760B] pt-1">
                  <span>Open Management Hub</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── 5. Create Program Modal ── */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md transition-all overflow-y-auto animate-fade-in">
          <div className="relative w-full max-w-lg max-h-[92dvh] my-auto bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl sm:rounded-3xl flex flex-col shadow-2xl overflow-hidden text-white animate-scale-in">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#2A2D31] p-5 sm:p-6 shrink-0">
              <div className="space-y-1 pr-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#FE760B]/12 text-[#FE760B] flex items-center justify-center shrink-0 border border-[#FE760B]/25">
                    <Sparkles className="w-3.5 h-3.5 text-[#FE760B]" />
                  </div>
                  <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                    Create Ambassador Program
                  </h2>
                </div>
                <p className="text-xs text-[#9B9EA4]">
                  Start in Draft mode. You can connect events and adjust points rules before publishing.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#9B9EA4] hover:text-white hover:bg-[#2A2D31] transition-all cursor-pointer shrink-0"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <form onSubmit={handleCreate} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-5 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto custom-scrollbar flex-1">
                <div>
                  <label className="text-[11px] font-bold text-[#C5C8CD] uppercase tracking-wider block mb-1.5">
                    Associated Event <span className="text-[#9B9EA4] font-normal lowercase">(optional - can link later)</span>
                  </label>
                  <select
                    value={formData.eventId || ""}
                    onChange={(e) => {
                      const selectedEvt = availableEvents.find((ev) => (ev.id || ev._id) === e.target.value);
                      const autoTitle = selectedEvt ? `${selectedEvt.title || selectedEvt.name} Ambassador Program` : formData.title;
                      setFormData({
                        ...formData,
                        eventId: e.target.value,
                        title: formData.title || autoTitle,
                        name: formData.name || autoTitle,
                      });
                    }}
                    className="w-full h-11 px-3.5 rounded-xl bg-[#131517] border border-[#2A2D31] text-xs sm:text-sm text-white focus:outline-none focus:border-[#FE760B] focus:ring-2 focus:ring-[#FE760B]/20 transition-all cursor-pointer"
                  >
                    <option value="" className="bg-[#131517] text-white">
                      {loadingEvents ? "Loading your events..." : "Select an Event for this Program..."}
                    </option>
                    {availableEvents.map((ev) => (
                      <option key={ev.id || ev._id} value={ev.id || ev._id} className="bg-[#131517] text-white">
                        {ev.title || ev.name} ({ev.customSlug || ev.slug || ev.id || ev._id})
                      </option>
                    ))}
                    {!loadingEvents && availableEvents.length === 0 && (
                      <option value="" disabled className="bg-[#131517] text-[#9B9EA4]">
                        No created events found (you can link an event later)
                      </option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[#C5C8CD] uppercase tracking-wider block mb-1.5">
                    Program Title <span className="text-[#FE760B]">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value, name: e.target.value })}
                    placeholder="Enter program title"
                    className="w-full h-11 px-3.5 rounded-xl bg-[#131517] border border-[#2A2D31] text-xs sm:text-sm text-white placeholder:text-[#6C7075] focus:outline-none focus:border-[#FE760B] focus:ring-2 focus:ring-[#FE760B]/20 transition-all"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[#C5C8CD] uppercase tracking-wider block mb-1.5">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Enter program description and guidelines"
                    className="w-full p-3 rounded-xl bg-[#131517] border border-[#2A2D31] text-xs sm:text-sm text-white placeholder:text-[#6C7075] focus:outline-none focus:border-[#FE760B] focus:ring-2 focus:ring-[#FE760B]/20 transition-all resize-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[#C5C8CD] uppercase tracking-wider block mb-1.5">
                    Campus / Region Focus
                  </label>
                  <input
                    type="text"
                    value={formData.college}
                    onChange={(e) => setFormData({ ...formData, college: e.target.value })}
                    placeholder="Enter campus or region focus"
                    className="w-full h-11 px-3.5 rounded-xl bg-[#131517] border border-[#2A2D31] text-xs sm:text-sm text-white placeholder:text-[#6C7075] focus:outline-none focus:border-[#FE760B] focus:ring-2 focus:ring-[#FE760B]/20 transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="text-[11px] font-bold text-[#C5C8CD] uppercase tracking-wider block mb-1.5">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="w-full h-11 px-3.5 rounded-xl bg-[#131517] border border-[#2A2D31] text-xs sm:text-sm text-white focus:outline-none focus:border-[#FE760B] focus:ring-2 focus:ring-[#FE760B]/20 transition-all [color-scheme:dark]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-[#C5C8CD] uppercase tracking-wider block mb-1.5">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      className="w-full h-11 px-3.5 rounded-xl bg-[#131517] border border-[#2A2D31] text-xs sm:text-sm text-white focus:outline-none focus:border-[#FE760B] focus:ring-2 focus:ring-[#FE760B]/20 transition-all [color-scheme:dark]"
                    />
                  </div>
                </div>

                {/* Default Points Configuration Card */}
                <div className="p-4 sm:p-4.5 rounded-2xl bg-gradient-to-br from-[#FE760B]/[0.08] to-transparent border border-[#FE760B]/30 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-[#FE760B]/15 text-[#FE760B] flex items-center justify-center shrink-0 border border-[#FE760B]/25">
                      <Award className="w-4 h-4 text-[#FE760B]" />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-white uppercase tracking-wider block">
                        Default Points Engine
                      </span>
                      <span className="text-[10px] text-[#9B9EA4] block">
                        Ambassadors accumulate verified points on attendee registrations
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="text-[10px] font-bold text-[#9B9EA4] uppercase tracking-wider block mb-1">
                        Free Registration Points
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="1"
                          required
                          value={formData.basePointsPerTicket}
                          onChange={(e) => setFormData({ ...formData, basePointsPerTicket: e.target.value })}
                          className="w-full h-10 pl-3 pr-10 rounded-xl bg-[#131517] border border-[#2A2D31] text-xs sm:text-sm font-semibold text-white focus:outline-none focus:border-[#FE760B] focus:ring-2 focus:ring-[#FE760B]/20"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-[#71767B] pointer-events-none">
                          pts
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-[#9B9EA4] uppercase tracking-wider block mb-1">
                        Paid Ticket Multiplier
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="1"
                          step="0.5"
                          required
                          value={formData.paidMultiplier}
                          onChange={(e) => setFormData({ ...formData, paidMultiplier: e.target.value })}
                          className="w-full h-10 pl-3 pr-14 rounded-xl bg-[#131517] border border-[#2A2D31] text-xs sm:text-sm font-semibold text-white focus:outline-none focus:border-[#FE760B] focus:ring-2 focus:ring-[#FE760B]/20"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-[#71767B] pointer-events-none">
                          x base
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Pinned Actions */}
              <div className="p-4 sm:p-5 border-t border-[#2A2D31] flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 shrink-0 bg-[#16181B]">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-[#2A2D31] text-xs font-semibold text-[#D0D0D1] hover:bg-[#212327] hover:text-white transition-all cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#FE760B] hover:bg-[#FF8A2B] active:scale-[0.98] text-[#131517] text-xs font-bold shadow-md shadow-[#FE760B]/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-[#131517]" />
                      <span>Creating Program...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 text-[#131517]" />
                      <span>Create Program</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

