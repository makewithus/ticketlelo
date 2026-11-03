"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ExternalLink,
  Copy,
  Upload,
  Trash2,
  Ticket,
  Globe,
  Sliders,
  Calendar,
  Clock,
  AlertCircle,
  AlertTriangle,
  X,
  CheckCircle2,
  Scissors,
  ChevronDown,
} from "lucide-react";
import { EventControlHeader } from "@/components/admin/event-control-header";
import { getEvent, updateEvent, deleteEvent } from "@/lib/firestore";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { getPosterLines } from "@/components/admin/event-create-studio";
import { COLOR_SWATCHES, getThemeLook } from "@/lib/theme-utils";
import { getPublicBaseUrl, getCleanDomain } from "@/lib/app-url";
import { EmbedRegistrationModal } from "@/components/embed/embed-registration-modal";
import { StubTicket } from "@/components/tickets/stub-ticket";
import { BrandLoader } from "@/components/ui/brand-loader";

const TIME_OPTIONS = [
  "12:00 AM", "12:30 AM", "01:00 AM", "01:30 AM", "02:00 AM", "02:30 AM",
  "03:00 AM", "03:30 AM", "04:00 AM", "04:30 AM", "05:00 AM", "05:30 AM",
  "06:00 AM", "06:30 AM", "07:00 AM", "07:30 AM", "08:00 AM", "08:30 AM",
  "09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM",
  "12:00 PM", "12:30 PM", "01:00 PM", "01:30 PM", "02:00 PM", "02:30 PM",
  "03:00 PM", "03:30 PM", "04:00 PM", "04:30 PM", "05:00 PM", "05:30 PM",
  "06:00 PM", "06:30 PM", "07:00 PM", "07:30 PM", "08:00 PM", "08:30 PM",
  "09:00 PM", "09:30 PM", "10:00 PM", "10:30 PM", "11:00 PM", "11:30 PM",
];

export default function MoreEventSettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeEventId, setActiveEventId] = useState(null);
  const [currentEvent, setCurrentEvent] = useState(null);
  const [loadingEvent, setLoadingEvent] = useState(true);

  const [copied, setCopied] = useState(false);
  const [customDomain, setCustomDomain] = useState("");
  const [customSlug, setCustomSlug] = useState("tech-fest-2026");
  const [isSavingSlug, setIsSavingSlug] = useState(false);
  const [selectedColor, setSelectedColor] = useState(COLOR_SWATCHES[0]);
  const [isPublished, setIsPublished] = useState(true);
  const [bannerPreview, setBannerPreview] = useState(null);

  // Ticket Artwork & Background State
  const [ticketBgPreview, setTicketBgPreview] = useState(null);
  const [isSavingTicketBg, setIsSavingTicketBg] = useState(false);
  const [previewCheckedIn, setPreviewCheckedIn] = useState(false);

  // Registration Mode / Integration
  const [registrationMode, setRegistrationMode] = useState("standard");
  const [customFormUrl, setCustomFormUrl] = useState("");
  const [isSavingEmbed, setIsSavingEmbed] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [showDemoModal, setShowDemoModal] = useState(false);

  // Close Registration Settings
  const [closeRegEnabled, setCloseRegEnabled] = useState(false);
  const [closeRegMode, setCloseRegMode] = useState("now"); // "now" | "capacity"
  const [closeRegCapacity, setCloseRegCapacity] = useState(100);
  const [isSavingCloseReg, setIsSavingCloseReg] = useState(false);

  // Modals for Postpone, Cancel, Delete
  const [showPostponeModal, setShowPostponeModal] = useState(false);
  const [postponeForm, setPostponeForm] = useState({
    startDate: "",
    startTime: "",
    endDate: "",
    endTime: "",
    note: "",
  });
  const [isSavingPostpone, setIsSavingPostpone] = useState(false);

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load the active event from query or localStorage with real-time sync
  useEffect(() => {
    let eventId = searchParams ? searchParams.get("eventId") : null;
    if (!eventId && typeof window !== "undefined") {
      try {
        eventId = localStorage.getItem("admin_selected_event_id");
      } catch {}
    }

    if (!eventId) {
      setTimeout(() => setLoadingEvent(false), 0);
      return;
    }

    setActiveEventId(eventId);
    setLoadingEvent(true);

    let isFirstLoad = true;
    let unsub = null;

    try {
      unsub = onSnapshot(
        doc(db, "events", eventId),
        (snap) => {
          if (snap.exists()) {
            const ev = { id: snap.id, ...snap.data() };
            setCurrentEvent(ev);

            if (isFirstLoad) {
              isFirstLoad = false;
              if (ev.slug) setCustomSlug(ev.slug);
              if (ev.customDomain) setCustomDomain(ev.customDomain);
              if (ev.bannerUrl) setBannerPreview(ev.bannerUrl);
              if (ev.published !== undefined) setIsPublished(ev.published);
              if (ev.embedRegistrationMode) setRegistrationMode(ev.embedRegistrationMode);
              if (ev.customFormEmbedUrl) setCustomFormUrl(ev.customFormEmbedUrl);
              if (ev.ticketBgUrl) setTicketBgPreview(ev.ticketBgUrl);
              else if (ev.ticketBackground) setTicketBgPreview(ev.ticketBackground);

              // Close registration state
              if (ev.closeRegistrationEnabled !== undefined) {
                setCloseRegEnabled(Boolean(ev.closeRegistrationEnabled));
              } else if (ev.registrationStatus === "Closed" || ev.registrationClosed) {
                setCloseRegEnabled(true);
              }
              if (ev.closeRegistrationMode) setCloseRegMode(ev.closeRegistrationMode);
              if (ev.closeRegistrationCapacity) setCloseRegCapacity(Number(ev.closeRegistrationCapacity));

              // Postpone form prefill
              setPostponeForm({
                startDate: ev.startDate || (ev.date ? new Date(ev.date).toISOString().slice(0, 10) : ""),
                startTime: ev.startTime || "10:00 AM",
                endDate: ev.endDate || ev.startDate || "",
                endTime: ev.endTime || "05:00 PM",
                note: ev.postponedNote || "",
              });

              if (ev.themeColor) {
                const matched = getThemeLook(ev.themeColor);
                setSelectedColor(matched);
              } else if (ev.theme) {
                const matched = getThemeLook(ev.theme);
                setSelectedColor(matched);
              }
            }
          }
          setLoadingEvent(false);
        },
        (err) => {
          console.warn("Real-time event listener warning in customize:", err);
          setLoadingEvent(false);
        }
      );
    } catch (err) {
      console.warn("Could not bind real-time event listener:", err);
      getEvent(eventId)
        .then((ev) => {
          if (ev) setCurrentEvent(ev);
        })
        .finally(() => setLoadingEvent(false));
    }

    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, [searchParams]);

  const defaultDomain = getCleanDomain(getPublicBaseUrl());
  const activeDomain = (customDomain || "").trim() || defaultDomain;
  const fullUrl = `${activeDomain}/${customSlug}`;
  const fullPublicUrl = `https://${activeDomain}/${customSlug}`;

  // Word-aware poster headline text
  const posterLines = getPosterLines(
    currentEvent?.name ||
      currentEvent?.title ||
      customSlug.replace(/-/g, " ") ||
      "Tech Fest '26"
  );

  const handleCopyLink = () => {
    navigator.clipboard.writeText(fullPublicUrl);
    setCopied(true);
    toast.success("Public link copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerateSlug = () => {
    const raw = currentEvent?.name || currentEvent?.title || "tech-fest-2026";
    const generated = raw
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 50);
    setCustomSlug(generated || "tech-fest-2026");
    toast.info("Slug generated from event title!");
  };

  const handleSaveSlug = async () => {
    if (!activeEventId) {
      toast.error("No active event found to update");
      return;
    }

    const cleanSlug = customSlug
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-") || `event-${Date.now()}`;

    const cleanDomain = customDomain
      .toLowerCase()
      .trim()
      .replace(/^https?:\/\//, "")
      .replace(/\/+$/, "");

    setCustomSlug(cleanSlug);
    setCustomDomain(cleanDomain);
    setIsSavingSlug(true);

    try {
      await updateEvent(activeEventId, {
        slug: cleanSlug,
        customDomain: cleanDomain,
      });
      setCurrentEvent((prev) => ({
        ...prev,
        slug: cleanSlug,
        customDomain: cleanDomain,
      }));
      toast.success(`URL updated successfully: https://${cleanDomain || defaultDomain}/${cleanSlug}`);
    } catch {
      // Fallback via API
      try {
        await fetch(`/api/events/${activeEventId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug: cleanSlug, customDomain: cleanDomain }),
        });
        toast.success(`URL updated successfully`);
      } catch (err) {
        toast.error("Failed to update URL");
      }
    } finally {
      setIsSavingSlug(false);
    }
  };

  const handleSaveEmbedSettings = async () => {
    if (!activeEventId) return;
    setIsSavingEmbed(true);
    try {
      await updateEvent(activeEventId, {
        embedRegistrationMode: registrationMode,
        customFormEmbedUrl: customFormUrl.trim(),
      });
      toast.success("Embed settings saved successfully!");
    } catch {
      toast.error("Failed to save embed settings");
    } finally {
      setIsSavingEmbed(false);
    }
  };

  const handleCopyEmbedCode = () => {
    const codeSnippet = `<a href="${getPublicBaseUrl()}/e/${customSlug}" class="ticketlelo-register-button" data-event-id="${activeEventId || "evt-" + customSlug}">Register for Event</a>\n<script src="${getPublicBaseUrl()}/embed/ticketlelo-embed.js" async></script>`;
    navigator.clipboard.writeText(codeSnippet);
    setCodeCopied(true);
    toast.success("Button embed snippet copied to clipboard!");
    setTimeout(() => setCodeCopied(false), 2000);
  };

  // Ticket Artwork Upload Handlers
  const handleTicketBgUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload a valid image file (PNG, JPG, WebP)");
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      if (uploadEvent.target?.result) {
        setTicketBgPreview(uploadEvent.target.result);
        toast.success("Ticket artwork loaded! Click 'Save ticket look' to apply.");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveTicketLook = async () => {
    if (!activeEventId) {
      toast.error("No active event found to save ticket background");
      return;
    }

    setIsSavingTicketBg(true);
    try {
      await updateEvent(activeEventId, {
        ticketBgUrl: ticketBgPreview || "",
        ticketBackground: ticketBgPreview || "",
      });
      setCurrentEvent((prev) => ({
        ...prev,
        ticketBgUrl: ticketBgPreview || "",
      }));
      toast.success("Custom ticket look saved successfully!");
    } catch (err) {
      console.error("Save ticket look error:", err);
      toast.error("Failed to save ticket artwork");
    } finally {
      setIsSavingTicketBg(false);
    }
  };

  // Live registration closure status
  const isCurrentlyClosed = Boolean(
    (closeRegEnabled && closeRegMode === "now") ||
    (closeRegEnabled &&
      closeRegMode === "capacity" &&
      typeof closeRegCapacity === "number" &&
      Number(currentEvent?.allocatedSeats || 0) >= Number(closeRegCapacity)) ||
    currentEvent?.status === "cancelled" ||
    currentEvent?.isCancelled
  );

  // Real-time Toggle for Close Registration
  const handleToggleCloseReg = async () => {
    if (!activeEventId) return;
    const nextEnabled = !closeRegEnabled;
    setCloseRegEnabled(nextEnabled);

    const isClosedNow = nextEnabled && closeRegMode === "now";
    const isCapReached =
      nextEnabled &&
      closeRegMode === "capacity" &&
      typeof closeRegCapacity === "number" &&
      Number(currentEvent?.allocatedSeats || 0) >= Number(closeRegCapacity);
    const isClosed = isClosedNow || isCapReached;

    const updates = {
      closeRegistrationEnabled: nextEnabled,
      closeRegistrationMode: closeRegMode,
      closeRegistrationCapacity: closeRegMode === "capacity" ? Number(closeRegCapacity) : null,
      registrationClosed: isClosed,
      isRegistrationClosed: isClosed,
      registrationStatus: isClosed ? "Closed" : "Open",
      isActive: !isClosed,
    };

    if (!nextEnabled && currentEvent?.status === "closed") {
      updates.status = "published";
    }

    setCurrentEvent((prev) => ({ ...(prev || {}), ...updates }));

    try {
      setIsSavingCloseReg(true);
      await updateEvent(activeEventId, updates);
      if (nextEnabled) {
        if (closeRegMode === "now") {
          toast.success("Registration closed immediately. Register button disabled in real time.");
        } else {
          toast.success(`Registration capped at ${closeRegCapacity} seats in real time.`);
        }
      } else {
        toast.success("Registration is now OPEN! Register button active in real time.");
      }
    } catch (err) {
      console.error("Failed to update registration status:", err);
      toast.error("Failed to update registration status");
      setCloseRegEnabled(!nextEnabled);
    } finally {
      setIsSavingCloseReg(false);
    }
  };

  // Real-time mode selection: "now" vs "capacity"
  const handleSelectMode = async (mode) => {
    setCloseRegMode(mode);
    if (!activeEventId || !closeRegEnabled) return;

    const isClosedNow = mode === "now";
    const isCapReached =
      mode === "capacity" &&
      typeof closeRegCapacity === "number" &&
      Number(currentEvent?.allocatedSeats || 0) >= Number(closeRegCapacity);
    const isClosed = isClosedNow || isCapReached;

    const updates = {
      closeRegistrationEnabled: true,
      closeRegistrationMode: mode,
      closeRegistrationCapacity: mode === "capacity" ? Number(closeRegCapacity) : null,
      registrationClosed: isClosed,
      isRegistrationClosed: isClosed,
      registrationStatus: isClosed ? "Closed" : "Open",
      isActive: !isClosed,
    };

    setCurrentEvent((prev) => ({ ...(prev || {}), ...updates }));

    try {
      setIsSavingCloseReg(true);
      await updateEvent(activeEventId, updates);
      if (mode === "now") {
        toast.success("Switched to Immediate closure: Registration is now Closed.");
      } else {
        toast.success(`Switched to Capacity mode (auto-closes at ${closeRegCapacity} seats).`);
      }
    } catch (err) {
      console.error("Failed to update registration mode:", err);
      toast.error("Failed to update registration mode");
    } finally {
      setIsSavingCloseReg(false);
    }
  };

  // Real-time capacity blur sync
  const handleCapacityBlur = async () => {
    if (!activeEventId || !closeRegEnabled || closeRegMode !== "capacity") return;
    const capNum = Number(closeRegCapacity) || 0;
    const isCapReached = Number(currentEvent?.allocatedSeats || 0) >= capNum;

    const updates = {
      closeRegistrationCapacity: capNum,
      registrationClosed: isCapReached,
      isRegistrationClosed: isCapReached,
      registrationStatus: isCapReached ? "Closed" : "Open",
      isActive: !isCapReached,
    };

    setCurrentEvent((prev) => ({ ...(prev || {}), ...updates }));
    try {
      await updateEvent(activeEventId, updates);
      toast.success(`Target capacity updated to ${capNum}`);
    } catch (err) {
      console.error("Failed to update capacity limit:", err);
    }
  };

  // Save Close Registration Settings (Explicit Button)
  const handleSaveCloseReg = async () => {
    if (!activeEventId) return;
    setIsSavingCloseReg(true);
    try {
      const isClosedNow = closeRegEnabled && closeRegMode === "now";
      const isCapReached =
        closeRegEnabled &&
        closeRegMode === "capacity" &&
        typeof closeRegCapacity === "number" &&
        Number(currentEvent?.allocatedSeats || 0) >= Number(closeRegCapacity);
      const isClosed = isClosedNow || isCapReached;

      const updates = {
        closeRegistrationEnabled: Boolean(closeRegEnabled),
        closeRegistrationMode: closeRegMode,
        closeRegistrationCapacity: closeRegMode === "capacity" ? Number(closeRegCapacity) : null,
        registrationClosed: isClosed,
        isRegistrationClosed: isClosed,
        registrationStatus: isClosed ? "Closed" : "Open",
        isActive: !isClosed,
      };

      if (!closeRegEnabled && currentEvent?.status === "closed") {
        updates.status = "published";
      }

      await updateEvent(activeEventId, updates);
      setCurrentEvent((prev) => ({ ...prev, ...updates }));
      toast.success(
        isClosed
          ? "Registration settings saved: Registration is CLOSED."
          : "Registration settings saved: Registration is OPEN."
      );
    } catch (err) {
      console.error("Error saving close registration settings:", err);
      toast.error("Failed to save registration setting");
    } finally {
      setIsSavingCloseReg(false);
    }
  };

  // Postpone Event Handler
  const handleSavePostpone = async () => {
    if (!activeEventId) return;
    if (!postponeForm.startDate) {
      toast.error("Please choose a new start date");
      return;
    }

    setIsSavingPostpone(true);
    try {
      const updates = {
        startDate: postponeForm.startDate,
        startTime: postponeForm.startTime,
        endDate: postponeForm.endDate || postponeForm.startDate,
        endTime: postponeForm.endTime,
        date: postponeForm.startDate,
        isPostponed: true,
        status: "postponed",
        postponedNote: postponeForm.note.trim(),
        postponedAt: new Date().toISOString(),
      };

      await updateEvent(activeEventId, updates);
      setCurrentEvent((prev) => ({ ...prev, ...updates }));
      setShowPostponeModal(false);
      toast.success("Event postponed successfully. Updated dates are now live!");
    } catch (err) {
      console.error("Failed to postpone event:", err);
      toast.error("Failed to postpone event");
    } finally {
      setIsSavingPostpone(false);
    }
  };

  // Cancel Event Handler
  const handleConfirmCancelEvent = async () => {
    if (!activeEventId) return;
    setIsCancelling(true);
    try {
      const updates = {
        isCancelled: true,
        status: "cancelled",
        registrationClosed: true,
        closeRegistrationEnabled: true,
        closeRegistrationMode: "now",
        registrationStatus: "Closed",
        cancelledAt: new Date().toISOString(),
      };

      await updateEvent(activeEventId, updates);
      setCurrentEvent((prev) => ({ ...prev, ...updates }));
      setShowCancelModal(false);
      toast.success("Event has been cancelled. Registrations are completely closed.");
    } catch (err) {
      console.error("Failed to cancel event:", err);
      toast.error("Failed to cancel event");
    } finally {
      setIsCancelling(false);
    }
  };

  // Delete Event Handler
  const handleDeleteEvent = async () => {
    if (!activeEventId) return;
    setIsDeleting(true);
    try {
      await deleteEvent(activeEventId);
      if (typeof window !== "undefined") {
        try {
          localStorage.removeItem("admin_selected_event_id");
        } catch {}
      }
      toast.success("Event deleted successfully");
      setShowDeleteModal(false);
      router.push("/admin/dashboard");
    } catch (err) {
      console.error("Failed to delete event:", err);
      toast.error("Failed to delete event");
      setIsDeleting(false);
    }
  };

  const handleTogglePublish = async () => {
    if (!activeEventId) return;
    const nextState = !isPublished;
    setIsPublished(nextState);
    try {
      await updateEvent(activeEventId, {
        published: nextState,
        isActive: nextState,
        status: nextState ? "published" : "draft",
      });
      toast.success(nextState ? "Event is now public!" : "Event unpublished");
    } catch {
      toast.error("Failed to update status");
      setIsPublished(!nextState);
    }
  };

  if (loadingEvent) {
    return (
      <BrandLoader
        message="Loading event settings"
        subMessage="TicketLelo Control Room"
        fullScreen
      />
    );
  }

  return (
    <div className="py-4 sm:py-6 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto w-full text-slate-900 dark:text-white selection:bg-[#FE760B] selection:text-white pb-24">
      {/* ── Standard Navigation Header (More Tab active) ── */}
      <EventControlHeader
        activeTab="More"
        eventTitle={currentEvent?.name || currentEvent?.title || "Tech Fest 2026"}
        eventSlug={customSlug}
        eventId={activeEventId}
        isLive={isPublished && !currentEvent?.isCancelled}
      />

      {/* ── 1. Public link Section ── */}
      <div className="mb-7">
        <h2 className="text-base font-bold text-slate-900 dark:text-white mb-0.5">Public link</h2>
        <p className="text-xs text-[#64748B] dark:text-[#9B9EA4] mb-3">
          The link your attendees and guests open to register.
        </p>

        <div className="bg-white dark:bg-[#1A1C1F] border border-[#D9DBE0] dark:border-[#2A2D31] rounded-2xl p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-2 h-2 rounded-full bg-[#3DD68C] shrink-0" />
            <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white truncate font-sans">
              {fullUrl}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopyLink}
              className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#212327] dark:hover:bg-[#2A2D31] border border-[#D9DBE0] dark:border-[#2A2D31] text-xs font-semibold text-slate-900 dark:text-white transition-colors cursor-pointer"
            >
              {copied ? "Copied" : "Copy"}
            </button>
            <Link
              href={`/e/${customSlug}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#212327] dark:hover:bg-[#2A2D31] border border-[#D9DBE0] dark:border-[#2A2D31] text-xs font-semibold text-slate-900 dark:text-white transition-colors cursor-pointer"
            >
              <span>Open</span>
              <ExternalLink size={12} />
            </Link>
          </div>
        </div>
      </div>

      {/* ── 2. Completely Editable Custom URL & Domain ── */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-1.5">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Custom URL &amp; Domain</h2>
          <span className="text-[11px] font-medium text-[#64748B] dark:text-[#9B9EA4]">
            Completely editable domain &amp; event name
          </span>
        </div>
        <p className="text-xs text-[#64748B] dark:text-[#9B9EA4] mb-3">
          Update the domain or event slug at any time. Changes reflect immediately across all public links.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
          {/* Editable Domain */}
          <div className="md:col-span-5 flex items-center bg-white dark:bg-[#1A1C1F] border border-[#D9DBE0] dark:border-[#2A2D31] rounded-xl overflow-hidden focus-within:border-[#FE760B] transition-colors shadow-xs">
            <span className="px-3 py-2 text-xs text-[#64748B] dark:text-[#9B9EA4] bg-slate-50 dark:bg-[#212327]/60 border-r border-[#D9DBE0] dark:border-[#2A2D31] font-mono select-none">
              https://
            </span>
            <input
              type="text"
              placeholder={defaultDomain}
              value={customDomain}
              onChange={(e) => setCustomDomain(e.target.value)}
              className="px-3 py-2 bg-transparent text-xs sm:text-sm text-slate-900 dark:text-white outline-none flex-1 font-mono"
              title="Custom domain (e.g. ticketlelo.in or your own domain)"
            />
            <span className="px-2 text-xs text-[#64748B] dark:text-[#9B9EA4] select-none font-mono">/</span>
          </div>

          {/* Editable Event Name / Slug */}
          <div className="md:col-span-4 flex items-center bg-white dark:bg-[#1A1C1F] border border-[#D9DBE0] dark:border-[#2A2D31] rounded-xl overflow-hidden focus-within:border-[#FE760B] transition-colors shadow-xs">
            <input
              type="text"
              value={customSlug}
              onChange={(e) => setCustomSlug(e.target.value)}
              placeholder="event-slug"
              className="px-3 py-2 bg-transparent text-xs sm:text-sm text-slate-900 dark:text-white outline-none flex-1 font-sans"
            />
          </div>

          {/* Action Buttons */}
          <div className="md:col-span-3 flex items-center gap-2">
            <button
              type="button"
              onClick={handleGenerateSlug}
              className="flex-1 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#212327] dark:hover:bg-[#2A2D31] border border-[#D9DBE0] dark:border-[#2A2D31] text-xs font-medium text-slate-900 dark:text-white transition-colors whitespace-nowrap cursor-pointer shadow-xs text-center"
            >
              Generate
            </button>
            <button
              type="button"
              onClick={handleSaveSlug}
              disabled={isSavingSlug}
              className="flex-1 px-4 py-2 rounded-xl bg-[#FE760B] hover:bg-[#FF8A2B] text-black text-xs font-bold transition-all shadow-xs whitespace-nowrap cursor-pointer active:scale-95 disabled:opacity-50 text-center"
            >
              {isSavingSlug ? "Saving..." : "Save URL"}
            </button>
          </div>
        </div>
      </div>

      {/* ── 3. Close Registration Controls ── */}
      <div className="mb-8">
        <div className="bg-white dark:bg-[#1A1C1F] border border-[#D9DBE0] dark:border-[#2A2D31] rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sliders size={16} className="text-[#FE760B]" />
                  Close Registration
                </h3>
                {/* Live Real-time Status Badge */}
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold transition-colors ${
                    isCurrentlyClosed
                      ? "bg-red-500/10 text-red-500 border border-red-500/20"
                      : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isCurrentlyClosed ? "bg-red-500" : "bg-emerald-500 animate-pulse"
                    }`}
                  />
                  {isCurrentlyClosed ? "Registration Closed" : "Registration Open"}
                </span>
              </div>
              <p className="text-xs text-[#64748B] dark:text-[#9B9EA4] mt-1">
                Toggle to close registration immediately or automatically once attendee capacity is reached.
              </p>
            </div>

            {/* Real-time Toggle Switch */}
            <button
              type="button"
              disabled={isSavingCloseReg}
              onClick={handleToggleCloseReg}
              title={closeRegEnabled ? "Click to re-open registration in real time" : "Click to close registration"}
              className={`w-12 h-6 rounded-full transition-colors relative p-0.5 shrink-0 cursor-pointer disabled:opacity-50 ${
                closeRegEnabled ? "bg-[#FE760B]" : "bg-slate-300 dark:bg-[#2A2D31]"
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  closeRegEnabled ? "translate-x-6" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {closeRegEnabled ? (
            <div className="pt-3 border-t border-[#D9DBE0] dark:border-[#2A2D31] space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-700 dark:text-[#D0D0D1]">
                  Select closure condition:
                </p>
                <span className="text-[11px] text-[#FE760B] font-medium flex items-center gap-1">
                  <CheckCircle2 size={12} />
                  Saves in real time on select
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Option 1: Now */}
                <label
                  onClick={() => handleSelectMode("now")}
                  className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                    closeRegMode === "now"
                      ? "bg-[#FE760B]/10 border-[#FE760B] text-slate-900 dark:text-white"
                      : "bg-slate-50 dark:bg-[#212327]/50 border-[#D9DBE0] dark:border-[#2A2D31] text-slate-600 dark:text-[#9B9EA4]"
                  }`}
                >
                  <input
                    type="radio"
                    name="closeRegMode"
                    checked={closeRegMode === "now"}
                    onChange={() => handleSelectMode("now")}
                    className="mt-0.5 accent-[#FE760B]"
                  />
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">Now (Immediate)</p>
                    <p className="text-[11px] text-[#64748B] dark:text-[#9B9EA4] mt-0.5">
                      The register button immediately disables with &ldquo;Closed for registration&rdquo;.
                    </p>
                  </div>
                </label>

                {/* Option 2: After Capacity */}
                <label
                  onClick={() => handleSelectMode("capacity")}
                  className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                    closeRegMode === "capacity"
                      ? "bg-[#FE760B]/10 border-[#FE760B] text-slate-900 dark:text-white"
                      : "bg-slate-50 dark:bg-[#212327]/50 border-[#D9DBE0] dark:border-[#2A2D31] text-slate-600 dark:text-[#9B9EA4]"
                  }`}
                >
                  <input
                    type="radio"
                    name="closeRegMode"
                    checked={closeRegMode === "capacity"}
                    onChange={() => handleSelectMode("capacity")}
                    className="mt-0.5 accent-[#FE760B]"
                  />
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">After this capacity</p>
                    <p className="text-[11px] text-[#64748B] dark:text-[#9B9EA4] mt-0.5">
                      Closes automatically in real-time when paid (verified) and free registrations reach capacity.
                    </p>
                  </div>
                </label>
              </div>

              {closeRegMode === "capacity" && (
                <div className="pt-1 max-w-xs">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-[#D0D0D1] mb-1.5">
                    Target Capacity Limit
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={closeRegCapacity}
                    onChange={(e) => setCloseRegCapacity(parseInt(e.target.value, 10) || 0)}
                    onBlur={handleCapacityBlur}
                    placeholder="e.g. 100"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-[#212327] border border-[#D9DBE0] dark:border-[#2A2D31] text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-[#FE760B]"
                  />
                  <p className="text-[11px] text-[#64748B] dark:text-[#9B9EA4] mt-1">
                    Current registrations counted: <strong>{currentEvent?.allocatedSeats || 0}</strong>
                  </p>
                </div>
              )}

              <button
                type="button"
                disabled={isSavingCloseReg}
                onClick={handleSaveCloseReg}
                className="px-4 py-2 rounded-xl bg-[#FE760B] hover:bg-[#FF8A2B] text-black text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isSavingCloseReg ? "Saving..." : "Save Registration Setting"}
              </button>
            </div>
          ) : (
            <div className="pt-3 border-t border-[#D9DBE0] dark:border-[#2A2D31] flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={14} className="shrink-0" />
              <span>
                Registration is <strong>OPEN</strong> in real time. Attendees can register without restriction.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── 4. Embed as Button (Clean and Crisp) ── */}
      <div className="mb-10 pb-8 border-b border-[#D9DBE0] dark:border-[#2A2D31]">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
            Embed as Button
          </h2>
          <span
            className={`text-xs font-semibold flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${
              isCurrentlyClosed
                ? "bg-red-500/10 text-red-500 border-red-500/20"
                : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isCurrentlyClosed ? "bg-red-500" : "bg-emerald-500 animate-pulse"
              }`}
            />
            {isCurrentlyClosed ? "Status: Closed for registration" : "Status: Open for registration"}
          </span>
        </div>
        <p className="text-xs text-[#64748B] dark:text-[#9B9EA4] mb-4">
          Add a clean, crisp TicketLelo registration button to your own website.
        </p>

        {/* Code Snippet Box */}
        <div className="mb-6">
          <div className="bg-[#FAF9F5] dark:bg-[#141517] border border-[#E2E8F0] dark:border-[#2A2D31] rounded-2xl p-4 relative font-mono text-xs overflow-x-auto shadow-inner">
            <button
              type="button"
              onClick={handleCopyEmbedCode}
              className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-white dark:bg-[#212327] hover:bg-slate-100 dark:hover:bg-[#2A2D31] border border-[#D9DBE0] dark:border-[#2A2D31] text-[11px] font-semibold text-slate-900 dark:text-white transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Copy size={12} />
              <span>{codeCopied ? "Copied" : "Copy code"}</span>
            </button>

            <div className="space-y-1 pr-24 text-slate-800 dark:text-slate-200">
              <span className="text-[#64748B] dark:text-[#9B9EA4]">&lt;</span>
              <span className="text-rose-600 dark:text-rose-400 font-bold">a</span>
              <br />
              &nbsp;&nbsp;
              <span className="text-amber-600 dark:text-amber-400">href</span>
              <span className="text-[#64748B] dark:text-[#9B9EA4]">=</span>
              <span className="text-emerald-600 dark:text-emerald-400">&quot;{getPublicBaseUrl()}/e/{customSlug}&quot;</span>
              <br />
              &nbsp;&nbsp;
              <span className="text-amber-600 dark:text-amber-400">class</span>
              <span className="text-[#64748B] dark:text-[#9B9EA4]">=</span>
              <span className="text-emerald-600 dark:text-emerald-400">&quot;ticketlelo-register-button&quot;</span>
              <br />
              &nbsp;&nbsp;
              <span className="text-amber-600 dark:text-amber-400">data-event-id</span>
              <span className="text-[#64748B] dark:text-[#9B9EA4]">=</span>
              <span className="text-emerald-600 dark:text-emerald-400">&quot;{activeEventId || "evt-" + customSlug}&quot;</span>
              <br />
              <span className="text-[#64748B] dark:text-[#9B9EA4]">&gt;</span>
              <br />
              &nbsp;&nbsp;<span className="text-slate-900 dark:text-white font-sans font-semibold">
                {isCurrentlyClosed ? "Registration Closed" : "Register for Event"}
              </span>
              <br />
              <span className="text-[#64748B] dark:text-[#9B9EA4]">&lt;/</span>
              <span className="text-rose-600 dark:text-rose-400 font-bold">a</span>
              <span className="text-[#64748B] dark:text-[#9B9EA4]">&gt;</span>
              <br />
              <br />
              <span className="text-[#64748B] dark:text-[#9B9EA4]">&lt;</span>
              <span className="text-rose-600 dark:text-rose-400 font-bold">script</span>{" "}
              <span className="text-amber-600 dark:text-amber-400">src</span>
              <span className="text-[#64748B] dark:text-[#9B9EA4]">=</span>
              <span className="text-emerald-600 dark:text-emerald-400">&quot;{getPublicBaseUrl()}/embed/ticketlelo-embed.js&quot;</span>{" "}
              <span className="text-amber-600 dark:text-amber-400">async</span>
              <span className="text-[#64748B] dark:text-[#9B9EA4]">&gt;&lt;/</span>
              <span className="text-rose-600 dark:text-rose-400 font-bold">script</span>
              <span className="text-[#64748B] dark:text-[#9B9EA4]">&gt;</span>
            </div>
          </div>
        </div>

        {/* Live Demo Button Box */}
        <div>
          <p className="text-xs text-[#64748B] dark:text-[#9B9EA4] mb-3">
            Click the preview button below to test registration:
          </p>

          <div className="bg-[#FAF9F5] dark:bg-[#141517] border border-[#E2E8F0] dark:border-[#2A2D31] rounded-2xl p-8 flex flex-col items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setShowDemoModal(true)}
              className={`px-6 py-2.5 rounded-full text-xs sm:text-sm font-semibold transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-2 ${
                isCurrentlyClosed
                  ? "bg-slate-300 dark:bg-[#2A2D31] text-slate-700 dark:text-[#D0D0D1] hover:brightness-105"
                  : "bg-[#18181B] hover:bg-black text-white dark:bg-white dark:hover:bg-slate-100 dark:text-black"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isCurrentlyClosed ? "bg-red-500" : "bg-emerald-500 animate-pulse"
                }`}
              />
              <span>{isCurrentlyClosed ? "Closed for Registration (Preview Modal)" : "Register for Event"}</span>
            </button>
            <p className="text-[11px] text-[#64748B] dark:text-[#9B9EA4]">
              {isCurrentlyClosed
                ? "Button reflects closed state in real time. Click to preview modal behavior."
                : "Real-time registration active. Click to test attendee booking flow."}
            </p>
          </div>
        </div>
      </div>

      {/* ── 5. Ticket Artwork & Clean Ticket Preview ── */}
      <div className="mb-10 pb-8 border-b border-[#D9DBE0] dark:border-[#2A2D31]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Ticket artwork &amp; background
              </h2>
            </div>
            <p className="text-xs text-[#64748B] dark:text-[#9B9EA4] mt-1">
              Upload custom background artwork for your attendees&apos; tickets.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {ticketBgPreview && (
              <button
                type="button"
                onClick={() => setTicketBgPreview(null)}
                className="px-3 py-1.5 rounded-xl border border-red-500/30 text-red-500 hover:bg-red-500/10 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Trash2 size={13} />
                <span>Remove artwork</span>
              </button>
            )}
            <button
              type="button"
              disabled={isSavingTicketBg}
              onClick={handleSaveTicketLook}
              className="px-4 py-2 rounded-xl bg-[#061A3F] hover:bg-[#061A3F]/90 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-black text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
            >
              {isSavingTicketBg ? "Saving..." : "Save ticket look"}
            </button>
          </div>
        </div>

        {/* Aspect Ratio Banner */}
        <div className="bg-[#FAF9F5] dark:bg-[#1A1C1F] border border-[#E2E8F0] dark:border-[#2A2D31] rounded-2xl p-4 sm:p-5 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-inner">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#FE760B]/15 border border-[#FE760B]/30 flex items-center justify-center text-[#FE760B] shrink-0 mt-0.5">
              <Ticket size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Design Aspect Ratio:
                </span>
                <span className="px-2.5 py-0.5 rounded-md bg-[#FE760B] text-black font-mono font-bold text-xs">
                  16:9 or 2.5:1
                </span>
                <span className="text-xs text-[#64748B] dark:text-[#9B9EA4]">
                  (Recommended: 1200 × 675 px or 1000 × 400 px)
                </span>
              </div>
              <p className="text-xs text-[#64748B] dark:text-[#9B9EA4] mt-1 leading-relaxed">
                Images are automatically auto-fitted and centered with zero stretching. Attendee name, event dates, venue and QR stub overlay with high-contrast legibility.
              </p>
            </div>
          </div>

          <label className="px-4 py-2.5 rounded-xl bg-white dark:bg-[#212327] hover:bg-slate-100 dark:hover:bg-[#2A2D31] border border-[#D9DBE0] dark:border-[#2A2D31] text-xs font-semibold text-slate-900 dark:text-white transition-colors cursor-pointer shrink-0 flex items-center justify-center gap-2 shadow-xs group">
            <Upload size={15} className="text-[#FE760B] group-hover:scale-110 transition-transform" />
            <span>Upload Ticket Artwork</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleTicketBgUpload}
              className="hidden"
            />
          </label>
        </div>

        {/* Clean Ticket Preview with Interactive Tear & Scan */}
        <div className="bg-[#FAF9F5] dark:bg-[#141517] border border-[#E2E8F0] dark:border-[#2A2D31] rounded-2xl p-4 sm:p-6 shadow-inner">
          <div className="flex items-center gap-2 mb-4">
            <span className={`w-2.5 h-2.5 rounded-full ${previewCheckedIn ? "bg-emerald-400 animate-pulse" : "bg-[#3DD68C]"}`} />
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Live Ticket Preview
            </h3>
          </div>

          {/* Ticket Render */}
          <div className="py-2 overflow-x-auto no-scrollbar flex justify-center">
            <div className="w-full max-w-3xl">
              <StubTicket
                event={{
                  name: currentEvent?.name || currentEvent?.title || "Tech Fest 2026",
                  title: currentEvent?.name || currentEvent?.title || "Tech Fest 2026",
                  date: currentEvent?.date || currentEvent?.startDate || "2026-11-07",
                  time: currentEvent?.time || currentEvent?.startTime || "10:00 AM",
                  location: currentEvent?.location || currentEvent?.venue || "Main Auditorium, Campus",
                  theme: selectedColor.id,
                  themeColor: selectedColor.hex,
                  price: currentEvent?.price !== undefined ? currentEvent.price : 199,
                  ticketBgUrl: ticketBgPreview,
                }}
                registration={{
                  ticketId: "TKT-1793-LIVE-DEMO",
                  attendeeName: "Rahul Sharma (Attendee)",
                  status: previewCheckedIn ? "Used" : "Unused",
                  checkedIn: previewCheckedIn,
                  ticketTier: "VIP ALL-ACCESS",
                  ticketBgUrl: ticketBgPreview,
                }}
                interactive={true}
                onCheckIn={() => setPreviewCheckedIn(true)}
                showActions={false}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── 6. Event Lifecycle & Management: Postpone, Cancel, Delete ── */}
      <div className="mb-10 pb-8 border-b border-[#D9DBE0] dark:border-[#2A2D31]">
        <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mb-1">
          Event Actions &amp; Lifecycle
        </h2>
        <p className="text-xs text-[#64748B] dark:text-[#9B9EA4] mb-4">
          Manage event schedule updates, cancellation, or permanent removal.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {/* Postpone Event Card */}
          <div className="bg-white dark:bg-[#1A1C1F] border border-[#D9DBE0] dark:border-[#2A2D31] rounded-2xl p-4 flex flex-col justify-between shadow-xs">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <Clock className="w-4 h-4 text-[#FE760B]" />
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                  Postpone Event
                </h3>
              </div>
              <p className="text-xs text-[#64748B] dark:text-[#9B9EA4] leading-relaxed mb-4">
                Reschedule event to new dates. Existing attendees and tickets are preserved with updated event dates.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowPostponeModal(true)}
              className="w-full py-2 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-bold transition-colors cursor-pointer"
            >
              Postpone event
            </button>
          </div>

          {/* Cancel Event Card */}
          <div className="bg-white dark:bg-[#1A1C1F] border border-[#D9DBE0] dark:border-[#2A2D31] rounded-2xl p-4 flex flex-col justify-between shadow-xs">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <AlertCircle className="w-4 h-4 text-rose-500" />
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                  Cancel Event
                </h3>
              </div>
              <p className="text-xs text-[#64748B] dark:text-[#9B9EA4] leading-relaxed mb-4">
                Marks event as cancelled and immediately closes all registration. No further registrations will be entertained.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCancelModal(true)}
              className="w-full py-2 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold transition-colors cursor-pointer"
            >
              {currentEvent?.isCancelled ? "Event Cancelled" : "Cancel event"}
            </button>
          </div>

          {/* Delete Event Card */}
          <div className="bg-white dark:bg-[#1A1C1F] border border-red-500/20 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <Trash2 className="w-4 h-4 text-red-500" />
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                  Delete Event
                </h3>
              </div>
              <p className="text-xs text-[#64748B] dark:text-[#9B9EA4] leading-relaxed mb-4">
                Permanently deletes the event and all associated registrations from the database. Cannot be undone.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="w-full py-2 px-3 rounded-xl bg-red-50 dark:bg-[#261515] hover:bg-red-100 dark:hover:bg-[#381a1a] border border-red-500/30 text-red-600 dark:text-[#FF6B6B] text-xs font-bold transition-colors cursor-pointer"
            >
              Delete event
            </button>
          </div>
        </div>
      </div>

      {/* ── 7. Publishing Section ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Visibility &amp; Publishing</h2>
            {isPublished && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Published
              </span>
            )}
          </div>
          <p className="text-xs text-[#64748B] dark:text-[#9B9EA4]">
            Unpublishing prevents public discovery while allowing the organiser to view and edit.
          </p>
        </div>

        <button
          type="button"
          onClick={handleTogglePublish}
          className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#212327] dark:hover:bg-[#2A2D31] border border-[#D9DBE0] dark:border-[#2A2D31] text-xs font-semibold text-slate-900 dark:text-white transition-colors self-start sm:self-auto cursor-pointer"
        >
          {isPublished ? "Unpublish" : "Publish event"}
        </button>
      </div>

      {/* ══════════════════════════════════════════════════
          MODAL: POSTPONE EVENT (Enhanced with Styled Calendar & Time Dropdown)
          ══════════════════════════════════════════════════ */}
      {showPostponeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-3xl bg-[#1A1C1F] border border-[#2A2D31] p-6 sm:p-7 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85)] relative space-y-5 text-white animate-in zoom-in-95 duration-200">
            <button
              type="button"
              onClick={() => setShowPostponeModal(false)}
              className="absolute top-5 right-5 p-2 text-[#9B9EA4] hover:text-white rounded-full bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0 shadow-lg shadow-amber-500/10">
                <Clock size={22} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white tracking-tight">Postpone Event</h3>
                <p className="text-xs text-[#9B9EA4]">Enter the new schedule for this event</p>
              </div>
            </div>

            {/* Current / Old Dates Box */}
            <div className="p-3.5 rounded-2xl bg-[#131517] border border-[#2A2D31] space-y-1.5 text-xs">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#9B9EA4]">
                <Calendar size={13} className="text-[#FE760B]" />
                <span>Current Schedule</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                <div className="bg-[#1A1C1F] px-3 py-2 rounded-xl border border-[#2A2D31]">
                  <span className="text-[10px] uppercase font-bold text-[#9B9EA4] block">Start</span>
                  <span className="text-white font-semibold text-xs">
                    {currentEvent?.startDate || currentEvent?.date || "Not set"} at {currentEvent?.startTime || "10:00 AM"}
                  </span>
                </div>
                <div className="bg-[#1A1C1F] px-3 py-2 rounded-xl border border-[#2A2D31]">
                  <span className="text-[10px] uppercase font-bold text-[#9B9EA4] block">End</span>
                  <span className="text-white font-semibold text-xs">
                    {currentEvent?.endDate || currentEvent?.startDate || "Not set"} at {currentEvent?.endTime || "05:00 PM"}
                  </span>
                </div>
              </div>
            </div>

            {/* New Schedule Inputs */}
            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-[#FE760B] uppercase tracking-wider">
                  New Dates &amp; Times
                </p>
                <span className="text-[10px] text-[#9B9EA4]">All timezones GMT+5:30</span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#9B9EA4] uppercase mb-1.5">
                    New Start Date *
                  </label>
                  <div className="relative">
                    <Calendar size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#FE760B] pointer-events-none" />
                    <input
                      type="date"
                      value={postponeForm.startDate}
                      onChange={(e) => setPostponeForm((prev) => ({ ...prev, startDate: e.target.value }))}
                      className="w-full bg-[#131517] border border-[#2A2D31] focus:border-[#FE760B] focus:ring-1 focus:ring-[#FE760B]/30 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white outline-none [color-scheme:dark] transition-all cursor-pointer"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#9B9EA4] uppercase mb-1.5">
                    New Start Time
                  </label>
                  <div className="relative">
                    <Clock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#FE760B] pointer-events-none" />
                    <select
                      value={postponeForm.startTime}
                      onChange={(e) => setPostponeForm((prev) => ({ ...prev, startTime: e.target.value }))}
                      className="w-full bg-[#131517] border border-[#2A2D31] focus:border-[#FE760B] focus:ring-1 focus:ring-[#FE760B]/30 rounded-xl pl-9 pr-8 py-2.5 text-xs text-white outline-none appearance-none transition-all cursor-pointer [color-scheme:dark]"
                    >
                      <option value="" disabled>Select start time</option>
                      {TIME_OPTIONS.map((t) => (
                        <option key={t} value={t} className="bg-[#1A1C1F] text-white">
                          {t}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9B9EA4] pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#9B9EA4] uppercase mb-1.5">
                    New End Date
                  </label>
                  <div className="relative">
                    <Calendar size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#FE760B] pointer-events-none" />
                    <input
                      type="date"
                      value={postponeForm.endDate}
                      onChange={(e) => setPostponeForm((prev) => ({ ...prev, endDate: e.target.value }))}
                      className="w-full bg-[#131517] border border-[#2A2D31] focus:border-[#FE760B] focus:ring-1 focus:ring-[#FE760B]/30 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white outline-none [color-scheme:dark] transition-all cursor-pointer"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#9B9EA4] uppercase mb-1.5">
                    New End Time
                  </label>
                  <div className="relative">
                    <Clock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#FE760B] pointer-events-none" />
                    <select
                      value={postponeForm.endTime}
                      onChange={(e) => setPostponeForm((prev) => ({ ...prev, endTime: e.target.value }))}
                      className="w-full bg-[#131517] border border-[#2A2D31] focus:border-[#FE760B] focus:ring-1 focus:ring-[#FE760B]/30 rounded-xl pl-9 pr-8 py-2.5 text-xs text-white outline-none appearance-none transition-all cursor-pointer [color-scheme:dark]"
                    >
                      <option value="" disabled>Select end time</option>
                      {TIME_OPTIONS.map((t) => (
                        <option key={t} value={t} className="bg-[#1A1C1F] text-white">
                          {t}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9B9EA4] pointer-events-none" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#9B9EA4] uppercase mb-1.5">
                  Announcement / Reason (Optional)
                </label>
                <textarea
                  rows={2}
                  value={postponeForm.note}
                  onChange={(e) => setPostponeForm((prev) => ({ ...prev, note: e.target.value }))}
                  placeholder="e.g. Postponed due to university exams. All registered passes remain valid."
                  className="w-full bg-[#131517] border border-[#2A2D31] focus:border-[#FE760B] focus:ring-1 focus:ring-[#FE760B]/30 rounded-xl p-3 text-xs text-white outline-none resize-none placeholder-[#64748B] transition-all"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowPostponeModal(false)}
                className="px-4 py-2.5 rounded-xl bg-[#212327] hover:bg-[#2A2D31] text-xs font-semibold text-[#9B9EA4] hover:text-white transition-colors cursor-pointer border border-[#2A2D31]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingPostpone}
                onClick={handleSavePostpone}
                className="px-5 py-2.5 rounded-xl bg-[#FE760B] hover:bg-[#FF8A2B] text-black text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
              >
                {isSavingPostpone ? "Saving Schedule..." : "Confirm Postponement"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          MODAL: CANCEL EVENT
          ══════════════════════════════════════════════════ */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl bg-[#1A1C1F] border border-rose-500/30 p-6 shadow-2xl relative space-y-4 text-white animate-in zoom-in-95 duration-200">
            <button
              type="button"
              onClick={() => setShowCancelModal(false)}
              className="absolute top-5 right-5 p-1.5 text-[#9B9EA4] hover:text-white rounded-full bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-500">
              <AlertTriangle size={24} />
            </div>

            <h3 className="text-lg font-bold text-white tracking-tight">Cancel this event?</h3>
            <p className="text-xs text-[#9B9EA4] leading-relaxed">
              Cancelling will immediately disable and close registrations on the public event page and embed widgets. A prominent &ldquo;Event Cancelled&rdquo; banner will be displayed to all visitors.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#2A2D31]">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 rounded-xl bg-[#212327] hover:bg-[#2A2D31] text-xs font-semibold text-[#9B9EA4] hover:text-white transition-colors cursor-pointer"
              >
                Keep Event Active
              </button>
              <button
                type="button"
                disabled={isCancelling}
                onClick={handleConfirmCancelEvent}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
              >
                {isCancelling ? "Cancelling..." : "Confirm Cancellation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          MODAL: DELETE EVENT
          ══════════════════════════════════════════════════ */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl bg-[#1A1C1F] border border-red-500/40 p-6 shadow-2xl relative space-y-4 text-white animate-in zoom-in-95 duration-200">
            <button
              type="button"
              onClick={() => setShowDeleteModal(false)}
              className="absolute top-5 right-5 p-1.5 text-[#9B9EA4] hover:text-white rounded-full bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-500">
              <Trash2 size={24} />
            </div>

            <h3 className="text-lg font-bold text-white tracking-tight">Permanently delete event?</h3>
            <p className="text-xs text-[#9B9EA4] leading-relaxed">
              This action <strong>cannot be undone</strong>. The event record, registration forms, and guest pass data will be permanently deleted from the database.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#2A2D31]">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-xl bg-[#212327] hover:bg-[#2A2D31] text-xs font-semibold text-[#9B9EA4] hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteEvent}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Permanently Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Demo Registration Modal */}
      <EmbedRegistrationModal
        isOpen={showDemoModal}
        onClose={() => setShowDemoModal(false)}
        event={{
          ...currentEvent,
          id: activeEventId,
          name: currentEvent?.name || currentEvent?.title || "Tech Fest 2026",
          embedRegistrationMode: registrationMode,
          customFormEmbedUrl: customFormUrl,
          closeRegistrationEnabled: closeRegEnabled,
          closeRegistrationMode: closeRegMode,
          closeRegistrationCapacity: closeRegMode === "capacity" ? Number(closeRegCapacity) : null,
          registrationClosed: isCurrentlyClosed,
          isRegistrationClosed: isCurrentlyClosed,
          registrationStatus: isCurrentlyClosed ? "Closed" : "Open",
          isActive: !isCurrentlyClosed,
        }}
        onRegistrationSuccess={() => {
          toast.success("Registration demo completed!");
        }}
      />
    </div>
  );
}
