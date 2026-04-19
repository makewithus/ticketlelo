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

const STATUS_BADGES = {
  draft: {
    color: "bg-slate-700/60 text-slate-300 border border-slate-600",
    label: "Draft",
    icon: MessageSquare,
  },
  scheduled: {
    color: "bg-blue-500/20 text-blue-300 border border-blue-500/30",
    label: "Scheduled",
    icon: Clock,
  },
  sending: {
    color: "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30",
    label: "Sending...",
    icon: Loader2,
  },
  sent: {
    color: "bg-green-500/20 text-green-300 border border-green-500/30",
    label: "Sent",
    icon: CheckCircle,
  },
  failed: {
    color: "bg-red-500/20 text-red-300 border border-red-500/30",
    label: "Failed",
    icon: XCircle,
  },
};

function StatusBadge({ status }) {
  const config = STATUS_BADGES[status] || STATUS_BADGES.draft;
  const Icon = config.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.color}`}
    >
      <Icon size={11} className={status === "sending" ? "animate-spin" : ""} />
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
          label: "Total",
          value: stats.totalMessages,
          color: "text-slate-100",
          bg: "bg-slate-800/60 border-slate-700",
        },
        {
          label: "Sent",
          value: stats.sent,
          color: "text-green-300",
          bg: "bg-green-500/10 border-green-500/20",
        },
        {
          label: "Scheduled",
          value: stats.scheduled,
          color: "text-blue-300",
          bg: "bg-blue-500/10 border-blue-500/20",
        },
        {
          label: "Failed",
          value: stats.failed,
          color: "text-red-300",
          bg: "bg-red-500/10 border-red-500/20",
        },
      ].map((item) => (
        <div key={item.label} className={`rounded-xl p-3 border ${item.bg}`}>
          <p className="text-xs text-slate-400 mb-1">{item.label}</p>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-[#FE760B]/20 rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-100">
              Compose Message
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <XCircle size={20} className="text-slate-400" />
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
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Subject / Title *
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) =>
                setForm((f) => ({ ...f, title: e.target.value }))
              }
              placeholder="e.g. Important Update About Your Ticket"
              className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#FE760B]/50 focus:border-[#FE760B]/50 transition text-sm"
              maxLength={100}
            />
            <p className="text-xs text-slate-500 mt-1 text-right">
              {form.title.length}/100
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Message Content *
            </label>
            <textarea
              value={form.content}
              onChange={(e) =>
                setForm((f) => ({ ...f, content: e.target.value }))
              }
              placeholder="Write your message here..."
              rows={6}
              className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#FE760B]/50 focus:border-[#FE760B]/50 transition text-sm resize-none"
              maxLength={2000}
            />
            <p className="text-xs text-slate-500 mt-1 text-right">
              {form.content.length}/2000
            </p>
          </div>

          <div className="p-4 bg-slate-800/60 border border-slate-700 rounded-xl space-y-3">
            <p className="text-sm font-semibold text-slate-300">Send Options</p>
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="sendOption"
                  checked={form.sendNow}
                  onChange={() =>
                    setForm((f) => ({ ...f, sendNow: true, scheduledAt: "" }))
                  }
                  className="w-4 h-4 accent-orange-500"
                />
                <div>
                  <span className="text-sm font-medium text-slate-200">
                    Send Now
                  </span>
                  <p className="text-xs text-slate-500">
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
                  className="w-4 h-4 accent-orange-500"
                />
                <div>
                  <span className="text-sm font-medium text-slate-200">
                    Schedule for Later
                  </span>
                  <p className="text-xs text-slate-500">
                    Choose when to send this message
                  </p>
                </div>
              </label>
            </div>
            {!form.sendNow && (
              <div className="mt-3">
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Schedule Date &amp; Time
                </label>
                <input
                  type="datetime-local"
                  value={form.scheduledAt}
                  min={new Date().toISOString().slice(0, 16)}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, scheduledAt: e.target.value }))
                  }
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-600 bg-slate-800 text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#FE760B]/50 text-sm"
                />
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-slate-800 text-slate-300 rounded-xl font-medium text-sm hover:bg-slate-700 transition-colors border border-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-[#FE760B] to-[#FEDF05] text-black rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-60"
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
    <div className="bg-slate-900/60 rounded-2xl border border-slate-800 overflow-hidden">
      <div
        className="p-5 cursor-pointer flex items-start justify-between gap-4 hover:bg-slate-800/40 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap mb-2">
            <StatusBadge status={message.status} />
            {message.scheduledAt && message.status === "scheduled" && (
              <span className="inline-flex items-center gap-1 text-xs text-blue-400">
                <Clock size={11} />
                {formatDate(message.scheduledAt)}
              </span>
            )}
          </div>
          <h3 className="font-semibold text-slate-100 text-sm truncate">
            {message.title}
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            {message.content.length > 80
              ? `${message.content.substring(0, 80)}...`
              : message.content}
          </p>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
          {message.status === "sent" && (
            <div className="text-right">
              <p className="text-xs text-slate-500">Delivered</p>
              <p className="text-sm font-bold text-green-400">
                {message.successCount || 0}/{message.recipientCount || 0}
              </p>
            </div>
          )}
          <ChevronDown
            size={16}
            className={`text-slate-500 transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-800 p-5 bg-slate-800/30 space-y-4">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Message
            </p>
            <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
              {message.content}
            </p>
          </div>

          {(message.status === "sent" || message.status === "failed") && (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-800 rounded-xl p-3 border border-slate-700 text-center">
                <p className="text-xs text-slate-500 mb-1">Total</p>
                <p className="font-bold text-slate-100 text-lg">
                  {message.recipientCount || 0}
                </p>
              </div>
              <div className="bg-green-500/10 rounded-xl p-3 border border-green-500/20 text-center">
                <p className="text-xs text-green-400 mb-1">Success</p>
                <p className="font-bold text-green-300 text-lg">
                  {message.successCount || 0}
                </p>
              </div>
              <div className="bg-red-500/10 rounded-xl p-3 border border-red-500/20 text-center">
                <p className="text-xs text-red-400 mb-1">Failed</p>
                <p className="font-bold text-red-300 text-lg">
                  {message.failureCount || 0}
                </p>
              </div>
            </div>
          )}

          {message.status === "failed" && message.failureCount > 0 && (
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="w-full py-2.5 bg-red-500/10 text-red-400 border border-red-500/30 rounded-xl font-semibold text-sm hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw size={14} className={retrying ? "animate-spin" : ""} />
              {retrying
                ? "Retrying..."
                : `Retry ${message.failureCount} Failed`}
            </button>
          )}

          {message.sentAt && (
            <p className="text-xs text-slate-500">
              Sent: {formatDate(message.sentAt)}
            </p>
          )}
          {message.createdAt && (
            <p className="text-xs text-slate-500">
              Created: {formatDate(message.createdAt)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function BroadcastMessaging({ eventId, userId, eventName }) {
  const [messages, setMessages] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCompose, setShowCompose] = useState(false);
  const [filter, setFilter] = useState("all");

  const fetchMessages = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/messages/${eventId}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setMessages(data.messages || []);
      setStats(data.stats);
    } catch (err) {
      setError(err.message || "Failed to load messages");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchMessages();
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
          <h1 className="text-2xl font-bold text-slate-100">
            Broadcast Messages
          </h1>
          {eventName && (
            <p className="text-sm text-slate-400 mt-1">
              Sending to all participants of{" "}
              <span className="font-medium text-slate-200">{eventName}</span>
            </p>
          )}
        </div>
        <button
          onClick={() => setShowCompose(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#FE760B] to-[#FEDF05] text-black font-semibold rounded-xl shadow-sm hover:opacity-90 transition-opacity text-sm"
        >
          <Mail size={16} />
          Compose Message
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
          return (
            <button
              key={option.value}
              onClick={() => setFilter(option.value)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                filter === option.value
                  ? "bg-[#FE760B]/10 text-[#FE760B] border border-[#FE760B]/30"
                  : "bg-slate-800/60 text-slate-400 border border-slate-700 hover:border-slate-600"
              }`}
            >
              {option.label}
              {count > 0 && (
                <span
                  className={`ml-2 px-1.5 py-0.5 rounded-full text-xs font-bold ${
                    filter === option.value
                      ? "bg-[#FE760B]/20 text-[#FE760B]"
                      : "bg-slate-700 text-slate-400"
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
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <Loader2
              size={36}
              className="animate-spin text-[#FE760B] mx-auto mb-4"
            />
            <p className="text-slate-400 text-sm">Loading messages...</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <AlertCircle size={40} className="text-red-400 mb-4" />
          <p className="text-slate-200 font-medium mb-2">
            Failed to load messages
          </p>
          <p className="text-slate-400 text-sm mb-4">{error}</p>
          <button
            onClick={fetchMessages}
            className="px-4 py-2 bg-slate-800 text-slate-300 border border-slate-700 rounded-xl text-sm font-medium hover:bg-slate-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      ) : filteredMessages.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-slate-900/60 rounded-2xl border border-slate-800">
          <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
            <MessageSquare size={28} className="text-slate-500" />
          </div>
          <h3 className="font-semibold text-slate-200 mb-2">
            {filter === "all" ? "No messages yet" : `No ${filter} messages`}
          </h3>
          <p className="text-slate-400 text-sm mb-6 max-w-sm">
            {filter === "all"
              ? "Compose your first broadcast message to reach all event participants via email."
              : `No messages with status "${filter}" found.`}
          </p>
          {filter === "all" && (
            <button
              onClick={() => setShowCompose(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#FE760B] to-[#FEDF05] text-black font-semibold rounded-xl text-sm hover:opacity-90 transition-opacity"
            >
              <Mail size={15} />
              Send First Message
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
