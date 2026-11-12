"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { authFetch } from "@/lib/auth";
import {
  Users,
  Calendar,
  Award,
  Layers,
  ArrowLeft,
  Loader2,
  CheckCircle,
  Clock,
  AlertCircle,
  X,
  Copy,
  Check,
  Share2,
  Upload,
  Download,
  Settings,
  Plus,
  Search,
  ExternalLink,
  ChevronRight,
  Shield,
  Trash2,
  Gift,
  HelpCircle,
  Code,
  FileSpreadsheet,
  ToggleLeft,
  ToggleRight,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getPublicBaseUrl } from "@/lib/app-url";

function parseTimestamp(raw) {
  if (!raw) return new Date();
  if (typeof raw?.toDate === "function") {
    try {
      const d = raw.toDate();
      if (!isNaN(d.getTime())) return d;
    } catch {}
  }
  if (typeof raw?.seconds === "number") return new Date(raw.seconds * 1000);
  if (typeof raw?._seconds === "number") return new Date(raw._seconds * 1000);
  const d = new Date(raw);
  return isNaN(d.getTime()) ? new Date() : d;
}

export default function OrganizerProgramHubPage({ params }) {
  const unwrappedParams = use(params);
  const programId = unwrappedParams.programId;

  const { user } = useAuth();
  const router = useRouter();

  const [program, setProgram] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  // Tab 2: Connected Events
  const [connectedEvents, setConnectedEvents] = useState([]);
  const [allOrganizerEvents, setAllOrganizerEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);

  // Tab 3: Applications
  const [applications, setApplications] = useState([]);
  const [appFilter, setAppFilter] = useState("pending");
  const [appSearch, setAppSearch] = useState("");
  const [loadingApps, setLoadingApps] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [processingApp, setProcessingApp] = useState(false);

  // Tab 4: Active Ambassadors
  const [ambassadors, setAmbassadors] = useState([]);
  const [ambSearch, setAmbSearch] = useState("");
  const [loadingAmbs, setLoadingAmbs] = useState(false);

  // Tab 5: Referral Codes & Bulk Importer
  const [referralCodes, setReferralCodes] = useState([]);
  const [loadingCodes, setLoadingCodes] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  // Tab 6: Points & Rewards
  const [pointsRules, setPointsRules] = useState({
    basePointsPerTicket: 10,
    paidMultiplier: 2,
    milestones: [],
  });
  const [savingRules, setSavingRules] = useState(false);
  const [rewards, setRewards] = useState([]);
  const [loadingRewards, setLoadingRewards] = useState(false);
  const [isAddRewardModalOpen, setIsAddRewardModalOpen] = useState(false);
  const [newReward, setNewReward] = useState({
    title: "",
    description: "",
    rewardType: "merchandise",
    pointsRequired: 100,
    totalInventory: 20,
    claimInstructions: "",
  });
  const [addingReward, setAddingReward] = useState(false);

  // Manual Points Adjustment Modal
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustTargetAmb, setAdjustTargetAmb] = useState(null);
  const [adjustPoints, setAdjustPoints] = useState(10);
  const [adjustReason, setAdjustReason] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  // Tab 7: Leaderboard
  const [leaderboard, setLeaderboard] = useState([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [copiedLink, setCopiedLink] = useState(null);

  // Copy helper
  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(key);
    setTimeout(() => setCopiedLink(null), 2000);
    toast.success("Copied to clipboard!");
  };

  // ── Load Program Details ──
  const fetchProgram = useCallback(async () => {
    if (!programId) return;
    try {
      const res = await authFetch(`/api/organizer/programs/${programId}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to load program");
      }
      const data = await res.json();
      const mergedProgram = {
        ...data.program,
        stats: {
          ...data.program?.stats,
          ...data.stats,
          pendingApplications: data.stats?.pendingApplicationsCount ?? data.program?.stats?.pendingApplications ?? 0,
          totalAmbassadors: data.stats?.activeAmbassadorsCount ?? data.program?.stats?.totalAmbassadors ?? 0,
          connectedEvents: data.stats?.connectedEventsCount ?? data.program?.stats?.connectedEvents ?? 0,
        },
      };
      setProgram(mergedProgram);
      if (data.program?.pointsRules) {
        setPointsRules({
          basePointsPerTicket: data.program.pointsRules.basePointsPerTicket ?? 10,
          paidMultiplier: data.program.pointsRules.paidMultiplier ?? 2,
          milestones: data.program.pointsRules.milestones || [],
        });
      }
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to load program details");
    } finally {
      setLoading(false);
    }
  }, [programId]);

  useEffect(() => {
    fetchProgram();
  }, [fetchProgram]);

  // ── Tab 2: Events ──
  const fetchEvents = useCallback(async () => {
    if (!programId) return;
    setLoadingEvents(true);
    try {
      const res = await authFetch(`/api/organizer/programs/${programId}/events`);
      if (res.ok) {
        const data = await res.json();
        setConnectedEvents(data.connectedEvents || data.connections || []);
        if (data.availableEvents && data.availableEvents.length > 0) {
          setAllOrganizerEvents(data.availableEvents);
        }
      }
      // Also fetch organizer's total events to allow linking
      const orgEventsRes = await authFetch("/api/events?limit=100");
      if (orgEventsRes.ok) {
        const orgData = await orgEventsRes.json();
        setAllOrganizerEvents((prev) => {
          const combined = [...prev, ...(orgData.events || [])];
          const map = new Map();
          combined.forEach((e) => {
            if (e && (e.id || e._id)) map.set(e.id || e._id, e);
          });
          return Array.from(map.values());
        });
      }
    } catch (err) {
      console.error("Error loading events:", err);
    } finally {
      setLoadingEvents(false);
    }
  }, [programId]);

  // ── Tab 3: Applications ──
  const fetchApplications = useCallback(async () => {
    if (!programId) return;
    setLoadingApps(true);
    try {
      const res = await authFetch(`/api/organizer/programs/${programId}/applications?status=${appFilter}`);
      if (res.ok) {
        const data = await res.json();
        const apps = data.applications || [];
        setApplications(apps);
        if (appFilter === "pending") {
          setProgram((prev) =>
            prev
              ? {
                  ...prev,
                  stats: {
                    ...prev.stats,
                    pendingApplications: apps.length,
                  },
                }
              : prev
          );
        }
      }
    } catch (err) {
      console.error("Error loading applications:", err);
    } finally {
      setLoadingApps(false);
    }
  }, [programId, appFilter]);

  // ── Tab 4 & 5: Ambassadors & Codes ──
  const fetchAmbassadorsAndCodes = useCallback(async () => {
    if (!programId) return;
    setLoadingAmbs(true);
    setLoadingCodes(true);
    try {
      const codesRes = await authFetch(`/api/organizer/programs/${programId}/referral-codes`);
      if (codesRes.ok) {
        const data = await codesRes.json();
        setReferralCodes(data.referralCodes || []);
        // Map ambassadors out of referral codes & program
        const ambMap = new Map();
        (data.referralCodes || []).forEach((c) => {
          if (c.ambassadorId) {
            ambMap.set(c.ambassadorId, {
              id: c.ambassadorId,
              userId: c.userId,
              referralCode: c.code,
              fullName: c.assignedToName || c.assignedTo || "Enrolled Ambassador",
              email: c.assignedToEmail || "",
              phone: c.assignedToPhone || "",
              college: c.college || program?.college || "",
              createdAt: c.createdAt,
            });
          }
        });
        setAmbassadors(Array.from(ambMap.values()));
      }
    } catch (err) {
      console.error("Error loading ambassadors & codes:", err);
    } finally {
      setLoadingAmbs(false);
      setLoadingCodes(false);
    }
  }, [programId, program?.college]);

  // ── Tab 6: Rewards ──
  const fetchRewards = useCallback(async () => {
    if (!programId) return;
    setLoadingRewards(true);
    try {
      const res = await authFetch(`/api/organizer/programs/${programId}/rewards`);
      if (res.ok) {
        const data = await res.json();
        setRewards(data.rewards || []);
      }
    } catch (err) {
      console.error("Error loading rewards:", err);
    } finally {
      setLoadingRewards(false);
    }
  }, [programId]);

  // ── Tab 7: Leaderboard ──
  const fetchLeaderboard = useCallback(async () => {
    if (!programId) return;
    setLoadingLeaderboard(true);
    try {
      const res = await authFetch(`/api/public/leaderboard/${programId}`);
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data.leaderboard || []);
      }
    } catch (err) {
      console.error("Error loading leaderboard:", err);
    } finally {
      setLoadingLeaderboard(false);
    }
  }, [programId]);

  // Tab switch effect
  useEffect(() => {
    if (activeTab === "events") fetchEvents();
    if (activeTab === "applications") fetchApplications();
    if (activeTab === "ambassadors" || activeTab === "referrals") fetchAmbassadorsAndCodes();
    if (activeTab === "points") fetchRewards();
    if (activeTab === "leaderboard") fetchLeaderboard();
  }, [activeTab, fetchEvents, fetchApplications, fetchAmbassadorsAndCodes, fetchRewards, fetchLeaderboard]);

  // Real-time polling effect (every 8s) to keep application counts & status updated
  useEffect(() => {
    const timer = setInterval(() => {
      fetchProgram();
      if (activeTab === "applications") fetchApplications();
    }, 8000);
    return () => clearInterval(timer);
  }, [fetchProgram, activeTab, fetchApplications]);

  // Lifecycle status changer
  const handleStatusChange = async (newStatus) => {
    try {
      const res = await authFetch(`/api/organizer/programs/${programId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update status");
      toast.success(`Program status updated to ${newStatus}`);
      fetchProgram();
    } catch (err) {
      toast.error(err.message || "Failed to update program status");
    }
  };

  // Connect/Toggle event
  const handleToggleEvent = async (eventId, enableReferral) => {
    try {
      const res = await authFetch(`/api/organizer/programs/${programId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle", eventId, enableReferral }),
      });
      if (!res.ok) throw new Error("Failed to update event connection");
      toast.success("Event updated successfully");
      fetchEvents();
    } catch (err) {
      toast.error(err.message || "Could not update event");
    }
  };

  const handleConnectEvent = async (eventId) => {
    try {
      const res = await authFetch(`/api/organizer/programs/${programId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "connect", eventIds: [eventId] }),
      });
      if (!res.ok) throw new Error("Failed to connect event");
      toast.success("Event connected successfully");
      setIsConnectModalOpen(false);
      fetchEvents();
    } catch (err) {
      toast.error(err.message || "Could not connect event");
    }
  };

  // Approve Application
  const handleApproveApp = async (appId) => {
    setProcessingApp(true);
    try {
      const res = await authFetch(`/api/organizer/programs/${programId}/applications/${appId}/approve`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to approve application");
      toast.success(`Ambassador approved! Assigned code: ${data.referralCode}`);
      setSelectedApp(null);
      fetchApplications();
      fetchProgram();
    } catch (err) {
      toast.error(err.message || "Approval failed");
    } finally {
      setProcessingApp(false);
    }
  };

  // Reject Application
  const handleRejectApp = async (appId) => {
    if (!rejectReason.trim()) {
      toast.error("Please enter a rejection reason for the applicant.");
      return;
    }
    setProcessingApp(true);
    try {
      const res = await authFetch(`/api/organizer/programs/${programId}/applications/${appId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reject application");
      toast.success("Application rejected and applicant notified.");
      setSelectedApp(null);
      setRejectReason("");
      fetchApplications();
      fetchProgram();
    } catch (err) {
      toast.error(err.message || "Rejection failed");
    } finally {
      setProcessingApp(false);
    }
  };

  // Save Points Rules
  const handleSavePointsRules = async (e) => {
    e.preventDefault();
    setSavingRules(true);
    try {
      const res = await authFetch(`/api/organizer/programs/${programId}/points/rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pointsRules),
      });
      if (!res.ok) throw new Error("Failed to update points rules");
      toast.success("Points rules saved successfully!");
      fetchProgram();
    } catch (err) {
      toast.error(err.message || "Could not save points rules");
    } finally {
      setSavingRules(false);
    }
  };

  // Add Reward
  const handleAddReward = async (e) => {
    e.preventDefault();
    if (!newReward.title.trim()) {
      toast.error("Please enter a reward title");
      return;
    }
    setAddingReward(true);
    try {
      const res = await authFetch(`/api/organizer/programs/${programId}/rewards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newReward,
          pointsRequired: Number(newReward.pointsRequired) || 100,
          totalInventory: Number(newReward.totalInventory) || 20,
        }),
      });
      if (!res.ok) throw new Error("Failed to create reward");
      toast.success("Reward added to catalog!");
      setIsAddRewardModalOpen(false);
      setNewReward({
        title: "",
        description: "",
        rewardType: "merchandise",
        pointsRequired: 100,
        totalInventory: 20,
        claimInstructions: "",
      });
      fetchRewards();
    } catch (err) {
      toast.error(err.message || "Could not add reward");
    } finally {
      setAddingReward(false);
    }
  };

  // Submit Manual Points Adjustment
  const handleManualAdjust = async (e) => {
    e.preventDefault();
    if (!adjustTargetAmb) return;
    if (!adjustReason.trim()) {
      toast.error("Please provide an audit reason for manual adjustment.");
      return;
    }
    setAdjusting(true);
    try {
      const res = await authFetch(`/api/organizer/programs/${programId}/points/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ambassadorId: adjustTargetAmb.id,
          userId: adjustTargetAmb.userId,
          points: Number(adjustPoints),
          reason: adjustReason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to adjust points");
      toast.success(`Adjusted ${adjustPoints} points for ${adjustTargetAmb.fullName}`);
      setIsAdjustModalOpen(false);
      setAdjustReason("");
      fetchProgram();
      fetchAmbassadorsAndCodes();
    } catch (err) {
      toast.error(err.message || "Could not adjust points");
    } finally {
      setAdjusting(false);
    }
  };

  // Bulk File Selection & CSV Parse
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setImportResult(null);

    // Read initial preview text
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === "string") {
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        const headers = lines[0]?.split(",").map((h) => h.trim()) || [];
        const previewRows = lines.slice(1, 6).map((line) => {
          const cells = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
          const rowObj = {};
          headers.forEach((h, i) => {
            rowObj[h] = cells[i] || "";
          });
          return rowObj;
        });
        setImportPreview(previewRows);
      }
    };
    reader.readAsText(file.slice(0, 10000));
  };

  // Execute Bulk Import
  const handleExecuteImport = async () => {
    if (!importFile) {
      toast.error("Please select a CSV or XLSX file first");
      return;
    }
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", importFile);
      const res = await authFetch(`/api/organizer/programs/${programId}/import`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      setImportResult(data);
      toast.success(`Import complete! ${data.importedCount || 0} ambassadors enrolled.`);
      fetchProgram();
      fetchAmbassadorsAndCodes();
    } catch (err) {
      toast.error(err.message || "Failed to process import");
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#FE760B] mb-3" />
        <p className="text-xs text-slate-500 dark:text-[#9B9EA4]">Loading program hub...</p>
      </div>
    );
  }

  if (!program) {
    return (
      <div className="max-w-md mx-auto py-20 px-4 text-center space-y-3">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Program Not Found</h2>
        <p className="text-xs text-slate-500 dark:text-[#9B9EA4]">
          This ambassador program either does not exist or you do not have permission to manage it.
        </p>
        <Link href="/admin/programs">
          <Button className="mt-2 text-xs bg-[#FE760B] text-[#131517]">Back to Programs</Button>
        </Link>
      </div>
    );
  }

  const baseUrl = getPublicBaseUrl();
  const publicApplyUrl = `${baseUrl}/programs/${programId}/apply`;
  const publicLeaderboardUrl = `${baseUrl}/leaderboard/${programId}`;
  const embedCode = `<iframe src="${baseUrl}/embed/leaderboard/${programId}" width="100%" height="600" frameborder="0"></iframe>`;

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "events", label: `Events (${connectedEvents.length})` },
    { id: "applications", label: `Applications (${program.stats?.pendingApplications || 0})` },
    { id: "ambassadors", label: `Ambassadors (${ambassadors.length})` },
    { id: "referrals", label: `Codes & Import (${referralCodes.length})` },
    { id: "points", label: "Points & Rewards" },
    { id: "leaderboard", label: "Leaderboard & Embed" },
    { id: "settings", label: "Settings" },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* ── Top Breadcrumbs & Header ── */}
      <div>
        <Link
          href="/admin/programs"
          className="inline-flex items-center gap-1.5 text-xs text-[#FE760B] font-semibold hover:underline mb-2 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>All Ambassador Programs</span>
        </Link>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {program.title || program.name || "Ambassador Program"}
              </h1>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                  program.status === "published"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25"
                    : program.status === "paused"
                    ? "bg-amber-500/10 text-amber-400 border-amber-500/25"
                    : "bg-slate-500/10 text-slate-400 border-slate-500/25"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                {program.status}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-[#9B9EA4]">
              {program.college ? `Campus: ${program.college} • ` : ""}
              Created {parseTimestamp(program.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
            </p>
          </div>

          {/* Quick Lifecycle Controls */}
          <div className="flex items-center gap-2">
            {program.status === "draft" && (
              <Button
                onClick={() => handleStatusChange("published")}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs h-9 px-4 rounded-xl shadow-xs cursor-pointer"
              >
                Publish Program
              </Button>
            )}
            {program.status === "published" && (
              <Button
                variant="outline"
                onClick={() => handleStatusChange("paused")}
                className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10 text-xs h-9 px-3.5 rounded-xl cursor-pointer"
              >
                Pause Program
              </Button>
            )}
            {program.status === "paused" && (
              <Button
                onClick={() => handleStatusChange("published")}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs h-9 px-4 rounded-xl cursor-pointer"
              >
                Resume Program
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Tabs Navigation ── */}
      <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto border-b border-slate-200 dark:border-[#2A2D31] pb-2 no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === tab.id
                ? "bg-[#FE760B] text-[#131517] shadow-xs"
                : "text-slate-600 dark:text-[#9B9EA4] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#212327]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════
          TAB 1: OVERVIEW
      ══════════════════════════════════════════════════════ */}
      {activeTab === "overview" && (
        <div className="space-y-6 animate-fade-in">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
            <div className="bg-white dark:bg-[#1A1C1F] rounded-2xl border border-slate-200 dark:border-[#2A2D31] p-4 sm:p-5 shadow-xs">
              <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                {program.stats?.totalAmbassadors || ambassadors.length || 0}
              </div>
              <div className="text-xs text-slate-500 dark:text-[#9B9EA4] mt-0.5">Enrolled Ambassadors</div>
            </div>
            <div className="bg-white dark:bg-[#1A1C1F] rounded-2xl border border-slate-200 dark:border-[#2A2D31] p-4 sm:p-5 shadow-xs">
              <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                {(program.stats?.totalPointsIssued || 0).toLocaleString("en-IN")}
              </div>
              <div className="text-xs text-slate-500 dark:text-[#9B9EA4] mt-0.5">Points Distributed</div>
            </div>
            <div className="bg-white dark:bg-[#1A1C1F] rounded-2xl border border-slate-200 dark:border-[#2A2D31] p-4 sm:p-5 shadow-xs">
              <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                {program.connectedEventsCount || connectedEvents.length || 0}
              </div>
              <div className="text-xs text-slate-500 dark:text-[#9B9EA4] mt-0.5">Connected Events</div>
            </div>
            <div className="bg-white dark:bg-[#1A1C1F] rounded-2xl border border-slate-200 dark:border-[#2A2D31] p-4 sm:p-5 shadow-xs">
              <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                {program.stats?.pendingApplications || 0}
              </div>
              <div className="text-xs text-slate-500 dark:text-[#9B9EA4] mt-0.5">Pending Applications</div>
            </div>
          </div>

          {/* Quick Sharing & Links */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-[#1A1C1F] rounded-2xl border border-slate-200 dark:border-[#2A2D31] p-5 space-y-3 shadow-xs">
              <div className="flex items-center gap-2 text-xs font-bold text-[#FE760B] uppercase tracking-wider">
                <Share2 className="w-4 h-4" />
                <span>Public Ambassador Application Link</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-[#9B9EA4]">
                Share this link on your college campus posters and social channels to invite student ambassador applicants.
              </p>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={publicApplyUrl}
                  className="bg-slate-50 dark:bg-[#212327] border-slate-200 dark:border-[#2A2D31] text-xs h-9 font-mono"
                />
                <Button
                  size="sm"
                  onClick={() => handleCopy(publicApplyUrl, "apply")}
                  className="bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-semibold text-xs h-9 px-3 shrink-0 cursor-pointer"
                  title="Copy application link"
                >
                  {copiedLink === "apply" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </Button>
                <Link href={`/programs/${programId}/apply`} target="_blank">
                  <Button size="sm" variant="outline" className="text-xs h-9 px-3 shrink-0 bg-[#212327] hover:bg-[#2A2D31] text-[#D0D0D1] hover:text-white border-[#2A2D31] cursor-pointer" title="Open application form in new tab">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Button>
                </Link>
              </div>
            </div>

            <div className="bg-white dark:bg-[#1A1C1F] rounded-2xl border border-slate-200 dark:border-[#2A2D31] p-5 space-y-3 shadow-xs">
              <div className="flex items-center gap-2 text-xs font-bold text-purple-400 uppercase tracking-wider">
                <Award className="w-4 h-4" />
                <span>Public Leaderboard & Iframe Embed</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-[#9B9EA4]">
                Privacy-hardened leaderboard showing ambassador rankings and points. Can be embedded on college portals.
              </p>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={publicLeaderboardUrl}
                  className="bg-slate-50 dark:bg-[#212327] border-slate-200 dark:border-[#2A2D31] text-xs h-9 font-mono"
                />
                <Button
                  size="sm"
                  onClick={() => handleCopy(publicLeaderboardUrl, "leaderboard")}
                  className="bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs h-9 px-3 shrink-0 cursor-pointer"
                >
                  {copiedLink === "leaderboard" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </Button>
                <Link href={`/leaderboard/${programId}`} target="_blank">
                  <Button size="sm" variant="outline" className="text-xs h-9 px-3 shrink-0 bg-[#212327] hover:bg-[#2A2D31] text-[#D0D0D1] hover:text-white border-[#2A2D31] cursor-pointer" title="Open public leaderboard in new tab">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB 2: CONNECTED EVENTS
      ══════════════════════════════════════════════════════ */}
      {activeTab === "events" && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Connected Events</h2>
              <p className="text-xs text-slate-500 dark:text-[#9B9EA4]">
                Ambassador referral codes are accepted during checkout or registration for these events.
              </p>
            </div>
            <Button
              onClick={() => setIsConnectModalOpen(true)}
              className="bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-semibold text-xs h-9 px-3.5 rounded-xl cursor-pointer"
            >
              <Plus className="w-4 h-4 mr-1 text-[#131517]" />
              Connect Event
            </Button>
          </div>

          {loadingEvents ? (
            <div className="py-12 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-[#FE760B]" />
            </div>
          ) : connectedEvents.length === 0 ? (
            <div className="bg-white dark:bg-[#1A1C1F] rounded-2xl border border-slate-200 dark:border-[#2A2D31] p-10 text-center space-y-3">
              <Calendar className="w-8 h-8 text-slate-400 mx-auto" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">No events connected yet</h3>
              <p className="text-xs text-slate-500 dark:text-[#9B9EA4] max-w-sm mx-auto">
                Connect your fest or workshop events so campus ambassadors can start referring attendees.
              </p>
              <Button
                onClick={() => setIsConnectModalOpen(true)}
                className="bg-[#FE760B] text-[#131517] font-semibold text-xs h-9 px-4 rounded-xl"
              >
                Connect First Event
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-[#2A2D31] bg-white dark:bg-[#1A1C1F] rounded-2xl border border-slate-200 dark:border-[#2A2D31] overflow-hidden">
              {connectedEvents.map((ev) => (
                <div key={ev.eventId || ev.id} className="p-4 flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {ev.eventTitle || ev.title || ev.name || "Event Pass"}
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-[#9B9EA4] mt-0.5">
                      {ev.venue || "Campus Venue"} • Linked to this Ambassador Program
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleToggleEvent(ev.eventId || ev.id, !ev.enableReferral)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        ev.enableReferral !== false
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          : "bg-slate-500/10 text-slate-400 border-slate-500/30"
                      }`}
                    >
                      {ev.enableReferral !== false ? (
                        <>
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Referral Active</span>
                        </>
                      ) : (
                        <span>Referral Paused</span>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB 3: APPLICATIONS REVIEW
      ══════════════════════════════════════════════════════ */}
      {activeTab === "applications" && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              {["pending", "approved", "rejected"].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setAppFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-colors cursor-pointer ${
                    appFilter === st
                      ? "bg-[#FE760B] text-[#131517]"
                      : "bg-white dark:bg-[#1A1C1F] text-slate-600 dark:text-[#9B9EA4] border border-slate-200 dark:border-[#2A2D31]"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            <div className="relative max-w-xs w-full">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                value={appSearch}
                onChange={(e) => setAppSearch(e.target.value)}
                placeholder="Search applicant name, email..."
                className="pl-9 h-9 bg-white dark:bg-[#1A1C1F] border-slate-200 dark:border-[#2A2D31] text-xs rounded-xl"
              />
            </div>
          </div>

          {loadingApps ? (
            <div className="py-12 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-[#FE760B]" />
            </div>
          ) : applications.length === 0 ? (
            <div className="bg-white dark:bg-[#1A1C1F] rounded-2xl border border-slate-200 dark:border-[#2A2D31] p-10 text-center space-y-2">
              <Users className="w-8 h-8 text-slate-400 mx-auto" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                No {appFilter} applications found
              </h3>
              <p className="text-xs text-slate-500 dark:text-[#9B9EA4]">
                New campus ambassador applicants will appear here for review.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-[#2A2D31] bg-white dark:bg-[#1A1C1F] rounded-2xl border border-slate-200 dark:border-[#2A2D31] overflow-hidden">
              {applications.map((app) => (
                <div key={app.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">{app.fullName}</h3>
                      <span className="text-[10px] text-slate-500 dark:text-[#9B9EA4]">
                        • {app.college || "Campus Partner"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-[#9B9EA4] mt-0.5">
                      {app.email} • WhatsApp: {app.whatsappPhone}
                    </p>
                    {app.answers?.promotionPitch && (
                      <p className="text-xs text-slate-600 dark:text-[#D0D0D1] mt-1 line-clamp-1 italic">
                        &ldquo;{app.answers.promotionPitch}&rdquo;
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedApp(app)}
                      className="text-xs h-8 px-3 rounded-lg border-slate-200 dark:border-[#2A2D31]"
                    >
                      Review
                    </Button>
                    {app.status === "pending" && (
                      <>
                        <Button
                          size="sm"
                          disabled={processingApp}
                          onClick={() => handleApproveApp(app.id)}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8 px-3 rounded-lg"
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={processingApp}
                          onClick={() => setSelectedApp(app)}
                          className="text-rose-400 border-rose-500/30 hover:bg-rose-500/10 text-xs h-8 px-3 rounded-lg"
                        >
                          Reject
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB 4: AMBASSADORS ROSTER
      ══════════════════════════════════════════════════════ */}
      {activeTab === "ambassadors" && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Active Ambassadors Roster</h2>
              <p className="text-xs text-slate-500 dark:text-[#9B9EA4]">
                Enrolled student creators with active referral codes.
              </p>
            </div>
            <div className="relative max-w-xs w-full">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                value={ambSearch}
                onChange={(e) => setAmbSearch(e.target.value)}
                placeholder="Search ambassador..."
                className="pl-9 h-9 bg-white dark:bg-[#1A1C1F] border-slate-200 dark:border-[#2A2D31] text-xs rounded-xl"
              />
            </div>
          </div>

          {loadingAmbs ? (
            <div className="py-12 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-[#FE760B]" />
            </div>
          ) : ambassadors.length === 0 ? (
            <div className="bg-white dark:bg-[#1A1C1F] rounded-2xl border border-slate-200 dark:border-[#2A2D31] p-10 text-center space-y-2">
              <Users className="w-8 h-8 text-slate-400 mx-auto" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">No active ambassadors</h3>
              <p className="text-xs text-slate-500 dark:text-[#9B9EA4]">
                Approve applications or use the Bulk Importer tab to enroll campus ambassadors.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-[#2A2D31] bg-white dark:bg-[#1A1C1F] rounded-2xl border border-slate-200 dark:border-[#2A2D31] overflow-hidden">
              {ambassadors.map((amb) => (
                <div key={amb.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">{amb.fullName}</h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#FE760B]/12 text-[#FE760B] border border-[#FE760B]/25">
                        {amb.referralCode}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-[#9B9EA4] mt-0.5">
                      {amb.email} • {amb.college}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setAdjustTargetAmb(amb);
                        setIsAdjustModalOpen(true);
                      }}
                      className="text-xs h-8 px-3 rounded-lg border-slate-200 dark:border-[#2A2D31]"
                    >
                      Adjust Points
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB 5: REFERRAL CODES & BULK IMPORTER
      ══════════════════════════════════════════════════════ */}
      {activeTab === "referrals" && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Referral Codes & Bulk Enrollment</h2>
              <p className="text-xs text-slate-500 dark:text-[#9B9EA4]">
                Canonical <code className="text-[#FE760B]">XXXX-NNNN</code> referral codes reserved in transactional inventory.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <a href="/api/organizer/programs/import-template" download="ambassadors-import-template.csv">
                <Button size="sm" variant="outline" className="text-xs h-9 px-3 rounded-xl border-slate-200 dark:border-[#2A2D31]">
                  <Download className="w-3.5 h-3.5 mr-1" />
                  Template
                </Button>
              </a>
              <Button
                size="sm"
                onClick={() => setIsImportModalOpen(true)}
                className="bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-semibold text-xs h-9 px-3.5 rounded-xl cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 mr-1 text-[#131517]" />
                Bulk Import
              </Button>
            </div>
          </div>

          {loadingCodes ? (
            <div className="py-12 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-[#FE760B]" />
            </div>
          ) : referralCodes.length === 0 ? (
            <div className="bg-white dark:bg-[#1A1C1F] rounded-2xl border border-slate-200 dark:border-[#2A2D31] p-10 text-center space-y-2">
              <Code className="w-8 h-8 text-slate-400 mx-auto" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">No referral codes reserved yet</h3>
              <p className="text-xs text-slate-500 dark:text-[#9B9EA4]">
                Approve an applicant or bulk import ambassador records to generate unique codes.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-[#2A2D31] bg-white dark:bg-[#1A1C1F] rounded-2xl border border-slate-200 dark:border-[#2A2D31] overflow-hidden">
              {referralCodes.map((codeDoc) => (
                <div key={codeDoc.code || codeDoc.id} className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono font-bold text-[#FE760B] bg-[#FE760B]/10 px-2.5 py-1 rounded-xl border border-[#FE760B]/20">
                      {codeDoc.code}
                    </span>
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                        {codeDoc.assignedToName || codeDoc.assignedTo || "Campus Ambassador"}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-[#9B9EA4]">
                        {codeDoc.assignedToEmail || ""}
                      </p>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopy(codeDoc.code, codeDoc.code)}
                    className="text-xs h-8 px-3 rounded-lg border-slate-200 dark:border-[#2A2D31]"
                  >
                    {copiedLink === codeDoc.code ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB 6: POINTS & REWARDS
      ══════════════════════════════════════════════════════ */}
      {activeTab === "points" && (
        <div className="space-y-6 animate-fade-in">
          {/* Rules Editor */}
          <div className="bg-white dark:bg-[#1A1C1F] rounded-2xl border border-slate-200 dark:border-[#2A2D31] p-5 space-y-4 shadow-xs">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Points Calculation Rules</h2>
            <form onSubmit={handleSavePointsRules} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-[#9B9EA4] block mb-1">
                    Base Points Per Free Registration
                  </label>
                  <Input
                    type="number"
                    min="1"
                    value={pointsRules.basePointsPerTicket}
                    onChange={(e) => setPointsRules({ ...pointsRules, basePointsPerTicket: e.target.value })}
                    className="bg-slate-50 dark:bg-[#212327] border-slate-200 dark:border-[#2A2D31] text-xs h-9"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-[#9B9EA4] block mb-1">
                    Paid Ticket Multiplier
                  </label>
                  <Input
                    type="number"
                    min="1"
                    value={pointsRules.paidMultiplier}
                    onChange={(e) => setPointsRules({ ...pointsRules, paidMultiplier: e.target.value })}
                    className="bg-slate-50 dark:bg-[#212327] border-slate-200 dark:border-[#2A2D31] text-xs h-9"
                  />
                </div>
              </div>
              <Button
                type="submit"
                disabled={savingRules}
                className="bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-semibold text-xs h-9 px-4 rounded-xl cursor-pointer"
              >
                {savingRules ? <Loader2 className="w-4 h-4 animate-spin text-[#131517]" /> : "Save Points Configuration"}
              </Button>
            </form>
          </div>

          {/* Rewards Catalog */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Rewards Catalog</h2>
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
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">No rewards configured yet</h3>
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
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20">
                          {rew.rewardType}
                        </span>
                        <span className="text-xs font-bold text-[#FE760B] tabular-nums">
                          {rew.pointsRequired} pts
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">{rew.title}</h3>
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
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB 7: LEADERBOARD & EMBED
      ══════════════════════════════════════════════════════ */}
      {activeTab === "leaderboard" && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-white dark:bg-[#1A1C1F] rounded-2xl border border-slate-200 dark:border-[#2A2D31] p-5 space-y-3 shadow-xs">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Public Iframe Embed Code</h2>
            <p className="text-xs text-slate-500 dark:text-[#9B9EA4]">
              Embed this privacy-safe live leaderboard on your college website or fest portal.
            </p>
            <div className="relative">
              <pre className="p-3 rounded-xl bg-slate-900 text-slate-200 text-xs font-mono overflow-x-auto">
                {embedCode}
              </pre>
              <Button
                size="sm"
                onClick={() => handleCopy(embedCode, "embed")}
                className="absolute right-2 top-2 bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-semibold text-xs h-7 px-3"
              >
                {copiedLink === "embed" ? "Copied!" : "Copy Embed Code"}
              </Button>
            </div>
          </div>

          <div className="bg-white dark:bg-[#1A1C1F] rounded-2xl border border-slate-200 dark:border-[#2A2D31] p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Leaderboard Live Preview</h2>
              <span className="text-[11px] text-slate-400">Strictly privacy-safe: Display Name and Points only</span>
            </div>

            {loadingLeaderboard ? (
              <div className="py-8 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-[#FE760B]" />
              </div>
            ) : leaderboard.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">No ambassadors on the leaderboard yet.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-[#2A2D31]">
                {leaderboard.map((item) => (
                  <div key={item.rank} className="py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        item.rank === 1 ? "bg-amber-400 text-black font-extrabold" : item.rank === 2 ? "bg-slate-300 text-black" : item.rank === 3 ? "bg-amber-700 text-white" : "text-slate-400"
                      }`}>
                        {item.rank}
                      </span>
                      <span className="text-xs font-bold text-slate-900 dark:text-white">{item.displayName}</span>
                    </div>
                    <span className="text-xs font-bold text-[#FE760B] tabular-nums">
                      {item.totalPoints?.toLocaleString("en-IN") || 0} pts
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB 8: SETTINGS
      ══════════════════════════════════════════════════════ */}
      {activeTab === "settings" && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-white dark:bg-[#1A1C1F] rounded-2xl border border-slate-200 dark:border-[#2A2D31] p-5 space-y-4 shadow-xs">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Program Metadata</h2>
            <div className="space-y-3 text-xs">
              <div>
                <span className="font-semibold text-slate-500 block mb-0.5">Program ID</span>
                <p className="font-mono text-slate-700 dark:text-[#D0D0D1]">{program.id}</p>
              </div>
              <div>
                <span className="font-semibold text-slate-500 block mb-0.5">Target College / Campus</span>
                <p className="text-slate-700 dark:text-[#D0D0D1]">{program.college || "General"}</p>
              </div>
              <div>
                <span className="font-semibold text-slate-500 block mb-0.5">Description</span>
                <p className="text-slate-700 dark:text-[#D0D0D1]">{program.description || "N/A"}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#1A1C1F] rounded-2xl border border-rose-500/30 p-5 space-y-3 shadow-xs">
            <h2 className="text-base font-bold text-rose-500">Danger Zone</h2>
            <p className="text-xs text-slate-500 dark:text-[#9B9EA4]">
              Archiving a program pauses all referral tracking, closes applications, and freezes rewards redemption.
            </p>
            {program.status !== "archived" ? (
              <Button
                variant="outline"
                onClick={() => {
                  if (confirm("Are you sure you want to archive this program?")) {
                    handleStatusChange("archived");
                  }
                }}
                className="text-xs text-rose-500 border-rose-500/40 hover:bg-rose-500/10 cursor-pointer"
              >
                Archive Program
              </Button>
            ) : (
              <p className="text-xs font-semibold text-slate-400">This program is archived.</p>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          MODAL 1: CONNECT EVENT MODAL
      ══════════════════════════════════════════════════════ */}
      {isConnectModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsConnectModalOpen(false);
          }}
        >
          <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl sm:rounded-3xl max-w-md w-full max-h-[90vh] flex flex-col p-5 sm:p-6 shadow-2xl my-auto text-white animate-scale-in overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#2A2D31] pb-3.5 shrink-0">
              <h3 className="text-base font-bold text-white tracking-tight">Connect Event</h3>
              <button
                type="button"
                onClick={() => setIsConnectModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#9B9EA4] hover:text-white hover:bg-[#2A2D31] transition-all cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2 mt-4 custom-scrollbar">
              {allOrganizerEvents.length === 0 ? (
                <p className="text-xs text-[#9B9EA4] text-center py-6">No events available to connect.</p>
              ) : (
                allOrganizerEvents.map((ev) => {
                  const isConnected = connectedEvents.some((c) => (c.eventId || c.id) === (ev.id || ev._id));
                  return (
                    <div
                      key={ev.id || ev._id}
                      className="p-3 rounded-xl bg-[#212327] border border-[#2A2D31] flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate">
                          {ev.title || ev.name}
                        </p>
                        <p className="text-[10px] text-[#9B9EA4] truncate">
                          {ev.date || "Date TBA"}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        disabled={isConnected}
                        onClick={() => {
                          handleConnectEvent(ev.id || ev._id);
                        }}
                        className={`text-xs h-8 px-3 rounded-lg ${
                          isConnected
                            ? "bg-[#1E2024] text-[#71767B] border border-[#2A2D31]"
                            : "bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-bold cursor-pointer"
                        }`}
                      >
                        {isConnected ? "Connected" : "Connect"}
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          MODAL 2: APPLICATION DETAIL / REVIEW MODAL
      ══════════════════════════════════════════════════════ */}
      {selectedApp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedApp(null);
          }}
        >
          <div className="relative w-full max-w-lg max-h-[90vh] bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl sm:rounded-3xl flex flex-col shadow-2xl text-white my-auto animate-scale-in overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#2A2D31] p-5 sm:p-6 shrink-0 bg-[#16181A]">
              <div className="pr-3">
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  {selectedApp.fullName}
                </h3>
                <p className="text-xs text-[#9B9EA4] mt-0.5">
                  {selectedApp.college} • {selectedApp.answers?.department || "Student"} ({selectedApp.answers?.yearOfStudy || "Ambassador"})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedApp(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#9B9EA4] hover:text-white hover:bg-[#2A2D31] transition-all cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 sm:p-6 space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-[#212327] border border-[#2A2D31]">
                <span className="font-semibold text-[#9B9EA4] uppercase tracking-wider text-[10px] block mb-1">
                  Contact Information
                </span>
                <p className="text-white text-sm font-medium">{selectedApp.email}</p>
                <p className="text-[#FE760B] text-xs font-mono mt-0.5">WhatsApp: {selectedApp.whatsappPhone}</p>
              </div>

              {selectedApp.answers?.socialProfile && (
                <div className="p-3.5 rounded-xl bg-[#212327] border border-[#2A2D31]">
                  <span className="font-semibold text-[#9B9EA4] uppercase tracking-wider text-[10px] block mb-1">
                    Social Profile / Portfolio Link
                  </span>
                  <a
                    href={selectedApp.answers.socialProfile}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#FE760B] hover:underline break-all text-xs font-mono"
                  >
                    {selectedApp.answers.socialProfile}
                  </a>
                </div>
              )}

              {selectedApp.answers?.clubRoles && (
                <div className="p-3.5 rounded-xl bg-[#212327] border border-[#2A2D31]">
                  <span className="font-semibold text-[#9B9EA4] uppercase tracking-wider text-[10px] block mb-1">
                    Club Leadership / Campus Roles
                  </span>
                  <p className="text-white text-xs leading-relaxed">{selectedApp.answers.clubRoles}</p>
                </div>
              )}

              {selectedApp.answers?.promotionPitch && (
                <div className="p-3.5 rounded-xl bg-[#212327] border border-[#2A2D31]">
                  <span className="font-semibold text-[#FE760B] uppercase tracking-wider text-[10px] block mb-1">
                    Promotion Strategy Pitch
                  </span>
                  <p className="text-slate-200 text-xs leading-relaxed">{selectedApp.answers.promotionPitch}</p>
                </div>
              )}

              {selectedApp.status === "pending" && (
                <div className="pt-2">
                  <label className="text-[11px] font-semibold text-[#9B9EA4] uppercase tracking-wider block mb-1.5">
                    Optional Rejection Feedback (only if rejecting)
                  </label>
                  <Input
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Enter rejection reason for applicant"
                    className="bg-[#212327] border-[#2A2D31] text-xs sm:text-sm text-white placeholder:text-[#71767B] h-11 rounded-xl focus:border-[#FE760B]"
                  />
                </div>
              )}
            </div>

            {/* Modal Sticky Footer */}
            <div className="flex items-center justify-end gap-3 p-4 sm:p-5 border-t border-[#2A2D31] shrink-0 bg-[#16181A]">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelectedApp(null)}
                className="h-10 px-4 rounded-xl bg-[#212327] hover:bg-[#2A2D31] text-[#D0D0D1] hover:text-white border-[#2A2D31] text-xs font-semibold cursor-pointer transition-colors"
              >
                Close
              </Button>
              {selectedApp.status === "pending" && (
                <>
                  <Button
                    size="sm"
                    disabled={processingApp}
                    onClick={() => handleRejectApp(selectedApp.id)}
                    className="bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs h-10 px-4 rounded-xl cursor-pointer shadow-sm transition-colors"
                  >
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    disabled={processingApp}
                    onClick={() => handleApproveApp(selectedApp.id)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-10 px-5 rounded-xl cursor-pointer shadow-sm transition-colors"
                  >
                    Approve & Enrol
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          MODAL 3: ADJUST POINTS MODAL
      ══════════════════════════════════════════════════════ */}
      {isAdjustModalOpen && adjustTargetAmb && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAdjustModalOpen(false);
          }}
        >
          <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl sm:rounded-3xl max-w-sm w-full max-h-[90vh] flex flex-col p-5 sm:p-6 shadow-2xl my-auto text-white animate-scale-in overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#2A2D31] pb-3.5 shrink-0">
              <h3 className="text-base font-bold text-white tracking-tight">
                Adjust Points: {adjustTargetAmb.fullName}
              </h3>
              <button
                type="button"
                onClick={() => setIsAdjustModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#9B9EA4] hover:text-white hover:bg-[#2A2D31] transition-all cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleManualAdjust} className="space-y-3.5 mt-3">
              <div>
                <label className="text-[11px] font-semibold text-[#9B9EA4] uppercase tracking-wider block mb-1.5">
                  Points Delta (+ or -)
                </label>
                <Input
                  type="number"
                  required
                  value={adjustPoints}
                  onChange={(e) => setAdjustPoints(e.target.value)}
                  placeholder="Enter points delta (+ or -)"
                  className="bg-[#212327] border-[#2A2D31] text-xs sm:text-sm text-white h-10 rounded-xl focus:border-[#FE760B]"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#9B9EA4] uppercase tracking-wider block mb-1.5">
                  Audit Reason *
                </label>
                <Input
                  required
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="Enter reason for points adjustment"
                  className="bg-[#212327] border-[#2A2D31] text-xs sm:text-sm text-white placeholder:text-[#71767B] h-10 rounded-xl focus:border-[#FE760B]"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#2A2D31]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="h-10 px-4 rounded-xl bg-[#212327] hover:bg-[#2A2D31] text-[#D0D0D1] hover:text-white border-[#2A2D31] text-xs font-semibold cursor-pointer transition-colors"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={adjusting}
                  className="h-10 px-5 rounded-xl bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-bold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {adjusting ? <Loader2 className="w-4 h-4 animate-spin text-[#131517]" /> : "Save Adjustment"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          MODAL 4: BULK IMPORT MODAL
      ══════════════════════════════════════════════════════ */}
      {isImportModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsImportModalOpen(false);
          }}
        >
          <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl sm:rounded-3xl max-w-xl w-full max-h-[90vh] flex flex-col p-5 sm:p-6 shadow-2xl my-auto text-white animate-scale-in overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between border-b border-[#2A2D31] pb-3.5 shrink-0">
              <div className="pr-3">
                <h3 className="text-base font-bold text-white tracking-tight">
                  Bulk Import Campus Ambassadors
                </h3>
                <p className="text-xs text-[#9B9EA4] mt-0.5">
                  Upload CSV or XLSX file. Formulas are neutralized automatically.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#9B9EA4] hover:text-white hover:bg-[#2A2D31] transition-all cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 my-4">
              <div className="border-2 border-dashed border-[#2A2D31] rounded-2xl p-6 text-center space-y-2 hover:border-[#FE760B]/50 transition-colors">
                <FileSpreadsheet className="w-8 h-8 text-[#FE760B] mx-auto" />
                <p className="text-xs font-semibold text-[#D0D0D1]">
                  Choose CSV or XLSX spreadsheet
                </p>
                <input
                  type="file"
                  accept=".csv, .xlsx, .xls"
                  onChange={handleFileChange}
                  className="text-xs text-[#9B9EA4]"
                />
              </div>

              {importPreview.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-[#9B9EA4] uppercase tracking-wider">
                    File Preview (First 5 Rows)
                  </span>
                  <div className="bg-[#212327] border border-[#2A2D31] rounded-xl p-3 max-h-36 overflow-y-auto text-[11px] font-mono space-y-1">
                    {importPreview.map((row, idx) => (
                      <div key={idx} className="truncate text-[#D0D0D1]">
                        {row.fullName || row.name} | {row.email} | {row.phone || row.whatsapp} | {row.college}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {importResult && (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-400 space-y-1">
                  <p className="font-bold">Import Completed Successfully!</p>
                  <p>Total Processed: {importResult.totalRows || 0} • Created: {importResult.importedCount || 0} • Skipped: {importResult.skippedCount || 0}</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3.5 border-t border-[#2A2D31]">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsImportModalOpen(false)}
                className="h-10 px-5 rounded-xl bg-[#212327] hover:bg-[#2A2D31] text-[#D0D0D1] hover:text-white border-[#2A2D31] text-xs font-semibold cursor-pointer transition-colors"
              >
                Done
              </Button>
              <Button
                size="sm"
                disabled={!importFile || importing}
                onClick={handleExecuteImport}
                className="h-10 px-5 rounded-xl bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-bold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {importing ? <Loader2 className="w-4 h-4 animate-spin text-[#131517]" /> : "Execute Import"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          MODAL 5: ADD REWARD MODAL
      ══════════════════════════════════════════════════════ */}
      {isAddRewardModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAddRewardModalOpen(false);
          }}
        >
          <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl sm:rounded-3xl max-w-md w-full max-h-[90vh] flex flex-col p-5 sm:p-6 shadow-2xl my-auto text-white animate-scale-in overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between border-b border-[#2A2D31] pb-3.5 shrink-0">
              <h3 className="text-base font-bold text-white tracking-tight">Add Program Reward</h3>
              <button
                type="button"
                onClick={() => setIsAddRewardModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#9B9EA4] hover:text-white hover:bg-[#2A2D31] transition-all cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddReward} className="space-y-3.5 mt-3">
              <div>
                <label className="text-[11px] font-semibold text-[#9B9EA4] uppercase tracking-wider block mb-1.5">
                  Reward Title *
                </label>
                <Input
                  required
                  value={newReward.title}
                  onChange={(e) => setNewReward({ ...newReward, title: e.target.value })}
                  placeholder="Enter reward title"
                  className="bg-[#212327] border-[#2A2D31] text-xs sm:text-sm text-white placeholder:text-[#71767B] h-10 rounded-xl focus:border-[#FE760B]"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#9B9EA4] uppercase tracking-wider block mb-1.5">
                  Reward Category
                </label>
                <select
                  value={newReward.rewardType}
                  onChange={(e) => setNewReward({ ...newReward, rewardType: e.target.value })}
                  className="w-full bg-[#212327] border border-[#2A2D31] rounded-xl text-xs sm:text-sm h-10 px-3 text-white focus:outline-none focus:border-[#FE760B]"
                >
                  <option value="merchandise">Merchandise (T-shirt / Hoodie / Kit)</option>
                  <option value="vip_pass">VIP / Pro Show Access Pass</option>
                  <option value="certificate">Certificate of Excellence</option>
                  <option value="mentorship">Mentorship / Workshop Session</option>
                  <option value="cash_voucher">Cash Voucher / UPI Prize</option>
                  <option value="gift_card">Amazon / Flipkart Gift Card</option>
                  <option value="discount_coupon">Event Discount Coupon</option>
                  <option value="custom">Custom Reward</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-[#9B9EA4] uppercase tracking-wider block mb-1.5">
                    Points Required *
                  </label>
                  <Input
                    type="number"
                    min="1"
                    required
                    value={newReward.pointsRequired}
                    onChange={(e) => setNewReward({ ...newReward, pointsRequired: e.target.value })}
                    placeholder="100"
                    className="bg-[#212327] border-[#2A2D31] text-xs sm:text-sm text-white h-10 rounded-xl focus:border-[#FE760B]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#9B9EA4] uppercase tracking-wider block mb-1.5">
                    Total Stock (-1 for unlimited)
                  </label>
                  <Input
                    type="number"
                    value={newReward.totalInventory}
                    onChange={(e) => setNewReward({ ...newReward, totalInventory: e.target.value })}
                    placeholder="-1"
                    className="bg-[#212327] border-[#2A2D31] text-xs sm:text-sm text-white h-10 rounded-xl focus:border-[#FE760B]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#9B9EA4] uppercase tracking-wider block mb-1.5">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={newReward.description}
                  onChange={(e) => setNewReward({ ...newReward, description: e.target.value })}
                  placeholder="Enter reward description and collection guidelines"
                  className="w-full bg-[#212327] border border-[#2A2D31] rounded-xl text-xs sm:text-sm p-3 text-white placeholder:text-[#71767B] focus:outline-none focus:border-[#FE760B]"
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-3.5 border-t border-[#2A2D31]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddRewardModalOpen(false)}
                  className="h-10 px-4 rounded-xl bg-[#212327] hover:bg-[#2A2D31] text-[#D0D0D1] hover:text-white border-[#2A2D31] text-xs font-semibold cursor-pointer transition-colors"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={addingReward}
                  className="h-10 px-5 rounded-xl bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-bold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {addingReward ? <Loader2 className="w-4 h-4 animate-spin text-[#131517]" /> : "Add to Catalog"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

