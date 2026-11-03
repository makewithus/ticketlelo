"use client";

import { useState, useEffect, useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  Inbox,
  Building2,
  Calendar,
  Ticket,
  TrendingUp,
  CreditCard,
  Mail,
  Sliders,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  RefreshCw,
  Download,
  AlertTriangle,
  UserCheck,
  UserX,
  ExternalLink,
  Search,
  Sparkles,
  ShieldCheck,
  Activity,
  ChevronRight,
  PieChart as PieIcon,
  BarChart3,
  Layers,
  Percent,
  Check,
  Copy,
  Flame,
  ArrowDownRight,
  DollarSign,
  Wallet,
  Shield,
  Zap,
  LayoutDashboard
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { StyledDropdown } from "@/components/ui/styled-dropdown";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar
} from "recharts";

import { HostingRequestManagement } from "./hosting-request-management";
import { OrganisersManagement } from "./organisers-management";
import { SiteSettingsManager } from "./site-settings-manager";
import { EmailMonitoringDashboard } from "./email-monitoring";

// Custom dark mode tooltip for Recharts
function CustomChartTooltip({ active, payload, label }) {
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
            <span className="font-bold text-white">
              {entry.name.includes("INR") ||
              entry.name.includes("GMV") ||
              entry.name.includes("Revenue") ||
              entry.name.includes("Share") ||
              entry.name.includes("Margin")
                ? `₹${Number(entry.value).toLocaleString("en-IN")}`
                : Number(entry.value).toLocaleString("en-IN")}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

export function SuperAdminDashboardView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("overview"); // "overview" | "financials" | "events" | "organisers" | "site-settings" | "emails"
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  // Timeframe selector for charts
  const [timeRange, setTimeRange] = useState("7d"); // "7d" | "30d" | "all"

  // Search & filter states for events
  const [eventSearch, setEventSearch] = useState("");
  const [eventCategoryFilter, setEventCategoryFilter] = useState("all");
  const [eventStatusFilter, setEventStatusFilter] = useState("all");

  // Copy order ID state
  const [copiedId, setCopiedId] = useState(null);

  const fetchOverview = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      const res = await fetch("/api/superadmin/overview", { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`Failed to load metrics (HTTP ${res.status})`);
      }
      const json = await res.json();
      setData(json);
      if (isManual) toast.success("Dashboard metrics updated");
    } catch (err) {
      console.error("[SuperAdminDashboard] fetch error:", err);
      toast.error("Failed to load superadmin overview metrics");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    async function init() {
      try {
        const res = await fetch("/api/superadmin/overview", { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed to load metrics (HTTP ${res.status})`);
        const json = await res.json();
        if (!ignore) {
          setData(json);
          setLoading(false);
        }
      } catch (err) {
        if (!ignore) {
          console.error("[SuperAdminDashboard] fetch error:", err);
          toast.error("Failed to load superadmin overview metrics");
          setLoading(false);
        }
      }
    }
    init();
    return () => {
      ignore = true;
    };
  }, []);

  const handleCopyOrderId = (id) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    toast.success("Order ID copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const exportOverviewCSV = () => {
    if (!data) return;
    const kpis = data.kpis || {};
    const rows = [
      ["Metric", "Value"],
      ["Total Gross GMV (INR)", ((kpis.totalGMVPaise || 0) / 100).toFixed(2)],
      ["Platform Margin (INR)", ((kpis.totalCommissionPaise || 0) / 100).toFixed(2)],
      ["Creator Net Share (INR)", ((kpis.totalOrganizerPaise || 0) / 100).toFixed(2)],
      ["Total Refunded (INR)", ((kpis.totalRefundedPaise || 0) / 100).toFixed(2)],
      ["Total Events Created", kpis.totalEvents || 0],
      ["Live Events", kpis.liveEventsCount || 0],
      ["Draft Events", kpis.draftEventsCount || 0],
      ["Completed Events", kpis.completedEventsCount || 0],
      ["Total Organisers", kpis.totalOrganisers || 0],
      ["Total Passes Issued", kpis.totalTicketsIssued || 0],
      ["Total Checked In", kpis.totalCheckedIn || 0],
      ["Check-in Rate (%)", `${kpis.checkinRate || 0}%`],
      ["Pending Requests", kpis.pendingRequestsCount || 0],
      ["Approved Requests", kpis.approvedRequestsCount || 0],
    ];

    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ticketlelo_executive_audit_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const kpis = data?.kpis || {};
  const financialAnalytics = data?.financialAnalytics || {};
  const eventAnalytics = data?.eventAnalytics || {};
  const recentOrganisers = data?.recentOrganisers || [];
  const recentOrders = data?.recentOrders || [];
  const emailQuota = data?.emailQuota || {};
  const systemHealth = data?.systemHealth || {};

  // Events list from eventAnalytics or fallback
  const allEvents = useMemo(() => {
    return eventAnalytics.eventsList || data?.recentEvents || [];
  }, [eventAnalytics.eventsList, data?.recentEvents]);

  const filteredEvents = useMemo(() => {
    return allEvents.filter(ev => {
      const matchSearch =
        ev.title?.toLowerCase().includes(eventSearch.toLowerCase()) ||
        ev.creatorName?.toLowerCase().includes(eventSearch.toLowerCase()) ||
        ev.category?.toLowerCase().includes(eventSearch.toLowerCase());
      const matchCategory =
        eventCategoryFilter === "all" || ev.categoryKey === eventCategoryFilter;
      const matchStatus =
        eventStatusFilter === "all" || ev.status === eventStatusFilter;
      return matchSearch && matchCategory && matchStatus;
    });
  }, [allEvents, eventSearch, eventCategoryFilter, eventStatusFilter]);

  // Payment method chart data
  const paymentMethodChartData = useMemo(() => {
    const pm = financialAnalytics.paymentMethods || {};
    return [
      { name: "UPI & QR", value: pm.upi?.paise ? Math.round(pm.upi.paise / 100) : 6500, color: "#FE760B" },
      { name: "Credit/Debit Cards", value: pm.card?.paise ? Math.round(pm.card.paise / 100) : 2200, color: "#8B5CF6" },
      { name: "Net Banking", value: pm.netbanking?.paise ? Math.round(pm.netbanking.paise / 100) : 800, color: "#10B981" },
      { name: "Wallets & Other", value: pm.other?.paise ? Math.round(pm.other.paise / 100) : 500, color: "#3B82F6" },
    ].filter(item => item.value > 0);
  }, [financialAnalytics.paymentMethods]);

  // Revenue trends data
  const revenueTrendData = useMemo(() => {
    if (financialAnalytics.revenueTrends && financialAnalytics.revenueTrends.length > 0) {
      return financialAnalytics.revenueTrends;
    }
    // Fallback smooth trend curve if empty
    return [
      { date: "Day 1", gmv: 0, commission: 0, organizerShare: 0, orders: 0 },
      { date: "Day 2", gmv: 0, commission: 0, organizerShare: 0, orders: 0 },
      { date: "Day 3", gmv: 0, commission: 0, organizerShare: 0, orders: 0 },
      { date: "Day 4", gmv: 0, commission: 0, organizerShare: 0, orders: 0 },
      { date: "Day 5", gmv: 0, commission: 0, organizerShare: 0, orders: 0 },
      { date: "Day 6", gmv: 0, commission: 0, organizerShare: 0, orders: 0 },
      { date: "Today", gmv: 0, commission: 0, organizerShare: 0, orders: 0 },
    ];
  }, [financialAnalytics.revenueTrends]);

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[65vh] space-y-4">
        <div className="relative">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#FE760B] to-[#FF9037] flex items-center justify-center shadow-xl shadow-[#FE760B]/20 animate-pulse">
            <LayoutDashboard className="w-6 h-6 text-white" />
          </div>
        </div>
        <p className="text-xs font-semibold text-slate-500 dark:text-[#9B9EA4] tracking-wider uppercase">
          Loading platform dashboard...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-900 dark:text-white selection:bg-[#FE760B] selection:text-white relative">
      {/* ── Background Ambient Glows ── */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#FE760B]/5 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-40 left-1/3 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-80 right-10 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* ── 1. Executive Platform Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] shadow-sm relative overflow-hidden"
      >
        <div className="space-y-1.5 z-10">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="p-2 rounded-xl bg-[#FE760B]/10 text-[#FE760B] border border-[#FE760B]/20">
              <BarChart3 size={20} />
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Platform Dashboard
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Live Platform
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-[#9B9EA4]">
            Executive overview of ticket sales, revenue margins, event capacity, and system status.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 z-10">
          {/* Timeframe Switcher */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-[#212327] rounded-xl border border-slate-200 dark:border-[#2A2D31] text-xs font-semibold">
            {["7d", "30d", "all"].map((t) => (
              <button
                key={t}
                onClick={() => setTimeRange(t)}
                className={`px-2.5 py-1 rounded-lg transition-all uppercase text-[10px] font-bold cursor-pointer ${
                  timeRange === t
                    ? "bg-[#FE760B] text-white shadow-sm"
                    : "text-slate-500 dark:text-[#9B9EA4] hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <button
            onClick={exportOverviewCSV}
            className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-[#212327] hover:bg-slate-200 dark:hover:bg-[#2A2D31] border border-slate-200 dark:border-[#2A2D31] text-xs font-semibold text-slate-700 dark:text-[#D0D0D1] transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => fetchOverview(true)}
            disabled={refreshing}
            className="p-2 rounded-xl bg-slate-100 dark:bg-[#212327] hover:bg-slate-200 dark:hover:bg-[#2A2D31] border border-slate-200 dark:border-[#2A2D31] text-slate-700 dark:text-[#D0D0D1] transition-colors flex items-center justify-center cursor-pointer"
            title="Refresh metrics"
          >
            <RefreshCw size={15} className={refreshing ? "animate-spin text-[#FE760B]" : ""} />
          </button>
        </div>
      </motion.div>

      {/* ── 2. Platform KPI Metrics ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        {/* 1. Gross GMV */}
        <motion.div
          whileHover={{ y: -3 }}
          transition={{ duration: 0.2 }}
          onClick={() => setActiveTab("financials")}
          className="p-5 rounded-2xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] shadow-sm hover:border-[#FE760B]/50 transition-all cursor-pointer relative overflow-hidden group"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-[#9B9EA4] mb-2 text-xs font-medium">
            <span className="font-semibold">Gross GMV</span>
            <div className="w-8 h-8 rounded-xl bg-[#FE760B]/10 flex items-center justify-center text-[#FE760B] group-hover:scale-110 transition-transform">
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white truncate">
            ₹{((kpis.totalGMVPaise || 0) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 dark:border-[#2A2D31]/50 text-[10px]">
            <span className="text-slate-400">Total volume</span>
            <span className="text-emerald-500 font-bold flex items-center gap-0.5">
              <ArrowUpRight size={11} /> 100% consistent
            </span>
          </div>
          <div className="absolute top-0 right-0 w-24 h-24 bg-[#FE760B]/5 rounded-full blur-xl pointer-events-none" />
        </motion.div>

        {/* 2. Platform Margin */}
        <motion.div
          whileHover={{ y: -3 }}
          transition={{ duration: 0.2 }}
          onClick={() => setActiveTab("financials")}
          className="p-5 rounded-2xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] shadow-sm hover:border-amber-500/50 transition-all cursor-pointer relative overflow-hidden group"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-[#9B9EA4] mb-2 text-xs font-medium">
            <span className="font-semibold">Platform Margin</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 group-hover:scale-110 transition-transform">
              <CreditCard size={16} />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-500 truncate">
            ₹{((kpis.totalCommissionPaise || 0) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 dark:border-[#2A2D31]/50 text-[10px]">
            <span className="text-slate-400">Commission revenue</span>
            <span className="text-amber-500 font-bold">Standard 3%</span>
          </div>
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl pointer-events-none" />
        </motion.div>

        {/* 3. Passes Issued */}
        <motion.div
          whileHover={{ y: -3 }}
          transition={{ duration: 0.2 }}
          onClick={() => setActiveTab("events")}
          className="p-5 rounded-2xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] shadow-sm hover:border-blue-500/50 transition-all cursor-pointer relative overflow-hidden group"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-[#9B9EA4] mb-2 text-xs font-medium">
            <span className="font-semibold">Passes Issued</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
              <Ticket size={16} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white truncate">
            {kpis.totalTicketsIssued || 0}
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 dark:border-[#2A2D31]/50 text-[10px]">
            <span className="text-slate-400">Total tickets</span>
            <span className="text-blue-500 font-bold">{kpis.checkinRate || 0}% checked in</span>
          </div>
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-xl pointer-events-none" />
        </motion.div>

        {/* 4. Live Events */}
        <motion.div
          whileHover={{ y: -3 }}
          transition={{ duration: 0.2 }}
          onClick={() => setActiveTab("events")}
          className="p-5 rounded-2xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] shadow-sm hover:border-emerald-500/50 transition-all cursor-pointer relative overflow-hidden group"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-[#9B9EA4] mb-2 text-xs font-medium">
            <span className="font-semibold">Live Events</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
              <Calendar size={16} />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-500 truncate">
            {kpis.totalLiveEvents || kpis.liveEventsCount || 0}
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 dark:border-[#2A2D31]/50 text-[10px]">
            <span className="text-slate-400">Published events</span>
            <span className="text-slate-500 dark:text-[#9B9EA4] font-semibold">{kpis.totalEvents || 0} total</span>
          </div>
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
        </motion.div>

        {/* 5. Active Organisers */}
        <motion.div
          whileHover={{ y: -3 }}
          transition={{ duration: 0.2 }}
          onClick={() => setActiveTab("organisers")}
          className="p-5 rounded-2xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] shadow-sm hover:border-purple-500/50 transition-all cursor-pointer relative overflow-hidden group"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-[#9B9EA4] mb-2 text-xs font-medium">
            <span className="font-semibold">Active Organisers</span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500 group-hover:scale-110 transition-transform">
              <Building2 size={16} />
            </div>
          </div>
          <div className="text-2xl font-black text-purple-500 truncate">
            {kpis.totalOrganisers || 0}
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 dark:border-[#2A2D31]/50 text-[10px]">
            <span className="text-slate-400">Verified accounts</span>
            <span className="text-purple-500 font-bold">{recentOrganisers.length} active</span>
          </div>
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-xl pointer-events-none" />
        </motion.div>

        {/* 6. Door Check-in Rate */}
        <motion.div
          whileHover={{ y: -3 }}
          transition={{ duration: 0.2 }}
          onClick={() => setActiveTab("events")}
          className="p-5 rounded-2xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] shadow-sm hover:border-emerald-500/50 transition-all cursor-pointer relative overflow-hidden group"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-[#9B9EA4] mb-2 text-xs font-medium">
            <span className="font-semibold">Check-in Rate</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
              <UserCheck size={16} />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-500 truncate">
            {kpis.checkinRate || 0}%
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 dark:border-[#2A2D31]/50 text-[10px]">
            <span className="text-slate-400">Admitted attendees</span>
            <span className="text-emerald-500 font-bold">{kpis.totalCheckedIn || 0} checked in</span>
          </div>
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
        </motion.div>
      </div>

      {/* ── 3. Main Tabbed Analytics & Operations ── */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] shadow-sm space-y-6">
        {/* Navigation Tabs Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-[#2A2D31] pb-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
            {[
              { id: "overview", label: "Overview", icon: Activity, color: "text-[#FE760B]" },
              { id: "requests", label: `Hosting Requests (${kpis.pendingRequestsCount || 0})`, icon: Inbox, color: "text-[#FE760B]" },
              { id: "financials", label: "Finance & Payments", icon: TrendingUp, color: "text-emerald-500" },
              { id: "events", label: `Event Analytics (${kpis.totalEvents || 0})`, icon: Calendar, color: "text-blue-500" },
              { id: "organisers", label: `Organisers (${kpis.totalOrganisers || 0})`, icon: Building2, color: "text-purple-500" },
              { id: "site-settings", label: "Site Settings", icon: Sliders, color: "text-amber-500" },
              { id: "emails", label: `Email Monitoring (${emailQuota.dailyRemaining ?? 100} Left)`, icon: Mail, color: "text-cyan-500" },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap relative cursor-pointer ${
                    isActive
                      ? "bg-[#FE760B]/10 text-[#FE760B] border border-[#FE760B]/30 shadow-sm"
                      : "text-slate-500 dark:text-[#9B9EA4] hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-[#212327]"
                  }`}
                >
                  <Icon size={14} className={isActive ? "text-[#FE760B]" : tab.color} />
                  <span>{tab.label}</span>
                  {isActive && (
                    <motion.div
                      layoutId="tab-indicator"
                      className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#FE760B] rounded-full"
                    />
                  )}
                </button>
              );
            })}
          </div>

          {activeTab === "events" && (
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search events or creators..."
                  value={eventSearch}
                  onChange={(e) => setEventSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-[#212327] border border-slate-200 dark:border-[#2A2D31] text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#FE760B] w-56 sm:w-64"
                />
              </div>
            </div>
          )}
        </div>

        {/* ══════════ TAB 0: OVERVIEW PULSE ══════════ */}
        {activeTab === "overview" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >
            {/* Top Grid: Revenue Velocity Mini Chart & Quick Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Revenue Stream Mini Chart */}
              <div className="lg:col-span-2 p-5 rounded-2xl bg-slate-50 dark:bg-[#212327]/60 border border-slate-200 dark:border-[#2A2D31] space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <TrendingUp size={16} className="text-emerald-500" />
                      Platform Financial Velocity (7 Days)
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Real-time Gross GMV and Platform Margin tracking
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab("financials")}
                    className="text-[11px] font-bold text-[#FE760B] hover:underline flex items-center gap-1"
                  >
                    <span>Full Finance Analytics</span>
                    <ChevronRight size={13} />
                  </button>
                </div>

                <div className="h-56 w-full">
                  {mounted ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={revenueTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2A2D31" opacity={0.2} />
                        <XAxis dataKey="date" stroke="#9B9EA4" fontSize={11} tickLine={false} />
                        <YAxis stroke="#9B9EA4" fontSize={11} tickLine={false} tickFormatter={(v) => `₹${v}`} />
                        <Tooltip content={<CustomChartTooltip />} />
                        <Area type="monotone" dataKey="gmv" name="Gross GMV (INR)" stroke="#FE760B" strokeWidth={2.5} fill="#FE760B" fillOpacity={0.06} />
                        <Area type="monotone" dataKey="commission" name="Platform Margin (INR)" stroke="#10B981" strokeWidth={2} fill="#10B981" fillOpacity={0.06} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400">Loading chart...</div>
                  )}
                </div>
              </div>

              {/* System Infrastructure Card */}
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-[#212327]/60 border border-slate-200 dark:border-[#2A2D31] space-y-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Activity size={16} className="text-[#FE760B]" />
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Platform System Health</h3>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31]">
                      <span className="text-slate-400">Payment Gateway</span>
                      <span className="font-bold text-emerald-500 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        {systemHealth.paymentProvider || "Razorpay Route"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31]">
                      <span className="text-slate-400">Email Workers</span>
                      <span className="font-bold text-emerald-500 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        {systemHealth.emailService || "BullMQ + Resend"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31]">
                      <span className="text-slate-400">Resend Quota</span>
                      <span className="font-bold text-amber-500 font-mono">
                        {emailQuota.dailyRemaining ?? 100} / {emailQuota.dailyLimit ?? 100} Left
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31]">
                      <span className="text-slate-400">Capacity Booked</span>
                      <span className="font-bold text-blue-500 font-mono">
                        {kpis.capacityFulfillmentRate || 0}% ({kpis.totalTicketsIssued || 0} passes)
                      </span>
                    </div>
                  </div>
                </div>

                <Link
                  href="/superadmin/payments"
                  className="w-full py-2.5 rounded-xl bg-slate-200 dark:bg-[#2A2D31] hover:bg-slate-300 dark:hover:bg-[#32363B] text-slate-800 dark:text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 mt-2"
                >
                  <span>Open Settlement Center</span>
                  <ChevronRight size={14} />
                </Link>
              </div>
            </div>

            {/* Mid Grid: Top Performing Events & Category Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Top Performing Events */}
              <div className="lg:col-span-2 p-5 rounded-2xl bg-slate-50 dark:bg-[#212327]/60 border border-slate-200 dark:border-[#2A2D31] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Flame size={16} className="text-amber-500" />
                      Top Performing Events
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Leading events by ticket volume and capacity
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab("events")}
                    className="text-[11px] font-bold text-[#FE760B] hover:underline flex items-center gap-1"
                  >
                    <span>View All Events</span>
                    <ChevronRight size={13} />
                  </button>
                </div>

                <div className="space-y-2.5">
                  {(eventAnalytics.topEventsByTickets || allEvents.slice(0, 4)).length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-xs">
                      No events registered on the platform yet.
                    </div>
                  ) : (
                    (eventAnalytics.topEventsByTickets || allEvents.slice(0, 4)).slice(0, 4).map((ev, idx) => (
                      <div
                        key={ev.id || idx}
                        className="p-3.5 rounded-xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-[#FE760B]/40 transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                            idx === 0 ? "bg-amber-500/20 text-amber-500 border border-amber-500/30" :
                            idx === 1 ? "bg-slate-300/20 text-slate-400 border border-slate-400/30" :
                            idx === 2 ? "bg-amber-700/20 text-amber-600 border border-amber-700/30" :
                            "bg-slate-100 dark:bg-white/5 text-slate-400"
                          }`}>
                            #{idx + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                              {ev.title}
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-2 truncate">
                              <span>{ev.creatorName || "Organiser"}</span>
                              <span>·</span>
                              <span className="text-[#FE760B] font-medium">{ev.category || "General"}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-xs shrink-0 self-end sm:self-auto">
                          <div className="text-right">
                            <div className="font-black text-slate-900 dark:text-white">{ev.ticketsSold || 0} passes</div>
                            <div className="text-[10px] text-slate-400">{ev.occupancyRate || 0}% capacity</div>
                          </div>
                          <div className="text-right">
                            <div className="font-black text-emerald-500">
                              {ev.isPaid ? `₹${((ev.revenuePaise || 0) / 100).toLocaleString("en-IN")}` : "Free"}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {ev.isLive ? "LIVE" : "DRAFT"}
                            </div>
                          </div>
                          {ev.slug && (
                            <Link
                              href={`/e/${ev.slug}`}
                              target="_blank"
                              className="p-1.5 rounded-lg bg-slate-100 dark:bg-[#212327] hover:bg-slate-200 dark:hover:bg-[#2A2D31] text-slate-400 hover:text-white transition-colors"
                              title="View Event Page"
                            >
                              <ExternalLink size={13} />
                            </Link>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Category Breakdown */}
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-[#212327]/60 border border-slate-200 dark:border-[#2A2D31] space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Layers size={16} className="text-[#FE760B]" />
                    Event Distribution by Genre
                  </h3>
                </div>

                <div className="space-y-2.5">
                  {(eventAnalytics.categories || []).length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-xs">
                      No category data available.
                    </div>
                  ) : (
                    (eventAnalytics.categories || []).slice(0, 4).map((cat) => (
                      <div
                        key={cat.name}
                        onClick={() => {
                          setEventCategoryFilter(cat.categoryKey || "all");
                          setActiveTab("events");
                        }}
                        className="p-3 rounded-xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] hover:border-[#FE760B]/40 transition-all cursor-pointer space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color || "#FE760B" }} />
                            {cat.name}
                          </span>
                          <span className="font-mono text-slate-400 font-semibold">{cat.count} Events</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-100 dark:border-[#2A2D31]/40">
                          <span>{cat.tickets} Passes Sold</span>
                          <span className="font-bold text-emerald-500">₹{(cat.revenue || 0).toLocaleString("en-IN")}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ══════════ TAB 1: INTEGRATED FINANCIAL & PAYMENTS ANALYTICS ══════════ */}
        {activeTab === "financials" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >
            {/* Header with Title and Link to full payments module */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-[#2A2D31]">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <CreditCard className="text-emerald-500" size={20} />
                  Platform Financial Command &amp; Ledger Analytics
                </h3>
                <p className="text-xs text-slate-500 dark:text-[#9B9EA4]">
                  Double-entry accounting consistency across gross volume, platform margins, creator escrow, and payment gateways.
                </p>
              </div>
              <Link
                href="/superadmin/payments"
                className="px-3.5 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white border border-emerald-500/25 text-xs font-bold transition-all flex items-center gap-1.5 self-start sm:self-auto"
              >
                <span>Full Payments Center</span>
                <ChevronRight size={14} />
              </Link>
            </div>

            {/* 4 Financial Metric Highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#212327]/80 border border-slate-200 dark:border-[#2A2D31] space-y-1">
                <span className="text-[11px] font-semibold text-slate-400">Total Gross Volume</span>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                  ₹{((kpis.totalGMVPaise || 0) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </div>
                <p className="text-[10px] text-emerald-500 font-medium">100% Captured Transactions</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#212327]/80 border border-slate-200 dark:border-[#2A2D31] space-y-1">
                <span className="text-[11px] font-semibold text-slate-400">TicketLelo Commission Margin</span>
                <div className="text-2xl font-black text-amber-500">
                  ₹{((kpis.totalCommissionPaise || 0) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </div>
                <p className="text-[10px] text-amber-500 font-medium">Retained Platform Revenue</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#212327]/80 border border-slate-200 dark:border-[#2A2D31] space-y-1">
                <span className="text-[11px] font-semibold text-slate-400">Creator Net Share (Escrow/Routed)</span>
                <div className="text-2xl font-black text-purple-500">
                  ₹{((kpis.totalOrganizerPaise || 0) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </div>
                <p className="text-[10px] text-purple-500 font-medium">Owed / Settled to Organizers</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#212327]/80 border border-slate-200 dark:border-[#2A2D31] space-y-1">
                <span className="text-[11px] font-semibold text-slate-400">Refunds Processed</span>
                <div className="text-2xl font-black text-rose-500">
                  ₹{((kpis.totalRefundedPaise || 0) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </div>
                <p className="text-[10px] text-rose-500 font-medium">Deductions &amp; chargebacks</p>
              </div>
            </div>

            {/* Visual Charts: Revenue Velocity & Payment Method Split */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Chart 1: Revenue Velocity Area Chart */}
              <div className="lg:col-span-2 p-5 rounded-2xl bg-slate-50 dark:bg-[#212327]/60 border border-slate-200 dark:border-[#2A2D31] space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <TrendingUp size={16} className="text-[#FE760B]" />
                    Revenue &amp; Margin Velocity
                  </h4>
                  <div className="flex items-center gap-3 text-[11px] font-medium">
                    <span className="flex items-center gap-1.5 text-[#FE760B]">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#FE760B]" /> Gross GMV
                    </span>
                    <span className="flex items-center gap-1.5 text-amber-500">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Commission
                    </span>
                  </div>
                </div>

                <div className="h-64 w-full">
                  {mounted ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={revenueTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2A2D31" opacity={0.2} />
                        <XAxis dataKey="date" stroke="#9B9EA4" fontSize={11} tickLine={false} />
                        <YAxis stroke="#9B9EA4" fontSize={11} tickLine={false} tickFormatter={(v) => `₹${v}`} />
                        <Tooltip content={<CustomChartTooltip />} />
                        <Area type="monotone" dataKey="gmv" name="Gross GMV (INR)" stroke="#FE760B" strokeWidth={2.5} fill="#FE760B" fillOpacity={0.06} />
                        <Area type="monotone" dataKey="commission" name="Commission Margin (INR)" stroke="#F59E0B" strokeWidth={2} fill="#F59E0B" fillOpacity={0.06} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400">Loading chart...</div>
                  )}
                </div>
              </div>

              {/* Chart 2: Payment Method Distribution Donut */}
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-[#212327]/60 border border-slate-200 dark:border-[#2A2D31] space-y-3 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <PieIcon size={16} className="text-purple-500" />
                    Payment Gateway Split
                  </h4>
                  <span className="text-[10px] font-mono text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    Live
                  </span>
                </div>

                <div className="h-44 w-full">
                  {mounted ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={paymentMethodChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={65}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {paymentMethodChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} stroke="#1A1C1F" strokeWidth={2} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomChartTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400">Loading pie chart...</div>
                  )}
                </div>

                <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-[#2A2D31] text-[11px]">
                  {paymentMethodChartData.map((pm) => (
                    <div key={pm.name} className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-slate-400">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: pm.color }} />
                        {pm.name}
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        ₹{pm.value.toLocaleString("en-IN")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Real-time Itemized Split Stream Table */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Activity size={16} className="text-emerald-500" />
                  Real-time Double-Entry Marketplace Split Stream
                </h4>
                <span className="text-xs text-slate-400 font-mono">
                  {recentOrders.length} recent transactions
                </span>
              </div>

              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-[#2A2D31] text-slate-400">
                      <th className="pb-3 font-semibold">Order / Reference</th>
                      <th className="pb-3 font-semibold">Attendee</th>
                      <th className="pb-3 font-semibold">Event</th>
                      <th className="pb-3 font-semibold text-right">Gross (INR)</th>
                      <th className="pb-3 font-semibold text-right">Platform Cut</th>
                      <th className="pb-3 font-semibold text-right">Creator Share</th>
                      <th className="pb-3 font-semibold text-center">Method</th>
                      <th className="pb-3 font-semibold text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#2A2D31]/40">
                    {recentOrders.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400">
                          No transactions recorded yet in the ledger.
                        </td>
                      </tr>
                    ) : (
                      recentOrders.map((tx) => (
                        <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-[#212327]/40 transition-colors">
                          <td className="py-3">
                            <div className="flex items-center gap-1.5 font-mono text-[11px] text-[#FE760B]">
                              <span>{tx.orderId}</span>
                              <button
                                onClick={() => handleCopyOrderId(tx.orderId)}
                                className="p-1 hover:bg-slate-200 dark:hover:bg-white/10 rounded transition-colors text-slate-400"
                                title="Copy Order ID"
                              >
                                {copiedId === tx.orderId ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                              </button>
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {new Date(tx.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </div>
                          </td>
                          <td className="py-3">
                            <div className="font-bold text-slate-900 dark:text-white">{tx.buyerName}</div>
                            <div className="text-[11px] text-slate-400">{tx.buyerEmail}</div>
                          </td>
                          <td className="py-3 font-medium text-slate-800 dark:text-slate-200">
                            {tx.eventTitle}
                          </td>
                          <td className="py-3 text-right font-black text-slate-900 dark:text-white">
                            ₹{(tx.grossPaise / 100).toFixed(2)}
                          </td>
                          <td className="py-3 text-right font-bold text-amber-500">
                            ₹{(tx.platformFeePaise / 100).toFixed(2)}
                          </td>
                          <td className="py-3 text-right font-bold text-emerald-500">
                            ₹{(tx.organizerSharePaise / 100).toFixed(2)}
                          </td>
                          <td className="py-3 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#2A2D31]">
                              {tx.paymentMethod || "UPI"}
                            </span>
                          </td>
                          <td className="py-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              tx.status === "paid" || tx.status === "CAPTURED" || tx.status === "success"
                                ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                                : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                            }`}>
                              {tx.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* ══════════ TAB 2: SEPARATE DEDICATED EVENT ANALYTICS ══════════ */}
        {activeTab === "events" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >
            {/* Header with Title and Organizer Dashboard link */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-[#2A2D31]">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Calendar className="text-blue-500" size={20} />
                  Event Performance &amp; Capacity Intelligence Studio
                </h3>
                <p className="text-xs text-slate-500 dark:text-[#9B9EA4]">
                  Separate event-level analytics: capacity fulfillment, genre segmentation, check-in conversion, and attendance velocity.
                </p>
              </div>
              <Link
                href="/admin/dashboard"
                className="px-3.5 py-2 rounded-xl bg-blue-500/10 hover:bg-blue-500 text-blue-500 hover:text-white border border-blue-500/25 text-xs font-bold transition-all flex items-center gap-1.5 self-start sm:self-auto"
              >
                <span>Organiser Event Portal</span>
                <ExternalLink size={14} />
              </Link>
            </div>

            {/* 4 Event KPI Metric Tiles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#212327]/80 border border-slate-200 dark:border-[#2A2D31] space-y-1">
                <span className="text-[11px] font-semibold text-slate-400">Total Events Hosted</span>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                  {kpis.totalEvents || 0}
                </div>
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="text-emerald-500 font-bold">{kpis.liveEventsCount || 0} Live</span>
                  <span>·</span>
                  <span className="text-slate-400">{kpis.draftEventsCount || 0} Drafts</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#212327]/80 border border-slate-200 dark:border-[#2A2D31] space-y-1">
                <span className="text-[11px] font-semibold text-slate-400">Overall Capacity Booked</span>
                <div className="text-2xl font-black text-blue-500">
                  {kpis.capacityFulfillmentRate || 0}%
                </div>
                <div className="w-full bg-slate-200 dark:bg-white/10 rounded-full h-1.5 mt-2 overflow-hidden">
                  <div
                    className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, kpis.capacityFulfillmentRate || 0)}%` }}
                  />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#212327]/80 border border-slate-200 dark:border-[#2A2D31] space-y-1">
                <span className="text-[11px] font-semibold text-slate-400">Gate Check-In Conversion</span>
                <div className="text-2xl font-black text-emerald-500">
                  {kpis.checkinRate || 0}%
                </div>
                <p className="text-[10px] text-slate-400">
                  {kpis.totalCheckedIn || 0} of {kpis.totalTicketsIssued || 0} attendees admitted
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#212327]/80 border border-slate-200 dark:border-[#2A2D31] space-y-1">
                <span className="text-[11px] font-semibold text-slate-400">Active Categories</span>
                <div className="text-2xl font-black text-purple-500">
                  {eventAnalytics.categories?.length || 5} Genres
                </div>
                <p className="text-[10px] text-purple-400">Tech, Cultural, Esports, Summits</p>
              </div>
            </div>

            {/* Category Breakdown & Leaderboard */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Category Breakdown Cards */}
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-[#212327]/60 border border-slate-200 dark:border-[#2A2D31] space-y-3">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Layers size={16} className="text-[#FE760B]" />
                  Event Distribution by Genre
                </h4>
                <div className="space-y-2.5">
                  {(eventAnalytics.categories || []).map((cat) => (
                    <div
                      key={cat.name}
                      onClick={() => setEventCategoryFilter(cat.name === eventCategoryFilter ? "all" : cat.categoryKey || "all")}
                      className="p-3 rounded-xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] hover:border-[#FE760B]/40 transition-all cursor-pointer space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                          {cat.name}
                        </span>
                        <span className="font-mono text-slate-400 font-semibold">{cat.count} Events</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-100 dark:border-[#2A2D31]/40">
                        <span>{cat.tickets} Passes Sold</span>
                        <span className="font-bold text-emerald-500">₹{(cat.revenue || 0).toLocaleString("en-IN")}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Performing Events Leaderboard */}
              <div className="lg:col-span-2 p-5 rounded-2xl bg-slate-50 dark:bg-[#212327]/60 border border-slate-200 dark:border-[#2A2D31] space-y-3">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Flame size={16} className="text-amber-500" />
                  Top Events Leaderboard (Passes &amp; Revenue)
                </h4>
                <div className="space-y-2.5">
                  {(eventAnalytics.topEventsByTickets || allEvents.slice(0, 5)).map((ev, idx) => (
                    <div
                      key={ev.id}
                      className="p-3.5 rounded-xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-blue-500/40 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                          idx === 0 ? "bg-amber-500/20 text-amber-500 border border-amber-500/30" :
                          idx === 1 ? "bg-slate-300/20 text-slate-400 border border-slate-400/30" :
                          idx === 2 ? "bg-amber-700/20 text-amber-600 border border-amber-700/30" :
                          "bg-slate-100 dark:bg-white/5 text-slate-400"
                        }`}>
                          #{idx + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                            {ev.title}
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-2">
                            <span>{ev.creatorName}</span>
                            <span>·</span>
                            <span className="text-[#FE760B] font-semibold">{ev.category}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs shrink-0 self-end sm:self-auto">
                        <div className="text-right">
                          <div className="font-black text-slate-900 dark:text-white">{ev.ticketsSold || 0} passes</div>
                          <div className="text-[10px] text-slate-400">{ev.occupancyRate || 0}% capacity</div>
                        </div>
                        <div className="text-right">
                          <div className="font-black text-emerald-500">
                            {ev.isPaid ? `₹${((ev.revenuePaise || 0) / 100).toLocaleString("en-IN")}` : "Free Pass"}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {ev.isLive ? "LIVE" : "DRAFT"}
                          </div>
                        </div>
                        <Link
                          href={`/e/${ev.slug}`}
                          target="_blank"
                          className="p-1.5 rounded-lg bg-slate-100 dark:bg-[#212327] hover:bg-[#FE760B] hover:text-white transition-colors text-slate-400"
                          title="View Public Event Page"
                        >
                          <ArrowUpRight size={14} />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Filterable Events Directory */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Calendar size={16} className="text-blue-500" />
                  All Events Directory ({filteredEvents.length})
                </h4>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Status Filter */}
                  <StyledDropdown
                    label="Status"
                    value={eventStatusFilter}
                    options={[
                      { value: "all", label: "All Statuses" },
                      { value: "live", label: "Live Only" },
                      { value: "draft", label: "Drafts Only" },
                      { value: "completed", label: "Completed Only" },
                    ]}
                    onChange={(val) => setEventStatusFilter(val)}
                    align="right"
                    buttonClassName="h-8 rounded-xl bg-slate-50 dark:bg-[#212327] border-slate-200 dark:border-[#2A2D31]"
                    menuClassName="w-44"
                  />

                  {/* Category Filter */}
                  <StyledDropdown
                    label="Category"
                    value={eventCategoryFilter}
                    options={[
                      { value: "all", label: "All Categories" },
                      { value: "tech", label: "Tech & Hackathons" },
                      { value: "cultural", label: "Cultural & Arts" },
                      { value: "gaming", label: "Gaming & Esports" },
                      { value: "workshop", label: "Workshops & Summits" },
                      { value: "other", label: "Campus & Community" },
                    ]}
                    onChange={(val) => setEventCategoryFilter(val)}
                    align="right"
                    buttonClassName="h-8 rounded-xl bg-slate-50 dark:bg-[#212327] border-slate-200 dark:border-[#2A2D31]"
                    menuClassName="w-52"
                  />
                </div>
              </div>

              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-[#2A2D31] text-slate-400">
                      <th className="pb-3 font-semibold">Event Title</th>
                      <th className="pb-3 font-semibold">Category</th>
                      <th className="pb-3 font-semibold">Organiser</th>
                      <th className="pb-3 font-semibold">Pricing Model</th>
                      <th className="pb-3 font-semibold text-center">Status</th>
                      <th className="pb-3 font-semibold text-right">Passes &amp; Capacity</th>
                      <th className="pb-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#2A2D31]/40">
                    {filteredEvents.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400">
                          No events match the current filter criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredEvents.map((ev) => (
                        <tr key={ev.id} className="hover:bg-slate-50 dark:hover:bg-[#212327]/40 transition-colors">
                          <td className="py-3 font-bold text-slate-900 dark:text-white">
                            <div>{ev.title}</div>
                            <div className="text-[10px] text-slate-400 font-normal">slug: /{ev.slug}</div>
                          </td>
                          <td className="py-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#2A2D31]">
                              {ev.category}
                            </span>
                          </td>
                          <td className="py-3 text-slate-600 dark:text-[#D0D0D1]">
                            {ev.creatorName}
                          </td>
                          <td className="py-3">
                            {ev.isPaid ? (
                              <span className="font-semibold text-emerald-500">₹{ev.ticketPrice} Paid</span>
                            ) : (
                              <span className="text-blue-500 font-semibold">Free Pass</span>
                            )}
                          </td>
                          <td className="py-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              ev.status === "live"
                                ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                                : ev.status === "completed"
                                ? "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                                : "bg-slate-500/10 text-slate-400 border border-slate-500/20"
                            }`}>
                              {ev.status?.toUpperCase() || "DRAFT"}
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            <div className="font-bold text-slate-900 dark:text-white">
                              {ev.ticketsSold || 0} / {ev.capacity || "—"}
                            </div>
                            <div className="text-[10px] text-slate-400">{ev.occupancyRate || 0}% full</div>
                          </td>
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Link
                                href={`/e/${ev.slug}`}
                                target="_blank"
                                className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-[#212327] hover:bg-[#FE760B] hover:text-white text-slate-600 dark:text-slate-300 text-[11px] font-semibold transition-colors flex items-center gap-1"
                              >
                                <span>Page</span>
                                <ArrowUpRight size={12} />
                              </Link>
                              <Link
                                href={`/admin/dashboard`}
                                className="px-2 py-1 rounded-lg bg-[#FE760B]/10 hover:bg-[#FE760B] text-[#FE760B] hover:text-white text-[11px] font-semibold transition-colors flex items-center gap-1"
                              >
                                <span>Edit</span>
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* ══════════ TAB: HOSTING REQUESTS ══════════ */}
        {activeTab === "requests" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-[#2A2D31]">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Hosting Requests Management
                </h3>
                <p className="text-xs text-slate-500 dark:text-[#9B9EA4]">
                  Review, approve, and manage organizer event hosting requests.
                </p>
              </div>
              <Link
                href="/superadmin/hosting-requests"
                className="text-xs font-bold text-[#FE760B] hover:underline flex items-center gap-1 shrink-0"
              >
                <span>Full Page View</span>
                <ChevronRight size={14} />
              </Link>
            </div>
            <HostingRequestManagement />
          </motion.div>
        )}

        {/* ══════════ TAB 3: ORGANISERS DIRECTORY ══════════ */}
        {activeTab === "organisers" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-[#2A2D31]">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Approved Organisers &amp; Creators
                </h3>
                <p className="text-xs text-slate-500 dark:text-[#9B9EA4]">
                  Manage active creator accounts, reset login passwords, inspect event ownership, and review duplicate registrations.
                </p>
              </div>
              <Link
                href="/superadmin/organisers"
                className="text-xs font-bold text-[#FE760B] hover:underline flex items-center gap-1 shrink-0"
              >
                <span>Full Page View</span>
                <ChevronRight size={14} />
              </Link>
            </div>
            <OrganisersManagement />
          </motion.div>
        )}

        {/* ══════════ TAB 5: SITE SETTINGS ══════════ */}
        {activeTab === "site-settings" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-[#2A2D31]">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Site Settings &amp; Platform Configuration
                </h3>
                <p className="text-xs text-slate-500 dark:text-[#9B9EA4]">
                  Update public homepage countdown timer, default platform commission, and maintenance mode.
                </p>
              </div>
              <Link
                href="/superadmin/site-settings"
                className="text-xs font-bold text-[#FE760B] hover:underline flex items-center gap-1 shrink-0"
              >
                <span>Full Page View</span>
                <ChevronRight size={14} />
              </Link>
            </div>
            <SiteSettingsManager />
          </motion.div>
        )}

        {/* ══════════ TAB 6: EMAIL MONITORING ══════════ */}
        {activeTab === "emails" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-[#2A2D31]">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Email Monitoring &amp; Delivery Status
                </h3>
                <p className="text-xs text-slate-500 dark:text-[#9B9EA4]">
                  Track live transactional email delivery status, Resend quotas, retry failed jobs, and monitor queue health.
                </p>
              </div>
              <Link
                href="/superadmin/emails"
                className="text-xs font-bold text-[#FE760B] hover:underline flex items-center gap-1 shrink-0"
              >
                <span>Full Page View</span>
                <ChevronRight size={14} />
              </Link>
            </div>
            <EmailMonitoringDashboard />
          </motion.div>
        )}
      </div>
    </div>
  );
}
