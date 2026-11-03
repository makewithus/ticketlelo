"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Save,
  Plus,
  Trash2,
  Edit2,
  Check,
  ChevronDown,
  HelpCircle,
  X,
  FileText,
  User,
  Mail,
  Phone,
  Layers,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Upload,
} from "lucide-react";
import {
  getEventsByOrganiser,
  getEvent,
  updateEvent,
  getAllEvents,
} from "@/lib/firestore";
import {
  getCustomFormByEvent,
  createCustomForm,
  updateCustomForm,
} from "@/lib/form-generator";
import { useAuth } from "@/context/auth-context";
import { BrandLoader } from "@/components/ui/brand-loader";

// Default registration questions for college/tech fest events
const DEFAULT_CUSTOM_QUESTIONS = [
  {
    id: "q_college_name",
    label: "College / University Name",
    type: "text",
    required: true,
    placeholder: "e.g. CUSAT, Kochi",
    options: [],
  },
  {
    id: "q_department",
    label: "Department / Branch",
    type: "select",
    required: false,
    placeholder: "Select your department",
    options: [
      "Computer Science & Engineering",
      "Information Technology",
      "Electronics & Communication",
      "Mechanical Engineering",
      "Electrical Engineering",
      "Civil Engineering",
      "Other",
    ],
  },
  {
    id: "q_year_of_study",
    label: "Year of Study",
    type: "select",
    required: true,
    placeholder: "Select year",
    options: ["1st Year", "2nd Year", "3rd Year", "4th Year", "Postgraduate"],
  },
  {
    id: "q_team_name",
    label: "Team Name (if participating in team event)",
    type: "text",
    required: false,
    placeholder: "e.g. CodeNinjas",
    options: [],
  },
];

export function RegistrationStudio({ eventId: propEventId = null }) {
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(propEventId || "");
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Registration Status & Group Registration
  const [registrationStatus, setRegistrationStatus] = useState("Open");
  const [groupRegistration, setGroupRegistration] = useState(false);

  // Personal Information Configuration
  const [personalInfo, setPersonalInfo] = useState({
    nameMode: "Full Name", // "Full Name" | "First and Last Name"
    emailRequired: true,
    phoneMode: "Required", // "Off" | "Optional" | "Required"
  });

  // Custom Questions List
  const [customQuestions, setCustomQuestions] = useState(DEFAULT_CUSTOM_QUESTIONS);

  // Modal: Add / Edit Question
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [editingQuestionIndex, setEditingQuestionIndex] = useState(null);
  const [questionForm, setQuestionForm] = useState({
    label: "",
    type: "text",
    required: true,
    placeholder: "",
    optionsStr: "",
  });

  // 1. Load Organiser Events
  useEffect(() => {
    let isMounted = true;
    async function initEvents() {
      if (!user) return;
      try {
        setLoading(true);
        let list = [];
        if (user.role === "superAdmin") {
          list = await getAllEvents();
        } else {
          list = await getEventsByOrganiser(user.id);
        }

        if (!isMounted) return;
        const validList = (list || []).filter((e) => e && e.id);
        setEvents(validList);

        let activeId = propEventId || (searchParams ? searchParams.get("eventId") : null);
        if (!activeId && typeof window !== "undefined") {
          try {
            activeId = localStorage.getItem("admin_selected_event_id");
          } catch {}
        }

        if (activeId && validList.some((e) => e.id === activeId)) {
          setSelectedEventId(activeId);
        } else if (validList.length > 0) {
          setSelectedEventId(validList[0].id);
        }
      } catch (err) {
        console.error("Failed to load events for registration form builder:", err);
        toast.error("Could not load events");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    initEvents();
    return () => {
      isMounted = false;
    };
  }, [user, searchParams, propEventId]);

  // 2. Load Event Data & Custom Questions
  useEffect(() => {
    let isMounted = true;
    async function loadEventData() {
      if (!selectedEventId) {
        setEvent(null);
        return;
      }

      try {
        const ev = await getEvent(selectedEventId);
        if (!isMounted || !ev) return;
        setEvent(ev);

        setRegistrationStatus(
          ev.registrationStatus || (ev.isActive !== false ? "Open" : "Closed")
        );
        setGroupRegistration(Boolean(ev.groupRegistration));

        if (ev.personalInfoConfig) {
          setPersonalInfo({
            nameMode: ev.personalInfoConfig.nameMode || "Full Name",
            emailRequired: true,
            phoneMode: ev.personalInfoConfig.phoneMode || "Required",
          });
        }

        // Load custom questions
        if (Array.isArray(ev.customQuestions) && ev.customQuestions.length > 0) {
          setCustomQuestions(ev.customQuestions);
        } else {
          const existingForm = await getCustomFormByEvent(selectedEventId);
          if (existingForm && Array.isArray(existingForm.fields)) {
            const converted = existingForm.fields
              .filter((f) => !["name", "fullName", "email", "phone", "whatsappPhone"].includes(f.id))
              .map((f, i) => ({
                id: f.id || `q_${i}`,
                label: f.label || f.name || "Question",
                type: f.type === "dropdown" ? "select" : f.type || "text",
                required: Boolean(f.required),
                placeholder: f.placeholder || "",
                options: Array.isArray(f.options) ? f.options : [],
              }));
            if (converted.length > 0) {
              setCustomQuestions(converted);
            }
          }
        }
      } catch (err) {
        console.error("Error loading event registration data:", err);
      }
    }

    loadEventData();
    return () => {
      isMounted = false;
    };
  }, [selectedEventId]);

  // 3. Save All Configuration
  const handleSaveAll = async () => {
    if (!selectedEventId) {
      toast.error("Please select an event to save");
      return;
    }

    setIsSaving(true);
    try {
      // Compile full fields schema for attendee check-in and exports
      const compiledFields = [
        {
          id: "fullName",
          label: personalInfo.nameMode === "First and Last Name" ? "First & Last Name" : "Full Name",
          type: "text",
          required: true,
          placeholder: "Your full name",
        },
        {
          id: "email",
          label: "Email Address",
          type: "email",
          required: true,
          placeholder: "you@example.com",
        },
      ];

      if (personalInfo.phoneMode !== "Off") {
        compiledFields.push({
          id: "whatsappPhone",
          label: "Phone / WhatsApp",
          type: "tel",
          required: personalInfo.phoneMode === "Required",
          placeholder: "+91 98765 43210",
        });
      }

      // Add Custom Questions
      customQuestions.forEach((q) => {
        compiledFields.push({
          id: q.id || `q_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          label: q.label,
          type: q.type === "select" ? "dropdown" : q.type,
          required: Boolean(q.required),
          placeholder: q.placeholder || "",
          options: Array.isArray(q.options) ? q.options : [],
        });
      });

      // Update customForms collection
      const existing = await getCustomFormByEvent(selectedEventId);
      const formPayload = {
        title: `${event?.name || "Event"} Registration`,
        fields: compiledFields,
        status: "published",
        isPaid: false,
        amount: 0,
      };

      if (existing?.id) {
        await updateCustomForm(existing.id, formPayload);
      } else {
        await createCustomForm(selectedEventId, formPayload, "event");
      }

      // Update Event Document
      await updateEvent(selectedEventId, {
        registrationStatus,
        isActive: registrationStatus === "Open",
        groupRegistration,
        personalInfoConfig: personalInfo,
        customQuestions,
      });

      toast.success("Registration form questions updated successfully!");
    } catch (err) {
      console.error("Failed to save registration form:", err);
      toast.error("Failed to save registration settings");
    } finally {
      setIsSaving(false);
    }
  };

  // ── CUSTOM QUESTIONS MANAGEMENT ──
  const handleOpenAddQuestion = () => {
    setEditingQuestionIndex(null);
    setQuestionForm({
      label: "",
      type: "text",
      required: true,
      placeholder: "",
      optionsStr: "",
    });
    setShowQuestionModal(true);
  };

  const handleOpenEditQuestion = (index) => {
    const q = customQuestions[index];
    if (!q) return;
    setEditingQuestionIndex(index);
    setQuestionForm({
      label: q.label,
      type: q.type,
      required: q.required,
      placeholder: q.placeholder || "",
      optionsStr: Array.isArray(q.options) ? q.options.join("\n") : "",
    });
    setShowQuestionModal(true);
  };

  const handleSaveQuestion = () => {
    if (!questionForm.label.trim()) {
      toast.error("Please enter the question title");
      return;
    }

    const options =
      questionForm.type === "select" ||
      questionForm.type === "radio" ||
      questionForm.type === "checkbox"
        ? questionForm.optionsStr
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

    const newQ = {
      id:
        editingQuestionIndex !== null
          ? customQuestions[editingQuestionIndex].id
          : `q_${Date.now()}`,
      label: questionForm.label.trim(),
      type: questionForm.type,
      required: questionForm.required,
      placeholder: questionForm.placeholder.trim(),
      options,
    };

    if (editingQuestionIndex !== null) {
      setCustomQuestions((prev) => {
        const copy = [...prev];
        copy[editingQuestionIndex] = newQ;
        return copy;
      });
      toast.success("Question updated");
    } else {
      setCustomQuestions((prev) => [...prev, newQ]);
      toast.success("Question added to registration form");
    }

    setShowQuestionModal(false);
  };

  const handleDeleteQuestion = (index) => {
    setCustomQuestions((prev) => prev.filter((_, i) => i !== index));
    toast.success("Question removed");
  };

  const handleMoveQuestion = (index, direction) => {
    if (
      (direction === -1 && index === 0) ||
      (direction === 1 && index === customQuestions.length - 1)
    ) {
      return;
    }
    setCustomQuestions((prev) => {
      const copy = [...prev];
      const target = index + direction;
      const temp = copy[index];
      copy[index] = copy[target];
      copy[target] = temp;
      return copy;
    });
  };

  if (loading && !event) {
    return (
      <BrandLoader
        message="Loading form builder"
        subMessage="TicketLelo Registration Studio"
      />
    );
  }

  return (
    <div className="w-full mx-auto space-y-6 select-none">
      {/* ── TOP ACTION BAR: Registration Status & Save ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#2A2D31]">
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Registration Status Pill */}
          <button
            type="button"
            onClick={() =>
              setRegistrationStatus((prev) => (prev === "Open" ? "Closed" : "Open"))
            }
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2 border transition-all cursor-pointer ${
              registrationStatus === "Open"
                ? "bg-[#183124] text-[#3DD68C] border-[#3DD68C]/30 hover:bg-[#1E3F2E]"
                : "bg-[#2A1D13] text-[#FE760B] border-[#FE760B]/30 hover:bg-[#382618]"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                registrationStatus === "Open" ? "bg-[#3DD68C]" : "bg-[#FE760B]"
              }`}
            />
            <span>Registration:</span>
            <strong className="capitalize">{registrationStatus}</strong>
          </button>

          {/* Group Registration Pill */}
          <button
            type="button"
            onClick={() => setGroupRegistration((prev) => !prev)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2 border transition-all cursor-pointer ${
              groupRegistration
                ? "bg-[#251833] text-[#A855F7] border-[#A855F7]/30 hover:bg-[#321F45]"
                : "bg-[#1A1C1F] text-[#9B9EA4] border-[#2A2D31] hover:bg-[#212327]"
            }`}
          >
            <span>Group Registration:</span>
            <strong>{groupRegistration ? "On" : "Off"}</strong>
          </button>
        </div>

        {/* Save Button */}
        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={isSaving}
            className="px-6 py-2 rounded-xl bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4 text-[#131517]" />
            <span>{isSaving ? "Saving..." : "Save Form"}</span>
          </button>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          MAIN 2-COLUMN SIDE-BY-SIDE LAYOUT (Real-Time Live Preview)
          ════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* ── LEFT COLUMN: FORM QUESTIONS & BUILDER (cols 7) ── */}
        <div className="lg:col-span-7 space-y-6">
          {/* Header Info */}
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Registration Questions &amp; Form Fields
            </h2>
            <p className="text-xs text-[#9B9EA4] mt-0.5">
              Customize the information attendees must fill out when registering for &ldquo;{event?.name || "your event"}&rdquo;.
            </p>
          </div>

          {/* ── 1. Attendee Basic Information ── */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-[#3DD68C] uppercase tracking-wider">
              <User size={14} className="text-[#3DD68C]" />
              <span>Attendee Personal Info</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Field: Name */}
              <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-xl p-3 flex items-center justify-between gap-2 shadow-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <User size={14} className="text-[#9B9EA4] shrink-0" />
                  <span className="text-xs font-bold text-white truncate">Name</span>
                </div>
                <select
                  value={personalInfo.nameMode}
                  onChange={(e) =>
                    setPersonalInfo((prev) => ({ ...prev, nameMode: e.target.value }))
                  }
                  className="bg-[#212327] border border-[#2A2D31] rounded-lg px-2.5 py-1 text-xs text-white font-medium outline-none cursor-pointer"
                >
                  <option value="Full Name">Full Name</option>
                  <option value="First and Last Name">First and Last Name</option>
                </select>
              </div>

              {/* Field: Email */}
              <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-xl p-3 flex items-center justify-between gap-2 shadow-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <Mail size={14} className="text-[#9B9EA4] shrink-0" />
                  <span className="text-xs font-bold text-white truncate">Email</span>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-[#212327] border border-[#2A2D31] text-[11px] font-semibold text-[#9B9EA4]">
                  Required
                </span>
              </div>

              {/* Field: Phone */}
              <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-xl p-3 flex items-center justify-between gap-2 shadow-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <Phone size={14} className="text-[#9B9EA4] shrink-0" />
                  <span className="text-xs font-bold text-white truncate">Phone</span>
                </div>
                <select
                  value={personalInfo.phoneMode}
                  onChange={(e) =>
                    setPersonalInfo((prev) => ({ ...prev, phoneMode: e.target.value }))
                  }
                  className="bg-[#212327] border border-[#2A2D31] rounded-lg px-2.5 py-1 text-xs text-white font-medium outline-none cursor-pointer"
                >
                  <option value="Off">Off</option>
                  <option value="Optional">Optional</option>
                  <option value="Required">Required</option>
                </select>
              </div>
            </div>
          </div>

          {/* ── 2. Custom Questions Builder ── */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-[#FE760B] uppercase tracking-wider">
                <HelpCircle size={14} className="text-[#FE760B]" />
                <span>Custom Questions ({customQuestions.length})</span>
              </div>
              <button
                type="button"
                onClick={handleOpenAddQuestion}
                className="px-3.5 py-1.5 rounded-xl bg-[#212327] hover:bg-[#2A2D31] border border-[#2A2D31] text-xs font-semibold text-white flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus size={13} className="text-[#FE760B]" />
                <span>Add Question</span>
              </button>
            </div>

            {/* Questions List */}
            <div className="space-y-2">
              {customQuestions.map((q, index) => {
                const optionsSummary =
                  Array.isArray(q.options) && q.options.length > 0
                    ? `${q.options.length} options: ${q.options.slice(0, 3).join(", ")}${
                        q.options.length > 3 ? "..." : ""
                      }`
                    : null;

                const typeBadge =
                  q.type === "select"
                    ? "Single Select Dropdown"
                    : q.type === "checkbox"
                    ? "Multi-Select Checkboxes"
                    : q.type === "radio"
                    ? "Radio Buttons"
                    : q.type === "textarea"
                    ? "Long Paragraph"
                    : q.type === "file"
                    ? "File Upload / ID"
                    : "Short Text";

                return (
                  <div
                    key={q.id || index}
                    className="bg-[#1A1C1F] border border-[#2A2D31] hover:border-[#383C42] rounded-2xl p-4 flex items-center justify-between gap-3 transition-colors group shadow-sm"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Reorder Arrows */}
                      <div className="flex flex-col items-center justify-center gap-0.5 text-[#9B9EA4] shrink-0">
                        <button
                          type="button"
                          onClick={() => handleMoveQuestion(index, -1)}
                          disabled={index === 0}
                          className="hover:text-white disabled:opacity-20 cursor-pointer p-0.5"
                          title="Move Up"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveQuestion(index, 1)}
                          disabled={index === customQuestions.length - 1}
                          className="hover:text-white disabled:opacity-20 cursor-pointer p-0.5"
                          title="Move Down"
                        >
                          ▼
                        </button>
                      </div>

                      {/* Question Label & Meta */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs sm:text-sm font-bold text-white truncate">
                            {q.label}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[#9B9EA4] flex-wrap">
                          <span>{typeBadge}</span>
                          {optionsSummary && (
                            <>
                              <span>•</span>
                              <span className="truncate">{optionsSummary}</span>
                            </>
                          )}
                          {q.required && (
                            <>
                              <span>•</span>
                              <span className="text-[#FE760B] font-semibold">Required</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions: Edit & Delete */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenEditQuestion(index)}
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-[#9B9EA4] hover:text-white transition-colors cursor-pointer"
                        title="Edit Question"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteQuestion(index)}
                        className="p-2 rounded-xl bg-white/5 hover:bg-red-500/10 text-[#9B9EA4] hover:text-red-400 transition-colors cursor-pointer"
                        title="Delete Question"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN: REAL-TIME STICKY LIVE FORM PREVIEW (cols 5) ── */}
        <div className="lg:col-span-5 lg:sticky lg:top-6 space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#3DD68C] animate-pulse" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Live Form Preview
              </h3>
            </div>
            <span className="text-[11px] font-medium text-[#9B9EA4]">Real-time interactive</span>
          </div>

          {/* Form Preview Card matching attendee registration experience */}
          <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[calc(100vh-120px)] overflow-y-auto no-scrollbar">
            {/* Header / Event Title */}
            <div className="pb-3 border-b border-[#2A2D31]">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FE760B]/12 text-[#FE760B] border border-[#FE760B]/30 text-[10px] font-bold uppercase tracking-wider mb-2">
                Attendee Registration
              </span>
              <h4 className="text-lg font-bold text-white tracking-tight">
                {event?.name || event?.title || "Tech Fest 2026"}
              </h4>
              <p className="text-xs text-[#9B9EA4] mt-0.5">
                Fill out the details below to RSVP and receive your pass
              </p>
            </div>

            <div className="space-y-4">
              {/* Attendee Name */}
              <div>
                <label className="block text-xs font-semibold text-[#D0D0D1] mb-1.5">
                  {personalInfo.nameMode === "First and Last Name" ? "First & Last Name" : "Full Name"} <span className="text-[#FE760B]">*</span>
                </label>
                <input
                  type="text"
                  disabled
                  placeholder="Rahul Sharma"
                  className="w-full bg-[#131517] border border-[#2A2D31] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-[#64748B] outline-none cursor-not-allowed"
                />
              </div>

              {/* Attendee Email */}
              <div>
                <label className="block text-xs font-semibold text-[#D0D0D1] mb-1.5">
                  Email Address <span className="text-[#FE760B]">*</span>
                </label>
                <input
                  type="email"
                  disabled
                  placeholder="rahul@example.com"
                  className="w-full bg-[#131517] border border-[#2A2D31] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-[#64748B] outline-none cursor-not-allowed"
                />
              </div>

              {/* Attendee Phone */}
              {personalInfo.phoneMode !== "Off" && (
                <div>
                  <label className="block text-xs font-semibold text-[#D0D0D1] mb-1.5">
                    Phone / WhatsApp {personalInfo.phoneMode === "Required" ? <span className="text-[#FE760B]">*</span> : <span className="text-[#9B9EA4] font-normal">(Optional)</span>}
                  </label>
                  <input
                    type="tel"
                    disabled
                    placeholder="+91 98765 43210"
                    className="w-full bg-[#131517] border border-[#2A2D31] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-[#64748B] outline-none cursor-not-allowed"
                  />
                </div>
              )}

              {/* Custom Questions rendered in real time */}
              {customQuestions.map((q) => (
                <div key={q.id}>
                  <label className="block text-xs font-semibold text-[#D0D0D1] mb-1.5">
                    {q.label} {q.required && <span className="text-[#FE760B]">*</span>}
                  </label>

                  {q.type === "select" ? (
                    <select
                      disabled
                      className="w-full bg-[#131517] border border-[#2A2D31] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none cursor-not-allowed"
                    >
                      <option>{q.placeholder || "Select option"}</option>
                      {Array.isArray(q.options) &&
                        q.options.map((opt, i) => <option key={i}>{opt}</option>)}
                    </select>
                  ) : q.type === "textarea" ? (
                    <textarea
                      disabled
                      rows={2}
                      placeholder={q.placeholder || "Enter details..."}
                      className="w-full bg-[#131517] border border-[#2A2D31] rounded-xl p-3 text-xs text-white placeholder-[#64748B] outline-none resize-none cursor-not-allowed"
                    />
                  ) : q.type === "checkbox" ? (
                    <div className="space-y-1.5 pt-1">
                      {Array.isArray(q.options) && q.options.length > 0 ? (
                        q.options.map((opt, i) => (
                          <label key={i} className="flex items-center gap-2 text-xs text-[#D0D0D1] select-none">
                            <input type="checkbox" disabled className="rounded accent-[#FE760B] cursor-not-allowed" />
                            <span>{opt}</span>
                          </label>
                        ))
                      ) : (
                        <p className="text-[11px] text-[#9B9EA4] italic">No options added yet</p>
                      )}
                    </div>
                  ) : q.type === "radio" ? (
                    <div className="space-y-1.5 pt-1">
                      {Array.isArray(q.options) && q.options.length > 0 ? (
                        q.options.map((opt, i) => (
                          <label key={i} className="flex items-center gap-2 text-xs text-[#D0D0D1] select-none">
                            <input type="radio" disabled name={`preview_${q.id}`} className="accent-[#FE760B] cursor-not-allowed" />
                            <span>{opt}</span>
                          </label>
                        ))
                      ) : (
                        <p className="text-[11px] text-[#9B9EA4] italic">No options added yet</p>
                      )}
                    </div>
                  ) : q.type === "file" ? (
                    <div className="p-3 border border-dashed border-[#2A2D31] rounded-xl text-center text-xs text-[#9B9EA4] flex items-center justify-center gap-2 bg-[#131517]">
                      <Upload size={13} className="text-[#FE760B]" />
                      <span>{q.placeholder || "Upload file / ID verification"}</span>
                    </div>
                  ) : (
                    <input
                      type="text"
                      disabled
                      placeholder={q.placeholder || "Your answer"}
                      className="w-full bg-[#131517] border border-[#2A2D31] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-[#64748B] outline-none cursor-not-allowed"
                    />
                  )}
                </div>
              ))}

              {/* One-Click RSVP Button */}
              <button
                type="button"
                disabled
                className="w-full py-3 rounded-2xl bg-[#FE760B] text-[#131517] font-bold text-xs mt-4 shadow-lg cursor-not-allowed opacity-90 select-none flex items-center justify-center gap-2"
              >
                <span>Register</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          MODAL: ADD / EDIT QUESTION
          ══════════════════════════════════════════════════ */}
      {showQuestionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl bg-[#1A1C1F] border border-[#2A2D31] p-6 shadow-2xl relative space-y-5 animate-in zoom-in-95 duration-200 text-white">
            <button
              type="button"
              onClick={() => setShowQuestionModal(false)}
              className="absolute top-5 right-5 p-1.5 text-[#9B9EA4] hover:text-white rounded-full bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>

            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#212327] border border-[#2A2D31] flex items-center justify-center text-[#FE760B] mb-2">
                <HelpCircle size={24} />
              </div>
              <h3 className="text-xl font-bold text-white tracking-tight">
                {editingQuestionIndex !== null ? "Edit Question" : "Add Custom Question"}
              </h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#9B9EA4] uppercase tracking-wider mb-1.5">
                  Question Title / Label
                </label>
                <input
                  type="text"
                  placeholder="e.g. Department / Institution / Team Name"
                  value={questionForm.label}
                  onChange={(e) =>
                    setQuestionForm((prev) => ({ ...prev, label: e.target.value }))
                  }
                  className="w-full bg-[#131517] border border-[#2A2D31] focus:border-[#FE760B] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-[#64748B] outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#9B9EA4] uppercase tracking-wider mb-1.5">
                  Field Type
                </label>
                <select
                  value={questionForm.type}
                  onChange={(e) =>
                    setQuestionForm((prev) => ({ ...prev, type: e.target.value }))
                  }
                  className="w-full bg-[#131517] border border-[#2A2D31] focus:border-[#FE760B] rounded-xl px-3 py-2.5 text-xs text-white outline-none cursor-pointer"
                >
                  <option value="text">Short Text</option>
                  <option value="select">Dropdown / Single Select</option>
                  <option value="checkbox">Multi-Select Checkboxes</option>
                  <option value="radio">Radio Buttons</option>
                  <option value="textarea">Long Paragraph Text</option>
                  <option value="file">File Upload / ID Proof</option>
                </select>
              </div>

              {(questionForm.type === "select" ||
                questionForm.type === "radio" ||
                questionForm.type === "checkbox") && (
                <div>
                  <label className="block text-xs font-semibold text-[#9B9EA4] uppercase tracking-wider mb-1.5">
                    Options (one per line)
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Option 1&#10;Option 2&#10;Option 3"
                    value={questionForm.optionsStr}
                    onChange={(e) =>
                      setQuestionForm((prev) => ({ ...prev, optionsStr: e.target.value }))
                    }
                    className="w-full bg-[#131517] border border-[#2A2D31] focus:border-[#FE760B] rounded-xl p-3 text-xs text-white placeholder-[#64748B] outline-none font-mono resize-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#9B9EA4] uppercase tracking-wider mb-1.5">
                  Placeholder / Helper Text
                </label>
                <input
                  type="text"
                  placeholder="Optional hint for attendees"
                  value={questionForm.placeholder}
                  onChange={(e) =>
                    setQuestionForm((prev) => ({ ...prev, placeholder: e.target.value }))
                  }
                  className="w-full bg-[#131517] border border-[#2A2D31] focus:border-[#FE760B] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-[#64748B] outline-none transition-colors"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-[#131517] border border-[#2A2D31]">
                <div>
                  <p className="text-xs font-bold text-white">Required Field</p>
                  <p className="text-[11px] text-[#9B9EA4]">Attendees must answer to register</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setQuestionForm((prev) => ({ ...prev, required: !prev.required }))
                  }
                  className={`w-11 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer ${
                    questionForm.required ? "bg-[#FE760B]" : "bg-[#2A2D31]"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      questionForm.required ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSaveQuestion}
              className="w-full py-3 rounded-2xl bg-white hover:bg-slate-200 text-black font-bold text-sm transition-all shadow-xl cursor-pointer"
            >
              Save Question
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
