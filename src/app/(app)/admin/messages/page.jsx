"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Send,
  Plus,
  RotateCcw,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  X,
  Loader2,
} from "lucide-react";
import { EventControlHeader } from "@/components/admin/event-control-header";
import { getEvent } from "@/lib/firestore";

const INITIAL_BLASTS = [
  {
    id: "b1",
    title: "Venue change: Main Auditorium",
    body: "We've moved Tech Fest to the Main Auditorium so there's room for everyone.",
    status: "scheduled",
    dotColor: "bg-[#7AA2FF]",
    statusLabel: "Scheduled",
    statusBadgeCls:
      "bg-[#EFF6FF] dark:bg-[#192738] text-[#2563EB] dark:text-[#7AA2FF] border border-[#BFDBFE] dark:border-[#7AA2FF]/30",
    meta: "Fri, 6 Nov - 9:00 AM",
  },
  {
    id: "b2",
    title: "Your ticket is ready",
    body: "Bring the QR code in your inbox to the entry desk.",
    status: "sent",
    dotColor: "bg-[#3DD68C]",
    statusLabel: "Sent",
    statusBadgeCls:
      "bg-[#ECFDF5] dark:bg-[#183124] text-[#059669] dark:text-[#3DD68C] border border-[#A7F3D0] dark:border-[#3DD68C]/30",
    meta: "86 recipients - 2 Nov",
  },
  {
    id: "b3",
    title: "Speaker lineup announced",
    body: "Here's who is speaking at Tech Fest this year.",
    status: "failed",
    dotColor: "bg-[#FF6B6B]",
    statusLabel: "Failed",
    statusBadgeCls:
      "bg-[#FEF2F2] dark:bg-[#2A1717] text-[#DC2626] dark:text-[#FF6B6B] border border-[#FECACA] dark:border-[#FF6B6B]/30",
    meta: "Yesterday - 4:10 PM",
    canRetry: true,
  },
  {
    id: "b4",
    title: "Volunteers needed",
    body: "Want to help at the registration desk? Reply to this email.",
    status: "draft",
    dotColor: "bg-[#9B9EA4]",
    statusLabel: "Draft",
    statusBadgeCls:
      "bg-[#F8FAFC] dark:bg-[#212327] text-[#475569] dark:text-[#9B9EA4] border border-[#E2E8F0] dark:border-[#2A2D31]",
    meta: "Edited 3 days ago",
  },
];

export default function BlastsPage() {
  const searchParams = useSearchParams();
  const [blasts, setBlasts] = useState(INITIAL_BLASTS);
  const [filter, setFilter] = useState("all");
  const [quickInput, setQuickInput] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [currentEvent, setCurrentEvent] = useState(null);

  const eventIdParam = searchParams.get("eventId");

  // Load current event metadata if available
  useEffect(() => {
    let targetId = eventIdParam;
    if (!targetId && typeof window !== "undefined") {
      try {
        targetId = localStorage.getItem("admin_selected_event_id");
      } catch {}
    }
    if (targetId) {
      getEvent(targetId)
        .then((ev) => {
          if (ev) setCurrentEvent(ev);
        })
        .catch(() => {});
    }
  }, [eventIdParam]);

  const eventTitle = currentEvent?.name || "Tech Fest 2026";
  const eventSlug = currentEvent?.slug || "tech-fest-2026";
  const recipientCount =
    currentEvent?.totalRegistrations || currentEvent?.attendeesCount || 86;

  const filteredBlasts = useMemo(() => {
    if (filter === "all") return blasts;
    return blasts.filter((b) => b.status === filter);
  }, [blasts, filter]);

  const counts = useMemo(() => {
    return {
      all: blasts.length,
      sent: blasts.filter((b) => b.status === "sent").length,
      scheduled: blasts.filter((b) => b.status === "scheduled").length,
      failed: blasts.filter((b) => b.status === "failed").length,
      draft: blasts.filter((b) => b.status === "draft").length,
    };
  }, [blasts]);

  const handleSendQuickBlast = (e) => {
    e.preventDefault();
    if (!quickInput.trim()) return;
    const newEntry = {
      id: `b-${Date.now()}`,
      title: quickInput.trim(),
      body: "Instant broadcast sent to all registered attendees.",
      status: "sent",
      dotColor: "bg-[#3DD68C]",
      statusLabel: "Sent",
      statusBadgeCls:
        "bg-[#ECFDF5] dark:bg-[#183124] text-[#059669] dark:text-[#3DD68C] border border-[#A7F3D0] dark:border-[#3DD68C]/30",
      meta: `${recipientCount} recipients - Just now`,
    };
    setBlasts([newEntry, ...blasts]);
    setQuickInput("");
    toast.success(`Blast sent to ${recipientCount} guests!`);
  };

  const handleCreateBlast = () => {
    if (!newTitle.trim() || !newBody.trim()) {
      toast.error("Please fill in both the subject and the message");
      return;
    }
    setIsSending(true);
    setTimeout(() => {
      const newEntry = {
        id: `b-${Date.now()}`,
        title: newTitle.trim(),
        body: newBody.trim(),
        status: "sent",
        dotColor: "bg-[#3DD68C]",
        statusLabel: "Sent",
        statusBadgeCls:
          "bg-[#ECFDF5] dark:bg-[#183124] text-[#059669] dark:text-[#3DD68C] border border-[#A7F3D0] dark:border-[#3DD68C]/30",
        meta: `${recipientCount} recipients - Just now`,
      };
      setBlasts([newEntry, ...blasts]);
      setIsSending(false);
      setShowModal(false);
      setNewTitle("");
      setNewBody("");
      toast.success(`Blast sent to all ${recipientCount} registered attendees!`);
    }, 600);
  };

  const handleRetry = (blastId) => {
    setBlasts((prev) =>
      prev.map((b) =>
        b.id === blastId
          ? {
              ...b,
              status: "sent",
              statusLabel: "Sent",
              dotColor: "bg-[#3DD68C]",
              statusBadgeCls:
                "bg-[#ECFDF5] dark:bg-[#183124] text-[#059669] dark:text-[#3DD68C] border border-[#A7F3D0] dark:border-[#3DD68C]/30",
              meta: `${recipientCount} recipients - Retried just now`,
              canRetry: false,
            }
          : b
      )
    );
    toast.success("Blast retry dispatched successfully!");
  };

  return (
    <div className="py-4 sm:py-6 px-3 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full text-[#061A3F] dark:text-white selection:bg-[#FE760B] selection:text-white pb-16">
      {/* ── Standard Navigation Header (Blasts Tab active) ── */}
      <EventControlHeader
        activeTab="Blasts"
        eventTitle={eventTitle}
        eventSlug={eventSlug}
        eventId={eventIdParam}
        isLive={currentEvent?.published !== false}
      />

      {/* ── Title & New Blast Button matching Image 3 ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#061A3F] dark:text-white tracking-tight">
            Blasts
          </h2>
          <p className="text-xs text-[#64748B] dark:text-[#9B9EA4] mt-0.5">
            Email everyone registered for this event.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#061A3F] hover:bg-[#061A3F]/90 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-black text-xs font-bold transition-all shadow-sm border border-[#061A3F] dark:border-transparent self-start sm:self-auto"
        >
          <Plus size={14} />
          <span>New blast</span>
        </button>
      </div>

      {/* ── Quick Compose Input Bar (Properly Styled for Light & Dark) ── */}
      <form
        onSubmit={handleSendQuickBlast}
        className="bg-white dark:bg-[#1A1C1F] border border-[#D9DBE0] dark:border-[#2A2D31] rounded-2xl p-2.5 sm:p-3 flex items-center justify-between gap-3 mb-6 shadow-sm transition-all focus-within:border-[#FE760B] focus-within:ring-2 focus-within:ring-[#FE760B]/15"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-full bg-[#FE760B] text-black font-extrabold text-xs flex items-center justify-center shrink-0 shadow-sm select-none">
            TO
          </div>
          <input
            type="text"
            value={quickInput}
            onChange={(e) => setQuickInput(e.target.value)}
            placeholder={`Send a blast to ${recipientCount} guests…`}
            className="tl-bare-input w-full bg-transparent border-none text-xs sm:text-sm text-[#061A3F] dark:text-white placeholder-[#64748B] dark:placeholder-[#9B9EA4] outline-none focus:outline-none focus:ring-0"
          />
        </div>
        <button
          type="submit"
          disabled={!quickInput.trim()}
          className={`p-2 sm:p-2.5 rounded-xl transition-all shrink-0 flex items-center justify-center ${
            quickInput.trim()
              ? "bg-[#FE760B] text-black hover:bg-[#FE760B]/90 shadow-sm cursor-pointer"
              : "text-[#94A3B8] dark:text-[#5C6066] cursor-not-allowed opacity-60"
          }`}
          title="Send blast"
        >
          <Send size={16} />
        </button>
      </form>

      {/* ── Filter Pills matching Image 3 ── */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto no-scrollbar">
        {[
          { id: "all", label: `All ${counts.all}` },
          { id: "sent", label: `Sent ${counts.sent}` },
          { id: "scheduled", label: `Scheduled ${counts.scheduled}` },
          { id: "failed", label: `Failed ${counts.failed}` },
          { id: "draft", label: `Draft ${counts.draft}` },
        ].map((item) => {
          const isActive = filter === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
                isActive
                  ? "bg-[#061A3F] text-white dark:bg-white dark:text-black shadow-sm"
                  : "bg-white dark:bg-[#1A1C1F] text-[#64748B] dark:text-[#9B9EA4] hover:text-[#061A3F] dark:hover:text-white border border-[#D9DBE0] dark:border-[#2A2D31]"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {/* ── List of Blasts matching Image 3 ── */}
      <div className="bg-white dark:bg-[#1A1C1F] border border-[#D9DBE0] dark:border-[#2A2D31] rounded-2xl divide-y divide-[#D9DBE0] dark:divide-[#2A2D31] overflow-hidden shadow-sm">
        {filteredBlasts.length === 0 ? (
          <div className="p-10 text-center text-xs text-[#64748B] dark:text-[#9B9EA4]">
            No blasts in this category.
          </div>
        ) : (
          filteredBlasts.map((b) => (
            <div
              key={b.id}
              className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#F2EFE8]/50 dark:hover:bg-[#212327]/40 transition-colors"
            >
              {/* Left Column: Dot + Title + Subtitle */}
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <span
                  className={`w-2 h-2 rounded-full ${b.dotColor} mt-1.5 shrink-0`}
                />
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-bold text-[#061A3F] dark:text-white truncate">
                    {b.title}
                  </h3>
                  <p className="text-xs text-[#64748B] dark:text-[#9B9EA4] mt-0.5 line-clamp-1">
                    {b.body}
                  </p>
                </div>
              </div>

              {/* Right Column: Status Badge + Meta + Actions */}
              <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1.5 shrink-0 pl-5 sm:pl-0">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${b.statusBadgeCls}`}
                >
                  {b.statusLabel}
                </span>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-[#64748B] dark:text-[#9B9EA4]">
                    {b.meta}
                  </span>
                  {b.canRetry && (
                    <button
                      type="button"
                      onClick={() => handleRetry(b.id)}
                      className="text-xs font-semibold text-[#061A3F] dark:text-white hover:text-[#FE760B] dark:hover:text-[#FE760B] transition-colors ml-1"
                    >
                      Retry
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Compose Modal for + New Blast ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1A1C1F] border border-[#D9DBE0] dark:border-[#2A2D31] rounded-2xl w-full max-w-lg p-5 sm:p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#D9DBE0] dark:border-[#2A2D31] mb-4">
              <h3 className="text-base font-bold text-[#061A3F] dark:text-white">
                Create New Blast
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-[#64748B] dark:text-[#9B9EA4] hover:text-[#061A3F] dark:hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-[#1E293B] dark:text-[#D0D0D1] block mb-1.5">
                  Subject Line *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Venue change or important update"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-[#F2EFE8] dark:bg-[#212327] border border-[#D9DBE0] dark:border-[#2A2D31] rounded-xl px-3.5 py-2.5 text-xs text-[#061A3F] dark:text-white placeholder-[#64748B] dark:placeholder-[#9B9EA4] outline-none focus:border-[#FE760B]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#1E293B] dark:text-[#D0D0D1] block mb-1.5">
                  Email Message Body *
                </label>
                <textarea
                  rows={4}
                  placeholder={`Write the message that will be delivered to all ${recipientCount} registered attendees...`}
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                  className="w-full bg-[#F2EFE8] dark:bg-[#212327] border border-[#D9DBE0] dark:border-[#2A2D31] rounded-xl px-3.5 py-2.5 text-xs text-[#061A3F] dark:text-white placeholder-[#64748B] dark:placeholder-[#9B9EA4] outline-none focus:border-[#FE760B] resize-none"
                />
              </div>

              <div className="p-3 rounded-xl bg-[#F2EFE8] dark:bg-[#212327] border border-[#D9DBE0] dark:border-[#2A2D31] text-[11px] text-[#64748B] dark:text-[#9B9EA4]">
                This blast will immediately send an email notification to{" "}
                <span className="text-[#061A3F] dark:text-white font-semibold">
                  {recipientCount} guests
                </span>{" "}
                registered for {eventTitle}.
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-white dark:bg-[#212327] hover:bg-slate-100 dark:hover:bg-[#2A2D31] text-xs font-semibold text-[#1E293B] dark:text-[#D0D0D1] border border-[#D9DBE0] dark:border-[#2A2D31] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSending}
                  onClick={handleCreateBlast}
                  className="px-4 py-2 rounded-xl bg-[#FE760B] hover:bg-[#FE760B]/90 text-black text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                >
                  {isSending && <Loader2 size={13} className="animate-spin" />}
                  <span>Send blast now</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
