"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Check,
  X,
  Mail,
  Calendar,
  Users,
  MapPin,
  Copy,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Info,
  KeyRound,
  Search,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  Phone,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import {
  getAllHostingRequests,
  rejectHostingRequest,
  subscribeToHostingRequests,
} from "@/lib/hosting-requests";
import { doc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

const REQUESTS_PAGE_SIZE = 10;

function formatRequestDate(ts) {
  if (!ts) return "Recently";
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
    });
  } catch {
    return "Recently";
  }
}

function formatFullRequestDate(ts) {
  if (!ts) return "Recently";
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "Recently";
  }
}

export function HostingRequestManagement() {
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // 'all' | 'pending' | 'approved' | 'rejected'
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedDetailRequest, setSelectedDetailRequest] = useState(null);

  // Modal states
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [requestToReject, setRequestToReject] = useState(null);
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [approvedCredentials, setApprovedCredentials] = useState(null);
  const [approvedRequestData, setApprovedRequestData] = useState(null);
  const [isExistingOrganiser, setIsExistingOrganiser] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const prevCountRef = useRef(null);

  useEffect(() => {
    const unsubscribe = subscribeToHostingRequests(
      (allRequests) => {
        const safeRequests = Array.isArray(allRequests) ? allRequests : [];
        if (
          prevCountRef.current !== null &&
          safeRequests.length > prevCountRef.current
        ) {
          const newReq = safeRequests[0];
          const eventTitle = (newReq?.eventTitle || "").trim();
          const hostName = (newReq?.name || "").trim();
          if (eventTitle || hostName) {
            toast.info(
              `New hosting request: "${eventTitle || "Event"}" from ${hostName || "an organizer"}`,
              { duration: 5000 },
            );
          }
        }
        prevCountRef.current = safeRequests.length;
        setRequests(safeRequests);
        setIsLoading(false);
        setIsLiveConnected(true);
      },
      async (error) => {
        console.warn("Real-time listener warning, attempting API fallback:", error);
        setIsLiveConnected(false);
        try {
          const allRequests = await getAllHostingRequests();
          setRequests(Array.isArray(allRequests) ? allRequests : []);
        } catch (fetchErr) {
          console.error("Failed to load hosting requests:", fetchErr);
          toast.error("Failed to load hosting requests");
        } finally {
          setIsLoading(false);
        }
      },
    );

    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, []);

  const handleManualRefresh = async (silent = false) => {
    setIsRefreshing(true);
    try {
      const allRequests = await getAllHostingRequests();
      setRequests(allRequests);
      if (!silent) {
        toast.success("Requests refreshed");
      }
    } catch (e) {
      if (!silent) {
        toast.error("Failed to refresh requests");
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const loadRequests = () => handleManualRefresh(true);

  const handleResendApprovalEmail = async (req) => {
    const reqId = req.id;
    setProcessingId(reqId);
    try {
      const res = await fetch("/api/send-approval-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: req.name,
          email: req.email,
          eventTitle: req.eventTitle,
          organiserEmail: req.organiserEmail || req.email,
          isExisting: Boolean(req.isExisting),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Approval email resent to ${req.email}!`);
      } else {
        toast.error(data.error || "Failed to resend approval email");
      }
    } catch (err) {
      console.error("Resend approval email error:", err);
      toast.error("Failed to resend approval email");
    } finally {
      setProcessingId(null);
    }
  };

  const counts = useMemo(() => {
    return {
      pending: requests.filter((r) => r.status === "pending").length,
      approved: requests.filter((r) => r.status === "approved").length,
      rejected: requests.filter((r) => r.status === "rejected").length,
    };
  }, [requests]);

  const filteredRequests = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return requests.filter((req) => {
      const matchesStatus =
        statusFilter === "all" ? true : req.status === statusFilter;
      const searchable = [
        req.eventTitle,
        req.name,
        req.email,
        req.college,
        req.description,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesSearch = !term || searchable.includes(term);
      return matchesStatus && matchesSearch;
    });
  }, [requests, statusFilter, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / REQUESTS_PAGE_SIZE));
  const activePage = Math.min(currentPage, totalPages);
  const paginatedRequests = filteredRequests.slice(
    (activePage - 1) * REQUESTS_PAGE_SIZE,
    activePage * REQUESTS_PAGE_SIZE,
  );

  const handleApprove = async (requestId, requestData) => {
    setProcessingId(requestId);
    try {
      const organiserEmail = requestData.email;

      const createResponse = await fetch("/api/create-organiser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: organiserEmail,
          name: requestData.name,
          phone: requestData.phone,
          college: requestData.college,
          eventTitle: requestData.eventTitle,
        }),
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        throw new Error(
          errorData.error || "Failed to create organiser account",
        );
      }

      const createData = await createResponse.json();
      const {
        organiserId,
        isExisting,
        organiserEmail: responseEmail,
      } = createData;

      const finalEmail = responseEmail || organiserEmail;
      toast.info(
        isExisting
          ? "Organizer access approved. Their existing password was not changed."
          : "Organizer access approved. They can set a password with Forgot password.",
      );

      await updateDoc(doc(db, "hostingRequests", requestId), {
        status: "approved",
        organiserId,
        organiserEmail: finalEmail,
        approvedAt: Timestamp.now(),
        isExisting,
      });

      const credentials = {
        organiserId,
        organiserEmail: finalEmail,
      };

      setApprovedCredentials(credentials);
      setApprovedRequestData(requestData);
      setIsExistingOrganiser(isExisting);
      setApprovalModalOpen(true);

      try {
        const emailResponse = await fetch("/api/send-approval-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: requestData.name,
            email: requestData.email,
            eventTitle: requestData.eventTitle,
            organiserEmail: credentials.organiserEmail,
            isExisting,
          }),
        });

        const emailResult = await emailResponse.json();
        if (emailResult.success) {
          toast.success("Approved! Email sent to " + requestData.email);
        } else {
          toast.warning("Approved but email delivery had an issue");
        }
      } catch (emailError) {
        console.error("Email sending error:", emailError);
      }

      await loadRequests();
    } catch (error) {
      console.error("Approval failed:", error);
      toast.error(error?.message || "Failed to approve request");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }

    setProcessingId(requestToReject.id);
    try {
      await rejectHostingRequest(requestToReject.id, rejectionReason);

      try {
        await fetch("/api/send-rejection-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: requestToReject.name,
            email: requestToReject.email,
            eventTitle: requestToReject.eventTitle,
            eventDescription: requestToReject.description || "",
            rejectionReason: rejectionReason,
            numberOfTickets: requestToReject.numberOfTickets,
            college: requestToReject.college || "",
          }),
        });
      } catch (emailError) {
        console.error("Failed to send rejection email:", emailError);
      }

      toast.success("Hosting request rejected");
      setRejectModalOpen(false);
      setRejectionReason("");
      setRequestToReject(null);
      await loadRequests();
    } catch (error) {
      console.error("Failed to reject request:", error);
      toast.error(error?.message || "Failed to reject request");
    } finally {
      setProcessingId(null);
    }
  };

  const openRejectModal = (request) => {
    setRequestToReject(request);
    setRejectModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#FE760B]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search & Status Summary Row (Matching Image 5) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9B9EA4]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search event, name or college"
            className="w-full h-11 pl-10 pr-4 bg-[#1A1C1F] border border-[#2A2D31] rounded-xl text-sm text-white placeholder:text-[#9B9EA4] focus:outline-none focus:border-[#FE760B] transition-colors"
          />
        </div>

        {/* Top-Right Status Summary Badges & Real-time Live indicator */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          {/* Live indicator & Refresh button */}
          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[#1A1C1F] border border-[#2A2D31] text-xs">
            <span className="relative flex h-2 w-2">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  isLiveConnected ? "bg-emerald-400" : "bg-amber-400"
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  isLiveConnected ? "bg-emerald-500" : "bg-amber-500"
                }`}
              />
            </span>
            <span
              className={`text-[11px] font-semibold ${
                isLiveConnected ? "text-emerald-400" : "text-[#9B9EA4]"
              }`}
            >
              {isLiveConnected ? "Live sync" : "Syncing"}
            </span>
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              title="Refresh requests"
              className="p-0.5 text-[#9B9EA4] hover:text-white rounded transition-colors ml-0.5"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${
                  isRefreshing ? "animate-spin text-[#FE760B]" : ""
                }`}
              />
            </button>
          </div>

          <div className="inline-flex items-center bg-[#1A1C1F] border border-[#2A2D31] rounded-xl p-1 gap-1 max-w-full overflow-x-auto scrollbar-none">
          <button
            onClick={() => {
              setStatusFilter(statusFilter === "pending" ? "all" : "pending");
              setCurrentPage(1);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 whitespace-nowrap ${
              statusFilter === "pending"
                ? "bg-[#212327] text-white shadow-sm"
                : "text-[#D0D0D1] hover:text-white"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-[#FDE003]" />
            Pending · {counts.pending}
          </button>
          <button
            onClick={() => {
              setStatusFilter(statusFilter === "approved" ? "all" : "approved");
              setCurrentPage(1);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 whitespace-nowrap ${
              statusFilter === "approved"
                ? "bg-[#212327] text-white shadow-sm"
                : "text-[#D0D0D1] hover:text-white"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-[#3DD68C]" />
            Approved · {counts.approved}
          </button>
          <button
            onClick={() => {
              setStatusFilter(statusFilter === "rejected" ? "all" : "rejected");
              setCurrentPage(1);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 whitespace-nowrap ${
              statusFilter === "rejected"
                ? "bg-[#212327] text-white shadow-sm"
                : "text-[#D0D0D1] hover:text-white"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-[#FF6B6B]" />
            Rejected · {counts.rejected}
          </button>
        </div>
      </div>
    </div>

      {/* Requests Table Container (Matching Image 5) */}
      <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#2A2D31] bg-[#131517]/50">
                <th className="py-3 px-5 text-[12px] font-semibold text-[#9B9EA4] uppercase tracking-[0.6px]">
                  EVENT
                </th>
                <th className="py-3 px-5 text-[12px] font-semibold text-[#9B9EA4] uppercase tracking-[0.6px]">
                  REQUESTED BY
                </th>
                <th className="py-3 px-5 text-[12px] font-semibold text-[#9B9EA4] uppercase tracking-[0.6px]">
                  TYPE
                </th>
                <th className="py-3 px-5 text-[12px] font-semibold text-[#9B9EA4] uppercase tracking-[0.6px]">
                  TICKETS
                </th>
                <th className="py-3 px-5 text-[12px] font-semibold text-[#9B9EA4] uppercase tracking-[0.6px] text-right">
                  DECISION
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2A2D31]">
              {paginatedRequests.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-[#9B9EA4] text-sm">
                    No hosting requests found matching your filter.
                  </td>
                </tr>
              ) : (
                paginatedRequests.map((request) => {
                  const isPending = request.status === "pending";
                  const isApproved = request.status === "approved";
                  const isRejected = request.status === "rejected";

                  return (
                    <tr
                      key={request.id}
                      className="hover:bg-[#212327]/60 transition-colors group cursor-pointer"
                      onClick={() => setSelectedDetailRequest(request)}
                    >
                      {/* Event Column */}
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-[#212327] border border-[#2A2D31] flex items-center justify-center font-bold text-xs text-white">
                            {request.coverUrl ? (
                              <img
                                src={request.coverUrl}
                                alt={request.eventTitle}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-[#FF9A4D]">
                                {request.eventTitle?.charAt(0) || "E"}
                              </span>
                            )}
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-white group-hover:text-[#FE760B] transition-colors">
                              {request.eventTitle}
                            </div>
                            <div className="text-xs text-[#9B9EA4] mt-0.5">
                              Sent {formatRequestDate(request.createdAt)}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Requested By Column */}
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-medium text-white">
                            {request.name}
                          </span>
                          {request.userId ? (
                            <span
                              title={`Verified TicketLelo account: ${request.userAccountEmail || request.email} (${request.userId})`}
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
                            >
                              <Check className="w-2.5 h-2.5" />
                              <span>Verified</span>
                            </span>
                          ) : (
                            <span
                              title="User submitted before account registration; will be provisioned on approval"
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#2A2D31] text-[#9B9EA4]"
                            >
                              Guest
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-[#9B9EA4] mt-0.5 truncate max-w-[220px]">
                          {request.college || "College"} · {request.email}
                        </div>
                      </td>

                      {/* Type Column */}
                      <td className="py-3.5 px-5">
                        {request.isPaid ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#FE760B]/14 text-[#FF9A4D]">
                            Paid
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/10 text-white">
                            Free
                          </span>
                        )}
                      </td>

                      {/* Tickets Column */}
                      <td className="py-3.5 px-5">
                        <span className="text-sm text-white font-mono tabular-nums">
                          {request.numberOfTickets || "—"}
                        </span>
                      </td>

                      {/* Decision Column (Matching Image 5) */}
                      <td
                        className="py-3.5 px-5 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isPending ? (
                          <div className="inline-flex items-center gap-2">
                            <button
                              onClick={() => openRejectModal(request)}
                              disabled={processingId === request.id}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#FF9A9A] hover:bg-[#FF6B6B]/15 transition-colors disabled:opacity-50"
                            >
                              Reject
                            </button>
                            <button
                              onClick={() => handleApprove(request.id, request)}
                              disabled={processingId === request.id}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#3DD68C] bg-[#3DD68C]/12 hover:bg-[#3DD68C]/20 transition-colors disabled:opacity-50 inline-flex items-center gap-1"
                            >
                              {processingId === request.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : null}
                              Approve
                            </button>
                          </div>
                        ) : isApproved ? (
                          <div className="inline-flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#3DD68C]/12 text-[#3DD68C]">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#3DD68C]" />
                              Approved
                            </span>
                            <button
                              onClick={() => handleResendApprovalEmail(request)}
                              disabled={processingId === request.id}
                              title={`Resend approval email to ${request.email}`}
                              className="px-2 py-1 rounded-lg text-xs font-medium text-[#9B9EA4] hover:text-[#FE760B] hover:bg-[#212327] transition-colors border border-transparent hover:border-[#2A2D31] inline-flex items-center gap-1 disabled:opacity-50"
                            >
                              <Mail className="w-3 h-3" />
                              <span className="hidden sm:inline">Resend</span>
                            </button>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#FF6B6B]/12 text-[#FF9A9A]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B6B]" />
                            Rejected
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-[#2A2D31] flex items-center justify-between bg-[#131517]/40 text-xs text-[#9B9EA4]">
            <div>
              Showing {(activePage - 1) * REQUESTS_PAGE_SIZE + 1} to{" "}
              {Math.min(activePage * REQUESTS_PAGE_SIZE, filteredRequests.length)}{" "}
              of {filteredRequests.length} requests
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={activePage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="h-8 border-[#2A2D31] bg-[#1A1C1F] text-white hover:bg-[#212327]"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <span className="text-white font-medium px-2">
                {activePage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={activePage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="h-8 border-[#2A2D31] bg-[#1A1C1F] text-white hover:bg-[#212327]"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Slideout/Modal */}
      {selectedDetailRequest && (
        <div
          className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setSelectedDetailRequest(null)}
        >
          <div
            className="w-full max-w-lg bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="text-lg font-bold text-white">
                    {selectedDetailRequest.eventTitle}
                  </h3>
                  {selectedDetailRequest.status === "pending" && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FDE003]/10 text-[#FDE003] border border-[#FDE003]/25">
                      Pending review
                    </span>
                  )}
                  {selectedDetailRequest.status === "approved" && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                      Approved
                    </span>
                  )}
                  {selectedDetailRequest.status === "rejected" && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/15 text-red-400 border border-red-500/25">
                      Rejected
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#9B9EA4]">
                  Requested by <strong className="text-white">{selectedDetailRequest.name}</strong> · {formatFullRequestDate(selectedDetailRequest.createdAt)}
                </p>
              </div>
              <button
                onClick={() => setSelectedDetailRequest(null)}
                className="p-1.5 rounded-lg hover:bg-[#212327] text-[#9B9EA4] hover:text-white transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Applicant Identity & Verification Card */}
            <div className="p-3.5 rounded-xl bg-[#212327] border border-[#2A2D31] text-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <ShieldCheck
                  className={`w-5 h-5 shrink-0 ${
                    selectedDetailRequest.userId ? "text-emerald-400" : "text-amber-400"
                  }`}
                />
                <div className="min-w-0">
                  <span className="text-white font-semibold block truncate">
                    {selectedDetailRequest.userId
                      ? "Verified TicketLelo User"
                      : "Account Registration on Submit"}
                  </span>
                  <p className="text-[11px] text-[#9B9EA4] truncate">
                    {selectedDetailRequest.userId
                      ? `UID: ${selectedDetailRequest.userId}`
                      : "User requested access; organizer privileges granted on approval"}
                  </p>
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-semibold shrink-0 ${
                  selectedDetailRequest.userId
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                }`}
              >
                {selectedDetailRequest.userId ? "Verified" : "Pending Auth"}
              </span>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-[#212327] p-4 rounded-xl border border-[#2A2D31]">
              <div>
                <span className="text-[#9B9EA4] block mb-0.5">Contact Email</span>
                <a
                  href={`mailto:${selectedDetailRequest.email}`}
                  className="text-white hover:text-[#FE760B] font-medium break-all underline decoration-[#2A2D31] hover:decoration-[#FE760B]"
                >
                  {selectedDetailRequest.email}
                </a>
              </div>
              <div>
                <span className="text-[#9B9EA4] block mb-0.5">Phone & WhatsApp</span>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white font-medium">
                    +91 {selectedDetailRequest.phone || "—"}
                  </span>
                  {selectedDetailRequest.phone && (
                    <a
                      href={`https://wa.me/91${String(selectedDetailRequest.phone).replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Verify requester on WhatsApp"
                      className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold"
                    >
                      <MessageSquare className="w-3 h-3" />
                      <span>WhatsApp</span>
                    </a>
                  )}
                </div>
              </div>
              <div>
                <span className="text-[#9B9EA4] block mb-0.5">College / Organisation</span>
                <span className="text-white font-medium">
                  {selectedDetailRequest.college || "—"}
                </span>
              </div>
              <div>
                <span className="text-[#9B9EA4] block mb-0.5">Expected Tickets</span>
                <span className="text-white font-mono font-medium">
                  {selectedDetailRequest.numberOfTickets} tickets
                </span>
              </div>
              <div>
                <span className="text-[#9B9EA4] block mb-0.5">Event Type</span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                    selectedDetailRequest.isPaid
                      ? "bg-[#FE760B]/14 text-[#FF9A4D]"
                      : "bg-white/10 text-white"
                  }`}
                >
                  {selectedDetailRequest.isPaid ? "Paid Event" : "Free Event"}
                </span>
              </div>
              <div>
                <span className="text-[#9B9EA4] block mb-0.5">Account Email</span>
                <span className="text-[#D0D0D1] break-all">
                  {selectedDetailRequest.userAccountEmail || selectedDetailRequest.email}
                </span>
              </div>
            </div>

            {selectedDetailRequest.description && (
              <div>
                <span className="text-xs text-[#9B9EA4] font-medium block mb-1">
                  Event Description
                </span>
                <p className="text-xs text-[#D0D0D1] bg-[#212327] p-3 rounded-xl border border-[#2A2D31] leading-relaxed whitespace-pre-wrap">
                  {selectedDetailRequest.description}
                </p>
              </div>
            )}

            {selectedDetailRequest.status === "pending" && (
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={() => {
                    openRejectModal(selectedDetailRequest);
                    setSelectedDetailRequest(null);
                  }}
                  className="flex-1 bg-transparent hover:bg-[#FF6B6B]/15 text-[#FF9A9A] border border-[#FF6B6B]/30 h-10 rounded-xl text-xs font-semibold"
                >
                  Reject Request
                </Button>
                <Button
                  onClick={() => {
                    handleApprove(
                      selectedDetailRequest.id,
                      selectedDetailRequest,
                    );
                    setSelectedDetailRequest(null);
                  }}
                  className="flex-1 bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] h-10 rounded-xl text-xs font-semibold shadow-none border-none"
                >
                  Approve Request
                </Button>
              </div>
            )}

            {selectedDetailRequest.status === "approved" && (
              <div className="pt-2">
                <Button
                  onClick={() => {
                    handleResendApprovalEmail(selectedDetailRequest);
                  }}
                  disabled={processingId === selectedDetailRequest.id}
                  className="w-full bg-[#212327] hover:bg-[#2A2D31] text-white border border-[#2A2D31] h-10 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-2"
                >
                  <Mail className="w-3.5 h-3.5 text-[#FE760B]" />
                  <span>Resend Organiser Approval Email</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {rejectModalOpen && typeof document !== "undefined" && createPortal(
        <>
          <div
            className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-xs"
            onClick={() => {
              setRejectModalOpen(false);
              setRejectionReason("");
              setRequestToReject(null);
            }}
          />
          <div
            className="fixed inset-0 z-[201] flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full max-w-md bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">
                  Reject Hosting Request
                </h3>
                <button
                  onClick={() => {
                    setRejectModalOpen(false);
                    setRejectionReason("");
                    setRequestToReject(null);
                  }}
                  className="p-1 hover:bg-[#212327] rounded-lg text-[#9B9EA4] hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {requestToReject && (
                <div className="p-3 bg-[#212327] rounded-xl border border-[#2A2D31] text-xs">
                  <div className="font-semibold text-white">
                    {requestToReject.eventTitle}
                  </div>
                  <div className="text-[#9B9EA4] mt-0.5">
                    {requestToReject.name} · {requestToReject.email}
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#D0D0D1]">
                  Rejection Reason <span className="text-[#FF6B6B]">*</span>
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Explain why this request is being rejected..."
                  rows={4}
                  className="w-full px-3.5 py-2.5 bg-[#212327] border border-[#2A2D31] rounded-xl text-xs text-white placeholder:text-[#9B9EA4] focus:outline-none focus:border-[#FE760B] transition-colors resize-none"
                />
                <p className="text-[11px] text-[#9B9EA4]">
                  This note will be emailed directly to the organizer.
                </p>
              </div>

              <div className="flex gap-2.5 pt-2">
                <Button
                  onClick={handleReject}
                  disabled={
                    !rejectionReason.trim() ||
                    processingId === requestToReject?.id
                  }
                  className="flex-1 bg-[#FF6B6B] hover:bg-[#FF8A8A] text-[#131517] h-10 rounded-xl text-xs font-semibold border-none shadow-none"
                >
                  {processingId === requestToReject?.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  ) : null}
                  Confirm Rejection
                </Button>
                <Button
                  onClick={() => {
                    setRejectModalOpen(false);
                    setRejectionReason("");
                    setRequestToReject(null);
                  }}
                  variant="outline"
                  className="flex-1 bg-[#212327] hover:bg-[#2A2D31] text-white border border-[#2A2D31] h-10 rounded-xl text-xs font-medium"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </>,
        document.body,
      )}

      {/* Approval Modal */}
      {approvalModalOpen && approvedCredentials && typeof document !== "undefined" && createPortal(
        <>
          <div
            className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-xs"
            onClick={() => {
              setApprovalModalOpen(false);
              setApprovedCredentials(null);
              setApprovedRequestData(null);
              setIsExistingOrganiser(false);
            }}
          />
          <div className="fixed inset-0 z-[201] flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#3DD68C]/12 flex items-center justify-center text-[#3DD68C]">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Request approved
                  </h3>
                  <p className="text-xs text-[#9B9EA4]">
                    Organizer access granted for {approvedRequestData?.eventTitle}
                  </p>
                </div>
              </div>

              <div className="bg-[#212327] border border-[#2A2D31] rounded-xl p-3.5 space-y-2 text-xs">
                <div className="text-[#9B9EA4] font-medium flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-[#FE760B]" />
                  Sign-in email
                </div>
                <div className="flex items-center justify-between bg-[#1A1C1F] border border-[#2A2D31] p-2.5 rounded-lg">
                  <span className="font-mono text-white text-xs">
                    {approvedCredentials.organiserEmail}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(
                        approvedCredentials.organiserEmail,
                      );
                      toast.success("Email copied!");
                    }}
                    className="p-1 hover:bg-[#212327] rounded text-[#9B9EA4] hover:text-white"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-[11px] text-[#9B9EA4] pt-1">
                  {isExistingOrganiser
                    ? "Existing organizer keeps their current credentials."
                    : "The organizer can set a password using the Forgot password link."}
                </p>
              </div>

              <Button
                onClick={() => {
                  setApprovalModalOpen(false);
                  setApprovedCredentials(null);
                  setApprovedRequestData(null);
                  setIsExistingOrganiser(false);
                }}
                className="w-full bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] font-semibold h-10 rounded-xl text-xs transition-colors border-none shadow-none"
              >
                Done
              </Button>
            </div>
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}
