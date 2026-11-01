"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Mail,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  ShieldAlert,
  Search,
  Filter,
  Send,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

export function EmailMonitoringDashboard() {
  const [loading, setLoading] = useState(true);
  const [retryingId, setRetryingId] = useState(null);
  const [data, setData] = useState({
    quota: {
      dailyUsed: 0,
      dailyLimit: 100,
      dailyRemaining: 100,
      monthlyUsed: 0,
      monthlyLimit: 3000,
      monthlyRemaining: 3000,
      safetyMargin: 5,
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
  });

  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchEmailData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (searchQuery) params.set("recipient", searchQuery);

      const res = await fetch(`/api/admin/emails?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Failed to load email statistics");
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      toast.error(err.message || "Could not fetch email metrics");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    let ignore = false;
    async function loadData() {
      try {
        const params = new URLSearchParams();
        if (statusFilter) params.set("status", statusFilter);

        const res = await fetch(`/api/admin/emails?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to load email statistics");
        const json = await res.json();
        if (!ignore) {
          setData(json);
          setLoading(false);
        }
      } catch (err) {
        if (!ignore) {
          toast.error(err.message || "Could not fetch email metrics");
          setLoading(false);
        }
      }
    }
    loadData();
    return () => {
      ignore = true;
    };
  }, [statusFilter]);

  const handleRetry = async (jobId) => {
    try {
      setRetryingId(jobId);
      const res = await fetch("/api/admin/emails/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Retry failed");
      toast.success(`Job ${jobId} successfully re-queued`);
      fetchEmailData();
    } catch (err) {
      toast.error(err.message || "Failed to retry job");
    } finally {
      setRetryingId(null);
    }
  };

  const dailyPct = Math.min(100, Math.round((data.quota.dailyUsed / (data.quota.dailyLimit || 1)) * 100));
  const monthlyPct = Math.min(100, Math.round((data.quota.monthlyUsed / (data.quota.monthlyLimit || 1)) * 100));

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Mail className="w-5 h-5 text-[#FE760B]" />
            Email Infrastructure & Quota
          </h1>
          <p className="text-xs text-[#9B9EA4] mt-0.5">
            Real-time delivery status, Resend daily quota management & persistent queue monitoring
          </p>
        </div>
        <button
          onClick={fetchEmailData}
          disabled={loading}
          className="px-3.5 py-2 rounded-xl bg-[#212327] hover:bg-[#2A2D31] text-xs font-semibold text-white border border-[#2A2D31] transition-colors flex items-center gap-2 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Quota Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Daily Quota Card */}
        <div className="p-4 rounded-2xl bg-[#1A1C1F] border border-[#2A2D31]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#9B9EA4] uppercase tracking-wider">
              Daily Quota (Resend)
            </span>
            <span className="text-xs font-bold text-white">
              {data.quota.dailyUsed} / {data.quota.dailyLimit}
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-[#131517] overflow-hidden mb-3">
            <div
              className={`h-full transition-all ${
                dailyPct > 90 ? "bg-red-500" : dailyPct > 75 ? "bg-[#FDE003]" : "bg-[#FE760B]"
              }`}
              style={{ width: `${dailyPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-[#9B9EA4]">
            <span>Remaining: <strong className="text-white">{data.quota.dailyRemaining}</strong></span>
            <span>Safety Margin: <strong className="text-amber-400">{data.quota.safetyMargin}</strong> (reserved for P0 tickets)</span>
          </div>
          {data.quota.nextDailyReset && (
            <p className="text-[10px] text-[#6C7075] mt-2 flex items-center gap-1">
              <Clock className="w-3 h-3 text-[#9B9EA4]" />
              Next reset: {new Date(data.quota.nextDailyReset).toUTCString()}
            </p>
          )}
        </div>

        {/* Monthly Quota Card */}
        <div className="p-4 rounded-2xl bg-[#1A1C1F] border border-[#2A2D31]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#9B9EA4] uppercase tracking-wider">
              Monthly Quota
            </span>
            <span className="text-xs font-bold text-white">
              {data.quota.monthlyUsed} / {data.quota.monthlyLimit}
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-[#131517] overflow-hidden mb-3">
            <div
              className={`h-full transition-all ${
                monthlyPct > 90 ? "bg-red-500" : "bg-emerald-500"
              }`}
              style={{ width: `${monthlyPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-[#9B9EA4]">
            <span>Remaining: <strong className="text-white">{data.quota.monthlyRemaining}</strong></span>
            <span>Resets on: 1st of next month (00:00 UTC)</span>
          </div>
        </div>
      </div>

      {/* Aggregate Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="p-3 rounded-xl bg-[#1A1C1F] border border-[#2A2D31] text-center">
          <p className="text-[10px] uppercase font-bold text-[#9B9EA4]">Sent</p>
          <p className="text-lg font-extrabold text-white mt-1">{data.stats.totalSent}</p>
        </div>
        <div className="p-3 rounded-xl bg-[#1A1C1F] border border-[#2A2D31] text-center">
          <p className="text-[10px] uppercase font-bold text-emerald-400">Delivered</p>
          <p className="text-lg font-extrabold text-emerald-400 mt-1">{data.stats.totalDelivered}</p>
        </div>
        <div className="p-3 rounded-xl bg-[#1A1C1F] border border-[#2A2D31] text-center">
          <p className="text-[10px] uppercase font-bold text-blue-400">Pending</p>
          <p className="text-lg font-extrabold text-blue-400 mt-1">{data.stats.totalPending}</p>
        </div>
        <div className="p-3 rounded-xl bg-[#1A1C1F] border border-[#2A2D31] text-center">
          <p className="text-[10px] uppercase font-bold text-amber-400">Scheduled</p>
          <p className="text-lg font-extrabold text-amber-400 mt-1">{data.stats.totalScheduled}</p>
        </div>
        <div className="p-3 rounded-xl bg-[#1A1C1F] border border-[#2A2D31] text-center">
          <p className="text-[10px] uppercase font-bold text-red-400">Failed (DLQ)</p>
          <p className="text-lg font-extrabold text-red-400 mt-1">{data.stats.totalFailed}</p>
        </div>
        <div className="p-3 rounded-xl bg-[#1A1C1F] border border-[#2A2D31] text-center">
          <p className="text-[10px] uppercase font-bold text-rose-400">Bounced</p>
          <p className="text-lg font-extrabold text-rose-400 mt-1">{data.stats.totalBounced}</p>
        </div>
        <div className="p-3 rounded-xl bg-[#1A1C1F] border border-[#2A2D31] text-center">
          <p className="text-[10px] uppercase font-bold text-purple-400">Complaints</p>
          <p className="text-lg font-extrabold text-purple-400 mt-1">{data.stats.totalComplained}</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3 rounded-xl bg-[#1A1C1F] border border-[#2A2D31] flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9B9EA4]" />
          <input
            type="text"
            placeholder="Search by recipient email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchEmailData()}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-[#212327] border border-[#2A2D31] text-xs text-white placeholder-[#9B9EA4] focus:outline-none focus:border-[#FE760B]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-[#9B9EA4]" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-[#212327] border border-[#2A2D31] text-xs text-white focus:outline-none focus:border-[#FE760B]"
          >
            <option value="">All Statuses</option>
            <option value="QUEUED">QUEUED</option>
            <option value="PROCESSING">PROCESSING</option>
            <option value="SCHEDULED">SCHEDULED (Deferred)</option>
            <option value="SENT">SENT</option>
            <option value="DELIVERED">DELIVERED</option>
            <option value="FAILED">FAILED</option>
            <option value="BOUNCED">BOUNCED</option>
            <option value="COMPLAINED">COMPLAINED</option>
          </select>
        </div>
      </div>

      {/* Jobs Table */}
      <div className="rounded-2xl bg-[#1A1C1F] border border-[#2A2D31] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#2A2D31] bg-[#131517] text-[#9B9EA4]">
                <th className="py-3 px-4 font-semibold uppercase text-[10px]">Priority / Type</th>
                <th className="py-3 px-4 font-semibold uppercase text-[10px]">Recipient</th>
                <th className="py-3 px-4 font-semibold uppercase text-[10px]">Subject</th>
                <th className="py-3 px-4 font-semibold uppercase text-[10px]">Status</th>
                <th className="py-3 px-4 font-semibold uppercase text-[10px]">Attempts</th>
                <th className="py-3 px-4 font-semibold uppercase text-[10px]">Created</th>
                <th className="py-3 px-4 font-semibold uppercase text-[10px] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2A2D31]">
              {data.jobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#9B9EA4]">
                    No email jobs matching criteria.
                  </td>
                </tr>
              ) : (
                data.jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-[#212327]/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          job.priority === "P0" ? "bg-red-500/20 text-red-400" :
                          job.priority === "P1" ? "bg-amber-500/20 text-amber-400" :
                          job.priority === "P2" ? "bg-blue-500/20 text-blue-400" :
                          "bg-purple-500/20 text-purple-400"
                        }`}>
                          {job.priority}
                        </span>
                        <span className="text-[11px] text-[#9B9EA4]">{job.emailType}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-medium text-white font-mono text-[11px]">
                      {job.recipient}
                    </td>
                    <td className="py-3 px-4 text-[#D0D0D1] max-w-[200px] truncate">
                      {job.subject}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        job.status === "DELIVERED" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                        job.status === "SENT" ? "bg-emerald-500/10 text-emerald-400" :
                        job.status === "SCHEDULED" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                        job.status === "FAILED" ? "bg-red-500/10 text-red-400 border border-red-500/20" :
                        job.status === "BOUNCED" || job.status === "COMPLAINED" ? "bg-rose-500/10 text-rose-400" :
                        "bg-blue-500/10 text-blue-400"
                      }`}>
                        {job.status === "SCHEDULED" ? "Deferred (Quota)" : job.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[#9B9EA4]">
                      {job.attemptCount || 0}
                    </td>
                    <td className="py-3 px-4 text-[#9B9EA4] text-[11px]">
                      {job.createdAt ? new Date(job.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "-"}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {(job.status === "FAILED" || job.status === "SCHEDULED") && (
                        <button
                          onClick={() => handleRetry(job.id)}
                          disabled={retryingId === job.id}
                          className="px-2.5 py-1 rounded bg-[#212327] hover:bg-[#2A2D31] text-[11px] font-semibold text-white border border-[#2A2D31] transition-colors"
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
