"use client";

import { useState, useEffect, useCallback, useMemo, useRef, useTransition } from "react";
import {
  Mail,
  RotateCcw,
  RefreshCw,
  Clock,
  Search,
  ArrowUpDown,
  Send,
  Calendar,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { auth } from "@/lib/firebase";
import { StyledDropdown } from "@/components/ui/styled-dropdown";
import { getCachedItem, setCachedItem } from "@/lib/client-cache";
import { parseFirestoreDate } from "@/lib/date-utils";
import { EmailMonitoringSkeleton } from "@/components/ui/skeleton";

const CACHE_KEY = "superadmin_email_monitoring";
const ITEMS_PER_PAGE = 10;

function formatJobDate(dateVal) {
  if (!dateVal) return "-";
  const d = parseFirestoreDate(dateVal);
  if (!d || isNaN(d.getTime())) return "-";
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatEmailType(type = "") {
  if (!type) return "System Notification";
  return type
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const SORT_OPTIONS = [
  { value: "newest", label: "Newest First" },
  { value: "oldest", label: "Oldest First" },
  { value: "priority", label: "Priority (P0 → P2)" },
];

const PERIOD_OPTIONS = [
  { value: "all", label: "All Time" },
  { value: "today", label: "Today" },
  { value: "7days", label: "Last 7 Days" },
  { value: "30days", label: "Last 30 Days" },
];

export function EmailMonitoringDashboard() {
  const [retryingId, setRetryingId] = useState(null);
  const [, startTransition] = useTransition();

  // 1. Instant Synchronous Initialization from Client Cache (0ms render)
  const [data, setData] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = getCachedItem(CACHE_KEY);
        if (cached && (cached.jobs || cached.stats || cached.quota)) {
          return cached;
        }
      } catch (_) {}
    }
    return {
      quota: {
        dailyUsed: 0,
        dailyLimit: 100,
        dailyRemaining: 100,
        monthlyUsed: 0,
        monthlyLimit: 3000,
        monthlyRemaining: 3000,
        safetyMargin: 15,
        nextDailyReset: null,
        timezone: "UTC",
      },
      stats: {
        totalSent: 0,
        totalDelivered: 0,
        totalPending: 0,
        totalScheduled: 0,
        totalFailed: 0,
        totalBounced: 0,
        totalComplained: 0,
      },
      jobs: [],
    };
  });

  // If cached data is present, loading is false right away (instant whole page display)
  const [loading, setLoading] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = getCachedItem(CACHE_KEY);
        if (cached && (cached.jobs?.length > 0 || cached.stats?.totalSent > 0)) {
          return false;
        }
      } catch (_) {}
    }
    return true;
  });

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all"); // "all" | "DELIVERED" | "PENDING" | "SCHEDULED" | "FAILED"
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [timeRange, setTimeRange] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const hasDataRef = useRef(!loading);

  useEffect(() => {
    if (data?.jobs?.length || data?.stats?.totalSent) {
      hasDataRef.current = true;
    }
  }, [data]);

  const loadData = useCallback(async (manual = false) => {
    try {
      if (manual) {
        setIsRefreshing(true);
      } else if (!hasDataRef.current) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }

      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
      if (searchQuery.trim()) params.set("recipient", searchQuery.trim());

      let headers = {};
      try {
        if (auth?.currentUser) {
          const token = await auth.currentUser.getIdToken();
          if (token) headers.Authorization = `Bearer ${token}`;
        }
      } catch (_) {}

      const res = await fetch(`/api/admin/emails?${params.toString()}`, { headers });
      if (!res.ok) throw new Error("Failed to load email statistics");
      const json = await res.json();

      startTransition(() => {
        setData(json);
      });

      // Cache the unfiltered default state for instant display on future visits
      if ((!statusFilter || statusFilter === "all") && !searchQuery.trim()) {
        setCachedItem(CACHE_KEY, json, 15 * 60 * 1000);
      }
    } catch (err) {
      toast.error(err.message || "Could not fetch email metrics");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    loadData(false);
  }, [loadData, statusFilter]);

  const handleRetry = async (jobId) => {
    try {
      setRetryingId(jobId);
      let headers = { "Content-Type": "application/json" };
      try {
        if (auth?.currentUser) {
          const token = await auth.currentUser.getIdToken();
          if (token) headers.Authorization = `Bearer ${token}`;
        }
      } catch (_) {}

      const res = await fetch("/api/admin/emails/retry", {
        method: "POST",
        headers,
        body: JSON.stringify({ jobId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Retry failed");
      toast.success(`Job ${jobId} successfully re-queued`);
      loadData(true);
    } catch (err) {
      toast.error(err.message || "Failed to retry job");
    } finally {
      setRetryingId(null);
    }
  };

  const quota = data?.quota || {
    dailyUsed: 0,
    dailyLimit: 100,
    dailyRemaining: 100,
    monthlyUsed: 0,
    monthlyLimit: 3000,
    monthlyRemaining: 3000,
    safetyMargin: 15,
    nextDailyReset: null,
  };

  const stats = data?.stats || {
    totalSent: 0,
    totalDelivered: 0,
    totalPending: 0,
    totalScheduled: 0,
    totalFailed: 0,
    totalBounced: 0,
    totalComplained: 0,
  };

  const rawJobs = Array.isArray(data?.jobs) ? data.jobs : [];

  // Filter and Sort Jobs
  const filteredJobs = useMemo(() => {
    let result = [...rawJobs];

    // Client-side search filtering
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (j) =>
          (j.recipient && j.recipient.toLowerCase().includes(q)) ||
          (j.subject && j.subject.toLowerCase().includes(q)) ||
          (j.emailType && j.emailType.toLowerCase().includes(q)) ||
          (j.id && j.id.toLowerCase().includes(q)),
      );
    }

    // Client-side status filter
    if (statusFilter && statusFilter !== "all") {
      if (statusFilter === "DELIVERED") {
        result = result.filter((j) => j.status === "DELIVERED" || j.status === "SENT");
      } else if (statusFilter === "PENDING") {
        result = result.filter(
          (j) => j.status === "PENDING" || j.status === "QUEUED" || j.status === "PROCESSING",
        );
      } else if (statusFilter === "SCHEDULED") {
        result = result.filter((j) => j.status === "SCHEDULED");
      } else if (statusFilter === "FAILED") {
        result = result.filter(
          (j) => j.status === "FAILED" || j.status === "BOUNCED" || j.status === "COMPLAINED",
        );
      }
    }

    // Time range filter
    if (timeRange !== "all") {
      const now = Date.now();
      let threshold = 0;
      if (timeRange === "today") threshold = now - 24 * 60 * 60 * 1000;
      else if (timeRange === "7days") threshold = now - 7 * 24 * 60 * 60 * 1000;
      else if (timeRange === "30days") threshold = now - 30 * 24 * 60 * 60 * 1000;

      result = result.filter((j) => {
        const d = parseFirestoreDate(j.createdAt);
        return d && d.getTime() >= threshold;
      });
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === "oldest") {
        const da = parseFirestoreDate(a.createdAt)?.getTime() || 0;
        const db = parseFirestoreDate(b.createdAt)?.getTime() || 0;
        return da - db;
      }
      if (sortBy === "priority") {
        const pOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };
        const pa = pOrder[a.priority] ?? 99;
        const pb = pOrder[b.priority] ?? 99;
        return pa - pb;
      }
      // default: newest first
      const da = parseFirestoreDate(a.createdAt)?.getTime() || 0;
      const db = parseFirestoreDate(b.createdAt)?.getTime() || 0;
      return db - da;
    });

    return result;
  }, [rawJobs, searchQuery, statusFilter, timeRange, sortBy]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / ITEMS_PER_PAGE));
  const paginatedJobs = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredJobs.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredJobs, currentPage]);

  const hasActiveFilters =
    statusFilter !== "all" ||
    timeRange !== "all" ||
    sortBy !== "newest" ||
    searchQuery.trim().length > 0;

  const resetAllFilters = () => {
    setStatusFilter("all");
    setTimeRange("all");
    setSortBy("newest");
    setSearchQuery("");
    setCurrentPage(1);
  };

  const dailyPct = Math.min(100, Math.round(((quota.dailyUsed || 0) / (quota.dailyLimit || 1)) * 100));
  const monthlyPct = Math.min(100, Math.round(((quota.monthlyUsed || 0) / (quota.monthlyLimit || 1)) * 100));

  // Counts for segmented tabs
  const totalCount = stats.totalSent || rawJobs.length;
  const deliveredCount =
    stats.totalDelivered ||
    rawJobs.filter((j) => j.status === "DELIVERED" || j.status === "SENT").length;
  const pendingCount =
    stats.totalPending ||
    rawJobs.filter((j) => j.status === "PENDING" || j.status === "QUEUED" || j.status === "PROCESSING").length;
  const scheduledCount =
    stats.totalScheduled || rawJobs.filter((j) => j.status === "SCHEDULED").length;
  const failedCount =
    stats.totalFailed ||
    rawJobs.filter((j) => j.status === "FAILED" || j.status === "BOUNCED" || j.status === "COMPLAINED").length;

  if (loading && !rawJobs.length && !stats.totalSent) {
    return <EmailMonitoringSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* ── Quota Metric Cards (Matching SaaS Card Theme) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Daily Quota Card */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#FE760B]" />
              <span className="text-[12px] font-semibold text-slate-500 dark:text-[#9B9EA4] uppercase tracking-[0.6px]">
                DAILY QUOTA (RESEND)
              </span>
            </div>
            <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
              {quota.dailyUsed} / {quota.dailyLimit}
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-[#131517] overflow-hidden mb-3">
            <div
              className={`h-full transition-all rounded-full ${
                dailyPct > 90 ? "bg-red-500" : dailyPct > 75 ? "bg-[#FDE003]" : "bg-[#FE760B]"
              }`}
              style={{ width: `${dailyPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#9B9EA4]">
            <span>
              Remaining:{" "}
              <strong className="text-slate-900 dark:text-white font-semibold">
                {quota.dailyRemaining}
              </strong>
            </span>
            <span>
              Safety Margin:{" "}
              <strong className="text-amber-600 dark:text-amber-400 font-semibold">
                {quota.safetyMargin}
              </strong>{" "}
              (reserved for P0 tickets)
            </span>
          </div>
          {quota.nextDailyReset && (
            <p className="text-[11px] text-slate-400 dark:text-[#6C7075] mt-2 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-[#9B9EA4]" />
              <span>
                Next reset:{" "}
                {new Date(quota.nextDailyReset).toLocaleTimeString("en-IN", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: true,
                })}
              </span>
            </p>
          )}
        </div>

        {/* Monthly Quota Card */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#3DD68C]" />
              <span className="text-[12px] font-semibold text-slate-500 dark:text-[#9B9EA4] uppercase tracking-[0.6px]">
                MONTHLY QUOTA
              </span>
            </div>
            <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
              {quota.monthlyUsed} / {quota.monthlyLimit}
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-[#131517] overflow-hidden mb-3">
            <div
              className={`h-full transition-all rounded-full ${
                monthlyPct > 90 ? "bg-red-500" : "bg-emerald-500"
              }`}
              style={{ width: `${monthlyPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#9B9EA4]">
            <span>
              Remaining:{" "}
              <strong className="text-slate-900 dark:text-white font-semibold">
                {quota.monthlyRemaining}
              </strong>
            </span>
            <span className="text-[11px] text-slate-400 dark:text-[#6C7075]">Auto-renews monthly</span>
          </div>
        </div>
      </div>

      {/* ── Search & Filter Toolbar (Identical to Image 1) ── */}
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Spacious Search Bar */}
          <div className="relative flex-1 min-w-[260px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-[#9B9EA4]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              onKeyDown={(e) => e.key === "Enter" && loadData(false)}
              placeholder="Search by recipient email, subject, or email type..."
              className="w-full h-10 pl-10 pr-4 bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-[#9B9EA4] focus:outline-none focus:border-[#FE760B] transition-colors"
            />
          </div>

          {/* Status Filter Badges & Live Status */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {/* Real-time Status Indicator & Manual Refresh */}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] text-xs">
              <span className="relative flex h-2 w-2">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    !isRefreshing ? "bg-emerald-400" : "bg-amber-400"
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    !isRefreshing ? "bg-emerald-500" : "bg-amber-500"
                  }`}
                />
              </span>
              <span
                className={`text-[11px] font-semibold ${
                  !isRefreshing ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                }`}
              >
                {!isRefreshing ? "Live" : "Syncing"}
              </span>
              <button
                type="button"
                onClick={() => loadData(true)}
                disabled={isRefreshing || loading}
                title="Refresh email delivery status & quota"
                className="ml-1 text-slate-400 hover:text-[#FE760B] transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-[#FE760B]" : ""}`} />
              </button>
            </div>

            {/* Status Segmented Buttons */}
            <div className="inline-flex items-center bg-slate-100 dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] rounded-xl p-1 gap-1 flex-wrap sm:flex-nowrap">
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("all");
                  setCurrentPage(1);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                  statusFilter === "all"
                    ? "bg-white dark:bg-[#212327] text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-600 dark:text-[#9B9EA4] hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                All ({totalCount})
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter(statusFilter === "DELIVERED" ? "all" : "DELIVERED");
                  setCurrentPage(1);
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                  statusFilter === "DELIVERED"
                    ? "bg-white dark:bg-[#212327] text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-600 dark:text-[#9B9EA4] hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#3DD68C]" />
                Delivered ({deliveredCount})
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter(statusFilter === "PENDING" ? "all" : "PENDING");
                  setCurrentPage(1);
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                  statusFilter === "PENDING"
                    ? "bg-white dark:bg-[#212327] text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-600 dark:text-[#9B9EA4] hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#FDE003]" />
                Pending ({pendingCount})
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter(statusFilter === "SCHEDULED" ? "all" : "SCHEDULED");
                  setCurrentPage(1);
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                  statusFilter === "SCHEDULED"
                    ? "bg-white dark:bg-[#212327] text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-600 dark:text-[#9B9EA4] hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#7AA2FF]" />
                Scheduled ({scheduledCount})
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter(statusFilter === "FAILED" ? "all" : "FAILED");
                  setCurrentPage(1);
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                  statusFilter === "FAILED"
                    ? "bg-white dark:bg-[#212327] text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-600 dark:text-[#9B9EA4] hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B6B]" />
                Failed ({failedCount})
              </button>
            </div>
          </div>
        </div>

        {/* Secondary Filter Controls (Sort & Time Period) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-slate-500 dark:text-[#9B9EA4]">
          <div className="flex flex-wrap items-center gap-2">
            <StyledDropdown
              icon={ArrowUpDown}
              label="Sort"
              value={sortBy}
              options={SORT_OPTIONS}
              onChange={(val) => {
                setSortBy(val);
                setCurrentPage(1);
              }}
              align="left"
              dropDirection="down"
              menuClassName="w-56"
            />

            <StyledDropdown
              icon={Clock}
              label="Period"
              value={timeRange}
              options={PERIOD_OPTIONS}
              onChange={(val) => {
                setTimeRange(val);
                setCurrentPage(1);
              }}
              align="left"
              dropDirection="down"
              menuClassName="w-48"
            />

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-[#FE760B] hover:bg-amber-500/10 transition-colors cursor-pointer"
              >
                <RotateCcw size={12} />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Email Delivery Logs Table (Matching Image 1 Table Specs) ── */}
      <div className="bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-[#2A2D31] bg-slate-50/70 dark:bg-[#131517]/50">
                <th className="py-3 px-5 text-[12px] font-semibold text-slate-500 dark:text-[#9B9EA4] uppercase tracking-[0.6px] whitespace-nowrap min-w-[200px]">
                  EMAIL / TYPE
                </th>
                <th className="py-3 px-5 text-[12px] font-semibold text-slate-500 dark:text-[#9B9EA4] uppercase tracking-[0.6px] whitespace-nowrap min-w-[220px]">
                  RECIPIENT
                </th>
                <th className="py-3 px-4 text-[12px] font-semibold text-slate-500 dark:text-[#9B9EA4] uppercase tracking-[0.6px] whitespace-nowrap min-w-[180px]">
                  SUBJECT
                </th>
                <th className="py-3 px-4 text-[12px] font-semibold text-slate-500 dark:text-[#9B9EA4] uppercase tracking-[0.6px] text-center whitespace-nowrap">
                  ATTEMPTS
                </th>
                <th className="py-3 px-5 text-[12px] font-semibold text-slate-500 dark:text-[#9B9EA4] uppercase tracking-[0.6px] text-center whitespace-nowrap">
                  STATUS
                </th>
                <th className="py-3 px-5 text-[12px] font-semibold text-slate-500 dark:text-[#9B9EA4] uppercase tracking-[0.6px] whitespace-nowrap">
                  CREATED
                </th>
                <th className="py-3 px-5 text-[12px] font-semibold text-slate-500 dark:text-[#9B9EA4] uppercase tracking-[0.6px] text-right whitespace-nowrap">
                  ACTIONS
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-[#2A2D31]">
              {paginatedJobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 dark:text-[#9B9EA4] text-sm">
                    No email delivery logs found matching your filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedJobs.map((job) => {
                  const isDelivered = job.status === "DELIVERED" || job.status === "SENT";
                  const isScheduled = job.status === "SCHEDULED";
                  const isFailed = job.status === "FAILED";
                  const isBounced = job.status === "BOUNCED" || job.status === "COMPLAINED";
                  const isPending = !isDelivered && !isScheduled && !isFailed && !isBounced;

                  return (
                    <tr
                      key={job.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-[#212327]/60 transition-colors group"
                    >
                      {/* Column 1: EMAIL / TYPE */}
                      <td className="py-3.5 px-5 min-w-[200px]">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-lg overflow-hidden shrink-0 border flex items-center justify-center font-bold text-xs ${
                              job.priority === "P0"
                                ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/25"
                                : job.priority === "P1"
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25"
                                : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25"
                            }`}
                          >
                            <span className="font-mono">{job.priority || "P2"}</span>
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-900 dark:text-white capitalize group-hover:text-[#FE760B] transition-colors">
                              {formatEmailType(job.emailType)}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-[#9B9EA4] mt-0.5">
                              {job.priority === "P0"
                                ? "Critical Priority"
                                : job.priority === "P1"
                                ? "High Priority"
                                : "Standard Queue"}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Column 2: RECIPIENT */}
                      <td className="py-3.5 px-5 min-w-[220px]">
                        <div className="text-sm font-medium text-slate-900 dark:text-white">
                          {job.recipient}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-[#9B9EA4] mt-0.5">
                          Direct recipient
                        </div>
                      </td>

                      {/* Column 3: SUBJECT */}
                      <td className="py-3.5 px-4 min-w-[180px]">
                        <div className="text-xs text-slate-600 dark:text-[#D0D0D1] max-w-[220px] truncate" title={job.subject}>
                          {job.subject || "—"}
                        </div>
                      </td>

                      {/* Column 4: ATTEMPTS */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span className="text-sm font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
                          {job.attemptCount || 0}
                        </span>
                      </td>

                      {/* Column 5: STATUS */}
                      <td className="py-3.5 px-5 text-center whitespace-nowrap">
                        {isDelivered ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            {job.status === "DELIVERED" ? "Delivered" : "Sent"}
                          </span>
                        ) : isScheduled ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/25">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            Scheduled
                          </span>
                        ) : isFailed ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/25">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                            Failed
                          </span>
                        ) : isBounced ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/25">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            {job.status === "BOUNCED" ? "Bounced" : "Complained"}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            {job.status === "PROCESSING" ? "Processing" : "Pending"}
                          </span>
                        )}
                      </td>

                      {/* Column 6: CREATED */}
                      <td className="py-3.5 px-5 text-xs text-slate-500 dark:text-[#9B9EA4] whitespace-nowrap">
                        {formatJobDate(job.createdAt)}
                      </td>

                      {/* Column 7: ACTIONS */}
                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        {isFailed || isScheduled ? (
                          <button
                            type="button"
                            onClick={() => handleRetry(job.id)}
                            disabled={retryingId === job.id}
                            title={`Resend email to ${job.recipient}`}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-[#9B9EA4] hover:text-slate-900 dark:hover:text-white bg-white dark:bg-[#212327] hover:bg-slate-50 dark:hover:bg-[#2A2D31] border border-slate-200 dark:border-[#2A2D31] transition-all inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-2xs"
                          >
                            <RotateCcw
                              className={`w-3.5 h-3.5 text-[#FE760B] ${
                                retryingId === job.id ? "animate-spin" : ""
                              }`}
                            />
                            <span>{retryingId === job.id ? "Resending..." : "Resend"}</span>
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400 dark:text-[#9B9EA4] italic">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {filteredJobs.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3.5 border-t border-slate-200 dark:border-[#2A2D31] bg-slate-50/50 dark:bg-[#131517]/30 text-xs text-slate-500 dark:text-[#9B9EA4]">
            <div>
              Showing{" "}
              <strong className="text-slate-900 dark:text-white font-semibold">
                {(currentPage - 1) * ITEMS_PER_PAGE + 1}
              </strong>{" "}
              to{" "}
              <strong className="text-slate-900 dark:text-white font-semibold">
                {Math.min(currentPage * ITEMS_PER_PAGE, filteredJobs.length)}
              </strong>{" "}
              of{" "}
              <strong className="text-slate-900 dark:text-white font-semibold">
                {filteredJobs.length}
              </strong>{" "}
              jobs
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#2A2D31] bg-white dark:bg-[#1A1C1F] text-slate-700 dark:text-[#D0D0D1] hover:bg-slate-100 dark:hover:bg-[#212327] transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>

              <span className="px-2 font-medium">
                Page {currentPage} of {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#2A2D31] bg-white dark:bg-[#1A1C1F] text-slate-700 dark:text-[#D0D0D1] hover:bg-slate-100 dark:hover:bg-[#212327] transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
