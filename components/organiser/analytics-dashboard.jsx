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
  TrendingUp,
  TrendingDown,
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

const COLORS = {
  primary: "#FE760B",
  secondary: "#FEDF05",
  success: "#22c55e",
  danger: "#ef4444",
  info: "#3b82f6",
  purple: "#a855f7",
};

function StatCard({
  label,
  value,
  subValue,
  icon: Icon,
  trend,
  color = "orange",
}) {
  const colorMap = {
    orange: {
      bg: "from-orange-50 to-amber-50",
      border: "border-orange-100",
      icon: "bg-orange-100 text-[#FE760B]",
      text: "text-[#FE760B]",
    },
    green: {
      bg: "from-green-50 to-emerald-50",
      border: "border-green-100",
      icon: "bg-green-100 text-green-600",
      text: "text-green-600",
    },
    blue: {
      bg: "from-blue-50 to-sky-50",
      border: "border-blue-100",
      icon: "bg-blue-100 text-blue-600",
      text: "text-blue-600",
    },
    purple: {
      bg: "from-purple-50 to-violet-50",
      border: "border-purple-100",
      icon: "bg-purple-100 text-purple-600",
      text: "text-purple-600",
    },
  };

  const c = colorMap[color] || colorMap.orange;
  const isPositive = trend > 0;
  const TrendIcon = isPositive ? ArrowUpRight : ArrowDownRight;

  return (
    <div
      className={`bg-gradient-to-br ${c.bg} border ${c.border} rounded-2xl p-5 relative overflow-hidden`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`p-2.5 rounded-xl ${c.icon}`}>
          <Icon size={20} />
        </div>
        {trend !== undefined && trend !== null && (
          <div
            className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${
              isPositive
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-600"
            }`}
          >
            <TrendIcon size={12} />
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <p className="text-gray-500 text-xs font-medium mb-1 uppercase tracking-wide">
        {label}
      </p>
      <p className={`text-3xl font-extrabold ${c.text} mb-1`}>{value}</p>
      {subValue && <p className="text-xs text-gray-400">{subValue}</p>}
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-white rounded-xl shadow-xl border border-gray-100 p-3">
      <p className="text-xs font-semibold text-gray-500 mb-2">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-gray-600">{entry.name}:</span>
          <span className="font-bold text-gray-900">
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
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [days, setDays] = useState(30);
  const [activeChart, setActiveChart] = useState("registrations");

  const fetchAnalytics = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ userId: userId || "", days });
      const res = await fetch(`/api/analytics/${eventId}?${params}`);
      const data = await res.json();

      if (!data.success) throw new Error(data.error);
      setAnalytics(data.analytics);
    } catch (err) {
      setError(err.message || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [eventId, userId, days]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 min-h-[400px]">
        <Loader2 size={40} className="animate-spin text-[#FE760B] mb-4" />
        <p className="text-gray-500 text-sm">Loading analytics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <AlertCircle size={40} className="text-red-400 mb-4" />
        <p className="font-semibold text-gray-700 mb-2">
          Failed to load analytics
        </p>
        <p className="text-sm text-gray-400 mb-4">{error}</p>
        <button
          onClick={fetchAnalytics}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm hover:bg-gray-200 transition-colors"
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
    <div className="space-y-6 p-4 md:p-6">
      {/* Event Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">{analytics.event.name}</p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl p-1">
          {[7, 14, 30, 60].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                days === d
                  ? "bg-[#FE760B] text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
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
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-gray-700">
              Capacity Utilization
            </span>
            <span className="text-sm font-bold text-[#FE760B]">
              {summary.totalRegistrations} / {summary.capacity}
            </span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#FE760B] to-[#FEDF05] rounded-full transition-all duration-700"
              style={{
                width: `${Math.min(summary.capacityUtilization, 100)}%`,
              }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {summary.capacityUtilization}% of capacity filled
          </p>
        </div>
      )}

      {/* Registrations Chart */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h2 className="text-lg font-bold text-gray-900">
            Registrations Over Time
          </h2>
          {summary.isPaid && (
            <div className="flex p-1 bg-gray-100 rounded-xl gap-1">
              <button
                onClick={() => setActiveChart("registrations")}
                className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-all ${
                  activeChart === "registrations"
                    ? "bg-white shadow-sm text-[#FE760B]"
                    : "text-gray-500"
                }`}
              >
                Registrations
              </button>
              <button
                onClick={() => setActiveChart("revenue")}
                className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-all ${
                  activeChart === "revenue"
                    ? "bg-white shadow-sm text-[#FE760B]"
                    : "text-gray-500"
                }`}
              >
                Revenue
              </button>
            </div>
          )}
        </div>

        {chartData.length > 0 && chartData.some((d) => d.registrations > 0) ? (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart
              data={chartData}
              margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
            >
              <defs>
                <linearGradient id="colorRegs" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FE760B" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#FE760B" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                tickLine={false}
                axisLine={false}
                interval={Math.max(0, Math.floor(chartData.length / 6) - 1)}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                tickLine={false}
                axisLine={false}
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
                  stroke="#22c55e"
                  strokeWidth={2.5}
                  fill="url(#colorRev)"
                  name="Revenue"
                  dot={false}
                  activeDot={{ r: 5, fill: "#22c55e" }}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[280px] flex items-center justify-center">
            <div className="text-center">
              <BarChart2 size={36} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">
                No registrations in the last {days} days
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Row Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Payment Breakdown Pie */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <h2 className="text-base font-bold text-gray-900 mb-4">
            {summary.isPaid ? "Payment Status" : "Registration Status"}
          </h2>
          {summary.totalRegistrations > 0 ? (
            <div className="flex items-center justify-center">
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
                    wrapperStyle={{ fontSize: "12px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[220px] flex items-center justify-center">
              <p className="text-gray-400 text-sm">No data yet</p>
            </div>
          )}
        </div>

        {/* Ticket Usage Pie */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <h2 className="text-base font-bold text-gray-900 mb-4">
            Ticket Usage
          </h2>
          {ticketStats.total > 0 ? (
            <div className="flex flex-col items-center">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={ticketPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
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
                    wrapperStyle={{ fontSize: "12px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 text-center">
                <p className="text-4xl font-extrabold text-green-600">
                  {ticketStats.usageRate}%
                </p>
                <p className="text-xs text-gray-400">Scan Rate</p>
              </div>
            </div>
          ) : (
            <div className="h-[220px] flex items-center justify-center">
              <p className="text-gray-400 text-sm">No tickets yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Top Registration Days Bar Chart */}
      {topDays.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <h2 className="text-base font-bold text-gray-900 mb-4">
            Peak Registration Days
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={topDays.map((d) => ({
                date: new Date(d.date).toLocaleDateString("en-IN", {
                  month: "short",
                  day: "numeric",
                }),
                registrations: d.count,
              }))}
              margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12, fill: "#9ca3af" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                formatter={(value) => [value, "Registrations"]}
                cursor={{ fill: "#fef3ec" }}
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
      )}
    </div>
  );
}
