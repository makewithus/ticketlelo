"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Building2,
  FileCheck2,
  TrendingUp,
  Receipt,
  RotateCcw,
  PieChart as PieIcon,
  BarChart3,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  PlayCircle,
  PauseCircle,
  Settings2,
  Sliders,
  RefreshCw,
  Search,
  Filter,
  Shield,
  MessageSquare,
  ArrowRight,
  ExternalLink,
  Percent,
  Check,
  X,
  Wallet,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { toast } from "sonner";
import { BrandLoader } from "@/components/ui/brand-loader";
import { SuperAdminPayoutManagement } from "@/components/admin/payments/superadmin-payout-management";
import { SuperAdminTableSkeleton } from "@/components/ui/skeleton";
import { getCachedItem, setCachedItem } from "@/lib/client-cache";

// Custom dark mode tooltip for Recharts
function FinancialChartTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div className="p-3 bg-[#1A1C1F] border border-[#2A2D31] rounded-xl shadow-2xl text-xs space-y-1.5 backdrop-blur-md">
        <p className="font-bold text-white border-b border-[#2A2D31] pb-1">{label}</p>
        {payload.map((entry, index) => (
          <div key={`item-${index}`} className="flex items-center justify-between gap-4">
            <span style={{ color: entry.color }} className="font-medium flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              {entry.name}:
            </span>
            <span className="font-bold text-white font-mono">
              ₹{Number(entry.value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

const SETTLEMENT_STATUS_STYLES = {
  SCHEDULED: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  PENDING: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  PROCESSING: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
  COMPLETED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  HELD: "bg-rose-500/10 text-rose-400 border-rose-500/30 font-bold",
  FAILED: "bg-red-500/15 text-red-400 border-red-500/40 font-bold",
  REVERSED: "bg-slate-500/10 text-slate-400 border-slate-500/30",
};

export default function SuperAdminPaymentsPage() {
  const [activeTab, setActiveTab] = useState("overview"); // "overview" | "settlements" | "commissions" | "reconcile"
  // Safe SSR hydration - avoids hydration mismatch
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [trendData, setTrendData] = useState([]);
  const [reconReports, setReconReports] = useState([]);
  const [runningRecon, setRunningRecon] = useState(false);

  // Fast-path client cache check on mount (runs after hydration, so zero SSR mismatch)
  useEffect(() => {
    try {
      const cached = getCachedItem("superadmin_payments_summary");
      if (cached) {
        setSummary(cached);
        setLoading(false);
      }
    } catch {}
  }, []);

  // Settlements state
  const [settlements, setSettlements] = useState([]);
  const [settlementSummary, setSettlementSummary] = useState(null);
  const [settlementSearch, setSettlementSearch] = useState("");
  const [settlementStatusFilter, setSettlementStatusFilter] = useState("ALL");
  const [processingBatch, setProcessingBatch] = useState(false);

  // Hold / Release Modal State
  const [selectedSettlementForHold, setSelectedSettlementForHold] = useState(null);
  const [holdModalAction, setHoldModalAction] = useState("hold"); // "hold" | "release"
  const [holdReasonInput, setHoldReasonInput] = useState("");
  const [submittingHold, setSubmittingHold] = useState(false);

  // Commission Rates State
  const [commissionPlans, setCommissionPlans] = useState([]);
  const [editingPlan, setEditingPlan] = useState(null);
  const [newFeePercent, setNewFeePercent] = useState("");
  const [feeUpdateReason, setFeeUpdateReason] = useState("");
  const [updatingFee, setUpdatingFee] = useState(false);

  const loadData = async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const [sumRes, reconRes, overviewRes, settleRes, commRes] = await Promise.all([
        fetch("/api/payments/summary"),
        fetch("/api/payments/reconcile"),
        fetch("/api/superadmin/overview"),
        fetch("/api/payments/settlements"),
        fetch("/api/payments/commission?all=true"),
      ]);

      if (sumRes.ok) {
        const d = await sumRes.json();
        setSummary(d.summary || null);
        if (d.summary) {
          setCachedItem("superadmin_payments_summary", d.summary, 15 * 60 * 1000);
        }
      }
      if (reconRes.ok) {
        const d = await reconRes.json();
        setReconReports(d.reports || []);
      }
      if (overviewRes.ok) {
        const ov = await overviewRes.json();
        if (Array.isArray(ov.revenueTrendData) && ov.revenueTrendData.length > 0) {
          setTrendData(ov.revenueTrendData);
        }
      }
      if (settleRes.ok) {
        const setD = await settleRes.json();
        setSettlements(setD.settlements || []);
        setSettlementSummary(setD.summary || null);
      }
      if (commRes.ok) {
        const commD = await commRes.json();
        setCommissionPlans(commD.planRules || []);
      }
    } catch (err) {
      console.error("[SuperAdminPayments] loadData error:", err);
      toast.error("Failed to load payment & settlement records");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRunRecon = async () => {
    setRunningRecon(true);
    try {
      const res = await fetch("/api/payments/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 100 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reconciliation failed");
      toast.success(
        `Reconciliation complete! Checked ${data.report.totalOrdersChecked} orders. Discrepancies: ${data.report.discrepancyCount}`
      );
      await loadData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRunningRecon(false);
    }
  };

  // Run Batch Settlement Process (Cron manual trigger)
  const handleRunBatchSettlements = async () => {
    setProcessingBatch(true);
    try {
      const res = await fetch("/api/cron/process-settlements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Batch settlement processing failed");
      toast.success(
        `Batch settlement process executed! Processed: ${data.processedCount || 0}, Completed: ${data.completedCount || 0}, Failed: ${data.failedCount || 0}`
      );
      await loadData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setProcessingBatch(false);
    }
  };

  // Hold or Release Settlement
  const handleConfirmHoldOrRelease = async () => {
    if (!selectedSettlementForHold) return;
    if (holdModalAction === "hold" && !holdReasonInput.trim()) {
      toast.error("Please provide a reason for placing this settlement on hold");
      return;
    }

    setSubmittingHold(true);
    try {
      const res = await fetch("/api/superadmin/settlements/hold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settlementId: selectedSettlementForHold.id,
          action: holdModalAction,
          reason: holdReasonInput.trim() || "Released by Super Admin",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update settlement hold status");
      toast.success(
        holdModalAction === "hold"
          ? "Settlement placed on administrative hold"
          : "Settlement hold released"
      );
      setSelectedSettlementForHold(null);
      setHoldReasonInput("");
      await loadData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmittingHold(false);
    }
  };

  // Retry Settlement
  const handleRetrySettlement = async (settlementId) => {
    try {
      const res = await fetch("/api/superadmin/settlements/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settlementId,
          reason: "Manual retry triggered from Super Admin Payments dashboard",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to retry settlement");
      toast.success("Settlement reset to SCHEDULED status for next batch execution");
      await loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Update Platform Commission Fee
  const handleUpdateCommissionRate = async () => {
    if (!editingPlan) return;
    const rate = parseFloat(newFeePercent);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      toast.error("Please enter a valid percentage between 0% and 100%");
      return;
    }
    if (!feeUpdateReason.trim()) {
      toast.error("Please provide an audit reason for changing the platform fee");
      return;
    }

    setUpdatingFee(true);
    try {
      const res = await fetch("/api/payments/commission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: editingPlan.planId,
          percentage: rate,
          reason: feeUpdateReason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update commission rate");
      toast.success(`Platform fee for ${editingPlan.planId} updated to ${rate}%`);
      setEditingPlan(null);
      setNewFeePercent("");
      setFeeUpdateReason("");
      await loadData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUpdatingFee(false);
    }
  };

  // Filter settlements list
  const filteredSettlements = useMemo(() => {
    return settlements.filter((s) => {
      const matchesStatus =
        settlementStatusFilter === "ALL" || s.status === settlementStatusFilter;
      const q = settlementSearch.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (s.id || "").toLowerCase().includes(q) ||
        (s.orderId || "").toLowerCase().includes(q) ||
        (s.organizerId || "").toLowerCase().includes(q) ||
        (s.organizerName || "").toLowerCase().includes(q) ||
        (s.eventId || "").toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [settlements, settlementStatusFilter, settlementSearch]);

  // Financial values
  const grossVal = summary ? (summary.grossSalesPaise || 0) / 100 : 0;
  const organizerVal = summary ? (summary.organizerNetPaise || 0) / 100 : 0;
  const commissionVal = summary ? (summary.platformCommissionPaise || 0) / 100 : 0;
  const refundVal = summary ? (summary.refundedPaise || 0) / 100 : 0;

  // Additional 6 settlement metrics
  const pendingSettlementPaise = settlementSummary?.pendingSettlementPaise ?? summary?.pendingSettlementPaise ?? 0;
  const completedSettlementPaise = settlementSummary?.completedSettlementPaise ?? summary?.completedSettlementPaise ?? 0;
  const heldSettlementPaise = settlementSummary?.heldSettlementPaise ?? summary?.heldSettlementPaise ?? 0;
  const failedSettlementPaise = settlementSummary?.failedSettlementPaise ?? summary?.failedSettlementPaise ?? 0;
  const estimatedGatewayChargesPaise = settlementSummary?.estimatedGatewayChargesPaise ?? summary?.estimatedGatewayChargesPaise ?? 0;

  const revenueSplitData = [
    { name: "Organizer Net Share", value: organizerVal, color: "#10B981" },
    { name: "Platform Margin", value: commissionVal, color: "#FE760B" },
    { name: "Refunds / Reversals", value: refundVal, color: "#EF4444" },
  ].filter((item) => item.value > 0);

  const displayPieData =
    revenueSplitData.length > 0
      ? revenueSplitData
      : [
          { name: "Organizer Net Share (97%)", value: 97, color: "#10B981" },
          { name: "Platform Margin (3%)", value: 3, color: "#FE760B" },
        ];

  const displayBarData =
    trendData.length > 0
      ? trendData
      : [
          { date: "Current Period", gmv: grossVal, commission: commissionVal },
        ];

  if (loading && !summary) {
    return <SuperAdminTableSkeleton />;
  }

  return (
    <div className="space-y-6 text-[#1E293B] dark:text-white">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Marketplace Payments & Settlements</h1>
          <p className="text-xs text-slate-500 dark:text-[#9B9EA4] mt-1">
            Double-entry ledger control, calendar-aware T+4 organizer settlements, and platform commission management.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setRefreshing(true);
              loadData();
            }}
            disabled={refreshing}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-[#2A2D31] hover:bg-slate-100 dark:hover:bg-[#212327] text-slate-600 dark:text-[#9B9EA4] transition-all cursor-pointer disabled:opacity-50"
            title="Refresh financial data"
          >
            <RefreshCw size={15} className={refreshing ? "animate-spin text-[#FE760B]" : ""} />
          </button>

          {activeTab === "settlements" && (
            <button
              onClick={handleRunBatchSettlements}
              disabled={processingBatch}
              className="px-4 py-2 rounded-xl bg-[#FE760B] hover:bg-[#FF8A2B] text-white text-xs font-bold shadow-md shadow-[#FE760B]/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <PlayCircle size={15} className={processingBatch ? "animate-spin" : ""} />
              {processingBatch ? "Executing Batch..." : "Process Due Settlements (T+4)"}
            </button>
          )}

          {activeTab === "reconcile" && (
            <button
              onClick={handleRunRecon}
              disabled={runningRecon}
              className="px-4 py-2 rounded-xl bg-[#FE760B] hover:bg-[#FF8A2B] text-white text-xs font-bold shadow-md shadow-[#FE760B]/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <FileCheck2 size={15} className={runningRecon ? "animate-spin" : ""} />
              {runningRecon ? "Auditing..." : "Run Reconciliation"}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-[#2A2D31] pb-2 text-xs font-semibold overflow-x-auto no-scrollbar">
        {[
          { id: "payouts", label: "Payout Management (Manual UPI & T+4)", icon: Wallet },
          { id: "overview", label: "Financial Analytics", icon: TrendingUp },
          { id: "settlements", label: `Order Settlements (${settlements.length})`, icon: Clock },
          { id: "commissions", label: "Commission Settings", icon: Percent },
          { id: "reconcile", label: "Reconciliation Audits", icon: FileCheck2 },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? "bg-[#FE760B]/10 text-[#FE760B] border border-[#FE760B]/20 font-bold"
                  : "text-slate-500 dark:text-[#9B9EA4] hover:text-black dark:hover:text-white"
              }`}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab 0: Organizer Payout Management (PART 3, 4, 5) */}
      {activeTab === "payouts" && <SuperAdminPayoutManagement />}

      {/* Tab 1: Financial Analytics (Bar Graph & Pie Chart) */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* 4 Metric Summary Tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] shadow-sm">
              <div className="flex items-center justify-between text-slate-500 dark:text-[#9E9E9F] mb-2 text-xs font-medium">
                <span>Platform Gross Volume (GMV)</span>
                <TrendingUp size={16} className="text-[#FE760B]" />
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                ₹{grossVal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-[#9E9E9F] mt-1">Total attendee checkout collections</p>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] shadow-sm">
              <div className="flex items-center justify-between text-slate-500 dark:text-[#9E9E9F] mb-2 text-xs font-medium">
                <span>Platform Commission Earned</span>
                <Receipt size={16} className="text-amber-500" />
              </div>
              <div className="text-2xl font-black text-amber-500 font-mono">
                ₹{commissionVal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-[#9E9E9F] mt-1">TicketLelo marketplace net margin</p>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] shadow-sm">
              <div className="flex items-center justify-between text-slate-500 dark:text-[#9E9E9F] mb-2 text-xs font-medium">
                <span>Organizer Net Payable</span>
                <Building2 size={16} className="text-emerald-500" />
              </div>
              <div className="text-2xl font-black text-emerald-500 font-mono">
                ₹{organizerVal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-[#9E9E9F] mt-1">Allocated to creators via Route transfers</p>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] shadow-sm">
              <div className="flex items-center justify-between text-slate-500 dark:text-[#9E9E9F] mb-2 text-xs font-medium">
                <span>Total Refunded Value</span>
                <RotateCcw size={16} className="text-rose-500" />
              </div>
              <div className="text-2xl font-black text-rose-500 font-mono">
                ₹{refundVal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-[#9E9E9F] mt-1">Clawed back via Route transfer reversals</p>
            </div>
          </div>

          {/* Dedicated Financial Analytics Section: ONLY Bar Graph and Pie Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chart 1: Bar Graph (GMV vs Platform Margin) */}
            <div className="lg:col-span-2 p-5 rounded-2xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <BarChart3 size={16} className="text-[#FE760B]" />
                    Gross Volume (GMV) vs Platform Commission
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-[#9B9EA4]">
                    Revenue volume and net platform margin per reporting interval
                  </p>
                </div>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={displayBarData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2A2D31" opacity={0.2} vertical={false} />
                    <XAxis dataKey="date" stroke="#9B9EA4" fontSize={11} tickLine={false} />
                    <YAxis
                      stroke="#9B9EA4"
                      fontSize={11}
                      tickLine={false}
                      tickFormatter={(v) => `₹${v}`}
                    />
                    <Tooltip content={<FinancialChartTooltip />} />
                    <Bar
                      dataKey="gmv"
                      name="Gross GMV (INR)"
                      fill="#FE760B"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="commission"
                      name="Platform Margin (INR)"
                      fill="#10B981"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Pie Chart (Revenue Split Distribution) */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] shadow-sm space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <PieIcon size={16} className="text-emerald-500" />
                  Revenue Allocation Split
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-[#9B9EA4]">
                  Breakdown across creators, platform margin, and reversals
                </p>
              </div>

              <div className="h-52 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={displayPieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={3}
                    >
                      {displayPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<FinancialChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Clean Legend */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-[#2A2D31] text-xs">
                {displayPieData.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-slate-600 dark:text-[#D0D0D1]">{item.name}</span>
                    </div>
                    <span className="font-bold text-slate-900 dark:text-white font-mono">
                      ₹{item.value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Marketplace Settlements & Payouts */}
      {activeTab === "settlements" && (
        <div className="space-y-6">
          {/* 6 Metric Rollup Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-4 rounded-xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31]">
              <span className="text-[11px] text-slate-400 font-medium">Gross GMV</span>
              <div className="text-base font-extrabold text-slate-900 dark:text-white font-mono mt-1">
                ₹{(grossVal).toFixed(2)}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31]">
              <span className="text-[11px] text-amber-500 font-medium">Platform Fees</span>
              <div className="text-base font-extrabold text-amber-500 font-mono mt-1">
                ₹{(commissionVal).toFixed(2)}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31]">
              <span className="text-[11px] text-blue-400 font-medium">Pending Payouts</span>
              <div className="text-base font-extrabold text-blue-400 font-mono mt-1">
                ₹{(pendingSettlementPaise / 100).toFixed(2)}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31]">
              <span className="text-[11px] text-emerald-400 font-medium">Completed Payouts</span>
              <div className="text-base font-extrabold text-emerald-400 font-mono mt-1">
                ₹{(completedSettlementPaise / 100).toFixed(2)}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31]">
              <span className="text-[11px] text-rose-400 font-medium">Held Payouts</span>
              <div className="text-base font-extrabold text-rose-400 font-mono mt-1">
                ₹{(heldSettlementPaise / 100).toFixed(2)}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31]">
              <span className="text-[11px] text-slate-400 font-medium">Gateway Charges (Est)</span>
              <div className="text-base font-extrabold text-slate-400 font-mono mt-1">
                ₹{(estimatedGatewayChargesPaise / 100).toFixed(2)}
              </div>
            </div>
          </div>

          {/* Search and Status Filters */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-xs">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search settlements by ID, Order ID, Organizer, or Event..."
                value={settlementSearch}
                onChange={(e) => setSettlementSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-[#131517] border border-slate-200 dark:border-[#2A2D31] text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#FE760B]"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter size={14} className="text-slate-400" />
              <select
                value={settlementStatusFilter}
                onChange={(e) => setSettlementStatusFilter(e.target.value)}
                aria-label="Filter settlements by status"
                className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#131517] border border-slate-200 dark:border-[#2A2D31] text-xs text-slate-800 dark:text-[#D0D0D1] focus:outline-none focus:border-[#FE760B]"
              >
                <option value="ALL">All Statuses</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="PENDING">Pending</option>
                <option value="PROCESSING">Processing</option>
                <option value="COMPLETED">Completed</option>
                <option value="HELD">Held</option>
                <option value="FAILED">Failed</option>
                <option value="REVERSED">Reversed</option>
              </select>
            </div>
          </div>

          {/* Settlements Table */}
          <div className="rounded-2xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-[#2A2D31] bg-slate-50/50 dark:bg-[#131517]/50 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">Settlement ID</th>
                    <th className="py-3 px-4">Organizer</th>
                    <th className="py-3 px-4">Order / Event</th>
                    <th className="py-3 px-4 text-right">Net Payable</th>
                    <th className="py-3 px-4 text-right">Platform Fee</th>
                    <th className="py-3 px-4">Due Date (T+4)</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#2A2D31]">
                  {filteredSettlements.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        No settlement records matching the criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredSettlements.map((st) => {
                      const statusStyle =
                        SETTLEMENT_STATUS_STYLES[st.status] || SETTLEMENT_STATUS_STYLES.SCHEDULED;

                      return (
                        <tr key={st.id} className="hover:bg-slate-50 dark:hover:bg-[#212327]/40 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                            {st.id}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900 dark:text-white">
                              {st.organizerName || st.organizerId}
                            </div>
                            <div className="text-[10px] text-slate-400">{st.organizerEmail || st.organizationId}</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-mono text-slate-600 dark:text-slate-300">{st.orderId}</div>
                            <div className="text-[10px] text-slate-400">{st.eventTitle || st.eventId}</div>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-emerald-500">
                            ₹{((st.netPayablePaise || st.amountPaise || 0) / 100).toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-amber-500 font-semibold">
                            ₹{((st.platformFeePaise || 0) / 100).toFixed(2)}
                            {st.planFeePercentage && (
                              <span className="text-[10px] text-slate-400 ml-1">({st.planFeePercentage}%)</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                              <Calendar size={12} className="text-slate-400" />
                              <span>{st.scheduledSettlementDate || (st.scheduledFor ? new Date(st.scheduledFor).toLocaleDateString("en-IN") : "T+4")}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusStyle}`}>
                              {st.status}
                            </span>
                            {st.holdReason && (
                              <p className="text-[10px] text-rose-400 mt-0.5 line-clamp-1" title={st.holdReason}>
                                Held: {st.holdReason}
                              </p>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right space-x-2">
                            {st.status === "HELD" ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedSettlementForHold(st);
                                  setHoldModalAction("release");
                                  setHoldReasonInput("");
                                }}
                                className="px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold text-[11px] transition-colors cursor-pointer"
                              >
                                Release
                              </button>
                            ) : st.status !== "COMPLETED" && st.status !== "REVERSED" ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedSettlementForHold(st);
                                  setHoldModalAction("hold");
                                  setHoldReasonInput("");
                                }}
                                className="px-2 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold text-[11px] transition-colors cursor-pointer"
                              >
                                Hold
                              </button>
                            ) : null}

                            {st.status === "FAILED" && (
                              <button
                                type="button"
                                onClick={() => handleRetrySettlement(st.id)}
                                className="px-2 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 font-bold text-[11px] transition-colors cursor-pointer"
                              >
                                Retry
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Platform Commission Settings */}
      {activeTab === "commissions" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Subscription Platform Fee Matrix</h2>
            <p className="text-xs text-slate-500 dark:text-[#9B9EA4]">
              Configure default transaction fee percentages per subscription tier. Automatically snapshot at payment time.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {commissionPlans.map((plan) => {
              const defaultRates = { START: 5.0, CAMPUS: 4.5, FEST: 3.5 };
              const currentRate = plan.percentage ?? defaultRates[plan.planId] ?? 5.0;

              return (
                <div
                  key={plan.planId}
                  className="p-6 rounded-2xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] shadow-sm space-y-4 relative overflow-hidden"
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-extrabold uppercase tracking-wider bg-[#FE760B]/10 text-[#FE760B] border border-[#FE760B]/30">
                      {plan.planId} Plan
                    </span>
                    <span className="text-[11px] text-slate-400">Tier #{plan.planId}</span>
                  </div>

                  <div>
                    <div className="text-3xl font-black text-slate-900 dark:text-white font-mono">
                      {currentRate}%
                    </div>
                    <p className="text-xs text-slate-400 mt-1">Platform fee per ticket checkout</p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-[#2A2D31] text-[11px] text-slate-500 dark:text-[#9B9EA4] space-y-1">
                    <div>
                      Last updated:{" "}
                      <span className="text-white">
                        {plan.updatedAt ? new Date(plan.updatedAt).toLocaleDateString("en-IN") : "Default Baseline"}
                      </span>
                    </div>
                    {plan.reason && (
                      <div className="line-clamp-1 italic text-slate-400">&ldquo;{plan.reason}&rdquo;</div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setEditingPlan(plan);
                      setNewFeePercent(String(currentRate));
                      setFeeUpdateReason("");
                    }}
                    className="w-full py-2 rounded-xl bg-slate-100 dark:bg-[#212327] hover:bg-[#FE760B] hover:text-white text-slate-800 dark:text-[#D0D0D1] text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Settings2 size={13} />
                    <span>Configure {plan.planId} Rate</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 4: Reconciliation Reports */}
      {activeTab === "reconcile" && (
        <div className="p-6 rounded-2xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Financial Reconciliation Audit Trail</h3>
              <p className="text-xs text-slate-500 dark:text-[#9E9E9F]">
                Automated audits cross-referencing orders, Route transfer splits, and double-entry ledger entries.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-[#2A2D31] text-slate-400 font-bold uppercase text-[10px]">
                  <th className="py-2.5 px-3">Audit Time</th>
                  <th className="py-2.5 px-3">Orders Checked</th>
                  <th className="py-2.5 px-3">Total Checked GMV</th>
                  <th className="py-2.5 px-3">Discrepancies</th>
                  <th className="py-2.5 px-3">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#2A2D31]">
                {reconReports.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      No reconciliation audits recorded yet. Click &ldquo;Run Reconciliation&rdquo; above.
                    </td>
                  </tr>
                ) : (
                  reconReports.map((r, i) => (
                    <tr key={r.id || i} className="hover:bg-slate-50 dark:hover:bg-[#212327]/30">
                      <td className="py-3 px-3 text-slate-400">
                        {r.createdAt ? new Date(r.createdAt).toLocaleString("en-IN") : "Just now"}
                      </td>
                      <td className="py-3 px-3 font-semibold text-white">{r.totalOrdersChecked || 0}</td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-200">
                        ₹{((r.totalGMVPaise || 0) / 100).toFixed(2)}
                      </td>
                      <td className="py-3 px-3 font-semibold text-rose-400">{r.discrepancyCount || 0}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            (r.discrepancyCount || 0) === 0
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                              : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                          }`}
                        >
                          {(r.discrepancyCount || 0) === 0 ? "BALANCED & VERIFIED" : "DISCREPANCY FLAGGED"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Hold / Release Settlement Dialog (Exact Visual Style with Cross Icon & Mobile Responsive) */}
      {selectedSettlementForHold && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto">
          <div className="w-full max-w-md sm:max-w-lg bg-[#17191C] border border-[#2A2D31] rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col text-white animate-scale-in">
            {/* Header */}
            <div className="p-4 sm:p-5 bg-[#1A1C1F] border-b border-[#2A2D31] flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                    holdModalAction === "hold"
                      ? "bg-rose-500/12 border-rose-500/25 text-rose-400"
                      : "bg-emerald-500/12 border-emerald-500/25 text-emerald-400"
                  }`}
                >
                  <AlertTriangle size={18} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-white truncate">
                    {holdModalAction === "hold" ? "Place Settlement on Administrative Hold" : "Release Settlement Hold"}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-[#9E9E9F] truncate">
                    {holdModalAction === "hold"
                      ? "Halt automatic T+4 batch payouts for investigation"
                      : "Unfreeze settlement for next eligible payout batch"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSettlementForHold(null)}
                className="p-2 rounded-lg text-[#9E9E9F] hover:text-white hover:bg-[#212327] transition-colors shrink-0 cursor-pointer"
                aria-label="Close Modal"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto text-xs">
              {/* Settlement summary card */}
              <div className="p-3.5 rounded-xl bg-[#212327] border border-[#2A2D31] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-0.5 min-w-0">
                  <span className="text-[10px] uppercase font-bold text-[#9E9E9F] tracking-wider">Settlement Reference</span>
                  <div className="font-mono text-white text-xs font-semibold truncate">{selectedSettlementForHold.id}</div>
                </div>
                <div className="text-left sm:text-right space-y-0.5 shrink-0">
                  <span className="text-[10px] uppercase font-bold text-[#9E9E9F] tracking-wider">Organizer Net</span>
                  <div className="font-mono text-emerald-400 font-extrabold text-sm">
                    ₹{((selectedSettlementForHold.netPayablePaise || selectedSettlementForHold.amountPaise || 0) / 100).toFixed(2)}
                  </div>
                </div>
              </div>

              {holdModalAction === "hold" ? (
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#D0D0D1]">
                    Reason for Administrative Hold <span className="text-[#FE760B]">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={holdReasonInput}
                    onChange={(e) => setHoldReasonInput(e.target.value)}
                    placeholder="e.g. Chargeback risk investigation, bank account dispute, or organizer support ticket under review..."
                    className="w-full p-3 rounded-xl bg-[#212327] border border-[#2A2D31] text-xs text-white placeholder-[#9E9E9F] focus:outline-none focus:border-[#FE760B] transition-all resize-none"
                  />
                  <p className="text-[11px] text-[#9E9E9F]">
                    This note will be logged in the permanent audit trail with your admin ID.
                  </p>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs leading-relaxed">
                  Releasing the hold marks this record as verified and ready. If the payout maturity date (T+4) has passed, the batch processor will execute transfer on the next run.
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 sm:p-5 bg-[#1A1C1F]/60 border-t border-[#2A2D31] flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedSettlementForHold(null)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#212327] hover:bg-[#2A2D31] text-[#D0D0D1] hover:text-white transition-colors cursor-pointer text-center font-semibold text-xs sm:text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmHoldOrRelease}
                disabled={submittingHold || (holdModalAction === "hold" && !holdReasonInput.trim())}
                className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold transition-all disabled:opacity-50 cursor-pointer text-center text-xs sm:text-sm shadow-lg ${
                  holdModalAction === "hold"
                    ? "bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/20"
                    : "bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20"
                }`}
              >
                {submittingHold ? "Processing..." : holdModalAction === "hold" ? "Confirm Hold" : "Release Hold"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Commission Rate Dialog (Exact Visual Style with Cross Icon & Mobile Responsive) */}
      {editingPlan && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto">
          <div className="w-full max-w-md sm:max-w-lg bg-[#17191C] border border-[#2A2D31] rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col text-white animate-scale-in">
            {/* Header */}
            <div className="p-4 sm:p-5 bg-[#1A1C1F] border-b border-[#2A2D31] flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[#FE760B]/12 border border-[#FE760B]/25 flex items-center justify-center text-[#FE760B] shrink-0">
                  <Settings2 size={18} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-white truncate">
                    Configure {editingPlan.planId} Platform Fee
                  </h3>
                  <p className="text-[11px] sm:text-xs text-[#9E9E9F] truncate">
                    Set default platform deduction rate for this tier
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingPlan(null)}
                className="p-2 rounded-lg text-[#9E9E9F] hover:text-white hover:bg-[#212327] transition-colors shrink-0 cursor-pointer"
                aria-label="Close Modal"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto text-xs">
              <div>
                <label className="block text-xs font-semibold text-[#D0D0D1] mb-1.5">
                  Platform Fee Percentage (%) <span className="text-[#FE760B]">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={newFeePercent}
                    onChange={(e) => setNewFeePercent(e.target.value)}
                    className="w-full pl-3.5 pr-8 py-2.5 rounded-xl bg-[#212327] border border-[#2A2D31] text-sm text-white font-mono focus:outline-none focus:border-[#FE760B] transition-colors"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9E9E9F] text-xs font-bold">%</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#D0D0D1] mb-1.5">
                  Reason / Audit Log Note <span className="text-[#FE760B]">*</span>
                </label>
                <textarea
                  rows={2}
                  value={feeUpdateReason}
                  onChange={(e) => setFeeUpdateReason(e.target.value)}
                  placeholder="e.g. Annual campus festival discount promotion or revised executive fee schedule..."
                  className="w-full p-3 rounded-xl bg-[#212327] border border-[#2A2D31] text-xs text-white placeholder-[#9E9E9F] focus:outline-none focus:border-[#FE760B] transition-all resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 sm:p-5 bg-[#1A1C1F]/60 border-t border-[#2A2D31] flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setEditingPlan(null)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#212327] hover:bg-[#2A2D31] text-[#D0D0D1] hover:text-white transition-colors cursor-pointer text-center font-semibold text-xs sm:text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpdateCommissionRate}
                disabled={updatingFee || !newFeePercent || !feeUpdateReason.trim()}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#FE760B] hover:bg-[#FF8A2B] text-black font-bold transition-all disabled:opacity-50 cursor-pointer text-center text-xs sm:text-sm shadow-lg shadow-[#FE760B]/20"
              >
                {updatingFee ? "Saving..." : "Save Platform Fee"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
