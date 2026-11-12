"use client";

import { useState, useEffect } from "react";
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
  LifeBuoy,
  CreditCard,
  ArrowRight,
  ShieldCheck,
  PauseCircle,
  X,
  ChevronRight,
  QrCode,
} from "lucide-react";
import { SupportTicketModal } from "@/components/admin/support/support-ticket-modal";
import { OrganizerPayoutDetailsForm } from "./organizer-payout-details-form";

export function OrganizerPaymentSection({ organizerId = null, eventId = null }) {
  const [activeSubTab, setActiveSubTab] = useState("settlements"); // "settlements" | "payout-details"
  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [selectedPayout, setSelectedPayout] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);

  // Settlement Details Modal state
  const [selectedSettlementRecord, setSelectedSettlementRecord] = useState(null);

  // Support Ticket Modal state
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const [supportInitialData, setSupportInitialData] = useState({});

  // Table filter
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  const fetchData = async (sync = false, showLoading = false) => {
    try {
      if (sync) setSyncing(true);
      if (showLoading) setLoading(true);
      setError(null);

      const sumUrl = `/api/payments/summary?${organizerId ? `organizerId=${organizerId}&` : ""}${eventId ? `eventId=${eventId}` : ""}`;
      const settUrl = `/api/payments/settlements?${organizerId ? `organizerId=${organizerId}&` : ""}${eventId ? `eventId=${eventId}` : ""}`;

      const [sumRes, settRes] = await Promise.all([
        fetch(sumUrl),
        fetch(settUrl),
      ]);

      if (sumRes.ok) {
        const sumData = await sumRes.json();
        setSummary(sumData.summary || null);
        setTransactions(sumData.transactions || []);
      }
      if (settRes.ok) {
        const settData = await settRes.json();
        setSettlements(settData.settlements || []);
        setPayouts(settData.payouts || []);
      }
    } catch (err) {
      console.error("[OrganizerPaymentSection] fetch error:", err);
      setError("Failed to load payment records. Please try again.");
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchData(false, true);
  }, [organizerId, eventId]);

  const handleOpenSupportForRecord = (record) => {
    const isSettlement = Boolean(record.settlementId);
    setSupportInitialData({
      category: "Settlements and Payouts",
      subject: `Inquiry regarding ${isSettlement ? `Settlement ${record.settlementId}` : `Order ${record.orderId}`}`,
      description: `Hello Support Team,\n\nI am requesting clarification regarding ${
        isSettlement ? `Settlement ID: ${record.settlementId}` : `Order ID: ${record.orderId}`
      }.\n\nEvent: ${record.eventTitle || "Event"}\nAmount: ₹${((record.netOrganizerPaise || record.organizerSharePaise || 0) / 100).toFixed(2)}\nCurrent Status: ${record.status || record.paymentStatus}\nCaptured Date: ${record.capturedAt || record.createdAt || "N/A"}\n\nPlease check the payout progress.`,
      relatedEntity: {
        type: isSettlement ? "settlement" : "order",
        id: record.settlementId || record.orderId,
        referenceId: record.orderId,
        amountPaise: record.netOrganizerPaise || record.organizerSharePaise || 0,
        status: record.status || record.paymentStatus,
      },
    });
    setSupportModalOpen(true);
  };

  const exportCSV = () => {
    if (transactions.length === 0) return;
    const headers = [
      "Settlement ID,Order ID,Event Title,Attendee,Gross (INR),Platform Fee (INR),Organizer Share (INR),Payment Status,Date",
    ];
    const rows = transactions.map((t) => [
      `"${t.settlementId || ""}"`,
      `"${t.orderId}"`,
      `"${t.eventTitle || ""}"`,
      `"${t.buyerName} <${t.buyerEmail}>"`,
      (t.grossPaise / 100).toFixed(2),
      (t.platformFeePaise / 100).toFixed(2),
      (t.organizerSharePaise / 100).toFixed(2),
      `"${t.paymentStatus}"`,
      `"${t.createdAt || ""}"`,
    ].join(","));

    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ticketlelo_settlements_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "ACTIVE":
      case "SETTLED":
      case "PROCESSED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-semibold">
            <CheckCircle2 size={12} /> {status === "ACTIVE" ? "Active & Verified" : "Settled"}
          </span>
        );
      case "ELIGIBLE":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[11px] font-semibold">
            <Clock size={12} /> Eligible for Payout
          </span>
        );
      case "ON_HOLD":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[11px] font-semibold">
            <PauseCircle size={12} /> On Hold
          </span>
        );
      case "FAILED":
      case "RESTRICTED":
      case "SUSPENDED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[11px] font-semibold">
            <ShieldAlert size={12} /> {status}
          </span>
        );
      case "UNDER_REVIEW":
      case "PENDING":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[11px] font-semibold">
            <Clock size={12} /> {status || "Pending (T+4)"}
          </span>
        );
    }
  };

  const filteredItems = transactions.filter((t) => {
    const matchesStatus =
      statusFilter === "ALL" ||
      t.paymentStatus?.toUpperCase() === statusFilter ||
      (statusFilter === "SETTLED" && t.transferStatus === "TRANSFERRED");
    const matchesSearch =
      !searchTerm ||
      t.orderId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.settlementId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.buyerName?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* ── Sub Navigation: Settlements vs. Payment Settings ── */}
      <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 border-b border-[#2A2D31] pb-3">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 sm:pb-0 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveSubTab("settlements")}
            className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === "settlements"
                ? "bg-[#FE760B] text-black shadow-md shadow-[#FE760B]/20"
                : "bg-[#1A1C1F] text-[#9E9E9F] hover:text-white"
            }`}
          >
            Settlements & Payouts
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("payout-details")}
            className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === "payout-details"
                ? "bg-[#FE760B] text-black shadow-md shadow-[#FE760B]/20"
                : "bg-[#1A1C1F] text-[#9E9E9F] hover:text-white"
            }`}
          >
            Payout Details (UPI & Bank)
          </button>
        </div>

        <button
          type="button"
          onClick={() => fetchData(true)}
          disabled={syncing}
          className="p-2.5 rounded-xl bg-[#1A1C1F] border border-[#2A2D31] text-[#9E9E9F] hover:text-white transition-colors cursor-pointer shrink-0 ml-auto sm:ml-0"
          title="Refresh Financial Records"
        >
          <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
        </button>
      </div>

      {activeSubTab === "settlements" ? (
        <div className="space-y-4 sm:space-y-6 animate-fade-in">
          {/* ── 1. Financial Overview Metrics (6 Canonical Cards) ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <div className="p-4 sm:p-5 rounded-2xl bg-[#1A1C1F] border border-[#2A2D31] shadow-lg">
              <div className="flex items-center justify-between text-[#9E9E9F] mb-1.5 text-xs font-medium">
                <span>Total Ticket Revenue</span>
                <DollarSign size={15} className="text-[#FE760B]" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-white">
                ₹{summary ? (summary.totalRevenuePaise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "0.00"}
              </div>
              <p className="text-[10px] text-[#9E9E9F] mt-1">Gross attendee checkouts</p>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-[#1A1C1F] border border-[#2A2D31] shadow-lg">
              <div className="flex items-center justify-between text-[#9E9E9F] mb-1.5 text-xs font-medium">
                <span>Net Organizer Earnings</span>
                <TrendingUp size={15} className="text-emerald-400" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-emerald-400">
                ₹{summary ? (summary.netOrganizerEarningsPaise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "0.00"}
              </div>
              <p className="text-[10px] text-[#9E9E9F] mt-1">Your net revenue after fees</p>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-[#1A1C1F] border border-[#2A2D31] shadow-lg">
              <div className="flex items-center justify-between text-[#9E9E9F] mb-1.5 text-xs font-medium">
                <span>Platform Fees</span>
                <Receipt size={15} className="text-amber-400" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-white">
                ₹{summary ? (summary.totalPlatformFeesPaise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "0.00"}
              </div>
              <p className="text-[10px] text-[#9E9E9F] mt-1">TicketLelo platform fee</p>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-[#1A1C1F] border border-[#2A2D31] shadow-lg">
              <div className="flex items-center justify-between text-[#9E9E9F] mb-1.5 text-xs font-medium">
                <span>Pending Settlement</span>
                <Clock size={15} className="text-blue-400" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-blue-400">
                ₹{summary ? (summary.pendingSettlementPaise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "0.00"}
              </div>
              <p className="text-[10px] text-[#9E9E9F] mt-1">Maturing on T+4 working days</p>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-[#1A1C1F] border border-[#2A2D31] shadow-lg">
              <div className="flex items-center justify-between text-[#9E9E9F] mb-1.5 text-xs font-medium">
                <span>Processing Settlement</span>
                <RefreshCw size={15} className="text-indigo-400" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-indigo-400">
                ₹{summary ? (summary.processingSettlementPaise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "0.00"}
              </div>
              <p className="text-[10px] text-[#9E9E9F] mt-1">In bank clearing batch</p>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-[#1A1C1F] border border-[#2A2D31] shadow-lg">
              <div className="flex items-center justify-between text-[#9E9E9F] mb-1.5 text-xs font-medium">
                <span>Successfully Settled</span>
                <CheckCircle2 size={15} className="text-emerald-400" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-white">
                ₹{summary ? (summary.settledPaise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "0.00"}
              </div>
              <p className="text-[10px] text-[#9E9E9F] mt-1">Disbursed to your bank account</p>
            </div>
          </div>

          {/* ── 2. Next Settlement Maturity Banner ── */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-[#1A1C1F] via-[#212327] to-[#1A1C1F] border border-[#2A2D31] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-[#FE760B]/10 border border-[#FE760B]/20 flex items-center justify-center text-[#FE760B] shrink-0">
                <CreditCard size={20} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  Next Scheduled Payout (T+4 Working Days)
                  <span className="px-2 py-0.5 rounded-full bg-[#FE760B]/15 text-[#FE760B] text-[10px] font-bold">
                    Calendar-Aware
                  </span>
                </h4>
                <p className="text-xs text-[#9E9E9F] mt-0.5">
                  Expected Maturity:{" "}
                  <strong className="text-white">
                    {summary?.nextSettlementDate
                      ? new Date(summary.nextSettlementDate).toLocaleDateString("en-IN", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "No pending payouts"}
                  </strong>{" "}
                  &bull; Estimated Amount:{" "}
                  <strong className="text-emerald-400">
                    ₹{summary?.nextSettlementAmountPaise ? (summary.nextSettlementAmountPaise / 100).toFixed(2) : "0.00"}
                  </strong>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <span className="text-[11px] text-[#9E9E9F] block">Destination Account:</span>
                <span className="text-xs font-mono font-semibold text-white">
                  {summary?.destinationAccount?.maskedNumber || "HDFC Bank •••• 4092"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleOpenSupportForRecord({ settlementId: "GENERAL_PAYOUT", orderId: "GENERAL" })}
                className="px-3.5 py-2 rounded-xl bg-[#212327] hover:bg-[#2A2D31] border border-[#2A2D31] text-xs font-semibold text-[#D0D0D1] hover:text-white transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <LifeBuoy size={14} className="text-[#FE760B]" />
                Inquire Payout
              </button>
            </div>
          </div>

          {/* ── 2.5 Event Settlements & UPI Payouts (PART 6) ── */}
          <div className="p-4 sm:p-6 rounded-2xl bg-[#1A1C1F] border border-[#2A2D31] shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <Wallet size={18} className="text-[#FE760B]" />
                  <span>Event Settlements & UPI Payouts</span>
                </h3>
                <p className="text-xs text-[#9E9E9F] mt-0.5">
                  Scheduled on T+4 working days. Settlements are verified and paid via UPI by TicketLelo Finance.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setActiveSubTab("payout-details")}
                className="px-3.5 py-1.5 rounded-xl bg-[#212327] hover:bg-[#2A2D31] border border-[#2A2D31] text-xs font-semibold text-[#FE760B] transition-colors flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
              >
                <span>Edit Payout UPI & Bank</span>
                <ArrowRight size={13} />
              </button>
            </div>

            {payouts.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#9E9E9F] bg-[#131517] rounded-xl border border-[#2A2D31]/60">
                No event payouts created yet. Payout tasks generate automatically when attendees register for your events.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#2A2D31] text-[#9E9E9F]">
                      <th className="pb-3 font-semibold">Event Name</th>
                      <th className="pb-3 font-semibold">Payout Ref ID</th>
                      <th className="pb-3 font-semibold text-right">Payout Amount</th>
                      <th className="pb-3 font-semibold">Payment Method</th>
                      <th className="pb-3 font-semibold">UPI Transaction Ref (UTR)</th>
                      <th className="pb-3 font-semibold text-center">Status</th>
                      <th className="pb-3 font-semibold text-right">Payment / Due Date</th>
                      <th className="pb-3 font-semibold text-center">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2A2D31]/50 text-white">
                    {payouts.map((po) => (
                      <tr
                        key={po.payoutId}
                        onClick={() => setSelectedPayout(po)}
                        className="hover:bg-[#212327]/40 transition-colors cursor-pointer"
                      >
                        <td className="py-3.5 font-medium text-white">{po.eventTitle}</td>
                        <td className="py-3.5 font-mono text-[11px] text-[#FE760B] font-semibold">{po.payoutRef}</td>
                        <td className="py-3.5 text-right font-mono font-bold text-sm text-emerald-400">
                          ₹{(po.netOrganizerPaise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 text-[11px] text-[#D0D0D1]">
                          UPI ({po.upiId || "Pending"})
                        </td>
                        <td className="py-3.5 font-mono text-[11px] text-white">
                          {po.utr ? (
                            <span className="text-emerald-400 font-bold">{po.utr}</span>
                          ) : (
                            <span className="text-[#9E9E9F]">—</span>
                          )}
                        </td>
                        <td className="py-3.5 text-center">
                          {getStatusBadge(po.status)}
                        </td>
                        <td className="py-3.5 text-right text-[#9E9E9F]">
                          {po.paidAt
                            ? new Date(po.paidAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                            : po.dueDateFormatted || "T+4 Working Days"}
                        </td>
                        <td className="py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setSelectedPayout(po)}
                            className="px-2.5 py-1 rounded-lg bg-[#212327] hover:bg-[#FE760B]/15 text-[#D0D0D1] hover:text-[#FE760B] border border-[#2A2D31] text-[11px] font-semibold transition-all cursor-pointer"
                          >
                            Breakdown
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── 3. Settlement History & Transactions Table ── */}
          <div className="p-4 sm:p-6 rounded-2xl bg-[#1A1C1F] border border-[#2A2D31] shadow-xl space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white">Settlement Records</h3>
                <p className="text-xs text-[#9E9E9F]">
                  Order allocations, commission splits, and bank transfer references
                </p>
              </div>

              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full md:w-auto">
                <input
                  type="text"
                  placeholder="Search settlement or order ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-[#212327] border border-[#2A2D31] text-xs text-white placeholder-[#9E9E9F] focus:outline-none focus:border-[#FE760B] transition-colors flex-1 sm:w-52 md:w-60"
                />

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-[#212327] border border-[#2A2D31] text-xs text-white focus:outline-none focus:border-[#FE760B] shrink-0"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="CAPTURED">Captured</option>
                  <option value="SETTLED">Settled</option>
                  <option value="PENDING">Pending</option>
                  <option value="REFUNDED">Refunded</option>
                </select>

                <button
                  type="button"
                  onClick={exportCSV}
                  disabled={transactions.length === 0}
                  className="px-3 py-1.5 rounded-xl bg-[#212327] hover:bg-[#2A2D31] border border-[#2A2D31] text-xs font-semibold text-[#D0D0D1] hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Download size={14} />
                  <span>CSV</span>
                </button>
              </div>
            </div>

            {/* Desktop Table View (>= md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#2A2D31] text-[#9E9E9F]">
                    <th className="pb-3 font-semibold">Settlement / Order ID</th>
                    <th className="pb-3 font-semibold">Attendee</th>
                    <th className="pb-3 font-semibold text-right">Gross</th>
                    <th className="pb-3 font-semibold text-right">Fee</th>
                    <th className="pb-3 font-semibold text-right">Net Share</th>
                    <th className="pb-3 font-semibold text-center">Status</th>
                    <th className="pb-3 font-semibold text-right">Maturity / Date</th>
                    <th className="pb-3 font-semibold text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2A2D31]/50 text-white">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-[#9E9E9F]">
                        Loading settlement records...
                      </td>
                    </tr>
                  ) : filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-[#9E9E9F]">
                        No settlement records found.
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((tx) => (
                      <tr
                        key={tx.id}
                        onClick={() => setSelectedSettlementRecord(tx)}
                        className="hover:bg-[#212327]/40 transition-colors cursor-pointer"
                      >
                        <td className="py-3 font-mono text-[11px]">
                          <span className="text-[#FE760B] font-semibold block">{tx.settlementId}</span>
                          <span className="text-[#9E9E9F] text-[10px]">{tx.orderId}</span>
                        </td>
                        <td className="py-3">
                          <div className="font-medium text-white">{tx.buyerName}</div>
                          <div className="text-[11px] text-[#9E9E9F]">{tx.buyerEmail}</div>
                        </td>
                        <td className="py-3 text-right font-semibold">
                          ₹{(tx.grossPaise / 100).toFixed(2)}
                        </td>
                        <td className="py-3 text-right text-amber-400">
                          ₹{(tx.platformFeePaise / 100).toFixed(2)}
                        </td>
                        <td className="py-3 text-right text-emerald-400 font-semibold">
                          ₹{(tx.organizerSharePaise / 100).toFixed(2)}
                        </td>
                        <td className="py-3 text-center">
                          {getStatusBadge(
                            tx.transferStatus === "TRANSFERRED"
                              ? "SETTLED"
                              : tx.paymentStatus === "CAPTURED"
                              ? "PENDING"
                              : tx.paymentStatus
                          )}
                        </td>
                        <td className="py-3 text-right text-[#9E9E9F]">
                          {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString("en-IN") : "—"}
                        </td>
                        <td className="py-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedSettlementRecord(tx)}
                              className="px-2 py-1 rounded-lg bg-[#212327] hover:bg-[#FE760B]/15 text-[#D0D0D1] hover:text-[#FE760B] border border-[#2A2D31] text-[11px] font-semibold transition-all cursor-pointer"
                            >
                              Details
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenSupportForRecord(tx)}
                              className="px-2 py-1 rounded-lg bg-[#212327] hover:bg-[#FE760B]/15 text-[#FE760B] hover:text-[#FE760B] border border-[#2A2D31] text-[11px] font-semibold transition-all inline-flex items-center gap-1 cursor-pointer"
                              title="Raise Support Ticket"
                            >
                              <LifeBuoy size={12} />
                              Support
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View (< md) */}
            <div className="block md:hidden divide-y divide-[#2A2D31]">
              {loading ? (
                <div className="py-8 text-center text-xs text-[#9E9E9F]">
                  Loading settlement records...
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#9E9E9F]">
                  No settlement records found.
                </div>
              ) : (
                filteredItems.map((tx) => (
                  <div
                    key={tx.id}
                    onClick={() => setSelectedSettlementRecord(tx)}
                    className="py-3.5 space-y-2.5 hover:bg-[#212327]/30 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-mono text-xs">
                        <span className="text-[#FE760B] font-semibold block">{tx.settlementId}</span>
                        <span className="text-[#9E9E9F] text-[10px]">{tx.orderId}</span>
                      </div>
                      {getStatusBadge(
                        tx.transferStatus === "TRANSFERRED"
                          ? "SETTLED"
                          : tx.paymentStatus === "CAPTURED"
                          ? "PENDING"
                          : tx.paymentStatus
                      )}
                    </div>

                    <div className="text-xs">
                      <div className="font-medium text-white">{tx.buyerName}</div>
                      <div className="text-[11px] text-[#9E9E9F]">{tx.buyerEmail}</div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-[#212327] border border-[#2A2D31] text-[11px] text-center">
                      <div>
                        <span className="text-[#9E9E9F] block text-[10px]">Gross</span>
                        <span className="font-semibold text-white">₹{(tx.grossPaise / 100).toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-[#9E9E9F] block text-[10px]">Fee</span>
                        <span className="font-semibold text-amber-400">₹{(tx.platformFeePaise / 100).toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-[#9E9E9F] block text-[10px]">Net Share</span>
                        <span className="font-semibold text-emerald-400">₹{(tx.organizerSharePaise / 100).toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1" onClick={(e) => e.stopPropagation()}>
                      <span className="text-[11px] text-[#9E9E9F]">
                        {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString("en-IN") : "—"}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedSettlementRecord(tx)}
                          className="px-2.5 py-1 rounded-lg bg-[#212327] hover:bg-[#FE760B]/15 text-[#D0D0D1] border border-[#2A2D31] text-xs font-semibold transition-all cursor-pointer"
                        >
                          Details
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenSupportForRecord(tx)}
                          className="px-3 py-1 rounded-lg bg-[#212327] hover:bg-[#FE760B]/15 text-[#FE760B] border border-[#2A2D31] text-xs font-semibold transition-all inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <LifeBuoy size={12} />
                          <span>Support</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ── Organizer Payout Details (UPI & Bank) ── */
        <div className="space-y-6 animate-fade-in">
          <OrganizerPayoutDetailsForm organizerId={organizerId} onSaved={() => fetchData(true)} />

          {/* Security Notice Card */}
          <div className="p-5 rounded-2xl bg-[#1A1C1F] border border-[#2A2D31] space-y-2">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldCheck size={16} className="text-[#FE760B]" />
              Merchant Gateway Security Policy
            </h4>
            <p className="text-xs text-[#9E9E9F] leading-relaxed">
              TicketLelo operates via a centralized merchant integration. Organizers <strong>never</strong> supply their personal Razorpay API keys or secrets. All transactions are securely routed through TicketLelo&apos;s master gateway, and net proceeds are disbursed directly to your verified UPI &amp; bank account on a T+4 working-day schedule.
            </p>
          </div>
        </div>
      )}

      {/* ── Settlement Record Details Modal (Exact Visual Style with Cross Icon) ── */}
      {selectedSettlementRecord && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto">
          <div className="w-full max-w-xl bg-[#17191C] border border-[#2A2D31] rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col text-white animate-scale-in">
            {/* Header */}
            <div className="p-4 sm:p-5 bg-[#1A1C1F] border-b border-[#2A2D31] flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[#FE760B]/12 border border-[#FE760B]/25 flex items-center justify-center text-[#FE760B] shrink-0">
                  <Receipt size={18} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-white truncate">
                    Settlement Record Details
                  </h3>
                  <p className="text-[11px] sm:text-xs text-[#9E9E9F] truncate">
                    Settlement ID: <span className="font-mono text-[#FE760B]">#{selectedSettlementRecord.settlementId}</span> &bull; Order: {selectedSettlementRecord.orderId}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSettlementRecord(null)}
                className="p-2 rounded-lg text-[#9E9E9F] hover:text-white hover:bg-[#212327] transition-colors shrink-0 cursor-pointer"
                aria-label="Close Modal"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto text-xs">
              {/* Status & Maturity Banner */}
              <div className="p-3.5 rounded-xl bg-[#212327] border border-[#2A2D31] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div>
                  <span className="text-[10px] text-[#9E9E9F] uppercase tracking-wider block font-bold">Current Settlement Status</span>
                  <div className="mt-1">
                    {getStatusBadge(
                      selectedSettlementRecord.transferStatus === "TRANSFERRED"
                        ? "SETTLED"
                        : selectedSettlementRecord.paymentStatus === "CAPTURED"
                        ? "PENDING"
                        : selectedSettlementRecord.paymentStatus
                    )}
                  </div>
                </div>

                <div className="text-left sm:text-right">
                  <span className="text-[10px] text-[#9E9E9F] uppercase tracking-wider block font-bold">Maturity Timeline</span>
                  <span className="text-xs font-semibold text-white">
                    {selectedSettlementRecord.tPlus4OrganizerDate
                      ? new Date(selectedSettlementRecord.tPlus4OrganizerDate).toLocaleDateString("en-IN", { dateStyle: "medium" })
                      : selectedSettlementRecord.createdAt
                      ? new Date(selectedSettlementRecord.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })
                      : "T+4 Working Days"}
                  </span>
                </div>
              </div>

              {/* 3-Column Financial Breakdown */}
              <div className="grid grid-cols-3 gap-2.5 p-3.5 rounded-xl bg-[#212327] border border-[#2A2D31] text-center">
                <div>
                  <span className="text-[10px] text-[#9E9E9F] uppercase font-bold block">Gross Revenue</span>
                  <span className="text-sm sm:text-base font-bold text-white font-mono mt-0.5 block">
                    ₹{(selectedSettlementRecord.grossPaise / 100).toFixed(2)}
                  </span>
                  <span className="text-[10px] text-[#9E9E9F]">Attendee checkout</span>
                </div>

                <div>
                  <span className="text-[10px] text-[#9E9E9F] uppercase font-bold block">Platform Fee</span>
                  <span className="text-sm sm:text-base font-bold text-amber-400 font-mono mt-0.5 block">
                    -₹{(selectedSettlementRecord.platformFeePaise / 100).toFixed(2)}
                  </span>
                  <span className="text-[10px] text-[#9E9E9F]">Platform fee</span>
                </div>

                <div>
                  <span className="text-[10px] text-[#9E9E9F] uppercase font-bold block">Net Share</span>
                  <span className="text-sm sm:text-base font-bold text-emerald-400 font-mono mt-0.5 block">
                    ₹{(selectedSettlementRecord.organizerSharePaise / 100).toFixed(2)}
                  </span>
                  <span className="text-[10px] text-[#9E9E9F]">Organizer payable</span>
                </div>
              </div>

              {/* Transaction & Attendee Details */}
              <div className="p-3.5 rounded-xl bg-[#212327] border border-[#2A2D31] space-y-2.5">
                <div className="flex justify-between items-center pb-2 border-b border-[#2A2D31]/60">
                  <span className="text-[#9E9E9F]">Attendee:</span>
                  <span className="font-semibold text-white">{selectedSettlementRecord.buyerName} ({selectedSettlementRecord.buyerEmail})</span>
                </div>

                <div className="flex justify-between items-center pb-2 border-b border-[#2A2D31]/60">
                  <span className="text-[#9E9E9F]">Event:</span>
                  <span className="font-semibold text-white">{selectedSettlementRecord.eventTitle || "Event Registration"}</span>
                </div>

                <div className="flex justify-between items-center pb-2 border-b border-[#2A2D31]/60">
                  <span className="text-[#9E9E9F]">Captured Date:</span>
                  <span className="font-mono text-white">
                    {selectedSettlementRecord.createdAt ? new Date(selectedSettlementRecord.createdAt).toLocaleString("en-IN") : "—"}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-[#9E9E9F]">Destination Bank:</span>
                  <span className="font-mono font-semibold text-[#FE760B]">
                    {summary?.destinationAccount?.maskedNumber || "HDFC Bank •••• 4092"}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedSettlementRecord(null)}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#212327] hover:bg-[#2A2D31] text-[#D0D0D1] hover:text-white transition-colors cursor-pointer text-center font-semibold text-xs sm:text-sm"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const rec = selectedSettlementRecord;
                    setSelectedSettlementRecord(null);
                    handleOpenSupportForRecord(rec);
                  }}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#FE760B] hover:bg-[#FF8A2B] text-black font-bold transition-all cursor-pointer shadow-lg shadow-[#FE760B]/20 text-center text-xs sm:text-sm flex items-center justify-center gap-1.5"
                >
                  <LifeBuoy size={14} />
                  <span>Raise Support Ticket</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Event Payout Breakdown Modal (PART 6) ── */}
      {selectedPayout && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto">
          <div className="w-full max-w-lg bg-[#17191C] border border-[#2A2D31] rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col text-white animate-scale-in text-xs space-y-4">
            {/* Header */}
            <div className="p-4 sm:p-5 bg-[#1A1C1F] border-b border-[#2A2D31] flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[#FE760B]/12 border border-[#FE760B]/25 flex items-center justify-center text-[#FE760B] shrink-0">
                  <Wallet size={18} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-white truncate">
                    Event Settlement & UPI Payout Details
                  </h3>
                  <p className="text-[11px] text-[#9E9E9F] font-mono truncate">
                    {selectedPayout.payoutRef} &bull; {selectedPayout.eventTitle}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPayout(null)}
                className="p-2 rounded-lg text-[#9E9E9F] hover:text-white hover:bg-[#212327] transition-colors shrink-0 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto">
              {/* Status Banner */}
              <div className="p-3.5 rounded-xl bg-[#212327] border border-[#2A2D31] flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-[#9E9E9F] uppercase font-bold block">Settlement Status</span>
                  <div className="mt-1">{getStatusBadge(selectedPayout.status)}</div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-[#9E9E9F] uppercase font-bold block">Payment Timeline</span>
                  <span className="text-xs font-semibold text-white">
                    {selectedPayout.paidAt
                      ? `Paid on ${new Date(selectedPayout.paidAt).toLocaleDateString("en-IN")}`
                      : selectedPayout.dueDateFormatted || "T+4 Working Days"}
                  </span>
                </div>
              </div>

              {/* Financial Math */}
              <div className="p-3.5 rounded-xl bg-[#212327] border border-[#2A2D31] space-y-2">
                <span className="text-[10px] text-[#9E9E9F] uppercase font-bold block text-[#FE760B]">Financial Breakdown</span>
                <div className="space-y-1.5 pt-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[#9E9E9F]">Gross Ticket Revenue:</span>
                    <span className="font-mono text-white font-semibold">
                      ₹{(selectedPayout.grossAmountPaise / 100).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-amber-400">
                    <span>TicketLelo Platform Fee:</span>
                    <span className="font-mono">
                      - ₹{(selectedPayout.platformFeePaise / 100).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-amber-400">
                    <span>Razorpay Processing Fee (2.36%):</span>
                    <span className="font-mono">
                      - ₹{(selectedPayout.razorpayFeePaise / 100).toFixed(2)}
                    </span>
                  </div>
                  {selectedPayout.refundsPaise > 0 && (
                    <div className="flex items-center justify-between text-rose-400">
                      <span>Refunds & Adjustments:</span>
                      <span className="font-mono">
                        - ₹{(selectedPayout.refundsPaise / 100).toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="border-t border-[#2A2D31] pt-2 flex items-center justify-between font-bold text-sm">
                    <span className="text-white">Net Organizer Payable:</span>
                    <span className="font-mono text-emerald-400 text-base">
                      ₹{(selectedPayout.netOrganizerPaise / 100).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Destination Payout Profile */}
              <div className="p-3.5 rounded-xl bg-[#212327] border border-[#2A2D31] space-y-2">
                <span className="text-[10px] text-[#9E9E9F] uppercase font-bold block text-[#FE760B]">Destination Account</span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-[#9E9E9F] block">Payee UPI ID:</span>
                    <span className="font-mono text-white font-bold">{selectedPayout.upiId || "Pending Setup"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#9E9E9F] block">Receiving Bank:</span>
                    <span className="text-white font-medium">{selectedPayout.bankName || "SBI"}</span>
                  </div>
                </div>
              </div>

              {/* UTR Confirmation if Paid */}
              {selectedPayout.utr && (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs space-y-1">
                  <span className="text-[10px] text-emerald-400 uppercase font-bold block">UPI Transaction Reference</span>
                  <div className="font-mono font-black text-sm text-white">{selectedPayout.utr}</div>
                  <p className="text-[10px] text-emerald-300">
                    Confirmed by TicketLelo Finance. Funds transferred directly to your UPI ID.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-[#1A1C1F] border-t border-[#2A2D31] flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedPayout(null)}
                className="px-4 py-2 rounded-xl bg-[#212327] text-white border border-[#2A2D31] text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reusable Support Ticket Modal ── */}
      <SupportTicketModal
        isOpen={supportModalOpen}
        onClose={() => setSupportModalOpen(false)}
        initialData={supportInitialData}
      />
    </div>
  );
}
