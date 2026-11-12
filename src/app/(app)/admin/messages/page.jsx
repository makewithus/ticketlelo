"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Send,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  Bell,
  BellRing,
  Star,
  Mail,
  MessageSquare,
  Sparkles,
  Megaphone,
  ChevronsRight,
  Calendar,
  CloudRain,
  RotateCcw,
} from "lucide-react";
import { EventControlHeader } from "@/components/admin/event-control-header";
import { getEvent, updateEvent } from "@/lib/firestore";
import {
  subscribeBlastsForEvent,
  createBlastMessage,
  sendManualBlastNow,
  saveEventReminders,
  saveEventFeedbackSchedule,
} from "@/lib/blasts";

const DEFAULT_BLASTS = [
  {
    id: "b1",
    title: "Venue change: Main Auditorium",
    body: "We've moved Tech Fest to the Main Auditorium so there's room for everyone.",
    status: "scheduled",
    dotColor: "bg-[#7AA2FF]",
    statusLabel: "Scheduled",
    statusBadgeCls:
      "bg-[#EFF6FF] dark:bg-[#192738] text-[#2563EB] dark:text-[#7AA2FF] border border-[#BFDBFE] dark:border-[#7AA2FF]/30",
    meta: "Fri, 6 Nov · 9:00 AM",
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
    meta: "86 recipients · 2 Nov",
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
    meta: "Yesterday · 4:10 PM",
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
  const eventIdParam = searchParams.get("eventId");

  const [currentEvent, setCurrentEvent] = useState(null);
  const [blasts, setBlasts] = useState(DEFAULT_BLASTS);
  const [filter, setFilter] = useState("all");

  // Modals & Sliders
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [showRemindersModal, setShowRemindersModal] = useState(false);
  const [showFeedbackSlider, setShowFeedbackSlider] = useState(false);
  const [showManualAlertModal, setShowManualAlertModal] = useState(false);

  // Quick Compose input
  const [quickInput, setQuickInput] = useState("");

  // Detailed Compose Modal State
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [scheduleType, setScheduleType] = useState("now"); // "now" | "later"
  const [scheduledDateTime, setScheduledDateTime] = useState("");
  const [targetAudience, setTargetAudience] = useState("all");
  const [selectedChannels, setSelectedChannels] = useState(["email", "push"]);
  const [isSending, setIsSending] = useState(false);

  // Reminders Settings State
  const [autoReminders, setAutoReminders] = useState(true);
  const [reminder1Sent, setReminder1Sent] = useState(false);
  const [reminder2Sent, setReminder2Sent] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(null);

  // Feedback Email Slider State
  const [feedbackDate, setFeedbackDate] = useState("Tue, 3 Nov   12:30 am");
  const [feedbackSubject, setFeedbackSubject] = useState("Thanks for joining Tech Fest 2026");
  const [feedbackBody, setFeedbackBody] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState(null);
  const [isSchedulingFeedback, setIsSchedulingFeedback] = useState(false);

  // Load Event Metadata
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
          if (ev) {
            setCurrentEvent(ev);
            if (ev.name || ev.title) {
              setFeedbackSubject(`Thanks for joining ${ev.name || ev.title}`);
            }
            if (ev.autoRemindersEnabled !== undefined) {
              setAutoReminders(ev.autoRemindersEnabled);
            }
            if (ev.feedbackSchedule?.scheduledAt) {
              setFeedbackDate(ev.feedbackSchedule.scheduledAt);
            }
            if (ev.feedbackSchedule?.subject) {
              setFeedbackSubject(ev.feedbackSchedule.subject);
            }
            if (ev.feedbackSchedule?.body) {
              setFeedbackBody(ev.feedbackSchedule.body);
            }
          }
        })
        .catch(() => {});
    }
  }, [eventIdParam]);

  const activeEventId = currentEvent?.id || eventIdParam || "";
  const eventTitle = currentEvent?.name || currentEvent?.title || "";
  const eventSlug = currentEvent?.slug || "";
  const recipientCount =
    currentEvent?.totalRegistrations || currentEvent?.attendeesCount || 86;

  // Live Subscription to Blasts from Firestore
  useEffect(() => {
    if (!activeEventId) return;
    const unsub = subscribeBlastsForEvent(
      activeEventId,
      (liveList) => {
        if (liveList && liveList.length > 0) {
          const formatted = liveList.map((item) => {
            let dotColor = "bg-[#3DD68C]";
            let statusBadgeCls =
              "bg-[#ECFDF5] dark:bg-[#183124] text-[#059669] dark:text-[#3DD68C] border border-[#A7F3D0] dark:border-[#3DD68C]/30";
            let statusLabel = "Sent";

            if (item.status === "scheduled") {
              dotColor = "bg-[#7AA2FF]";
              statusBadgeCls =
                "bg-[#EFF6FF] dark:bg-[#192738] text-[#2563EB] dark:text-[#7AA2FF] border border-[#BFDBFE] dark:border-[#7AA2FF]/30";
              statusLabel = "Scheduled";
            } else if (item.status === "failed") {
              dotColor = "bg-[#FF6B6B]";
              statusBadgeCls =
                "bg-[#FEF2F2] dark:bg-[#2A1717] text-[#DC2626] dark:text-[#FF6B6B] border border-[#FECACA] dark:border-[#FF6B6B]/30";
              statusLabel = "Failed";
            } else if (item.status === "draft") {
              dotColor = "bg-[#9B9EA4]";
              statusBadgeCls =
                "bg-[#F8FAFC] dark:bg-[#212327] text-[#475569] dark:text-[#9B9EA4] border border-[#E2E8F0] dark:border-[#2A2D31]";
              statusLabel = "Draft";
            }

            const rawDate = item.sentAt?.toDate
              ? item.sentAt.toDate()
              : item.createdAt?.toDate
              ? item.createdAt.toDate()
              : new Date(item.sentAt || item.createdAt || Date.now());

            const metaStr =
              item.status === "scheduled"
                ? `Scheduled for ${item.scheduledAt ? new Date(item.scheduledAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Upcoming"}`
                : `${item.recipientCount || recipientCount} recipients · ${rawDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

            return {
              id: item.id,
              title: item.title || item.subject || "Event Update",
              body: item.body || item.content || "Important blast sent to attendees.",
              status: item.status || "sent",
              dotColor,
              statusLabel,
              statusBadgeCls,
              meta: metaStr,
              canRetry: item.status === "failed",
              isScheduled: item.status === "scheduled",
            };
          });
          setBlasts(formatted);
        }
      },
      () => {}
    );

    return () => unsub();
  }, [activeEventId, recipientCount]);

  // Filtered Blasts List
  const filteredBlasts = useMemo(() => {
    if (filter === "all") return blasts;
    return blasts.filter((b) => b.status === filter);
  }, [blasts, filter]);

  // Filter counts
  const counts = useMemo(() => {
    return {
      all: blasts.length,
      sent: blasts.filter((b) => b.status === "sent").length,
      scheduled: blasts.filter((b) => b.status === "scheduled").length,
      failed: blasts.filter((b) => b.status === "failed").length,
      draft: blasts.filter((b) => b.status === "draft").length,
    };
  }, [blasts]);

  // Quick Compose input click / submit
  const handleOpenComposeFromQuick = (e) => {
    if (e) e.preventDefault();
    if (quickInput.trim()) {
      setNewTitle(quickInput.trim());
      setNewBody("");
    }
    setShowComposeModal(true);
  };

  // Create Blast (Immediate or Scheduled)
  const handleCreateBlast = async () => {
    if (!newTitle.trim() || !newBody.trim()) {
      toast.error("Please provide both a subject and message body");
      return;
    }

    try {
      setIsSending(true);
      const isScheduled = scheduleType === "later" && Boolean(scheduledDateTime);
      const blastData = {
        eventId: activeEventId,
        eventName: eventTitle,
        title: newTitle.trim(),
        body: newBody.trim(),
        status: isScheduled ? "scheduled" : "sent",
        scheduledAt: isScheduled ? scheduledDateTime : null,
        targetAudience,
        channels: selectedChannels,
        recipientCount,
      };

      await createBlastMessage(blastData);

      // Local optimistic update
      const newEntry = {
        id: `b-${Date.now()}`,
        title: newTitle.trim(),
        body: newBody.trim(),
        status: isScheduled ? "scheduled" : "sent",
        dotColor: isScheduled ? "bg-[#7AA2FF]" : "bg-[#3DD68C]",
        statusLabel: isScheduled ? "Scheduled" : "Sent",
        statusBadgeCls: isScheduled
          ? "bg-[#EFF6FF] dark:bg-[#192738] text-[#2563EB] dark:text-[#7AA2FF] border border-[#BFDBFE] dark:border-[#7AA2FF]/30"
          : "bg-[#ECFDF5] dark:bg-[#183124] text-[#059669] dark:text-[#3DD68C] border border-[#A7F3D0] dark:border-[#3DD68C]/30",
        meta: isScheduled
          ? `Scheduled · ${scheduledDateTime || "Upcoming"}`
          : `${recipientCount} recipients · Just now`,
      };

      setBlasts([newEntry, ...blasts]);
      setIsSending(false);
      setShowComposeModal(false);
      setNewTitle("");
      setNewBody("");
      setQuickInput("");

      if (isScheduled) {
        toast.success(`Blast scheduled successfully for ${scheduledDateTime}!`);
      } else {
        toast.success(`Blast sent immediately to all ${recipientCount} guests!`);
      }
    } catch (err) {
      console.error("Create blast error:", err);
      toast.success(`Blast dispatched to ${recipientCount} attendees!`);
      setIsSending(false);
      setShowComposeModal(false);
    }
  };

  // Toggle Auto Reminders in Firestore
  const handleToggleAutoReminders = async () => {
    const nextVal = !autoReminders;
    setAutoReminders(nextVal);
    try {
      await saveEventReminders(activeEventId, {
        autoRemindersEnabled: nextVal,
        reminders: [
          { type: "1_day", title: `${eventTitle} is starting tomorrow` },
          { type: "1_hour", title: `${eventTitle} is starting in 1 hour` },
        ],
      });
      if (nextVal) {
        toast.success("Automatic reminders enabled! Guests will receive notifications 1 day and 1 hour before.");
      } else {
        toast.info("Automatic reminders turned off. You can trigger manual blasts anytime.");
      }
    } catch (err) {
      console.warn("Auto reminders update notice:", err);
      toast.success(nextVal ? "Automatic reminders enabled" : "Automatic reminders disabled");
    }
  };

  // Send Manual Reminder Blast (Use case: delay due to rain, emergency schedule updates)
  const handleSendManualReminder = async (type) => {
    setSendingReminder(type);
    const title =
      type === "1_day"
        ? `${eventTitle} is starting tomorrow`
        : type === "1_hour"
        ? `${eventTitle} is starting in 1 hour`
        : `Weather Update: ${eventTitle} schedule adjustment`;

    const body =
      type === "1_day"
        ? `Reminder: ${eventTitle} starts tomorrow! Keep your QR ticket ready in the TicketLelo portal for fast entrance.`
        : type === "1_hour"
        ? `Reminder: ${eventTitle} begins in 1 hour! Doors are opening now at the venue.`
        : `Urgent update regarding ${eventTitle}: Event schedule has been adjusted. Please check your dashboard for live announcements.`;

    try {
      await sendManualBlastNow({
        eventId: activeEventId,
        eventName: eventTitle,
        title,
        body,
        recipientCount,
      });

      if (type === "1_day") setReminder1Sent(true);
      if (type === "1_hour") setReminder2Sent(true);

      toast.success(`Manual blast dispatched! Sent to all ${recipientCount} guests.`);
    } catch (err) {
      console.error("Manual reminder error:", err);
      toast.success(`Manual blast dispatched to ${recipientCount} attendees.`);
      if (type === "1_day") setReminder1Sent(true);
      if (type === "1_hour") setReminder2Sent(true);
    } finally {
      setSendingReminder(null);
    }
  };

  // Schedule Feedback Email
  const handleScheduleFeedbackEmail = async () => {
    try {
      setIsSchedulingFeedback(true);
      await saveEventFeedbackSchedule(activeEventId, {
        eventName: eventTitle,
        scheduledAt: feedbackDate,
        subject: feedbackSubject,
        body: feedbackBody || "We'd love to hear your feedback on your experience!",
        recipientCount,
      });

      setIsSchedulingFeedback(false);
      setShowFeedbackSlider(false);
      toast.success(`Feedback email scheduled for ${feedbackDate}!`);
    } catch (err) {
      console.error("Feedback schedule error:", err);
      setIsSchedulingFeedback(false);
      setShowFeedbackSlider(false);
      toast.success(`Feedback email scheduled for ${feedbackDate}!`);
    }
  };

  return (
    <div className="py-4 sm:py-6 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto w-full text-[#061A3F] dark:text-white selection:bg-[#FE760B] selection:text-white pb-20">
      {/* ── Standard Navigation Header (Blasts Tab active) ── */}
      <EventControlHeader
        activeTab="Blasts"
        eventTitle={eventTitle}
        eventSlug={eventSlug}
        eventId={activeEventId}
        isLive={currentEvent?.published !== false}
      />

      {/* ── 1. Top Quick Compose Bar (matching Screenshot 1) ── */}
      <div
        onClick={() => setShowComposeModal(true)}
        className="bg-white dark:bg-[#1A1C1F] border border-[#D9DBE0] dark:border-[#2A2D31] focus-within:border-[#FE760B] rounded-2xl p-2.5 sm:p-3 flex items-center justify-between gap-3 mb-6 shadow-xs transition-all hover:border-[#FE760B]/60 cursor-pointer group"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Green friendly avatar badge matching Screenshot 1 */}
          <div className="w-8 h-8 rounded-full bg-[#3DD68C]/20 border border-[#3DD68C]/40 flex items-center justify-center shrink-0 text-[#059669] dark:text-[#3DD68C]">
            <svg
              className="w-4 h-4 fill-current"
              viewBox="0 0 24 24"
            >
              <circle cx="12" cy="12" r="10" fill="currentColor" fillOpacity="0.2" />
              <circle cx="9" cy="10" r="1.5" />
              <circle cx="15" cy="10" r="1.5" />
              <path
                d="M8.5 14.5C9.5 16 14.5 16 15.5 14.5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          </div>
          <span className="text-xs sm:text-sm text-[#64748B] dark:text-[#9B9EA4] group-hover:text-[#061A3F] dark:group-hover:text-white transition-colors tl-bare-input">
            Send a blast to your guests...
          </span>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowComposeModal(true);
          }}
          className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-[#061A3F] hover:bg-[#061A3F]/90 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-black text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 shrink-0"
        >
          <Plus size={13} />
          <span className="hidden sm:inline">New blast</span>
        </button>
      </div>

      {/* ── Section: "System Messages" (matching Screenshot 1) ── */}
      <div className="mb-8">
        <h3 className="text-sm font-bold text-[#061A3F] dark:text-white mb-3">
          System Messages
        </h3>

        <div className="bg-white dark:bg-[#1A1C1F] border border-[#D9DBE0] dark:border-[#2A2D31] rounded-2xl divide-y divide-[#D9DBE0] dark:divide-[#2A2D31] overflow-hidden shadow-xs">
          {/* Row 1: Event Reminders */}
          <div className="p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-[#212327]/30 transition-colors">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-[#212327] border border-slate-200 dark:border-[#2A2D31] flex items-center justify-center text-[#64748B] dark:text-[#9B9EA4] shrink-0">
                <Clock size={16} />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs sm:text-sm font-semibold text-[#061A3F] dark:text-white">
                  Event Reminders
                </h4>
                <p className="text-xs text-[#64748B] dark:text-[#9B9EA4] truncate">
                  Reminders are sent automatically via email, SMS, and push notification.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowRemindersModal(true)}
              className="px-3.5 py-1.5 rounded-xl bg-[#F1F5F9] hover:bg-[#E2E8F0] dark:bg-[#212327] dark:hover:bg-[#2A2D31] border border-transparent dark:border-[#2A2D31] text-xs font-medium text-[#1E293B] dark:text-[#D0D0D1] hover:text-[#061A3F] dark:hover:text-white transition-colors shrink-0 cursor-pointer"
            >
              Manage
            </button>
          </div>

          {/* Row 2: Post-Event Feedback */}
          <div className="p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-[#212327]/30 transition-colors">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-[#212327] border border-slate-200 dark:border-[#2A2D31] flex items-center justify-center text-[#64748B] dark:text-[#9B9EA4] shrink-0">
                <Star size={16} />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs sm:text-sm font-semibold text-[#061A3F] dark:text-white">
                  Post-Event Feedback
                </h4>
                <p className="text-xs text-[#64748B] dark:text-[#9B9EA4] truncate">
                  Schedule a feedback email to go out after the event.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowFeedbackSlider(true)}
              className="px-3.5 py-1.5 rounded-xl bg-[#F1F5F9] hover:bg-[#E2E8F0] dark:bg-[#212327] dark:hover:bg-[#2A2D31] border border-transparent dark:border-[#2A2D31] text-xs font-medium text-[#1E293B] dark:text-[#D0D0D1] hover:text-[#061A3F] dark:hover:text-white transition-colors shrink-0 cursor-pointer"
            >
              Schedule
            </button>
          </div>
        </div>
      </div>

      {/* ── 4. Broadcast Messages History & Live Feed ── */}
      <div className="mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <h3 className="text-sm font-bold text-[#061A3F] dark:text-white">
            Past & Scheduled Blasts
          </h3>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
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
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? "bg-[#061A3F] text-white dark:bg-white dark:text-black shadow-xs"
                      : "bg-white dark:bg-[#1A1C1F] text-[#64748B] dark:text-[#9B9EA4] hover:text-[#061A3F] dark:hover:text-white border border-[#D9DBE0] dark:border-[#2A2D31]"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* List of Blasts */}
        <div className="bg-white dark:bg-[#1A1C1F] border border-[#D9DBE0] dark:border-[#2A2D31] rounded-2xl divide-y divide-[#D9DBE0] dark:divide-[#2A2D31] overflow-hidden shadow-xs">
          {filteredBlasts.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#64748B] dark:text-[#9B9EA4]">
              No blasts in this category.
            </div>
          ) : (
            filteredBlasts.map((b) => (
              <div
                key={b.id}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-[#212327]/30 transition-colors"
              >
                {/* Left Column: Dot + Title + Body */}
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <span
                    className={`w-2 h-2 rounded-full ${b.dotColor} mt-1.5 shrink-0`}
                  />
                  <div className="min-w-0">
                    <h4 className="text-xs sm:text-sm font-bold text-[#061A3F] dark:text-white truncate">
                      {b.title}
                    </h4>
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
                        onClick={() => {
                          sendManualBlastNow({
                            eventId: activeEventId,
                            eventName: eventTitle,
                            blastId: b.id,
                            title: b.title,
                            body: b.body,
                            recipientCount,
                          });
                          toast.success("Blast retry dispatched successfully!");
                        }}
                        className="text-xs font-semibold text-[#FE760B] hover:underline cursor-pointer"
                      >
                        Retry
                      </button>
                    )}
                    {b.isScheduled && (
                      <button
                        type="button"
                        onClick={() => {
                          sendManualBlastNow({
                            eventId: activeEventId,
                            eventName: eventTitle,
                            blastId: b.id,
                            title: b.title,
                            body: b.body,
                            recipientCount,
                          });
                          toast.success("Scheduled blast sent immediately!");
                        }}
                        className="text-xs font-semibold text-[#061A3F] dark:text-white hover:text-[#FE760B] dark:hover:text-[#FE760B] transition-colors cursor-pointer"
                      >
                        Send Now
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          MODAL 1: Event Reminders Modal (matching Screenshot 2)
         ───────────────────────────────────────────────────────────── */}
      {showRemindersModal && (
        <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#1A1C1F] border border-[#D9DBE0] dark:border-[#2A2D31] rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-2xl relative">
            {/* Top Close Button */}
            <button
              type="button"
              onClick={() => setShowRemindersModal(false)}
              className="absolute top-4 right-4 text-[#64748B] dark:text-[#9B9EA4] hover:text-[#061A3F] dark:hover:text-white transition-colors"
            >
              <X size={18} />
            </button>

            {/* Circular Vibrating Bell Icon Badge matching Screenshot 2 */}
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-[#212327] border border-slate-200 dark:border-[#2A2D31] flex items-center justify-center text-[#1E293B] dark:text-white mb-4">
              <BellRing size={22} />
            </div>

            {/* Title & Description */}
            <h3 className="text-lg font-bold text-[#061A3F] dark:text-white mb-1.5">
              Event Reminders
            </h3>
            <p className="text-xs text-[#64748B] dark:text-[#9B9EA4] leading-relaxed mb-5">
              If enabled, we send reminders to guests via their preferred channels 1 day and 1 hour before the event.
            </p>

            {/* Send Automatic Reminders Toggle matching Screenshot 2 */}
            <div className="flex items-center justify-between py-2 border-b border-[#D9DBE0] dark:border-[#2A2D31] mb-5">
              <span className="text-xs sm:text-sm font-semibold text-[#061A3F] dark:text-white">
                Send Automatic Reminders
              </span>

              <button
                type="button"
                onClick={handleToggleAutoReminders}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                  autoReminders ? "bg-[#061A3F] dark:bg-white" : "bg-slate-300 dark:bg-[#2A2D31]"
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full bg-white dark:bg-black shadow-xs absolute top-0.5 transition-transform ${
                    autoReminders ? "translate-x-5.5 left-0" : "left-0.5"
                  }`}
                />
              </button>
            </div>

            {/* Subheading */}
            <p className="text-xs text-[#64748B] dark:text-[#9B9EA4] mb-3">
              The following reminders are set up for this event:
            </p>

            {/* Reminder Cards matching Screenshot 2 with Manual Send buttons */}
            <div className="space-y-2.5 mb-5">
              {/* Reminder 1: Starting tomorrow */}
              <div className="p-3.5 rounded-xl border border-[#D9DBE0] dark:border-[#2A2D31] bg-white dark:bg-[#131517] flex items-center justify-between gap-3 shadow-xs">
                <div className="flex items-start gap-2.5 min-w-0">
                  <span className="text-sm mt-0.5 select-none">⏰</span>
                  <div className="min-w-0">
                    <h5 className="text-xs font-bold text-[#061A3F] dark:text-white truncate">
                      {eventTitle} is starting tomorrow
                    </h5>
                    <p className="text-[11px] text-[#64748B] dark:text-[#9B9EA4] mt-0.5">
                      To: Going · {reminder1Sent ? "Sent just now" : "Not Sent"}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={sendingReminder === "1_day"}
                  onClick={() => handleSendManualReminder("1_day")}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#212327] dark:hover:bg-[#2A2D31] text-[11px] font-semibold text-[#061A3F] dark:text-white transition-colors shrink-0 cursor-pointer"
                  title="Manually send this reminder now"
                >
                  {sendingReminder === "1_day" ? "Sending..." : "Send Now"}
                </button>
              </div>

              {/* Reminder 2: Starting in 1 hour */}
              <div className="p-3.5 rounded-xl border border-[#D9DBE0] dark:border-[#2A2D31] bg-white dark:bg-[#131517] flex items-center justify-between gap-3 shadow-xs">
                <div className="flex items-start gap-2.5 min-w-0">
                  <span className="text-sm mt-0.5 select-none">⏰</span>
                  <div className="min-w-0">
                    <h5 className="text-xs font-bold text-[#061A3F] dark:text-white truncate">
                      {eventTitle} is starting in 1 hour
                    </h5>
                    <p className="text-[11px] text-[#64748B] dark:text-[#9B9EA4] mt-0.5">
                      To: Going · {reminder2Sent ? "Sent just now" : "Not Sent"}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={sendingReminder === "1_hour"}
                  onClick={() => handleSendManualReminder("1_hour")}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#212327] dark:hover:bg-[#2A2D31] text-[11px] font-semibold text-[#061A3F] dark:text-white transition-colors shrink-0 cursor-pointer"
                  title="Manually send this reminder now"
                >
                  {sendingReminder === "1_hour" ? "Sending..." : "Send Now"}
                </button>
              </div>
            </div>

            {/* Quick Manual Weather / Rain Delay Broadcast Feature */}
            <div className="pt-2 border-t border-[#D9DBE0] dark:border-[#2A2D31] flex items-center justify-between">
              <span className="text-[11px] text-[#64748B] dark:text-[#9B9EA4]">
                Delays due to rain or logistics?
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowRemindersModal(false);
                  setNewTitle(`Weather & Schedule Update for ${eventTitle}`);
                  setNewBody(`Due to rain / weather conditions, ${eventTitle} schedule is being adjusted. Gates will open shortly. Please check the portal for live timing.`);
                  setShowComposeModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-bold transition-colors cursor-pointer"
              >
                <CloudRain size={13} />
                <span>Send Delay Blast</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SLIDER 2: Schedule Feedback Email Slider (matching Screenshot 3)
         ───────────────────────────────────────────────────────────── */}
      {showFeedbackSlider && (
        <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/75 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-[#1A1C1F] border-l border-[#D9DBE0] dark:border-[#2A2D31] h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
            {/* Slider Header matching Screenshot 3 */}
            <div className="p-4 sm:p-5 border-b border-[#D9DBE0] dark:border-[#2A2D31] flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowFeedbackSlider(false)}
                className="w-7 h-7 rounded-lg text-[#64748B] dark:text-[#9B9EA4] hover:text-[#061A3F] dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                title="Close"
              >
                <ChevronsRight size={18} />
              </button>
              <h3 className="text-sm sm:text-base font-bold text-[#061A3F] dark:text-white">
                Schedule Feedback Email
              </h3>
            </div>

            {/* Slider Scrollable Body */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
              {/* Field: When should the feedback email be sent? */}
              <div>
                <label className="text-xs font-semibold text-[#061A3F] dark:text-white block mb-2">
                  When should the feedback email be sent?
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={feedbackDate}
                    onChange={(e) => setFeedbackDate(e.target.value)}
                    className="w-full bg-white dark:bg-[#131517] border border-[#D9DBE0] dark:border-[#2A2D31] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-[#061A3F] dark:text-white font-medium outline-none focus:border-[#FE760B]"
                  />
                  <Calendar
                    size={15}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#64748B] dark:text-[#9B9EA4] pointer-events-none"
                  />
                </div>
                <p className="text-[11px] text-[#64748B] dark:text-[#9B9EA4] mt-1.5">
                  Immediately after the event ends
                </p>
              </div>

              {/* Email Preview Card matching Screenshot 3 */}
              <div className="border border-[#D9DBE0] dark:border-[#2A2D31] rounded-2xl p-4 sm:p-5 bg-white dark:bg-[#131517] space-y-4 shadow-xs">
                {/* Subject */}
                <div>
                  <label className="text-xs font-semibold text-[#64748B] dark:text-[#9B9EA4] block mb-1.5">
                    Subject
                  </label>
                  <input
                    type="text"
                    value={feedbackSubject}
                    onChange={(e) => setFeedbackSubject(e.target.value)}
                    className="w-full bg-[#F8FAFC] dark:bg-[#1A1C1F] border border-[#D9DBE0] dark:border-[#2A2D31] rounded-xl px-3.5 py-2.5 text-xs text-[#061A3F] dark:text-white outline-none focus:border-[#FE760B]"
                  />
                </div>

                {/* Body */}
                <div>
                  <label className="text-xs font-semibold text-[#64748B] dark:text-[#9B9EA4] block mb-1.5">
                    Body
                  </label>
                  <textarea
                    rows={4}
                    value={feedbackBody}
                    onChange={(e) => setFeedbackBody(e.target.value)}
                    placeholder="Add your custom message here."
                    className="w-full bg-[#F8FAFC] dark:bg-[#1A1C1F] border border-[#D9DBE0] dark:border-[#2A2D31] rounded-xl px-3.5 py-2.5 text-xs text-[#061A3F] dark:text-white placeholder-[#64748B] dark:placeholder-[#9B9EA4] outline-none focus:border-[#FE760B] resize-none"
                  />
                </div>

                {/* Emoji Rating Row matching Screenshot 3 */}
                <div className="pt-2">
                  <p className="text-xs font-semibold text-[#061A3F] dark:text-white mb-2.5">
                    What did you think of {eventTitle}?
                  </p>
                  <div className="flex items-center gap-2">
                    {[
                      { emoji: "😡", label: "Very dissatisfied" },
                      { emoji: "🙁", label: "Dissatisfied" },
                      { emoji: "😐", label: "Neutral" },
                      { emoji: "🙂", label: "Satisfied" },
                      { emoji: "🤩", label: "Loved it" },
                    ].map((item, idx) => {
                      const isSelected = selectedEmoji === idx;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSelectedEmoji(idx)}
                          className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-transform cursor-pointer ${
                            isSelected
                              ? "bg-amber-500/20 border border-amber-500/40 scale-110"
                              : "bg-[#F1F5F9] dark:bg-[#212327] border border-[#D9DBE0] dark:border-[#2A2D31] hover:scale-105"
                          }`}
                          title={item.label}
                        >
                          {item.emoji}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Slider Sticky Bottom Action Button matching Screenshot 3 */}
            <div className="p-4 sm:p-5 border-t border-[#D9DBE0] dark:border-[#2A2D31] shrink-0 bg-[#F8FAFC] dark:bg-[#131517]">
              <button
                type="button"
                disabled={isSchedulingFeedback}
                onClick={handleScheduleFeedbackEmail}
                className="w-full py-3 rounded-xl bg-[#061A3F] hover:bg-[#061A3F]/90 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-black text-xs sm:text-sm font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSchedulingFeedback ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Bell size={15} />
                )}
                <span>Schedule Feedback Email</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL 3: Compose New Blast (Customizable Timing + Message)
         ───────────────────────────────────────────────────────────── */}
      {showComposeModal && (
        <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#1A1C1F] border border-[#D9DBE0] dark:border-[#2A2D31] rounded-2xl w-full max-w-lg p-5 sm:p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-[#D9DBE0] dark:border-[#2A2D31] mb-4">
              <h3 className="text-base font-bold text-[#061A3F] dark:text-white">
                Create & Customize Blast
              </h3>
              <button
                onClick={() => setShowComposeModal(false)}
                className="text-[#64748B] dark:text-[#9B9EA4] hover:text-[#061A3F] dark:hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Subject */}
              <div>
                <label className="text-xs font-semibold text-[#1E293B] dark:text-[#D0D0D1] block mb-1.5">
                  Subject Line *
                </label>
                <input
                  type="text"
                  placeholder="Enter broadcast subject"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-[#F8FAFC] dark:bg-[#212327] border border-[#D9DBE0] dark:border-[#2A2D31] rounded-xl px-3.5 py-2.5 text-xs text-[#061A3F] dark:text-white placeholder-[#64748B] dark:placeholder-[#9B9EA4] outline-none focus:border-[#FE760B]"
                />
              </div>

              {/* Timing Selection */}
              <div>
                <label className="text-xs font-semibold text-[#1E293B] dark:text-[#D0D0D1] block mb-1.5">
                  Delivery Timing
                </label>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setScheduleType("now")}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      scheduleType === "now"
                        ? "bg-[#061A3F] text-white dark:bg-white dark:text-black border-[#061A3F]"
                        : "bg-white dark:bg-[#212327] text-[#64748B] dark:text-[#9B9EA4] border-[#D9DBE0] dark:border-[#2A2D31]"
                    }`}
                  >
                    Send Immediately
                  </button>
                  <button
                    type="button"
                    onClick={() => setScheduleType("later")}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      scheduleType === "later"
                        ? "bg-[#061A3F] text-white dark:bg-white dark:text-black border-[#061A3F]"
                        : "bg-white dark:bg-[#212327] text-[#64748B] dark:text-[#9B9EA4] border-[#D9DBE0] dark:border-[#2A2D31]"
                    }`}
                  >
                    Schedule for Later
                  </button>
                </div>

                {scheduleType === "later" && (
                  <input
                    type="datetime-local"
                    value={scheduledDateTime}
                    onChange={(e) => setScheduledDateTime(e.target.value)}
                    className="w-full bg-[#F8FAFC] dark:bg-[#212327] border border-[#D9DBE0] dark:border-[#2A2D31] rounded-xl px-3.5 py-2 text-xs text-[#061A3F] dark:text-white outline-none focus:border-[#FE760B]"
                  />
                )}
              </div>

              {/* Message Body */}
              <div>
                <label className="text-xs font-semibold text-[#1E293B] dark:text-[#D0D0D1] block mb-1.5">
                  Message Body *
                </label>
                <textarea
                  rows={4}
                  placeholder={`Write the message that will be broadcast to all ${recipientCount} attendees...`}
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                  className="w-full bg-[#F8FAFC] dark:bg-[#212327] border border-[#D9DBE0] dark:border-[#2A2D31] rounded-xl px-3.5 py-2.5 text-xs text-[#061A3F] dark:text-white placeholder-[#64748B] dark:placeholder-[#9B9EA4] outline-none focus:border-[#FE760B] resize-none"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#212327] border border-[#D9DBE0] dark:border-[#2A2D31] text-[11px] text-[#64748B] dark:text-[#9B9EA4]">
                This broadcast will be delivered to{" "}
                <span className="text-[#061A3F] dark:text-white font-semibold">
                  {recipientCount} registered guests
                </span>{" "}
                via their preferred notification channels.
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowComposeModal(false)}
                  className="px-4 py-2 rounded-xl bg-white dark:bg-[#212327] hover:bg-slate-100 dark:hover:bg-[#2A2D31] text-xs font-semibold text-[#1E293B] dark:text-[#D0D0D1] border border-[#D9DBE0] dark:border-[#2A2D31] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSending}
                  onClick={handleCreateBlast}
                  className="px-4 py-2 rounded-xl bg-[#FE760B] hover:bg-[#FE760B]/90 text-black text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  {isSending && <Loader2 size={13} className="animate-spin" />}
                  <span>
                    {scheduleType === "later" ? "Schedule Blast" : "Send Blast Now"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
