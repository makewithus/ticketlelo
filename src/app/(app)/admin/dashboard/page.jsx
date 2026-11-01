"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle,
  XCircle,
  Clock,
  Inbox,
  Activity,
  RefreshCw,
  Loader2,
  Eye,
  Search,
  Calendar,
  Radio,
} from "lucide-react";
import { EventManagement } from "@/components/admin/event-management";
import Link from "next/link";
import { db, auth } from "@/lib/firebase";
import { useAuth } from "@/context/auth-context";
import { getAllEvents, getEventsByOrganiser } from "@/lib/firestore";
import { subscribeToHostingRequests } from "@/lib/hosting-requests";

function formatTs(ts) {
  if (!ts) return "—";
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function relativeTime(ts) {
  if (!ts) return "";
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  } catch {
    return "";
  }
}

function StatusBadge({ status }) {
  const map = {
    pending: {
      cls: "bg-[#FDE003]/12 text-[#FDE003] border border-[#FDE003]/25",
      label: "Pending",
    },
    approved: {
      cls: "bg-[#3DD68C]/12 text-[#3DD68C] border border-[#3DD68C]/25",
      label: "Approved",
    },
    rejected: {
      cls: "bg-[#FF6B6B]/12 text-[#FF6B6B] border border-[#FF6B6B]/25",
      label: "Rejected",
    },
  };
  const { cls, label } = map[status] || {
    cls: "bg-white/7 text-[#9B9EA4] border border-[#2A2D31]",
    label: status,
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  iconBg,
  iconColor,
  loading,
}) {
  return (
    <div className="bg-white dark:bg-[#1A1C1F] rounded-2xl border border-slate-200 dark:border-[#2A2D31] p-4 sm:p-5 flex items-center gap-3.5 sm:gap-4 shadow-sm transition-colors">
      <div
        className={`w-11 h-11 sm:w-12 sm:h-12 ${iconBg} rounded-xl flex items-center justify-center flex-shrink-0 border border-slate-200/60 dark:border-[#2A2D31]`}
      >
        <Icon size={20} className={iconColor} />
      </div>
      <div className="min-w-0">
        {loading ? (
          <Loader2 size={20} className="animate-spin text-slate-400 dark:text-[#9B9EA4] my-1" />
        ) : (
          <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight truncate">{value}</div>
        )}
        <div className="text-xs text-slate-500 dark:text-[#9B9EA4] mt-0.5 truncate">{label}</div>
        {sub && !loading && (
          <div className="text-[11px] text-slate-400 dark:text-[#9B9EA4]/80 mt-0.5 truncate">{sub}</div>
        )}
      </div>
    </div>
  );
}

const FILTERS = ["All", "Pending", "Approved", "Rejected"];

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("events");

  const loadData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      try {
        let headers = {};
        try {
          if (auth?.currentUser) {
            const token = await auth.currentUser.getIdToken();
            if (token) headers.Authorization = `Bearer ${token}`;
          }
        } catch (_) {}

        const reqRes = await fetch("/api/hosting-requests", {
          headers,
          cache: "no-store",
        });
        if (reqRes.ok) {
          const reqJson = await reqRes.json();
          setRequests(reqJson.requests || []);
        } else {
          setRequests([]);
        }
      } catch (reqErr) {
        console.warn("Could not load hosting requests:", reqErr);
        setRequests([]);
      }

      // Fetch events from Firestore
      if (user?.id) {
        let evts = [];
        try {
          if (user.role === "superAdmin") {
            evts = await getAllEvents();
          } else {
            evts = await getEventsByOrganiser(user.id);
          }
        } catch (evtErr) {
          console.warn("Could not load events:", evtErr);
        }
        const unique = [];
        const seen = new Set();
        for (const ev of (evts || [])) {
          if (ev?.id && !seen.has(ev.id)) {
            seen.add(ev.id);
            unique.push(ev);
          }
        }
        setEvents(unique);
      }
    } catch (e) {
      console.error("Failed to load dashboard data:", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData(false);
    }, 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  useEffect(() => {
    if (user?.role === "superAdmin") {
      const unsub = subscribeToHostingRequests((liveReqs) => {
        setRequests(liveReqs);
      });
      return () => {
        if (typeof unsub === "function") unsub();
      };
    }
  }, [user]);

  const totalEvents = events.length;
  const liveEvents = events.filter((e) => e.published === true).length;

  // For organisers, show only their own requests (matched by email)
  const myRequests =
    user?.role === "superAdmin"
      ? requests
      : requests.filter(
          (r) => r.email?.toLowerCase() === user?.email?.toLowerCase(),
        );

  const total = myRequests.length;
  const pending = myRequests.filter((r) => r.status === "pending").length;
  const approved = myRequests.filter((r) => r.status === "approved").length;
  const rejected = myRequests.filter((r) => r.status === "rejected").length;

  const filtered = myRequests.filter((r) => {
    const matchFilter =
      filter === "All" || r.status?.toLowerCase() === filter.toLowerCase();
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      r.eventTitle?.toLowerCase().includes(q) ||
      r.organizerName?.toLowerCase().includes(q) ||
      r.email?.toLowerCase().includes(q);
    return matchFilter && matchSearch;
  });

  const activityLog = [...myRequests]
    .filter((r) => r.status !== "pending")
    .sort((a, b) => {
      const ta = a.updatedAt?.toDate?.() || new Date(a.updatedAt || 0);
      const tb = b.updatedAt?.toDate?.() || new Date(b.updatedAt || 0);
      return tb - ta;
    })
    .slice(0, 8);

  return (
    <div className="space-y-6 sm:space-y-8 min-h-screen text-slate-900 dark:text-white transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
            Admin dashboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-[#9B9EA4] mt-1">
            Manage events, hosting requests, and platform activity
          </p>
        </div>
        <button
          onClick={loadData}
          className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-[#212327] border border-slate-200 dark:border-[#2A2D31] text-slate-500 dark:text-[#9B9EA4] hover:text-slate-900 dark:hover:text-white transition-all"
          title="Refresh"
        >
          <RefreshCw size={17} className={loading ? "animate-spin text-[#FE760B]" : ""} />
        </button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard
          icon={Radio}
          label="Live Events"
          value={liveEvents}
          sub={liveEvents > 0 ? "Currently published" : undefined}
          iconBg="bg-[#3DD68C]/12"
          iconColor="text-[#3DD68C]"
          loading={loading}
        />
        <MetricCard
          icon={Calendar}
          label="Total Events"
          value={totalEvents}
          iconBg="bg-slate-100 dark:bg-white/5"
          iconColor="text-slate-600 dark:text-[#D0D0D1]"
          loading={loading}
        />
        <MetricCard
          icon={Inbox}
          label="Total Requests"
          value={total}
          iconBg="bg-[#FE760B]/14"
          iconColor="text-[#FE760B]"
          loading={loading}
        />
        <MetricCard
          icon={Clock}
          label="Pending Approval"
          value={pending}
          sub={pending > 0 ? "Needs review" : undefined}
          iconBg="bg-[#FDE003]/10"
          iconColor="text-[#FDE003]"
          loading={loading}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-[#1A1C1F] rounded-xl p-1 max-w-full overflow-x-auto no-scrollbar border border-slate-200 dark:border-[#2A2D31]">
        {[
          { id: "events", label: "Events" },
          {
            id: "requests",
            label: `Hosting requests${pending > 0 ? ` (${pending})` : ""}`,
          },
          { id: "activity", label: "Activity log" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap shrink-0 ${
              activeTab === t.id
                ? "bg-[#FE760B] text-[#131517] shadow-sm"
                : "text-slate-600 dark:text-[#9B9EA4] hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Events */}
      {activeTab === "events" && (
        <div className="w-full">
          <EventManagement />
        </div>
      )}

      {/* Tab: Hosting Requests */}
      {activeTab === "requests" && (
        <div className="bg-white dark:bg-[#1A1C1F] rounded-2xl border border-slate-200 dark:border-[#2A2D31] shadow-sm overflow-hidden transition-colors">
          <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-[#2A2D31] flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
            <div className="flex gap-1.5 flex-wrap">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    filter === f
                      ? "bg-[#FE760B] text-[#131517] shadow-sm"
                      : "bg-slate-100 dark:bg-[#212327] text-slate-600 dark:text-[#9B9EA4] hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-[#2A2D31]"
                  }`}
                >
                  {f}
                  {f === "Pending" && pending > 0 && (
                    <span className="ml-1.5 bg-[#131517]/20 text-[#131517] rounded-full px-1.5 text-xs font-bold">
                      {pending}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#9B9EA4]"
              />
              <input
                type="text"
                placeholder="Search requests…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 py-2 text-sm bg-slate-100 dark:bg-[#212327] border border-slate-200 dark:border-[#2A2D31] rounded-xl outline-none focus:ring-1 focus:ring-[#FE760B] focus:border-[#FE760B] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-[#9B9EA4] w-full sm:w-52 transition-colors"
              />
            </div>
          </div>
          {loading ? (
            <div className="py-16 flex items-center justify-center gap-2 text-slate-500 dark:text-[#9B9EA4]">
              <Loader2 size={20} className="animate-spin text-[#FE760B]" /> Loading requests…
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-slate-500 dark:text-[#9B9EA4]">
              <Inbox size={36} className="mx-auto mb-3 opacity-60" />
              <p className="text-sm">No requests found</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-[#2A2D31]">
              {filtered.map((req, idx) => (
                <div
                  key={`${req.id || "req"}-${idx}`}
                  className="px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 hover:bg-slate-50 dark:hover:bg-[#212327]/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                        {req.eventTitle || "Untitled event"}
                      </p>
                      <StatusBadge status={req.status} />
                    </div>
                    <p className="text-xs text-slate-500 dark:text-[#9B9EA4] mt-0.5">
                      {req.organizerName || req.name} · {req.email}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-[#9B9EA4]/70 mt-0.5">
                      Submitted {relativeTime(req.createdAt)} ·{" "}
                      {formatTs(req.createdAt)}
                    </p>
                  </div>
                  <Link
                    href="/superadmin/hosting-requests"
                    prefetch={false}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-[#D0D0D1] bg-slate-50 dark:bg-transparent border border-slate-200 dark:border-[#2A2D31] rounded-lg hover:bg-slate-100 dark:hover:bg-[#212327] hover:text-[#FE760B] dark:hover:text-white transition-colors flex-shrink-0"
                  >
                    <Eye size={12} /> Review
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Activity Log */}
      {activeTab === "activity" && (
        <div className="bg-white dark:bg-[#1A1C1F] rounded-2xl border border-slate-200 dark:border-[#2A2D31] shadow-sm overflow-hidden transition-colors">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-[#2A2D31] flex items-center gap-2">
            <Activity size={16} className="text-[#FE760B]" />
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">
              Recent activity
            </h3>
          </div>
          {loading ? (
            <div className="py-12 flex items-center justify-center gap-2 text-slate-500 dark:text-[#9B9EA4]">
              <Loader2 size={18} className="animate-spin text-[#FE760B]" />
            </div>
          ) : activityLog.length === 0 ? (
            <div className="py-12 text-center text-slate-500 dark:text-[#9B9EA4] text-sm">
              No recent activity
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-[#2A2D31]">
              {activityLog.map((req, idx) => (
                <div key={`${req.id || "act"}-${idx}`} className="px-4 sm:px-5 py-4 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-[#212327]/30 transition-colors">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${req.status === "approved" ? "bg-[#3DD68C]/12 text-[#3DD68C]" : "bg-[#FF6B6B]/12 text-[#FF6B6B]"}`}
                  >
                    {req.status === "approved" ? (
                      <CheckCircle size={13} />
                    ) : (
                      <XCircle size={13} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700 dark:text-[#D0D0D1]">
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {req.eventTitle || "Unnamed event"}
                      </span>{" "}
                      was{" "}
                      <span
                        className={
                          req.status === "approved"
                            ? "text-[#3DD68C] font-semibold"
                            : "text-[#FF6B6B] font-semibold"
                        }
                      >
                        {req.status}
                      </span>
                    </p>
                    <p className="text-xs text-slate-500 dark:text-[#9B9EA4] mt-0.5">
                      Organiser: {req.organizerName || req.name || "Unknown"}
                    </p>
                    {req.rejectionReason && (
                      <p className="text-xs text-rose-500 dark:text-[#FF9A9A] mt-0.5 italic">
                        Reason: {req.rejectionReason}
                      </p>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 dark:text-[#9B9EA4]/70 flex-shrink-0">
                    {relativeTime(req.updatedAt || req.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
