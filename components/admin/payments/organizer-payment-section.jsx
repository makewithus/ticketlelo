"use client";

import { useState, useEffect } from "react";
import {
  Wallet,
  ArrowUpRight,
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
  ExternalLink
} from "lucide-react";

export function OrganizerPaymentSection({ organizerId = null, eventId = null }) {
  const [account, setAccount] = useState(null);
  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);

  // Onboarding Modal state
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    legalBusinessName: "",
    businessType: "individual",
    email: "",
    phone: ""
  });

  // Table filter
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  const fetchData = async (sync = false, showLoading = false) => {
    try {
      if (sync) setSyncing(true);
      if (showLoading) setLoading(true);
      setError(null);

      // 1. Fetch connected account status
      const accUrl = `/api/payments/onboarding?${organizerId ? `organizerId=${organizerId}&` : ""}${sync ? "sync=true" : ""}`;
      const accRes = await fetch(accUrl);
      const accData = await accRes.json();
      if (accRes.ok && accData.account) {
        setAccount(accData.account);
      } else {
        setAccount(null);
      }

      // 2. Fetch financial rollup summary & transactions
      const sumUrl = `/api/payments/summary?${organizerId ? `organizerId=${organizerId}&` : ""}${eventId ? `eventId=${eventId}` : ""}`;
      const sumRes = await fetch(sumUrl);
      const sumData = await sumRes.json();
      if (sumRes.ok) {
        setSummary(sumData.summary || null);
        setTransactions(sumData.transactions || []);
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
    let isMounted = true;
    (async () => {
      try {
        const [accRes, sumRes] = await Promise.all([
          fetch(`/api/payments/onboarding?${organizerId ? `organizerId=${organizerId}` : ""}`),
          fetch(`/api/payments/summary?${organizerId ? `organizerId=${organizerId}&` : ""}${eventId ? `eventId=${eventId}` : ""}`)
        ]);

        if (isMounted && accRes.ok) {
          const accData = await accRes.json();
          setAccount(accData.account || null);
        }
        if (isMounted && sumRes.ok) {
          const sumData = await sumRes.json();
          setSummary(sumData.summary || null);
          setTransactions(sumData.transactions || []);
        }
      } catch (err) {
        console.error("[OrganizerPaymentSection] init error:", err);
        if (isMounted) setError("Failed to load payment records.");
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [organizerId, eventId]);

  const handleOnboardSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/payments/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizerId,
          legalBusinessName: formData.legalBusinessName,
          businessType: formData.businessType,
          email: formData.email,
          phone: formData.phone
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to initiate onboarding");
      setShowModal(false);
      await fetchData(true);
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const exportCSV = () => {
    if (transactions.length === 0) return;
    const headers = ["Order ID,Event Title,Attendee,Gross (INR),Platform Fee (INR),Organizer Share (INR),Payment Status,Date"];
    const rows = transactions.map(t => [
      `"${t.orderId}"`,
      `"${t.eventTitle || ""}"`,
      `"${t.buyerName} <${t.buyerEmail}>"`,
      (t.grossPaise / 100).toFixed(2),
      (t.platformFeePaise / 100).toFixed(2),
      (t.organizerSharePaise / 100).toFixed(2),
      `"${t.paymentStatus}"`,
      `"${t.createdAt || ""}"`
    ].join(","));

    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ticketlelo_payouts_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "ACTIVE":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold">
            <CheckCircle2 size={13} /> Active & Verified
          </span>
        );
      case "UNDER_REVIEW":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-semibold">
            <Clock size={13} /> Under Review (KYC)
          </span>
        );
      case "RESTRICTED":
      case "SUSPENDED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-semibold">
            <ShieldAlert size={13} /> Account Restricted
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/20 text-xs font-semibold">
            <AlertCircle size={13} /> Action Required
          </span>
        );
    }
  };

  const filteredTransactions = transactions.filter(t => {
    const matchesStatus = statusFilter === "ALL" || t.paymentStatus?.toUpperCase() === statusFilter;
    const matchesSearch = !searchTerm ||
      t.orderId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.buyerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.buyerEmail?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* ── 1. Connected Account Onboarding & KYC Card ── */}
      <div className="p-6 rounded-2xl bg-[#1A1C1F] border border-[#2A2D31] shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FE760B]/10 border border-[#FE760B]/20 flex items-center justify-center text-[#FE760B]">
                <Building2 size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  Marketplace Payment Account
                  {account && getStatusBadge(account.verificationStatus)}
                </h3>
                <p className="text-xs text-[#9E9E9F]">
                  Razorpay Route linked account for automated ticket revenue settlements and platform commission splits.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {!account || account.verificationStatus === "NOT_CONNECTED" ? (
              <button
                onClick={() => setShowModal(true)}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#FE760B] to-[#FF9037] hover:brightness-110 text-white text-xs font-bold shadow-lg shadow-[#FE760B]/20 transition-all flex items-center gap-2"
              >
                <Wallet size={15} />
                Connect Payment Account
              </button>
            ) : account.verificationStatus === "ACTIVE" ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#212327] border border-[#2A2D31] text-xs text-[#D0D0D1]">
                <span className="text-[#9E9E9F]">Linked ID:</span>
                <code className="text-[#FE760B] font-mono text-[11px]">{account.providerAccountId}</code>
              </div>
            ) : (
              <button
                onClick={() => setShowModal(true)}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold transition-all flex items-center gap-2"
              >
                Update Verification Details
              </button>
            )}
          </div>
        </div>

        {/* Account Details & Capabilities Ribbon */}
        {account && (
          <div className="mt-4 pt-4 border-t border-[#2A2D31] grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-[#9E9E9F] block">Legal Entity:</span>
              <span className="text-white font-medium">{account.legalBusinessName || "Individual"}</span>
            </div>
            <div>
              <span className="text-[#9E9E9F] block">Business Type:</span>
              <span className="text-white font-medium capitalize">{account.businessType || "individual"}</span>
            </div>
            <div>
              <span className="text-[#9E9E9F] block">Transfers Capability:</span>
              <span className={account.capabilities?.transfers === "active" || account.verificationStatus === "ACTIVE" ? "text-emerald-400 font-semibold" : "text-amber-400 font-semibold"}>
                {account.capabilities?.transfers === "active" || account.verificationStatus === "ACTIVE" ? "Active" : "Pending"}
              </span>
            </div>
            <div>
              <span className="text-[#9E9E9F] block">Settlement Status:</span>
              <span className={account.settlementEligibility ? "text-emerald-400 font-semibold" : "text-amber-400 font-semibold"}>
                {account.settlementEligibility ? "Settlement Eligible" : "Verification Required"}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── 2. Financial Metrics Rollup Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-[#1A1C1F] border border-[#2A2D31] shadow-lg">
          <div className="flex items-center justify-between text-[#9E9E9F] mb-2 text-xs font-medium">
            <span>Gross Ticket Sales</span>
            <DollarSign size={16} className="text-[#FE760B]" />
          </div>
          <div className="text-2xl font-black text-white">
            ₹{summary ? (summary.grossSalesPaise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "0.00"}
          </div>
          <p className="text-[11px] text-[#9E9E9F] mt-1">Total revenue processed from attendee checkouts</p>
        </div>

        <div className="p-5 rounded-2xl bg-[#1A1C1F] border border-[#2A2D31] shadow-lg">
          <div className="flex items-center justify-between text-[#9E9E9F] mb-2 text-xs font-medium">
            <span>Organizer Net Share</span>
            <TrendingUp size={16} className="text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400">
            ₹{summary ? (summary.organizerNetPaise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "0.00"}
          </div>
          <p className="text-[11px] text-[#9E9E9F] mt-1">Net earnings routed to your verified account</p>
        </div>

        <div className="p-5 rounded-2xl bg-[#1A1C1F] border border-[#2A2D31] shadow-lg">
          <div className="flex items-center justify-between text-[#9E9E9F] mb-2 text-xs font-medium">
            <span>Platform Commission</span>
            <Receipt size={16} className="text-amber-400" />
          </div>
          <div className="text-2xl font-black text-white">
            ₹{summary ? (summary.platformCommissionPaise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "0.00"}
          </div>
          <p className="text-[11px] text-[#9E9E9F] mt-1">TicketLelo marketplace service fees</p>
        </div>

        <div className="p-5 rounded-2xl bg-[#1A1C1F] border border-[#2A2D31] shadow-lg">
          <div className="flex items-center justify-between text-[#9E9E9F] mb-2 text-xs font-medium">
            <span>Refunded Amount</span>
            <XCircle size={16} className="text-rose-400" />
          </div>
          <div className="text-2xl font-black text-rose-400">
            ₹{summary ? (summary.refundedPaise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "0.00"}
          </div>
          <p className="text-[11px] text-[#9E9E9F] mt-1">Refunded ticket values & transfer reversals</p>
        </div>
      </div>

      {/* ── 3. Transaction History Table ── */}
      <div className="p-6 rounded-2xl bg-[#1A1C1F] border border-[#2A2D31] shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-white">Transaction History</h3>
            <p className="text-xs text-[#9E9E9F]">Itemized order splits and settlement statuses</p>
          </div>

          <div className="flex items-center gap-2.5">
            <input
              type="text"
              placeholder="Search by order ID or attendee..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-[#212327] border border-[#2A2D31] text-xs text-white placeholder-[#9E9E9F] focus:outline-none focus:border-[#FE760B] transition-colors w-48 sm:w-64"
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-[#212327] border border-[#2A2D31] text-xs text-white focus:outline-none focus:border-[#FE760B]"
            >
              <option value="ALL">All Statuses</option>
              <option value="CAPTURED">Captured</option>
              <option value="SUCCESS">Success</option>
              <option value="PENDING">Pending</option>
              <option value="REFUNDED">Refunded</option>
            </select>

            <button
              onClick={exportCSV}
              disabled={transactions.length === 0}
              className="px-3.5 py-1.5 rounded-xl bg-[#212327] hover:bg-[#2A2D31] border border-[#2A2D31] text-xs font-semibold text-[#D0D0D1] hover:text-white transition-colors flex items-center gap-1.5"
            >
              <Download size={14} />
              CSV
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#2A2D31] text-[#9E9E9F]">
                <th className="pb-3 font-semibold">Order / Reference</th>
                <th className="pb-3 font-semibold">Attendee</th>
                <th className="pb-3 font-semibold">Ticket Type</th>
                <th className="pb-3 font-semibold text-right">Gross (INR)</th>
                <th className="pb-3 font-semibold text-right">Platform Fee</th>
                <th className="pb-3 font-semibold text-right">Organizer Share</th>
                <th className="pb-3 font-semibold text-center">Status</th>
                <th className="pb-3 font-semibold text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2A2D31]/50 text-white">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[#9E9E9F]">
                    Loading transactions...
                  </td>
                </tr>
              ) : filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[#9E9E9F]">
                    No transactions match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map(tx => (
                  <tr key={tx.id} className="hover:bg-[#212327]/40 transition-colors">
                    <td className="py-3 font-mono text-[11px] text-[#FE760B]">
                      {tx.orderId}
                    </td>
                    <td className="py-3">
                      <div className="font-medium text-white">{tx.buyerName}</div>
                      <div className="text-[11px] text-[#9E9E9F]">{tx.buyerEmail}</div>
                    </td>
                    <td className="py-3 text-[#D0D0D1]">
                      {tx.ticketTitle} (x{tx.quantity})
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
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        tx.paymentStatus === "CAPTURED" || tx.paymentStatus === "paid" || tx.paymentStatus === "success"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : tx.paymentStatus === "REFUNDED"
                          ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      }`}>
                        {tx.paymentStatus}
                      </span>
                    </td>
                    <td className="py-3 text-right text-[#9E9E9F]">
                      {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString("en-IN") : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 4. Onboarding Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#2A2D31]">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Building2 size={18} className="text-[#FE760B]" />
                Connect Razorpay Route Account
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-[#9E9E9F] hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleOnboardSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-[#9E9E9F] font-semibold mb-1">Legal Business / Individual Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Events Pvt Ltd or Full Name"
                  value={formData.legalBusinessName}
                  onChange={(e) => setFormData({ ...formData, legalBusinessName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#212327] border border-[#2A2D31] text-white focus:outline-none focus:border-[#FE760B]"
                />
              </div>

              <div>
                <label className="block text-[#9E9E9F] font-semibold mb-1">Business Constitution *</label>
                <select
                  value={formData.businessType}
                  onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#212327] border border-[#2A2D31] text-white focus:outline-none focus:border-[#FE760B]"
                >
                  <option value="individual">Individual / Proprietorship</option>
                  <option value="partnership">Partnership</option>
                  <option value="private_limited">Private Limited</option>
                  <option value="public_limited">Public Limited</option>
                  <option value="llp">Limited Liability Partnership (LLP)</option>
                  <option value="ngo">NGO / Trust / Society</option>
                </select>
              </div>

              <div>
                <label className="block text-[#9E9E9F] font-semibold mb-1">Business Email *</label>
                <input
                  type="email"
                  required
                  placeholder="organizer@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#212327] border border-[#2A2D31] text-white focus:outline-none focus:border-[#FE760B]"
                />
              </div>

              <div>
                <label className="block text-[#9E9E9F] font-semibold mb-1">Contact Phone Number</label>
                <input
                  type="tel"
                  placeholder="e.g. 9876543210"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#212327] border border-[#2A2D31] text-white focus:outline-none focus:border-[#FE760B]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#212327] text-[#D0D0D1] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-[#FE760B] hover:brightness-110 text-white font-bold transition-all disabled:opacity-50"
                >
                  {submitting ? "Initiating..." : "Start Onboarding"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
