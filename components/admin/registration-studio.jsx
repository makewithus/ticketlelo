"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  Ticket,
  User,
  Mail,
  Phone,
  Wallet,
  HelpCircle,
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  X,
  Check,
  ChevronDown,
  ChevronRight,
  ArrowUpDown,
  Lock,
  Unlock,
  Users,
  Sparkles,
  Save,
  Loader2,
  AlertCircle,
  Eye,
  Sliders,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/auth-context";
import {
  getAllEvents,
  getEventsByOrganiser,
  getEvent,
  updateEvent,
} from "@/lib/firestore";
import {
  getCustomFormByEvent,
  createCustomForm,
  updateCustomForm,
} from "@/lib/form-generator";

// Canonical default questions matching Image 3 & 4 from the reference
const DEFAULT_CUSTOM_QUESTIONS = [
  {
    id: "q_team_name",
    label: "Team Name",
    type: "text",
    required: true,
    placeholder: "e.g. Code Ninjas",
    options: [],
  },
  {
    id: "q_team_leader",
    label: "Team Leader Name",
    type: "text",
    required: true,
    placeholder: "Full name of team leader",
    options: [],
  },
  {
    id: "q_department",
    label: "Department",
    type: "select",
    required: true,
    placeholder: "Select your department",
    options: [
      "Civil Engineering",
      "Mechanical Engineering",
      "Electrical Engineering",
      "Electronics Engineering",
      "Computer Science & Engineering",
      "Information Technology",
      "Chemical Engineering",
      "Safety and Fire Engineering",
    ],
  },
  {
    id: "q_semester",
    label: "Semester",
    type: "select",
    required: true,
    placeholder: "Select semester",
    options: ["S2", "S4", "S6", "S8"],
  },
];

export function RegistrationStudio() {
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Top registration status pills (Image 5)
  const [registrationStatus, setRegistrationStatus] = useState("Open"); // "Open" | "Closed"
  const [groupRegistration, setGroupRegistration] = useState(false); // boolean

  // Ticket Tiers (Image 5)
  const [ticketTiers, setTicketTiers] = useState([
    {
      id: "tier_standard",
      name: "Standard",
      type: "Free",
      price: 0,
      capacity: 25,
      requireApproval: false,
      description: "General attendee event pass",
    },
  ]);

  // Modal: New Ticket Type (Image 5)
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [ticketForm, setTicketForm] = useState({
    name: "",
    description: "",
    showDescription: false,
    requireApproval: false,
    capacity: 25,
    priceType: "free", // "free" | "paid"
    priceAmount: 0,
    showRestrictions: false,
  });

  // Personal Information Configuration (Image 3 & 4)
  const [personalInfo, setPersonalInfo] = useState({
    nameMode: "Full Name", // "Full Name" | "First and Last Name"
    emailRequired: true,
    phoneMode: "Off", // "Off" | "Optional" | "Required"
  });

  // Web3 Identity Configuration (Image 3 & 4)
  const [web3Identity, setWeb3Identity] = useState({
    ethAddress: "Off", // "Off" | "Optional" | "Required"
    solAddress: "Off", // "Off" | "Optional" | "Required"
  });

  // Custom Questions List (Image 3 & 4)
  const [customQuestions, setCustomQuestions] = useState(DEFAULT_CUSTOM_QUESTIONS);

  // Modal: Add / Edit Question
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [editingQuestionIndex, setEditingQuestionIndex] = useState(null);
  const [questionForm, setQuestionForm] = useState({
    label: "",
    type: "text", // "text" | "select" | "checkbox" | "radio" | "textarea" | "file"
    required: true,
    placeholder: "",
    optionsStr: "",
  });

  // 1. Load organiser events
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

        const paramId = searchParams.get("eventId");
        let activeId = "";
        if (paramId && validList.some((e) => e.id === paramId)) {
          activeId = paramId;
        } else if (validList.length > 0) {
          activeId = validList[0].id;
        }

        setSelectedEventId(activeId);
      } catch (err) {
        console.error("Failed to load events for registration studio:", err);
        toast.error("Could not load events");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    initEvents();
    return () => {
      isMounted = false;
    };
  }, [user, searchParams]);

  // 2. Load active event details & custom form
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

        // Load registration status
        setRegistrationStatus(ev.registrationStatus || (ev.isActive !== false ? "Open" : "Closed"));
        setGroupRegistration(Boolean(ev.groupRegistration));

        // Load ticket tiers if present
        if (Array.isArray(ev.ticketTiers) && ev.ticketTiers.length > 0) {
          setTicketTiers(ev.ticketTiers);
        } else if (ev.price !== undefined || ev.ticketPrice !== undefined) {
          const pr = Number(ev.price ?? ev.ticketPrice ?? 0);
          setTicketTiers([
            {
              id: "tier_standard",
              name: ev.ticketTierName || "Standard",
              type: pr > 0 ? "Paid" : "Free",
              price: pr,
              capacity: Number(ev.capacity || ev.totalTickets || 25),
              requireApproval: false,
              description: "General attendee event pass",
            },
          ]);
        }

        // Load personal info configuration
        if (ev.personalInfoConfig) {
          setPersonalInfo({
            nameMode: ev.personalInfoConfig.nameMode || "Full Name",
            emailRequired: true,
            phoneMode: ev.personalInfoConfig.phoneMode || "Off",
          });
        }

        // Load web3 identity
        if (ev.web3Config) {
          setWeb3Identity({
            ethAddress: ev.web3Config.ethAddress || "Off",
            solAddress: ev.web3Config.solAddress || "Off",
          });
        }

        // Load custom questions
        if (Array.isArray(ev.customQuestions) && ev.customQuestions.length > 0) {
          setCustomQuestions(ev.customQuestions);
        } else {
          // Check if customForms collection has it
          const existingForm = await getCustomFormByEvent(selectedEventId);
          if (existingForm && Array.isArray(existingForm.fields)) {
            const mapped = existingForm.fields
              .filter((f) => !["fullName", "email", "name"].includes(f.id))
              .map((f) => ({
                id: f.id || `q_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                label: f.label || "Question",
                type: f.type || "text",
                required: Boolean(f.required),
                placeholder: f.placeholder || "",
                options: Array.isArray(f.options) ? f.options : [],
              }));
            if (mapped.length > 0) {
              setCustomQuestions(mapped);
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

  // ── SAVE HANDLER: Persists to Firestore and synchronizes with DynamicRegistrationForm ──
  const handleSaveAll = async () => {
    if (!selectedEventId) {
      toast.error("Please select an event first");
      return;
    }

    setIsSaving(true);
    try {
      // 1. Build unified fields list for public form rendering
      const compiledFields = [
        {
          id: "fullName",
          label: personalInfo.nameMode === "First and Last Name" ? "First & Last Name" : "Name",
          type: "text",
          required: true,
          placeholder: "Your full name",
        },
        {
          id: "email",
          label: "Email",
          type: "email",
          required: true,
          placeholder: "you@example.com",
        },
      ];

      if (personalInfo.phoneMode !== "Off") {
        compiledFields.push({
          id: "whatsappPhone",
          label: "Phone",
          type: "tel",
          required: personalInfo.phoneMode === "Required",
          placeholder: "Mobile number",
        });
      }

      if (web3Identity.ethAddress !== "Off") {
        compiledFields.push({
          id: "ethAddress",
          label: "ETH Address",
          type: "text",
          required: web3Identity.ethAddress === "Required",
          placeholder: "0x...",
        });
      }

      if (web3Identity.solAddress !== "Off") {
        compiledFields.push({
          id: "solAddress",
          label: "SOL Address",
          type: "text",
          required: web3Identity.solAddress === "Required",
          placeholder: "Solana wallet address",
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

      // 2. Update customForms collection
      const existing = await getCustomFormByEvent(selectedEventId);
      const formPayload = {
        title: `${event?.name || "Event"} Registration`,
        fields: compiledFields,
        status: "published",
        isPaid: ticketTiers.some((t) => t.price > 0),
        amount: ticketTiers.find((t) => t.price > 0)?.price || 0,
      };

      if (existing?.id) {
        await updateCustomForm(existing.id, formPayload);
      } else {
        await createCustomForm(selectedEventId, formPayload, "event");
      }

      // 3. Update the Event Document
      const totalEventCapacity = ticketTiers.reduce(
        (sum, t) => sum + (Number(t.capacity) || 0),
        0
      );

      await updateEvent(selectedEventId, {
        registrationStatus,
        isActive: registrationStatus === "Open",
        groupRegistration,
        ticketTiers,
        personalInfoConfig: personalInfo,
        web3Config: web3Identity,
        customQuestions,
        capacity: totalEventCapacity > 0 ? totalEventCapacity : event?.capacity || 50,
      });

      toast.success("Registration questions & tickets updated successfully!");
    } catch (err) {
      console.error("Failed to save registration settings:", err);
      toast.error("Failed to save registration settings");
    } finally {
      setIsSaving(false);
    }
  };

  // ── TICKET TIERS MANAGEMENT ──
  const handleOpenAddTicket = () => {
    setTicketForm({
      name: "",
      description: "",
      showDescription: false,
      requireApproval: false,
      capacity: 25,
      priceType: "free",
      priceAmount: 0,
      showRestrictions: false,
    });
    setShowTicketModal(true);
  };

  const handleCreateTicketType = () => {
    if (!ticketForm.name.trim()) {
      toast.error("Please enter a ticket name");
      return;
    }

    const newTier = {
      id: `tier_${Date.now()}`,
      name: ticketForm.name.trim(),
      description: ticketForm.showDescription ? ticketForm.description.trim() : "",
      requireApproval: ticketForm.requireApproval,
      type: ticketForm.priceType === "paid" ? "Paid" : "Free",
      price: ticketForm.priceType === "paid" ? Number(ticketForm.priceAmount || 0) : 0,
      capacity: Number(ticketForm.capacity || 25),
    };

    setTicketTiers((prev) => [...prev, newTier]);
    setShowTicketModal(false);
    toast.success(`Ticket tier "${newTier.name}" added`);
  };

  const handleDeleteTicket = (tierId) => {
    if (ticketTiers.length <= 1) {
      toast.info("Event must have at least one ticket tier");
      return;
    }
    setTicketTiers((prev) => prev.filter((t) => t.id !== tierId));
    toast.success("Ticket tier removed");
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
      toast.success("Question added");
    }

    setShowQuestionModal(false);
  };

  const handleDeleteQuestion = (index) => {
    setCustomQuestions((prev) => prev.filter((_, i) => i !== index));
    toast.success("Question deleted");
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
      <div className="py-20 flex flex-col items-center justify-center text-white min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#FE760B] mb-3" />
        <p className="text-xs text-[#9B9EA4]">Loading registration settings...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 select-none">
      {/* ── TOP SECTION: Status Pills & Action Bar (Matching Image 5) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#2A2D31]">
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
            <Users size={13} className={groupRegistration ? "text-[#A855F7]" : "text-[#9B9EA4]"} />
            <span>Group Registration:</span>
            <strong>{groupRegistration ? "On" : "Off"}</strong>
          </button>
        </div>

        {/* Global Save Button */}
        <button
          type="button"
          onClick={handleSaveAll}
          disabled={isSaving}
          className="px-5 py-2 rounded-xl bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer disabled:opacity-50 self-start sm:self-auto"
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin text-[#131517]" />
          ) : (
            <Save className="w-4 h-4 text-[#131517]" />
          )}
          <span>{isSaving ? "Saving..." : "Save Changes"}</span>
        </button>
      </div>

      {/* ── SECTION 1: TICKETS (Exact Image 5 Layout) ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
            Tickets
          </h2>
          <button
            type="button"
            onClick={handleOpenAddTicket}
            className="px-3.5 py-1.5 rounded-xl bg-[#212327] hover:bg-[#2A2D31] border border-[#2A2D31] text-xs font-semibold text-white flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus size={14} className="text-[#FE760B]" />
            <span>New Ticket Type</span>
          </button>
        </div>

        {/* Tickets List */}
        <div className="space-y-2">
          {ticketTiers.map((tier) => (
            <div
              key={tier.id}
              className="bg-[#1A1C1F] border border-[#2A2D31] hover:border-[#383C42] rounded-2xl p-4 flex items-center justify-between gap-4 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[#212327] border border-[#2A2D31] flex items-center justify-center text-[#FE760B] shrink-0">
                  <Ticket size={17} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-white truncate">{tier.name}</p>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-[#212327] border border-[#2A2D31] text-[#3DD68C]">
                      {tier.type === "Paid" ? `₹${tier.price}` : "Free"}
                    </span>
                    {tier.requireApproval && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-[#2A1830] text-[#A855F7] border border-[#A855F7]/30">
                        Approval Req
                      </span>
                    )}
                  </div>
                  {tier.description && (
                    <p className="text-xs text-[#9B9EA4] truncate mt-0.5">{tier.description}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs font-medium text-[#9B9EA4] flex items-center gap-1">
                  <Users size={13} className="text-[#9B9EA4]" />
                  <span>{tier.capacity || "Unlimited"}</span>
                </span>
                <button
                  type="button"
                  onClick={() => handleDeleteTicket(tier.id)}
                  className="p-1.5 text-[#9B9EA4] hover:text-[#FF6B6B] hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                  title="Remove ticket tier"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── SECTION 2: REGISTRATION QUESTIONS (Exact Images 3 & 4 Layout) ── */}
      <div className="space-y-6 pt-4 border-t border-[#2A2D31]">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
            Registration Questions
          </h2>
          <p className="text-xs text-[#9B9EA4] mt-0.5">
            We will ask guests the following questions when they register for the event.
          </p>
        </div>

        {/* ── GROUP 1: Personal Information (Image 3) ── */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-[#3DD68C] uppercase tracking-wider">
            <User size={14} className="text-[#3DD68C]" />
            <span>Personal Information</span>
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

            {/* Field: Email (Always Required) */}
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

        {/* ── GROUP 2: Web3 Identity (Image 3) ── */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-[#A855F7] uppercase tracking-wider">
            <Wallet size={14} className="text-[#A855F7]" />
            <span>Web3 Identity</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* ETH Address */}
            <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-xl p-3 flex items-center justify-between gap-2 shadow-sm">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-mono font-bold text-[#9B9EA4]">ETH</span>
                <span className="text-xs font-bold text-white truncate">ETH Address</span>
              </div>
              <select
                value={web3Identity.ethAddress}
                onChange={(e) =>
                  setWeb3Identity((prev) => ({ ...prev, ethAddress: e.target.value }))
                }
                className="bg-[#212327] border border-[#2A2D31] rounded-lg px-2.5 py-1 text-xs text-white font-medium outline-none cursor-pointer"
              >
                <option value="Off">Off</option>
                <option value="Optional">Optional</option>
                <option value="Required">Required</option>
              </select>
            </div>

            {/* SOL Address */}
            <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-xl p-3 flex items-center justify-between gap-2 shadow-sm">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-mono font-bold text-[#9B9EA4]">SOL</span>
                <span className="text-xs font-bold text-white truncate">SOL Address</span>
              </div>
              <select
                value={web3Identity.solAddress}
                onChange={(e) =>
                  setWeb3Identity((prev) => ({ ...prev, solAddress: e.target.value }))
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

        {/* ── GROUP 3: Custom Questions (Exact Images 3 & 4 Layout) ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-[#FE760B] uppercase tracking-wider">
              <HelpCircle size={14} className="text-[#FE760B]" />
              <span>Custom Questions</span>
            </div>
            <button
              type="button"
              onClick={handleOpenAddQuestion}
              className="px-3 py-1.5 rounded-xl bg-[#212327] hover:bg-[#2A2D31] border border-[#2A2D31] text-xs font-semibold text-white flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus size={13} className="text-[#FE760B]" />
              <span>Add Question</span>
            </button>
          </div>

          {/* Draggable Questions List */}
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
                  ? "Single Select"
                  : q.type === "checkbox"
                  ? "Multi-Select"
                  : q.type === "textarea"
                  ? "Long Text"
                  : q.type === "file"
                  ? "File Upload"
                  : "Text";

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
                      <GripVertical size={14} className="opacity-40" />
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

                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white truncate">{q.label}</p>
                      <p className="text-xs text-[#9B9EA4] truncate mt-0.5">
                        {optionsSummary ? (
                          <>
                            <span>{optionsSummary}</span>
                            <span className="mx-1.5">•</span>
                            <span>{typeBadge}</span>
                          </>
                        ) : (
                          <span>{typeBadge}</span>
                        )}
                        <span className="mx-1.5">•</span>
                        <span className={q.required ? "text-[#FE760B] font-semibold" : "text-[#9B9EA4]"}>
                          {q.required ? "Required" : "Optional"}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenEditQuestion(index)}
                      className="p-2 text-[#9B9EA4] hover:text-white hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
                      title="Edit question"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteQuestion(index)}
                      className="p-2 text-[#9B9EA4] hover:text-[#FF6B6B] hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
                      title="Delete question"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          MODAL: NEW TICKET TYPE (Matching Image 5 Exactly)
          ══════════════════════════════════════════════════ */}
      {showTicketModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-3xl bg-[#1A1C1F] border border-[#2A2D31] p-6 shadow-2xl relative space-y-5 animate-scale-in">
            {/* Top Close Button */}
            <button
              type="button"
              onClick={() => setShowTicketModal(false)}
              className="absolute top-5 right-5 p-1.5 text-[#9B9EA4] hover:text-white rounded-full bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>

            {/* Header: Ticket Icon & Title */}
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#212327] border border-[#2A2D31] flex items-center justify-center text-[#FE760B] mb-3">
                <Ticket size={24} />
              </div>
              <h3 className="text-xl font-bold text-white tracking-tight">New Ticket Type</h3>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              {/* Ticket Name Input */}
              <div>
                <label className="block text-xs font-semibold text-[#9B9EA4] uppercase tracking-wider mb-1.5">
                  Ticket Name
                </label>
                <input
                  type="text"
                  placeholder="Friends & Family"
                  value={ticketForm.name}
                  onChange={(e) =>
                    setTicketForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="w-full bg-[#131517] border border-[#2A2D31] focus:border-[#FE760B] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-[#64748B] outline-none transition-colors"
                />
              </div>

              {/* Add Description Toggle */}
              <div>
                {!ticketForm.showDescription ? (
                  <button
                    type="button"
                    onClick={() =>
                      setTicketForm((prev) => ({ ...prev, showDescription: true }))
                    }
                    className="text-xs font-semibold text-[#FE760B] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={13} />
                    <span>Add Description</span>
                  </button>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-[#9B9EA4] uppercase tracking-wider mb-1.5">
                      Description
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Details about what is included in this pass..."
                      value={ticketForm.description}
                      onChange={(e) =>
                        setTicketForm((prev) => ({ ...prev, description: e.target.value }))
                      }
                      className="w-full bg-[#131517] border border-[#2A2D31] focus:border-[#FE760B] rounded-xl p-3 text-xs text-white placeholder-[#64748B] outline-none resize-none transition-colors"
                    />
                  </div>
                )}
              </div>

              {/* Require Approval Switch */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#131517] border border-[#2A2D31]">
                <div>
                  <p className="text-xs font-bold text-white">Require Approval</p>
                  <p className="text-[11px] text-[#9B9EA4]">
                    Registrations must be accepted by host before ticket is issued
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setTicketForm((prev) => ({
                      ...prev,
                      requireApproval: !prev.requireApproval,
                    }))
                  }
                  className={`w-11 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer ${
                    ticketForm.requireApproval ? "bg-[#FE760B]" : "bg-[#2A2D31]"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      ticketForm.requireApproval ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Limits & Restrictions Row (Image 5) */}
              <div className="rounded-xl bg-[#131517] border border-[#2A2D31] overflow-hidden">
                <button
                  type="button"
                  onClick={() =>
                    setTicketForm((prev) => ({
                      ...prev,
                      showRestrictions: !prev.showRestrictions,
                    }))
                  }
                  className="w-full p-3.5 flex items-center justify-between text-left hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <div>
                    <p className="text-xs font-bold text-white">Limits &amp; Restrictions</p>
                    <p className="text-[11px] text-[#9B9EA4]">Sales time, capacity &amp; visibility</p>
                  </div>
                  <ChevronRight
                    size={16}
                    className={`text-[#9B9EA4] transition-transform ${
                      ticketForm.showRestrictions ? "rotate-90" : ""
                    }`}
                  />
                </button>

                {ticketForm.showRestrictions && (
                  <div className="p-3.5 pt-0 border-t border-[#2A2D31] space-y-3 mt-1">
                    <div className="grid grid-cols-2 gap-3 pt-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-[#9B9EA4] mb-1">
                          Capacity
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={ticketForm.capacity}
                          onChange={(e) =>
                            setTicketForm((prev) => ({
                              ...prev,
                              capacity: parseInt(e.target.value, 10) || 0,
                            }))
                          }
                          className="w-full bg-[#1A1C1F] border border-[#2A2D31] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-[#9B9EA4] mb-1">
                          Price (₹)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={ticketForm.priceAmount}
                          onChange={(e) =>
                            setTicketForm((prev) => ({
                              ...prev,
                              priceAmount: parseFloat(e.target.value) || 0,
                              priceType: parseFloat(e.target.value) > 0 ? "paid" : "free",
                            }))
                          }
                          className="w-full bg-[#1A1C1F] border border-[#2A2D31] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none"
                          placeholder="0 for Free"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Create Ticket Type Button (Image 5 White Button) */}
            <button
              type="button"
              onClick={handleCreateTicketType}
              className="w-full py-3 rounded-2xl bg-white hover:bg-slate-200 text-black font-bold text-sm transition-all shadow-xl cursor-pointer"
            >
              Create Ticket Type
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          MODAL: ADD / EDIT QUESTION
          ══════════════════════════════════════════════════ */}
      {showQuestionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-3xl bg-[#1A1C1F] border border-[#2A2D31] p-6 shadow-2xl relative space-y-5 animate-scale-in">
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
                  Question Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Department / Team Name"
                  value={questionForm.label}
                  onChange={(e) =>
                    setQuestionForm((prev) => ({ ...prev, label: e.target.value }))
                  }
                  className="w-full bg-[#131517] border border-[#2A2D31] focus:border-[#FE760B] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-[#64748B] outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#9B9EA4] uppercase tracking-wider mb-1.5">
                  Question Type
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

              <div className="flex items-center justify-between p-3 rounded-xl bg-[#131517] border border-[#2A2D31]">
                <div>
                  <p className="text-xs font-bold text-white">Required Field</p>
                  <p className="text-[11px] text-[#9B9EA4]">Attendees cannot submit without answering</p>
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
