"use client";

import { useState, useEffect, useRef } from "react";
import {
  LifeBuoy,
  X,
  AlertCircle,
  CheckCircle2,
  FileText,
} from "lucide-react";
import { StyledDropdown } from "@/components/ui/styled-dropdown";
import { SUPPORT_CATEGORIES, SUPPORT_PRIORITIES } from "@/lib/support/types";

const DEFAULT_INITIAL_DATA = Object.freeze({});

export function SupportTicketModal({
  isOpen,
  onClose,
  initialData = DEFAULT_INITIAL_DATA,
  onTicketCreated = () => {},
}) {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    category: "Settlements and Payouts",
    subject: "",
    description: "",
    priority: SUPPORT_PRIORITIES.MEDIUM,
  });

  const [relatedEntity, setRelatedEntity] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [createdTicketId, setCreatedTicketId] = useState(null);

  // Guard against infinite re-render loops & cascading updates
  const prevOpenRef = useRef(false);

  useEffect(() => {
    // Only synchronize when the modal transitions from closed to open
    if (isOpen && !prevOpenRef.current) {
      setError(null);
      setSuccess(false);
      setCreatedTicketId(null);
      setAttachments([]);

      setFormData({
        fullName: initialData?.fullName || "",
        email: initialData?.email || "",
        phone: initialData?.phone || "",
        category: initialData?.category || "Settlements and Payouts",
        subject: initialData?.subject || "",
        description: initialData?.description || "",
        priority: initialData?.priority || SUPPORT_PRIORITIES.MEDIUM,
      });

      setRelatedEntity(initialData?.relatedEntity || null);
    }
    prevOpenRef.current = isOpen;
  }, [
    isOpen,
    initialData?.fullName,
    initialData?.email,
    initialData?.phone,
    initialData?.category,
    initialData?.subject,
    initialData?.description,
    initialData?.priority,
    initialData?.relatedEntity,
  ]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = {
        ...formData,
        relatedEntity: relatedEntity || null,
        attachments: attachments || [],
      };

      const res = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit support ticket");
      }

      setSuccess(true);
      setCreatedTicketId(data.ticket?.ticketId || "TKT-10001");
      onTicketCreated(data.ticket);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto">
      <div className="w-full max-w-xl bg-[#17191C] border border-[#2A2D31] rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col text-white animate-scale-in">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-[#1A1C1F] border-b border-[#2A2D31] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#FE760B]/12 border border-[#FE760B]/25 flex items-center justify-center text-[#FE760B] shrink-0">
              <LifeBuoy size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-white truncate">
                {relatedEntity ? "Raise Support Ticket for Financial Record" : "Create New Support Ticket"}
              </h3>
              <p className="text-[11px] sm:text-xs text-[#9E9E9F] truncate">
                Direct line to TicketLelo operations and Super Admin support
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-[#9E9E9F] hover:text-white hover:bg-[#212327] transition-colors shrink-0 cursor-pointer"
            aria-label="Close Modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        {success ? (
          <div className="p-6 sm:p-8 text-center space-y-4 overflow-y-auto">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 size={32} />
            </div>
            <div className="space-y-1">
              <h4 className="text-base sm:text-lg font-bold text-white">Support Ticket Submitted!</h4>
              <p className="text-xs sm:text-sm text-[#D0D0D1]">
                Your reference ID is <code className="text-[#FE760B] font-bold font-mono text-xs sm:text-sm">#{createdTicketId}</code>
              </p>
              <p className="text-[11px] sm:text-xs text-[#9E9E9F] max-w-md mx-auto pt-2 leading-relaxed">
                A confirmation has been sent to your email. The Super Admin team has been automatically alerted and will respond within 24 business hours.
              </p>
            </div>
            <div className="pt-4">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#FE760B] hover:bg-[#FF8A2B] text-black font-bold text-xs sm:text-sm transition-all cursor-pointer shadow-lg shadow-[#FE760B]/20"
              >
                Close Window
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto text-xs">
            {error && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-start gap-2.5 text-xs">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            {/* Linked Entity Ribbon if present */}
            {relatedEntity && (
              <div className="p-3 sm:p-3.5 rounded-xl bg-[#212327] border border-[#2A2D31] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText size={15} className="text-[#FE760B] shrink-0" />
                  <span className="text-[#D0D0D1] truncate text-xs">
                    Linked <strong className="text-white capitalize">{relatedEntity.type}</strong>:{" "}
                    <code className="text-[#FE760B] font-mono">{relatedEntity.id}</code>
                  </span>
                </div>
                {Number(relatedEntity.amountPaise) > 0 ? (
                  <span className="font-semibold text-white text-xs sm:text-sm whitespace-nowrap self-end sm:self-auto font-mono">
                    ₹{(Number(relatedEntity.amountPaise) / 100).toFixed(2)}
                  </span>
                ) : null}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-[#9E9E9F] font-semibold mb-1 text-[11px] sm:text-xs">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Your full name"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#212327] border border-[#2A2D31] text-white focus:outline-none focus:border-[#FE760B] text-xs sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-[#9E9E9F] font-semibold mb-1 text-[11px] sm:text-xs">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  placeholder="Enter email address"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#212327] border border-[#2A2D31] text-white focus:outline-none focus:border-[#FE760B] text-xs sm:text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-[#9E9E9F] font-semibold mb-1 text-[11px] sm:text-xs">
                  Phone Number (with country code) *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="Enter contact number"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#212327] border border-[#2A2D31] text-white focus:outline-none focus:border-[#FE760B] text-xs sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-[#9E9E9F] font-semibold mb-1 text-[11px] sm:text-xs">
                  Category *
                </label>
                <StyledDropdown
                  value={formData.category}
                  onChange={(val) => setFormData((prev) => ({ ...prev, category: val }))}
                  options={SUPPORT_CATEGORIES.map((cat) => ({
                    value: cat,
                    label: cat,
                  }))}
                  className="w-full"
                  buttonClassName="w-full h-[42px] justify-between rounded-xl bg-[#212327] border-[#2A2D31] text-white hover:bg-[#282B30] text-xs sm:text-sm px-3.5"
                  menuClassName="w-full max-h-56 z-50"
                />
              </div>
            </div>

            <div>
              <label className="block text-[#9E9E9F] font-semibold mb-1 text-[11px] sm:text-xs">
                Subject *
              </label>
              <input
                type="text"
                required
                placeholder="Brief summary of the inquiry"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#212327] border border-[#2A2D31] text-white focus:outline-none focus:border-[#FE760B] text-xs sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-[#9E9E9F] font-semibold mb-1 text-[11px] sm:text-xs">
                Issue Description * (min 10 characters)
              </label>
              <textarea
                required
                rows={4}
                placeholder="Describe your issue with all relevant dates, references, or transaction details..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#212327] border border-[#2A2D31] text-white focus:outline-none focus:border-[#FE760B] resize-none text-xs sm:text-sm"
              />
            </div>

            <div className="pt-2 flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#212327] hover:bg-[#2A2D31] text-[#D0D0D1] hover:text-white transition-colors cursor-pointer text-center font-semibold text-xs sm:text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#FE760B] hover:bg-[#FF8A2B] text-black font-bold transition-all disabled:opacity-50 cursor-pointer shadow-lg shadow-[#FE760B]/20 text-center text-xs sm:text-sm"
              >
                {loading ? "Submitting..." : "Submit Ticket"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
