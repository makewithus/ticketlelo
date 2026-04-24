"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import {
  CreditCard,
  Zap,
  Star,
  Crown,
  Check,
  TrendingUp,
  Calendar,
  Users,
  ArrowRight,
  Loader2,
  BarChart2,
  RefreshCw,
} from "lucide-react";
import { PLANS, getPlan } from "@/lib/plans";
import { getEventsByOrganiser } from "@/lib/firestore";
import Link from "next/link";

const PLAN_META = {
  free: {
    label: "Free",
    Icon: Star,
    iconColor: "text-gray-400",
    bg: "bg-gray-50",
    border: "border-gray-200",
    badgeClass: "bg-gray-100 text-gray-600",
    progressColor: "bg-gray-400",
  },
  starter: {
    label: "Starter",
    Icon: Zap,
    iconColor: "text-[#FF6A00]",
    bg: "bg-orange-50",
    border: "border-[#FF6A00]/30",
    badgeClass: "bg-orange-100 text-[#FF6A00]",
    progressColor: "bg-[#FF6A00]",
  },
  pro: {
    label: "Pro",
    Icon: Crown,
    iconColor: "text-purple-600",
    bg: "bg-purple-50",
    border: "border-purple-200",
    badgeClass: "bg-purple-100 text-purple-700",
    progressColor: "bg-purple-500",
  },
};

function UsageBar({ used, total, colorClass }) {
  const isUnlimited = total === -1;
  const pct = isUnlimited ? 20 : Math.min(100, (used / total) * 100);
  const isNearLimit = !isUnlimited && pct >= 80;

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="font-semibold text-gray-800">
          {used.toLocaleString()}
        </span>
        <span className="text-gray-400">
          {isUnlimited ? "Unlimited" : `/ ${total.toLocaleString()}`}
        </span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isNearLimit ? "bg-red-500" : colorClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {isNearLimit && (
        <p className="text-xs text-red-500 font-medium">
          Approaching limit — consider upgrading
        </p>
      )}
    </div>
  );
}

function PlanCompareRow({ label, free, starter, pro }) {
  const cell = (val) =>
    typeof val === "boolean" ? (
      val ? (
        <Check size={15} className="text-green-500 mx-auto" />
      ) : (
        <span className="text-gray-300 mx-auto block text-center">—</span>
      )
    ) : (
      <span className="text-sm text-gray-700">{val}</span>
    );

  return (
    <tr className="border-b border-gray-50">
      <td className="py-3 pr-4 text-sm text-gray-500">{label}</td>
      <td className="py-3 text-center">{cell(free)}</td>
      <td className="py-3 text-center">{cell(starter)}</td>
      <td className="py-3 text-center">{cell(pro)}</td>
    </tr>
  );
}

export default function AccountPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [upgrading, setUpgrading] = useState(false);

  const currentPlanId = user?.plan || "free";
  const plan = getPlan(currentPlanId);
  const meta = PLAN_META[currentPlanId] || PLAN_META.free;
  const { Icon, iconColor, bg, border, badgeClass, progressColor } = meta;

  const eventsUsed = events.length;
  const eventsAllowed = plan.eventsAllowed;

  const loadEvents = useCallback(async () => {
    if (!user?.id) return;
    setLoadingEvents(true);
    try {
      const data = await getEventsByOrganiser(user.id);
      setEvents(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingEvents(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-[#FF6A00]" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900">
              Account & Plan
            </h1>
            <p className="text-gray-400 mt-1 text-sm">
              Manage your subscription and usage
            </p>
          </div>
          <button
            onClick={loadEvents}
            className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={18} />
          </button>
        </div>

        {/* Profile + Plan banner */}
        <div
          className={`${bg} border ${border} rounded-3xl p-6 flex flex-col sm:flex-row sm:items-center gap-5`}
        >
          <div className="w-14 h-14 rounded-2xl bg-white shadow flex items-center justify-center flex-shrink-0">
            <Icon size={26} className={iconColor} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl font-extrabold text-gray-900">
                {user.fullName || user.name || "Your Account"}
              </h2>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${badgeClass}`}
              >
                {meta.label} Plan
              </span>
            </div>
            <p className="text-sm text-gray-500">{user.email}</p>
          </div>
          {currentPlanId !== "pro" && (
            <Link
              href="/pricing"
              className="flex-shrink-0 flex items-center gap-1.5 px-5 py-2.5 bg-[#FF6A00] text-white font-bold rounded-xl text-sm hover:opacity-90 transition-opacity shadow-md shadow-[#FF6A00]/20"
            >
              <Zap size={14} />
              Upgrade Plan
            </Link>
          )}
        </div>

        {/* Usage Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Events Usage */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-2 text-gray-600">
              <Calendar size={18} />
              <h3 className="font-semibold text-sm">Events</h3>
            </div>
            {loadingEvents ? (
              <div className="flex gap-2 items-center text-gray-400 text-sm">
                <Loader2 size={14} className="animate-spin" /> Loading…
              </div>
            ) : (
              <UsageBar
                used={eventsUsed}
                total={eventsAllowed}
                colorClass={progressColor}
              />
            )}
            <p className="text-xs text-gray-400">
              {eventsAllowed === -1
                ? "Unlimited events on Pro plan"
                : `${eventsAllowed - eventsUsed} event${eventsAllowed - eventsUsed !== 1 ? "s" : ""} remaining`}
            </p>
          </div>

          {/* Participants per event */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-2 text-gray-600">
              <Users size={18} />
              <h3 className="font-semibold text-sm">Participants per Event</h3>
            </div>
            <div className="text-2xl font-extrabold text-gray-900">
              {plan.participantsPerEvent === -1
                ? "Unlimited"
                : plan.participantsPerEvent.toLocaleString()}
            </div>
            <p className="text-xs text-gray-400">
              Maximum registrations per event
            </p>
          </div>
        </div>

        {/* Recent Events */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <BarChart2 size={16} className="text-[#FF6A00]" />
              Your Events
            </h3>
            <Link
              href="/admin/dashboard"
              className="text-xs text-[#FF6A00] font-medium hover:underline flex items-center gap-1"
            >
              Manage <ArrowRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {loadingEvents ? (
              <div className="px-6 py-8 flex items-center justify-center text-gray-400 gap-2">
                <Loader2 size={16} className="animate-spin" /> Loading events…
              </div>
            ) : events.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <Calendar size={32} className="mx-auto text-gray-200 mb-3" />
                <p className="text-gray-400 text-sm">No events yet</p>
                <Link
                  href="/admin/dashboard"
                  className="mt-4 inline-flex items-center gap-1.5 text-sm text-[#FF6A00] font-medium hover:underline"
                >
                  Create your first event <ArrowRight size={13} />
                </Link>
              </div>
            ) : (
              events.slice(0, 5).map((ev) => (
                <div
                  key={ev.id}
                  className="px-6 py-4 flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium text-gray-800 text-sm">
                      {ev.name}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {ev.venue || ev.location || "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        ev.status === "active"
                          ? "bg-green-100 text-green-700"
                          : ev.status === "approved"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {ev.status || "draft"}
                    </span>
                    <TrendingUp size={14} className="text-gray-300" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Plan comparison table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="font-bold text-gray-800 mb-5">Plan Comparison</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 pr-4 text-sm text-gray-400 font-medium w-1/3">
                    Feature
                  </th>
                  <th
                    className={`text-center py-2 text-sm font-bold ${currentPlanId === "free" ? "text-gray-700" : "text-gray-400"}`}
                  >
                    Free
                  </th>
                  <th
                    className={`text-center py-2 text-sm font-bold ${currentPlanId === "starter" ? "text-[#FF6A00]" : "text-gray-400"}`}
                  >
                    Starter
                  </th>
                  <th
                    className={`text-center py-2 text-sm font-bold ${currentPlanId === "pro" ? "text-purple-600" : "text-gray-400"}`}
                  >
                    Pro
                  </th>
                </tr>
              </thead>
              <tbody>
                <PlanCompareRow label="Events" free="1" starter="3" pro="10" />
                <PlanCompareRow
                  label="Participants / event"
                  free="300"
                  starter="1,000"
                  pro="Unlimited"
                />
                <PlanCompareRow
                  label="QR Code Tickets"
                  free={true}
                  starter={true}
                  pro={true}
                />
                <PlanCompareRow
                  label="Email Delivery"
                  free={true}
                  starter={true}
                  pro={true}
                />
                <PlanCompareRow
                  label="Custom Branding"
                  free={false}
                  starter={true}
                  pro={true}
                />
                <PlanCompareRow
                  label="Analytics Dashboard"
                  free={false}
                  starter={true}
                  pro={true}
                />
                <PlanCompareRow
                  label="Broadcast Messaging"
                  free={false}
                  starter={true}
                  pro={true}
                />
                <PlanCompareRow
                  label="Custom URL Slug"
                  free={false}
                  starter={true}
                  pro={true}
                />
                <PlanCompareRow
                  label="Priority Support"
                  free={false}
                  starter={false}
                  pro={true}
                />
              </tbody>
            </table>
          </div>

          {currentPlanId !== "pro" && (
            <div className="mt-6 flex items-center justify-between p-4 bg-gradient-to-r from-[#FF6A00]/10 to-[#FFD60A]/10 rounded-xl border border-[#FF6A00]/20">
              <div>
                <p className="font-bold text-gray-800 text-sm">
                  Ready to unlock more features?
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Upgrade anytime, cancel anytime.
                </p>
              </div>
              <Link
                href="/pricing"
                className="flex items-center gap-1.5 px-5 py-2 bg-[#FF6A00] text-white font-bold rounded-xl text-sm hover:opacity-90 transition-opacity"
              >
                View Plans <ArrowRight size={13} />
              </Link>
            </div>
          )}
        </div>

        {/* Danger zone */}
        <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-6">
          <h3 className="font-bold text-red-600 mb-1 text-sm">Danger Zone</h3>
          <p className="text-xs text-gray-400 mb-4">
            Actions here are permanent or require re-authentication.
          </p>
          <button
            onClick={async () => {
              await logout();
              router.push("/user-login");
            }}
            className="text-sm text-red-500 border border-red-200 px-4 py-2 rounded-xl hover:bg-red-50 transition-colors font-medium"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
