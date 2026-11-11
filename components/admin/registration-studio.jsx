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
  Eye,
  Smartphone,
  Monitor,
  Calendar,
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

// Default registration questions for college/tech fest events with privacy-safe genuine placeholders
const DEFAULT_CUSTOM_QUESTIONS = [
  {
    id: "q_college_name",
    label: "College / University Name",
    type: "text",
    required: true,
    placeholder: "Enter college or university name",
    options: [],
  },
  {
    id: "q_department",
    label: "Department / Branch",
    type: "select",
    required: false,
    placeholder: "Select department",
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
    placeholder: "Select year of study",
    options: ["1st Year", "2nd Year", "3rd Year", "4th Year", "Postgraduate"],
  },
  {
    id: "q_team_name",
    label: "Team Name (if participating in team event)",
    type: "text",
    required: false,
    placeholder: "Enter team name (if applicable)",
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

  // Modals for Personal Info Fields Configuration (clean & crisp matching Image 4)
  const [showNameModal, setShowNameModal] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);

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
    allowMultiple: false,
  });

  // Modal: Form Preview as seen by Attendees
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewDevice, setPreviewDevice] = useState("mobile"); // "mobile" | "desktop"

  // 1. Load Organiser Events
  useEffect(() => {
    let isMounted = true;
    async function initEvents() {
      if (!user) return;
      try {
        setLoading(true);
        const emailLower = (user.email || "").toLowerCase().trim();
        const isSuperAdmin =
          user.role === "superAdmin" ||
          user.role === "superadmin" ||
          emailLower === "adil4ticketlelo@gmail.com" ||
          emailLower === "superadmin@ticketlelo.com";

        let list = [];
        if (isSuperAdmin) {
          // Super admin has full platform access to all events of all organisers
          list = (await getAllEvents()) || [];
        } else {
          const userId = user.uid || user.id;
          list = await getEventsByOrganiser(userId);
          if (!list || list.length === 0) {
            const all = await getAllEvents();
            list = (all || []).filter(
              (e) =>
                e.createdBy === userId ||
                e.userId === userId ||
                e.organiserId === userId ||
                e.organizerId === userId
            );
          }
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
                allowMultiple: Boolean(f.allowMultiple || f.multiple),
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
          placeholder: "Enter full name",
        },
        {
          id: "email",
          label: "Email Address",
          type: "email",
          required: true,
          placeholder: "Enter email address",
        },
      ];

      if (personalInfo.phoneMode !== "Off") {
        compiledFields.push({
          id: "whatsappPhone",
          label: "Phone / WhatsApp",
          type: "tel",
          required: personalInfo.phoneMode === "Required",
          placeholder: "Enter phone number",
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
          allowMultiple: Boolean(q.allowMultiple),
          multiple: Boolean(q.allowMultiple),
        });
      });

      // Check if event is paid
      const isPaidEvent = Boolean(
        event?.isPaid ||
        (event?.price && event.price !== "Free" && Number(String(event.price).replace(/[^0-9]/g, "")) > 0)
      );
      const eventPrice = isPaidEvent ? Number(String(event?.price).replace(/[^0-9]/g, "")) || 0 : 0;

      // Update customForms collection
      const existing = await getCustomFormByEvent(selectedEventId);
      const formPayload = {
        title: `${event?.name || "Event"} Registration`,
        fields: compiledFields,
        status: "published",
        isPaid: isPaidEvent,
        amount: eventPrice,
      };

      if (existing?.id) {
        await updateCustomForm(existing.id, formPayload);
      } else {
        await createCustomForm(selectedEventId, formPayload, "event");
      }

      // Update Event Document (paid events automatically disable requireApproval)
      await updateEvent(selectedEventId, {
        registrationStatus,
        isActive: registrationStatus === "Open",
        groupRegistration,
        personalInfoConfig: personalInfo,
        customQuestions,
        ...(isPaidEvent ? { requireApproval: false } : {}),
      });

      toast.success("Registration form questions saved successfully!", {
        action: {
          label: "Preview Form",
          onClick: () => setShowPreviewModal(true),
        },
      });
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
      allowMultiple: false,
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
      allowMultiple: Boolean(q.allowMultiple),
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
      allowMultiple: questionForm.type === "file" ? Boolean(questionForm.allowMultiple) : false,
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
        message="Loading..."
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

        {/* Action Buttons: Preview Form & Save */}
        <div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
          <button
            type="button"
            onClick={() => setShowPreviewModal(true)}
            className="px-4 py-2 rounded-xl bg-[#212327] hover:bg-[#2A2D31] text-white border border-[#2A2D31] hover:border-[#3A3D42] font-semibold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
            title="Preview how attendees experience this registration form"
          >
            <Eye className="w-4 h-4 text-[#FE760B]" />
            <span>Preview Form</span>
          </button>

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
              <div
                onClick={() => setShowNameModal(true)}
                className="bg-[#1A1C1F] hover:bg-[#212327] border border-[#2A2D31] hover:border-[#383C42] rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-sm transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-[#9B9EA4] group-hover:text-white group-hover:bg-[#FE760B]/10 group-hover:border-[#FE760B]/30 transition-colors shrink-0">
                    <User size={15} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-white block truncate">Name</span>
                    <span className="text-[11px] text-[#9B9EA4] block truncate">
                      {personalInfo.nameMode === "First and Last Name" ? "First & Last Name" : "Full Name"}
                    </span>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-[#212327] group-hover:bg-[#2A2D31] border border-[#2A2D31] text-[11px] font-semibold text-[#FE760B] flex items-center gap-1 shrink-0 transition-colors">
                  <span>Edit</span>
                  <ChevronDown size={12} className="text-[#9B9EA4]" />
                </span>
              </div>

              {/* Field: Email */}
              <div
                onClick={() => setShowEmailModal(true)}
                className="bg-[#1A1C1F] hover:bg-[#212327] border border-[#2A2D31] hover:border-[#383C42] rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-sm transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-[#9B9EA4] group-hover:text-white group-hover:bg-[#FE760B]/10 group-hover:border-[#FE760B]/30 transition-colors shrink-0">
                    <Mail size={15} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-white block truncate">Email</span>
                    <span className="text-[11px] text-[#9B9EA4] block truncate">Required for passes</span>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-[#212327] border border-[#2A2D31] text-[11px] font-semibold text-[#3DD68C] shrink-0">
                  Mandatory
                </span>
              </div>

              {/* Field: Phone */}
              <div
                onClick={() => setShowPhoneModal(true)}
                className="bg-[#1A1C1F] hover:bg-[#212327] border border-[#2A2D31] hover:border-[#383C42] rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-sm transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-[#9B9EA4] group-hover:text-white group-hover:bg-[#FE760B]/10 group-hover:border-[#FE760B]/30 transition-colors shrink-0">
                    <Phone size={15} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-white block truncate">Phone</span>
                    <span className="text-[11px] text-[#9B9EA4] block truncate">
                      {personalInfo.phoneMode === "Off" ? "Hidden / Off" : personalInfo.phoneMode}
                    </span>
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold flex items-center gap-1 shrink-0 transition-colors ${
                  personalInfo.phoneMode === "Required"
                    ? "bg-[#FE760B]/10 border-[#FE760B]/30 text-[#FE760B]"
                    : personalInfo.phoneMode === "Optional"
                    ? "bg-[#212327] group-hover:bg-[#2A2D31] border-[#2A2D31] text-gray-300"
                    : "bg-[#212327] border-[#2A2D31] text-[#9B9EA4]"
                }`}>
                  <span>{personalInfo.phoneMode}</span>
                  <ChevronDown size={12} className="text-[#9B9EA4]" />
                </span>
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
                    : q.type === "date"
                    ? "Date / DOB (Calendar)"
                    : q.type === "file"
                    ? q.allowMultiple
                      ? "File Upload (Multiple)"
                      : "File Upload (Single)"
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
                {event?.name || event?.title || "Event Registration"}
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
                  placeholder="Enter full name"
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
                  placeholder="Enter email address"
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
                    placeholder="Enter phone number"
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
                  ) : q.type === "date" ? (
                    <div className="relative">
                      <input
                        type="date"
                        disabled
                        className="w-full bg-[#131517] border border-[#2A2D31] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-[#64748B] outline-none cursor-not-allowed"
                      />
                      <Calendar size={13} className="text-[#FE760B] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  ) : q.type === "file" ? (
                    <div className="p-3 border border-dashed border-[#2A2D31] rounded-xl text-center text-xs text-[#9B9EA4] flex items-center justify-center gap-2 bg-[#131517]">
                      <Upload size={13} className="text-[#FE760B]" />
                      <span>
                        {q.placeholder ||
                          (q.allowMultiple
                            ? "Upload multiple documents (Single or Multiple)"
                            : "Upload single document / ID proof")}
                      </span>
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
                  <option value="date">Date / DOB (Calendar)</option>
                  <option value="file">File Upload / Document Proof</option>
                  <option value="checkbox">Multi-Select Checkboxes</option>
                  <option value="radio">Radio Buttons</option>
                  <option value="textarea">Long Paragraph Text</option>
                </select>
              </div>

              {questionForm.type === "file" && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#131517] border border-[#2A2D31]">
                  <div>
                    <p className="text-xs font-bold text-white">Upload Mode</p>
                    <p className="text-[11px] text-[#9B9EA4]">
                      {questionForm.allowMultiple
                        ? "Multiple files allowed per attendee"
                        : "Single file only"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setQuestionForm((prev) => ({
                        ...prev,
                        allowMultiple: !prev.allowMultiple,
                      }))
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      questionForm.allowMultiple
                        ? "bg-[#FE760B] text-black"
                        : "bg-[#212327] text-white hover:bg-[#2A2D31]"
                    }`}
                  >
                    {questionForm.allowMultiple ? "Multiple Files" : "Single File"}
                  </button>
                </div>
              )}

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

      {/* ── INTERACTIVE ATTENDEE FORM PREVIEW MODAL ── */}
      {showPreviewModal && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200"
          onClick={() => setShowPreviewModal(false)}
        >
          <div
            className={`w-full transition-all duration-300 ${
              previewDevice === "mobile"
                ? "max-w-[420px] rounded-[36px] border-[6px] border-[#2A2D31] bg-[#141619] shadow-2xl p-4 sm:p-5"
                : "max-w-2xl rounded-3xl border border-[#2A2D31] bg-[#181A1D] shadow-2xl p-6"
            } relative my-auto text-white`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Device Switcher & Close Bar */}
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#2A2D31]/80">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#3DD68C] animate-pulse" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Attendee Form Preview
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Device Switcher */}
                <div className="flex items-center rounded-xl bg-[#131517] p-1 border border-[#2A2D31]">
                  <button
                    type="button"
                    onClick={() => setPreviewDevice("mobile")}
                    className={`p-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                      previewDevice === "mobile"
                        ? "bg-[#FE760B] text-[#131517] font-bold"
                        : "text-[#9B9EA4] hover:text-white"
                    }`}
                    title="Mobile phone view"
                  >
                    <Smartphone size={13} />
                    <span className="hidden sm:inline text-[11px]">Mobile</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewDevice("desktop")}
                    className={`p-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                      previewDevice === "desktop"
                        ? "bg-[#FE760B] text-[#131517] font-bold"
                        : "text-[#9B9EA4] hover:text-white"
                    }`}
                    title="Desktop view"
                  >
                    <Monitor size={13} />
                    <span className="hidden sm:inline text-[11px]">Desktop</span>
                  </button>
                </div>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => setShowPreviewModal(false)}
                  className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-[#9B9EA4] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                  title="Close preview"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Form Content as rendered to attendees */}
            <div className="space-y-4 max-h-[75vh] overflow-y-auto no-scrollbar pr-1">
              {/* Event Header Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-[#212327] to-[#1A1C1F] border border-[#2A2D31] space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full bg-[#FE760B]/15 text-[#FE760B] border border-[#FE760B]/30 text-[10px] font-bold uppercase tracking-wider">
                    Registration Form
                  </span>
                  {Boolean(event?.isPaid || (event?.price && event.price !== "Free")) ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-[#3DD68C]/15 text-[#3DD68C] border border-[#3DD68C]/30 text-[10px] font-bold uppercase tracking-wider">
                      Paid Pass (₹{event?.price || "199"}) • Auto-Confirmed
                    </span>
                  ) : event?.requireApproval ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px] font-bold uppercase tracking-wider">
                      Approval Required
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full bg-[#3DD68C]/15 text-[#3DD68C] border border-[#3DD68C]/30 text-[10px] font-bold uppercase tracking-wider">
                      Free Entry • Instant Pass
                    </span>
                  )}
                </div>

                <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">
                  {event?.name || event?.title || "Event Registration"}
                </h3>
                <p className="text-xs text-[#9B9EA4]">
                  Fill out the details below to complete your registration and receive your entry ticket.
                </p>
              </div>

              {/* Attendee Info Inputs */}
              <div className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-[#D0D0D1] mb-1.5">
                    {personalInfo.nameMode === "First and Last Name" ? "First & Last Name" : "Full Name"} <span className="text-[#FE760B]">*</span>
                  </label>
                  <input
                    type="text"
                    className="w-full bg-[#131517] border border-[#2A2D31] focus:border-[#FE760B] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-[#64748B] outline-none"
                    placeholder="Enter full name"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#D0D0D1] mb-1.5">
                    Email Address <span className="text-[#FE760B]">*</span>
                  </label>
                  <input
                    type="email"
                    className="w-full bg-[#131517] border border-[#2A2D31] focus:border-[#FE760B] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-[#64748B] outline-none"
                    placeholder="Enter email address"
                  />
                </div>

                {personalInfo.phoneMode !== "Off" && (
                  <div>
                    <label className="block text-xs font-semibold text-[#D0D0D1] mb-1.5">
                      Phone / WhatsApp {personalInfo.phoneMode === "Required" ? <span className="text-[#FE760B]">*</span> : <span className="text-[#9B9EA4] font-normal">(Optional)</span>}
                    </label>
                    <input
                      type="tel"
                      className="w-full bg-[#131517] border border-[#2A2D31] focus:border-[#FE760B] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-[#64748B] outline-none"
                      placeholder="Enter phone number"
                    />
                  </div>
                )}

                {/* Custom Questions */}
                {customQuestions.map((q) => (
                  <div key={q.id}>
                    <label className="block text-xs font-semibold text-[#D0D0D1] mb-1.5">
                      {q.label} {q.required && <span className="text-[#FE760B]">*</span>}
                    </label>

                    {q.type === "select" ? (
                      <select className="w-full bg-[#131517] border border-[#2A2D31] focus:border-[#FE760B] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white outline-none cursor-pointer">
                        <option value="">{q.placeholder || "Select an option"}</option>
                        {Array.isArray(q.options) &&
                          q.options.map((opt, i) => (
                            <option key={i} value={opt}>
                              {opt}
                            </option>
                          ))}
                      </select>
                    ) : q.type === "textarea" ? (
                      <textarea
                        rows={3}
                        placeholder={q.placeholder || "Enter details..."}
                        className="w-full bg-[#131517] border border-[#2A2D31] focus:border-[#FE760B] rounded-xl p-3 text-xs sm:text-sm text-white placeholder-[#64748B] outline-none resize-none"
                      />
                    ) : q.type === "checkbox" ? (
                      <div className="space-y-1.5 pt-1">
                        {Array.isArray(q.options) && q.options.length > 0 ? (
                          q.options.map((opt, i) => (
                            <label key={i} className="flex items-center gap-2 text-xs sm:text-sm text-[#D0D0D1] select-none cursor-pointer">
                              <input type="checkbox" defaultChecked={i === 0} className="rounded accent-[#FE760B]" />
                              <span>{opt}</span>
                            </label>
                          ))
                        ) : (
                          <label className="flex items-center gap-2 text-xs text-[#D0D0D1] select-none cursor-pointer">
                            <input type="checkbox" defaultChecked className="rounded accent-[#FE760B]" />
                            <span>I agree to event terms &amp; guidelines</span>
                          </label>
                        )}
                      </div>
                    ) : (
                      <input
                        type="text"
                        placeholder={q.placeholder || "Your answer"}
                        className="w-full bg-[#131517] border border-[#2A2D31] focus:border-[#FE760B] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-[#64748B] outline-none"
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* Submit Button in Preview */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    toast.success("Test submission successful! This is how your attendees will experience it.");
                    setShowPreviewModal(false);
                  }}
                  className="w-full py-3 rounded-2xl bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-black text-xs sm:text-sm transition-all shadow-lg cursor-pointer flex items-center justify-center gap-2"
                >
                  <CheckCircle2 size={16} />
                  <span>
                    {Boolean(event?.isPaid || (event?.price && event.price !== "Free"))
                      ? `Pay ₹${event?.price || "199"} & Confirm Registration`
                      : event?.requireApproval
                      ? "Submit Registration for Review"
                      : "Complete RSVP & Get Pass"}
                  </span>
                </button>
                <p className="text-center text-[10px] text-[#9B9EA4] mt-2">
                  🔒 Preview Mode • Submissions here will not create permanent attendee records
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          MODAL: ATTENDEE NAME FORMAT (Matching Image 4)
          ══════════════════════════════════════════════════ */}
      {showNameModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setShowNameModal(false)}
        >
          <div
            className="w-full max-w-[420px] bg-[#181A1D] border border-[#26292E] rounded-3xl shadow-2xl p-6 relative space-y-5 animate-in zoom-in-95 duration-150 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowNameModal(false)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Close modal"
            >
              <X size={16} />
            </button>

            <div className="w-11 h-11 rounded-2xl bg-[#22252A] border border-white/5 flex items-center justify-center text-[#FE760B]">
              <User size={20} />
            </div>

            <div>
              <h3 className="text-base font-bold text-white">Attendee Name Format</h3>
              <p className="text-xs text-[#9B9EA4] leading-relaxed mt-1">
                Choose how attendee names are entered during registration.
              </p>
            </div>

            <div className="space-y-2.5">
              {[
                {
                  id: "Full Name",
                  title: "Full Name (Single Field)",
                  desc: "A single input for the attendee's full name. Recommended for fast registrations.",
                },
                {
                  id: "First and Last Name",
                  title: "First & Last Name (Two Fields)",
                  desc: "Separate input boxes for first name and last name. Best for formal badges.",
                },
              ].map((opt) => {
                const isSelected = personalInfo.nameMode === opt.id;
                return (
                  <div
                    key={opt.id}
                    onClick={() =>
                      setPersonalInfo((prev) => ({ ...prev, nameMode: opt.id }))
                    }
                    className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-[#FE760B]/10 border-[#FE760B] text-white"
                        : "bg-[#141619] border-[#2A2D31] hover:border-[#383C42] text-gray-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">{opt.title}</span>
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          isSelected
                            ? "border-[#FE760B] bg-[#FE760B]"
                            : "border-[#4A4D53]"
                        }`}
                      >
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-[#131517]" />}
                      </div>
                    </div>
                    <p className="text-[11px] text-[#9B9EA4] mt-1 leading-relaxed">
                      {opt.desc}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowNameModal(false)}
                className="w-full py-2.5 rounded-xl bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-bold text-xs transition-all shadow-md active:scale-95 cursor-pointer"
              >
                Apply Setting
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          MODAL: PHONE REQUIREMENT (Matching Image 4)
          ══════════════════════════════════════════════════ */}
      {showPhoneModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setShowPhoneModal(false)}
        >
          <div
            className="w-full max-w-[420px] bg-[#181A1D] border border-[#26292E] rounded-3xl shadow-2xl p-6 relative space-y-5 animate-in zoom-in-95 duration-150 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowPhoneModal(false)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Close modal"
            >
              <X size={16} />
            </button>

            <div className="w-11 h-11 rounded-2xl bg-[#22252A] border border-white/5 flex items-center justify-center text-[#FE760B]">
              <Phone size={20} />
            </div>

            <div>
              <h3 className="text-base font-bold text-white">Phone / WhatsApp Requirement</h3>
              <p className="text-xs text-[#9B9EA4] leading-relaxed mt-1">
                Configure attendee phone collection for ticket delivery and event updates.
              </p>
            </div>

            <div className="space-y-2.5">
              {[
                {
                  id: "Required",
                  title: "Required (Mandatory)",
                  desc: "Attendees must enter their phone number to register. Recommended for WhatsApp tickets.",
                },
                {
                  id: "Optional",
                  title: "Optional",
                  desc: "Attendees can choose to share their phone number or leave it blank.",
                },
                {
                  id: "Off",
                  title: "Off / Hidden",
                  desc: "Do not ask attendees for their phone number on the registration form.",
                },
              ].map((opt) => {
                const isSelected = personalInfo.phoneMode === opt.id;
                return (
                  <div
                    key={opt.id}
                    onClick={() =>
                      setPersonalInfo((prev) => ({ ...prev, phoneMode: opt.id }))
                    }
                    className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-[#FE760B]/10 border-[#FE760B] text-white"
                        : "bg-[#141619] border-[#2A2D31] hover:border-[#383C42] text-gray-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">{opt.title}</span>
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          isSelected
                            ? "border-[#FE760B] bg-[#FE760B]"
                            : "border-[#4A4D53]"
                        }`}
                      >
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-[#131517]" />}
                      </div>
                    </div>
                    <p className="text-[11px] text-[#9B9EA4] mt-1 leading-relaxed">
                      {opt.desc}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowPhoneModal(false)}
                className="w-full py-2.5 rounded-xl bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-bold text-xs transition-all shadow-md active:scale-95 cursor-pointer"
              >
                Apply Setting
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          MODAL: EMAIL REQUIREMENT INFO (Matching Image 4)
          ══════════════════════════════════════════════════ */}
      {showEmailModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setShowEmailModal(false)}
        >
          <div
            className="w-full max-w-[400px] bg-[#181A1D] border border-[#26292E] rounded-3xl shadow-2xl p-6 relative space-y-5 animate-in zoom-in-95 duration-150 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowEmailModal(false)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Close modal"
            >
              <X size={16} />
            </button>

            <div className="w-11 h-11 rounded-2xl bg-[#22252A] border border-white/5 flex items-center justify-center text-[#3DD68C]">
              <Mail size={20} />
            </div>

            <div>
              <h3 className="text-base font-bold text-white">Email Address is Mandatory</h3>
              <p className="text-xs text-[#9B9EA4] leading-relaxed mt-1">
                Every ticket and check-in pass issued by TicketLelo requires an attendee email to deliver cryptographic QR entry passes, calendar invites, and live venue notices.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#141619] border border-[#2A2D31] text-xs text-gray-300 space-y-1.5">
              <div className="flex items-center gap-2 text-[#3DD68C] font-semibold text-[11px]">
                <CheckCircle2 size={13} />
                <span>Instant Ticket PDF &amp; QR Delivery</span>
              </div>
              <div className="flex items-center gap-2 text-[#3DD68C] font-semibold text-[11px]">
                <CheckCircle2 size={13} />
                <span>Apple / Google Wallet Compatible</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowEmailModal(false)}
              className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition-colors cursor-pointer"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
