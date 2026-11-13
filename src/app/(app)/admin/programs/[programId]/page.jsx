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
  Monitor,
  Smartphone,
  Sliders,
  Calculator,
  Tag,
  Ticket,
  Zap,
  History,
  Info,
  Edit3,
  ArrowUpRight,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getPublicBaseUrl } from "@/lib/app-url";
import PointsEngineTab from "@/components/creator-campus/points-engine-tab";

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

function toDateInputValue(raw) {
  if (!raw) return "";
  try {
    const d = parseTimestamp(raw);
    if (!d || isNaN(d.getTime())) return "";
    return d.toISOString().split("T")[0];
  } catch {
    return "";
  }
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

  // Tab 6: Points & Rewards (Custom Points Engine)
  const [pointsRules, setPointsRules] = useState({
    global: {
      freeRegistrationPoints: 10,
      freeEligible: true,
      paidType: "multiplier",
      paidMultiplier: 2,
      paidRegistrationPoints: 20,
      paidEligible: true,
      ineligibleCategories: [],
    },
    eventOverrides: {},
    ticketOverrides: {},
    bonusRules: [],
    version: 1,
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

  // Tab 7: Leaderboard & Embeds
  const [leaderboard, setLeaderboard] = useState([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [copiedLink, setCopiedLink] = useState(null);
  const [embedSubTab, setEmbedSubTab] = useState("apply"); // "apply" | "leaderboard"
  const [embedPreviewDevice, setEmbedPreviewDevice] = useState("desktop"); // "desktop" | "mobile"

  // Tab 8: Program Settings Form State
  const [settingsForm, setSettingsForm] = useState({
    title: "",
    college: "",
    description: "",
    startDate: "",
    endDate: "",
  });
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    if (program) {
      setSettingsForm({
        title: program.title || program.name || "",
        college: program.college || "",
        description: program.description || "",
        startDate: toDateInputValue(program.startDate),
        endDate: toDateInputValue(program.endDate),
      });
    }
  }, [program]);

  const handleSaveSettings = async (e) => {
    e?.preventDefault?.();
    const cleanTitle = (settingsForm.title || "").trim();
    if (!cleanTitle) {
      toast.error("Program title cannot be empty");
      return;
    }
    setSavingSettings(true);
    try {
      const res = await authFetch(`/api/organizer/programs/${programId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: cleanTitle,
          name: cleanTitle,
          college: (settingsForm.college || "").trim(),
          description: (settingsForm.description || "").trim(),
          startDate: settingsForm.startDate || null,
          endDate: settingsForm.endDate || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update settings");
      }
      setProgram((prev) => ({
        ...prev,
        ...data.program,
        title: cleanTitle,
        name: cleanTitle,
        college: (settingsForm.college || "").trim(),
        description: (settingsForm.description || "").trim(),
        startDate: settingsForm.startDate || null,
        endDate: settingsForm.endDate || null,
      }));
      toast.success("Program settings saved successfully!");
    } catch (err) {
      console.error("Save settings error:", err);
      toast.error(err.message || "Failed to update program settings");
    } finally {
      setSavingSettings(false);
    }
  };

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

  // ── Tab 6: Points Rules & Rewards ──
  const fetchPointsRules = useCallback(async () => {
    if (!programId) return;
    try {
      const res = await authFetch(`/api/organizer/programs/${programId}/points/rules`);
      if (res.ok) {
        const data = await res.json();
        if (data.rules) {
          setPointsRules(data.rules);
        }
      }
    } catch (err) {
      console.error("Error loading points rules:", err);
    }
  }, [programId]);

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
    if (activeTab === "points") {
      fetchEvents();
      fetchAmbassadorsAndCodes();
      fetchPointsRules();
      fetchRewards();
    }
    if (activeTab === "leaderboard") fetchLeaderboard();
  }, [activeTab, fetchEvents, fetchApplications, fetchAmbassadorsAndCodes, fetchPointsRules, fetchRewards, fetchLeaderboard]);

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
          pointsAdjustment: Number(adjustPoints),
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
  const embedApplyUrl = `${baseUrl}/embed/programs/${programId}/apply`;
  const embedApplyCode = `<iframe src="${baseUrl}/embed/programs/${programId}/apply" width="100%" height="750" frameborder="0" style="border:none; max-width:100%; border-radius:16px;"></iframe>`;
  const embedLeaderboardUrl = `${baseUrl}/embed/leaderboard/${programId}`;
  const embedLeaderboardCode = `<iframe src="${baseUrl}/embed/leaderboard/${programId}" width="100%" height="600" frameborder="0" style="border:none; max-width:100%; border-radius:16px;"></iframe>`;
  const embedCode = embedLeaderboardCode;

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "events", label: `Events (${connectedEvents.length})` },
    { id: "applications", label: `Applications (${program.stats?.pendingApplications || 0})` },
    { id: "ambassadors", label: `Ambassadors (${ambassadors.length})` },
    { id: "referrals", label: `Codes & Import (${referralCodes.length})` },
    { id: "points", label: "Points & Rewards" },
    { id: "leaderboard", label: "Embeds & Leaderboard" },
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
            <div className="bg-white dark:bg-[#1A1C1F] rounded-2xl border border-slate-200 dark:border-[#2A2D31] p-5 space-y-3.5 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-[#FE760B] uppercase tracking-wider">
                  <Share2 className="w-4 h-4" />
                  <span>Ambassador Application Form</span>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#FE760B]/12 text-[#FE760B] border border-[#FE760B]/25">
                  Direct & Embed
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-[#9B9EA4]">
                Share this link on campus posters and WhatsApp groups, or embed the application form directly on your college fest website.
              </p>
              
              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Public Application Link:
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={publicApplyUrl}
                    className="flex-1 min-w-0 bg-slate-50 dark:bg-[#212327] border-slate-200 dark:border-[#2A2D31] text-xs h-9 font-mono truncate"
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

              <div className="pt-3 border-t border-slate-100 dark:border-[#26292E] flex items-center justify-between text-xs flex-wrap gap-2">
                <span className="text-[11px] text-slate-500 dark:text-[#9B9EA4] flex items-center gap-1.5">
                  <Code className="w-3.5 h-3.5 text-[#FE760B]" />
                  <span>Iframe Embed Form:</span>
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  data-embed="embed-apply-overview"
                  onClick={() => {
                    setEmbedSubTab("apply");
                    setActiveTab("leaderboard");
                  }}
                  className="text-xs h-8 px-3.5 rounded-xl border border-[#FE760B]/40 bg-[#FE760B]/10 hover:bg-[#FE760B]/20 text-[#FE760B] font-semibold cursor-pointer flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <Sliders className="w-3.5 h-3.5 text-[#FE760B]" />
                  <span>Customize & Preview</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
                </Button>
              </div>
            </div>

            <div className="bg-white dark:bg-[#1A1C1F] rounded-2xl border border-slate-200 dark:border-[#2A2D31] p-5 space-y-3.5 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-[#FE760B] uppercase tracking-wider">
                  <Award className="w-4 h-4" />
                  <span>Public Leaderboard & Embed</span>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#FE760B]/12 text-[#FE760B] border border-[#FE760B]/25">
                  Rankings
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-[#9B9EA4]">
                Privacy-hardened leaderboard showing ambassador rankings and points. Can be embedded on college portals.
              </p>

              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Public Leaderboard Link:
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={publicLeaderboardUrl}
                    className="flex-1 min-w-0 bg-slate-50 dark:bg-[#212327] border-slate-200 dark:border-[#2A2D31] text-xs h-9 font-mono truncate"
                  />
                  <Button
                    size="sm"
                    onClick={() => handleCopy(publicLeaderboardUrl, "leaderboard")}
                    className="bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-bold text-xs h-9 px-3 shrink-0 cursor-pointer"
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

              <div className="pt-3 border-t border-slate-100 dark:border-[#26292E] flex items-center justify-between text-xs flex-wrap gap-2">
                <span className="text-[11px] text-slate-500 dark:text-[#9B9EA4] flex items-center gap-1.5">
                  <Code className="w-3.5 h-3.5 text-[#FE760B]" />
                  <span>Iframe Embed Leaderboard:</span>
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  data-embed="embed-leaderboard-overview"
                  onClick={() => {
                    setEmbedSubTab("leaderboard");
                    setActiveTab("leaderboard");
                  }}
                  className="text-xs h-8 px-3.5 rounded-xl border border-[#2A2D31] bg-[#212327] hover:bg-[#2A2D31] text-[#D0D0D1] hover:text-white font-semibold cursor-pointer flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <Sliders className="w-3.5 h-3.5 text-[#FE760B]" />
                  <span>Customize & Preview</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
                </Button>
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
                <div key={ev.eventId || ev.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {ev.eventTitle || ev.title || ev.name || "Event Pass"}
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-[#9B9EA4] mt-0.5 truncate">
                      {ev.venue || "Campus Venue"} • Linked to this Ambassador Program
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
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
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-9 px-3.5 rounded-xl bg-[#212327] hover:bg-[#2A2D31] text-[#D0D0D1] hover:text-white border border-[#2A2D31] transition-colors cursor-pointer shadow-xs active:scale-[0.98]"
                >
                  <Download className="w-3.5 h-3.5 mr-1.5 text-[#FE760B]" />
                  <span>Download Template</span>
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
                <div key={codeDoc.code || codeDoc.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-sm font-mono font-bold text-[#FE760B] bg-[#FE760B]/10 px-2.5 py-1 rounded-xl border border-[#FE760B]/20 shrink-0">
                      {codeDoc.code}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {codeDoc.assignedToName || codeDoc.assignedTo || "Campus Ambassador"}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-[#9B9EA4] truncate">
                        {codeDoc.assignedToEmail || ""}
                      </p>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopy(codeDoc.code, codeDoc.code)}
                    className="text-xs h-8 px-3 rounded-lg border-slate-200 dark:border-[#2A2D31] self-end sm:self-auto shrink-0"
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
          TAB 6: POINTS ENGINE & REWARDS
      ══════════════════════════════════════════════════════ */}
      {activeTab === "points" && (
        <PointsEngineTab
          programId={programId}
          program={program}
          connectedEvents={connectedEvents}
          ambassadors={ambassadors}
          pointsRules={pointsRules}
          setPointsRules={setPointsRules}
          fetchProgram={fetchProgram}
          rewards={rewards}
          loadingRewards={loadingRewards}
          fetchRewards={fetchRewards}
          setIsAddRewardModalOpen={setIsAddRewardModalOpen}
          isAdjustModalOpen={isAdjustModalOpen}
          setIsAdjustModalOpen={setIsAdjustModalOpen}
          adjustTargetAmb={adjustTargetAmb}
          setAdjustTargetAmb={setAdjustTargetAmb}
          adjustPoints={adjustPoints}
          setAdjustPoints={setAdjustPoints}
          adjustReason={adjustReason}
          setAdjustReason={setAdjustReason}
          adjusting={adjusting}
          handleManualAdjust={handleManualAdjust}
        />
      )}

      {/* ══════════════════════════════════════════════════════
          TAB 7: EMBEDS & LEADERBOARD
      ══════════════════════════════════════════════════════ */}
      {activeTab === "leaderboard" && (
        <div className="space-y-6 animate-fade-in">
          {/* Sub-navigation switcher: Application Form Embed vs Leaderboard Embed */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 sm:gap-2 p-1 bg-slate-100 dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] rounded-2xl w-full sm:w-fit">
            <button
              type="button"
              onClick={() => setEmbedSubTab("apply")}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                embedSubTab === "apply"
                  ? "bg-[#FE760B] text-[#131517] shadow-sm"
                  : "text-slate-600 dark:text-[#9B9EA4] hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Ambassador Application Form Embed</span>
            </button>
            <button
              type="button"
              onClick={() => setEmbedSubTab("leaderboard")}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                embedSubTab === "leaderboard"
                  ? "bg-[#FE760B] text-[#131517] shadow-sm"
                  : "text-slate-600 dark:text-[#9B9EA4] hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>Leaderboard Embed</span>
            </button>
          </div>

          {/* ── SUB-TAB 1: APPLICATION FORM EMBED ── */}
          {embedSubTab === "apply" && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-white dark:bg-[#1A1C1F] rounded-2xl border border-slate-200 dark:border-[#2A2D31] p-5 sm:p-6 space-y-4 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#FE760B] animate-pulse" />
                      <h2 className="text-base font-bold text-slate-900 dark:text-white">
                        Application Form Iframe Embed Code
                      </h2>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-[#9B9EA4] mt-1 max-w-2xl">
                      Embed this application form directly on your official college fest website, campus club portal, or social link-in-bio. Students can apply to become campus ambassadors without leaving your domain.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Link href={`/embed/programs/${programId}/apply`} target="_blank">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-8 px-3 bg-[#212327] hover:bg-[#2A2D31] text-[#D0D0D1] hover:text-white border-[#2A2D31] cursor-pointer flex items-center gap-1.5"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Open Live Embed</span>
                      </Button>
                    </Link>
                  </div>
                </div>

                {/* Structured Top-Bar Code Container (No Overlapping Button) */}
                <div className="rounded-xl border border-slate-200 dark:border-[#2A2D31] bg-slate-900/90 dark:bg-[#15171A] overflow-hidden">
                  <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-950/60 dark:bg-[#0E1012] border-b border-slate-800 dark:border-[#2A2D31]">
                    <div className="flex items-center gap-2">
                      <Code className="w-3.5 h-3.5 text-[#FE760B]" />
                      <span className="text-[11px] font-mono font-medium text-slate-400 dark:text-[#9B9EA4]">HTML EMBED SNIPPET</span>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleCopy(embedApplyCode, "embed-apply")}
                      className="bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-bold text-xs h-7 px-3 rounded-lg cursor-pointer shadow-xs flex items-center gap-1.5"
                    >
                      {copiedLink === "embed-apply" ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Embed Code</span>
                        </>
                      )}
                    </Button>
                  </div>
                  <pre className="p-4 text-xs font-mono text-slate-200 dark:text-[#D0D0D1] overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                    {embedApplyCode}
                  </pre>
                </div>

                {/* Direct Link Alternative */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#212327] border border-slate-200 dark:border-[#2A2D31] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-bold text-slate-700 dark:text-slate-200 shrink-0">Direct Embed URL:</span>
                    <code className="text-xs font-mono text-[#FE760B] truncate">
                      {embedApplyUrl}
                    </code>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleCopy(embedApplyUrl, "embed-apply-url")}
                    className="text-xs h-8 px-3 text-[#FE760B] hover:text-[#FF8A2B] hover:bg-[#FE760B]/10 font-semibold cursor-pointer shrink-0 self-start sm:self-auto"
                  >
                    {copiedLink === "embed-apply-url" ? "Copied URL!" : "Copy Direct URL"}
                  </Button>
                </div>

                {/* Features Checklist */}
                <div className="pt-4 border-t border-slate-100 dark:border-[#26292E] grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600 dark:text-[#9B9EA4]">
                  <div className="flex items-start gap-2">
                    <span className="text-emerald-400 font-bold">✓</span>
                    <span>Auto-resizing iframe via <code>ticketlelo:resize</code> postMessage</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-emerald-400 font-bold">✓</span>
                    <span>Direct guest registration with zero forced login barrier</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-emerald-400 font-bold">✓</span>
                    <span>Theme support: append <code>?theme=light</code> or <code>?theme=dark</code></span>
                  </div>
                </div>
              </div>

              {/* Live Interactive Form Preview Card */}
              <div className="bg-white dark:bg-[#1A1C1F] rounded-2xl border border-slate-200 dark:border-[#2A2D31] p-5 sm:p-6 space-y-4 shadow-xs">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Code className="w-4 h-4 text-[#FE760B]" />
                      <span>Application Form Live Preview</span>
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-[#9B9EA4] mt-0.5">
                      Interact with your live embedded ambassador application form exactly as applicants will experience it on your site.
                    </p>
                  </div>

                  {/* Desktop / Mobile Switcher */}
                  <div className="flex items-center rounded-xl bg-slate-100 dark:bg-[#212327] p-1 border border-slate-200 dark:border-[#2A2D31]">
                    <button
                      type="button"
                      onClick={() => setEmbedPreviewDevice("desktop")}
                      className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                        embedPreviewDevice === "desktop"
                          ? "bg-[#FE760B] text-[#131517] font-bold shadow-xs"
                          : "text-slate-600 dark:text-[#9B9EA4] hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      <Monitor className="w-3.5 h-3.5" />
                      <span>Desktop</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEmbedPreviewDevice("mobile")}
                      className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                        embedPreviewDevice === "mobile"
                          ? "bg-[#FE760B] text-[#131517] font-bold shadow-xs"
                          : "text-slate-600 dark:text-[#9B9EA4] hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                      <span>Mobile (390px)</span>
                    </button>
                  </div>
                </div>

                <div className="w-full flex justify-center py-4 px-2 bg-slate-950/60 rounded-2xl border border-slate-200/40 dark:border-white/10 shadow-inner overflow-hidden">
                  <div
                    className={`transition-all duration-300 w-full ${
                      embedPreviewDevice === "mobile" ? "max-w-[410px]" : "max-w-2xl"
                    }`}
                  >
                    <iframe
                      src={embedApplyUrl}
                      className="w-full h-[680px] rounded-2xl border border-slate-800 bg-transparent shadow-2xl"
                      title="Ambassador Application Form Embed Preview"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── SUB-TAB 2: LEADERBOARD EMBED ── */}
          {embedSubTab === "leaderboard" && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-white dark:bg-[#1A1C1F] rounded-2xl border border-slate-200 dark:border-[#2A2D31] p-5 sm:p-6 space-y-4 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#FE760B] animate-pulse" />
                      <h2 className="text-base font-bold text-slate-900 dark:text-white">
                        Public Leaderboard Iframe Embed Code
                      </h2>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-[#9B9EA4] mt-1 max-w-2xl">
                      Embed this privacy-safe live leaderboard on your college website or fest portal to showcase top campus creators and points in real time.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Link href={`/leaderboard/${programId}`} target="_blank">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-8 px-3 bg-[#212327] hover:bg-[#2A2D31] text-[#D0D0D1] hover:text-white border-[#2A2D31] cursor-pointer flex items-center gap-1.5"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Open Public Page</span>
                      </Button>
                    </Link>
                  </div>
                </div>

                {/* Structured Top-Bar Code Container (No Overlapping Button) */}
                <div className="rounded-xl border border-slate-200 dark:border-[#2A2D31] bg-slate-900/90 dark:bg-[#15171A] overflow-hidden">
                  <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-950/60 dark:bg-[#0E1012] border-b border-slate-800 dark:border-[#2A2D31]">
                    <div className="flex items-center gap-2">
                      <Code className="w-3.5 h-3.5 text-[#FE760B]" />
                      <span className="text-[11px] font-mono font-medium text-slate-400 dark:text-[#9B9EA4]">HTML EMBED SNIPPET</span>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleCopy(embedLeaderboardCode, "embed-leaderboard")}
                      className="bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-bold text-xs h-7 px-3 rounded-lg cursor-pointer shadow-xs flex items-center gap-1.5"
                    >
                      {copiedLink === "embed-leaderboard" ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Embed Code</span>
                        </>
                      )}
                    </Button>
                  </div>
                  <pre className="p-4 text-xs font-mono text-slate-200 dark:text-[#D0D0D1] overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                    {embedLeaderboardCode}
                  </pre>
                </div>

                {/* Direct Link Alternative */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#212327] border border-slate-200 dark:border-[#2A2D31] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-bold text-slate-700 dark:text-slate-200 shrink-0">Direct Leaderboard URL:</span>
                    <code className="text-xs font-mono text-[#FE760B] truncate">
                      {embedLeaderboardUrl}
                    </code>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleCopy(embedLeaderboardUrl, "embed-leaderboard-url")}
                    className="text-xs h-8 px-3 text-[#FE760B] hover:text-[#FF8A2B] hover:bg-[#FE760B]/10 font-semibold cursor-pointer shrink-0 self-start sm:self-auto"
                  >
                    {copiedLink === "embed-leaderboard-url" ? "Copied URL!" : "Copy Direct URL"}
                  </Button>
                </div>
              </div>

              {/* Leaderboard Live Preview */}
              <div className="bg-white dark:bg-[#1A1C1F] rounded-2xl border border-slate-200 dark:border-[#2A2D31] p-5 sm:p-6 space-y-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Award className="w-4 h-4 text-[#FE760B]" />
                    <span>Leaderboard Live Rankings Preview</span>
                  </h2>
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
                          <span
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              item.rank === 1
                                ? "bg-amber-400 text-black font-extrabold"
                                : item.rank === 2
                                ? "bg-slate-300 text-black"
                                : item.rank === 3
                                ? "bg-amber-700 text-white"
                                : "text-slate-400"
                            }`}
                          >
                            {item.rank}
                          </span>
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            {item.displayName}
                          </span>
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
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB 8: PROGRAM SETTINGS
      ══════════════════════════════════════════════════════ */}
      {activeTab === "settings" && (
        <div className="space-y-6 animate-fade-in max-w-4xl">
          {/* Card 1: Program General Settings */}
          <div className="bg-white dark:bg-[#1A1C1F] rounded-2xl border border-slate-200 dark:border-[#2A2D31] p-5 sm:p-6 space-y-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-[#2A2D31]">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-[#FE760B]" />
                  <span>Program Settings & Information</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-[#9B9EA4] mt-0.5">
                  Update your campus ambassador program profile, target institutions, and schedule.
                </p>
              </div>

              {/* Status Badge */}
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                    program.status === "published"
                      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                      : program.status === "archived"
                      ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
                      : "bg-amber-500/15 text-amber-400 border-amber-500/30"
                  }`}
                >
                  {program.status || "Draft"}
                </span>
              </div>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              {/* Program ID Read-Only with Copy */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 dark:text-[#D0D0D1]">
                  Program ID
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={program.id}
                    className="font-mono text-xs h-9 bg-slate-50 dark:bg-[#212327] border-slate-200 dark:border-[#2A2D31] text-slate-600 dark:text-[#9B9EA4]"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(program.id, "program-id")}
                    className="h-9 px-3 text-xs bg-slate-100 dark:bg-[#212327] hover:bg-slate-200 dark:hover:bg-[#2A2D31] border-slate-200 dark:border-[#2A2D31] text-slate-700 dark:text-slate-200 cursor-pointer shrink-0"
                  >
                    {copiedLink === "program-id" ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy ID</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Program Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Program Name <span className="text-[#FE760B]">*</span>
                </label>
                <Input
                  type="text"
                  required
                  placeholder="e.g. Pravaah 2026 Campus Ambassador Program"
                  value={settingsForm.title}
                  onChange={(e) => setSettingsForm((prev) => ({ ...prev, title: e.target.value }))}
                  className="bg-slate-50 dark:bg-[#212327] border-slate-200 dark:border-[#2A2D31] text-slate-900 dark:text-white text-xs h-10 rounded-xl focus:border-[#FE760B]"
                />
              </div>

              {/* Campus / University Focus */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Target Campus / Institution
                </label>
                <Input
                  type="text"
                  placeholder="e.g. CUSAT, Kochi or All Colleges"
                  value={settingsForm.college}
                  onChange={(e) => setSettingsForm((prev) => ({ ...prev, college: e.target.value }))}
                  className="bg-slate-50 dark:bg-[#212327] border-slate-200 dark:border-[#2A2D31] text-slate-900 dark:text-white text-xs h-10 rounded-xl focus:border-[#FE760B]"
                />
                <p className="text-[11px] text-slate-500 dark:text-[#9B9EA4]">
                  Helps categorize and target student ambassadors from specific colleges or regions.
                </p>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Program Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Describe the ambassador program, responsibilities, rewards, and eligibility..."
                  value={settingsForm.description}
                  onChange={(e) => setSettingsForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-[#212327] border border-slate-200 dark:border-[#2A2D31] text-slate-900 dark:text-white text-xs p-3 rounded-xl focus:border-[#FE760B] focus:outline-hidden resize-none"
                />
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#FE760B]" />
                    <span>Program Start Date</span>
                  </label>
                  <Input
                    type="date"
                    value={settingsForm.startDate}
                    onChange={(e) => setSettingsForm((prev) => ({ ...prev, startDate: e.target.value }))}
                    className="bg-slate-50 dark:bg-[#212327] border-slate-200 dark:border-[#2A2D31] text-slate-900 dark:text-white text-xs h-10 rounded-xl focus:border-[#FE760B] [color-scheme:dark]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#FE760B]" />
                    <span>Program End Date</span>
                  </label>
                  <Input
                    type="date"
                    value={settingsForm.endDate}
                    onChange={(e) => setSettingsForm((prev) => ({ ...prev, endDate: e.target.value }))}
                    className="bg-slate-50 dark:bg-[#212327] border-slate-200 dark:border-[#2A2D31] text-slate-900 dark:text-white text-xs h-10 rounded-xl focus:border-[#FE760B] [color-scheme:dark]"
                  />
                </div>
              </div>

              {/* Save Button */}
              <div className="pt-3 border-t border-slate-100 dark:border-[#2A2D31] flex justify-end">
                <Button
                  type="submit"
                  disabled={savingSettings}
                  className="bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-bold text-xs h-10 px-5 rounded-xl cursor-pointer shadow-md flex items-center gap-2"
                >
                  {savingSettings ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Settings...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Save Changes</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>

          {/* Card 2: Danger Zone */}
          <div className="bg-white dark:bg-[#1A1C1F] rounded-2xl border border-rose-500/25 p-5 sm:p-6 space-y-4 shadow-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500" />
              <h2 className="text-base font-bold text-rose-500">Danger Zone</h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-[#9B9EA4] max-w-xl">
              Archiving a program pauses all referral tracking, closes applications, and freezes rewards redemption. You can restore it to draft anytime if you wish to resume.
            </p>
            <div className="pt-2">
              {program.status !== "archived" ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (confirm("Are you sure you want to archive this ambassador program? Active referrals and redemptions will be paused.")) {
                      handleStatusChange("archived");
                    }
                  }}
                  className="text-xs text-rose-500 border-rose-500/40 hover:bg-rose-500/10 cursor-pointer font-semibold rounded-xl h-9 px-4"
                >
                  Archive Program
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleStatusChange("draft")}
                  className="text-xs text-amber-400 border-amber-500/40 hover:bg-amber-500/10 cursor-pointer font-semibold rounded-xl h-9 px-4"
                >
                  Restore to Draft
                </Button>
              )}
            </div>
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
      {isAdjustModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAdjustModalOpen(false);
          }}
        >
          <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl sm:rounded-3xl max-w-sm w-full max-h-[90vh] flex flex-col p-5 sm:p-6 shadow-2xl my-auto text-white animate-scale-in overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#2A2D31] pb-3.5 shrink-0">
              <h3 className="text-base font-bold text-white tracking-tight">
                {adjustTargetAmb ? `Adjust Points: ${adjustTargetAmb.fullName}` : "Manual Points Adjustment"}
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
                  Ambassador *
                </label>
                <select
                  value={adjustTargetAmb?.id || ""}
                  onChange={(e) => {
                    const found = ambassadors.find((a) => a.id === e.target.value);
                    setAdjustTargetAmb(found || null);
                  }}
                  required
                  className="w-full bg-[#212327] border border-[#2A2D31] text-xs sm:text-sm text-white h-10 rounded-xl px-3 focus:border-[#FE760B]"
                >
                  <option value="">Select ambassador...</option>
                  {ambassadors.map((amb) => (
                    <option key={amb.id} value={amb.id}>
                      {amb.fullName} ({amb.referralCode || amb.id.slice(0, 8)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#9B9EA4] uppercase tracking-wider block mb-1.5">
                  Points Delta (+ or -) *
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
                  placeholder="Mandatory reason for ledger audit record"
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

