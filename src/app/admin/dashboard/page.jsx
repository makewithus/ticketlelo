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
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/auth-context";

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
      cls: "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30",
      label: "Pending",
    },
    approved: {
      cls: "bg-green-500/20 text-green-400 border border-green-500/30",
      label: "Approved",
    },
    rejected: {
      cls: "bg-red-500/20 text-red-400 border border-red-500/30",
      label: "Rejected",
    },
  };
  const { cls, label } = map[status] || {
    cls: "bg-slate-700 text-slate-400",
    label: status,
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
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
    <div className="bg-white dark:bg-slate-900/60 rounded-2xl border border-[#FE760B]/10 p-5 flex items-center gap-4 shadow-sm">
      <div
        className={`w-12 h-12 ${iconBg} rounded-xl flex items-center justify-center flex-shrink-0`}
      >
        <Icon size={22} className={iconColor} />
      </div>
      <div>
        {loading ? (
          <Loader2 size={20} className="animate-spin text-gray-400 dark:text-slate-600 my-1" />
        ) : (
          <div className="text-2xl font-extrabold text-gray-900 dark:text-slate-100">{value}</div>
        )}
        <div className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{label}</div>
        {sub && !loading && (
          <div className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{sub}</div>
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

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [reqRes] = await Promise.all([
        fetch("/api/hosting-requests"),
      ]);
      const reqJson = await reqRes.json();
      setRequests(reqJson.requests || []);

      // Fetch events from Firestore
      if (user?.id) {
        const eventsRef = collection(db, "events");
        const q = user.role === "superAdmin"
          ? query(eventsRef)
          : query(eventsRef, where("organiserId", "==", user.id));
        const snap = await getDocs(q);
        setEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      }
    } catch (e) {
      console.error("Failed to load dashboard data:", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
    <div className="p-6 md:p-8 space-y-8 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-slate-100">
            Admin Dashboard
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Manage events, hosting requests, and platform activity
          </p>
        </div>
        <button
          onClick={loadData}
          className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200 transition-all"
          title="Refresh"
        >
          <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          icon={Radio}
          label="Live Events"
          value={liveEvents}
          sub={liveEvents > 0 ? "Currently published" : undefined}
          iconBg="bg-green-500/10"
          iconColor="text-green-500"
          loading={loading}
        />
        <MetricCard
          icon={Calendar}
          label="Total Events"
          value={totalEvents}
          iconBg="bg-blue-500/10"
          iconColor="text-blue-500"
          loading={loading}
        />
        <MetricCard
          icon={Inbox}
          label="Total Requests"
          value={total}
          iconBg="bg-[#FE760B]/10"
          iconColor="text-[#FE760B]"
          loading={loading}
        />
        <MetricCard
          icon={Clock}
          label="Pending Approval"
          value={pending}
          sub={pending > 0 ? "Needs review" : undefined}
          iconBg="bg-yellow-500/10"
          iconColor="text-yellow-500"
          loading={loading}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-slate-800/60 rounded-xl p-1 w-fit border border-gray-200 dark:border-slate-700/50">
        {[
          { id: "events", label: "Events" },
          {
            id: "requests",
            label: `Hosting Requests${pending > 0 ? ` (${pending})` : ""}`,
          },
          { id: "activity", label: "Activity Log" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === t.id
                ? "bg-[#FE760B] text-white shadow-sm"
                : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Events */}
      {activeTab === "events" && (
        <div className="bg-white dark:bg-slate-900/60 rounded-2xl border border-[#FE760B]/10 p-6 shadow-sm">
          <EventManagement />
        </div>
      )}

      {/* Tab: Hosting Requests */}
      {activeTab === "requests" && (
        <div className="bg-white dark:bg-slate-900/60 rounded-2xl border border-[#FE760B]/10 shadow-sm">
          <div className="p-5 border-b border-gray-100 dark:border-slate-800 flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
            <div className="flex gap-1.5 flex-wrap">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    filter === f
                      ? "bg-[#FE760B] text-white"
                      : "bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700"
                  }`}
                >
                  {f}
                  {f === "Pending" && pending > 0 && (
                    <span className="ml-1.5 bg-white/20 text-white rounded-full px-1.5 text-xs">
                      {pending}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500"
              />
              <input
                type="text"
                placeholder="Search requests…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 py-2 text-sm bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-[#FE760B]/30 text-gray-900 dark:text-slate-200 placeholder-gray-400 dark:placeholder-slate-500 w-52"
              />
            </div>
          </div>
          {loading ? (
            <div className="py-16 flex items-center justify-center gap-2 text-gray-400 dark:text-slate-500">
              <Loader2 size={20} className="animate-spin" /> Loading requests…
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-gray-400 dark:text-slate-500">
              <Inbox size={36} className="mx-auto mb-3" />
              <p className="text-sm">No requests found</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-slate-800">
              {filtered.map((req) => (
                <div
                  key={req.id}
                  className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 hover:bg-gray-50 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm text-gray-900 dark:text-slate-100 truncate">
                        {req.eventTitle || "Untitled Event"}
                      </p>
                      <StatusBadge status={req.status} />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                      {req.organizerName || req.name} · {req.email}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                      Submitted {relativeTime(req.createdAt)} ·{" "}
                      {formatTs(req.createdAt)}
                    </p>
                  </div>
                  <Link
                    href="/superadmin/hosting-requests"
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-gray-500 dark:text-slate-400 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors flex-shrink-0"
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
        <div className="bg-white dark:bg-slate-900/60 rounded-2xl border border-[#FE760B]/10 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center gap-2">
            <Activity size={16} className="text-[#FE760B]" />
            <h3 className="font-bold text-gray-900 dark:text-slate-100 text-sm">
              Recent Activity
            </h3>
          </div>
          {loading ? (
            <div className="py-12 flex items-center justify-center gap-2 text-gray-400 dark:text-slate-500">
              <Loader2 size={18} className="animate-spin" />
            </div>
          ) : activityLog.length === 0 ? (
            <div className="py-12 text-center text-gray-400 dark:text-slate-500 text-sm">
              No recent activity
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-slate-800">
              {activityLog.map((req) => (
                <div key={req.id} className="px-5 py-4 flex items-start gap-3">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${req.status === "approved" ? "bg-green-500/20" : "bg-red-500/20"}`}
                  >
                    {req.status === "approved" ? (
                      <CheckCircle size={13} className="text-green-500" />
                    ) : (
                      <XCircle size={13} className="text-red-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 dark:text-slate-200">
                      <span className="font-semibold">
                        {req.eventTitle || "Unnamed Event"}
                      </span>{" "}
                      was{" "}
                      <span
                        className={
                          req.status === "approved"
                            ? "text-green-500"
                            : "text-red-500"
                        }
                      >
                        {req.status}
                      </span>
                    </p>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                      Organiser: {req.organizerName || req.name || "Unknown"}
                    </p>
                    {req.rejectionReason && (
                      <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 italic">
                        Reason: {req.rejectionReason}
                      </p>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 dark:text-slate-500 flex-shrink-0">
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
