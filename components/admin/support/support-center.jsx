"use client";

import { useState, useEffect } from "react";
import {
  LifeBuoy,
  Plus,
  Search,
  MessageSquare,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Send,
  FileText,
  User,
  Shield,
  RefreshCw,
  X,
} from "lucide-react";
import { SUPPORT_STATUSES, SUPPORT_CATEGORIES } from "@/lib/support/types";
import { SupportTicketModal } from "./support-ticket-modal";

export function SupportCenter({ initialTicketId = null }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchTickets = async (showLoading = false) => {
    try {
      if (showLoading) setLoading(true);
      const url = `/api/support/tickets?${statusFilter !== "ALL" ? `status=${statusFilter}` : ""}`;
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) {
        setTickets(data.tickets || []);
      }
    } catch (err) {
      console.error("[SupportCenter] fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTicketDetails = async (ticketId) => {
    try {
      setLoadingDetail(true);
      const res = await fetch(`/api/support/tickets/${ticketId}`);
      const data = await res.json();
      if (res.ok && data.ticket) {
        setSelectedTicket(data.ticket);
      }
    } catch (err) {
      console.error("[SupportCenter] fetchDetail error:", err);
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    fetchTickets(true);
  }, [statusFilter]);

  useEffect(() => {
    if (initialTicketId) {
      fetchTicketDetails(initialTicketId);
    }
  }, [initialTicketId]);

  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyContent.trim() || !selectedTicket) return;

    setSendingReply(true);
    try {
      const res = await fetch(`/api/support/tickets/${selectedTicket.ticketId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: replyContent.trim(),
          isInternalNote: false,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to post reply");

      setReplyContent("");
      await fetchTicketDetails(selectedTicket.ticketId);
      await fetchTickets(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setSendingReply(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case SUPPORT_STATUSES.RESOLVED:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-semibold">
            <CheckCircle2 size={12} /> Resolved
          </span>
        );
      case SUPPORT_STATUSES.CLOSED:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/20 text-[11px] font-semibold">
            <XCircle size={12} /> Closed
          </span>
        );
      case SUPPORT_STATUSES.IN_PROGRESS:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[11px] font-semibold">
            <Clock size={12} /> In Progress
          </span>
        );
      case SUPPORT_STATUSES.WAITING_FOR_ORGANIZER:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[11px] font-semibold">
            <AlertCircle size={12} /> Waiting on You
          </span>
        );
      case SUPPORT_STATUSES.OPEN:
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FE760B]/10 text-[#FE760B] border border-[#FE760B]/20 text-[11px] font-semibold">
            <Clock size={12} /> Open
          </span>
        );
    }
  };

  const filteredTickets = tickets.filter((t) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      t.ticketId?.toLowerCase().includes(term) ||
      t.subject?.toLowerCase().includes(term) ||
      t.category?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* ── Top Header & Actions ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#2A2D31]">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2.5">
            <LifeBuoy className="w-5 h-5 text-[#FE760B] shrink-0" />
            <span>Help & Support Center</span>
          </h2>
          <p className="text-xs text-[#9E9E9F] mt-1 max-w-xl leading-relaxed">
            Submit inquiries, track resolution progress, and communicate directly with TicketLelo operations
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto w-full sm:w-auto">
          <button
            type="button"
            onClick={() => fetchTickets(true)}
            className="p-2.5 rounded-xl bg-[#1A1C1F] border border-[#2A2D31] text-[#9E9E9F] hover:text-white transition-colors cursor-pointer shrink-0"
            title="Refresh Tickets"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-[#FE760B] hover:bg-[#FF8A2B] text-black font-bold text-xs transition-all shadow-lg shadow-[#FE760B]/20 flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Plus size={16} />
            <span>Create New Ticket</span>
          </button>
        </div>
      </div>

      {/* ── Tickets List & Filters View ── */}
      <div className="space-y-4 animate-fade-in">
        {/* Filters Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl bg-[#1A1C1F] border border-[#2A2D31]">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 -mx-1 px-1 no-scrollbar">
            {["ALL", "OPEN", "IN_PROGRESS", "WAITING_FOR_ORGANIZER", "RESOLVED", "CLOSED"].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  statusFilter === st
                    ? "bg-[#FE760B] text-black shadow-xs shadow-[#FE760B]/20"
                    : "bg-[#212327] text-[#9E9E9F] hover:text-white"
                }`}
              >
                {st.replace(/_/g, " ")}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64 shrink-0">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9E9E9F]" />
            <input
              type="text"
              placeholder="Search ticket ID or subject..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-2 rounded-xl bg-[#212327] border border-[#2A2D31] text-xs text-white placeholder-[#9E9E9F] focus:outline-none focus:border-[#FE760B] w-full"
            />
          </div>
        </div>

        {/* Tickets View: Mobile Cards (< md) + Desktop Table (>= md) */}
        <div className="rounded-2xl bg-[#1A1C1F] border border-[#2A2D31] shadow-xl overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#2A2D31] text-[#9E9E9F] bg-[#16181B]">
                  <th className="py-3 px-4 font-semibold">Ticket ID</th>
                  <th className="py-3 px-4 font-semibold">Category</th>
                  <th className="py-3 px-4 font-semibold">Subject</th>
                  <th className="py-3 px-4 font-semibold text-center">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Created</th>
                  <th className="py-3 px-4 font-semibold text-right">Messages</th>
                  <th className="py-3 px-4 font-semibold text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A2D31]/50 text-white">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-[#9E9E9F]">
                      Loading support tickets...
                    </td>
                  </tr>
                ) : filteredTickets.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-[#9E9E9F]">
                      No support tickets found. Click &quot;Create New Ticket&quot; above to contact support.
                    </td>
                  </tr>
                ) : (
                  filteredTickets.map((t) => (
                    <tr
                      key={t.ticketId}
                      onClick={() => setSelectedTicket(t)}
                      className="hover:bg-[#212327]/40 transition-colors cursor-pointer"
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-[#FE760B]">
                        #{t.ticketId}
                      </td>
                      <td className="py-3.5 px-4 text-[#D0D0D1]">
                        <span className="px-2 py-0.5 rounded-md bg-[#212327] border border-[#2A2D31] text-[10px]">
                          {t.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 max-w-xs truncate font-medium">
                        {t.subject}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {getStatusBadge(t.status)}
                      </td>
                      <td className="py-3.5 px-4 text-right text-[#9E9E9F]">
                        {new Date(t.createdAt).toLocaleDateString("en-IN")}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-[#D0D0D1]">
                        {t.messageCount || 1}
                      </td>
                      <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setSelectedTicket(t)}
                          className="px-3 py-1.5 rounded-lg bg-[#212327] hover:bg-[#FE760B]/15 text-[#FE760B] border border-[#2A2D31] text-[11px] font-semibold transition-all inline-flex items-center gap-1 cursor-pointer"
                        >
                          <MessageSquare size={12} />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List (< md) */}
          <div className="block md:hidden divide-y divide-[#2A2D31]">
            {loading ? (
              <div className="p-8 text-center text-xs text-[#9E9E9F]">
                Loading support tickets...
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#9E9E9F]">
                No support tickets found. Click &quot;Create New Ticket&quot; above to contact support.
              </div>
            ) : (
              filteredTickets.map((t) => (
                <div
                  key={t.ticketId}
                  onClick={() => setSelectedTicket(t)}
                  className="p-4 space-y-2.5 hover:bg-[#212327]/30 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-[#FE760B]">
                      #{t.ticketId}
                    </span>
                    {getStatusBadge(t.status)}
                  </div>

                  <div className="text-sm font-bold text-white line-clamp-2">
                    {t.subject}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#9E9E9F] pt-1">
                    <span className="px-2 py-0.5 rounded-md bg-[#212327] border border-[#2A2D31] text-[10px] text-[#D0D0D1]">
                      {t.category}
                    </span>
                    <div className="flex items-center gap-3">
                      <span>{new Date(t.createdAt).toLocaleDateString("en-IN")}</span>
                      <span className="flex items-center gap-1 text-[#FE760B] font-semibold">
                        <MessageSquare size={11} /> {t.messageCount || 1}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Ticket Detail & Conversation Modal (Exact Visual Style with Cross Icon) ── */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto">
          <div className="w-full max-w-2xl bg-[#17191C] border border-[#2A2D31] rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col text-white animate-scale-in">
            {/* Header */}
            <div className="p-4 sm:p-5 bg-[#1A1C1F] border-b border-[#2A2D31] flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[#FE760B]/12 border border-[#FE760B]/25 flex items-center justify-center text-[#FE760B] shrink-0">
                  <MessageSquare size={18} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-bold text-white">
                      Ticket #{selectedTicket.ticketId}
                    </h3>
                    {getStatusBadge(selectedTicket.status)}
                  </div>
                  <p className="text-[11px] sm:text-xs text-[#9E9E9F] truncate">
                    {selectedTicket.category} &bull; Logged on {new Date(selectedTicket.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTicket(null)}
                className="p-2 rounded-lg text-[#9E9E9F] hover:text-white hover:bg-[#212327] transition-colors shrink-0 cursor-pointer"
                aria-label="Close Modal"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto text-xs">
              {/* Linked Entity Ribbon if present */}
              {selectedTicket.relatedEntity && (
                <div className="p-3 sm:p-3.5 rounded-xl bg-[#212327] border border-[#2A2D31] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText size={15} className="text-[#FE760B] shrink-0" />
                    <span className="text-[#D0D0D1] truncate text-xs">
                      Linked <strong className="text-white capitalize">{selectedTicket.relatedEntity.type}</strong>:{" "}
                      <code className="text-[#FE760B] font-mono">{selectedTicket.relatedEntity.id}</code>
                    </span>
                  </div>
                  {Number(selectedTicket.relatedEntity.amountPaise) > 0 ? (
                    <span className="font-semibold text-white text-xs sm:text-sm whitespace-nowrap self-end sm:self-auto font-mono">
                      ₹{(Number(selectedTicket.relatedEntity.amountPaise) / 100).toFixed(2)}
                    </span>
                  ) : null}
                </div>
              )}

              {/* Subject Card */}
              <div className="p-3.5 rounded-xl bg-[#212327] border border-[#2A2D31] space-y-1">
                <span className="text-[10px] uppercase font-bold text-[#9E9E9F] tracking-wider">Subject</span>
                <h4 className="text-sm sm:text-base font-bold text-white break-words">
                  {selectedTicket.subject}
                </h4>
              </div>

              {/* Conversation Messages */}
              <div className="space-y-3 pt-1">
                <h4 className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-[#9E9E9F]">
                  Conversation History
                </h4>

                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {selectedTicket.messages?.map((msg, idx) => {
                    const isAdmin = msg.senderRole === "superadmin" || msg.senderRole === "admin";
                    return (
                      <div
                        key={msg.messageId || idx}
                        className={`p-3.5 sm:p-4 rounded-2xl text-xs space-y-1.5 ${
                          isAdmin
                            ? "bg-[#212327] border border-[#2A2D31] text-[#F3F4F6] mr-2 sm:mr-8 md:mr-10"
                            : "bg-[#FE760B]/10 border border-[#FE760B]/20 text-white ml-2 sm:ml-8 md:ml-10"
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px] text-[#9E9E9F]">
                          <span className="font-semibold flex items-center gap-1.5 truncate">
                            {isAdmin ? (
                              <Shield size={12} className="text-[#FE760B] shrink-0" />
                            ) : (
                              <User size={12} className="text-emerald-400 shrink-0" />
                            )}
                            <strong className={isAdmin ? "text-[#FE760B] truncate" : "text-white truncate"}>
                              {msg.senderName}
                            </strong>
                            {isAdmin && <span className="text-[10px] text-[#9E9E9F] shrink-0">(Support Staff)</span>}
                          </span>
                          <span className="shrink-0 ml-2">
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap leading-relaxed text-[#D0D0D1] text-xs sm:text-sm">
                          {msg.content}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Reply Composer */}
              {selectedTicket.status !== SUPPORT_STATUSES.CLOSED ? (
                <form onSubmit={handleSendReply} className="pt-3 border-t border-[#2A2D31] space-y-3">
                  <label className="block text-xs font-semibold text-[#9E9E9F]">Post a Reply</label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Type your response to the support team..."
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#212327] border border-[#2A2D31] text-xs sm:text-sm text-white focus:outline-none focus:border-[#FE760B] resize-none"
                  />
                  <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => setSelectedTicket(null)}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#212327] hover:bg-[#2A2D31] text-[#D0D0D1] hover:text-white transition-colors cursor-pointer text-center font-semibold text-xs sm:text-sm"
                    >
                      Close
                    </button>
                    <button
                      type="submit"
                      disabled={sendingReply || !replyContent.trim()}
                      className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#FE760B] hover:bg-[#FF8A2B] text-black font-bold text-xs sm:text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-[#FE760B]/20"
                    >
                      <span>{sendingReply ? "Sending..." : "Send Reply"}</span>
                      <Send size={13} />
                    </button>
                  </div>
                </form>
              ) : (
                <div className="p-3.5 rounded-xl bg-[#212327] border border-[#2A2D31] text-xs text-[#9E9E9F] text-center">
                  This ticket has been marked as Closed. Create a new support ticket if you require further assistance.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Ticket Creation Modal */}
      <SupportTicketModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onTicketCreated={() => {
          fetchTickets(false);
        }}
      />
    </div>
  );
}
