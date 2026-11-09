"use client";

import { useState, useEffect, useCallback } from "react";
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
  Legend,
  BarChart,
  Bar,
} from "recharts";
import {
  Users,
  IndianRupee,
  TicketIcon,
  BarChart2,
  Calendar,
  AlertCircle,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { BrandLoader } from "@/components/ui/brand-loader";
import { AnalyticsSkeleton } from "@/components/ui/skeleton";
import { getCachedItem, setCachedItem } from "@/lib/client-cache";

// TicketLelo Brand Palette & Chart Tokens
const COLORS = {
  primary: "#FE760B",    // Ticket Orange
  secondary: "#FDE003",  // Sunny Yellow
  success: "#3DD68C",    // Success Green
  danger: "#FF6B6B",     // Error Red
  info: "#7AA2FF",       // Info Blue
  off: "#5C6066",        // Inactive Off
};

function StatCard({
  label,
  value,
  subValue,
  icon: Icon,
  trend,
  color = "orange",
}) {
  const isPositive = trend > 0;
  const TrendIcon = isPositive ? ArrowUpRight : ArrowDownRight;

  const colorStyles = {
    orange: {
      iconBg: "bg-[#FE760B]/14 text-[#FE760B]",
      border: "border-[#2A2D31]",
    },
    green: {
      iconBg: "bg-[#3DD68C]/12 text-[#3DD68C]",
      border: "border-[#2A2D31]",
    },
    blue: {
      iconBg: "bg-[#7AA2FF]/12 text-[#7AA2FF]",
      border: "border-[#2A2D31]",
    },
    purple: {
      iconBg: "bg-[#FDE003]/10 text-[#FDE003]",
      border: "border-[#2A2D31]",
    },
  };

  const style = colorStyles[color] || colorStyles.orange;

  return (
    <div className={`bg-[#1A1C1F] border ${style.border} rounded-2xl p-5 relative overflow-hidden shadow-sm`}>
      <div className="flex items-start justify-between mb-4">
        <div className={`p-2.5 rounded-xl border border-[#2A2D31] ${style.iconBg}`}>
          <Icon size={20} />
        </div>
        {trend !== undefined && trend !== null && (
          <div
            className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
              isPositive
                ? "bg-[#3DD68C]/12 text-[#3DD68C] border border-[#3DD68C]/25"
                : "bg-[#FF6B6B]/12 text-[#FF9A9A] border border-[#FF6B6B]/25"
            }`}
          >
            <TrendIcon size={12} />
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <p className="text-[#9B9EA4] text-xs font-medium mb-1 uppercase tracking-wider">
        {label}
      </p>
      <p className="text-2xl sm:text-3xl font-extrabold text-white mb-1 tabular-nums">
        {value}
      </p>
      {subValue && <p className="text-xs text-[#9B9EA4]/80">{subValue}</p>}
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-[#212327] rounded-xl shadow-xl border border-[#2A2D31] p-3 text-white">
      <p className="text-xs font-semibold text-[#9B9EA4] mb-2">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-[#D0D0D1]">{entry.name}:</span>
          <span className="font-bold text-white font-mono">
            {entry.name === "Revenue"
              ? `₹${entry.value.toLocaleString("en-IN")}`
              : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsDashboard({ eventId, userId }) {
  // Instant 0ms cache-first hydration
  const [days, setDays] = useState(30);
  const [analytics, setAnalytics] = useState(() => {
    if (typeof window !== "undefined" && eventId) {
      try {
        return getCachedItem(`analytics_${eventId}_30`) || null;
      } catch {}
    }
    return null;
  });
  const [loading, setLoading] = useState(() => !analytics);
  const [error, setError] = useState("");
  const [activeChart, setActiveChart] = useState("registrations");

  const fetchAnalytics = useCallback(async (showLoading = true) => {
    if (!eventId) return;
    if (showLoading && !analytics) setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ userId: userId || "", days });
      const res = await fetch(`/api/analytics/${eventId}?${params}`);
      const data = await res.json();

      if (!data.success) throw new Error(data.error);
      setAnalytics(data.analytics);
      setCachedItem(`analytics_${eventId}_${days}`, data.analytics, 5 * 60 * 1000);
    } catch (err) {
      setError(err.message || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [eventId, userId, days, analytics]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAnalytics(false);
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchAnalytics]);

  if (loading && !analytics) {
    return <AnalyticsSkeleton />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <AlertCircle size={36} className="text-[#FF6B6B] mb-4" />
        <p className="font-semibold text-white mb-2">
          Failed to load analytics
        </p>
        <p className="text-sm text-[#9B9EA4] mb-4">{error}</p>
        <button
          onClick={fetchAnalytics}
          className="px-4 py-2 bg-[#212327] text-white border border-[#2A2D31] rounded-xl text-sm hover:bg-[#2A2D31] transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!analytics) return null;

  const { summary, chartData, paymentBreakdown, ticketStats, topDays } =
    analytics;

  // Pie chart data for payment status
  const paymentPieData = summary.isPaid
    ? [
        {
          name: "Completed",
          value: paymentBreakdown.completed,
          color: COLORS.success,
        },
        {
          name: "Pending",
          value: paymentBreakdown.pending,
          color: COLORS.secondary,
        },
        {
          name: "Failed",
          value: paymentBreakdown.failed,
          color: COLORS.danger,
        },
      ].filter((d) => d.value > 0)
    : [
        {
          name: "Free Event",
          value: summary.totalRegistrations,
          color: COLORS.primary,
        },
      ];

  // Ticket usage pie data
  const ticketPieData = [
    { name: "Used", value: ticketStats.used, color: COLORS.success },
    { name: "Unused", value: ticketStats.unused, color: COLORS.info },
  ].filter((d) => d.value > 0);

  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);

  return (
    <div className="space-y-6">
      {/* Event Header & Days Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Overview</h2>
          <p className="text-sm text-[#9B9EA4] mt-0.5">{analytics.event.name}</p>
        </div>
        <div className="flex items-center gap-1.5 bg-[#1A1C1F] border border-[#2A2D31] rounded-xl p-1 w-fit">
          {[7, 14, 30, 60].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                days === d
                  ? "bg-[#FE760B] text-[#131517] shadow-sm"
                  : "text-[#9B9EA4] hover:text-white"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Registrations"
          value={summary.totalRegistrations}
          subValue={`${summary.recentRegistrations} in last 7 days`}
          icon={Users}
          trend={summary.registrationTrend}
          color="orange"
        />
        {summary.isPaid ? (
          <StatCard
            label="Total Revenue"
            value={formatCurrency(summary.totalRevenue)}
            subValue={`${summary.completedPayments} paid tickets`}
            icon={IndianRupee}
            color="green"
          />
        ) : (
          <StatCard
            label="Ticket Price"
            value="FREE"
            subValue="No payment required"
            icon={TicketIcon}
            color="green"
          />
        )}
        <StatCard
          label="Ticket Usage Rate"
          value={`${ticketStats.usageRate}%`}
          subValue={`${ticketStats.used} scanned / ${ticketStats.total} total`}
          icon={BarChart2}
          color="blue"
        />
        <StatCard
          label="Avg Daily Registrations"
          value={
            chartData.length > 0
              ? Math.round(
                  chartData.reduce((s, d) => s + d.registrations, 0) /
                    chartData.filter((d) => d.registrations > 0).length || 1,
                ).toString()
              : "0"
          }
          subValue={`Over last ${days} days`}
          icon={Calendar}
          color="purple"
        />
      </div>

      {/* Capacity Utilization Bar */}
      {summary.capacity && (
        <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-white">
              Capacity Utilization
            </span>
            <span className="text-sm font-bold text-[#FE760B] font-mono">
              {summary.totalRegistrations} / {summary.capacity}
            </span>
          </div>
          <div className="h-3 bg-[#212327] rounded-full overflow-hidden border border-[#2A2D31]">
            <div
              className="h-full bg-[#FE760B] hover:bg-[#FF8A2B] rounded-full transition-all duration-700"
              style={{
                width: `${Math.min(summary.capacityUtilization, 100)}%`,
              }}
            />
          </div>
          <p className="text-xs text-[#9B9EA4] mt-2">
            {summary.capacityUtilization}% of capacity filled
          </p>
        </div>
      )}

      {/* Registrations Chart */}
      <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-base font-bold text-white">
              Registrations over time
            </h3>
            <p className="text-xs text-[#9B9EA4] mt-0.5">
              Daily registration volume for the selected period
            </p>
          </div>
          {summary.isPaid && (
            <div className="flex p-1 bg-[#212327] border border-[#2A2D31] rounded-xl gap-1">
              <button
                onClick={() => setActiveChart("registrations")}
                className={`px-3 py-1.5 text-xs rounded-lg font-semibold transition-all ${
                  activeChart === "registrations"
                    ? "bg-[#FE760B] text-[#131517]"
                    : "text-[#9B9EA4] hover:text-white"
                }`}
              >
                Registrations
              </button>
              <button
                onClick={() => setActiveChart("revenue")}
                className={`px-3 py-1.5 text-xs rounded-lg font-semibold transition-all ${
                  activeChart === "revenue"
                    ? "bg-[#FE760B] text-[#131517]"
                    : "text-[#9B9EA4] hover:text-white"
                }`}
              >
                Revenue
              </button>
            </div>
          )}
        </div>

        {chartData.length > 0 && chartData.some((d) => d.registrations > 0) ? (
          <div className="rounded-xl bg-[#000000] p-4 border border-[#2A2D31]/80">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
              >
                <defs>
                  <linearGradient id="colorRegs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FE760B" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#FE760B" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3DD68C" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3DD68C" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A2D31" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#9B9EA4" }}
                  tickLine={false}
                  axisLine={{ stroke: "#2A2D31" }}
                  interval={Math.max(0, Math.floor(chartData.length / 6) - 1)}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#9B9EA4" }}
                  tickLine={false}
                  axisLine={{ stroke: "#2A2D31" }}
                  allowDecimals={false}
                />
                <Tooltip content={<CustomTooltip />} />
                {activeChart === "registrations" ? (
                  <Area
                    type="monotone"
                    dataKey="registrations"
                    stroke="#FE760B"
                    strokeWidth={2.5}
                    fill="url(#colorRegs)"
                    name="Registrations"
                    dot={false}
                    activeDot={{ r: 5, fill: "#FE760B" }}
                  />
                ) : (
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#3DD68C"
                    strokeWidth={2.5}
                    fill="url(#colorRev)"
                    name="Revenue"
                    dot={false}
                    activeDot={{ r: 5, fill: "#3DD68C" }}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[280px] flex items-center justify-center rounded-xl bg-[#000000] border border-[#2A2D31]/80">
            <div className="text-center">
              <BarChart2 size={36} className="text-[#9B9EA4] mx-auto mb-3 opacity-60" />
              <p className="text-[#9B9EA4] text-sm">
                No registrations in the last {days} days
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Row Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Payment Breakdown Pie */}
        <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-5 sm:p-6 shadow-sm">
          <h3 className="text-base font-bold text-white mb-4">
            {summary.isPaid ? "Payment status" : "Registration status"}
          </h3>
          {summary.totalRegistrations > 0 ? (
            <div className="flex items-center justify-center rounded-xl bg-[#000000] p-4 border border-[#2A2D31]/80">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={paymentPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {paymentPieData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [value, name]} />
                  <Legend
                    iconType="circle"
                    iconSize={10}
                    wrapperStyle={{ fontSize: "12px", color: "#D0D0D1" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[220px] flex items-center justify-center rounded-xl bg-[#000000] border border-[#2A2D31]/80">
              <p className="text-[#9B9EA4] text-sm">No data yet</p>
            </div>
          )}
        </div>

        {/* Ticket Usage Pie */}
        <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-5 sm:p-6 shadow-sm">
          <h3 className="text-base font-bold text-white mb-4">
            Ticket usage
          </h3>
          {ticketStats.total > 0 ? (
            <div className="flex flex-col items-center rounded-xl bg-[#000000] p-4 border border-[#2A2D31]/80">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={ticketPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {ticketPieData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend
                    iconType="circle"
                    iconSize={10}
                    wrapperStyle={{ fontSize: "12px", color: "#D0D0D1" }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 text-center">
                <p className="text-3xl font-extrabold text-[#3DD68C] tabular-nums">
                  {ticketStats.usageRate}%
                </p>
                <p className="text-xs text-[#9B9EA4]">Scan rate</p>
              </div>
            </div>
          ) : (
            <div className="h-[220px] flex items-center justify-center rounded-xl bg-[#000000] border border-[#2A2D31]/80">
              <p className="text-[#9B9EA4] text-sm">No tickets yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Top Registration Days Bar Chart */}
      {topDays.length > 0 && (
        <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-5 sm:p-6 shadow-sm">
          <h3 className="text-base font-bold text-white mb-4">
            Peak registration days
          </h3>
          <div className="rounded-xl bg-[#000000] p-4 border border-[#2A2D31]/80">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={topDays.map((d) => ({
                  date: new Date(d.date).toLocaleDateString("en-IN", {
                    month: "short",
                    day: "numeric",
                  }),
                  registrations: d.count,
                }))}
                margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#2A2D31" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "#9B9EA4" }}
                  tickLine={false}
                  axisLine={{ stroke: "#2A2D31" }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#9B9EA4" }}
                  tickLine={false}
                  axisLine={{ stroke: "#2A2D31" }}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: "#212327", borderColor: "#2A2D31", borderRadius: "12px", color: "#ffffff" }}
                  formatter={(value) => [value, "Registrations"]}
                  cursor={{ fill: "rgba(254, 118, 11, 0.08)" }}
                />
                <Bar
                  dataKey="registrations"
                  fill="#FE760B"
                  radius={[6, 6, 0, 0]}
                  name="Registrations"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
