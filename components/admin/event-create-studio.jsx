"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Calendar,
  Clock,
  Globe,
  MapPin,
  Ticket,
  Users,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Camera,
  Check,
  ChevronDown,
  Loader2,
  X,
  Upload,
  Radio,
  Video,
  ArrowLeft,
  Sparkles,
  Type,
  Sliders,
  Eye,
  Layers,
  Move,
  RotateCcw,
  Edit3,
} from "lucide-react";
import { toast } from "sonner";
import { createEvent, updateEvent } from "@/lib/firestore";
import { useAuth } from "@/context/auth-context";
import { StubTicket } from "@/components/tickets/stub-ticket";
import { WideTicket } from "@/components/tickets/wide-ticket";
import { ThemeToggle } from "@/components/ui/theme-toggle";

import { getPosterLines } from "@/lib/theme-utils";
export { getPosterLines };

const THEMES = [
  {
    id: "sunset",
    name: "Sunset",
    color: "#FE760B",
    bg: "#FE760B",
    sun: "#FB923C",
    text: "#131517",
  },
  {
    id: "sunny",
    name: "Sunny",
    color: "#FDE003",
    bg: "#FE760B",
    sun: "#FDE003",
    text: "#131517",
  },
  {
    id: "electric",
    name: "Electric",
    color: "#2B59FF",
    bg: "#1D4ED8",
    sun: "#38BDF8",
    text: "#FFFFFF",
  },
  {
    id: "neon",
    name: "Neon",
    color: "#EC4899",
    bg: "#BE185D",
    sun: "#F43F5E",
    text: "#FFFFFF",
  },
  {
    id: "mint",
    name: "Mint",
    color: "#10B981",
    bg: "#047857",
    sun: "#34D399",
    text: "#FFFFFF",
  },
];

const POPULAR_LOCATIONS = [
  {
    name: "KIET Group of Institutions",
    address: "Delhi-NCR, Meerut Road (NH-58), Ghaziabad, UP 201206",
  },
  {
    name: "Delhi Technological University (DTU)",
    address: "Shahbad Daulatpur, Main Bawana Road, Delhi 110042",
  },
  {
    name: "Indian Institute of Technology Delhi (IIT-D)",
    address: "Hauz Khas, New Delhi, Delhi 110016",
  },
  {
    name: "Bharat Mandapam (IECC)",
    address: "Pragati Maidan, New Delhi, Delhi 110001",
  },
  {
    name: "Cyber Hub",
    address: "DLF Cyber City, Sector 24, Gurugram, Haryana 122002",
  },
  {
    name: "Innovation Lab, Block E",
    address: "Engineering Campus, Block E, Floor 2",
  },
];

function formatTimeWithTz(date = new Date()) {
  try {
    const timeStr = date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    return `${timeStr} GMT+5:30`;
  } catch {
    return "1:04 PM GMT+5:30";
  }
}

export function EventCreateStudio({
  editingEvent = null,
  onClose,
  onSuccess,
}) {
  const { user } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef(null);

  // Live top-bar clock
  const [clockString, setClockString] = useState("1:04 PM GMT+5:30");

  useEffect(() => {
    const updateClock = () => setClockString(formatTimeWithTz(new Date()));
    updateClock();
    const timer = setInterval(updateClock, 10000);
    return () => clearInterval(timer);
  }, []);

  // Initialize form state
  const getInitialDates = () => {
    if (editingEvent) {
      let sDate = "";
      let eDate = "";
      try {
        const d = editingEvent.date?.toDate
          ? editingEvent.date.toDate()
          : new Date(editingEvent.date);
        if (!isNaN(d)) sDate = d.toISOString().split("T")[0];
      } catch {
        sDate = "";
      }
      return {
        startDate: editingEvent.startDate || sDate || "2026-11-07",
        startTime: editingEvent.startTime || "12:00 pm",
        endDate: editingEvent.endDate || sDate || "2026-11-07",
        endTime: editingEvent.endTime || "05:00 pm",
      };
    }
    return {
      startDate: "2026-11-07",
      startTime: "12:00 pm",
      endDate: "2026-11-07",
      endTime: "05:00 pm",
    };
  };

  const initialDates = getInitialDates();

  const [formData, setFormData] = useState({
    name: editingEvent?.name || "",
    description:
      typeof editingEvent?.description === "string"
        ? editingEvent.description
        : editingEvent?.description?.text || "",
    startDate: initialDates.startDate,
    startTime: initialDates.startTime,
    endDate: initialDates.endDate,
    endTime: initialDates.endTime,
    timezone: editingEvent?.timezone || "GMT+05:30",
    timezoneCity: editingEvent?.timezoneCity || "Kolkata",
    location: editingEvent?.location || "",
    locationType: editingEvent?.locationType || "in-person",
    virtualLink: editingEvent?.virtualLink || "",
    theme: editingEvent?.theme || "sunny",
    coverImage: editingEvent?.coverImage || editingEvent?.image || "",
    visibility:
      editingEvent?.visibility ||
      (editingEvent?.isActive === false ? "draft" : "public"),
    isPaid: Boolean(
      editingEvent?.isPaid ||
        (editingEvent?.price && editingEvent.price !== "Free"),
    ),
    price:
      editingEvent?.price && editingEvent.price !== "Free"
        ? String(editingEvent.price).replace(/[^0-9]/g, "") || "199"
        : "199",
    capacity: editingEvent?.totalTickets || editingEvent?.capacity || 150,
    ticketDesign: editingEvent?.ticketDesign || "stub",
    posterTextMode: editingEvent?.posterTextMode || "auto",
    posterLine1: editingEvent?.posterLine1 || "",
    posterLine2: editingEvent?.posterLine2 || "",
    posterFontSize: editingEvent?.posterFontSize || 34,
    posterAlign: editingEvent?.posterAlign || "left",
    posterTextColor: editingEvent?.posterTextColor || "auto",
    posterTextX: typeof editingEvent?.posterTextX === "number" ? editingEvent.posterTextX : 6,
    posterTextY: typeof editingEvent?.posterTextY === "number" ? editingEvent.posterTextY : (editingEvent?.coverImage ? 55 : 68),
    showPosterText: editingEvent?.showPosterText !== undefined ? editingEvent.showPosterText : true,
    posterTextBg: editingEvent?.posterTextBg || "shadow",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showVisibilityMenu, setShowVisibilityMenu] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationInput, setLocationInput] = useState(formData.location);
  const [locationSuggestions, setLocationSuggestions] = useState(POPULAR_LOCATIONS);

  // Draggable & inline-editable text overlay state
  const [isDraggingText, setIsDraggingText] = useState(false);
  const [isTextSelected, setIsTextSelected] = useState(false);
  const [isInlineEditing, setIsInlineEditing] = useState(false);
  const posterContainerRef = useRef(null);
  const descriptionTextareaRef = useRef(null);
  const dragStartPosRef = useRef({ mouseX: 0, mouseY: 0, textX: 0, textY: 0 });

  const handleTextDragStart = (e) => {
    if (isInlineEditing) return;
    if (e.target.tagName === "INPUT" || e.target.tagName === "BUTTON") return;

    e.preventDefault();
    e.stopPropagation();
    setIsTextSelected(true);
    setIsDraggingText(true);

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    dragStartPosRef.current = {
      mouseX: clientX,
      mouseY: clientY,
      textX: typeof formData.posterTextX === "number" ? formData.posterTextX : 6,
      textY: typeof formData.posterTextY === "number" ? formData.posterTextY : (formData.coverImage ? 55 : 68),
    };
  };

  useEffect(() => {
    if (!isDraggingText) return;

    const handleMouseMove = (e) => {
      if (!posterContainerRef.current) return;
      const rect = posterContainerRef.current.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;

      const deltaX = ((clientX - dragStartPosRef.current.mouseX) / rect.width) * 100;
      const deltaY = ((clientY - dragStartPosRef.current.mouseY) / rect.height) * 100;

      let newX = Math.round(dragStartPosRef.current.textX + deltaX);
      let newY = Math.round(dragStartPosRef.current.textY + deltaY);

      newX = Math.max(2, Math.min(80, newX));
      newY = Math.max(2, Math.min(84, newY));

      setFormData((prev) => ({
        ...prev,
        posterTextX: newX,
        posterTextY: newY,
      }));
    };

    const handleMouseUp = () => {
      setIsDraggingText(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("touchmove", handleMouseMove, { passive: false });
    window.addEventListener("touchend", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleMouseMove);
      window.removeEventListener("touchend", handleMouseUp);
    };
  }, [isDraggingText]);

  const selectedTheme =
    THEMES.find((t) => t.id === formData.theme) || THEMES[1]; // default Sunny

  // Word-aware poster headline lines
  const posterLines = getPosterLines(
    formData.name,
    formData.posterTextMode,
    formData.posterLine1,
    formData.posterLine2
  );

  // Safe description string guarantees NO [object Object]
  const safeDescription =
    typeof formData.description === "string"
      ? formData.description
      : (formData.description?.text || "");

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Please upload a valid JPEG, PNG, or WebP image");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be under 5 MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setFormData((prev) => ({ ...prev, coverImage: reader.result }));
      toast.success("Poster image updated");
    };
    reader.readAsDataURL(file);
  };

  const removeCoverImage = (e) => {
    e.stopPropagation();
    setFormData((prev) => ({ ...prev, coverImage: "" }));
    toast.info("Custom banner removed; using procedural poster");
  };

  const handleLocationSave = () => {
    setFormData((prev) => ({
      ...prev,
      location: locationInput.trim(),
    }));
    setShowLocationModal(false);
    toast.success("Event location set");
  };

  const handleFormSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Please enter an event name");
      return;
    }

    if (!formData.location.trim() && formData.locationType === "in-person") {
      toast.error("Please enter an event location");
      return;
    }

    setIsSubmitting(true);
    try {
      // Build ISO date timestamp
      let eventDateObj = new Date(formData.startDate);
      if (isNaN(eventDateObj.getTime())) {
        eventDateObj = new Date();
      }

      const payload = {
        name: formData.name.trim(),
        description: safeDescription.trim(),
        date: eventDateObj,
        startDate: formData.startDate,
        startTime: formData.startTime,
        endDate: formData.endDate || formData.startDate,
        endTime: formData.endTime,
        timezone: formData.timezone,
        timezoneCity: formData.timezoneCity,
        location:
          formData.locationType === "virtual"
            ? formData.virtualLink.trim() || formData.location.trim() || "Virtual / Online Event"
            : formData.location.trim(),
        locationType: formData.locationType,
        virtualLink: formData.virtualLink.trim(),
        totalTickets: parseInt(formData.capacity, 10) || 150,
        capacity: parseInt(formData.capacity, 10) || 150,
        theme: formData.theme,
        themeColor: selectedTheme.color || "#FE760B",
        themeName: selectedTheme.name || "Sunset",
        coverImage: formData.coverImage || "",
        visibility: formData.visibility,
        isPaid: Boolean(formData.isPaid),
        price: formData.isPaid ? `₹${formData.price || 199}` : "Free",
        ticketDesign: formData.ticketDesign || "stub",
        posterTextMode: formData.posterTextMode || "auto",
        posterLine1: formData.posterLine1 || "",
        posterLine2: formData.posterLine2 || "",
        posterFontSize: parseInt(formData.posterFontSize, 10) || 34,
        posterAlign: formData.posterAlign || "left",
        posterTextColor: formData.posterTextColor || "auto",
        posterTextX: typeof formData.posterTextX === "number" ? formData.posterTextX : 6,
        posterTextY: typeof formData.posterTextY === "number" ? formData.posterTextY : 68,
        showPosterText: formData.showPosterText !== false,
        posterTextBg: formData.posterTextBg || "shadow",
        isActive: formData.visibility !== "draft",
        published: formData.visibility === "public",
        status:
          formData.visibility === "draft"
            ? "draft"
            : formData.visibility === "public"
              ? "published"
              : "private",
      };

      let savedEvent;
      if (editingEvent?.id) {
        await updateEvent(editingEvent.id, payload);
        savedEvent = { id: editingEvent.id, ...payload };
        toast.success("Event updated successfully!");
      } else {
        savedEvent = await createEvent(payload, user?.id || null);
        toast.success("Event created successfully!");
      }

      if (typeof window !== "undefined" && savedEvent?.id) {
        try {
          localStorage.setItem("admin_selected_event_id", savedEvent.id);
        } catch {}
      }

      if (typeof onSuccess === "function") {
        onSuccess(savedEvent);
      } else if (typeof onClose === "function") {
        onClose(savedEvent);
      } else {
        router.push(`/admin/overview?eventId=${savedEvent?.id || ""}`);
      }
    } catch (err) {
      console.error("Failed to save event:", err);
      toast.error(err.message || "Failed to save event");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Organiser display details
  const organiserName = user?.displayName || user?.name || "Test Organiser";
  const organiserInitials = (organiserName || "TO")
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-[#131517] text-white flex flex-col selection:bg-[#FE760B] selection:text-[#131517]">
      {/* Top Navigation Bar matching Image 2 */}
      <header className="h-16 border-b border-[#2A2D31]/60 px-4 sm:px-8 flex items-center justify-between bg-[#131517]/90 backdrop-blur sticky top-0 z-40">
        <div className="flex items-center gap-6 sm:gap-8">
          {/* TicketLelo Logo mark */}
          <button
            type="button"
            onClick={() => {
              if (onClose) onClose();
              else router.push("/admin/dashboard");
            }}
            className="flex items-center gap-2 transition-opacity hover:opacity-90"
            title="TicketLelo Home"
          >
            <div className="h-7 w-20 relative flex items-center">
              <Image
                src="/logo/ticketlelo-logo-nav.png"
                alt="TicketLelo"
                width={80}
                height={28}
                className="object-contain"
                style={{ width: "auto", height: "auto" }}
                priority
              />
            </div>
          </button>

          {/* Navigation Links matching Image 2 */}
          <nav className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => {
                if (onClose) onClose();
                else router.push("/admin/dashboard");
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium text-[#9B9EA4] hover:text-white hover:bg-white/5 transition-colors"
            >
              <Calendar className="w-4 h-4 text-[#9B9EA4]" />
              <span>Events</span>
            </button>
            <button
              type="button"
              onClick={() => router.push("/activity")}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium text-[#9B9EA4] hover:text-white hover:bg-white/5 transition-colors"
            >
              <Radio className="w-4 h-4 text-[#9B9EA4]" />
              <span>Activity</span>
            </button>
            <button
              type="button"
              onClick={() => router.push("/account")}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium text-[#9B9EA4] hover:text-white hover:bg-white/5 transition-colors"
            >
              <Users className="w-4 h-4 text-[#9B9EA4]" />
              <span>Account</span>
            </button>
          </nav>
        </div>

        {/* Top Right: Clock, Create Event indicator, ThemeToggle, User Avatar */}
        <div className="flex items-center gap-3 sm:gap-5">
          <div className="hidden md:block text-xs font-medium text-[#9B9EA4] tracking-wide font-mono">
            {clockString}
          </div>

          <div className="text-xs sm:text-sm font-semibold text-white tracking-tight">
            {editingEvent ? "Edit Event" : "Create Event"}
          </div>

          <ThemeToggle inline />

          {/* User Organiser Initials Avatar [TO] */}
          <div
            className="w-8 h-8 rounded-full bg-[#FE760B] flex items-center justify-center text-[#131517] font-bold text-xs ring-2 ring-[#2A2D31] select-none shadow-sm cursor-pointer"
            title={organiserName}
          >
            {organiserInitials}
          </div>
        </div>
      </header>

      {/* Main Studio Body: 2 Columns matching Image 2 */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-8 sm:py-12">
        <form
          onSubmit={handleFormSubmit}
          className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start"
        >
          {/* ================= LEFT COLUMN: POSTER & THEME ================= */}
          <div className="lg:col-span-5 flex flex-col items-center lg:items-start space-y-5">
            {/* Poster Card (Square, 1:1, rounded-3xl) with Draggable & Editable Text Overlay */}
            <div
              ref={posterContainerRef}
              onClick={() => {
                setIsTextSelected(false);
                setIsInlineEditing(false);
              }}
              className="w-full max-w-[360px] aspect-square rounded-3xl overflow-hidden relative border border-[#2A2D31] shadow-2xl bg-[#1A1C1F] group select-none cursor-default"
            >
              {formData.coverImage ? (
                // Custom Uploaded Banner Image
                <div className="w-full h-full relative">
                  <img
                    src={formData.coverImage}
                    alt="Event Poster"
                    className="w-full h-full object-cover pointer-events-none select-none"
                    draggable={false}
                  />
                  {/* Remove image button */}
                  <button
                    type="button"
                    onClick={removeCoverImage}
                    className="absolute top-3 right-3 z-30 w-8 h-8 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center transition-all border border-white/20 shadow-md cursor-pointer"
                    title="Remove custom image"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                // Procedural Poster matching Image 2 (Tech Fest style with sunny yellow arc & grid)
                <div
                  className="w-full h-full relative flex flex-col justify-between p-6 overflow-hidden transition-colors duration-300"
                  style={{ backgroundColor: selectedTheme.bg }}
                >
                  {/* Sun quarter circle / arc in top-right corner */}
                  <div
                    className="absolute -top-12 -right-12 w-48 h-48 rounded-full pointer-events-none transition-colors duration-300"
                    style={{ backgroundColor: selectedTheme.sun }}
                  />

                  {/* Grid Lines Pattern matching Image 2 */}
                  <div
                    className="absolute inset-0 opacity-20 pointer-events-none"
                    style={{
                      backgroundImage:
                        "linear-gradient(#000 1.5px, transparent 1.5px), linear-gradient(90deg, #000 1.5px, transparent 1.5px)",
                      backgroundSize: "18px 18px",
                    }}
                  />
                </div>
              )}

              {/* ── DRAGGABLE & EDITABLE TEXT OVERLAY (Available on BOTH uploaded banner and procedural poster) ── */}
              {formData.showPosterText !== false && (
                <div
                  onMouseDown={handleTextDragStart}
                  onTouchStart={handleTextDragStart}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsTextSelected(true);
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setIsTextSelected(true);
                    setIsInlineEditing(true);
                  }}
                  className={`absolute z-20 max-w-[92%] transition-all ${
                    isDraggingText ? "cursor-grabbing select-none" : "cursor-grab"
                  } ${
                    isTextSelected
                      ? "ring-2 ring-[#FE760B] ring-offset-2 ring-offset-black/60 shadow-2xl rounded-xl"
                      : "hover:ring-1 hover:ring-white/40 rounded-xl"
                  } ${
                    formData.posterTextBg === "badge"
                      ? "bg-black/75 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/20 shadow-xl"
                      : formData.posterTextBg === "solid"
                      ? "bg-[#131517] px-3.5 py-2 rounded-xl border border-[#2A2D31] shadow-xl"
                      : "p-1.5"
                  }`}
                  style={{
                    left: `${formData.posterTextX ?? 6}%`,
                    top: `${formData.posterTextY ?? (formData.coverImage ? 55 : 68)}%`,
                    textAlign: formData.posterAlign || "left",
                    textShadow:
                      formData.posterTextBg === "shadow" || (!formData.posterTextBg && formData.coverImage)
                        ? "0 2px 10px rgba(0,0,0,0.9), 0 1px 3px rgba(0,0,0,0.85)"
                        : "none",
                  }}
                  title="Click to select, drag to reposition, double-click to edit"
                >
                  {/* Floating Action Badge when Selected */}
                  {isTextSelected && (
                    <div className="absolute -top-7 left-0 flex items-center gap-1.5 bg-[#FE760B] text-[#131517] px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase shadow-lg whitespace-nowrap z-30 pointer-events-auto">
                      <Move className="w-2.5 h-2.5 stroke-[3]" />
                      <span>Drag to move</span>
                      <span className="opacity-40">•</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsInlineEditing((prev) => !prev);
                        }}
                        className="underline hover:text-black font-black cursor-pointer"
                      >
                        {isInlineEditing ? "Done" : "Edit Text"}
                      </button>
                    </div>
                  )}

                  {/* Corner handles (Figma / Canva style) */}
                  {isTextSelected && (
                    <>
                      <div className="absolute -top-1 -left-1 w-2.5 h-2.5 bg-white border border-[#FE760B] rounded-full shadow pointer-events-none" />
                      <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-white border border-[#FE760B] rounded-full shadow pointer-events-none" />
                      <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 bg-white border border-[#FE760B] rounded-full shadow pointer-events-none" />
                      <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-white border border-[#FE760B] rounded-full shadow pointer-events-none" />
                    </>
                  )}

                  {/* Text Content: Inline editing or Display */}
                  {isInlineEditing ? (
                    <div className="space-y-1.5 min-w-[200px]" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        autoFocus
                        value={formData.posterLine1 || posterLines.line1}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            posterTextMode: "custom",
                            posterLine1: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === "Escape") {
                            setIsInlineEditing(false);
                          }
                        }}
                        className="bg-black/90 border border-[#FE760B] rounded px-2 py-0.5 font-black uppercase text-white outline-none w-full tracking-tight shadow-lg"
                        style={{
                          fontSize: `${formData.posterFontSize || 34}px`,
                        }}
                      />
                      <input
                        type="text"
                        value={formData.posterLine2 || posterLines.line2}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            posterTextMode: "custom",
                            posterLine2: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === "Escape") {
                            setIsInlineEditing(false);
                          }
                        }}
                        className="bg-black/90 border border-[#FE760B] rounded px-2 py-0.5 font-black uppercase text-white outline-none w-full tracking-tight shadow-lg"
                        style={{
                          fontSize: `${Math.max(
                            18,
                            Math.round((formData.posterFontSize || 34) * 0.88),
                          )}px`,
                        }}
                      />
                      <div className="flex justify-end pt-0.5">
                        <button
                          type="button"
                          onClick={() => setIsInlineEditing(false)}
                          className="text-[10px] bg-[#FE760B] text-[#131517] font-bold px-2 py-0.5 rounded cursor-pointer hover:bg-[#ff8624]"
                        >
                          Save Text
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <span
                        className="block font-black leading-[0.92] tracking-tight uppercase select-none break-words"
                        style={{
                          color:
                            formData.posterTextColor === "dark"
                              ? "#131517"
                              : formData.posterTextColor === "light"
                              ? "#FFFFFF"
                              : formData.coverImage
                              ? "#FFFFFF"
                              : selectedTheme.text,
                          fontSize: `${formData.posterFontSize || 34}px`,
                        }}
                      >
                        {posterLines.line1}
                      </span>
                      {posterLines.line2 && (
                        <span
                          className="block font-black leading-[0.92] tracking-tight uppercase select-none mt-1 break-words"
                          style={{
                            color:
                              formData.posterTextColor === "dark"
                                ? "#131517"
                                : formData.posterTextColor === "light"
                                ? "#FFFFFF"
                                : formData.coverImage
                                ? "#FFFFFF"
                                : selectedTheme.text,
                            fontSize: `${Math.max(
                              18,
                              Math.round((formData.posterFontSize || 34) * 0.88),
                            )}px`,
                          }}
                        >
                          {posterLines.line2}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Camera Upload Button in Bottom-Right Corner matching Image 2 */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-3 right-3 z-20 w-10 h-10 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center backdrop-blur border border-white/25 transition-transform hover:scale-105 active:scale-95 shadow-xl cursor-pointer"
                title="Upload custom banner image (up to 5 MB)"
              >
                <Camera className="w-5 h-5 text-white" />
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleImageUpload}
              />
            </div>

            {/* Theme Selector matching Image 2 */}
            <div className="w-full max-w-[360px] pt-1">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs text-[#9B9EA4] font-medium tracking-wide">
                  Theme
                </span>
                <span className="text-xs font-semibold text-[#D0D0D1]">
                  {selectedTheme.name}
                </span>
              </div>

              {/* 5 Theme Color Swatches */}
              <div className="flex items-center gap-3">
                {THEMES.map((theme) => {
                  const isSelected = formData.theme === theme.id;
                  return (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({ ...prev, theme: theme.id }))
                      }
                      className={`w-7 h-7 rounded-full transition-all duration-200 cursor-pointer ${
                        isSelected
                          ? "ring-2 ring-white ring-offset-2 ring-offset-[#131517] scale-110 shadow-md"
                          : "opacity-80 hover:opacity-100 hover:scale-105"
                      }`}
                      style={{ backgroundColor: theme.color }}
                      title={theme.name}
                    />
                  );
                })}
              </div>

              {/* Helper text matching Image 2 */}
              <p className="text-[11px] text-[#71767B] leading-relaxed mt-4">
                Banner: JPEG, PNG or WebP up to 5 MB • 1200 × 400 recommended
              </p>

              {/* Poster Typography & Text Adjustment Panel */}
              <div className="w-full mt-4 pt-3.5 space-y-3 bg-[#1A1C1F] p-4 rounded-2xl border border-[#2A2D31] shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white font-bold flex items-center gap-1.5">
                    <Type className="w-3.5 h-3.5 text-[#FE760B]" />
                    Poster Typography &amp; Layout
                  </span>
                  <div className="flex items-center gap-1.5">
                    {/* Toggle text visibility on banner */}
                    <button
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          showPosterText: prev.showPosterText === false ? true : false,
                        }))
                      }
                      className={`p-1 rounded border transition-colors ${
                        formData.showPosterText !== false
                          ? "bg-[#FE760B]/15 border-[#FE760B] text-[#FE760B]"
                          : "border-[#2A2D31] text-[#9B9EA4] hover:text-white"
                      }`}
                      title={formData.showPosterText !== false ? "Hide text overlay" : "Show text overlay"}
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>

                    <div className="flex items-center rounded-lg bg-[#212327] p-0.5 border border-[#2A2D31]">
                      <button
                        type="button"
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            posterTextMode: "auto",
                          }))
                        }
                        className={`px-2 py-0.5 text-[10px] font-semibold rounded-md transition-colors ${
                          formData.posterTextMode === "auto"
                            ? "bg-[#FE760B] text-[#131517]"
                            : "text-[#9B9EA4] hover:text-white"
                        }`}
                      >
                        Auto Title
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            posterTextMode: "custom",
                            posterLine1: prev.posterLine1 || posterLines.line1,
                            posterLine2: prev.posterLine2 || posterLines.line2,
                          }))
                        }
                        className={`px-2 py-0.5 text-[10px] font-semibold rounded-md transition-colors ${
                          formData.posterTextMode === "custom"
                            ? "bg-[#FE760B] text-[#131517]"
                            : "text-[#9B9EA4] hover:text-white"
                        }`}
                      >
                        Custom Lines
                      </button>
                    </div>
                  </div>
                </div>

                {/* Drag Position Indicator & Quick Presets */}
                <div className="flex items-center justify-between text-[11px] bg-[#212327] px-2.5 py-1.5 rounded-xl border border-[#2A2D31]">
                  <div className="flex items-center gap-1.5 text-[#9B9EA4]">
                    <Move className="w-3.5 h-3.5 text-[#FE760B]" />
                    <span className="text-[10px] font-medium text-white">Drag text or snap:</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          posterTextX: 6,
                          posterTextY: 8,
                        }))
                      }
                      className="px-2 py-0.5 text-[10px] rounded font-semibold bg-[#1A1C1F] hover:bg-[#2A2D31] text-white border border-[#2A2D31] transition-colors"
                    >
                      Top
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          posterTextX: 6,
                          posterTextY: 42,
                        }))
                      }
                      className="px-2 py-0.5 text-[10px] rounded font-semibold bg-[#1A1C1F] hover:bg-[#2A2D31] text-white border border-[#2A2D31] transition-colors"
                    >
                      Center
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          posterTextX: 6,
                          posterTextY: 68,
                        }))
                      }
                      className="px-2 py-0.5 text-[10px] rounded font-semibold bg-[#1A1C1F] hover:bg-[#2A2D31] text-white border border-[#2A2D31] transition-colors"
                    >
                      Bottom
                    </button>
                    <button
                      type="button"
                      title="Reset text position"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          posterTextX: 6,
                          posterTextY: prev.coverImage ? 55 : 68,
                        }))
                      }
                      className="p-1 rounded text-[#9B9EA4] hover:text-white hover:bg-[#1A1C1F] transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* If Custom Lines mode, provide custom input fields */}
                {formData.posterTextMode === "custom" && (
                  <div className="grid grid-cols-2 gap-2 pt-0.5">
                    <div>
                      <label className="text-[10px] text-[#9B9EA4] font-medium block mb-1">
                        Line 1 (Top)
                      </label>
                      <input
                        type="text"
                        value={formData.posterLine1}
                        placeholder="e.g. DEVELOPER'S"
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            posterLine1: e.target.value,
                          }))
                        }
                        className="w-full bg-[#212327] border border-[#2A2D31] rounded-lg px-2.5 py-1 text-xs text-white uppercase focus:border-[#FE760B] outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-[#9B9EA4] font-medium block mb-1">
                        Line 2 (Bottom)
                      </label>
                      <input
                        type="text"
                        value={formData.posterLine2}
                        placeholder="e.g. NIGHT 2026"
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            posterLine2: e.target.value,
                          }))
                        }
                        className="w-full bg-[#212327] border border-[#2A2D31] rounded-lg px-2.5 py-1 text-xs text-white uppercase focus:border-[#FE760B] outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* Font Size Slider & Quick Presets */}
                <div className="space-y-1.5 pt-0.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#9B9EA4] flex items-center gap-1 font-medium">
                      <Sliders className="w-3 h-3 text-[#9B9EA4]" />
                      Font Size
                    </span>
                    <span className="font-mono text-white text-xs font-bold">
                      {formData.posterFontSize || 34}px
                    </span>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="48"
                    step="2"
                    value={formData.posterFontSize || 34}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        posterFontSize: parseInt(e.target.value, 10),
                      }))
                    }
                    className="w-full accent-[#FE760B] cursor-pointer"
                  />
                  <div className="flex items-center gap-1 pt-1 justify-between">
                    {[
                      { label: "S (26px)", val: 26 },
                      { label: "M (32px)", val: 32 },
                      { label: "L (36px)", val: 36 },
                      { label: "XL (42px)", val: 42 },
                    ].map((preset) => (
                      <button
                        key={preset.val}
                        type="button"
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            posterFontSize: preset.val,
                          }))
                        }
                        className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                          formData.posterFontSize === preset.val
                            ? "bg-white/10 border-[#FE760B] text-[#FE760B] font-bold"
                            : "border-[#2A2D31] text-[#9B9EA4] hover:text-white"
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Alignment, Text Color & Readability Backdrop */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1">
                      <span className="text-[#9B9EA4] mr-1">Align:</span>
                      {[
                        { id: "left", icon: AlignLeft },
                        { id: "center", icon: AlignCenter },
                        { id: "right", icon: AlignRight },
                      ].map((item) => {
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() =>
                              setFormData((prev) => ({
                                ...prev,
                                posterAlign: item.id,
                              }))
                            }
                            className={`p-1 rounded border transition-colors ${
                              formData.posterAlign === item.id
                                ? "bg-[#FE760B]/15 border-[#FE760B] text-[#FE760B]"
                                : "border-[#2A2D31] text-[#9B9EA4] hover:text-white"
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="text-[#9B9EA4] mr-1">Color:</span>
                      {[
                        { id: "auto", label: "Theme" },
                        { id: "dark", label: "Dark" },
                        { id: "light", label: "Light" },
                      ].map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              posterTextColor: c.id,
                            }))
                          }
                          className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                            (formData.posterTextColor || "auto") === c.id
                              ? "bg-[#FE760B] text-black font-bold border-[#FE760B]"
                              : "border-[#2A2D31] text-[#9B9EA4] hover:text-white"
                          }`}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Backdrop / Readability Badge Style */}
                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-[#2A2D31]/50">
                    <span className="text-[#9B9EA4]">Backdrop:</span>
                    <div className="flex items-center gap-1">
                      {[
                        { id: "shadow", label: "Shadow" },
                        { id: "badge", label: "Glass Pill" },
                        { id: "solid", label: "Solid" },
                        { id: "none", label: "None" },
                      ].map((bg) => (
                        <button
                          key={bg.id}
                          type="button"
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              posterTextBg: bg.id,
                            }))
                          }
                          className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                            (formData.posterTextBg || "shadow") === bg.id
                              ? "bg-white/10 border-[#FE760B] text-[#FE760B] font-bold"
                              : "border-[#2A2D31] text-[#9B9EA4] hover:text-white"
                          }`}
                        >
                          {bg.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ================= RIGHT COLUMN: EVENT DETAILS ================= */}
          <div className="lg:col-span-7 flex flex-col space-y-4">
            {/* Header Row: Organiser Pill & Visibility Dropdown matching Image 2 */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Organiser Pill [TO] Test Organiser */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#1A1C1F] border border-[#2A2D31] text-xs font-medium text-white shadow-sm">
                <span className="w-5 h-5 rounded-full bg-[#FE760B] text-[#131517] font-bold text-[10px] flex items-center justify-center">
                  {organiserInitials}
                </span>
                <span className="truncate max-w-[160px]">{organiserName}</span>
              </div>

              {/* Visibility Dropdown Pill matching Image 2 */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowVisibilityMenu(!showVisibilityMenu)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#1A1C1F] border border-[#2A2D31] text-xs font-medium text-white hover:border-[#3A3D42] transition-colors shadow-sm"
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      formData.visibility === "public"
                        ? "bg-[#3DD68C]"
                        : formData.visibility === "draft"
                          ? "bg-[#9B9EA4]"
                          : "bg-[#FE760B]"
                    }`}
                  />
                  <span className="capitalize">{formData.visibility}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-[#9B9EA4]" />
                </button>

                {showVisibilityMenu && (
                  <div className="absolute left-0 top-full mt-1.5 z-30 w-44 rounded-xl bg-[#1A1C1F] border border-[#2A2D31] shadow-xl overflow-hidden py-1">
                    {[
                      { id: "public", label: "Public", dot: "bg-[#3DD68C]" },
                      { id: "draft", label: "Draft / Unlisted", dot: "bg-[#9B9EA4]" },
                      { id: "private", label: "Private", dot: "bg-[#FE760B]" },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setFormData((prev) => ({
                            ...prev,
                            visibility: opt.id,
                          }));
                          setShowVisibilityMenu(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-white/5 transition-colors text-white"
                      >
                        <span className={`w-2 h-2 rounded-full ${opt.dot}`} />
                        <span>{opt.label}</span>
                        {formData.visibility === opt.id && (
                          <Check className="w-3.5 h-3.5 text-[#FE760B] ml-auto" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Event Name Input (Large Display typography matching Image 2) */}
            <div className="pt-2">
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Event Name"
                required
                className="tl-bare-input w-full !bg-transparent text-3xl sm:text-4xl font-extrabold text-white placeholder:text-[#9B9EA4] !border-none !outline-none !shadow-none focus:outline-none focus:ring-0 p-0 tracking-tight"
              />
            </div>

            {/* Date & Time Card matching Image 2 */}
            <div className="rounded-2xl bg-[#1A1C1F] border border-[#2A2D31] p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 shadow-sm">
              {/* Left Side: Start and End rows */}
              <div className="flex-1 space-y-3">
                {/* Start row: ● Start 07 / 11 / 2026 | 12:00 pm */}
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2 w-16 shrink-0">
                    <span className="w-2 h-2 rounded-full bg-[#3DD68C]" />
                    <span className="text-xs font-semibold text-[#9B9EA4]">
                      Start
                    </span>
                  </div>

                  {/* Date Input */}
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#212327] border border-[#2A2D31] text-xs font-mono text-white">
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          startDate: e.target.value,
                          endDate: prev.endDate < e.target.value ? e.target.value : prev.endDate,
                        }))
                      }
                      className="bg-transparent text-white border-none outline-none focus:ring-0 text-xs p-0 dark:[color-scheme:dark]"
                    />
                    <Calendar className="w-3.5 h-3.5 text-[#9B9EA4] pointer-events-none" />
                  </div>

                  {/* Time Input */}
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#212327] border border-[#2A2D31] text-xs font-mono text-white">
                    <input
                      type="text"
                      value={formData.startTime}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          startTime: e.target.value,
                        }))
                      }
                      placeholder="12:00 pm"
                      className="bg-transparent text-white border-none outline-none focus:ring-0 text-xs p-0 w-16"
                    />
                  </div>
                </div>

                {/* End row: ○ End 07 / 11 / 2026 | 05:00 pm */}
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2 w-16 shrink-0">
                    <span className="w-2 h-2 rounded-full border border-[#9B9EA4]" />
                    <span className="text-xs font-semibold text-[#9B9EA4]">
                      End
                    </span>
                  </div>

                  {/* End Date Input */}
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#212327] border border-[#2A2D31] text-xs font-mono text-white">
                    <input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          endDate: e.target.value,
                        }))
                      }
                      className="bg-transparent text-white border-none outline-none focus:ring-0 text-xs p-0 dark:[color-scheme:dark]"
                    />
                    <Calendar className="w-3.5 h-3.5 text-[#9B9EA4] pointer-events-none" />
                  </div>

                  {/* End Time Input */}
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#212327] border border-[#2A2D31] text-xs font-mono text-white">
                    <input
                      type="text"
                      value={formData.endTime}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          endTime: e.target.value,
                        }))
                      }
                      placeholder="05:00 pm"
                      className="bg-transparent text-white border-none outline-none focus:ring-0 text-xs p-0 w-16"
                    />
                  </div>
                </div>
              </div>

              {/* Right Side Timezone Divider matching Image 2 */}
              <div className="sm:border-l sm:border-[#2A2D31] sm:pl-5 flex flex-col justify-center items-start gap-0.5 shrink-0">
                <Globe className="w-4 h-4 text-[#9B9EA4] mb-1" />
                <div className="text-xs sm:text-sm font-bold text-white font-mono">
                  {formData.timezone}
                </div>
                <div className="text-[11px] text-[#9B9EA4]">
                  {formData.timezoneCity}
                </div>
              </div>
            </div>

            {/* Location Card matching Image 2 */}
            <div
              onClick={() => {
                setLocationInput(formData.location);
                setShowLocationModal(true);
              }}
              className="rounded-2xl bg-[#1A1C1F] border border-[#2A2D31] p-4 flex items-start gap-3.5 hover:border-[#3A3D42] transition-colors cursor-pointer shadow-sm group"
            >
              <MapPin className="w-5 h-5 text-[#9B9EA4] group-hover:text-white shrink-0 mt-0.5 transition-colors" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white">
                  {formData.location.trim() ? (
                    <span className="text-white">{formData.location}</span>
                  ) : (
                    <span>Add Event Location *</span>
                  )}
                </div>
                <div className="text-xs text-[#9B9EA4] mt-0.5 truncate">
                  {formData.locationType === "virtual"
                    ? formData.virtualLink || "Online meeting / virtual link"
                    : "Offline location or virtual link"}
                </div>
              </div>
            </div>

            {/* Description Card matching Image 2 (Seamless bare input with card focus ring) */}
            <div
              onClick={() => descriptionTextareaRef.current?.focus()}
              className="rounded-2xl bg-[#1A1C1F] border border-[#2A2D31] p-4 flex items-start gap-3.5 hover:border-[#3A3D42] focus-within:border-[#FE760B] focus-within:ring-1 focus-within:ring-[#FE760B]/30 transition-all shadow-sm group cursor-text"
            >
              <AlignLeft className="w-5 h-5 text-[#9B9EA4] group-focus-within:text-[#FE760B] shrink-0 mt-1 transition-colors" />
              <div className="flex-1 min-w-0">
                <textarea
                  ref={descriptionTextareaRef}
                  value={safeDescription}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Describe your event..."
                  rows={3}
                  className="tl-bare-input w-full !bg-transparent text-sm text-white placeholder:text-[#9B9EA4] !border-none !outline-none !shadow-none focus:outline-none focus:ring-0 p-0 resize-none leading-relaxed"
                />
              </div>
            </div>

            {/* Event Options Section matching Image 2 */}
            <div className="pt-2">
              <div className="text-xs text-[#9B9EA4] font-medium tracking-wide mb-2">
                Event options
              </div>

              <div className="rounded-2xl bg-[#1A1C1F] border border-[#2A2D31] divide-y divide-[#2A2D31] overflow-hidden shadow-sm">
                {/* Row 1: Paid tickets toggle */}
                <div className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Ticket className="w-4 h-4 text-[#9B9EA4]" />
                    <span className="text-sm font-medium text-white">
                      Paid tickets
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-[#9B9EA4]">
                      {formData.isPaid ? `₹${formData.price}` : "Free"}
                    </span>

                    {/* Toggle button matching Image 2 */}
                    <button
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          isPaid: !prev.isPaid,
                        }))
                      }
                      className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
                        formData.isPaid ? "bg-[#FE760B]" : "bg-[#2A2D31]"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                          formData.isPaid ? "translate-x-5" : ""
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* If Paid is true, show price input */}
                {formData.isPaid && (
                  <div className="px-4 py-3 bg-[#212327] flex items-center justify-between gap-4">
                    <span className="text-xs text-[#9B9EA4]">
                      Ticket Price (INR)
                    </span>
                    <div className="flex items-center gap-1.5 bg-[#1A1C1F] px-3 py-1 rounded-xl border border-[#2A2D31]">
                      <span className="text-xs font-bold text-[#FE760B]">₹</span>
                      <input
                        type="number"
                        min="1"
                        value={formData.price}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            price: e.target.value,
                          }))
                        }
                        className="bg-transparent text-xs font-bold text-white w-16 border-none outline-none focus:ring-0 p-0"
                      />
                    </div>
                  </div>
                )}

                {/* Row 2: Capacity * input stepper */}
                <div className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Users className="w-4 h-4 text-[#9B9EA4]" />
                    <span className="text-sm font-medium text-white">
                      Capacity *
                    </span>
                  </div>

                  <div className="flex items-center gap-1 bg-[#212327] px-3 py-1.5 rounded-xl border border-[#2A2D31]">
                    <input
                      type="number"
                      min="1"
                      required
                      value={formData.capacity}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          capacity: e.target.value,
                        }))
                      }
                      className="bg-transparent text-sm font-bold text-white w-16 text-right border-none outline-none focus:ring-0 p-0 font-mono"
                    />
                  </div>
                </div>

                {/* Row 3: Ticket Format & Style (Stub tickets vs Wide tickets) */}
                <div className="p-4 sm:p-5 border-t border-[#2A2D31]/80 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-[#FE760B]/10 border border-[#FE760B]/20 flex items-center justify-center text-[#FE760B]">
                        <Ticket className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-sm font-bold text-white block">
                          Ticket Layout &amp; Template
                        </span>
                        <span className="text-[11px] text-[#9B9EA4] block">
                          Choose between standard stub ticket or 3-panel wide ticket. Editable anytime.
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                    {/* Option 1: Stub tickets */}
                    <button
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({ ...prev, ticketDesign: "stub" }))
                      }
                      className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden group flex flex-col justify-between ${
                        formData.ticketDesign === "stub"
                          ? "border-[#FE760B] bg-[#FE760B]/10 ring-1 ring-[#FE760B] shadow-[0_0_20px_rgba(254,118,11,0.12)]"
                          : "border-[#2A2D31] bg-[#212327]/60 hover:bg-[#212327] hover:border-[#3A3D42]"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5 w-full">
                        <span className="text-xs font-bold text-white flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-[#FE760B]" />
                          Stub tickets (Default)
                        </span>
                        {formData.ticketDesign === "stub" ? (
                          <span className="w-5 h-5 rounded-full bg-[#FE760B] flex items-center justify-center text-[#131517] shrink-0">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </span>
                        ) : (
                          <span className="w-5 h-5 rounded-full border border-[#3A3D42] bg-[#141619]/60 shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-[#9B9EA4] leading-relaxed">
                        780 × 240 art panel + dark QR check-in stub.
                      </p>
                    </button>

                    {/* Option 2: Wide tickets */}
                    <button
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({ ...prev, ticketDesign: "wide" }))
                      }
                      className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden group flex flex-col justify-between ${
                        formData.ticketDesign === "wide"
                          ? "border-[#FE760B] bg-[#FE760B]/10 ring-1 ring-[#FE760B] shadow-[0_0_20px_rgba(254,118,11,0.12)]"
                          : "border-[#2A2D31] bg-[#212327]/60 hover:bg-[#212327] hover:border-[#3A3D42]"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5 w-full">
                        <span className="text-xs font-bold text-white flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-[#3DD68C]" />
                          Wide tickets
                        </span>
                        {formData.ticketDesign === "wide" ? (
                          <span className="w-5 h-5 rounded-full bg-[#FE760B] flex items-center justify-center text-[#131517] shrink-0">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </span>
                        ) : (
                          <span className="w-5 h-5 rounded-full border border-[#3A3D42] bg-[#141619]/60 shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-[#9B9EA4] leading-relaxed">
                        720 × 200 3-panel: QR + art + vertical barcode stub.
                      </p>
                    </button>
                  </div>

                  {/* ── Interactive Live Ticket Preview Area ── */}
                  <div className="mt-5 rounded-2xl bg-[#141619] border border-[#2A2D31] p-4 sm:p-5 space-y-4 shadow-xl relative">
                    <div className="flex items-center justify-between flex-wrap gap-2.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#3DD68C] animate-pulse" />
                        <span className="text-xs font-bold text-white tracking-wide uppercase">
                          Live Attendee Ticket Preview
                        </span>
                        <span className="text-[10px] text-[#9B9EA4] font-medium hidden sm:inline">
                          (Renders with live form data)
                        </span>
                      </div>

                      {/* Preview format switcher tabs */}
                      <div className="flex items-center rounded-xl bg-[#212327] p-1 border border-[#2A2D31]">
                        <button
                          type="button"
                          onClick={() =>
                            setFormData((prev) => ({ ...prev, ticketDesign: "stub" }))
                          }
                          className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                            formData.ticketDesign === "stub"
                              ? "bg-[#FE760B] text-[#131517] shadow-sm font-bold"
                              : "text-[#9B9EA4] hover:text-white"
                          }`}
                        >
                          Stub Preview (780×240)
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setFormData((prev) => ({ ...prev, ticketDesign: "wide" }))
                          }
                          className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                            formData.ticketDesign === "wide"
                              ? "bg-[#FE760B] text-[#131517] shadow-sm font-bold"
                              : "text-[#9B9EA4] hover:text-white"
                          }`}
                        >
                          Wide Preview (720×200)
                        </button>
                      </div>
                    </div>

                    {/* Ticket Render Container */}
                    <div className="pt-2 pb-1 overflow-x-auto flex justify-center no-scrollbar">
                      <div className="w-full max-w-[780px] min-w-[320px]">
                        {formData.ticketDesign === "wide" ? (
                          <WideTicket
                            event={{
                              name: formData.name || "Developer's Night 2026",
                              title: formData.name || "Developer's Night 2026",
                              date: formData.startDate || "2026-11-07",
                              time: formData.startTime || "12:00 PM",
                              location: formData.location || "Main Auditorium, Campus",
                              theme: formData.theme,
                              themeColor: selectedTheme.color,
                              price: formData.isPaid ? formData.price : "Free",
                              ticketDesign: "wide",
                            }}
                            registration={{
                              ticketId: "TKT-1793-DEMO-WIDE",
                              attendeeName: "Rahul Sharma (Attendee)",
                              status: "Unused",
                              ticketTier: formData.isPaid ? "VIP PASS" : "GENERAL PASS",
                            }}
                            interactive={true}
                            showActions={false}
                          />
                        ) : (
                          <StubTicket
                            event={{
                              name: formData.name || "Developer's Night 2026",
                              title: formData.name || "Developer's Night 2026",
                              date: formData.startDate || "2026-11-07",
                              time: formData.startTime || "12:00 PM",
                              location: formData.location || "Main Auditorium, Campus",
                              theme: formData.theme,
                              themeColor: selectedTheme.color,
                              price: formData.isPaid ? formData.price : "Free",
                              ticketDesign: "stub",
                            }}
                            registration={{
                              ticketId: "TKT-1793-DEMO-STUB",
                              attendeeName: "Rahul Sharma (Attendee)",
                              status: "Unused",
                              ticketTier: formData.isPaid ? "VIP PASS" : "GENERAL PASS",
                            }}
                            interactive={true}
                            showActions={false}
                          />
                        )}
                      </div>
                    </div>

                    {/* Format Explanation Footer */}
                    <div className="text-[11px] text-[#9B9EA4] pt-3 flex flex-col sm:flex-row sm:items-center justify-between border-t border-[#2A2D31]/80 gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-[#212327] border border-[#2A2D31] text-[#FE760B]">
                          {formData.ticketDesign === "wide" ? "3-Panel Wide Format" : "Classic Stub Format"}
                        </span>
                        <span className="text-white/90 font-medium">
                          {formData.ticketDesign === "wide"
                            ? "Left QR code scanner + Center full event artwork + Right Code-128 barcode stub."
                            : "Wide festival cover artwork with tear-off QR verification check-in stub."}
                        </span>
                      </div>
                      <span className="text-[#FE760B] font-mono text-[10px] flex items-center gap-1 shrink-0">
                        <Sparkles size={11} className="text-[#FE760B]" />
                        <span>Click ticket perforation to test tear animation</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Submit Action Button (White rounded pill matching Image 2) */}
            <div className="pt-4 space-y-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-white hover:bg-neutral-100 active:bg-neutral-200 text-[#131517] font-bold text-sm sm:text-base py-3.5 px-6 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin text-[#131517]" />
                    <span>Saving event...</span>
                  </>
                ) : (
                  <span>
                    {editingEvent ? "Update Event" : "Create Event"}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (onClose) onClose();
                  else router.push("/admin/dashboard");
                }}
                className="w-full text-center text-xs text-[#9B9EA4] hover:text-white transition-colors cursor-pointer py-1"
              >
                Cancel and return to events
              </button>
            </div>
          </div>
        </form>
      </main>

      {/* Location Modal */}
      {showLocationModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-6 max-w-lg w-full space-y-5 shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <MapPin className="w-5 h-5 text-[#FE760B]" />
                <h3 className="text-base font-bold text-white">Event Location</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowLocationModal(false)}
                className="text-[#9B9EA4] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Toggle Mode: In Person vs Virtual */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    locationType: "in-person",
                  }))
                }
                className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border transition-all ${
                  formData.locationType === "in-person"
                    ? "bg-[#FE760B] text-[#131517] border-[#FE760B]"
                    : "bg-[#212327] text-[#9B9EA4] border-[#2A2D31]"
                }`}
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>In Person</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    locationType: "virtual",
                  }))
                }
                className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border transition-all ${
                  formData.locationType === "virtual"
                    ? "bg-[#2B59FF] text-white border-[#2B59FF]"
                    : "bg-[#212327] text-[#9B9EA4] border-[#2A2D31]"
                }`}
              >
                <Video className="w-3.5 h-3.5" />
                <span>Virtual / Online</span>
              </button>
            </div>

            {formData.locationType === "in-person" ? (
              <div className="space-y-3">
                <label className="text-xs text-[#9B9EA4] font-medium">
                  Venue Name or Address
                </label>
                <input
                  type="text"
                  value={locationInput}
                  onChange={(e) => setLocationInput(e.target.value)}
                  placeholder="e.g. KIET Group of Institutions, Main Auditorium"
                  className="w-full h-11 px-3.5 rounded-xl bg-[#212327] border border-[#2A2D31] text-sm text-white placeholder:text-[#9B9EA4] outline-none focus:border-[#FE760B]"
                />

                <div className="space-y-1.5 pt-2">
                  <div className="text-[11px] font-semibold text-[#9B9EA4] uppercase tracking-wider">
                    Quick suggestions
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1.5 divide-y divide-[#2A2D31]/40">
                    {locationSuggestions.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setLocationInput(`${item.name}, ${item.address}`);
                        }}
                        className="w-full text-left p-2 rounded-lg hover:bg-white/5 transition-colors"
                      >
                        <div className="text-xs font-bold text-white">
                          {item.name}
                        </div>
                        <div className="text-[11px] text-[#9B9EA4] truncate">
                          {item.address}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-xs text-[#9B9EA4] font-medium">
                  Virtual Meeting / Stream Link
                </label>
                <input
                  type="url"
                  value={formData.virtualLink}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData((prev) => ({
                      ...prev,
                      virtualLink: val,
                    }));
                    setLocationInput(val || "Virtual Event");
                  }}
                  placeholder="https://zoom.us/j/... or Google Meet / YouTube Live"
                  className="w-full h-11 px-3.5 rounded-xl bg-[#212327] border border-[#2A2D31] text-sm text-white placeholder:text-[#9B9EA4] outline-none focus:border-[#2B59FF]"
                />
              </div>
            )}

            <div className="flex gap-3 pt-3">
              <button
                type="button"
                onClick={handleLocationSave}
                className="flex-1 h-10 rounded-xl bg-[#FE760B] text-[#131517] font-semibold text-xs hover:bg-[#FE760B]/90 transition-colors"
              >
                Save Location
              </button>
              <button
                type="button"
                onClick={() => setShowLocationModal(false)}
                className="px-4 h-10 rounded-xl bg-[#212327] border border-[#2A2D31] text-[#9B9EA4] hover:text-white text-xs transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
