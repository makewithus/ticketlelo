"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Building2,
  User,
  Shield,
  ShieldCheck,
  CreditCard,
  Zap,
  Sliders,
  Settings2,
  X,
  Check,
  Layers,
  Crown,
  Info,
  Calendar,
  Lock,
  ChevronRight,
  TrendingUp,
  Percent,
  Flame,
  ArrowRight,
  Plus,
  Mail,
  Phone,
  GraduationCap,
  ChevronDown,
  Loader2,
  FileText,
  Palette,
  Globe,
  Image as ImageIcon,
  Share2,
  BarChart3,
  Megaphone,
  Headphones,
  Banknote,
  Coins,
} from "lucide-react";
import { toast } from "sonner";
import { BrandLoader } from "@/components/ui/brand-loader";
import { SuperAdminTableSkeleton } from "@/components/ui/skeleton";
import { getCachedItem, setCachedItem } from "@/lib/client-cache";
import { StyledDropdown } from "@/components/ui/styled-dropdown";
import { auth } from "@/lib/firebase";

// Logical icons mapping per feature / facility
const FACILITY_ICONS = {
  paymentIntegration: CreditCard,
  customBranding: Palette,
  customSlug: Globe,
  bannerUpload: ImageIcon,
  socialLinks: Share2,
  analytics: BarChart3,
  broadcastMessaging: Megaphone,
  emailSupport: Mail,
  prioritySupport: Zap,
  dedicatedManager: Headphones,
  instantPayouts: Banknote,
};

// Color maps for plan tiers
const PLAN_COLORS = {
  free: {
    badge: "bg-slate-500/15 text-slate-300 border-slate-500/30",
    pill: "border-slate-500/40 text-slate-400 hover:text-white hover:border-slate-400",
    activePill: "bg-slate-700 text-white font-bold border-slate-500",
    border: "border-slate-700",
    glow: "bg-slate-500/5",
  },
  starter: {
    badge: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    pill: "border-blue-500/30 text-blue-400 hover:text-white hover:border-blue-400",
    activePill: "bg-blue-600 text-white font-bold border-blue-500 shadow-md shadow-blue-500/20",
    border: "border-blue-500/40",
    glow: "bg-blue-500/5",
  },
  pro: {
    badge: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    pill: "border-purple-500/30 text-purple-400 hover:text-white hover:border-purple-400",
    activePill: "bg-purple-600 text-white font-bold border-purple-500 shadow-md shadow-purple-500/20",
    border: "border-purple-500/40",
    glow: "bg-purple-500/5",
  },
  fest: {
    badge: "bg-[#FE760B]/15 text-[#FE760B] border-[#FE760B]/30",
    pill: "border-[#FE760B]/30 text-[#FE760B] hover:text-white hover:border-[#FE760B]",
    activePill: "bg-[#FE760B] text-black font-bold border-[#FE760B] shadow-md shadow-[#FE760B]/20",
    border: "border-[#FE760B]/50",
    glow: "bg-[#FE760B]/5",
  },
};

// Available Subscription Tiers metadata for provisioning
const AVAILABLE_TIERS = [
  {
    id: "free",
    name: "Free Tier",
    tag: "Trial",
    price: 0,
    priceDisplay: "Free",
    eventsAllowed: 1,
    attendeesDisplay: "300 Attendees / event",
    fee: "5.0%",
    badgeClass: "bg-slate-500/15 text-slate-300 border-slate-500/30",
    borderClass: "border-slate-700",
    icon: Shield,
    highlights: ["1 Event allowed", "300 Attendees max", "5.0% Platform Fee", "Standard ticketing features"],
  },
  {
    id: "starter",
    name: "Starter Plan",
    tag: "Popular",
    price: 999,
    priceDisplay: "₹999",
    eventsAllowed: 3,
    attendeesDisplay: "1,000 Attendees / event",
    fee: "4.5%",
    badgeClass: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    borderClass: "border-blue-500/40",
    icon: Zap,
    highlights: ["3 Events allowed", "1,000 Attendees max", "4.5% Platform Fee", "Custom branding & analytics"],
  },
  {
    id: "pro",
    name: "Pro (Campus)",
    tag: "Campus",
    price: 2499,
    priceDisplay: "₹2,499",
    eventsAllowed: 10,
    attendeesDisplay: "Unlimited Attendees",
    fee: "4.5%",
    badgeClass: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    borderClass: "border-purple-500/40",
    icon: GraduationCap,
    highlights: ["10 Events allowed", "Unlimited Attendees", "4.5% Platform Fee", "Custom domain & broadcast messaging"],
  },
  {
    id: "fest",
    name: "Fest (Enterprise)",
    tag: "Enterprise",
    price: 4999,
    priceDisplay: "₹4,999",
    eventsAllowed: -1,
    attendeesDisplay: "Unlimited Events & Attendees",
    fee: "3.5%",
    badgeClass: "bg-[#FE760B]/15 text-[#FE760B] border-[#FE760B]/30",
    borderClass: "border-[#FE760B]/50",
    icon: Crown,
    highlights: ["Unlimited Events & Attendees", "Lowest 3.5% Platform Fee", "Dedicated manager & instant payouts", "Priority support & full access"],
  },
];

export function SuperAdminPlansView() {
  // Synchronous cache hydration for instant display
  const [users, setUsers] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = getCachedItem("superadmin_plans_users");
        if (Array.isArray(cached) && cached.length > 0) return cached;
      } catch {}
    }
    return [];
  });
  const [loading, setLoading] = useState(() => users.length === 0);
  const [refreshing, setRefreshing] = useState(false);
  const [planCatalog, setPlanCatalog] = useState({});
  const [facilityDefs, setFacilityDefs] = useState([]);
  const [metrics, setMetrics] = useState({
    totalUsers: 0,
    freeCount: 0,
    starterCount: 0,
    proCount: 0,
    festCount: 0,
    paidCount: 0,
    limitReachedCount: 0,
    estimatedMRR: 0,
  });

  // Search & Filter controls
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlanFilter, setSelectedPlanFilter] = useState("all");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("all");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState("all");

  // Single-click operation loading tracking by userId
  const [updatingUserId, setUpdatingUserId] = useState(null);

  // Modals state
  const [editingUser, setEditingUser] = useState(null); // Edit Plan & Custom Facilities Modal
  const [viewingUserFacilities, setViewingUserFacilities] = useState(null); // View Facilities Modal
  const [revokingUser, setRevokingUser] = useState(null); // Revoke Plan Confirmation Modal
  const [showOnboardModal, setShowOnboardModal] = useState(false); // Onboard User Modal

  // Form states for Edit modal
  const [editFormData, setEditFormData] = useState({
    planId: "starter",
    eventsAllowed: 3,
    isUnlimitedEvents: false,
    participantsPerEvent: 1000,
    isUnlimitedParticipants: false,
    platformFeeRate: 4.5,
    facilities: {},
    auditReason: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // Form state for Onboard modal
  const [onboardForm, setOnboardForm] = useState({
    email: "",
    fullName: "",
    phone: "",
    college: "",
    role: "organiser",
    planId: "starter",
    auditReason: "",
  });
  const [submittingOnboard, setSubmittingOnboard] = useState(false);
  const [planDropdownOpen, setPlanDropdownOpen] = useState(false);
  const planDropdownRef = useRef(null);

  // Close plan dropdown on outside click
  useEffect(() => {
    if (!planDropdownOpen) return;
    function handleClickOutside(e) {
      if (planDropdownRef.current && !planDropdownRef.current.contains(e.target)) {
        setPlanDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [planDropdownOpen]);

  const availableTiers = useMemo(() => {
    return AVAILABLE_TIERS.map((tier) => {
      const catalogData = planCatalog[tier.id];
      if (!catalogData) return tier;
      return {
        ...tier,
        name: catalogData.name || tier.name,
        price: catalogData.price ?? tier.price,
        priceDisplay: catalogData.price === 0 ? "Free" : `₹${catalogData.price}`,
        fee: catalogData.platformFeeRate ? `${catalogData.platformFeeRate}%` : tier.fee,
        attendeesDisplay:
          catalogData.participantsPerEvent === -1 || catalogData.participantsPerEvent >= 99999
            ? "Unlimited Attendees"
            : `${catalogData.participantsPerEvent?.toLocaleString()} Attendees / event`,
        eventsAllowed: catalogData.eventsAllowed ?? tier.eventsAllowed,
      };
    });
  }, [planCatalog]);

  const selectedTier = useMemo(() => {
    return availableTiers.find((t) => t.id === onboardForm.planId) || availableTiers[1];
  }, [availableTiers, onboardForm.planId]);

  // Form state for Revoke modal
  const [revokeReason, setRevokeReason] = useState("");
  const [submittingRevoke, setSubmittingRevoke] = useState(false);

  // Helper for auth headers
  const getAuthHeaders = async () => {
    let headers = { "Content-Type": "application/json" };
    try {
      if (auth?.currentUser) {
        const token = await auth.currentUser.getIdToken();
        if (token) headers.Authorization = `Bearer ${token}`;
      }
    } catch (_) {}
    return headers;
  };

  // Fetch all users and plans from DB
  const fetchPlansData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/superadmin/plans", {
        headers,
        cache: "no-store",
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to load plans data");
      }

      const data = await res.json();
      if (data.success) {
        setUsers(data.users || []);
        if (Array.isArray(data.users)) {
          setCachedItem("superadmin_plans_users", data.users, 15 * 60 * 1000);
        }
        setPlanCatalog(data.planCatalog || {});
        setFacilityDefs(data.facilityDefinitions || []);
        setMetrics(
          data.metrics || {
            totalUsers: 0,
            freeCount: 0,
            starterCount: 0,
            proCount: 0,
            festCount: 0,
            paidCount: 0,
            limitReachedCount: 0,
            estimatedMRR: 0,
          },
        );
      }
    } catch (err) {
      toast.error(err.message || "Failed to load plans data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPlansData();
  }, []);

  // 1-Click Quick Plan Switcher
  const handleQuickPlanChange = async (user, targetPlanId) => {
    if (user.plan === targetPlanId) return; // already on this plan
    setUpdatingUserId(user.id);

    try {
      const headers = await getAuthHeaders();
      const targetPlanName = planCatalog[targetPlanId]?.name || targetPlanId;

      const res = await fetch("/api/superadmin/plans", {
        method: "POST",
        headers,
        body: JSON.stringify({
          userId: user.id,
          planId: targetPlanId,
          auditReason: `Instant 1-Click update to ${targetPlanName} tier`,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update plan");
      }

      const data = await res.json();
      toast.success(
        `Plan updated to ${targetPlanName}! All respective facilities allocated to ${user.name}.`,
      );

      // Optimistically update local state
      setUsers((prev) =>
        prev.map((u) => {
          if (u.id === user.id) {
            const planDef = planCatalog[targetPlanId] || {};
            return {
              ...u,
              plan: targetPlanId,
              planName: planDef.name || targetPlanId,
              subscriptionTier: planDef.tier || targetPlanId.toUpperCase(),
              price: planDef.price || 0,
              platformFeeRate: planDef.platformFeeRate || u.platformFeeRate,
              eventsAllowed: data.eventsAllowed ?? planDef.eventsAllowed ?? u.eventsAllowed,
              participantsPerEvent: data.participantsPerEvent ?? planDef.participantsPerEvent ?? u.participantsPerEvent,
              facilities: data.facilities || u.facilities,
              isLimitReached:
                planDef.eventsAllowed !== -1 && (u.eventsUsed || 0) >= (planDef.eventsAllowed || 1),
            };
          }
          return u;
        }),
      );

      // Refresh aggregate metrics quietly
      fetchPlansData(false);
    } catch (err) {
      toast.error(err.message || "Could not update plan");
    } finally {
      setUpdatingUserId(null);
    }
  };

  // Open Edit Plan Modal with current user data
  const handleOpenEditModal = (user) => {
    setEditingUser(user);
    const planDef = planCatalog[user.plan] || {};

    const eventsAllowed = typeof user.eventsAllowed === "number" ? user.eventsAllowed : planDef.eventsAllowed ?? 1;
    const participantsPerEvent = typeof user.participantsPerEvent === "number" ? user.participantsPerEvent : planDef.participantsPerEvent ?? 300;

    setEditFormData({
      planId: user.plan || "free",
      eventsAllowed: eventsAllowed === -1 ? 10 : eventsAllowed,
      isUnlimitedEvents: eventsAllowed === -1,
      participantsPerEvent: participantsPerEvent === -1 ? 1000 : participantsPerEvent,
      isUnlimitedParticipants: participantsPerEvent === -1,
      platformFeeRate: typeof user.platformFeeRate === "number" ? user.platformFeeRate : planDef.platformFeeRate ?? 5.0,
      facilities: { ...(user.facilities || {}) },
      auditReason: "",
    });
  };

  // When changing plan in the edit modal, synchronize default facilities and limits
  const handleModalPlanSelect = (newPlanId) => {
    const planDef = planCatalog[newPlanId] || {};
    const baseFacilities = {};
    facilityDefs.forEach((f) => {
      baseFacilities[f.key] = Boolean(planDef[f.key]);
    });

    setEditFormData((prev) => ({
      ...prev,
      planId: newPlanId,
      eventsAllowed: planDef.eventsAllowed === -1 ? 10 : planDef.eventsAllowed ?? 3,
      isUnlimitedEvents: planDef.eventsAllowed === -1,
      participantsPerEvent: planDef.participantsPerEvent === -1 ? 1000 : planDef.participantsPerEvent ?? 1000,
      isUnlimitedParticipants: planDef.participantsPerEvent === -1,
      platformFeeRate: planDef.platformFeeRate ?? 4.5,
      facilities: baseFacilities,
    }));
  };

  // Submit Edit Plan & Facilities
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    setSavingEdit(true);

    try {
      const headers = await getAuthHeaders();
      const eventsAllowed = editFormData.isUnlimitedEvents ? -1 : Number(editFormData.eventsAllowed);
      const participantsPerEvent = editFormData.isUnlimitedParticipants ? -1 : Number(editFormData.participantsPerEvent);
      const platformFeeRate = Number(editFormData.platformFeeRate);

      const res = await fetch("/api/superadmin/plans", {
        method: "POST",
        headers,
        body: JSON.stringify({
          userId: editingUser.id,
          planId: editFormData.planId,
          customOverrides: {
            eventsAllowed,
            participantsPerEvent,
            platformFeeRate,
            facilities: editFormData.facilities,
          },
          auditReason: editFormData.auditReason.trim() || `Configured ${editFormData.planId} plan and customized facilities`,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save plan changes");
      }

      toast.success(`Updated plan and facilities for ${editingUser.name}!`);
      setEditingUser(null);
      fetchPlansData(true);
    } catch (err) {
      toast.error(err.message || "Failed to save plan changes");
    } finally {
      setSavingEdit(false);
    }
  };

  // Submit Onboard User with Plan
  const handleOnboardSubmit = async (e) => {
    e.preventDefault();
    setSubmittingOnboard(true);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/superadmin/plans/onboard", {
        method: "POST",
        headers,
        body: JSON.stringify(onboardForm),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to onboard user with plan");
      }

      const data = await res.json();
      toast.success(data.message || "User successfully provisioned with plan!");
      setShowOnboardModal(false);
      setOnboardForm({
        email: "",
        fullName: "",
        phone: "",
        college: "",
        role: "organiser",
        planId: "starter",
        auditReason: "",
      });
      fetchPlansData(true);
    } catch (err) {
      toast.error(err.message || "Failed to onboard user");
    } finally {
      setSubmittingOnboard(false);
    }
  };

  // Submit Revoke Plan
  const handleRevokeSubmit = async () => {
    if (!revokingUser) return;
    setSubmittingRevoke(true);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/superadmin/plans", {
        method: "DELETE",
        headers,
        body: JSON.stringify({
          userId: revokingUser.id,
          auditReason: revokeReason.trim() || "Plan revoked by Super Admin",
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to revoke plan");
      }

      toast.success(`Plan revoked. ${revokingUser.name} has been reset to Free tier.`);
      setRevokingUser(null);
      setRevokeReason("");
      fetchPlansData(true);
    } catch (err) {
      toast.error(err.message || "Failed to revoke plan");
    } finally {
      setSubmittingRevoke(false);
    }
  };

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = (u.name || "").toLowerCase().includes(q);
        const matchesEmail = (u.email || "").toLowerCase().includes(q);
        const matchesPhone = (u.phone || "").toLowerCase().includes(q);
        const matchesCollege = (u.college || "").toLowerCase().includes(q);
        if (!matchesName && !matchesEmail && !matchesPhone && !matchesCollege) return false;
      }

      // Plan filter
      if (selectedPlanFilter !== "all" && u.plan !== selectedPlanFilter) {
        return false;
      }

      // Status filter
      if (selectedStatusFilter === "limit_reached" && !u.isLimitReached) return false;
      if (selectedStatusFilter === "paid" && u.plan === "free") return false;
      if (selectedStatusFilter === "free" && u.plan !== "free") return false;

      // Role filter
      if (selectedRoleFilter === "organiser" && u.role !== "organiser" && u.role !== "organizer") return false;
      if (selectedRoleFilter === "user" && (u.role === "organiser" || u.role === "organizer")) return false;

      return true;
    });
  }, [users, searchQuery, selectedPlanFilter, selectedStatusFilter, selectedRoleFilter]);

  if (loading && users.length === 0) {
    return <SuperAdminTableSkeleton />;
  }

  return (
    <div className="space-y-6 sm:space-y-8 pb-16">
      {/* ── 1. Top Section Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#FE760B]/12 border border-[#FE760B]/25 flex items-center justify-center text-[#FE760B] shrink-0">
              <Layers size={20} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                Subscription Plans & Facilities
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-[#9B9EA4]">
                Manage organizer subscription tiers, allocate platform facilities, and execute instant 1-click updates.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto">
          <button
            type="button"
            onClick={() => fetchPlansData(true)}
            disabled={refreshing}
            className="px-3.5 py-2 rounded-xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] text-xs font-semibold text-slate-700 dark:text-[#D0D0D1] hover:text-[#FE760B] transition-all flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin text-[#FE760B]" : ""} />
            <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowOnboardModal(true)}
            className="px-4 py-2 rounded-xl bg-[#FE760B] hover:bg-[#FF8A2B] text-black font-bold text-xs transition-all shadow-md shadow-[#FE760B]/20 flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={14} />
            <span>Assign Plan to User</span>
          </button>
        </div>
      </div>

      {/* ── 2. Top KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-[#9B9EA4] mb-1.5 text-xs font-medium">
            <span>Total Subscribers</span>
            <Building2 size={16} className="text-[#FE760B]" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight tabular-nums">
            {metrics.totalUsers}
          </div>
          <p className="text-[10px] text-slate-400 dark:text-[#71767B] mt-1">
            {metrics.paidCount} on paid tiers &bull; {metrics.freeCount} free
          </p>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-[#9B9EA4] mb-1.5 text-xs font-medium">
            <span>Starter Plan (Campus)</span>
            <Zap size={16} className="text-blue-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-blue-500 dark:text-blue-400 tracking-tight tabular-nums">
            {metrics.starterCount}
          </div>
          <p className="text-[10px] text-slate-400 dark:text-[#71767B] mt-1">₹999 / mo &bull; 4.5% fee</p>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-[#9B9EA4] mb-1.5 text-xs font-medium">
            <span>Pro & Fest Tiers</span>
            <Crown size={16} className="text-purple-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-purple-500 dark:text-purple-400 tracking-tight tabular-nums">
            {metrics.proCount + metrics.festCount}
          </div>
          <p className="text-[10px] text-slate-400 dark:text-[#71767B] mt-1">
            {metrics.proCount} Pro &bull; {metrics.festCount} Fest (Enterprise)
          </p>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-[#9B9EA4] mb-1.5 text-xs font-medium">
            <span>Limit Reached</span>
            <AlertTriangle size={16} className="text-amber-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-amber-500 dark:text-amber-400 tracking-tight tabular-nums">
            {metrics.limitReachedCount}
          </div>
          <p className="text-[10px] text-slate-400 dark:text-[#71767B] mt-1">
            Organizers eligible for instant upgrade
          </p>
        </div>
      </div>

      {/* ── 3. Plan Tier Catalog Showcase (Interactive Filter) ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-[#9B9EA4]">
            Platform Subscription Tiers & Facilities Catalog
          </h3>
          <span className="text-[11px] text-slate-400">
            Click any plan card below to filter organizers
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {Object.values(planCatalog).map((plan) => {
            const isSelected = selectedPlanFilter === plan.id;
            const colors = PLAN_COLORS[plan.id] || PLAN_COLORS.free;
            const userCount = metrics[`${plan.id}Count`] || 0;

            return (
              <div
                key={plan.id}
                onClick={() =>
                  setSelectedPlanFilter(isSelected ? "all" : plan.id)
                }
                className={`p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#17191C] border transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? `${colors.border} ring-2 ring-[#FE760B]/50 bg-white dark:bg-[#1A1C1F] shadow-lg`
                    : "border-slate-200 dark:border-[#2A2D31] hover:border-slate-300 dark:hover:border-[#383C42]"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${colors.badge}`}
                    >
                      {plan.name}
                    </span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                      {plan.price === 0 ? "Free" : `₹${plan.price}/mo`}
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 dark:text-[#D0D0D1] space-y-1.5 my-3">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Events Allowed:</span>
                      <strong className="text-slate-900 dark:text-white font-semibold">
                        {plan.eventsAllowed === -1 ? "Unlimited" : plan.eventsAllowed}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Attendees / Event:</span>
                      <strong className="text-slate-900 dark:text-white font-semibold">
                        {plan.participantsPerEvent === -1 ? "Unlimited" : plan.participantsPerEvent}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Platform Fee:</span>
                      <strong className="text-emerald-400 font-bold">{plan.platformFeeRate}%</strong>
                    </div>
                  </div>
                </div>

                <div className="pt-2.5 border-t border-slate-100 dark:border-[#2A2D31] flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">
                    <strong className="text-slate-900 dark:text-white font-semibold">{userCount}</strong> {userCount === 1 ? "user" : "users"} active
                  </span>
                  {isSelected ? (
                    <span className="text-[#FE760B] font-bold text-[10px] flex items-center gap-1">
                      Filtered <Check size={11} />
                    </span>
                  ) : (
                    <span className="text-[#71767B] text-[10px] hover:text-white transition-colors">
                      Filter
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 4. Search & Filters Bar ── */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#17191C] border border-slate-200 dark:border-[#2A2D31] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search
            size={15}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            placeholder="Search by organizer name, email, phone, or organization..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-[#131517] border border-slate-200 dark:border-[#2A2D31] text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#FE760B] transition-colors"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <StyledDropdown
            label="Plan"
            value={selectedPlanFilter}
            onChange={setSelectedPlanFilter}
            options={[
              { value: "all", label: "All Plans" },
              { value: "free", label: "Free Plan" },
              { value: "starter", label: "Starter Plan" },
              { value: "pro", label: "Pro (Campus)" },
              { value: "fest", label: "Fest (Enterprise)" },
            ]}
            buttonClassName="h-9 rounded-xl bg-slate-50 dark:bg-[#131517] border-slate-200 dark:border-[#2A2D31] text-xs font-semibold"
          />

          <StyledDropdown
            label="Status"
            value={selectedStatusFilter}
            onChange={setSelectedStatusFilter}
            options={[
              { value: "all", label: "All Statuses" },
              { value: "paid", label: "Paid Subscriptions" },
              { value: "free", label: "Free Tier Only" },
              { value: "limit_reached", label: "Event Limit Reached" },
            ]}
            buttonClassName="h-9 rounded-xl bg-slate-50 dark:bg-[#131517] border-slate-200 dark:border-[#2A2D31] text-xs font-semibold"
          />

          <StyledDropdown
            label="Role"
            value={selectedRoleFilter}
            onChange={setSelectedRoleFilter}
            options={[
              { value: "all", label: "All Roles" },
              { value: "organiser", label: "Organizers Only" },
              { value: "user", label: "Standard Users" },
            ]}
            buttonClassName="h-9 rounded-xl bg-slate-50 dark:bg-[#131517] border-slate-200 dark:border-[#2A2D31] text-xs font-semibold"
          />

          <span className="text-xs text-slate-500 dark:text-[#9B9EA4] font-medium px-2.5 py-1.5 bg-slate-100 dark:bg-[#131517] border border-slate-200 dark:border-[#2A2D31] rounded-xl whitespace-nowrap">
            <strong className="text-slate-900 dark:text-white font-semibold">{filteredUsers.length}</strong> {filteredUsers.length === 1 ? "organizer" : "organizers"}
          </span>
        </div>
      </div>

      {/* ── 5. User Plans Table (Desktop) ── */}
      <div className="hidden md:block rounded-2xl bg-white dark:bg-[#17191C] border border-slate-200 dark:border-[#2A2D31] shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse table-fixed">
            <colgroup>
              <col className="w-[28%]" />
              <col className="w-[14%]" />
              <col className="w-[14%]" />
              <col className="w-[16%]" />
              <col className="w-[18%]" />
              <col className="w-[10%]" />
            </colgroup>
            <thead>
              <tr className="bg-slate-50 dark:bg-[#1A1C1F] border-b border-slate-200 dark:border-[#2A2D31] text-slate-500 dark:text-[#9E9E9F] font-bold text-[11px] uppercase tracking-wider">
                <th className="py-3.5 px-4">Organizer / User</th>
                <th className="py-3.5 px-4">Current Plan</th>
                <th className="py-3.5 px-4">Event Usage</th>
                <th className="py-3.5 px-4">Facilities</th>
                <th className="py-3.5 px-4 text-center">1-Click Quick Plan Switch</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#2A2D31]/60">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 text-xs">
                    No organizers found matching your search and filter criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const colors = PLAN_COLORS[u.plan] || PLAN_COLORS.free;
                  const isUpdating = updatingUserId === u.id;
                  const eventsPercent =
                    u.eventsAllowed === -1
                      ? 100
                      : Math.min(100, Math.round(((u.eventsUsed || 0) / (u.eventsAllowed || 1)) * 100));

                  return (
                    <tr
                      key={u.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-[#212327]/40 transition-colors"
                    >
                      {/* Column 1: Organizer / User details */}
                      <td className="py-3.5 px-4 align-middle">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-[#FE760B]/12 border border-[#FE760B]/25 flex items-center justify-center text-[#FE760B] font-bold text-xs shrink-0 shadow-xs">
                            {(u.name || "O")[0].toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm truncate max-w-[170px]">
                                {u.name}
                              </span>
                              <span className="px-1.5 py-0.2 rounded text-[9px] uppercase font-bold bg-slate-100 dark:bg-[#212327] text-slate-500 border border-slate-200 dark:border-[#2A2D31]">
                                {u.role}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-[#9E9E9F] truncate">
                              {u.email} {u.phone ? `• ${u.phone}` : ""}
                            </div>
                            <div className="text-[10px] text-slate-400 dark:text-[#71767B] truncate">
                              {u.college || "General Organizer"}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Column 2: Current Plan Badge & Fee */}
                      <td className="py-3.5 px-4 align-middle">
                        <div className="space-y-1">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${colors.badge}`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            {u.planName || u.plan}
                          </span>
                          <div className="text-[11px] text-slate-500 dark:text-[#9E9E9F] font-medium">
                            {u.price === 0 ? "Free" : `₹${u.price}/mo`} &bull;{" "}
                            <span className="text-emerald-500 dark:text-emerald-400 font-semibold">
                              {u.platformFeeRate}% fee
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Column 3: Event Usage Progress */}
                      <td className="py-3.5 px-4 align-middle">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-700 dark:text-[#D0D0D1] font-semibold tabular-nums">
                              <strong>{u.eventsUsed || 0}</strong> /{" "}
                              {u.eventsAllowed === -1 ? "∞" : u.eventsAllowed}
                            </span>
                            {u.isLimitReached && (
                              <span className="px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-500 dark:text-amber-400 border border-amber-500/30 text-[9px] font-bold uppercase tracking-wider">
                                At Limit
                              </span>
                            )}
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-[#131517] overflow-hidden border border-slate-200 dark:border-[#2A2D31]/40">
                            <div
                              className={`h-full rounded-full transition-all ${
                                u.isLimitReached
                                  ? "bg-amber-400"
                                  : u.eventsAllowed === -1
                                  ? "bg-purple-500"
                                  : "bg-[#FE760B]"
                              }`}
                              style={{ width: `${eventsPercent}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Column 4: Facilities Details Chip */}
                      <td className="py-3.5 px-4 align-middle">
                        <button
                          type="button"
                          onClick={() => setViewingUserFacilities(u)}
                          className="group inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-[#212327] hover:bg-slate-200 dark:hover:bg-[#2A2D31] border border-slate-200 dark:border-[#2A2D31] transition-all text-left cursor-pointer w-full max-w-[170px]"
                          title="Click to view all allocated facilities"
                        >
                          <ShieldCheck size={14} className="text-[#FE760B] shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-semibold text-slate-800 dark:text-white group-hover:text-[#FE760B] transition-colors truncate">
                              {u.plan === "free" ? "Free Facilities" : "Platform Privileges"}
                            </div>
                            <div className="text-[10px] text-slate-400 dark:text-[#71767B] truncate">
                              {u.facilities?.paymentIntegration ? "Razorpay • Branding" : "Email Support"}
                            </div>
                          </div>
                        </button>
                      </td>

                      {/* Column 5: 1-Click Quick Plan Switcher */}
                      <td className="py-3.5 px-4 align-middle text-center">
                        <div className="inline-flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-[#131517] border border-slate-200 dark:border-[#2A2D31] shadow-inner gap-0.5">
                          {["free", "starter", "pro", "fest"].map((tierId) => {
                            const isCurrent = u.plan === tierId;
                            const tierLabel =
                              tierId === "free"
                                ? "Free"
                                : tierId === "starter"
                                ? "Start"
                                : tierId === "pro"
                                ? "Pro"
                                : "Fest";

                            return (
                              <button
                                key={tierId}
                                type="button"
                                disabled={isUpdating}
                                onClick={() => handleQuickPlanChange(u, tierId)}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                  isCurrent
                                    ? PLAN_COLORS[tierId].activePill
                                    : "text-slate-500 dark:text-[#71767B] hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-[#212327]"
                                } disabled:opacity-50`}
                                title={`1-Click update to ${tierLabel}`}
                              >
                                {isUpdating && isCurrent ? (
                                  <RefreshCw size={9} className="animate-spin inline" />
                                ) : (
                                  tierLabel
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </td>

                      {/* Column 6: Detailed Actions */}
                      <td className="py-3.5 px-4 align-middle text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(u)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-[#212327] hover:bg-slate-200 dark:hover:bg-[#2A2D31] text-slate-700 dark:text-[#D0D0D1] hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-[#2A2D31] text-[11px] font-semibold transition-colors cursor-pointer"
                            title="Customize limits and facilities"
                          >
                            Customize
                          </button>

                          {u.plan !== "free" && (
                            <button
                              type="button"
                              onClick={() => setRevokingUser(u)}
                              className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 dark:text-rose-400 border border-rose-500/25 transition-colors cursor-pointer"
                              title="Revoke paid plan (reset to Free)"
                            >
                              <XCircle size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 5B. Mobile Cards View (< md) ── */}
      <div className="block md:hidden space-y-3">
        {filteredUsers.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            No organizers found matching your criteria.
          </div>
        ) : (
          filteredUsers.map((u) => {
            const colors = PLAN_COLORS[u.plan] || PLAN_COLORS.free;
            const isUpdating = updatingUserId === u.id;

            return (
              <div
                key={u.id}
                className="p-4 rounded-2xl bg-white dark:bg-[#17191C] border border-slate-200 dark:border-[#2A2D31] shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 dark:text-white truncate">
                      {u.name}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-[#9E9E9F] truncate">
                      {u.email}
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border shrink-0 ${colors.badge}`}
                  >
                    {u.planName || u.plan}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] p-2.5 rounded-xl bg-slate-50 dark:bg-[#131517] border border-slate-200 dark:border-[#2A2D31]">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Event Usage</span>
                    <strong className="text-slate-900 dark:text-white font-semibold tabular-nums">
                      {u.eventsUsed || 0} / {u.eventsAllowed === -1 ? "Unlimited" : u.eventsAllowed}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Fee Rate</span>
                    <strong className="text-emerald-500 dark:text-emerald-400 font-bold tabular-nums">
                      {u.platformFeeRate}%
                    </strong>
                  </div>
                </div>

                {/* 1-Click Plan Switcher for Mobile */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    1-Click Plan Switch:
                  </span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {["free", "starter", "pro", "fest"].map((tierId) => {
                      const isCurrent = u.plan === tierId;
                      return (
                        <button
                          key={tierId}
                          type="button"
                          disabled={isUpdating}
                          onClick={() => handleQuickPlanChange(u, tierId)}
                          className={`py-1.5 rounded-lg text-[10px] font-bold transition-all text-center cursor-pointer ${
                            isCurrent
                              ? PLAN_COLORS[tierId].activePill
                              : "bg-slate-100 dark:bg-[#131517] border border-slate-200 dark:border-[#2A2D31] text-slate-500 dark:text-[#71767B]"
                          } disabled:opacity-50`}
                        >
                          {tierId.toUpperCase()}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Mobile Actions */}
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100 dark:border-[#2A2D31]">
                  <button
                    type="button"
                    onClick={() => setViewingUserFacilities(u)}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#212327] text-slate-700 dark:text-[#D0D0D1] border border-slate-200 dark:border-[#2A2D31] text-xs font-semibold"
                  >
                    Facilities
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(u)}
                    className="px-3 py-1.5 rounded-lg bg-[#FE760B]/10 text-[#FE760B] border border-[#FE760B]/25 text-xs font-semibold"
                  >
                    Customize
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── 6. MODAL 1: Edit Plan & Custom Facilities (Executive Admin Suite) ── */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto">
          <div className="w-full max-w-2xl bg-[#141619] border border-[#2A2D31] rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col text-white animate-scale-in">
            {/* Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-[#1A1C1F] to-[#16181B] border-b border-[#2A2D31] flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FE760B]/20 to-[#FE760B]/5 border border-[#FE760B]/30 flex items-center justify-center text-[#FE760B] shadow-inner shrink-0">
                  <Sliders size={20} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-bold text-white tracking-tight truncate">
                    Customize Plan & Facilities
                  </h3>
                  <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-[#9E9E9F] truncate mt-0.5">
                    <span>Configuring subscription privileges for</span>
                    <span className="font-semibold text-white">{editingUser.name}</span>
                    <span className="text-[10px] bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-slate-300 font-medium">
                      {editingUser.email}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="p-2 rounded-xl text-[#9E9E9F] hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
                aria-label="Close Modal"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Body */}
            <form onSubmit={handleSaveEdit} className="p-4 sm:p-6 space-y-5 overflow-y-auto text-xs custom-scrollbar">
              {/* Select Plan Tier */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-white uppercase tracking-wider">
                    Select Base Subscription Tier <span className="text-[#FE760B]">*</span>
                  </label>
                  <span className="text-[10px] text-[#9E9E9F]">
                    Click to load tier defaults
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {Object.values(planCatalog).map((p) => {
                    const isSelected = editFormData.planId === p.id;
                    const colors = PLAN_COLORS[p.id] || PLAN_COLORS.free;
                    const TierIcon =
                      p.id === "free"
                        ? Shield
                        : p.id === "starter"
                        ? Zap
                        : p.id === "pro"
                        ? GraduationCap
                        : Crown;

                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleModalPlanSelect(p.id)}
                        className={`relative p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? `${colors.border} bg-[#212327] ring-2 ring-[#FE760B] shadow-lg shadow-[#FE760B]/10`
                            : "border-[#2A2D31] bg-[#1A1C1F]/80 hover:bg-[#212327] hover:border-[#383C42]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1.5">
                          <span
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${colors.badge}`}
                          >
                            <TierIcon size={10} className="shrink-0" />
                            <span>{p.name}</span>
                          </span>
                          {isSelected && (
                            <span className="w-4 h-4 rounded-full bg-[#FE760B] text-black flex items-center justify-center shrink-0 shadow-sm">
                              <Check size={10} className="stroke-[3]" />
                            </span>
                          )}
                        </div>
                        <div className="text-white text-sm font-bold mt-0.5 tabular-nums">
                          {p.price === 0 ? "Free" : `₹${p.price.toLocaleString()}`}
                        </div>
                        <div className="text-[10px] text-emerald-400 mt-0.5 font-semibold">
                          {p.platformFeeRate}% fee
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Limits Configuration */}
              <div className="p-3.5 sm:p-4 rounded-xl bg-[#1A1C1F] border border-[#2A2D31] space-y-3">
                <div className="flex items-center justify-between border-b border-[#2A2D31]/70 pb-2">
                  <div className="flex items-center gap-2">
                    <Sliders size={14} className="text-[#FE760B]" />
                    <span className="text-[11px] font-bold text-white uppercase tracking-wider">
                      Usage Quotas & Rate Limits
                    </span>
                  </div>
                  <span className="text-[10px] text-[#9E9E9F]">
                    Fine-tune per-organizer allowances
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Events Allowed */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-semibold text-[#D0D0D1]">
                        Events Allowed
                      </label>
                      <label className="flex items-center gap-1.5 text-[10px] text-slate-300 hover:text-white cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={editFormData.isUnlimitedEvents}
                          onChange={(e) =>
                            setEditFormData({
                              ...editFormData,
                              isUnlimitedEvents: e.target.checked,
                            })
                          }
                          className="w-3.5 h-3.5 rounded accent-[#FE760B] cursor-pointer"
                        />
                        <span>Unlimited</span>
                      </label>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        disabled={editFormData.isUnlimitedEvents}
                        min="1"
                        max="1000"
                        value={editFormData.isUnlimitedEvents ? "" : editFormData.eventsAllowed}
                        placeholder={editFormData.isUnlimitedEvents ? "Unlimited (∞)" : "10"}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            eventsAllowed: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg bg-[#212327] border border-[#2A2D31] text-white disabled:opacity-50 text-xs focus:border-[#FE760B] focus:outline-none transition-colors"
                      />
                    </div>
                  </div>

                  {/* Attendees per Event */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-semibold text-[#D0D0D1]">
                        Attendees / Event
                      </label>
                      <label className="flex items-center gap-1.5 text-[10px] text-slate-300 hover:text-white cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={editFormData.isUnlimitedParticipants}
                          onChange={(e) =>
                            setEditFormData({
                              ...editFormData,
                              isUnlimitedParticipants: e.target.checked,
                            })
                          }
                          className="w-3.5 h-3.5 rounded accent-[#FE760B] cursor-pointer"
                        />
                        <span>Unlimited</span>
                      </label>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        disabled={editFormData.isUnlimitedParticipants}
                        min="1"
                        max="100000"
                        value={editFormData.isUnlimitedParticipants ? "" : editFormData.participantsPerEvent}
                        placeholder={editFormData.isUnlimitedParticipants ? "Unlimited (∞)" : "1000"}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            participantsPerEvent: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg bg-[#212327] border border-[#2A2D31] text-white disabled:opacity-50 text-xs focus:border-[#FE760B] focus:outline-none transition-colors"
                      />
                    </div>
                  </div>

                  {/* Platform Fee Rate % */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-semibold text-[#D0D0D1]">
                        Platform Fee Rate (%)
                      </label>
                      <span className="text-[10px] text-emerald-400 font-semibold">
                        Base: {planCatalog[editFormData.planId]?.platformFeeRate ?? 4.5}%
                      </span>
                    </div>
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={editFormData.platformFeeRate}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            platformFeeRate: e.target.value,
                          })
                        }
                        className="w-full pl-3 pr-7 py-2 rounded-lg bg-[#212327] border border-[#2A2D31] text-white text-xs focus:border-[#FE760B] focus:outline-none transition-colors"
                      />
                      <span className="absolute right-2.5 text-xs text-[#9E9E9F] pointer-events-none">
                        %
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Individual Facilities Toggle Checklist */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={14} className="text-[#FE760B]" />
                    <label className="text-xs font-bold text-white uppercase tracking-wider">
                      Granted Organizer Facilities & Permissions
                    </label>
                  </div>
                  <span className="text-[10px] text-[#9E9E9F]">
                    {Object.values(editFormData.facilities).filter(Boolean).length} / {facilityDefs.length} Active
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[250px] overflow-y-auto pr-1 custom-scrollbar">
                  {facilityDefs.map((facility) => {
                    const isEnabled = Boolean(editFormData.facilities[facility.key]);
                    const FacilityIcon = FACILITY_ICONS[facility.key] || ShieldCheck;

                    return (
                      <div
                        key={facility.key}
                        onClick={() =>
                          setEditFormData({
                            ...editFormData,
                            facilities: {
                              ...editFormData.facilities,
                              [facility.key]: !isEnabled,
                            },
                          })
                        }
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all select-none ${
                          isEnabled
                            ? "bg-[#FE760B]/[0.09] border-[#FE760B]/40 hover:bg-[#FE760B]/[0.14] text-white shadow-xs"
                            : "bg-[#1A1C1F] border-[#2A2D31] hover:bg-[#212327] hover:border-[#383C42] text-[#9E9E9F]"
                        }`}
                      >
                        {/* Facility Feature Icon */}
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border transition-all ${
                            isEnabled
                              ? "bg-[#FE760B]/20 border-[#FE760B]/35 text-[#FE760B] shadow-inner"
                              : "bg-[#212327] border-[#2A2D31] text-slate-400"
                          }`}
                        >
                          <FacilityIcon size={18} />
                        </div>

                        {/* Title and Description */}
                        <div className="min-w-0 flex-1">
                          <div className={`font-semibold text-xs leading-snug truncate ${isEnabled ? "text-white" : "text-slate-300"}`}>
                            {facility.label}
                          </div>
                          <div className="text-[10px] text-slate-400 line-clamp-1 mt-0.5 leading-tight">
                            {facility.description}
                          </div>
                        </div>

                        {/* Checkbox / Switch Indicator */}
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border transition-all ${
                            isEnabled
                              ? "bg-[#FE760B] border-[#FE760B] text-black shadow-xs"
                              : "border-[#383C42] bg-[#17191C]"
                          }`}
                        >
                          {isEnabled && <Check size={13} className="stroke-[3]" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Audit Reason */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-[#D0D0D1] mb-1.5">
                  <FileText size={13} className="text-[#FE760B]" />
                  <span>Audit Reason / Note <span className="text-[#FE760B]">*</span></span>
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Enter reason or notes for plan adjustment..."
                  value={editFormData.auditReason}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, auditReason: e.target.value })
                  }
                  className="w-full p-3 rounded-xl bg-[#1A1C1F] border border-[#2A2D31] text-white text-xs placeholder-[#5E626B] focus:outline-none focus:border-[#FE760B] focus:ring-1 focus:ring-[#FE760B]/30 transition-all resize-none"
                />
              </div>

              {/* Footer */}
              <div className="pt-3 border-t border-[#2A2D31] flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#212327] hover:bg-[#2A2D31] text-[#D0D0D1] hover:text-white transition-colors cursor-pointer text-center font-semibold text-xs sm:text-sm border border-[#2A2D31]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#FE760B] to-[#FF8A2B] hover:brightness-105 active:scale-[0.98] text-black font-bold transition-all disabled:opacity-50 cursor-pointer shadow-lg shadow-[#FE760B]/20 text-center text-xs sm:text-sm flex items-center justify-center gap-2"
                >
                  {savingEdit ? (
                    <>
                      <Loader2 size={15} className="animate-spin text-black" />
                      <span>Applying Changes...</span>
                    </>
                  ) : (
                    <>
                      <Check size={16} className="text-black stroke-[3]" />
                      <span>Save & Apply Facilities</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 7. MODAL 2: View Facilities Checklist (Exact Visual Style with Cross Icon) ── */}
      {viewingUserFacilities && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto">
          <div className="w-full max-w-lg bg-[#17191C] border border-[#2A2D31] rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col text-white animate-scale-in">
            {/* Header */}
            <div className="p-4 sm:p-5 bg-[#1A1C1F] border-b border-[#2A2D31] flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[#FE760B]/12 border border-[#FE760B]/25 flex items-center justify-center text-[#FE760B] shrink-0">
                  <ShieldCheck size={18} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-white truncate">
                    Granted Facilities & Permissions
                  </h3>
                  <p className="text-[11px] sm:text-xs text-[#9E9E9F] truncate">
                    {viewingUserFacilities.name} &bull; {viewingUserFacilities.planName || viewingUserFacilities.plan} Plan
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingUserFacilities(null)}
                className="p-2 rounded-lg text-[#9E9E9F] hover:text-white hover:bg-[#212327] transition-colors shrink-0 cursor-pointer"
                aria-label="Close Modal"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto text-xs">
              {/* Entitlement Summary Pill */}
              <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-[#212327] border border-[#2A2D31] text-center">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">
                    Events Limit
                  </span>
                  <span className="text-sm font-bold text-white tabular-nums">
                    {viewingUserFacilities.eventsAllowed === -1
                      ? "Unlimited"
                      : viewingUserFacilities.eventsAllowed}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">
                    Attendee Cap
                  </span>
                  <span className="text-sm font-bold text-white tabular-nums">
                    {viewingUserFacilities.participantsPerEvent === -1
                      ? "Unlimited"
                      : viewingUserFacilities.participantsPerEvent}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">
                    Platform Fee
                  </span>
                  <span className="text-sm font-bold text-emerald-400 tabular-nums">
                    {viewingUserFacilities.platformFeeRate}%
                  </span>
                </div>
              </div>

              {/* Complete Facilities List */}
              <div className="space-y-2">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Active Platform Capabilities
                </h4>
                <div className="space-y-1.5">
                  {facilityDefs.map((f) => {
                    const isGranted = Boolean(viewingUserFacilities.facilities?.[f.key]);
                    const FacilityIcon = FACILITY_ICONS[f.key] || ShieldCheck;

                    return (
                      <div
                        key={f.key}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                          isGranted
                            ? "bg-[#212327] border-emerald-500/30 text-white"
                            : "bg-[#17191C] border-[#2A2D31]/60 text-slate-500"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                              isGranted
                                ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                                : "bg-[#1A1C1F] border-[#2A2D31] text-slate-600"
                            }`}
                          >
                            <FacilityIcon size={16} />
                          </div>
                          <div className="min-w-0">
                            <div className={`font-semibold text-xs truncate ${isGranted ? "text-white" : "text-slate-500"}`}>
                              {f.label}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">{f.description}</div>
                          </div>
                        </div>

                        <span
                          className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                            isGranted
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                              : "bg-slate-800 text-slate-500 border border-slate-700"
                          }`}
                        >
                          {isGranted ? "Active" : "Locked"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 sm:p-5 bg-[#1A1C1F]/60 border-t border-[#2A2D31] flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setViewingUserFacilities(null)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#212327] hover:bg-[#2A2D31] text-[#D0D0D1] hover:text-white transition-colors cursor-pointer text-center font-semibold text-xs sm:text-sm"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const u = viewingUserFacilities;
                  setViewingUserFacilities(null);
                  handleOpenEditModal(u);
                }}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#FE760B] hover:bg-[#FF8A2B] text-black font-bold transition-all cursor-pointer text-center text-xs sm:text-sm"
              >
                Customize Facilities
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 8. MODAL 3: Assign Plan to User / Organiser (High-Fidelity Styled Form & Custom Dropdown) ── */}
      {showOnboardModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto">
          <div className="w-full max-w-lg bg-[#16181B] border border-[#2A2D31] rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col text-white animate-scale-in">
            {/* Header */}
            <div className="p-4 sm:p-5 bg-[#1A1C1F] border-b border-[#2A2D31] flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FE760B]/20 to-[#FE760B]/5 border border-[#FE760B]/30 flex items-center justify-center text-[#FE760B] shadow-inner shrink-0">
                  <Building2 size={20} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-white truncate">
                    Assign Plan to User / Organiser
                  </h3>
                  <p className="text-[11px] sm:text-xs text-[#9E9E9F] truncate">
                    Provision subscription privileges and facilities by email
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowOnboardModal(false);
                  setPlanDropdownOpen(false);
                }}
                className="p-2 rounded-lg text-[#9E9E9F] hover:text-white hover:bg-[#212327] transition-colors shrink-0 cursor-pointer"
                aria-label="Close Modal"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Body */}
            <form onSubmit={handleOnboardSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto custom-scrollbar text-xs flex-1">
              {/* User Email Address */}
              <div>
                <label className="block text-[#D0D0D1] font-semibold mb-1.5 text-[11px] sm:text-xs">
                  User Email Address <span className="text-[#FE760B]">*</span>
                </label>
                <div className="relative flex items-center group">
                  <div className="absolute left-3.5 pointer-events-none text-[#9E9E9F] group-focus-within:text-[#FE760B] transition-colors">
                    <Mail size={15} />
                  </div>
                  <input
                    type="email"
                    required
                    placeholder="Enter organizer email address"
                    value={onboardForm.email}
                    onChange={(e) => setOnboardForm({ ...onboardForm, email: e.target.value })}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[#212327] border border-[#2A2D31] text-white placeholder-[#5E626B] focus:outline-none focus:border-[#FE760B] focus:ring-1 focus:ring-[#FE760B]/30 transition-all text-xs sm:text-sm"
                  />
                </div>
              </div>

              {/* Full Name / Organizer Name */}
              <div>
                <label className="block text-[#D0D0D1] font-semibold mb-1.5 text-[11px] sm:text-xs">
                  Full Name / Organizer Name
                </label>
                <div className="relative flex items-center group">
                  <div className="absolute left-3.5 pointer-events-none text-[#9E9E9F] group-focus-within:text-[#FE760B] transition-colors">
                    <User size={15} />
                  </div>
                  <input
                    type="text"
                    placeholder="Enter organization or team name"
                    value={onboardForm.fullName}
                    onChange={(e) => setOnboardForm({ ...onboardForm, fullName: e.target.value })}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[#212327] border border-[#2A2D31] text-white placeholder-[#5E626B] focus:outline-none focus:border-[#FE760B] focus:ring-1 focus:ring-[#FE760B]/30 transition-all text-xs sm:text-sm"
                  />
                </div>
              </div>

              {/* Phone & College Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[#D0D0D1] font-semibold mb-1.5 text-[11px] sm:text-xs">
                    Phone Number
                  </label>
                  <div className="relative flex items-center group">
                    <div className="absolute left-3.5 pointer-events-none text-[#9E9E9F] group-focus-within:text-[#FE760B] transition-colors">
                      <Phone size={15} />
                    </div>
                    <input
                      type="tel"
                      placeholder="Enter contact number"
                      value={onboardForm.phone}
                      onChange={(e) => setOnboardForm({ ...onboardForm, phone: e.target.value })}
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[#212327] border border-[#2A2D31] text-white placeholder-[#5E626B] focus:outline-none focus:border-[#FE760B] focus:ring-1 focus:ring-[#FE760B]/30 transition-all text-xs sm:text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[#D0D0D1] font-semibold mb-1.5 text-[11px] sm:text-xs">
                    College / Organization
                  </label>
                  <div className="relative flex items-center group">
                    <div className="absolute left-3.5 pointer-events-none text-[#9E9E9F] group-focus-within:text-[#FE760B] transition-colors">
                      <GraduationCap size={15} />
                    </div>
                    <input
                      type="text"
                      placeholder="Enter institution or campus"
                      value={onboardForm.college}
                      onChange={(e) => setOnboardForm({ ...onboardForm, college: e.target.value })}
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[#212327] border border-[#2A2D31] text-white placeholder-[#5E626B] focus:outline-none focus:border-[#FE760B] focus:ring-1 focus:ring-[#FE760B]/30 transition-all text-xs sm:text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Initial Plan Tier — Custom Organized Dropdown */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-[#D0D0D1] font-semibold text-[11px] sm:text-xs">
                    Initial Plan Tier <span className="text-[#FE760B]">*</span>
                  </label>
                  <span className="text-[10px] text-[#9E9E9F]">
                    Base Platform Rate
                  </span>
                </div>

                <div className="relative" ref={planDropdownRef}>
                  {/* Trigger Button */}
                  <button
                    type="button"
                    onClick={() => setPlanDropdownOpen((prev) => !prev)}
                    className={`w-full p-3 rounded-xl bg-[#212327] hover:bg-[#26282E] border text-left transition-all flex items-center justify-between gap-3 cursor-pointer shadow-sm select-none ${
                      planDropdownOpen
                        ? "border-[#FE760B] ring-2 ring-[#FE760B]/20 bg-[#25282D]"
                        : "border-[#2A2D31] hover:border-[#3A3D42]"
                    }`}
                    aria-haspopup="listbox"
                    aria-expanded={planDropdownOpen}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {(() => {
                        const SelectedTierIcon = selectedTier.icon;
                        return (
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${selectedTier.badgeClass}`}
                          >
                            <SelectedTierIcon size={17} />
                          </div>
                        );
                      })()}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs sm:text-sm font-bold text-white truncate">
                            {selectedTier.name}
                          </span>
                          <span
                            className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded border ${selectedTier.badgeClass}`}
                          >
                            {selectedTier.tag}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#9E9E9F] truncate mt-0.5">
                          {selectedTier.attendeesDisplay} · <span className="text-emerald-400 font-semibold">{selectedTier.fee} fee</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="text-xs sm:text-sm font-bold text-white bg-[#1A1C1F] px-2.5 py-1 rounded-lg border border-[#2A2D31] tabular-nums">
                        {selectedTier.priceDisplay}
                      </span>
                      <ChevronDown
                        size={16}
                        className={`text-[#9E9E9F] transition-transform duration-200 ${
                          planDropdownOpen ? "rotate-180 text-[#FE760B]" : ""
                        }`}
                      />
                    </div>
                  </button>

                  {/* Dropdown Options Menu */}
                  {planDropdownOpen && (
                    <div
                      role="listbox"
                      className="absolute z-50 left-0 right-0 mt-2 p-1.5 rounded-2xl bg-[#1A1C1F] border border-[#2A2D31] shadow-2xl backdrop-blur-xl animate-in fade-in-0 zoom-in-95 duration-150 space-y-1 max-h-72 overflow-y-auto custom-scrollbar"
                    >
                      <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#71767B] border-b border-[#2A2D31]/60 mb-1 select-none flex items-center justify-between">
                        <span>Select Tier</span>
                        <span>Fee Rate</span>
                      </div>
                      {availableTiers.map((tier) => {
                        const isCurrent = onboardForm.planId === tier.id;
                        const TierIcon = tier.icon;
                        return (
                          <button
                            key={tier.id}
                            type="button"
                            role="option"
                            aria-selected={isCurrent}
                            onClick={() => {
                              setOnboardForm((prev) => ({ ...prev, planId: tier.id }));
                              setPlanDropdownOpen(false);
                            }}
                            className={`w-full p-2.5 rounded-xl text-left transition-all flex items-center justify-between gap-3 cursor-pointer group ${
                              isCurrent
                                ? "bg-[#FE760B]/12 border border-[#FE760B]/40 text-white shadow-sm"
                                : "hover:bg-[#25282D] border border-transparent text-[#D0D0D1] hover:text-white"
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${tier.badgeClass}`}
                              >
                                <TierIcon size={15} />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`text-xs font-bold truncate ${
                                      isCurrent ? "text-white" : "text-[#D0D0D1] group-hover:text-white"
                                    }`}
                                  >
                                    {tier.name}
                                  </span>
                                  <span
                                    className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded border ${tier.badgeClass}`}
                                  >
                                    {tier.tag}
                                  </span>
                                </div>
                                <p className="text-[10px] text-[#9E9E9F] truncate mt-0.5">
                                  {tier.eventsAllowed === -1 ? "Unlimited" : tier.eventsAllowed}{" "}
                                  {tier.eventsAllowed === 1 ? "Event" : "Events"} · {tier.attendeesDisplay} ·{" "}
                                  <span className="text-emerald-400 font-semibold">{tier.fee} fee</span>
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2.5 shrink-0">
                              <span className="text-xs font-bold text-white bg-[#131517] px-2 py-0.5 rounded-md border border-[#2A2D31] tabular-nums">
                                {tier.priceDisplay}
                              </span>
                              {isCurrent ? (
                                <div className="w-5 h-5 rounded-full bg-[#FE760B] flex items-center justify-center text-black">
                                  <Check size={12} strokeWidth={3} />
                                </div>
                              ) : (
                                <div className="w-5 h-5 rounded-full border border-[#2A2D31] group-hover:border-[#FE760B]/40" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Live Included Perks Summary Pill Card */}
                <div className="p-3 rounded-xl bg-[#1A1C1F] border border-[#2A2D31] space-y-2 mt-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-[#9E9E9F] flex items-center gap-1.5">
                      <ShieldCheck size={13} className="text-[#FE760B]" />
                      <span>Included Privileges ({selectedTier.name})</span>
                    </span>
                    <span className="text-emerald-400 font-bold text-[10px]">
                      {selectedTier.fee} Fee
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
                    {selectedTier.highlights.map((h, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-[#D0D0D1]">
                        <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
                        <span className="truncate">{h}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Audit Reason / Admin Note */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[#D0D0D1] font-semibold text-[11px] sm:text-xs">
                    Audit Reason / Note <span className="text-[#5E626B] font-normal">(Optional)</span>
                  </label>
                </div>
                <div className="relative flex items-start group">
                  <div className="absolute left-3.5 top-3 pointer-events-none text-[#9E9E9F] group-focus-within:text-[#FE760B] transition-colors">
                    <FileText size={15} />
                  </div>
                  <textarea
                    rows={2}
                    placeholder="Enter onboarding notes or instructions..."
                    value={onboardForm.auditReason}
                    onChange={(e) => setOnboardForm({ ...onboardForm, auditReason: e.target.value })}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[#212327] border border-[#2A2D31] text-white text-xs sm:text-sm placeholder-[#5E626B] focus:outline-none focus:border-[#FE760B] focus:ring-1 focus:ring-[#FE760B]/30 transition-all resize-none"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="pt-3 border-t border-[#2A2D31] flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setShowOnboardModal(false);
                    setPlanDropdownOpen(false);
                  }}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#212327] hover:bg-[#2A2D31] text-[#D0D0D1] hover:text-white transition-colors cursor-pointer text-center font-semibold text-xs sm:text-sm border border-[#2A2D31]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingOnboard}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#FE760B] to-[#FF8A2B] hover:brightness-105 active:scale-[0.98] text-black font-bold transition-all disabled:opacity-50 cursor-pointer shadow-lg shadow-[#FE760B]/20 text-center text-xs sm:text-sm flex items-center justify-center gap-2"
                >
                  {submittingOnboard ? (
                    <>
                      <Loader2 size={15} className="animate-spin text-black" />
                      <span>Provisioning Plan...</span>
                    </>
                  ) : (
                    <>
                      <Plus size={15} className="text-black stroke-[3]" />
                      <span>Provision Plan</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 9. MODAL 4: Revoke Plan Confirmation (Exact Visual Style with Cross Icon) ── */}
      {revokingUser && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto">
          <div className="w-full max-w-md bg-[#17191C] border border-[#2A2D31] rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col text-white animate-scale-in">
            {/* Header */}
            <div className="p-4 sm:p-5 bg-[#1A1C1F] border-b border-[#2A2D31] flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-rose-500/12 border border-rose-500/25 flex items-center justify-center text-rose-400 shrink-0">
                  <AlertTriangle size={18} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-white truncate">
                    Revoke Paid Plan
                  </h3>
                  <p className="text-[11px] sm:text-xs text-[#9E9E9F] truncate">
                    Reset {revokingUser.name} back to Free tier
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRevokingUser(null)}
                className="p-2 rounded-lg text-[#9E9E9F] hover:text-white hover:bg-[#212327] transition-colors shrink-0 cursor-pointer"
                aria-label="Close Modal"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto text-xs">
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs leading-relaxed">
                Revoking this plan will reset the organizer to the baseline Free tier (1 event allowed, 300 attendee cap, 5% fee rate) and lock premium facilities (custom branding, priority support, and broadcast messaging).
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#D0D0D1] mb-1">
                  Reason for Revocation <span className="text-[#FE760B]">*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Enter reason for revocation..."
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-[#212327] border border-[#2A2D31] text-white text-xs placeholder-[#9E9E9F] focus:outline-none focus:border-[#FE760B] resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 sm:p-5 bg-[#1A1C1F]/60 border-t border-[#2A2D31] flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setRevokingUser(null)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#212327] hover:bg-[#2A2D31] text-[#D0D0D1] hover:text-white transition-colors cursor-pointer text-center font-semibold text-xs sm:text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRevokeSubmit}
                disabled={submittingRevoke || !revokeReason.trim()}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold transition-all disabled:opacity-50 cursor-pointer text-center text-xs sm:text-sm shadow-lg shadow-rose-500/20"
              >
                {submittingRevoke ? "Revoking..." : "Confirm Revocation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
