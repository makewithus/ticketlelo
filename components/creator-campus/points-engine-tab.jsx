"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Sliders,
  Zap,
  History,
  Gift,
  Plus,
  Trash2,
  Edit3,
  Check,
  CheckCircle,
  X,
  AlertCircle,
  Clock,
  Search,
  Filter,
  Calculator,
  Layers,
  Sparkles,
  Ticket,
  Calendar,
  Tag,
  Info,
  Loader2,
  RefreshCw,
  Award,
  ArrowUpRight,
  Shield,
  HelpCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authFetch } from "@/lib/auth";

function formatLedgerTimestamp(raw) {
  if (!raw) return "Recent";
  try {
    if (typeof raw?.toDate === "function") {
      return raw.toDate().toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    if (typeof raw?._seconds === "number") {
      return new Date(raw._seconds * 1000).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    if (typeof raw?.seconds === "number") {
      return new Date(raw.seconds * 1000).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      return d.toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  } catch {}
  return "Recent";
}

export default function PointsEngineTab({
  programId,
  program,
  connectedEvents = [],
  ambassadors = [],
  pointsRules,
  setPointsRules,
  fetchProgram,
  rewards = [],
  loadingRewards = false,
  fetchRewards,
  setIsAddRewardModalOpen,
  isAdjustModalOpen,
  setIsAdjustModalOpen,
  adjustTargetAmb,
  setAdjustTargetAmb,
  adjustPoints,
  setAdjustPoints,
  adjustReason,
  setAdjustReason,
  adjusting,
  handleManualAdjust,
}) {
  // ── Sub-navigation: config | bonus | ledger | rewards ──
  const [pointsSubTab, setPointsSubTab] = useState("config");

  // ── Points Configuration Local State ──
  const [globalConfig, setGlobalConfig] = useState({
    freeRegistrationPoints: 10,
    freeEligible: true,
    paidType: "multiplier", // "multiplier" | "fixed"
    paidMultiplier: 2,
    paidRegistrationPoints: 20,
    paidEligible: true,
  });

  const [savingGlobal, setSavingGlobal] = useState(false);

  // Sync incoming pointsRules.global
  useEffect(() => {
    if (pointsRules?.global) {
      setGlobalConfig({
        freeRegistrationPoints: Number(pointsRules.global.freeRegistrationPoints ?? 10),
        freeEligible: pointsRules.global.freeEligible ?? true,
        paidType: pointsRules.global.paidType || "multiplier",
        paidMultiplier: Number(pointsRules.global.paidMultiplier ?? 2),
        paidRegistrationPoints: Number(pointsRules.global.paidRegistrationPoints ?? 20),
        paidEligible: pointsRules.global.paidEligible ?? true,
      });
    }
  }, [pointsRules?.global]);

  // ── Points Ledger State ──
  const [pointsLedger, setPointsLedger] = useState([]);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [ledgerFilter, setLedgerFilter] = useState({
    search: "",
    eventId: "",
    status: "",
    entryType: "",
  });
  const [inspectLedgerEntry, setInspectLedgerEntry] = useState(null);

  // ── Event Override Modal ──
  const [isEventOverrideModalOpen, setIsEventOverrideModalOpen] = useState(false);
  const [editingEventOverride, setEditingEventOverride] = useState({
    eventId: "",
    eventName: "",
    freeRegistrationPoints: 15,
    freeEligible: true,
    paidType: "multiplier",
    paidMultiplier: 2.5,
    paidRegistrationPoints: 30,
    paidEligible: true,
    isActive: true,
  });

  // ── Ticket Override Modal ──
  const [isTicketOverrideModalOpen, setIsTicketOverrideModalOpen] = useState(false);
  const [editingTicketOverride, setEditingTicketOverride] = useState({
    ticketKey: "",
    ticketId: "",
    ticketName: "",
    eventId: "*",
    eventName: "All Connected Events",
    points: 30,
    isCombo: false,
    isActive: true,
  });

  // ── Bonus Rule Modal ──
  const [isBonusRuleModalOpen, setIsBonusRuleModalOpen] = useState(false);
  const [editingBonusRule, setEditingBonusRule] = useState({
    id: "",
    name: "",
    description: "",
    bonusType: "milestone", // "milestone" | "early_bird" | "event_booster" | "ticket_booster" | "custom"
    bonusPoints: 50,
    milestoneThreshold: 10,
    startDate: "",
    endDate: "",
    applicableEvents: ["*"],
    applicableTickets: ["*"],
    applicableTo: "all", // "all" | "free_only" | "paid_only"
    isActive: true,
  });

  // ── Fetch Points Ledger ──
  const fetchPointsLedger = useCallback(async () => {
    if (!programId) return;
    setLoadingLedger(true);
    try {
      const params = new URLSearchParams();
      if (ledgerFilter.search) params.set("search", ledgerFilter.search);
      if (ledgerFilter.eventId) params.set("eventId", ledgerFilter.eventId);
      if (ledgerFilter.status) params.set("status", ledgerFilter.status);
      if (ledgerFilter.entryType) params.set("entryType", ledgerFilter.entryType);

      const res = await authFetch(`/api/organizer/programs/${programId}/points/ledger?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setPointsLedger(data.entries || []);
      }
    } catch (err) {
      console.error("Error loading points ledger:", err);
    } finally {
      setLoadingLedger(false);
    }
  }, [programId, ledgerFilter]);

  // Load ledger on tab switch or filter change
  useEffect(() => {
    if (pointsSubTab === "ledger") {
      fetchPointsLedger();
    }
  }, [pointsSubTab, fetchPointsLedger]);

  // ── Server Save Helper ──
  const saveRulesToServer = async (updatedRules) => {
    try {
      const res = await authFetch(`/api/organizer/programs/${programId}/points/rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedRules),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to update points rules");
      }
      const data = await res.json();
      if (data.rules) {
        setPointsRules(data.rules);
      }
      if (fetchProgram) fetchProgram();
      return true;
    } catch (err) {
      toast.error(err.message || "Could not save points rules");
      return false;
    }
  };

  // ── Global Rules Save ──
  const handleSaveGlobalConfig = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setSavingGlobal(true);
    try {
      const payload = {
        ...pointsRules,
        global: {
          freeRegistrationPoints: Number(globalConfig.freeRegistrationPoints || 10),
          freeEligible: globalConfig.freeEligible,
          paidType: globalConfig.paidType || "multiplier",
          paidMultiplier: Number(globalConfig.paidMultiplier || 2),
          paidRegistrationPoints: Number(globalConfig.paidRegistrationPoints || 20),
          paidEligible: globalConfig.paidEligible,
          ineligibleCategories: globalConfig.ineligibleCategories || [],
        },
      };
      const ok = await saveRulesToServer(payload);
      if (ok) {
        toast.success("Global scoring rules updated successfully!");
      }
    } finally {
      setSavingGlobal(false);
    }
  };

  // ── Event Overrides Handlers ──
  const openAddEventOverride = (presetEvent = null) => {
    const ev = presetEvent || connectedEvents[0] || null;
    const existing = ev && pointsRules.eventOverrides?.[ev.eventId || ev.id];
    setEditingEventOverride({
      eventId: ev ? (ev.eventId || ev.id) : "",
      eventName: ev ? (ev.eventName || ev.name || ev.title || "Event") : "",
      freeRegistrationPoints: existing?.freeRegistrationPoints ?? 15,
      freeEligible: existing?.freeEligible ?? true,
      paidType: existing?.paidType || "multiplier",
      paidMultiplier: existing?.paidMultiplier ?? 2.5,
      paidRegistrationPoints: existing?.paidRegistrationPoints ?? 30,
      paidEligible: existing?.paidEligible ?? true,
      isActive: existing?.isActive ?? true,
    });
    setIsEventOverrideModalOpen(true);
  };

  const handleSaveEventOverride = async (e) => {
    e.preventDefault();
    if (!editingEventOverride.eventId) {
      toast.error("Please select a connected event");
      return;
    }
    const updatedOverrides = {
      ...(pointsRules.eventOverrides || {}),
      [editingEventOverride.eventId]: {
        eventId: editingEventOverride.eventId,
        eventName: editingEventOverride.eventName || "Connected Event",
        freeRegistrationPoints: Number(editingEventOverride.freeRegistrationPoints || 10),
        freeEligible: editingEventOverride.freeEligible ?? true,
        paidType: editingEventOverride.paidType || "multiplier",
        paidMultiplier: Number(editingEventOverride.paidMultiplier || 2),
        paidRegistrationPoints: Number(editingEventOverride.paidRegistrationPoints || 20),
        paidEligible: editingEventOverride.paidEligible ?? true,
        isActive: editingEventOverride.isActive ?? true,
        updatedAt: new Date().toISOString(),
      },
    };
    const ok = await saveRulesToServer({
      ...pointsRules,
      eventOverrides: updatedOverrides,
    });
    if (ok) {
      toast.success(`Custom rule saved for ${editingEventOverride.eventName}`);
      setIsEventOverrideModalOpen(false);
    }
  };

  const handleRestoreEventDefaults = async (eventId, eventName) => {
    if (!confirm(`Restore global scoring defaults for ${eventName || "this event"}?`)) return;
    const updated = { ...(pointsRules.eventOverrides || {}) };
    delete updated[eventId];
    const ok = await saveRulesToServer({
      ...pointsRules,
      eventOverrides: updated,
    });
    if (ok) {
      toast.success(`Restored global defaults for ${eventName || "event"}`);
    }
  };

  const handleToggleEventOverride = async (eventId, currentStatus) => {
    const current = pointsRules.eventOverrides?.[eventId];
    if (!current) return;
    const updated = {
      ...(pointsRules.eventOverrides || {}),
      [eventId]: {
        ...current,
        isActive: !currentStatus,
      },
    };
    await saveRulesToServer({
      ...pointsRules,
      eventOverrides: updated,
    });
    toast.success(`Event override ${!currentStatus ? "enabled" : "disabled"}`);
  };

  // ── Ticket Overrides Handlers ──
  const openAddTicketOverride = (existingRule = null) => {
    if (existingRule) {
      setEditingTicketOverride({
        ticketKey: existingRule.id || existingRule.ticketId,
        ticketId: existingRule.ticketId || existingRule.id,
        ticketName: existingRule.ticketName || existingRule.ticketTitle || "Ticket Pass",
        eventId: existingRule.eventId || "*",
        eventName: existingRule.eventName || "All Connected Events",
        points: existingRule.points ?? 30,
        isCombo: Boolean(existingRule.isCombo),
        isActive: existingRule.isActive ?? true,
      });
    } else {
      setEditingTicketOverride({
        ticketKey: "",
        ticketId: "",
        ticketName: "",
        eventId: connectedEvents[0] ? (connectedEvents[0].eventId || connectedEvents[0].id) : "*",
        eventName: connectedEvents[0] ? (connectedEvents[0].eventName || connectedEvents[0].name || "Event") : "All Connected Events",
        points: 30,
        isCombo: false,
        isActive: true,
      });
    }
    setIsTicketOverrideModalOpen(true);
  };

  const handleSaveTicketOverride = async (e) => {
    e.preventDefault();
    if (!editingTicketOverride.ticketName?.trim()) {
      toast.error("Please enter a ticket or pass title");
      return;
    }
    const key =
      editingTicketOverride.ticketKey ||
      editingTicketOverride.ticketId ||
      `ticket_${Date.now()}`;
    const updated = {
      ...(pointsRules.ticketOverrides || {}),
      [key]: {
        id: key,
        ticketId: editingTicketOverride.ticketId || key,
        ticketName: editingTicketOverride.ticketName.trim(),
        eventId: editingTicketOverride.eventId || "*",
        eventName: editingTicketOverride.eventName || "All Connected Events",
        points: Number(editingTicketOverride.points || 0),
        isCombo: Boolean(editingTicketOverride.isCombo),
        isActive: editingTicketOverride.isActive ?? true,
        updatedAt: new Date().toISOString(),
      },
    };
    const ok = await saveRulesToServer({
      ...pointsRules,
      ticketOverrides: updated,
    });
    if (ok) {
      toast.success(`Ticket rule saved for ${editingTicketOverride.ticketName}`);
      setIsTicketOverrideModalOpen(false);
    }
  };

  const handleDeleteTicketOverride = async (ticketKey, ticketName) => {
    if (!confirm(`Delete ticket rule for ${ticketName || "this ticket"}?`)) return;
    const updated = { ...(pointsRules.ticketOverrides || {}) };
    delete updated[ticketKey];
    const ok = await saveRulesToServer({
      ...pointsRules,
      ticketOverrides: updated,
    });
    if (ok) {
      toast.success("Ticket override removed");
    }
  };

  const handleToggleTicketOverride = async (ticketKey, currentStatus) => {
    const current = pointsRules.ticketOverrides?.[ticketKey];
    if (!current) return;
    const updated = {
      ...(pointsRules.ticketOverrides || {}),
      [ticketKey]: {
        ...current,
        isActive: !currentStatus,
      },
    };
    await saveRulesToServer({
      ...pointsRules,
      ticketOverrides: updated,
    });
    toast.success(`Ticket rule ${!currentStatus ? "enabled" : "disabled"}`);
  };

  // ── Bonus & Milestone Rules Handlers ──
  const openAddBonusRule = (existingRule = null) => {
    if (existingRule) {
      setEditingBonusRule({
        id: existingRule.id || "",
        name: existingRule.name || "",
        description: existingRule.description || "",
        bonusType: existingRule.bonusType || (existingRule.milestoneThreshold ? "milestone" : "custom"),
        bonusPoints: Number(existingRule.bonusPoints || 50),
        milestoneThreshold: existingRule.milestoneThreshold || 10,
        startDate: existingRule.startDate || "",
        endDate: existingRule.endDate || "",
        applicableEvents: Array.isArray(existingRule.applicableEvents) ? existingRule.applicableEvents : ["*"],
        applicableTickets: Array.isArray(existingRule.applicableTickets) ? existingRule.applicableTickets : ["*"],
        applicableTo: existingRule.applicableTo || "all",
        isActive: existingRule.isActive ?? true,
      });
    } else {
      setEditingBonusRule({
        id: "",
        name: "",
        description: "",
        bonusType: "milestone",
        bonusPoints: 50,
        milestoneThreshold: 10,
        startDate: "",
        endDate: "",
        applicableEvents: ["*"],
        applicableTickets: ["*"],
        applicableTo: "all",
        isActive: true,
      });
    }
    setIsBonusRuleModalOpen(true);
  };

  const applyBonusTemplate = (template) => {
    setEditingBonusRule({
      id: "",
      name: template.name,
      description: template.description || "",
      bonusType: template.bonusType,
      bonusPoints: template.bonusPoints,
      milestoneThreshold: template.milestoneThreshold || null,
      startDate: template.startDate || "",
      endDate: template.endDate || "",
      applicableEvents: ["*"],
      applicableTickets: ["*"],
      applicableTo: template.applicableTo || "all",
      isActive: true,
    });
    setIsBonusRuleModalOpen(true);
  };

  const handleSaveBonusRule = async (e) => {
    e.preventDefault();
    if (!editingBonusRule.name?.trim()) {
      toast.error("Please enter a bonus rule name");
      return;
    }
    const ruleId = editingBonusRule.id || `bonus_${Date.now()}`;
    const ruleObj = {
      ...editingBonusRule,
      id: ruleId,
      name: editingBonusRule.name.trim(),
      bonusPoints: Number(editingBonusRule.bonusPoints || 0),
      milestoneThreshold:
        editingBonusRule.bonusType === "milestone" && editingBonusRule.milestoneThreshold
          ? Number(editingBonusRule.milestoneThreshold)
          : null,
      isActive: editingBonusRule.isActive ?? true,
      updatedAt: new Date().toISOString(),
    };
    const existing = Array.isArray(pointsRules.bonusRules) ? [...pointsRules.bonusRules] : [];
    const idx = existing.findIndex((r) => r.id === ruleId);
    if (idx >= 0) {
      existing[idx] = ruleObj;
    } else {
      existing.push(ruleObj);
    }
    const ok = await saveRulesToServer({
      ...pointsRules,
      bonusRules: existing,
    });
    if (ok) {
      toast.success(`Bonus rule "${editingBonusRule.name}" saved!`);
      setIsBonusRuleModalOpen(false);
    }
  };

  const handleDeleteBonusRule = async (ruleId, ruleName) => {
    if (!confirm(`Delete bonus rule "${ruleName || ruleId}"?`)) return;
    const existing = Array.isArray(pointsRules.bonusRules) ? [...pointsRules.bonusRules] : [];
    const filtered = existing.filter((r) => r.id !== ruleId);
    const ok = await saveRulesToServer({
      ...pointsRules,
      bonusRules: filtered,
    });
    if (ok) {
      toast.success("Bonus rule removed");
    }
  };

  const handleToggleBonusRule = async (ruleId, currentStatus) => {
    const existing = Array.isArray(pointsRules.bonusRules) ? [...pointsRules.bonusRules] : [];
    const updated = existing.map((r) => (r.id === ruleId ? { ...r, isActive: !currentStatus } : r));
    await saveRulesToServer({
      ...pointsRules,
      bonusRules: updated,
    });
    toast.success(`Bonus rule ${!currentStatus ? "enabled" : "disabled"}`);
  };

  // ── Metrics for Ledger Sub-tab ──
  const ledgerMetrics = useMemo(() => {
    const totalAwarded = pointsLedger.reduce((sum, e) => (e.status === "completed" ? sum + (e.totalPoints || 0) : sum), 0);
    const completedCount = pointsLedger.filter((e) => e.status === "completed").length;
    const reversalCount = pointsLedger.filter((e) => e.status === "reversed" || e.entryType === "reversal").length;
    const adjustmentCount = pointsLedger.filter((e) => e.entryType === "adjustment").length;
    return { totalAwarded, completedCount, reversalCount, adjustmentCount };
  }, [pointsLedger]);

  return (
    <div className="space-y-6 animate-fade-in text-slate-900 dark:text-white">
      {/* ── Sub-navigation Switcher ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-[#2A2D31]">
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] rounded-2xl">
          <button
            type="button"
            onClick={() => setPointsSubTab("config")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              pointsSubTab === "config"
                ? "bg-[#FE760B] text-[#131517] shadow-sm"
                : "text-slate-600 dark:text-[#9B9EA4] hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Points Configuration</span>
          </button>

          <button
            type="button"
            onClick={() => setPointsSubTab("bonus")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              pointsSubTab === "bonus"
                ? "bg-[#FE760B] text-[#131517] shadow-sm"
                : "text-slate-600 dark:text-[#9B9EA4] hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Bonus & Milestone Rules</span>
            {Array.isArray(pointsRules?.bonusRules) && pointsRules.bonusRules.length > 0 && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                  pointsSubTab === "bonus"
                    ? "bg-[#131517]/20 text-[#131517]"
                    : "bg-[#FE760B]/20 text-[#FE760B]"
                }`}
              >
                {pointsRules.bonusRules.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setPointsSubTab("ledger");
              fetchPointsLedger();
            }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              pointsSubTab === "ledger"
                ? "bg-[#FE760B] text-[#131517] shadow-sm"
                : "text-slate-600 dark:text-[#9B9EA4] hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Points Ledger & Audit</span>
            {pointsLedger.length > 0 && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                  pointsSubTab === "ledger"
                    ? "bg-[#131517]/20 text-[#131517]"
                    : "bg-[#FE760B]/15 text-[#FE760B]"
                }`}
              >
                {pointsLedger.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setPointsSubTab("rewards");
              if (fetchRewards) fetchRewards();
            }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              pointsSubTab === "rewards"
                ? "bg-[#FE760B] text-[#131517] shadow-sm"
                : "text-slate-600 dark:text-[#9B9EA4] hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Gift className="w-3.5 h-3.5" />
            <span>Rewards Catalog</span>
            {rewards.length > 0 && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                  pointsSubTab === "rewards"
                    ? "bg-[#131517]/20 text-[#131517]"
                    : "bg-emerald-500/20 text-emerald-400"
                }`}
              >
                {rewards.length}
              </span>
            )}
          </button>
        </div>

        {pointsSubTab === "ledger" && (
          <Button
            onClick={() => {
              setAdjustTargetAmb(ambassadors[0] || null);
              setAdjustPoints(10);
              setAdjustReason("");
              setIsAdjustModalOpen(true);
            }}
            className="bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-bold text-xs h-9 px-3.5 rounded-xl cursor-pointer shadow-xs gap-1.5"
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>Manual Adjustment</span>
          </Button>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════
          SUB-VIEW 1: POINTS CONFIGURATION (Global, Event, Ticket)
      ══════════════════════════════════════════════════════ */}
      {pointsSubTab === "config" && (
        <div className="space-y-6">
          {/* Rule Hierarchy Explainer Banner */}
          <div className="bg-gradient-to-r from-[#FE760B]/10 via-[#FE760B]/5 to-transparent border border-[#FE760B]/20 rounded-2xl p-4.5">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-[#FE760B]/15 text-[#FE760B] shrink-0">
                <Layers className="w-5 h-5" />
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-sm">
                  <span>3-Tier Base Points Priority Hierarchy</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#FE760B]/20 text-[#FE760B]">
                    Engine Rule Priority
                  </span>
                </div>
                <p className="text-slate-600 dark:text-[#9B9EA4] leading-relaxed">
                  Base points are strictly evaluated in priority order:{" "}
                  <strong className="text-[#FE760B] font-semibold">1. Ticket-Specific Rule (Highest)</strong> →{" "}
                  <strong className="text-amber-400 font-semibold">2. Event-Specific Rule</strong> →{" "}
                  <strong className="text-emerald-400 font-semibold">3. Global Program Default</strong>.
                  Only the highest-priority applicable base rule applies (base rules are never summed together).
                  Eligible milestone, time-based, and booster bonuses are calculated and awarded separately!
                </p>
              </div>
            </div>
          </div>

          {/* 1. Global Default Rules Card */}
          <div className="bg-white dark:bg-[#1A1C1F] rounded-2xl border border-slate-200 dark:border-[#2A2D31] p-5 sm:p-6 space-y-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#2A2D31]">
              <div className="space-y-0.5">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span>1. Global Program Default Rules</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-[#9B9EA4]">
                  Base points awarded for connected events when no event or ticket override exists.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Fallback Priority #3
              </span>
            </div>

            <form onSubmit={handleSaveGlobalConfig} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Free Registrations */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#212327] border border-slate-200 dark:border-[#2A2D31] space-y-3.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-900 dark:text-white">
                      Free Registrations
                    </label>
                    <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={globalConfig.freeEligible}
                        onChange={(e) => setGlobalConfig({ ...globalConfig, freeEligible: e.target.checked })}
                        className="rounded accent-[#FE760B] w-4 h-4 cursor-pointer"
                      />
                      <span className={globalConfig.freeEligible ? "text-emerald-400" : "text-slate-400"}>
                        {globalConfig.freeEligible ? "Eligible" : "Disabled"}
                      </span>
                    </label>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500 dark:text-[#9B9EA4] block mb-1">
                      Base Points Per Free Registration
                    </label>
                    <div className="relative">
                      <Input
                        type="number"
                        min="0"
                        disabled={!globalConfig.freeEligible}
                        value={globalConfig.freeRegistrationPoints}
                        onChange={(e) =>
                          setGlobalConfig({ ...globalConfig, freeRegistrationPoints: Number(e.target.value) })
                        }
                        className="bg-white dark:bg-[#1A1C1F] border-slate-200 dark:border-[#2A2D31] text-xs h-9 pr-12 font-bold"
                      />
                      <span className="absolute right-3 top-2.5 text-[11px] text-slate-400 font-mono">pts</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 dark:text-[#9B9EA4]">
                    Points awarded upon confirmed registration (default: 10 pts).
                  </p>
                </div>

                {/* Paid Tickets */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#212327] border border-slate-200 dark:border-[#2A2D31] space-y-3.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-900 dark:text-white">
                      Paid Ticket Registrations
                    </label>
                    <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={globalConfig.paidEligible}
                        onChange={(e) => setGlobalConfig({ ...globalConfig, paidEligible: e.target.checked })}
                        className="rounded accent-[#FE760B] w-4 h-4 cursor-pointer"
                      />
                      <span className={globalConfig.paidEligible ? "text-emerald-400" : "text-slate-400"}>
                        {globalConfig.paidEligible ? "Eligible" : "Disabled"}
                      </span>
                    </label>
                  </div>

                  <div className="flex items-center gap-2 p-1 bg-white dark:bg-[#1A1C1F] rounded-lg border border-slate-200 dark:border-[#2A2D31] text-xs">
                    <button
                      type="button"
                      onClick={() => setGlobalConfig({ ...globalConfig, paidType: "multiplier" })}
                      className={`flex-1 py-1 px-2 rounded-md font-semibold text-center transition-all cursor-pointer ${
                        globalConfig.paidType === "multiplier"
                          ? "bg-[#FE760B] text-[#131517]"
                          : "text-slate-500 dark:text-[#9B9EA4]"
                      }`}
                    >
                      Multiplier Mode
                    </button>
                    <button
                      type="button"
                      onClick={() => setGlobalConfig({ ...globalConfig, paidType: "fixed" })}
                      className={`flex-1 py-1 px-2 rounded-md font-semibold text-center transition-all cursor-pointer ${
                        globalConfig.paidType === "fixed"
                          ? "bg-[#FE760B] text-[#131517]"
                          : "text-slate-500 dark:text-[#9B9EA4]"
                      }`}
                    >
                      Fixed Points Mode
                    </button>
                  </div>

                  {globalConfig.paidType === "multiplier" ? (
                    <div>
                      <label className="text-[11px] font-semibold text-slate-500 dark:text-[#9B9EA4] block mb-1">
                        Paid Ticket Multiplier (Base Rate Multiplier)
                      </label>
                      <div className="relative">
                        <Input
                          type="number"
                          step="0.5"
                          min="0.5"
                          disabled={!globalConfig.paidEligible}
                          value={globalConfig.paidMultiplier}
                          onChange={(e) =>
                            setGlobalConfig({ ...globalConfig, paidMultiplier: Number(e.target.value) })
                          }
                          className="bg-white dark:bg-[#1A1C1F] border-slate-200 dark:border-[#2A2D31] text-xs h-9 pr-14 font-bold"
                        />
                        <span className="absolute right-3 top-2.5 text-[11px] text-slate-400 font-mono">x base</span>
                      </div>
                      <p className="text-[11px] text-slate-400 dark:text-[#9B9EA4] mt-1">
                        Yields:{" "}
                        <strong className="text-[#FE760B]">
                          {Math.round(globalConfig.paidMultiplier * globalConfig.freeRegistrationPoints)} pts
                        </strong>{" "}
                        per paid ticket (Free {globalConfig.freeRegistrationPoints} pts × {globalConfig.paidMultiplier}x).
                      </p>
                    </div>
                  ) : (
                    <div>
                      <label className="text-[11px] font-semibold text-slate-500 dark:text-[#9B9EA4] block mb-1">
                        Fixed Points Per Paid Ticket
                      </label>
                      <div className="relative">
                        <Input
                          type="number"
                          min="0"
                          disabled={!globalConfig.paidEligible}
                          value={globalConfig.paidRegistrationPoints}
                          onChange={(e) =>
                            setGlobalConfig({ ...globalConfig, paidRegistrationPoints: Number(e.target.value) })
                          }
                          className="bg-white dark:bg-[#1A1C1F] border-slate-200 dark:border-[#2A2D31] text-xs h-9 pr-12 font-bold"
                        />
                        <span className="absolute right-3 top-2.5 text-[11px] text-slate-400 font-mono">pts</span>
                      </div>
                      <p className="text-[11px] text-slate-400 dark:text-[#9B9EA4] mt-1">
                        Flat {globalConfig.paidRegistrationPoints} pts awarded per paid ticket upon payment capture.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end pt-2">
                <Button
                  type="submit"
                  disabled={savingGlobal}
                  className="bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-bold text-xs h-9.5 px-5 rounded-xl cursor-pointer shadow-md gap-2"
                >
                  {savingGlobal ? <Loader2 className="w-4 h-4 animate-spin text-[#131517]" /> : <Check className="w-4 h-4" />}
                  <span>Save Global Configuration</span>
                </Button>
              </div>
            </form>
          </div>

          {/* 2. Event-Specific Rules Card */}
          <div className="bg-white dark:bg-[#1A1C1F] rounded-2xl border border-slate-200 dark:border-[#2A2D31] p-5 sm:p-6 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-[#2A2D31]">
              <div className="space-y-0.5">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  <span>2. Event-Specific Scoring Rules</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-[#9B9EA4]">
                  Override scoring for individual connected events. Overrides take precedence over global defaults.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => openAddEventOverride()}
                  disabled={connectedEvents.length === 0}
                  className="bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-bold text-xs h-9 px-3.5 rounded-xl cursor-pointer shadow-xs gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Configure Event Override</span>
                </Button>
              </div>
            </div>

            {connectedEvents.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <Calendar className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-xs text-slate-500 dark:text-[#9B9EA4]">
                  No events connected to this program yet. Connect events in the Events tab to configure event overrides.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {connectedEvents.map((ev) => {
                  const evId = ev.eventId || ev.id;
                  const evName = ev.eventName || ev.name || ev.title || "Connected Event";
                  const override = pointsRules.eventOverrides?.[evId];
                  const hasCustom = Boolean(override);
                  const isActive = override?.isActive !== false;

                  return (
                    <div
                      key={evId}
                      className={`p-4 rounded-xl border transition-all ${
                        hasCustom && isActive
                          ? "bg-amber-500/10 border-amber-500/30"
                          : hasCustom && !isActive
                          ? "bg-slate-100 dark:bg-[#212327]/50 border-slate-300 dark:border-[#2A2D31] opacity-75"
                          : "bg-slate-50 dark:bg-[#212327] border-slate-200 dark:border-[#2A2D31]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1">
                              {evName}
                            </h4>
                            {hasCustom ? (
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  isActive
                                    ? "bg-amber-500/15 text-amber-400 border border-amber-500/25"
                                    : "bg-slate-500/15 text-slate-400 border border-slate-500/25"
                                }`}
                              >
                                {isActive ? "Custom Override Active" : "Override Disabled"}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/10 text-slate-400 border border-slate-500/20">
                                Using Global Default
                              </span>
                            )}
                          </div>

                          <div className="text-xs text-slate-500 dark:text-[#9B9EA4] space-y-0.5">
                            {hasCustom ? (
                              <div className="flex items-center gap-3 pt-1">
                                <span>
                                  Free:{" "}
                                  <strong className="text-slate-800 dark:text-white">
                                    {override.freeEligible ? `${override.freeRegistrationPoints} pts` : "Ineligible"}
                                  </strong>
                                </span>
                                <span>•</span>
                                <span>
                                  Paid:{" "}
                                  <strong className="text-slate-800 dark:text-white">
                                    {override.paidEligible
                                      ? override.paidType === "fixed"
                                        ? `${override.paidRegistrationPoints} pts`
                                        : `${override.paidMultiplier}x (${Math.round(
                                            override.paidMultiplier * override.freeRegistrationPoints
                                          )} pts)`
                                      : "Ineligible"}
                                  </strong>
                                </span>
                              </div>
                            ) : (
                              <p className="text-[11px] text-slate-400">
                                Free: {globalConfig.freeRegistrationPoints} pts • Paid:{" "}
                                {globalConfig.paidType === "fixed"
                                  ? `${globalConfig.paidRegistrationPoints} pts`
                                  : `${globalConfig.paidMultiplier}x base`}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => openAddEventOverride(ev)}
                            className="p-1.5 rounded-lg text-slate-600 dark:text-[#9B9EA4] hover:text-white hover:bg-slate-200 dark:hover:bg-[#2A2D31] transition-colors cursor-pointer"
                            title="Configure / Edit"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          {hasCustom && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleToggleEventOverride(evId, isActive)}
                                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                  isActive
                                    ? "text-emerald-400 hover:bg-emerald-500/10"
                                    : "text-slate-400 hover:bg-slate-500/10"
                                }`}
                                title={isActive ? "Disable Override" : "Enable Override"}
                              >
                                {isActive ? <CheckCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRestoreEventDefaults(evId, evName)}
                                className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                title="Restore Global Defaults"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. Ticket-Specific Rules Card */}
          <div className="bg-white dark:bg-[#1A1C1F] rounded-2xl border border-slate-200 dark:border-[#2A2D31] p-5 sm:p-6 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-[#2A2D31]">
              <div className="space-y-0.5">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#FE760B]"></span>
                  <span>3. Ticket-Specific Scoring Rules (Highest Priority)</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-[#9B9EA4]">
                  Configure exact points for individual ticket tiers (General, VIP, Combo, Full Fest Pass). Combo tickets have explicit scoring and do not duplicate across child events.
                </p>
              </div>
              <Button
                onClick={() => openAddTicketOverride()}
                className="bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-bold text-xs h-9 px-3.5 rounded-xl cursor-pointer shadow-xs gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Ticket Rule</span>
              </Button>
            </div>

            {Object.keys(pointsRules.ticketOverrides || {}).length === 0 ? (
              <div className="py-8 text-center space-y-2 border border-dashed border-slate-200 dark:border-[#2A2D31] rounded-xl">
                <Ticket className="w-8 h-8 text-[#FE760B]/70 mx-auto" />
                <h4 className="text-xs font-bold text-slate-700 dark:text-[#D0D0D1]">
                  No ticket-specific rules configured
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-[#9B9EA4] max-w-md mx-auto">
                  Add specific pass rules (e.g. VIP Pass = 30 pts, Combo Pass = 40 pts, Full Fest Pass = 50 pts) to award custom points for premium tiers.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {Object.entries(pointsRules.ticketOverrides || {}).map(([key, tRule]) => {
                  const isActive = tRule.isActive !== false;
                  return (
                    <div
                      key={key}
                      className={`p-4 rounded-xl border flex flex-col justify-between space-y-3 transition-all ${
                        isActive
                          ? "bg-slate-50 dark:bg-[#212327] border-slate-200 dark:border-[#2A2D31]"
                          : "bg-slate-100 dark:bg-[#212327]/50 border-slate-300 dark:border-[#2A2D31] opacity-75"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#FE760B]/15 text-[#FE760B] border border-[#FE760B]/25">
                            Priority #1 Override
                          </span>
                          <span className="text-base font-extrabold text-[#FE760B] tabular-nums">
                            {tRule.points} pts
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          {tRule.ticketName || tRule.ticketTitle || "Ticket Pass"}
                        </h4>
                        <div className="text-xs text-slate-500 dark:text-[#9B9EA4] mt-1 space-y-0.5">
                          <p>Event: {tRule.eventName || (tRule.eventId === "*" ? "All Events" : tRule.eventId)}</p>
                          {tRule.isCombo && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-md mt-1 border border-amber-500/20">
                              Combo / Fest Pass (Explicit Points)
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 dark:border-[#2A2D31]/80">
                        <span
                          className={`text-[10px] font-semibold ${
                            isActive ? "text-emerald-400" : "text-slate-400"
                          }`}
                        >
                          {isActive ? "Active Rule" : "Disabled"}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openAddTicketOverride(tRule)}
                            className="p-1 text-slate-500 hover:text-white transition-colors cursor-pointer"
                            title="Edit"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleTicketOverride(key, isActive)}
                            className="p-1 text-slate-500 hover:text-white transition-colors cursor-pointer"
                            title={isActive ? "Disable" : "Enable"}
                          >
                            {isActive ? <CheckCircle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTicketOverride(key, tRule.ticketName)}
                            className="p-1 text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          SUB-VIEW 2: BONUS & MILESTONE RULES
      ══════════════════════════════════════════════════════ */}
      {pointsSubTab === "bonus" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#1A1C1F] rounded-2xl border border-slate-200 dark:border-[#2A2D31] p-5 sm:p-6 space-y-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-[#2A2D31]">
              <div className="space-y-0.5">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#FE760B]" />
                  <span>Bonus & Milestone Rules Engine</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-[#9B9EA4]">
                  Award bonus points on top of base points for milestone targets, early bird periods, or promotional boosters. Milestones are uniquely awarded once per ambassador.
                </p>
              </div>
              <Button
                onClick={() => openAddBonusRule()}
                className="bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-bold text-xs h-9 px-4 rounded-xl cursor-pointer shadow-md gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Bonus Rule</span>
              </Button>
            </div>

            {/* Quick Presets Bar */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-600 dark:text-[#9B9EA4] uppercase tracking-wider block">
                Quick Preset Templates (Click to configure)
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    applyBonusTemplate({
                      name: "First 10 Referrals Milestone",
                      bonusType: "milestone",
                      bonusPoints: 50,
                      milestoneThreshold: 10,
                      description: "One-time bonus upon reaching 10 confirmed referrals",
                    })
                  }
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-[#212327] hover:bg-slate-200 dark:hover:bg-[#2A2D31] border border-slate-200 dark:border-[#2A2D31] cursor-pointer transition-all flex items-center gap-1.5"
                >
                  <Award className="w-3.5 h-3.5 text-amber-400" />
                  <span>First 10 Referrals (+50 pts)</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    applyBonusTemplate({
                      name: "First 25 Referrals Milestone",
                      bonusType: "milestone",
                      bonusPoints: 150,
                      milestoneThreshold: 25,
                      description: "One-time bonus upon reaching 25 confirmed referrals",
                    })
                  }
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-[#212327] hover:bg-slate-200 dark:hover:bg-[#2A2D31] border border-slate-200 dark:border-[#2A2D31] cursor-pointer transition-all flex items-center gap-1.5"
                >
                  <Award className="w-3.5 h-3.5 text-[#FE760B]" />
                  <span>First 25 Referrals (+150 pts)</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    applyBonusTemplate({
                      name: "First 50 Referrals Milestone",
                      bonusType: "milestone",
                      bonusPoints: 400,
                      milestoneThreshold: 50,
                      description: "Major milestone bonus upon reaching 50 confirmed referrals",
                    })
                  }
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-[#212327] hover:bg-slate-200 dark:hover:bg-[#2A2D31] border border-slate-200 dark:border-[#2A2D31] cursor-pointer transition-all flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#FE760B]" />
                  <span>First 50 Referrals (+400 pts)</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    applyBonusTemplate({
                      name: "Early Bird Referral Boost",
                      bonusType: "early_bird",
                      bonusPoints: 10,
                      description: "Extra points for registrations during early registration window",
                    })
                  }
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-[#212327] hover:bg-slate-200 dark:hover:bg-[#2A2D31] border border-slate-200 dark:border-[#2A2D31] cursor-pointer transition-all flex items-center gap-1.5"
                >
                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Early Bird Boost (+10 pts)</span>
                </button>
              </div>
            </div>

            {/* Configured Bonus Rules List */}
            {(!pointsRules?.bonusRules || pointsRules.bonusRules.length === 0) ? (
              <div className="py-10 text-center space-y-2 border border-dashed border-slate-200 dark:border-[#2A2D31] rounded-2xl">
                <Zap className="w-8 h-8 text-slate-400 mx-auto" />
                <h4 className="text-sm font-bold text-slate-700 dark:text-[#D0D0D1]">
                  No bonus rules active
                </h4>
                <p className="text-xs text-slate-500 dark:text-[#9B9EA4] max-w-sm mx-auto">
                  Click a quick preset above or &ldquo;Create Bonus Rule&rdquo; to set up milestones, early bird bonuses, or event-specific boosters.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(pointsRules?.bonusRules || []).map((bRule) => {
                  const isActive = bRule.isActive !== false;
                  return (
                    <div
                      key={bRule.id}
                      className={`p-4.5 rounded-2xl border flex flex-col justify-between space-y-3.5 transition-all shadow-xs ${
                        isActive
                          ? "bg-slate-50 dark:bg-[#212327] border-slate-200 dark:border-[#2A2D31]"
                          : "bg-slate-100 dark:bg-[#1A1C1F]/60 border-slate-200 dark:border-[#2A2D31] opacity-70"
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              bRule.bonusType === "milestone"
                                ? "bg-amber-500/15 text-amber-400 border border-amber-500/25"
                                : bRule.bonusType === "early_bird"
                                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
                                : "bg-[#FE760B]/15 text-[#FE760B] border border-[#FE760B]/25"
                            }`}
                          >
                            {bRule.bonusType || "Bonus"}
                          </span>
                          <span className="text-base font-extrabold text-[#FE760B] tabular-nums">
                            +{bRule.bonusPoints} pts
                          </span>
                        </div>

                        <div>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                            {bRule.name}
                          </h4>
                          {bRule.description && (
                            <p className="text-xs text-slate-500 dark:text-[#9B9EA4] mt-0.5">
                              {bRule.description}
                            </p>
                          )}
                        </div>

                        <div className="text-[11px] text-slate-500 dark:text-[#9B9EA4] space-y-1 pt-1 border-t border-slate-200/60 dark:border-[#2A2D31]">
                          {bRule.milestoneThreshold && (
                            <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-[#D0D0D1]">
                              <Award className="w-3.5 h-3.5 text-amber-400" />
                              <span>Threshold: {bRule.milestoneThreshold} referrals (Awarded once per ambassador)</span>
                            </div>
                          )}
                          {(bRule.startDate || bRule.endDate) && (
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-emerald-400" />
                              <span>
                                Valid: {bRule.startDate ? new Date(bRule.startDate).toLocaleDateString("en-IN") : "Start"}{" "}
                                - {bRule.endDate ? new Date(bRule.endDate).toLocaleDateString("en-IN") : "End"}
                              </span>
                            </div>
                          )}
                          {bRule.applicableTo && bRule.applicableTo !== "all" && (
                            <div>
                              Eligibility:{" "}
                              <strong className="text-slate-800 dark:text-white">
                                {bRule.applicableTo === "free_only" ? "Free Only" : "Paid Only"}
                              </strong>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2.5 border-t border-slate-200/60 dark:border-[#2A2D31]">
                        <span
                          className={`text-[10px] font-semibold ${
                            isActive ? "text-emerald-400" : "text-slate-400"
                          }`}
                        >
                          {isActive ? "Active Rule" : "Disabled"}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openAddBonusRule(bRule)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-[#2A2D31] transition-colors cursor-pointer"
                            title="Edit Rule"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleBonusRule(bRule.id, isActive)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-[#2A2D31] transition-colors cursor-pointer"
                            title={isActive ? "Disable" : "Enable"}
                          >
                            {isActive ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Clock className="w-4 h-4" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteBonusRule(bRule.id, bRule.name)}
                            className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Delete Rule"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          SUB-VIEW 3: POINTS LEDGER & AUDIT
      ══════════════════════════════════════════════════════ */}
      {pointsSubTab === "ledger" && (
        <div className="space-y-5">
          {/* Summary Stats Bar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] shadow-xs">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-[#9B9EA4]">Total Points Awarded</div>
              <div className="text-2xl font-extrabold text-[#FE760B] tabular-nums mt-1">
                {ledgerMetrics.totalAwarded.toLocaleString("en-IN")}
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] shadow-xs">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-[#9B9EA4]">Completed Awards</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums mt-1">
                {ledgerMetrics.completedCount}
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] shadow-xs">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-[#9B9EA4]">Manual Adjustments</div>
              <div className="text-2xl font-bold text-amber-400 tabular-nums mt-1">
                {ledgerMetrics.adjustmentCount}
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] shadow-xs">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-[#9B9EA4]">Reversals / Refunds</div>
              <div className="text-2xl font-bold text-rose-400 tabular-nums mt-1">
                {ledgerMetrics.reversalCount}
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white dark:bg-[#1A1C1F] rounded-2xl border border-slate-200 dark:border-[#2A2D31] p-4 space-y-3 shadow-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <Input
                  placeholder="Search ambassador, code, order..."
                  value={ledgerFilter.search}
                  onChange={(e) => setLedgerFilter({ ...ledgerFilter, search: e.target.value })}
                  className="pl-9 bg-slate-50 dark:bg-[#212327] border-slate-200 dark:border-[#2A2D31] text-xs h-9"
                />
              </div>

              <div>
                <select
                  value={ledgerFilter.eventId}
                  onChange={(e) => setLedgerFilter({ ...ledgerFilter, eventId: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-[#212327] border border-slate-200 dark:border-[#2A2D31] rounded-xl text-xs h-9 px-3 text-slate-700 dark:text-white"
                >
                  <option value="">All Connected Events</option>
                  {connectedEvents.map((ev) => (
                    <option key={ev.eventId || ev.id} value={ev.eventId || ev.id}>
                      {ev.eventName || ev.name || ev.title || "Event"}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={ledgerFilter.status}
                  onChange={(e) => setLedgerFilter({ ...ledgerFilter, status: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-[#212327] border border-slate-200 dark:border-[#2A2D31] rounded-xl text-xs h-9 px-3 text-slate-700 dark:text-white"
                >
                  <option value="">All Statuses</option>
                  <option value="completed">Completed</option>
                  <option value="reversed">Reversed</option>
                </select>
              </div>

              <div>
                <select
                  value={ledgerFilter.entryType}
                  onChange={(e) => setLedgerFilter({ ...ledgerFilter, entryType: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-[#212327] border border-slate-200 dark:border-[#2A2D31] rounded-xl text-xs h-9 px-3 text-slate-700 dark:text-white"
                >
                  <option value="">All Entry Types</option>
                  <option value="earn">Earned Points</option>
                  <option value="adjustment">Manual Adjustment</option>
                  <option value="reversal">Refund Reversal</option>
                </select>
              </div>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="bg-white dark:bg-[#1A1C1F] rounded-2xl border border-slate-200 dark:border-[#2A2D31] overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 dark:border-[#2A2D31] flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Complete Points Audit Ledger</span>
                <span className="text-xs text-slate-400 font-normal">({pointsLedger.length} records)</span>
              </h3>
              <button
                type="button"
                onClick={fetchPointsLedger}
                className="text-xs text-slate-500 hover:text-white flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingLedger ? "animate-spin" : ""}`} />
                <span>Refresh</span>
              </button>
            </div>

            {loadingLedger ? (
              <div className="py-12 flex justify-center items-center">
                <Loader2 className="w-6 h-6 animate-spin text-[#FE760B]" />
              </div>
            ) : pointsLedger.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <History className="w-8 h-8 text-slate-400 mx-auto" />
                <h4 className="text-sm font-bold text-slate-700 dark:text-[#D0D0D1]">
                  No ledger records match filters
                </h4>
                <p className="text-xs text-slate-500 dark:text-[#9B9EA4]">
                  Points will appear here as ambassadors refer attendees to connected events.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-[#212327] text-slate-500 dark:text-[#9B9EA4] uppercase tracking-wider text-[10px] font-bold border-b border-slate-200 dark:border-[#2A2D31]">
                    <tr>
                      <th className="py-3 px-4">Date & Time</th>
                      <th className="py-3 px-4">Ambassador</th>
                      <th className="py-3 px-4">Event & Pass</th>
                      <th className="py-3 px-3 text-right">Base Pts</th>
                      <th className="py-3 px-3 text-right">Bonus Pts</th>
                      <th className="py-3 px-4 text-right">Total Award</th>
                      <th className="py-3 px-3 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Calculation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#2A2D31]">
                    {pointsLedger.map((entry) => {
                      const dateStr = formatLedgerTimestamp(entry.createdAt);

                      return (
                        <tr
                          key={entry.id}
                          className="hover:bg-slate-50 dark:hover:bg-[#212327]/40 transition-colors"
                        >
                          <td className="py-3 px-4 text-slate-500 dark:text-[#9B9EA4] whitespace-nowrap">
                            {dateStr}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="font-bold text-slate-900 dark:text-white">
                              {entry.ambassadorName || "Ambassador"}
                            </div>
                            <div className="font-mono text-[11px] text-[#FE760B]">
                              {entry.referralCode || "—"}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-medium text-slate-800 dark:text-[#D0D0D1] line-clamp-1">
                              {entry.eventTitle || "Program Event"}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {entry.ticketType || "Standard Pass"}
                              {entry.isCombo && " • Combo"}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right tabular-nums font-semibold">
                            {entry.basePoints ?? 0}
                          </td>
                          <td className="py-3 px-3 text-right tabular-nums">
                            {entry.bonusPoints > 0 ? (
                              <span className="font-bold text-[#FE760B]">+{entry.bonusPoints}</span>
                            ) : (
                              <span className="text-slate-400">0</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right tabular-nums">
                            <span
                              className={`font-extrabold ${
                                entry.totalPoints < 0
                                  ? "text-rose-400"
                                  : entry.totalPoints > 0
                                  ? "text-[#FE760B]"
                                  : "text-slate-400"
                              }`}
                            >
                              {entry.totalPoints > 0 ? `+${entry.totalPoints}` : entry.totalPoints} pts
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                entry.status === "completed"
                                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                  : entry.status === "reversed"
                                  ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                  : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                              }`}
                            >
                              {entry.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setInspectLedgerEntry(entry)}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-[#212327] hover:bg-slate-200 dark:hover:bg-[#2A2D31] text-slate-700 dark:text-[#D0D0D1] hover:text-white transition-colors cursor-pointer inline-flex items-center gap-1 border border-slate-200 dark:border-[#2A2D31]"
                            >
                              <Calculator className="w-3 h-3 text-[#FE760B]" />
                              <span>Inspect</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          SUB-VIEW 4: REWARDS CATALOG
      ══════════════════════════════════════════════════════ */}
      {pointsSubTab === "rewards" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Rewards Catalog</h3>
              <p className="text-xs text-slate-500 dark:text-[#9B9EA4]">
                Incentives student ambassadors can claim using their accumulated points.
              </p>
            </div>
            <Button
              onClick={() => setIsAddRewardModalOpen(true)}
              className="bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-semibold text-xs h-9 px-3.5 rounded-xl cursor-pointer"
            >
              <Plus className="w-4 h-4 mr-1 text-[#131517]" />
              Add Reward
            </Button>
          </div>

          {loadingRewards ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-[#FE760B]" />
            </div>
          ) : rewards.length === 0 ? (
            <div className="bg-white dark:bg-[#1A1C1F] rounded-2xl border border-slate-200 dark:border-[#2A2D31] p-8 text-center space-y-2">
              <Gift className="w-8 h-8 text-slate-400 mx-auto" />
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">No rewards configured yet</h4>
              <p className="text-xs text-slate-500 dark:text-[#9B9EA4]">
                Add merchandise, VIP passes, certificates, or vouchers to motivate your campus ambassador team.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {rewards.map((rew) => (
                <div
                  key={rew.id}
                  className="bg-white dark:bg-[#1A1C1F] rounded-2xl border border-slate-200 dark:border-[#2A2D31] p-4 flex flex-col justify-between space-y-3 shadow-xs"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#FE760B]/10 text-[#FE760B] border border-[#FE760B]/20">
                        {rew.rewardType}
                      </span>
                      <span className="text-xs font-bold text-[#FE760B] tabular-nums">
                        {rew.pointsRequired} pts
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">{rew.title}</h4>
                    <p className="text-xs text-slate-500 dark:text-[#9B9EA4] mt-1 line-clamp-2">
                      {rew.description}
                    </p>
                  </div>

                  <div className="text-[11px] text-slate-400 dark:text-[#9B9EA4] pt-2 border-t border-slate-100 dark:border-[#2A2D31]">
                    Inventory: {rew.totalInventory === -1 ? "Unlimited" : `${rew.remainingInventory ?? rew.totalInventory} remaining`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          MODAL 1: CONFIGURE EVENT OVERRIDE
      ══════════════════════════════════════════════════════ */}
      {isEventOverrideModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsEventOverrideModalOpen(false);
          }}
        >
          <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl sm:rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl my-auto text-white animate-scale-in space-y-4">
            <div className="flex items-center justify-between border-b border-[#2A2D31] pb-3">
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">
                  Configure Event Override
                </h3>
                <p className="text-xs text-[#9B9EA4] mt-0.5">
                  Priority #2: Overrides global program rules for this event
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEventOverrideModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#9B9EA4] hover:text-white hover:bg-[#2A2D31] transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEventOverride} className="space-y-4">
              <div>
                <label className="text-[11px] font-semibold text-[#9B9EA4] uppercase tracking-wider block mb-1">
                  Connected Event *
                </label>
                <select
                  value={editingEventOverride.eventId}
                  onChange={(e) => {
                    const found = connectedEvents.find((ev) => (ev.eventId || ev.id) === e.target.value);
                    setEditingEventOverride({
                      ...editingEventOverride,
                      eventId: e.target.value,
                      eventName: found ? (found.eventName || found.name || found.title) : "Event",
                    });
                  }}
                  className="w-full bg-[#212327] border border-[#2A2D31] text-xs sm:text-sm text-white h-10 rounded-xl px-3 focus:border-[#FE760B]"
                >
                  {connectedEvents.map((ev) => (
                    <option key={ev.eventId || ev.id} value={ev.eventId || ev.id}>
                      {ev.eventName || ev.name || ev.title || "Event"}
                    </option>
                  ))}
                </select>
              </div>

              {/* Free override */}
              <div className="p-3.5 rounded-xl bg-[#212327] border border-[#2A2D31] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Free Registration Points</span>
                  <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingEventOverride.freeEligible}
                      onChange={(e) =>
                        setEditingEventOverride({ ...editingEventOverride, freeEligible: e.target.checked })
                      }
                      className="rounded accent-[#FE760B] w-3.5 h-3.5 cursor-pointer"
                    />
                    <span className={editingEventOverride.freeEligible ? "text-emerald-400" : "text-[#71767B]"}>
                      {editingEventOverride.freeEligible ? "Eligible" : "Ineligible"}
                    </span>
                  </label>
                </div>
                <Input
                  type="number"
                  min="0"
                  disabled={!editingEventOverride.freeEligible}
                  value={editingEventOverride.freeRegistrationPoints}
                  onChange={(e) =>
                    setEditingEventOverride({
                      ...editingEventOverride,
                      freeRegistrationPoints: Number(e.target.value),
                    })
                  }
                  className="bg-[#1A1C1F] border-[#2A2D31] text-xs h-9"
                  placeholder="e.g. 15"
                />
              </div>

              {/* Paid override */}
              <div className="p-3.5 rounded-xl bg-[#212327] border border-[#2A2D31] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Paid Registration Points</span>
                  <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingEventOverride.paidEligible}
                      onChange={(e) =>
                        setEditingEventOverride({ ...editingEventOverride, paidEligible: e.target.checked })
                      }
                      className="rounded accent-[#FE760B] w-3.5 h-3.5 cursor-pointer"
                    />
                    <span className={editingEventOverride.paidEligible ? "text-emerald-400" : "text-[#71767B]"}>
                      {editingEventOverride.paidEligible ? "Eligible" : "Ineligible"}
                    </span>
                  </label>
                </div>

                <div className="flex items-center gap-2 p-1 bg-[#1A1C1F] rounded-lg border border-[#2A2D31] text-xs">
                  <button
                    type="button"
                    onClick={() => setEditingEventOverride({ ...editingEventOverride, paidType: "multiplier" })}
                    className={`flex-1 py-1 rounded font-semibold text-center transition-all cursor-pointer ${
                      editingEventOverride.paidType === "multiplier"
                        ? "bg-[#FE760B] text-[#131517]"
                        : "text-[#9B9EA4]"
                    }`}
                  >
                    Multiplier
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingEventOverride({ ...editingEventOverride, paidType: "fixed" })}
                    className={`flex-1 py-1 rounded font-semibold text-center transition-all cursor-pointer ${
                      editingEventOverride.paidType === "fixed" ? "bg-[#FE760B] text-[#131517]" : "text-[#9B9EA4]"
                    }`}
                  >
                    Fixed Points
                  </button>
                </div>

                {editingEventOverride.paidType === "multiplier" ? (
                  <Input
                    type="number"
                    step="0.5"
                    min="0.5"
                    disabled={!editingEventOverride.paidEligible}
                    value={editingEventOverride.paidMultiplier}
                    onChange={(e) =>
                      setEditingEventOverride({
                        ...editingEventOverride,
                        paidMultiplier: Number(e.target.value),
                      })
                    }
                    className="bg-[#1A1C1F] border-[#2A2D31] text-xs h-9"
                    placeholder="e.g. 2.5"
                  />
                ) : (
                  <Input
                    type="number"
                    min="0"
                    disabled={!editingEventOverride.paidEligible}
                    value={editingEventOverride.paidRegistrationPoints}
                    onChange={(e) =>
                      setEditingEventOverride({
                        ...editingEventOverride,
                        paidRegistrationPoints: Number(e.target.value),
                      })
                    }
                    className="bg-[#1A1C1F] border-[#2A2D31] text-xs h-9"
                    placeholder="e.g. 30"
                  />
                )}
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingEventOverride.isActive}
                    onChange={(e) =>
                      setEditingEventOverride({ ...editingEventOverride, isActive: e.target.checked })
                    }
                    className="rounded accent-[#FE760B] w-4 h-4 cursor-pointer"
                  />
                  <span>Override Active</span>
                </label>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsEventOverrideModalOpen(false)}
                    className="h-9 px-3.5 rounded-xl bg-[#212327] hover:bg-[#2A2D31] text-[#D0D0D1] border-[#2A2D31] text-xs cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="h-9 px-4 rounded-xl bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-bold text-xs cursor-pointer"
                  >
                    Save Override
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          MODAL 2: CONFIGURE TICKET OVERRIDE
      ══════════════════════════════════════════════════════ */}
      {isTicketOverrideModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsTicketOverrideModalOpen(false);
          }}
        >
          <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl sm:rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl my-auto text-white animate-scale-in space-y-4">
            <div className="flex items-center justify-between border-b border-[#2A2D31] pb-3">
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">
                  Configure Ticket Scoring Rule
                </h3>
                <p className="text-xs text-[#9B9EA4] mt-0.5">
                  Priority #1: Overrides event and global rules for this ticket
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsTicketOverrideModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#9B9EA4] hover:text-white hover:bg-[#2A2D31] transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTicketOverride} className="space-y-4">
              <div>
                <label className="text-[11px] font-semibold text-[#9B9EA4] uppercase tracking-wider block mb-1">
                  Ticket / Pass Title * (e.g. General Pass, VIP Pass, Combo Pass)
                </label>
                <Input
                  required
                  placeholder="e.g. VIP Pass"
                  value={editingTicketOverride.ticketName}
                  onChange={(e) =>
                    setEditingTicketOverride({ ...editingTicketOverride, ticketName: e.target.value })
                  }
                  className="bg-[#212327] border-[#2A2D31] text-xs h-10 font-bold"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#9B9EA4] uppercase tracking-wider block mb-1">
                  Applicable Connected Event
                </label>
                <select
                  value={editingTicketOverride.eventId}
                  onChange={(e) => {
                    const val = e.target.value;
                    const ev = connectedEvents.find((c) => (c.eventId || c.id) === val);
                    setEditingTicketOverride({
                      ...editingTicketOverride,
                      eventId: val,
                      eventName: ev ? (ev.eventName || ev.name || ev.title) : "All Connected Events",
                    });
                  }}
                  className="w-full bg-[#212327] border border-[#2A2D31] text-xs sm:text-sm text-white h-10 rounded-xl px-3 focus:border-[#FE760B]"
                >
                  <option value="*">All Connected Events</option>
                  {connectedEvents.map((ev) => (
                    <option key={ev.eventId || ev.id} value={ev.eventId || ev.id}>
                      {ev.eventName || ev.name || ev.title || "Event"}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#9B9EA4] uppercase tracking-wider block mb-1">
                  Points Awarded per Ticket *
                </label>
                <Input
                  type="number"
                  min="0"
                  required
                  value={editingTicketOverride.points}
                  onChange={(e) =>
                    setEditingTicketOverride({ ...editingTicketOverride, points: Number(e.target.value) })
                  }
                  className="bg-[#212327] border-[#2A2D31] text-xs h-10 font-bold"
                  placeholder="e.g. 30"
                />
              </div>

              {/* Combo Pass flag */}
              <div className="p-3.5 rounded-xl bg-[#FE760B]/10 border border-[#FE760B]/25 space-y-1">
                <label className="flex items-center gap-2 text-xs font-bold text-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingTicketOverride.isCombo}
                    onChange={(e) =>
                      setEditingTicketOverride({ ...editingTicketOverride, isCombo: e.target.checked })
                    }
                    className="rounded accent-[#FE760B] w-4 h-4 cursor-pointer"
                  />
                  <span>Is Combo Pass / Multi-Event Pass</span>
                </label>
                <p className="text-[11px] text-[#9B9EA4]">
                  Combo tickets have an explicit scoring rule and will NOT duplicate across sub-events.
                </p>
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingTicketOverride.isActive}
                    onChange={(e) =>
                      setEditingTicketOverride({ ...editingTicketOverride, isActive: e.target.checked })
                    }
                    className="rounded accent-[#FE760B] w-4 h-4 cursor-pointer"
                  />
                  <span>Rule Active</span>
                </label>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsTicketOverrideModalOpen(false)}
                    className="h-9 px-3.5 rounded-xl bg-[#212327] hover:bg-[#2A2D31] text-[#D0D0D1] border-[#2A2D31] text-xs cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="h-9 px-4 rounded-xl bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-bold text-xs cursor-pointer"
                  >
                    Save Ticket Rule
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          MODAL 3: BONUS & MILESTONE RULE BUILDER
      ══════════════════════════════════════════════════════ */}
      {isBonusRuleModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsBonusRuleModalOpen(false);
          }}
        >
          <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl sm:rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl my-auto text-white animate-scale-in space-y-4">
            <div className="flex items-center justify-between border-b border-[#2A2D31] pb-3">
              <div>
                <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#FE760B]" />
                  <span>Bonus Rule Builder</span>
                </h3>
                <p className="text-xs text-[#9B9EA4] mt-0.5">
                  Configure custom bonuses for milestones, early bird periods, or boosters
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsBonusRuleModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#9B9EA4] hover:text-white hover:bg-[#2A2D31] transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBonusRule} className="space-y-4">
              <div>
                <label className="text-[11px] font-semibold text-[#9B9EA4] uppercase tracking-wider block mb-1">
                  Rule Name *
                </label>
                <Input
                  required
                  placeholder="e.g. First 10 Referrals Milestone"
                  value={editingBonusRule.name}
                  onChange={(e) => setEditingBonusRule({ ...editingBonusRule, name: e.target.value })}
                  className="bg-[#212327] border-[#2A2D31] text-xs h-10 font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-[#9B9EA4] uppercase tracking-wider block mb-1">
                    Bonus Type
                  </label>
                  <select
                    value={editingBonusRule.bonusType}
                    onChange={(e) => setEditingBonusRule({ ...editingBonusRule, bonusType: e.target.value })}
                    className="w-full bg-[#212327] border border-[#2A2D31] text-xs text-white h-10 rounded-xl px-3 focus:border-[#FE760B]"
                  >
                    <option value="milestone">Referral Milestone</option>
                    <option value="early_bird">Early Bird / Time-based</option>
                    <option value="event_booster">Event Booster</option>
                    <option value="ticket_booster">Ticket Booster</option>
                    <option value="custom">Custom Condition</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[#9B9EA4] uppercase tracking-wider block mb-1">
                    Bonus Points *
                  </label>
                  <div className="relative">
                    <Input
                      type="number"
                      min="1"
                      required
                      value={editingBonusRule.bonusPoints}
                      onChange={(e) =>
                        setEditingBonusRule({ ...editingBonusRule, bonusPoints: Number(e.target.value) })
                      }
                      className="bg-[#212327] border-[#2A2D31] text-xs h-10 pr-12 font-bold"
                      placeholder="e.g. 50"
                    />
                    <span className="absolute right-3 top-3 text-[11px] text-[#9B9EA4] font-mono">pts</span>
                  </div>
                </div>
              </div>

              {/* Conditional Inputs based on Bonus Type */}
              {editingBonusRule.bonusType === "milestone" && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-1.5">
                  <label className="text-xs font-bold text-white block">
                    Milestone Referral Threshold *
                  </label>
                  <Input
                    type="number"
                    min="1"
                    required
                    value={editingBonusRule.milestoneThreshold || 10}
                    onChange={(e) =>
                      setEditingBonusRule({
                        ...editingBonusRule,
                        milestoneThreshold: Number(e.target.value),
                      })
                    }
                    className="bg-[#1A1C1F] border-[#2A2D31] text-xs h-9 font-bold"
                    placeholder="e.g. 10 (Awarded on 10th referral)"
                  />
                  <p className="text-[11px] text-[#9B9EA4]">
                    Enforced once per ambassador: prevents this milestone from ever being duplicate-awarded to the same ambassador.
                  </p>
                </div>
              )}

              {editingBonusRule.bonusType === "early_bird" && (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 space-y-2">
                  <div className="text-xs font-bold text-white">Early Bird Time Window</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-[#9B9EA4] block mb-0.5">Start Date</label>
                      <Input
                        type="date"
                        value={editingBonusRule.startDate}
                        onChange={(e) => setEditingBonusRule({ ...editingBonusRule, startDate: e.target.value })}
                        className="bg-[#1A1C1F] border-[#2A2D31] text-xs h-9"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-[#9B9EA4] block mb-0.5">End Date</label>
                      <Input
                        type="date"
                        value={editingBonusRule.endDate}
                        onChange={(e) => setEditingBonusRule({ ...editingBonusRule, endDate: e.target.value })}
                        className="bg-[#1A1C1F] border-[#2A2D31] text-xs h-9"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="text-[11px] font-semibold text-[#9B9EA4] uppercase tracking-wider block mb-1">
                  Registration Eligibility
                </label>
                <select
                  value={editingBonusRule.applicableTo}
                  onChange={(e) => setEditingBonusRule({ ...editingBonusRule, applicableTo: e.target.value })}
                  className="w-full bg-[#212327] border border-[#2A2D31] text-xs text-white h-10 rounded-xl px-3 focus:border-[#FE760B]"
                >
                  <option value="all">All Registrations (Free & Paid)</option>
                  <option value="free_only">Free Registrations Only</option>
                  <option value="paid_only">Paid Ticket Registrations Only</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#9B9EA4] uppercase tracking-wider block mb-1">
                  Description / Note (Optional)
                </label>
                <Input
                  placeholder="e.g. Awarded on achieving initial 10 verified registrations"
                  value={editingBonusRule.description}
                  onChange={(e) => setEditingBonusRule({ ...editingBonusRule, description: e.target.value })}
                  className="bg-[#212327] border-[#2A2D31] text-xs h-9"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingBonusRule.isActive}
                    onChange={(e) => setEditingBonusRule({ ...editingBonusRule, isActive: e.target.checked })}
                    className="rounded accent-[#FE760B] w-4 h-4 cursor-pointer"
                  />
                  <span>Active Rule</span>
                </label>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsBonusRuleModalOpen(false)}
                    className="h-9 px-3.5 rounded-xl bg-[#212327] hover:bg-[#2A2D31] text-[#D0D0D1] border-[#2A2D31] text-xs cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="h-9 px-4 rounded-xl bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-bold text-xs cursor-pointer"
                  >
                    Save Rule
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          MODAL 4: CALCULATION INSPECTOR MODAL
      ══════════════════════════════════════════════════════ */}
      {inspectLedgerEntry && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setInspectLedgerEntry(null);
          }}
        >
          <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl sm:rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl my-auto text-white animate-scale-in space-y-4">
            <div className="flex items-center justify-between border-b border-[#2A2D31] pb-3">
              <div>
                <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-[#FE760B]" />
                  <span>Calculation Inspector</span>
                </h3>
                <p className="text-xs text-[#9B9EA4] mt-0.5">
                  Mathematical proof & rule evaluation for entry #{inspectLedgerEntry.id?.slice(-8)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectLedgerEntry(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#9B9EA4] hover:text-white hover:bg-[#2A2D31] transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* Transaction Summary Card */}
              <div className="p-3.5 rounded-xl bg-[#212327] border border-[#2A2D31] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[#9B9EA4]">Ambassador:</span>
                  <strong className="text-white">
                    {inspectLedgerEntry.ambassadorName} ({inspectLedgerEntry.referralCode})
                  </strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#9B9EA4]">Event / Ticket:</span>
                  <span className="text-white font-medium">
                    {inspectLedgerEntry.eventTitle || "Program Event"} • {inspectLedgerEntry.ticketType || "Standard Pass"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#9B9EA4]">Timestamp:</span>
                  <span className="text-[#D0D0D1]">
                    {formatLedgerTimestamp(inspectLedgerEntry.createdAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#9B9EA4]">Status:</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      inspectLedgerEntry.status === "completed"
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-rose-500/15 text-rose-400"
                    }`}
                  >
                    {inspectLedgerEntry.status}
                  </span>
                </div>
              </div>

              {/* Step-by-Step Calculation Formula */}
              <div className="p-4 rounded-xl bg-[#212327] border border-[#2A2D31] space-y-3">
                <div className="font-bold text-white text-xs flex items-center justify-between">
                  <span>Step-by-Step Mathematical Derivation</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] uppercase font-mono font-bold bg-[#FE760B]/15 text-[#FE760B]">
                    Tier: {inspectLedgerEntry.appliedRule?.level || "Global"}
                  </span>
                </div>

                {/* Base Rule */}
                <div className="p-3 rounded-lg bg-[#1A1C1F] border border-[#2A2D31] space-y-1">
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-slate-300">
                      1. Base Rule ({inspectLedgerEntry.appliedRule?.level?.toUpperCase() || "GLOBAL"} TIER)
                    </span>
                    <span className="text-white font-mono font-bold">
                      {inspectLedgerEntry.basePoints} pts
                    </span>
                  </div>
                  <p className="text-[11px] text-[#9B9EA4]">
                    Rule: {inspectLedgerEntry.appliedRule?.name || "Global Program Default"}
                    {inspectLedgerEntry.appliedRule?.rate !== undefined && (
                      <span> @ {inspectLedgerEntry.appliedRule.rate} pts/ticket</span>
                    )}
                  </p>
                </div>

                {/* Bonus Breakdown */}
                <div className="p-3 rounded-lg bg-[#1A1C1F] border border-[#2A2D31] space-y-1">
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-amber-300">2. Bonus Points Engine</span>
                    <span className="text-amber-400 font-mono font-bold">
                      +{inspectLedgerEntry.bonusPoints || 0} pts
                    </span>
                  </div>
                  {Array.isArray(inspectLedgerEntry.bonusBreakdown) &&
                  inspectLedgerEntry.bonusBreakdown.length > 0 ? (
                    <ul className="text-[11px] text-[#9B9EA4] space-y-1 pt-1">
                      {inspectLedgerEntry.bonusBreakdown.map((b, i) => (
                        <li key={i} className="flex items-center justify-between">
                          <span>• {b.name} ({b.type})</span>
                          <span className="font-bold text-amber-400">+{b.points} pts</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[11px] text-[#9B9EA4]">No bonus conditions met for this registration.</p>
                  )}
                </div>

                {/* Final Equation */}
                <div className="p-3 rounded-lg bg-[#FE760B]/10 border border-[#FE760B]/25 flex items-center justify-between text-sm">
                  <span className="font-bold text-white">Final Award Equation:</span>
                  <div className="font-mono font-extrabold text-[#FE760B]">
                    {inspectLedgerEntry.basePoints || 0} (Base) + {inspectLedgerEntry.bonusPoints || 0} (Bonus) ={" "}
                    {inspectLedgerEntry.totalPoints} pts
                  </div>
                </div>
              </div>

              {/* Audit Metadata Reference */}
              <div className="p-3 rounded-xl bg-[#212327]/60 border border-[#2A2D31] space-y-1 text-[11px] text-[#9B9EA4] font-mono">
                <div>Idempotency Key: {inspectLedgerEntry.idempotencyKey || inspectLedgerEntry.id}</div>
                <div>
                  Ref: Order #{inspectLedgerEntry.orderId || "None"} • Reg #{inspectLedgerEntry.registrationId || "None"}
                </div>
                <div>Rule Version: v{inspectLedgerEntry.ruleVersion || 1}</div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="button"
                onClick={() => setInspectLedgerEntry(null)}
                className="h-9 px-4 rounded-xl bg-[#212327] hover:bg-[#2A2D31] text-white text-xs font-semibold cursor-pointer border border-[#2A2D31]"
              >
                Close Inspector
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
