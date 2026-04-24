"use client";

import { useState } from "react";
import {
  Globe,
  Link2,
  Copy,
  Check,
  Loader2,
  ExternalLink,
  EyeOff,
  Share2,
} from "lucide-react";

export function EventPublish({ event, userId, onPublished }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const isPublished = event?.published === true;
  const shareUrl = event?.shareUrl || "";

  const handlePublish = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/events/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: event.id, userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to publish");
      onPublished?.(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUnpublish = async () => {
    if (!confirm("Unpublish this event? The share link will stop working."))
      return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/events/publish?eventId=${event.id}&userId=${userId}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to unpublish");
      onPublished?.({ ...event, published: false, shareUrl: null });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const shareNative = async () => {
    if (navigator.share) {
      await navigator.share({ title: event.name, url: shareUrl });
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Globe size={18} className="text-[#FF6A00]" />
        <h3 className="font-bold text-gray-800">Event Publishing</h3>
        {isPublished && (
          <span className="ml-auto px-2.5 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded-full">
            Live
          </span>
        )}
      </div>

      {isPublished ? (
        <div className="space-y-4">
          {/* Share link box */}
          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200">
            <Link2 size={14} className="text-gray-400 flex-shrink-0" />
            <span className="text-sm text-gray-700 flex-1 truncate">
              {shareUrl}
            </span>
            <button
              onClick={copyLink}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
            >
              {copied ? (
                <Check size={13} className="text-green-500" />
              ) : (
                <Copy size={13} />
              )}
              {copied ? "Copied!" : "Copy"}
            </button>
            <a
              href={shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-gray-400 hover:text-[#FF6A00] transition-colors rounded-lg hover:bg-gray-200"
            >
              <ExternalLink size={14} />
            </a>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            {typeof navigator !== "undefined" && navigator.share && (
              <button
                onClick={shareNative}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#FF6A00] text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity"
              >
                <Share2 size={14} /> Share
              </button>
            )}
            <button
              onClick={handleUnpublish}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              {loading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <EyeOff size={14} />
              )}
              Unpublish
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Publish this event to generate a shareable registration link.
            Participants can register directly from the public event page.
          </p>
          <button
            onClick={handlePublish}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#FF6A00] text-white font-bold rounded-xl text-sm hover:opacity-90 transition-opacity shadow-md shadow-[#FF6A00]/20 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Globe size={15} />
            )}
            Publish Event
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
    </div>
  );
}
