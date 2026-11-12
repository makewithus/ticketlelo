"use client";

import { useState, useEffect, useMemo, useSyncExternalStore } from "react";
import {
  MessageSquare,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Lock,
  Send,
  User,
  Building2,
  Phone,
  Mail,
  Receipt,
  RotateCcw,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Shield,
  FileText,
  AlertCircle,
  Paperclip,
  Check,
  PauseCircle,
  PlayCircle,
  LifeBuoy,
  X,
  Copy,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { BrandLoader } from "@/components/ui/brand-loader";
import { SuperAdminTableSkeleton } from "@/components/ui/skeleton";
import { getCachedItem, setCachedItem } from "@/lib/client-cache";
import { StyledDropdown } from "@/components/ui/styled-dropdown";
import {
  SUPPORT_CATEGORIES,
  SUPPORT_STATUSES,
  SUPPORT_STATUS_LIST,
  SUPPORT_PRIORITIES,
  SUPPORT_PRIORITY_LIST,
} from "@/lib/support/types";

const CATEGORY_LABELS = {
  EVENT_CREATION: "Event Creation & Setup",
  REGISTRATION_ATTENDEE: "Registration & Attendee Flow",
  PAYMENT_CHECKOUT: "Payment & Checkout",
  TICKET_QR_SCANNING: "Ticket & QR Scanning",
  SETTLEMENT_PAYOUT: "Settlement & Payout",
  ACCOUNT_PROFILE: "Account & Profile",
  TECHNICAL_BUG: "Technical Bug / Defect",
  BILLING_SUBSCRIPTION: "Billing & Subscription",
  GENERAL_INQUIRY: "General Inquiry",
  "Payments and Razorpay": "Payments and Razorpay",
  "Settlements and Payouts": "Settlements and Payouts",
  "Refunds and Cancellations": "Refunds and Cancellations",
  "Event Management": "Event Management",
  "Registrations and Ticketing": "Registrations and Ticketing",
  "QR Check-in": "QR Check-in",
  "Account and Verification": "Account and Verification",
  "Technical Issues": "Technical Issues",
  "Other": "Other",
};

const STATUS_CONFIG = {
  OPEN: { label: "Open", color: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  IN_PROGRESS: { label: "In Progress", color: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
  WAITING_FOR_ORGANIZER: { label: "Waiting for Organizer", color: "bg-purple-500/10 text-purple-400 border-purple-500/30" },
  RESOLVED: { label: "Resolved", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  CLOSED: { label: "Closed", color: "bg-slate-500/10 text-slate-400 border-slate-500/30" },
};

const PRIORITY_CONFIG = {
  LOW: { label: "Low", color: "text-slate-400 border-slate-700" },
  MEDIUM: { label: "Medium", color: "text-blue-400 border-blue-800" },
  HIGH: { label: "High", color: "text-amber-400 border-amber-800" },
  URGENT: { label: "Urgent", color: "text-rose-400 border-rose-800 font-bold" },
};

export function SuperAdminSupportView() {
  // Instant 0ms cache-first hydration
  const [tickets, setTickets] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        return getCachedItem("superadmin_support_tickets") || [];
      } catch {}
    }
    return [];
  });
  const [loading, setLoading] = useState(() => tickets.length === 0);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [ticketDetails, setTicketDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");

  // Reply Composer State
  const [replyText, setReplyText] = useState("");
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  // Settlement Actions state
  const [settlementActionLoading, setSettlementActionLoading] = useState(false);
  const [holdReason, setHoldReason] = useState("");
  const [showHoldModal, setShowHoldModal] = useState(false);

  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const fetchTickets = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (categoryFilter !== "ALL") params.set("category", categoryFilter);
      if (priorityFilter !== "ALL") params.set("priority", priorityFilter);

      const res = await fetch(`/api/support/tickets?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load support tickets");
      const data = await res.json();
      setTickets(data.tickets || []);
      setCachedItem("superadmin_support_tickets", data.tickets || [], 5 * 60 * 1000);
      if (isManual) toast.success("Support tickets refreshed");
    } catch (err) {
      console.error("[SuperAdminSupport] fetch error:", err);
      toast.error(err.message || "Failed to load support tickets");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [statusFilter, categoryFilter, priorityFilter]);

  const fetchTicketDetails = async (ticketId) => {
    setLoadingDetails(true);
    try {
      const res = await fetch(`/api/support/tickets/${ticketId}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load ticket details");
      const data = await res.json();
      setTicketDetails(data.ticket);
    } catch (err) {
      toast.error(err.message || "Could not load ticket details");
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleSelectTicket = (tkt) => {
    setSelectedTicket(tkt);
    fetchTicketDetails(tkt.id);
  };

  const handleStatusChange = async (newStatus) => {
    if (!ticketDetails) return;
    try {
      const res = await fetch(`/api/support/tickets/${ticketDetails.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update status");
      toast.success(`Ticket marked as ${newStatus}`);
      setTicketDetails((prev) => ({ ...prev, status: newStatus }));
      fetchTickets();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handlePriorityChange = async (newPriority) => {
    if (!ticketDetails) return;
    try {
      const res = await fetch(`/api/support/tickets/${ticketDetails.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority: newPriority }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update priority");
      toast.success(`Priority updated to ${newPriority}`);
      setTicketDetails((prev) => ({ ...prev, priority: newPriority }));
      fetchTickets();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleSendReply = async (andStatus = null) => {
    if (!ticketDetails || !replyText.trim()) {
      toast.error("Please enter a response message");
      return;
    }
    setSendingReply(true);
    try {
      const attachments = attachmentUrl.trim()
        ? [{ url: attachmentUrl.trim(), name: "Attachment" }]
        : [];

      const res = await fetch(`/api/support/tickets/${ticketDetails.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: replyText.trim(),
          isInternalNote,
          attachments,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send message");

      toast.success(
        isInternalNote
          ? "Internal note saved (only visible to Super Admin)"
          : "Reply sent to organizer and email notification queued"
      );

      setReplyText("");
      setAttachmentUrl("");

      if (andStatus) {
        await handleStatusChange(andStatus);
      } else {
        await fetchTicketDetails(ticketDetails.id);
        fetchTickets();
      }
    } catch (err) {
      toast.error(err.message || "Failed to send message");
    } finally {
      setSendingReply(false);
    }
  };

  // Settlement Actions linked directly to ticket
  const handleHoldSettlement = async () => {
    if (!ticketDetails?.financialRecord?.settlementId) return;
    if (!holdReason.trim()) {
      toast.error("Please provide a reason for holding the settlement");
      return;
    }
    setSettlementActionLoading(true);
    try {
      const res = await fetch("/api/superadmin/settlements/hold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settlementId: ticketDetails.financialRecord.settlementId,
          action: "hold",
          reason: holdReason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to hold settlement");
      toast.success("Settlement placed on administrative hold");
      setShowHoldModal(false);
      setHoldReason("");
      fetchTicketDetails(ticketDetails.id);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSettlementActionLoading(false);
    }
  };

  const handleReleaseSettlement = async () => {
    if (!ticketDetails?.financialRecord?.settlementId) return;
    setSettlementActionLoading(true);
    try {
      const res = await fetch("/api/superadmin/settlements/hold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settlementId: ticketDetails.financialRecord.settlementId,
          action: "release",
          reason: "Hold released by Super Admin via ticket resolution",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to release settlement");
      toast.success("Settlement hold released successfully");
      fetchTicketDetails(ticketDetails.id);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSettlementActionLoading(false);
    }
  };

  const handleRetrySettlement = async () => {
    if (!ticketDetails?.financialRecord?.settlementId) return;
    setSettlementActionLoading(true);
    try {
      const res = await fetch("/api/superadmin/settlements/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settlementId: ticketDetails.financialRecord.settlementId,
          reason: "Manual retry triggered from support ticket",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to retry settlement");
      toast.success("Settlement reset to SCHEDULED for next batch run");
      fetchTicketDetails(ticketDetails.id);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSettlementActionLoading(false);
    }
  };

  // Filtered tickets based on search query
  const filteredTickets = useMemo(() => {
    if (!searchQuery.trim()) return tickets;
    const q = searchQuery.toLowerCase().trim();
    return tickets.filter((t) => {
      return (
        (t.ticketId || "").toLowerCase().includes(q) ||
        (t.subject || "").toLowerCase().includes(q) ||
        (t.organizerName || "").toLowerCase().includes(q) ||
        (t.organizerEmail || "").toLowerCase().includes(q) ||
        (t.organizerPhone || "").toLowerCase().includes(q)
      );
    });
  }, [tickets, searchQuery]);

  // Metric counts
  const totalTicketsCount = tickets.length;
  const activeTicketsCount = useMemo(
    () => tickets.filter((t) => t.status === "OPEN" || t.status === "IN_PROGRESS").length,
    [tickets]
  );
  const waitingTicketsCount = useMemo(
    () => tickets.filter((t) => t.status === "WAITING_FOR_ORGANIZER").length,
    [tickets]
  );
  const resolvedTicketsCount = useMemo(
    () => tickets.filter((t) => t.status === "RESOLVED" || t.status === "CLOSED").length,
    [tickets]
  );

  const hasActiveFilters =
    statusFilter !== "ALL" ||
    categoryFilter !== "ALL" ||
    priorityFilter !== "ALL" ||
    Boolean(searchQuery.trim());

  const handleResetFilters = () => {
    setStatusFilter("ALL");
    setCategoryFilter("ALL");
    setPriorityFilter("ALL");
    setSearchQuery("");
  };

  const handleCopyText = (text, label) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  if (loading && tickets.length === 0) {
    return <SuperAdminTableSkeleton />;
  }

  return (
    <div className="space-y-6 text-[#1E293B] dark:text-white">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Super Admin Support Center</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FE760B]/10 text-[#FE760B] border border-[#FE760B]/30">
              Live Queue
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-[#9B9EA4] mt-1">
            Resolve organizer technical inquiries, manage settlement hold disputes, and communicate securely.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchTickets(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#2A2D31] hover:bg-slate-100 dark:hover:bg-[#212327] text-slate-700 dark:text-[#D0D0D1] hover:text-[#FE760B] transition-all cursor-pointer disabled:opacity-50 text-xs font-semibold"
            title="Refresh tickets"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin text-[#FE760B]" : ""} />
            <span>{refreshing ? "Refreshing..." : "Refresh Queue"}</span>
          </button>
        </div>
      </div>

      {/* ── 4 KPI Metric Summary Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] shadow-xs hover:border-slate-300 dark:hover:border-[#3A3D42] transition-colors">
          <div className="flex items-center justify-between text-slate-500 dark:text-[#9B9EA4] mb-2 text-xs font-medium">
            <span>Total Tickets</span>
            <MessageSquare size={16} className="text-[#FE760B]" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
            {totalTicketsCount}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-[#9B9EA4] mt-1">All organizer inquiries logged</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] shadow-xs hover:border-slate-300 dark:hover:border-[#3A3D42] transition-colors">
          <div className="flex items-center justify-between text-slate-500 dark:text-[#9B9EA4] mb-2 text-xs font-medium">
            <span>Active & In Progress</span>
            <Clock size={16} className="text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-500 font-mono">
            {activeTicketsCount}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-[#9B9EA4] mt-1">Under admin review or investigation</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] shadow-xs hover:border-slate-300 dark:hover:border-[#3A3D42] transition-colors">
          <div className="flex items-center justify-between text-slate-500 dark:text-[#9B9EA4] mb-2 text-xs font-medium">
            <span>Awaiting Organizer</span>
            <User size={16} className="text-purple-400" />
          </div>
          <div className="text-2xl font-black text-purple-400 font-mono">
            {waitingTicketsCount}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-[#9B9EA4] mt-1">Waiting for organizer response</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] shadow-xs hover:border-slate-300 dark:hover:border-[#3A3D42] transition-colors">
          <div className="flex items-center justify-between text-slate-500 dark:text-[#9B9EA4] mb-2 text-xs font-medium">
            <span>Resolved & Closed</span>
            <CheckCircle2 size={16} className="text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-500 font-mono">
            {resolvedTicketsCount}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-[#9B9EA4] mt-1">Successfully resolved cases</p>
        </div>
      </div>

      {/* ── Unified Support Console Workspace (Master Card with Integrated Toolbar & Equal-Height Split) ── */}
      <div className="rounded-2xl bg-white dark:bg-[#17191C] border border-slate-200 dark:border-[#2A2D31] shadow-xl overflow-hidden flex flex-col">
        {/* Integrated Filter & Search Toolbar */}
        <div className="p-3.5 sm:p-4 bg-slate-50 dark:bg-[#1A1C1F] border-b border-slate-200 dark:border-[#2A2D31] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shrink-0">
          {/* Search */}
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by ticket ID (TKT-...), organizer name, email, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-white dark:bg-[#131517] border border-slate-200 dark:border-[#2A2D31] text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#FE760B] focus:ring-1 focus:ring-[#FE760B]/20"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            <StyledDropdown
              icon={Filter}
              label="Status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "ALL", label: "All Statuses" },
                ...(SUPPORT_STATUS_LIST || Object.values(SUPPORT_STATUSES)).map((st) => ({
                  value: st,
                  label: STATUS_CONFIG[st]?.label || st,
                })),
              ]}
              buttonClassName="h-9 rounded-xl bg-white dark:bg-[#131517] border-slate-200 dark:border-[#2A2D31]"
            />

            <StyledDropdown
              icon={Filter}
              label="Category"
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={[
                { value: "ALL", label: "All Categories" },
                ...SUPPORT_CATEGORIES.map((cat) => ({
                  value: cat,
                  label: CATEGORY_LABELS[cat] || cat,
                })),
              ]}
              menuClassName="w-64"
              buttonClassName="h-9 rounded-xl bg-white dark:bg-[#131517] border-slate-200 dark:border-[#2A2D31]"
            />

            <StyledDropdown
              icon={Filter}
              label="Priority"
              value={priorityFilter}
              onChange={setPriorityFilter}
              options={[
                { value: "ALL", label: "All Priorities" },
                ...(SUPPORT_PRIORITY_LIST || Object.values(SUPPORT_PRIORITIES)).map((pri) => ({
                  value: pri,
                  label: pri,
                })),
              ]}
              buttonClassName="h-9 rounded-xl bg-white dark:bg-[#131517] border-slate-200 dark:border-[#2A2D31]"
            />

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-500 dark:text-[#9B9EA4] hover:text-[#FE760B] hover:bg-slate-100 dark:hover:bg-[#212327] transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                title="Reset all filters"
              >
                <RotateCcw size={12} />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Split Workspace: Queue List & Detail Inspector (Unified Height Container) */}
        <div className="flex flex-col lg:flex-row min-h-[580px] lg:h-[680px] overflow-hidden">
          {/* Left Column: Tickets Queue Panel */}
          <div
            className={`w-full lg:w-[380px] xl:w-[420px] shrink-0 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-[#2A2D31] flex flex-col bg-slate-50/30 dark:bg-[#17191C] min-h-0 ${
              selectedTicket ? "hidden lg:flex" : "flex"
            }`}
          >
            {/* Queue Panel Header */}
            <div className="px-4 py-3 bg-slate-100/70 dark:bg-[#1A1C1F]/60 border-b border-slate-200 dark:border-[#2A2D31] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <MessageSquare size={14} className="text-[#FE760B]" />
                <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Ticket Queue
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white dark:bg-[#212327] text-slate-600 dark:text-[#9B9EA4] border border-slate-200 dark:border-[#2A2D31]">
                Showing {filteredTickets.length} of {totalTicketsCount}
              </span>
            </div>

            {/* Queue Panel Scrollable List or Clean Centered Empty State */}
            <div className="flex-1 overflow-y-auto p-2.5 space-y-2 min-h-0">
              {filteredTickets.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#FE760B]/10 border border-[#FE760B]/20 flex items-center justify-center text-[#FE760B]">
                    <MessageSquare size={22} className="animate-pulse" style={{ animationDuration: "3s" }} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">No Support Tickets</h3>
                    <p className="text-xs text-slate-500 dark:text-[#9B9EA4] max-w-xs">
                      {hasActiveFilters
                        ? "No tickets match your active filter criteria."
                        : "No organizer inquiries currently logged in queue."}
                    </p>
                  </div>
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-[#FE760B] bg-[#FE760B]/10 hover:bg-[#FE760B]/20 transition-all cursor-pointer border border-[#FE760B]/20"
                    >
                      <RotateCcw size={12} />
                      <span>Reset Filters</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredTickets.map((tkt) => {
                    const isSelected = selectedTicket?.id === tkt.id;
                    const statusStyle = STATUS_CONFIG[tkt.status] || STATUS_CONFIG.OPEN;
                    const priorityStyle = PRIORITY_CONFIG[tkt.priority] || PRIORITY_CONFIG.MEDIUM;

                    return (
                      <div
                        key={tkt.id}
                        onClick={() => handleSelectTicket(tkt)}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? "bg-[#FE760B]/10 dark:bg-[#FE760B]/10 border-[#FE760B] shadow-sm ring-1 ring-[#FE760B]/30"
                            : "bg-white dark:bg-[#1A1C1F] border-slate-200 dark:border-[#2A2D31] hover:border-slate-300 dark:hover:border-[#3A3D42] hover:bg-slate-50 dark:hover:bg-[#212327]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-black text-[#FE760B]">{tkt.ticketId}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusStyle.color}`}>
                              {statusStyle.label}
                            </span>
                          </div>
                          <span className={`text-[10px] font-bold uppercase ${priorityStyle.color}`}>
                            {tkt.priority}
                          </span>
                        </div>

                        <h3 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1 mb-1">
                          {tkt.subject}
                        </h3>

                        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-[#9B9EA4]">
                          <div className="flex items-center gap-1.5 truncate max-w-[200px]">
                            <User size={11} />
                            <span className="truncate">{tkt.organizerName || tkt.organizerEmail}</span>
                          </div>
                          <span className="text-[10px] truncate max-w-[120px]">
                            {CATEGORY_LABELS[tkt.category] || tkt.category}
                          </span>
                        </div>

                        {tkt.financialRecord && (
                          <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-[#2A2D31] flex items-center justify-between text-[10px] text-amber-500 font-medium">
                            <div className="flex items-center gap-1.5 truncate max-w-[220px]">
                              <Receipt size={11} className="shrink-0" />
                              <span className="truncate font-mono">Linked: {tkt.financialRecord.orderId || tkt.financialRecord.settlementId}</span>
                            </div>
                            {tkt.financialRecord.amountPaise && (
                              <span className="font-mono font-bold text-amber-400">
                                ₹{(tkt.financialRecord.amountPaise / 100).toFixed(2)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Ticket Conversation & Management Pane */}
          <div
            className={`flex-1 flex flex-col bg-slate-50/50 dark:bg-[#131517] overflow-hidden min-h-0 ${
              !selectedTicket ? "hidden lg:flex" : "flex"
            }`}
          >
            {!selectedTicket ? (
              <div className="h-full flex flex-col items-center justify-center p-8 sm:p-12 text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-[#FE760B]/10 border border-[#FE760B]/20 flex items-center justify-center text-[#FE760B]">
                  <LifeBuoy size={32} />
                </div>
                <div className="space-y-1.5 max-w-md">
                  <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Select a Support Ticket to Manage
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-[#9B9EA4] leading-relaxed">
                    Choose an inquiry from the queue on the left to inspect organizer details, post staff notes, send official replies, or manage settlement holds.
                  </p>
                </div>

                {/* Workflow Feature Guidance Pills to Create a Balanced, Intentional Layout */}
                <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-2.5 max-w-lg w-full text-left">
                  <div className="p-3 rounded-xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] text-[11px] space-y-1">
                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Mail size={12} className="text-[#FE760B]" />
                      <span>Instant Replies</span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-[#9B9EA4]">
                      Replies email the organizer immediately with full thread context.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] text-[11px] space-y-1">
                    <div className="font-bold text-amber-500 flex items-center gap-1.5">
                      <Lock size={12} className="text-amber-500" />
                      <span>Private Notes</span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-[#9B9EA4]">
                      Staff internal observations remain completely hidden from organizers.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] text-[11px] space-y-1">
                    <div className="font-bold text-emerald-500 flex items-center gap-1.5">
                      <Shield size={12} className="text-emerald-500" />
                      <span>Settlement Holds</span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-[#9B9EA4]">
                      Directly halt or release T+4 batch payouts for linked records.
                    </p>
                  </div>
                </div>
              </div>
            ) : loadingDetails ? (
              <div className="h-full flex items-center justify-center p-12">
                <BrandLoader message="Fetching ticket messages & history..." />
              </div>
            ) : ticketDetails ? (
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                {/* Ticket Detail Header */}
                <div className="p-4 sm:p-5 bg-white dark:bg-[#17191C] border-b border-slate-200 dark:border-[#2A2D31] shrink-0 space-y-3">
                  {/* Mobile Back Button */}
                  <div className="lg:hidden">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTicket(null);
                        setTicketDetails(null);
                      }}
                      className="inline-flex items-center gap-1.5 text-xs text-[#FE760B] font-bold hover:underline cursor-pointer"
                    >
                      <ArrowLeft size={14} />
                      <span>Back to Ticket Queue</span>
                    </button>
                  </div>

                  {/* Header Row: Subject, ID, and Dropdown Selectors */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs sm:text-sm font-black text-[#FE760B]">{ticketDetails.ticketId}</span>
                        <span className="text-xs font-semibold text-slate-400">•</span>
                        <span className="text-xs font-semibold text-slate-400 truncate">
                          {CATEGORY_LABELS[ticketDetails.category] || ticketDetails.category}
                        </span>
                      </div>
                      <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white mt-0.5 truncate">
                        {ticketDetails.subject}
                      </h2>
                    </div>

                    {/* Status & Priority Selectors */}
                    <div className="flex items-center gap-2 shrink-0">
                      <StyledDropdown
                        label="Status"
                        value={ticketDetails.status}
                        onChange={handleStatusChange}
                        options={(SUPPORT_STATUS_LIST || Object.values(SUPPORT_STATUSES)).map((st) => ({
                          value: st,
                          label: STATUS_CONFIG[st]?.label || st,
                        }))}
                        buttonClassName="h-8 rounded-xl bg-slate-50 dark:bg-[#131517] border-slate-200 dark:border-[#2A2D31] text-xs font-bold"
                      />

                      <StyledDropdown
                        label="Priority"
                        value={ticketDetails.priority}
                        onChange={handlePriorityChange}
                        options={(SUPPORT_PRIORITY_LIST || Object.values(SUPPORT_PRIORITIES)).map((pri) => ({
                          value: pri,
                          label: pri,
                        }))}
                        buttonClassName="h-8 rounded-xl bg-slate-50 dark:bg-[#131517] border-slate-200 dark:border-[#2A2D31] text-xs font-bold"
                      />
                    </div>
                  </div>

                  {/* Organizer Contact Summary Card */}
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#131517] border border-slate-200 dark:border-[#2A2D31] grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                    <div className="flex items-center gap-2 text-slate-600 dark:text-[#9B9EA4] truncate">
                      <User size={13} className="text-[#FE760B] shrink-0" />
                      <span className="font-semibold text-slate-900 dark:text-white truncate">
                        {ticketDetails.organizerName || "Organizer"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-1 text-slate-600 dark:text-[#9B9EA4] truncate">
                      <div className="flex items-center gap-2 truncate">
                        <Mail size={13} className="text-[#FE760B] shrink-0" />
                        <span className="truncate">{ticketDetails.organizerEmail}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyText(ticketDetails.organizerEmail, "Email")}
                        className="p-1 hover:text-white text-slate-400 cursor-pointer shrink-0"
                        title="Copy email"
                      >
                        <Copy size={11} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-1 text-slate-600 dark:text-[#9B9EA4] truncate">
                      <div className="flex items-center gap-2 truncate">
                        <Phone size={13} className="text-[#FE760B] shrink-0" />
                        <span className="truncate">{ticketDetails.organizerPhone || "No Phone"}</span>
                      </div>
                      {ticketDetails.organizerPhone && (
                        <button
                          type="button"
                          onClick={() => handleCopyText(ticketDetails.organizerPhone, "Phone")}
                          className="p-1 hover:text-white text-slate-400 cursor-pointer shrink-0"
                          title="Copy phone"
                        >
                          <Copy size={11} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Linked Financial Record Banner (if any) */}
                  {ticketDetails.financialRecord && (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-bold text-amber-500">
                          <Receipt size={14} />
                          <span>Linked Financial Transaction</span>
                        </div>
                        {ticketDetails.financialRecord.amountPaise && (
                          <span className="font-mono font-bold text-amber-400">
                            ₹{(ticketDetails.financialRecord.amountPaise / 100).toFixed(2)}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-400">
                        {ticketDetails.financialRecord.orderId && (
                          <div>Order ID: <span className="text-white font-mono">{ticketDetails.financialRecord.orderId}</span></div>
                        )}
                        {ticketDetails.financialRecord.settlementId && (
                          <div>Settlement ID: <span className="text-white font-mono">{ticketDetails.financialRecord.settlementId}</span></div>
                        )}
                      </div>

                      {/* Settlement Action Controls */}
                      {ticketDetails.financialRecord.settlementId && (
                        <div className="flex items-center gap-2 pt-1 border-t border-amber-500/20">
                          <button
                            type="button"
                            onClick={() => setShowHoldModal(true)}
                            disabled={settlementActionLoading}
                            className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <PauseCircle size={12} />
                            <span>Hold Payout</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleReleaseSettlement}
                            disabled={settlementActionLoading}
                            className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-bold text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <PlayCircle size={12} />
                            <span>Release Hold</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleRetrySettlement}
                            disabled={settlementActionLoading}
                            className="px-2.5 py-1 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 font-bold text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <RotateCcw size={12} />
                            <span>Retry Batch</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Message Timeline (Scrollable area) */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 min-h-0">
                  {ticketDetails.messages && ticketDetails.messages.length > 0 ? (
                    ticketDetails.messages.map((msg, idx) => {
                      const isInternal = Boolean(msg.isInternalNote);
                      const isAdmin = msg.senderRole === "superAdmin" || msg.senderRole === "admin";

                      return (
                        <div
                          key={msg.id || idx}
                          className={`p-3.5 rounded-2xl border text-xs space-y-2 ${
                            isInternal
                              ? "bg-amber-500/10 border-amber-500/30 text-amber-200"
                              : isAdmin
                              ? "bg-[#FE760B]/10 border-[#FE760B]/20 text-slate-800 dark:text-slate-200 ml-4 sm:ml-8"
                              : "bg-white dark:bg-[#1A1C1F] border-slate-200 dark:border-[#2A2D31] text-slate-800 dark:text-slate-200 mr-4 sm:mr-8"
                          }`}
                        >
                          <div className="flex items-center justify-between text-[11px]">
                            <div className="flex items-center gap-1.5 font-bold">
                              {isInternal ? (
                                <>
                                  <Lock size={12} className="text-amber-400" />
                                  <span className="text-amber-400">Internal Admin Note</span>
                                  <span className="text-[10px] text-amber-400/70 font-normal">
                                    (Hidden from organizer)
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span>{msg.senderName || (isAdmin ? "Super Admin" : "Organizer")}</span>
                                  <span className="px-1.5 py-0.2 rounded-full text-[9px] uppercase font-bold bg-black/10 dark:bg-white/10">
                                    {msg.senderRole}
                                  </span>
                                </>
                              )}
                            </div>
                            <span className="text-slate-400 text-[10px]">
                              {msg.createdAt ? new Date(msg.createdAt).toLocaleString("en-IN") : ""}
                            </span>
                          </div>

                          <p className="whitespace-pre-wrap leading-relaxed">{msg.message}</p>

                          {msg.attachments && msg.attachments.length > 0 && (
                            <div className="pt-2 border-t border-white/10 flex flex-wrap gap-2">
                              {msg.attachments.map((att, aIdx) => (
                                <a
                                  key={aIdx}
                                  href={att.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center gap-1 px-2 py-1 rounded bg-black/20 text-[10px] text-[#FE760B] hover:underline"
                                >
                                  <Paperclip size={10} />
                                  <span>{att.name || "Attachment"}</span>
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-10 text-center text-xs text-slate-400">
                      No message history found for this inquiry.
                    </div>
                  )}
                </div>

                {/* Reply / Internal Note Composer (Sticky Bottom) */}
                <div className="p-3.5 sm:p-4 border-t border-slate-200 dark:border-[#2A2D31] bg-white dark:bg-[#17191C] shrink-0 space-y-3">
                  {/* Mode Selector Tabs */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsInternalNote(false)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          !isInternalNote
                            ? "bg-[#FE760B] text-white shadow-xs"
                            : "text-slate-500 hover:text-white"
                        }`}
                      >
                        Public Reply (Emails Organizer)
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsInternalNote(true)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                          isInternalNote
                            ? "bg-amber-500 text-black shadow-xs font-extrabold"
                            : "text-slate-500 hover:text-white"
                        }`}
                      >
                        <Lock size={12} />
                        <span>Internal Note (Private)</span>
                      </button>
                    </div>
                  </div>

                  {/* Textarea */}
                  <textarea
                    rows={3}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={
                      isInternalNote
                        ? "Add private staff note about this organizer or settlement hold (hidden from organizer)..."
                        : "Type official reply to organizer. An automated email will be queued immediately..."
                    }
                    className="w-full p-3 rounded-xl bg-slate-50 dark:bg-[#131517] border border-slate-200 dark:border-[#2A2D31] text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#FE760B] resize-none"
                  />

                  {/* Attachment & Action Footer */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 max-w-sm">
                      <Paperclip size={13} className="text-slate-400 shrink-0" />
                      <input
                        type="text"
                        placeholder="Optional attachment URL (image/pdf)..."
                        value={attachmentUrl}
                        onChange={(e) => setAttachmentUrl(e.target.value)}
                        className="w-full px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-[#131517] border border-slate-200 dark:border-[#2A2D31] text-[11px] text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#FE760B]"
                      />
                    </div>

                    <div className="flex items-center gap-2 justify-end">
                      {!isInternalNote && (
                        <button
                          type="button"
                          onClick={() => handleSendReply("RESOLVED")}
                          disabled={sendingReply}
                          className="px-3 py-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                        >
                          Send & Resolve
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleSendReply()}
                        disabled={sendingReply}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                          isInternalNote
                            ? "bg-amber-500 hover:bg-amber-600 text-black font-extrabold"
                            : "bg-[#FE760B] hover:bg-[#FF8A2B] text-white shadow-md shadow-[#FE760B]/20"
                        }`}
                      >
                        <Send size={13} className={sendingReply ? "animate-spin" : ""} />
                        <span>{sendingReply ? "Saving..." : isInternalNote ? "Save Note" : "Send Reply"}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* ── Hold Reason Modal (Polished with Cross Icon & Mobile Responsive) ── */}
      {showHoldModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto">
          <div className="w-full max-w-md sm:max-w-lg bg-[#17191C] border border-[#2A2D31] rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col text-white animate-scale-in">
            {/* Header */}
            <div className="p-4 sm:p-5 bg-[#1A1C1F] border-b border-[#2A2D31] flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-amber-500/12 border border-amber-500/25 flex items-center justify-center text-amber-400 shrink-0">
                  <AlertTriangle size={18} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-white truncate">
                    Place Settlement on Administrative Hold
                  </h3>
                  <p className="text-[11px] sm:text-xs text-[#9E9E9F] truncate">
                    Halt automatic T+4 batch payouts until resolved
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowHoldModal(false)}
                className="p-2 rounded-lg text-[#9E9E9F] hover:text-white hover:bg-[#212327] transition-colors shrink-0 cursor-pointer"
                aria-label="Close Modal"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto text-xs">
              <p className="text-xs text-[#D0D0D1] leading-relaxed">
                Holding this settlement will halt automatic T+4 batch payouts until an administrator verifies the organizer&apos;s account or resolves the inquiry.
              </p>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#D0D0D1]">
                  Reason for Administrative Hold <span className="text-[#FE760B]">*</span>
                </label>
                <textarea
                  rows={3}
                  value={holdReason}
                  onChange={(e) => setHoldReason(e.target.value)}
                  placeholder="Enter reason for administrative hold or audit..."
                  className="w-full p-3 rounded-xl bg-[#212327] border border-[#2A2D31] text-xs text-white placeholder-[#9E9E9F] focus:outline-none focus:border-[#FE760B] transition-all resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 sm:p-5 bg-[#1A1C1F]/60 border-t border-[#2A2D31] flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setShowHoldModal(false)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#212327] hover:bg-[#2A2D31] text-[#D0D0D1] hover:text-white transition-colors cursor-pointer text-center font-semibold text-xs sm:text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleHoldSettlement}
                disabled={settlementActionLoading || !holdReason.trim()}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-bold transition-all disabled:opacity-50 cursor-pointer text-center text-xs sm:text-sm shadow-lg shadow-amber-500/20"
              >
                {settlementActionLoading ? "Placing Hold..." : "Confirm Hold"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
