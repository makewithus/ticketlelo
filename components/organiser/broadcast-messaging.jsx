"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Send,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  Mail,
  MessageSquare,
  Calendar,
  AlertCircle,
  Loader2,
  ChevronDown,
  Users,
  Trash2,
} from "lucide-react";
import { BrandLoader } from "@/components/ui/brand-loader";
import { Skeleton } from "@/components/ui/skeleton";
import { getCachedItem, setCachedItem } from "@/lib/client-cache";

const STATUS_BADGES = {
  draft: {
    dotColor: "bg-[#5C6066]",
    label: "Draft",
  },
  scheduled: {
    dotColor: "bg-[#3B82F6]",
    label: "Scheduled",
  },
  sending: {
    dotColor: "bg-[#FDE003]",
    label: "Sending",
  },
  sent: {
    dotColor: "bg-[#10B981]",
    label: "Sent",
  },
  failed: {
    dotColor: "bg-[#EF4444]",
    label: "Failed",
  },
};

function StatusBadge({ status }) {
  const config = STATUS_BADGES[status] || STATUS_BADGES.draft;
  return (
    <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium bg-[#212327] border border-[#2A2D31] text-[#D0D0D1]">
      <span className={`w-2 h-2 rounded-full ${config.dotColor} ${status === "sending" ? "animate-pulse" : ""}`} />
      {config.label}
    </span>
  );
}

function MessageStatsBar({ stats }) {
  if (!stats) return null;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {[
        {
          label: "Total Messages",
          value: stats.totalMessages,
          color: "text-[#FFFFFF]",
          bg: "bg-[#1A1C1F] border-[#2A2D31]",
        },
        {
          label: "Sent",
          value: stats.sent,
          color: "text-[#10B981]",
          bg: "bg-[#1A1C1F] border-[#2A2D31]",
        },
        {
          label: "Scheduled",
          value: stats.scheduled,
          color: "text-[#3B82F6]",
          bg: "bg-[#1A1C1F] border-[#2A2D31]",
        },
        {
          label: "Failed",
          value: stats.failed,
          color: "text-[#EF4444]",
          bg: "bg-[#1A1C1F] border-[#2A2D31]",
        },
      ].map((item) => (
        <div key={item.label} className={`rounded-xl p-4 border ${item.bg}`}>
          <p className="text-xs text-[#9B9EA4] mb-1">{item.label}</p>
          <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
        </div>
      ))}
    </div>
  );
}

function ComposeModal({ eventId, userId, onClose, onSent }) {
  const [form, setForm] = useState({
    title: "",
    content: "",
    scheduledAt: "",
    sendNow: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.title.trim()) return setError("Title is required");
    if (!form.content.trim()) return setError("Message content is required");
    if (!form.sendNow && !form.scheduledAt)
      return setError("Please select a scheduled time");

    setLoading(true);
    try {
      // Create the message
      const createRes = await fetch("/api/messages/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          title: form.title,
          content: form.content,
          scheduledAt: form.sendNow ? null : form.scheduledAt,
          userId,
        }),
      });

      const createData = await createRes.json();
      if (!createData.success) throw new Error(createData.error);

      // If send now, immediately send
      if (form.sendNow) {
        const sendRes = await fetch("/api/messages/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageId: createData.message.id }),
        });
        const sendData = await sendRes.json();
        if (!sendData.success) throw new Error(sendData.error);

        onSent?.({
          ...createData.message,
          ...sendData,
          status: "sent",
        });
      } else {
        onSent?.(createData.message);
      }

      onClose();
    } catch (err) {
      setError(err.message || "Failed to send message");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="p-6 border-b border-[#2A2D31]">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-[#FFFFFF]">
              Compose Message
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-[#212327] transition-colors"
            >
              <XCircle size={20} className="text-[#9B9EA4]" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="flex items-start gap-3 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
              <AlertCircle
                size={16}
                className="text-red-400 mt-0.5 flex-shrink-0"
              />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-[#D0D0D1] mb-2">
              Subject / Title *
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) =>
                setForm((f) => ({ ...f, title: e.target.value }))
              }
              placeholder="Enter broadcast subject"
              className="w-full px-4 py-2.5 rounded-xl border border-[#2A2D31] bg-[#212327] text-white placeholder-[#9B9EA4] focus:outline-none focus:ring-1 focus:ring-[#FE760B] focus:border-[#FE760B] transition-colors text-sm"
              maxLength={100}
            />
            <p className="text-xs text-[#9B9EA4] mt-1 text-right">
              {form.title.length}/100
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#D0D0D1] mb-2">
              Message Content *
            </label>
            <textarea
              value={form.content}
              onChange={(e) =>
                setForm((f) => ({ ...f, content: e.target.value }))
              }
              placeholder="Write your message here..."
              rows={6}
              className="w-full px-4 py-3 rounded-xl border border-[#2A2D31] bg-[#212327] text-white placeholder-[#9B9EA4] focus:outline-none focus:ring-1 focus:ring-[#FE760B] focus:border-[#FE760B] transition-colors text-sm resize-none"
              maxLength={2000}
            />
            <p className="text-xs text-[#9B9EA4] mt-1 text-right">
              {form.content.length}/2000
            </p>
          </div>

          <div className="p-4 bg-[#212327] border border-[#2A2D31] rounded-xl space-y-3">
            <p className="text-sm font-semibold text-[#D0D0D1]">Send Options</p>
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="sendOption"
                  checked={form.sendNow}
                  onChange={() =>
                    setForm((f) => ({ ...f, sendNow: true, scheduledAt: "" }))
                  }
                  className="w-4 h-4 accent-[#FE760B]"
                />
                <div>
                  <span className="text-sm font-medium text-[#FFFFFF]">
                    Send Now
                  </span>
                  <p className="text-xs text-[#9B9EA4]">
                    Message will be sent immediately to all registered
                    participants
                  </p>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="sendOption"
                  checked={!form.sendNow}
                  onChange={() => setForm((f) => ({ ...f, sendNow: false }))}
                  className="w-4 h-4 accent-[#FE760B]"
                />
                <div>
                  <span className="text-sm font-medium text-[#FFFFFF]">
                    Schedule for Later
                  </span>
                  <p className="text-xs text-[#9B9EA4]">
                    Choose when to send this message
                  </p>
                </div>
              </label>
            </div>
            {!form.sendNow && (
              <div className="mt-3">
                <label className="block text-xs font-medium text-[#9B9EA4] mb-1.5">
                  Schedule Date &amp; Time
                </label>
                <input
                  type="datetime-local"
                  value={form.scheduledAt}
                  min={new Date().toISOString().slice(0, 16)}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, scheduledAt: e.target.value }))
                  }
                  className="w-full px-3 py-2.5 rounded-lg border border-[#2A2D31] bg-[#1A1C1F] text-white focus:outline-none focus:ring-1 focus:ring-[#FE760B] text-sm"
                />
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-[#212327] text-[#D0D0D1] rounded-xl font-medium text-sm hover:bg-[#2A2D31] transition-colors border border-[#2A2D31]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60 shadow-sm"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {form.sendNow ? "Sending..." : "Scheduling..."}
                </>
              ) : (
                <>
                  {form.sendNow ? <Send size={16} /> : <Calendar size={16} />}
                  {form.sendNow ? "Send Message" : "Schedule Message"}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MessageCard({ message, onRetry }) {
  const [expanded, setExpanded] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await onRetry(message.id);
    } finally {
      setRetrying(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="bg-[#1A1C1F] rounded-2xl border border-[#2A2D31] overflow-hidden shadow-sm">
      <div
        className="p-5 cursor-pointer flex items-start justify-between gap-4 hover:bg-[#212327]/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap mb-2">
            <StatusBadge status={message.status} />
            {message.scheduledAt && message.status === "scheduled" && (
              <span className="inline-flex items-center gap-1 text-xs text-[#7AA2FF]">
                <Clock size={11} />
                {formatDate(message.scheduledAt)}
              </span>
            )}
          </div>
          <h3 className="font-semibold text-white text-sm truncate">
            {message.title}
          </h3>
          <p className="text-xs text-[#9B9EA4] mt-1">
            {message.content.length > 80
              ? `${message.content.substring(0, 80)}...`
              : message.content}
          </p>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
          {message.status === "sent" && (
            <div className="text-right">
              <p className="text-xs text-[#9B9EA4]">Delivered</p>
              <p className="text-sm font-bold text-[#3DD68C] tabular-nums">
                {message.successCount || 0}/{message.recipientCount || 0}
              </p>
            </div>
          )}
          <ChevronDown
            size={16}
            className={`text-[#9B9EA4] transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </div>
      </div>

      {expanded && (
        <div className="border-t border-[#2A2D31] p-5 bg-[#212327]/50 space-y-4">
          <div>
            <p className="text-xs font-semibold text-[#9B9EA4] uppercase tracking-wide mb-1">
              Message
            </p>
            <p className="text-sm text-[#D0D0D1] whitespace-pre-wrap leading-relaxed">
              {message.content}
            </p>
          </div>

          {(message.status === "sent" || message.status === "failed") && (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#1A1C1F] rounded-xl p-3 border border-[#2A2D31] text-center">
                <p className="text-xs text-[#9B9EA4] mb-1">Total</p>
                <p className="font-bold text-white text-lg tabular-nums">
                  {message.recipientCount || 0}
                </p>
              </div>
              <div className="bg-[#3DD68C]/12 rounded-xl p-3 border border-[#3DD68C]/25 text-center">
                <p className="text-xs text-[#3DD68C] mb-1">Success</p>
                <p className="font-bold text-[#3DD68C] text-lg tabular-nums">
                  {message.successCount || 0}
                </p>
              </div>
              <div className="bg-[#FF6B6B]/12 rounded-xl p-3 border border-[#FF6B6B]/25 text-center">
                <p className="text-xs text-[#FF9A9A] mb-1">Failed</p>
                <p className="font-bold text-[#FF9A9A] text-lg tabular-nums">
                  {message.failureCount || 0}
                </p>
              </div>
            </div>
          )}

          {message.status === "failed" && message.failureCount > 0 && (
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="w-full py-2.5 bg-[#FF6B6B]/12 text-[#FF9A9A] border border-[#FF6B6B]/25 rounded-xl font-semibold text-sm hover:bg-[#FF6B6B]/20 transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw size={14} className={retrying ? "animate-spin" : ""} />
              {retrying
                ? "Retrying..."
                : `Retry ${message.failureCount} failed`}
            </button>
          )}

          {message.sentAt && (
            <p className="text-xs text-[#9B9EA4]">
              Sent: {formatDate(message.sentAt)}
            </p>
          )}
          {message.createdAt && (
            <p className="text-xs text-[#9B9EA4]">
              Created: {formatDate(message.createdAt)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function BroadcastMessaging({ eventId, userId, eventName }) {
  // Instant 0ms cache-first hydration
  const [messages, setMessages] = useState(() => {
    if (typeof window !== "undefined" && eventId) {
      try {
        return getCachedItem(`broadcast_messages_${eventId}`)?.messages || [];
      } catch {}
    }
    return [];
  });
  const [stats, setStats] = useState(() => {
    if (typeof window !== "undefined" && eventId) {
      try {
        return getCachedItem(`broadcast_messages_${eventId}`)?.stats || null;
      } catch {}
    }
    return null;
  });
  const [loading, setLoading] = useState(() => messages.length === 0);
  const [error, setError] = useState("");
  const [showCompose, setShowCompose] = useState(false);
  const [filter, setFilter] = useState("all");

  const fetchMessages = useCallback(async () => {
    if (!eventId) return;
    if (messages.length === 0) setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/messages/${eventId}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setMessages(data.messages || []);
      setStats(data.stats);
      setCachedItem(
        `broadcast_messages_${eventId}`,
        { messages: data.messages || [], stats: data.stats },
        5 * 60 * 1000
      );
    } catch (err) {
      setError(err.message || "Failed to load messages");
    } finally {
      setLoading(false);
    }
  }, [eventId, messages.length]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchMessages();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchMessages]);

  const handleRetry = async (messageId) => {
    try {
      const res = await fetch("/api/messages/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      await fetchMessages();
    } catch (err) {
      console.error("Retry error:", err);
    }
  };

  const filteredMessages = messages.filter((m) => {
    if (filter === "all") return true;
    return m.status === filter;
  });

  const filterOptions = [
    { value: "all", label: "All" },
    { value: "sent", label: "Sent" },
    { value: "scheduled", label: "Scheduled" },
    { value: "failed", label: "Failed" },
    { value: "draft", label: "Draft" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Broadcast messages
          </h2>
          {eventName && (
            <p className="text-sm text-[#9B9EA4] mt-1">
              Sending to all participants of{" "}
              <span className="font-medium text-white">{eventName}</span>
            </p>
          )}
        </div>
        <button
          onClick={() => setShowCompose(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-semibold rounded-xl shadow-sm transition-colors text-sm"
        >
          <Mail size={16} />
          Compose message
        </button>
      </div>

      {/* Stats */}
      {stats && <MessageStatsBar stats={stats} />}

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {filterOptions.map((option) => {
          const count =
            option.value === "all"
              ? messages.length
              : messages.filter((m) => m.status === option.value).length;
          const isActive = filter === option.value;
          return (
            <button
              key={option.value}
              onClick={() => setFilter(option.value)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? "bg-[#FE760B]/14 text-[#FE760B] border border-[#FE760B]/30"
                  : "bg-[#1A1C1F] text-[#9B9EA4] border border-[#2A2D31] hover:text-white hover:bg-[#212327]"
              }`}
            >
              {option.label}
              {count > 0 && (
                <span
                  className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    isActive
                      ? "bg-[#FE760B]/20 text-[#FE760B]"
                      : "bg-[#212327] text-[#9B9EA4]"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {loading && messages.length === 0 ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="p-5 rounded-2xl bg-[#1A1C1F] border border-[#2A2D31] space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-48 rounded-md" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
              <Skeleton className="h-4 w-3/4 rounded-md" />
              <div className="flex items-center gap-4 pt-2">
                <Skeleton className="h-3 w-28 rounded-md" />
                <Skeleton className="h-3 w-24 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <AlertCircle size={40} className="text-[#FF6B6B] mb-4" />
          <p className="text-white font-medium mb-2">
            Failed to load messages
          </p>
          <p className="text-[#9B9EA4] text-sm mb-4">{error}</p>
          <button
            onClick={fetchMessages}
            className="px-4 py-2 bg-[#212327] text-white border border-[#2A2D31] rounded-xl text-sm font-medium hover:bg-[#2A2D31] transition-colors"
          >
            Try Again
          </button>
        </div>
      ) : filteredMessages.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-[#1A1C1F] rounded-2xl border border-[#2A2D31]">
          <div className="w-16 h-16 bg-[#212327] rounded-2xl flex items-center justify-center mb-4">
            <MessageSquare size={28} className="text-[#9B9EA4]" />
          </div>
          <h3 className="font-semibold text-white mb-1">
            {filter === "all" ? "No messages yet" : `No ${filter} messages`}
          </h3>
          <p className="text-[#9B9EA4] text-sm mb-6 max-w-sm">
            {filter === "all"
              ? "Compose your first broadcast message to reach all event participants via email."
              : `No messages with status "${filter}" found.`}
          </p>
          {filter === "all" && (
            <button
              onClick={() => setShowCompose(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-semibold rounded-xl text-sm transition-colors shadow-sm"
            >
              <Mail size={15} />
              Send first message
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredMessages.map((message) => (
            <MessageCard
              key={message.id}
              message={message}
              onRetry={handleRetry}
            />
          ))}
        </div>
      )}

      {/* Compose Modal */}
      {showCompose && (
        <ComposeModal
          eventId={eventId}
          userId={userId}
          onClose={() => setShowCompose(false)}
          onSent={() => fetchMessages()}
        />
      )}
    </div>
  );
}
