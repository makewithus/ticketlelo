"use client";

import { useState, useEffect } from "react";
import {
  Building2,
  FileCheck2,
  TrendingUp,
  Receipt,
  RotateCcw,
  PieChart as PieIcon,
  BarChart3,
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
import { BrandLoader } from "@/components/ui/brand-loader";

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

export default function SuperAdminPaymentsPage() {
  const [activeTab, setActiveTab] = useState("overview"); // "overview" | "reconcile"
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [trendData, setTrendData] = useState([]);
  const [reconReports, setReconReports] = useState([]);
  const [runningRecon, setRunningRecon] = useState(false);

  const loadData = async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const [sumRes, reconRes, overviewRes] = await Promise.all([
        fetch("/api/payments/summary"),
        fetch("/api/payments/reconcile"),
        fetch("/api/superadmin/overview"),
      ]);

      if (sumRes.ok) {
        const d = await sumRes.json();
        setSummary(d.summary || null);
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
    } catch (err) {
      console.error("[SuperAdminPayments] loadData error:", err);
    } finally {
      setLoading(false);
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
      alert(
        `Reconciliation complete! Checked ${data.report.totalOrdersChecked} orders. Discrepancies: ${data.report.discrepancyCount}`
      );
      await loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      setRunningRecon(false);
    }
  };

  // Build Pie Chart Data from real financial summary
  const grossVal = summary ? (summary.grossSalesPaise || 0) / 100 : 0;
  const organizerVal = summary ? (summary.organizerNetPaise || 0) / 100 : 0;
  const commissionVal = summary ? (summary.platformCommissionPaise || 0) / 100 : 0;
  const refundVal = summary ? (summary.refundedPaise || 0) / 100 : 0;

  const revenueSplitData = [
    { name: "Organizer Net Share", value: organizerVal, color: "#10B981" },
    { name: "Platform Margin", value: commissionVal, color: "#FE760B" },
    { name: "Refunds / Reversals", value: refundVal, color: "#EF4444" },
  ].filter((item) => item.value > 0);

  // If no volume yet, display fallback distribution structure
  const displayPieData =
    revenueSplitData.length > 0
      ? revenueSplitData
      : [
          { name: "Organizer Net Share (97%)", value: 97, color: "#10B981" },
          { name: "Platform Margin (3%)", value: 3, color: "#FE760B" },
        ];

  // Bar Graph data from overview or generated from summary
  const displayBarData =
    trendData.length > 0
      ? trendData
      : [
          { date: "Current Period", gmv: grossVal, commission: commissionVal },
        ];

  if (loading) {
    return <BrandLoader message="Loading..." fullScreen />;
  }

  return (
    <div className="space-y-6 text-[#1E293B] dark:text-white">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Marketplace Payments & Analytics</h1>
          <p className="text-xs text-slate-500 dark:text-[#9B9EA4] mt-1">
            Global double-entry settlement metrics, revenue velocity, and ledger reconciliation audits.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRunRecon}
            disabled={runningRecon}
            className="px-4 py-2 rounded-xl bg-[#FE760B] hover:bg-[#FF8A2B] text-white text-xs font-bold shadow-md shadow-[#FE760B]/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <FileCheck2 size={15} className={runningRecon ? "animate-spin" : ""} />
            {runningRecon ? "Auditing..." : "Run Reconciliation"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-[#2A2D31] pb-2 text-xs font-semibold">
        {[
          { id: "overview", label: "Financial Analytics", icon: TrendingUp },
          { id: "reconcile", label: "Reconciliation Audits", icon: FileCheck2 },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all cursor-pointer ${
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

      {/* Tab 2: Reconciliation Reports */}
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

          <div className="overflow-x-auto text-xs">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-200 dark:border-[#2A2D31] text-slate-500 dark:text-[#9E9E9F]">
                  <th className="pb-3 font-semibold">Report ID</th>
                  <th className="pb-3 font-semibold">Audited Orders</th>
                  <th className="pb-3 font-semibold">Matched</th>
                  <th className="pb-3 font-semibold">Discrepancies</th>
                  <th className="pb-3 font-semibold text-right">Audited Volume (INR)</th>
                  <th className="pb-3 font-semibold text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#2A2D31]/50 text-slate-800 dark:text-white">
                {reconReports.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No reconciliation audits recorded yet. Click &quot;Run Reconciliation&quot; above.
                    </td>
                  </tr>
                ) : (
                  reconReports.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-[#212327]/40 transition-colors">
                      <td className="py-3 font-mono text-[11px] text-[#FE760B]">{r.reportId}</td>
                      <td className="py-3 font-semibold">{r.totalOrdersChecked}</td>
                      <td className="py-3 text-emerald-500 font-semibold">{r.matchedCount}</td>
                      <td className="py-3">
                        {r.discrepancyCount > 0 ? (
                          <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20 font-bold text-[10px]">
                            {r.discrepancyCount} Issues Found
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[10px] font-semibold">
                            0 Discrepancies
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-right font-semibold">
                        ₹{(Number(r.summary?.totalGrossPaise || 0) / 100).toFixed(2)}
                      </td>
                      <td className="py-3 text-right text-slate-400">
                        {r.generatedAt ? new Date(r.generatedAt).toLocaleString("en-IN") : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
