"use client";

import { useState, useEffect, useCallback, useRef, useTransition } from "react";
import {
  Mail,
  RefreshCw,
  Clock,
  Search,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { auth } from "@/lib/firebase";
import { StyledDropdown } from "@/components/ui/styled-dropdown";
import { getCachedItem, setCachedItem } from "@/lib/client-cache";
import { parseFirestoreDate } from "@/lib/date-utils";
import { EmailMonitoringSkeleton } from "@/components/ui/skeleton";

const CACHE_KEY = "superadmin_email_monitoring";

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
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
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
      if (statusFilter) params.set("status", statusFilter);
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
      if (!statusFilter && !searchQuery.trim()) {
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

  // If still loading and we have no cached data, display the skeleton loading state
  if (loading && (!data?.jobs?.length && !data?.stats?.totalSent)) {
    return <EmailMonitoringSkeleton />;
  }

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

  const jobs = Array.isArray(data?.jobs) ? data.jobs : [];

  const dailyPct = Math.min(100, Math.round(((quota.dailyUsed || 0) / (quota.dailyLimit || 1)) * 100));
  const monthlyPct = Math.min(100, Math.round(((quota.monthlyUsed || 0) / (quota.monthlyLimit || 1)) * 100));

  return (
    <div className="space-y-6 text-slate-900 dark:text-white transition-colors animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Mail className="w-5 h-5 text-[#FE760B]" />
            Email Infrastructure &amp; Quota
          </h1>
          <p className="text-xs text-slate-500 dark:text-[#9B9EA4] mt-0.5">
            Real-time delivery status, Resend daily quota management &amp; persistent queue monitoring
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={isRefreshing || loading}
            title="Refresh email delivery status & quota"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white dark:bg-[#1A1C1F] hover:bg-slate-100 dark:hover:bg-[#212327] border border-slate-200 dark:border-[#2A2D31] text-xs font-semibold text-slate-700 dark:text-[#D0D0D1] hover:text-slate-900 dark:hover:text-white transition-all shadow-sm cursor-pointer disabled:opacity-50 min-h-[36px]"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#FE760B] ${isRefreshing ? "animate-spin" : ""}`} />
            <span>{isRefreshing ? "Syncing..." : "Refresh"}</span>
          </button>
        </div>
      </div>

      {/* Quota Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Daily Quota Card */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-[#9B9EA4] uppercase tracking-wider">
              Daily Quota (Resend)
            </span>
            <span className="text-xs font-bold text-slate-900 dark:text-white">
              {quota.dailyUsed} / {quota.dailyLimit}
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-[#131517] overflow-hidden mb-3">
            <div
              className={`h-full transition-all ${
                dailyPct > 90 ? "bg-red-500" : dailyPct > 75 ? "bg-[#FDE003]" : "bg-[#FE760B]"
              }`}
              style={{ width: `${dailyPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-[#9B9EA4]">
            <span>Remaining: <strong className="text-slate-900 dark:text-white">{quota.dailyRemaining}</strong></span>
            <span>Safety Margin: <strong className="text-amber-500 dark:text-amber-400">{quota.safetyMargin}</strong> (reserved for P0 tickets)</span>
          </div>
          {quota.nextDailyReset && (
            <p className="text-[10px] text-slate-400 dark:text-[#6C7075] mt-2 flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-400 dark:text-[#9B9EA4]" />
              Next reset: {new Date(quota.nextDailyReset).toUTCString()}
            </p>
          )}
        </div>

        {/* Monthly Quota Card */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-[#9B9EA4] uppercase tracking-wider">
              Monthly Quota
            </span>
            <span className="text-xs font-bold text-slate-900 dark:text-white">
              {quota.monthlyUsed} / {quota.monthlyLimit}
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-[#131517] overflow-hidden mb-3">
            <div
              className={`h-full transition-all ${
                monthlyPct > 90 ? "bg-red-500" : "bg-emerald-500"
              }`}
              style={{ width: `${monthlyPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-[#9B9EA4]">
            <span>Remaining: <strong className="text-slate-900 dark:text-white">{quota.monthlyRemaining}</strong></span>
          </div>
        </div>
      </div>

      {/* Aggregate Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="p-3 rounded-xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] text-center shadow-xs">
          <p className="text-[10px] uppercase font-bold text-slate-500 dark:text-[#9B9EA4]">Sent</p>
          <p className="text-lg font-extrabold text-slate-900 dark:text-white mt-1">{stats.totalSent}</p>
        </div>
        <div className="p-3 rounded-xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] text-center shadow-xs">
          <p className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400">Delivered</p>
          <p className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">{stats.totalDelivered}</p>
        </div>
        <div className="p-3 rounded-xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] text-center shadow-xs">
          <p className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400">Pending</p>
          <p className="text-lg font-extrabold text-blue-600 dark:text-blue-400 mt-1">{stats.totalPending}</p>
        </div>
        <div className="p-3 rounded-xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] text-center shadow-xs">
          <p className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400">Scheduled</p>
          <p className="text-lg font-extrabold text-amber-600 dark:text-amber-400 mt-1">{stats.totalScheduled}</p>
        </div>
        <div className="p-3 rounded-xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] text-center shadow-xs">
          <p className="text-[10px] uppercase font-bold text-red-600 dark:text-red-400">Failed (DLQ)</p>
          <p className="text-lg font-extrabold text-red-600 dark:text-red-400 mt-1">{stats.totalFailed}</p>
        </div>
        <div className="p-3 rounded-xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] text-center shadow-xs">
          <p className="text-[10px] uppercase font-bold text-rose-600 dark:text-rose-400">Bounced</p>
          <p className="text-lg font-extrabold text-rose-600 dark:text-rose-400 mt-1">{stats.totalBounced}</p>
        </div>
        <div className="p-3 rounded-xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] text-center shadow-xs">
          <p className="text-[10px] uppercase font-bold text-purple-600 dark:text-purple-400">Complaints</p>
          <p className="text-lg font-extrabold text-purple-600 dark:text-purple-400 mt-1">{stats.totalComplained}</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3 rounded-xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] flex flex-col sm:flex-row items-center gap-3 shadow-xs">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#9B9EA4]" />
          <input
            type="text"
            placeholder="Search by recipient email... (Press Enter to search)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadData(false)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-50 dark:bg-[#212327] border border-slate-200 dark:border-[#2A2D31] text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-[#9B9EA4] focus:outline-none focus:border-[#FE760B] transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <StyledDropdown
            icon={Filter}
            label="Status"
            value={statusFilter}
            options={[
              { value: "", label: "All Statuses" },
              { value: "QUEUED", label: "QUEUED" },
              { value: "PROCESSING", label: "PROCESSING" },
              { value: "SCHEDULED", label: "SCHEDULED (Deferred)" },
              { value: "SENT", label: "SENT" },
              { value: "DELIVERED", label: "DELIVERED" },
              { value: "FAILED", label: "FAILED" },
              { value: "BOUNCED", label: "BOUNCED" },
              { value: "COMPLAINED", label: "COMPLAINED" },
            ]}
            onChange={(val) => setStatusFilter(val)}
            align="right"
            buttonClassName="h-9 rounded-lg bg-slate-50 dark:bg-[#212327] border-slate-200 dark:border-[#2A2D31] text-slate-700 dark:text-white"
            menuClassName="w-56"
          />
        </div>
      </div>

      {/* Jobs Table */}
      <div className="rounded-2xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-[#2A2D31] bg-slate-50 dark:bg-[#131517] text-slate-500 dark:text-[#9B9EA4]">
                <th className="py-3 px-4 font-semibold uppercase text-[10px] whitespace-nowrap min-w-[140px]">Priority / Type</th>
                <th className="py-3 px-4 font-semibold uppercase text-[10px] whitespace-nowrap min-w-[160px]">Recipient</th>
                <th className="py-3 px-4 font-semibold uppercase text-[10px] whitespace-nowrap min-w-[180px]">Subject</th>
                <th className="py-3 px-4 font-semibold uppercase text-[10px] whitespace-nowrap">Status</th>
                <th className="py-3 px-4 font-semibold uppercase text-[10px] whitespace-nowrap">Attempts</th>
                <th className="py-3 px-4 font-semibold uppercase text-[10px] whitespace-nowrap">Created</th>
                <th className="py-3 px-4 font-semibold uppercase text-[10px] text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#2A2D31]">
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 dark:text-[#9B9EA4]">
                    No email jobs matching criteria.
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-50 dark:hover:bg-[#212327]/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          job.priority === "P0" ? "bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/25" :
                          job.priority === "P1" ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25" :
                          job.priority === "P2" ? "bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/25" :
                          "bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/25"
                        }`}>
                          {job.priority}
                        </span>
                        <span className="text-[11px] text-slate-600 dark:text-[#9B9EA4] font-medium">{job.emailType}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900 dark:text-white font-mono text-[11px]">
                      {job.recipient}
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-[#D0D0D1] max-w-[200px] truncate">
                      {job.subject}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        job.status === "DELIVERED" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" :
                        job.status === "SENT" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" :
                        job.status === "SCHEDULED" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20" :
                        job.status === "FAILED" ? "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20" :
                        job.status === "BOUNCED" || job.status === "COMPLAINED" ? "bg-rose-500/10 text-rose-600 dark:text-rose-400" :
                        "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                      }`}>
                        {job.status === "SCHEDULED" ? "Deferred (Quota)" : job.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-[#9B9EA4]">
                      {job.attemptCount || 0}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-[#9B9EA4] text-[11px] whitespace-nowrap">
                      {formatJobDate(job.createdAt)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {(job.status === "FAILED" || job.status === "SCHEDULED") && (
                        <button
                          onClick={() => handleRetry(job.id)}
                          disabled={retryingId === job.id}
                          className="px-2.5 py-1 rounded bg-slate-100 dark:bg-[#212327] hover:bg-slate-200 dark:hover:bg-[#2A2D31] text-[11px] font-semibold text-slate-700 dark:text-white border border-slate-200 dark:border-[#2A2D31] transition-colors cursor-pointer"
                        >
                          {retryingId === job.id ? "Retrying..." : "Retry"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
