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
import { getPublicEventUrl } from "@/lib/app-url";

export function EventPublish({ event, userId, onPublished }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const isPublished =
    event?.published === true ||
    event?.isPublished === true ||
    event?.status === "published" ||
    Boolean(event?.shareUrl);

  const shareUrl =
    event?.shareUrl && !event.shareUrl.includes("localhost")
      ? event.shareUrl
      : event?.slug
      ? getPublicEventUrl(event.slug, "event")
      : event?.id
      ? getPublicEventUrl(event.id, "register")
      : "";

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
      onPublished?.({
        ...event,
        ...data,
        published: true,
        isPublished: true,
        status: "published",
        shareUrl: data.shareUrl || shareUrl,
      });
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
    <div className="bg-[#1A1C1F] rounded-2xl border border-[#2A2D31] shadow-sm p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Globe size={18} className="text-[#FE760B]" />
        <h3 className="font-bold text-white text-base">Event publishing</h3>
        {isPublished && (
          <span className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FE760B]/14 text-[#FE760B] border border-[#FE760B]/30">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FE760B] animate-pulse" />
            Live
          </span>
        )}
      </div>

      {isPublished ? (
        <div className="space-y-4">
          {/* Share link box */}
          <div className="flex items-center gap-2 p-3 bg-[#212327] rounded-xl border border-[#2A2D31]">
            <Link2 size={14} className="text-[#9B9EA4] flex-shrink-0" />
            <span className="text-sm text-white font-mono flex-1 truncate">
              {shareUrl}
            </span>
            <button
              onClick={copyLink}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[#D0D0D1] bg-[#1A1C1F] border border-[#2A2D31] hover:text-white rounded-lg transition-colors"
            >
              {copied ? (
                <Check size={13} className="text-[#3DD68C]" />
              ) : (
                <Copy size={13} />
              )}
              {copied ? "Copied!" : "Copy"}
            </button>
            <a
              href={shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-[#9B9EA4] hover:text-[#FE760B] transition-colors rounded-lg hover:bg-[#2A2D31]"
            >
              <ExternalLink size={14} />
            </a>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            {typeof navigator !== "undefined" && navigator.share && (
              <button
                onClick={shareNative}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#FE760B] hover:bg-[#FE760B]/90 text-[#131517] text-sm font-semibold rounded-xl transition-colors shadow-sm cursor-pointer"
              >
                <Share2 size={14} /> Share
              </button>
            )}
            <button
              onClick={handleUnpublish}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-[#D0D0D1] bg-[#212327] border border-[#2A2D31] rounded-xl hover:bg-[#2A2D31] hover:text-white transition-colors"
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
          <p className="text-sm text-[#9B9EA4]">
            Publish this event to generate a shareable registration link.
            Participants can register directly from the public event page.
          </p>
          <button
            onClick={handlePublish}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#FE760B] hover:bg-[#FE760B]/90 text-[#131517] font-semibold rounded-xl text-sm transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <Loader2 size={15} className="animate-spin text-[#131517]" />
            ) : (
              <Globe size={15} />
            )}
            Publish event
          </button>
        </div>
      )}

      {error && <p className="text-xs text-[#FF9A9A] font-medium">{error}</p>}
    </div>
  );
}
