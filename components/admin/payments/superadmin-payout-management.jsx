"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Wallet,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldAlert,
  RefreshCw,
  Download,
  Building2,
  DollarSign,
  TrendingUp,
  Receipt,
  XCircle,
  ExternalLink,
  CreditCard,
  ArrowRight,
  ShieldCheck,
  PauseCircle,
  X,
  Search,
  Filter,
  Copy,
  Check,
  QrCode,
  AlertTriangle,
  PlayCircle,
  ChevronRight,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { BrandLoader } from "@/components/ui/brand-loader";
import { SuperAdminTableSkeleton } from "@/components/ui/skeleton";
import { getCachedItem, setCachedItem } from "@/lib/client-cache";

export function SuperAdminPayoutManagement() {
  // Instant 0ms cache-first hydration
  const [summary, setSummary] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        return getCachedItem("superadmin_payout_summary") || null;
      } catch {}
    }
    return null;
  });
  const [payouts, setPayouts] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        return getCachedItem("superadmin_payouts") || [];
      } catch {}
    }
    return [];
  });
  const [loading, setLoading] = useState(() => payouts.length === 0);
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState([]);

  // Table filters & search
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  // Payout Detail Modal
  const [selectedPayout, setSelectedPayout] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // UPI QR Code Modal
  const [showQrModal, setShowQrModal] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);

  // Manual Confirmation Modal
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmForm, setConfirmForm] = useState({
    utr: "",
    receiptUrl: "",
    remarks: "",
  });
  const [confirming, setConfirming] = useState(false);

  // Hold / Release Modal
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [holdReason, setHoldReason] = useState("");
  const [submittingHold, setSubmittingHold] = useState(false);

  const fetchData = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const [payoutsRes, notifsRes] = await Promise.all([
        fetch(`/api/superadmin/payouts?status=${statusFilter}&search=${encodeURIComponent(searchTerm)}`),
        fetch("/api/superadmin/notifications?limit=10"),
      ]);

      if (payoutsRes.ok) {
        const data = await payoutsRes.json();
        setSummary(data.summary || null);
        setPayouts(data.payouts || []);
        setCachedItem("superadmin_payout_summary", data.summary || null, 5 * 60 * 1000);
        setCachedItem("superadmin_payouts", data.payouts || [], 5 * 60 * 1000);
      }

      if (notifsRes.ok) {
        const nData = await notifsRes.json();
        setNotifications(nData.notifications || []);
      }
    } catch (err) {
      console.error("[SuperAdminPayoutManagement] fetch error:", err);
      toast.error("Failed to load payouts data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchData(true);
  };

  const handleSelectPayout = async (payout) => {
    setSelectedPayout(payout);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/superadmin/payouts/${payout.payoutId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.payout) setSelectedPayout(data.payout);
      }
    } catch (_err) {
      // Keep existing data
    } finally {
      setDetailLoading(false);
    }
  };

  const handleOpenUpiApp = () => {
    if (!selectedPayout?.upiPaymentUrl) {
      toast.error("UPI details are missing for this organizer.");
      return;
    }
    // Deep link open
    window.location.href = selectedPayout.upiPaymentUrl;
    setShowQrModal(true);
  };

  const handleConfirmPayment = async (e) => {
    e.preventDefault();
    if (!confirmForm.utr.trim()) {
      toast.error("UPI Transaction ID / UTR is strictly required.");
      return;
    }

    setConfirming(true);
    try {
      const res = await fetch(`/api/superadmin/payouts/${selectedPayout.payoutId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CONFIRM_PAYMENT",
          utr: confirmForm.utr.trim(),
          receiptUrl: confirmForm.receiptUrl.trim(),
          remarks: confirmForm.remarks.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to confirm payment.");
      }

      toast.success(`Payout marked as Paid! UTR: ${confirmForm.utr}`);
      setShowConfirmModal(false);
      setSelectedPayout(data.payout);
      setConfirmForm({ utr: "", receiptUrl: "", remarks: "" });
      fetchData(true);
    } catch (err) {
      console.error("Payment confirmation error:", err);
      toast.error(err.message || "Could not confirm payment.");
    } finally {
      setConfirming(false);
    }
  };

  const handleHoldAction = async (action) => {
    if (action === "HOLD" && !holdReason.trim()) {
      toast.error("A mandatory reason is required to place on hold.");
      return;
    }

    setSubmittingHold(true);
    try {
      const res = await fetch(`/api/superadmin/payouts/${selectedPayout.payoutId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          reason: holdReason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${action} payout.`);

      toast.success(action === "HOLD" ? "Payout placed on hold." : "Hold released.");
      setShowHoldModal(false);
      setHoldReason("");
      setSelectedPayout(data.payout);
      fetchData(true);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmittingHold(false);
    }
  };

  const handleRetryAction = async () => {
    try {
      const res = await fetch(`/api/superadmin/payouts/${selectedPayout.payoutId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "RETRY" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Retry failed.");
      toast.success("Payout reset to Due status.");
      setSelectedPayout(data.payout);
      fetchData(true);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const copyUpiId = (id) => {
    navigator.clipboard.writeText(id);
    setCopiedUpi(true);
    toast.success("UPI ID copied to clipboard!");
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  const getStatusBadge = (status, isOverdue) => {
    if (status === "PAID") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-bold">
          <CheckCircle2 size={12} /> Paid
        </span>
      );
    }
    if (status === "ON_HOLD") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[11px] font-bold">
          <PauseCircle size={12} /> On Hold
        </span>
      );
    }
    if (status === "FAILED") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30 text-[11px] font-bold">
          <XCircle size={12} /> Failed
        </span>
      );
    }
    if (status === "PROCESSING") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[11px] font-bold">
          <RefreshCw size={12} className="animate-spin" /> Processing
        </span>
      );
    }
    if (isOverdue || status === "OVERDUE") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[11px] font-black animate-pulse">
          <AlertTriangle size={12} /> Overdue (T+4)
        </span>
      );
    }
    if (status === "DUE") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[11px] font-bold">
          <Clock size={12} /> Due Today
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/20 text-[11px] font-semibold">
        <Clock size={12} /> Pending (T+4)
      </span>
    );
  };

  // Filtered action-required items
  const actionRequiredItems = useMemo(() => {
    return payouts.filter((p) => p.status === "DUE" || p.status === "FAILED" || p.isOverdue);
  }, [payouts]);

  if (loading && payouts.length === 0) {
    return <SuperAdminTableSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* ── Top Bar with Title & Refresh ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5">
            <Wallet className="text-[#FE760B]" size={26} />
            <span>Organizer Payout & Settlement Management</span>
          </h2>
          <p className="text-xs text-[#9E9E9F] mt-1">
            Automated T+4 working-day calculation, UPI deep linking & manual UTR payment confirmation.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="px-4 py-2 rounded-xl bg-[#1A1C1F] hover:bg-[#212327] border border-[#2A2D31] text-xs font-semibold text-white transition-all flex items-center gap-2 cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin text-[#FE760B]" : ""} />
          <span>Refresh Hub</span>
        </button>
      </div>

      {/* ── PART 3.1: Payout Overview (6 Canonical Cards) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* 1. Total Pending Payouts */}
        <div className="p-4 rounded-2xl bg-[#1A1C1F] border border-[#2A2D31] shadow-lg">
          <div className="flex items-center justify-between text-[#9E9E9F] text-xs font-medium">
            <span>Pending</span>
            <Clock size={14} className="text-slate-400" />
          </div>
          <div className="text-lg sm:text-xl font-black text-white mt-2">
            ₹{summary ? (summary.totalPendingAmountPaise / 100).toLocaleString("en-IN") : "0"}
          </div>
          <div className="text-[10px] text-[#9E9E9F] mt-0.5">
            {summary?.totalPendingCount || 0} batches maturing
          </div>
        </div>

        {/* 2. Total Amount Due */}
        <div className="p-4 rounded-2xl bg-[#1A1C1F] border border-[#2A2D31] shadow-lg">
          <div className="flex items-center justify-between text-[#9E9E9F] text-xs font-medium">
            <span>Total Due</span>
            <AlertCircle size={14} className="text-[#FE760B]" />
          </div>
          <div className="text-lg sm:text-xl font-black text-[#FE760B] mt-2">
            ₹{summary ? (summary.totalAmountDuePaise / 100).toLocaleString("en-IN") : "0"}
          </div>
          <div className="text-[10px] text-[#9E9E9F] mt-0.5">Action required</div>
        </div>

        {/* 3. Due Today */}
        <div className="p-4 rounded-2xl bg-[#1A1C1F] border border-[#2A2D31] shadow-lg">
          <div className="flex items-center justify-between text-[#9E9E9F] text-xs font-medium">
            <span>Due Today</span>
            <Clock size={14} className="text-blue-400" />
          </div>
          <div className="text-lg sm:text-xl font-black text-blue-400 mt-2">
            ₹{summary ? (summary.totalDueTodayAmountPaise / 100).toLocaleString("en-IN") : "0"}
          </div>
          <div className="text-[10px] text-[#9E9E9F] mt-0.5">
            {summary?.totalDueTodayCount || 0} reached T+4
          </div>
        </div>

        {/* 4. Overdue Payouts */}
        <div className="p-4 rounded-2xl bg-[#1A1C1F] border border-[#2A2D31] shadow-lg">
          <div className="flex items-center justify-between text-[#9E9E9F] text-xs font-medium">
            <span>Overdue</span>
            <AlertTriangle size={14} className="text-amber-400" />
          </div>
          <div className="text-lg sm:text-xl font-black text-amber-400 mt-2">
            ₹{summary ? (summary.totalOverdueAmountPaise / 100).toLocaleString("en-IN") : "0"}
          </div>
          <div className="text-[10px] text-[#9E9E9F] mt-0.5">
            {summary?.totalOverdueCount || 0} overdue tasks
          </div>
        </div>

        {/* 5. Total Paid Amount */}
        <div className="p-4 rounded-2xl bg-[#1A1C1F] border border-[#2A2D31] shadow-lg">
          <div className="flex items-center justify-between text-[#9E9E9F] text-xs font-medium">
            <span>Total Paid</span>
            <CheckCircle2 size={14} className="text-emerald-400" />
          </div>
          <div className="text-lg sm:text-xl font-black text-emerald-400 mt-2">
            ₹{summary ? (summary.totalPaidAmountPaise / 100).toLocaleString("en-IN") : "0"}
          </div>
          <div className="text-[10px] text-[#9E9E9F] mt-0.5">
            {summary?.totalPaidCount || 0} settled via UPI
          </div>
        </div>

        {/* 6. Payouts on Hold */}
        <div className="p-4 rounded-2xl bg-[#1A1C1F] border border-[#2A2D31] shadow-lg">
          <div className="flex items-center justify-between text-[#9E9E9F] text-xs font-medium">
            <span>On Hold</span>
            <PauseCircle size={14} className="text-rose-400" />
          </div>
          <div className="text-lg sm:text-xl font-black text-rose-400 mt-2">
            ₹{summary ? (summary.totalOnHoldAmountPaise / 100).toLocaleString("en-IN") : "0"}
          </div>
          <div className="text-[10px] text-[#9E9E9F] mt-0.5">
            {summary?.totalOnHoldCount || 0} paused
          </div>
        </div>
      </div>

      {/* ── PART 3.2: Automatic Payout Notifications / Action Required ── */}
      {actionRequiredItems.length > 0 && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-[#212327] to-amber-500/5 border border-amber-500/30 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
              <AlertTriangle size={16} />
              <span>Action Required – Payouts Due for Manual Settlement ({actionRequiredItems.length})</span>
            </div>
            <span className="text-[11px] text-[#9E9E9F]">T+4 Working Days Reached</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {actionRequiredItems.slice(0, 3).map((item) => (
              <div
                key={item.payoutId}
                className="p-3.5 rounded-xl bg-[#131517] border border-[#2A2D31] flex flex-col justify-between gap-3 text-xs"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-white truncate">{item.organizerName}</span>
                    <span className="font-black text-[#FE760B] font-mono text-sm shrink-0">
                      ₹{(item.netOrganizerPaise / 100).toLocaleString("en-IN")}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#9E9E9F] truncate mt-0.5">{item.eventTitle}</p>

                  <div className="mt-2 pt-2 border-t border-[#2A2D31]/60 flex items-center justify-between text-[10px] text-[#9E9E9F]">
                    <span>UPI: <strong className="text-white font-mono">{item.upiId || "Pending"}</strong></span>
                    <span>Bank: <strong className="text-white">{item.bankName || "SBI"}</strong></span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-[10px] text-amber-400 font-semibold">
                    Due: {item.dueDateFormatted || "Now"}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleSelectPayout(item)}
                    className="px-3 py-1.5 rounded-lg bg-[#FE760B] hover:bg-[#e06505] text-black font-bold text-[11px] transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <span>Review & Pay</span>
                    <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── PART 3.3: Payout Management Table & Filters ── */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#1A1C1F] border border-[#2A2D31] shadow-xl space-y-4">
        {/* Filters & Search Row */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 lg:pb-0">
            {[
              { id: "ALL", label: "All Payouts" },
              { id: "DUE_TODAY", label: "Due Today" },
              { id: "OVERDUE", label: "Overdue" },
              { id: "PENDING", label: "Pending (T+4)" },
              { id: "PAID", label: "Paid" },
              { id: "ON_HOLD", label: "On Hold" },
              { id: "FAILED", label: "Failed" },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  statusFilter === f.id
                    ? "bg-[#FE760B] text-black shadow-md shadow-[#FE760B]/20"
                    : "bg-[#212327] text-[#9E9E9F] hover:text-white"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9E9E9F]" />
              <input
                type="text"
                placeholder="Search organizer, event, UTR..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[#212327] border border-[#2A2D31] text-xs text-white placeholder-[#9E9E9F] focus:outline-none focus:border-[#FE760B] transition-colors"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 rounded-xl bg-[#212327] hover:bg-[#2A2D31] border border-[#2A2D31] text-xs font-semibold text-white transition-colors cursor-pointer"
            >
              Filter
            </button>
          </form>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#2A2D31] text-[#9E9E9F]">
                <th className="pb-3 font-semibold">Organizer</th>
                <th className="pb-3 font-semibold">Event</th>
                <th className="pb-3 font-semibold text-right">Amount</th>
                <th className="pb-3 font-semibold text-center">Due Date</th>
                <th className="pb-3 font-semibold text-center">Status</th>
                <th className="pb-3 font-semibold text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2A2D31]/50 text-white">
              {payouts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#9E9E9F]">
                    No organizer payouts matching current filter criteria.
                  </td>
                </tr>
              ) : (
                payouts.map((p) => (
                  <tr
                    key={p.payoutId}
                    onClick={() => handleSelectPayout(p)}
                    className="hover:bg-[#212327]/50 transition-colors cursor-pointer group"
                  >
                    {/* Organizer */}
                    <td className="py-3.5">
                      <div className="font-bold text-white group-hover:text-[#FE760B] transition-colors">
                        {p.organizerName}
                      </div>
                      <div className="text-[11px] text-[#9E9E9F] font-mono flex items-center gap-1.5 mt-0.5">
                        <span>{p.upiId || "No UPI Provided"}</span>
                        {p.bankName && <span className="text-[#626772]">• {p.bankName}</span>}
                      </div>
                    </td>

                    {/* Event */}
                    <td className="py-3.5">
                      <div className="font-medium text-white">{p.eventTitle}</div>
                      <div className="text-[10px] text-[#9E9E9F] font-mono">{p.payoutRef}</div>
                    </td>

                    {/* Amount */}
                    <td className="py-3.5 text-right font-mono font-black text-sm">
                      <span className={p.status === "PAID" ? "text-emerald-400" : "text-white"}>
                        ₹{(p.netOrganizerPaise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                    </td>

                    {/* Due Date */}
                    <td className="py-3.5 text-center text-[#9E9E9F]">
                      <span className="block font-medium text-white">{p.dueDateFormatted || "T+4 Working Days"}</span>
                      {p.paidAt && (
                        <span className="text-[10px] text-emerald-400 block">
                          Paid: {new Date(p.paidAt).toLocaleDateString("en-IN")}
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 text-center">
                      {getStatusBadge(p.status, p.isOverdue)}
                    </td>

                    {/* Action */}
                    <td className="py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => handleSelectPayout(p)}
                        className="px-3 py-1.5 rounded-lg bg-[#212327] hover:bg-[#FE760B] text-[#D0D0D1] hover:text-black border border-[#2A2D31] text-[11px] font-bold transition-all cursor-pointer inline-flex items-center gap-1"
                      >
                        <span>{p.status === "PAID" ? "View Details" : "Review & Pay"}</span>
                        <ChevronRight size={12} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── PART 4: Payout Details Modal / Drawer ── */}
      {selectedPayout && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-[#17191C] border border-[#2A2D31] rounded-2xl shadow-2xl overflow-hidden animate-scale-in text-xs space-y-5 my-8">
            {/* Modal Header */}
            <div className="p-5 bg-[#131517] border-b border-[#2A2D31] flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">Organizer Settlement Breakdown</h3>
                  {getStatusBadge(selectedPayout.status, selectedPayout.isOverdue)}
                </div>
                <p className="text-[11px] text-[#9E9E9F] font-mono mt-0.5">
                  Ref: <strong className="text-[#FE760B]">{selectedPayout.payoutRef}</strong> • ID: {selectedPayout.payoutId}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPayout(null)}
                className="p-1.5 rounded-xl hover:bg-[#212327] text-[#9E9E9F] hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
              {/* 1. Organizer Information */}
              <div className="p-4 rounded-xl bg-[#131517] border border-[#2A2D31] space-y-2.5">
                <div className="text-[11px] font-bold text-[#FE760B] uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 size={13} /> Organizer Receiving Information
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[#9E9E9F] block text-[10px]">Organizer / Host Name</span>
                    <span className="font-bold text-white">{selectedPayout.organizerName}</span>
                  </div>
                  <div>
                    <span className="text-[#9E9E9F] block text-[10px]">Destination Bank</span>
                    <span className="font-semibold text-white">{selectedPayout.bankName || "Linked Bank"}</span>
                  </div>
                  <div>
                    <span className="text-[#9E9E9F] block text-[10px]">Contact Email</span>
                    <span className="text-[#D0D0D1]">{selectedPayout.organizerEmail || "support@ticketlelo.com"}</span>
                  </div>
                  <div>
                    <span className="text-[#9E9E9F] block text-[10px]">Payee UPI ID</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-emerald-400">{selectedPayout.upiId || "Not set yet"}</span>
                      {selectedPayout.upiId && (
                        <button
                          type="button"
                          onClick={() => copyUpiId(selectedPayout.upiId)}
                          className="p-1 hover:bg-[#212327] rounded text-[#9E9E9F] hover:text-white transition-colors"
                          title="Copy UPI ID"
                        >
                          {copiedUpi ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Event Information */}
              <div className="p-4 rounded-xl bg-[#131517] border border-[#2A2D31] space-y-2">
                <div className="text-[11px] font-bold text-[#FE760B] uppercase tracking-wider flex items-center gap-1.5">
                  <Receipt size={13} /> Event Information
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-[#9E9E9F] block text-[10px]">Event Title</span>
                    <span className="font-semibold text-white">{selectedPayout.eventTitle}</span>
                  </div>
                  <div>
                    <span className="text-[#9E9E9F] block text-[10px]">Event ID</span>
                    <span className="font-mono text-[#D0D0D1]">{selectedPayout.eventId}</span>
                  </div>
                  <div>
                    <span className="text-[#9E9E9F] block text-[10px]">Paid Registrations</span>
                    <span className="font-bold text-white">{selectedPayout.registrationsCount} attendees</span>
                  </div>
                </div>
              </div>

              {/* 3. Financial Breakdown */}
              <div className="p-4 rounded-xl bg-[#131517] border border-[#2A2D31] space-y-3">
                <div className="text-[11px] font-bold text-[#FE760B] uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp size={13} /> Financial Breakdown & Settlement Math
                </div>

                <div className="space-y-2 border-b border-[#2A2D31]/60 pb-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#9E9E9F]">Gross Ticket Revenue</span>
                    <span className="font-mono font-semibold text-white">
                      ₹{(selectedPayout.grossAmountPaise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#9E9E9F]">TicketLelo Transaction Fee</span>
                    <span className="font-mono text-amber-400">
                      - ₹{(selectedPayout.platformFeePaise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#9E9E9F]">Razorpay Processing Charges (2.36%)</span>
                    <span className="font-mono text-amber-400">
                      - ₹{(selectedPayout.razorpayFeePaise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {selectedPayout.refundsPaise > 0 && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#9E9E9F]">Refunds & Adjustments</span>
                      <span className="font-mono text-rose-400">
                        - ₹{(selectedPayout.refundsPaise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                </div>

                {/* Final Net Payable */}
                <div className="flex items-center justify-between pt-1">
                  <div>
                    <span className="text-xs font-bold text-white block">Final Organizer Payable Amount</span>
                    <span className="text-[10px] text-emerald-400">Net funds cleared and ready for UPI disbursement</span>
                  </div>
                  <div className="font-mono font-black text-xl text-[#FE760B]">
                    ₹{(selectedPayout.netOrganizerPaise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {/* 4. Payout Confirmation Record (If already Paid) */}
              {selectedPayout.status === "PAID" && (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
                    <CheckCircle2 size={14} /> Payment Confirmation Details
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-[#9E9E9F] block text-[10px]">UPI Transaction ID / UTR</span>
                      <span className="font-mono font-black text-white text-sm">{selectedPayout.utr}</span>
                    </div>
                    <div>
                      <span className="text-[#9E9E9F] block text-[10px]">Confirmed Date & Time</span>
                      <span className="text-white">
                        {new Date(selectedPayout.paidAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#9E9E9F] block text-[10px]">Confirmed By Super Admin</span>
                      <span className="text-[#D0D0D1]">
                        {selectedPayout.paidBy?.name || selectedPayout.paidBy?.email || "Super Admin"}
                      </span>
                    </div>
                    {selectedPayout.paymentRemarks && (
                      <div>
                        <span className="text-[#9E9E9F] block text-[10px]">Remarks</span>
                        <span className="text-[#D0D0D1] italic">{selectedPayout.paymentRemarks}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* On Hold Reason (If on hold) */}
              {selectedPayout.status === "ON_HOLD" && (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs space-y-1">
                  <span className="font-bold text-rose-400 flex items-center gap-1">
                    <PauseCircle size={14} /> Payout is Temporarily On Hold
                  </span>
                  <p className="text-rose-200">{selectedPayout.holdReason}</p>
                </div>
              )}
            </div>

            {/* Modal Actions Footer */}
            <div className="p-5 bg-[#131517] border-t border-[#2A2D31] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {selectedPayout.status !== "PAID" && (
                  <>
                    {selectedPayout.status === "ON_HOLD" ? (
                      <button
                        type="button"
                        onClick={() => handleHoldAction("RELEASE")}
                        className="px-3 py-2 rounded-xl bg-[#212327] hover:bg-[#2A2D31] text-blue-400 border border-[#2A2D31] text-xs font-semibold cursor-pointer"
                      >
                        Release Hold
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowHoldModal(true)}
                        className="px-3 py-2 rounded-xl bg-[#212327] hover:bg-[#2A2D31] text-rose-400 border border-[#2A2D31] text-xs font-semibold cursor-pointer"
                      >
                        Put on Hold
                      </button>
                    )}

                    {selectedPayout.status === "FAILED" && (
                      <button
                        type="button"
                        onClick={handleRetryAction}
                        className="px-3 py-2 rounded-xl bg-[#212327] hover:bg-[#2A2D31] text-amber-400 border border-[#2A2D31] text-xs font-semibold cursor-pointer"
                      >
                        Retry Payout
                      </button>
                    )}
                  </>
                )}
              </div>

              <div className="flex items-center gap-3">
                {selectedPayout.status !== "PAID" && (
                  <>
                    {/* Action 1: Pay via UPI */}
                    <button
                      type="button"
                      onClick={handleOpenUpiApp}
                      className="px-4 py-2.5 rounded-xl bg-[#212327] hover:bg-[#2A2D31] text-white border border-[#2A2D31] text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <QrCode size={14} className="text-[#FE760B]" />
                      <span>Pay via UPI</span>
                    </button>

                    {/* Action 2: Confirm Payment / Mark as Paid */}
                    <button
                      type="button"
                      onClick={() => setShowConfirmModal(true)}
                      className="px-5 py-2.5 rounded-xl bg-[#FE760B] hover:bg-[#e06505] text-black text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-[#FE760B]/20"
                    >
                      <Check size={14} />
                      <span>Confirm Payment – Mark as Paid</span>
                    </button>
                  </>
                )}

                {selectedPayout.status === "PAID" && (
                  <button
                    type="button"
                    onClick={() => setSelectedPayout(null)}
                    className="px-4 py-2 rounded-xl bg-[#212327] text-white border border-[#2A2D31] text-xs font-semibold cursor-pointer"
                  >
                    Close
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── PART 5: UPI Deep Link & QR Code Modal ── */}
      {showQrModal && selectedPayout && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#17191C] border border-[#2A2D31] rounded-2xl shadow-2xl p-6 text-center space-y-4 animate-scale-in">
            <div className="flex items-center justify-between pb-2 border-b border-[#2A2D31]">
              <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                <QrCode size={16} className="text-[#FE760B]" />
                <span>Scan or Pay via UPI</span>
              </h4>
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="p-1 rounded-md text-[#9E9E9F] hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            {/* QR Code Canvas */}
            <div className="bg-white p-3 rounded-2xl inline-block shadow-lg mx-auto">
              {selectedPayout.qrCodeDataUrl ? (
                <img
                  src={selectedPayout.qrCodeDataUrl}
                  alt="UPI QR Code"
                  className="w-52 h-52 object-contain block mx-auto"
                />
              ) : (
                <div className="w-52 h-52 flex items-center justify-center text-slate-800 text-xs font-mono font-bold">
                  {selectedPayout.upiId}
                </div>
              )}
            </div>

            <div className="space-y-1 text-xs">
              <div className="font-mono font-black text-lg text-white">
                ₹{(selectedPayout.netOrganizerPaise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-[#9E9E9F] flex items-center justify-center gap-1">
                <span>Payee:</span>
                <strong className="text-white font-mono">{selectedPayout.upiId}</strong>
              </div>
              <p className="text-[10px] text-[#9E9E9F]">
                Scan with Google Pay, PhonePe, Paytm, or BHIM.
              </p>
            </div>

            {/* Direct UPI Deep Link */}
            <a
              href={selectedPayout.upiPaymentUrl}
              className="w-full py-2.5 rounded-xl bg-[#212327] hover:bg-[#2A2D31] text-[#FE760B] border border-[#2A2D31] text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer block"
            >
              <ExternalLink size={14} />
              <span>Launch UPI App Directly</span>
            </a>

            {/* Critical Requirement Reminder */}
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-300 leading-tight">
              <strong>Notice:</strong> Opening the UPI app does NOT automatically mark this payout as Paid. Return to TicketLelo and enter the UTR to confirm.
            </div>

            <button
              type="button"
              onClick={() => {
                setShowQrModal(false);
                setShowConfirmModal(true);
              }}
              className="w-full py-2 rounded-xl bg-[#FE760B] text-black text-xs font-bold cursor-pointer"
            >
              I Completed Payment &rarr; Enter UTR
            </button>
          </div>
        </div>
      )}

      {/* ── PART 5: Manual Payment Confirmation Modal ── */}
      {showConfirmModal && selectedPayout && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmPayment}
            className="w-full max-w-md bg-[#17191C] border border-[#2A2D31] rounded-2xl shadow-2xl p-6 text-xs space-y-4 animate-scale-in"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#2A2D31]">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <CheckCircle2 size={16} className="text-emerald-400" />
                  <span>Confirm Manual UPI Settlement</span>
                </h4>
                <p className="text-[11px] text-[#9E9E9F] mt-0.5 font-mono">
                  {selectedPayout.payoutRef} • ₹{(selectedPayout.netOrganizerPaise / 100).toLocaleString("en-IN")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="p-1 rounded-md text-[#9E9E9F] hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              {/* UTR Input (Required) */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#D0D0D1]">
                  UPI Transaction ID / UTR <span className="text-[#FE760B]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={confirmForm.utr}
                  onChange={(e) => setConfirmForm({ ...confirmForm, utr: e.target.value })}
                  placeholder="e.g. 403819283748 or UPI-REF-9921"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#212327] border border-[#2A2D31] text-xs font-mono text-white placeholder-[#9E9E9F] focus:outline-none focus:border-[#FE760B] transition-colors"
                />
                <p className="text-[10px] text-[#9E9E9F]">
                  Found in your UPI app payment receipt / SMS confirmation.
                </p>
              </div>

              {/* Receipt URL / Screenshot (Optional) */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#D0D0D1]">
                  Payment Screenshot / Receipt URL <span className="text-[#9E9E9F]">(Optional)</span>
                </label>
                <input
                  type="url"
                  value={confirmForm.receiptUrl}
                  onChange={(e) => setConfirmForm({ ...confirmForm, receiptUrl: e.target.value })}
                  placeholder="https://... receipt image link"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#212327] border border-[#2A2D31] text-xs text-white placeholder-[#9E9E9F] focus:outline-none focus:border-[#FE760B] transition-colors"
                />
              </div>

              {/* Payment Remarks (Optional) */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#D0D0D1]">
                  Payment Remarks <span className="text-[#9E9E9F]">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={confirmForm.remarks}
                  onChange={(e) => setConfirmForm({ ...confirmForm, remarks: e.target.value })}
                  placeholder="e.g. Disbursed via GPay Business account"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#212327] border border-[#2A2D31] text-xs text-white placeholder-[#9E9E9F] focus:outline-none focus:border-[#FE760B] transition-colors resize-none"
                />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#212327]/80 border border-[#2A2D31] text-[10px] text-[#9E9E9F] leading-relaxed">
              Disburses double-entry ledger, marks payout as <strong>Paid</strong>, and dispatches in-app notification & confirmation email to organizer ({selectedPayout.organizerEmail}).
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#2A2D31]">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-3.5 py-2 rounded-xl bg-[#212327] text-white border border-[#2A2D31] text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={confirming || !confirmForm.utr.trim()}
                className="px-4 py-2 rounded-xl bg-[#FE760B] hover:bg-[#e06505] text-black text-xs font-bold transition-all shadow-md shadow-[#FE760B]/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {confirming ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Confirming...</span>
                  </>
                ) : (
                  <>
                    <Check size={14} />
                    <span>Confirm & Mark as Paid</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Hold Modal ── */}
      {showHoldModal && selectedPayout && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#17191C] border border-[#2A2D31] rounded-2xl shadow-2xl p-5 text-xs space-y-4 animate-scale-in">
            <div className="flex items-center justify-between pb-2 border-b border-[#2A2D31]">
              <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                <PauseCircle size={16} className="text-rose-400" />
                <span>Place Payout on Hold</span>
              </h4>
              <button
                type="button"
                onClick={() => setShowHoldModal(false)}
                className="p-1 rounded-md text-[#9E9E9F] hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#D0D0D1]">
                Mandatory Hold Reason <span className="text-rose-400">*</span>
              </label>
              <textarea
                rows={3}
                required
                value={holdReason}
                onChange={(e) => setHoldReason(e.target.value)}
                placeholder="Specify the reason for withholding payment (e.g. Attendee ticket disputes under investigation)..."
                className="w-full px-3.5 py-2 rounded-xl bg-[#212327] border border-[#2A2D31] text-xs text-white placeholder-[#9E9E9F] focus:outline-none focus:border-rose-500 transition-colors resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#2A2D31]">
              <button
                type="button"
                onClick={() => setShowHoldModal(false)}
                className="px-3.5 py-2 rounded-xl bg-[#212327] text-white border border-[#2A2D31] text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingHold || !holdReason.trim()}
                onClick={() => handleHoldAction("HOLD")}
                className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                {submittingHold ? "Placing Hold..." : "Confirm Hold"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

