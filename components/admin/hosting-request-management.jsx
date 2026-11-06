/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { StyledDropdown } from "@/components/ui/styled-dropdown";
import { BrandLoader } from "@/components/ui/brand-loader";
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
  ArrowUpDown,
  Clock,
  RotateCcw,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import {
  getAllHostingRequests,
  rejectHostingRequest,
  subscribeToHostingRequests,
} from "@/lib/hosting-requests";
import { doc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

const SORT_OPTIONS = [
  { value: "newest", label: "Newest First" },
  { value: "oldest", label: "Oldest First" },
  { value: "urgent", label: "Urgent / Pending First" },
  { value: "title", label: "Event Title (A-Z)" },
  { value: "tickets", label: "Capacity / Tickets" },
];

const PERIOD_OPTIONS = [
  { value: "all", label: "All Time" },
  { value: "today", label: "Past 24 Hours" },
  { value: "week", label: "Past 7 Days" },
  { value: "month", label: "Past 30 Days" },
];

function getPaginationRange(current, total) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (current <= 4) {
    return [1, 2, 3, 4, 5, "...", total];
  }
  if (current >= total - 3) {
    return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
  }
  return [1, "...", current - 1, current, current + 1, "...", total];
}

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
  const [pageSize, setPageSize] = useState(10);
  const [sortBy, setSortBy] = useState("newest");
  const [timeRange, setTimeRange] = useState("all");
  const [currentTime, setCurrentTime] = useState(0);

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
  const isInitialSnapshotRef = useRef(true);
  const knownRequestIdsRef = useRef(new Set());
  const mountedAtRef = useRef(null);

  useEffect(() => {
    if (mountedAtRef.current === null) {
      mountedAtRef.current = Date.now();
    }
    const unsubscribe = subscribeToHostingRequests(
      (allRequests) => {
        const safeRequests = Array.isArray(allRequests) ? allRequests : [];

        if (isInitialSnapshotRef.current) {
          // On initial load, record all existing IDs so we never toast for historical requests
          safeRequests.forEach((req) => {
            if (req?.id) knownRequestIdsRef.current.add(req.id);
          });
          isInitialSnapshotRef.current = false;
        } else {
          // On subsequent live updates, only notify for genuinely NEW requests that:
          // 1. Have not been seen in this session
          // 2. Are strictly 'pending' (never approved or rejected)
          // 3. Were created recently (after page mount)
          safeRequests.forEach((req) => {
            if (!req?.id) return;
            if (knownRequestIdsRef.current.has(req.id)) return;

            // Immediately mark as known so it never notifies again
            knownRequestIdsRef.current.add(req.id);

            // Must be pending!
            if (req.status !== "pending") return;

            let createdTime = 0;
            if (req.createdAt?.toMillis) {
              createdTime = req.createdAt.toMillis();
            } else if (req.createdAt?.seconds) {
              createdTime = req.createdAt.seconds * 1000;
            } else if (req.createdAt) {
              createdTime = new Date(req.createdAt).getTime();
            }

            // Only notify if created recently (after mount or within 2 minutes)
            const isRecent = createdTime > mountedAtRef.current - 120000;
            if (isRecent) {
              const eventTitle = (req?.eventTitle || "").trim();
              const hostName = (req?.name || "").trim();
              if (eventTitle || hostName) {
                toast.info(
                  `New hosting request: "${eventTitle || "Event"}" from ${hostName || "an organizer"}`,
                  { duration: 5000 },
                );
              }
            }
          });
        }

        setRequests(safeRequests);
        setIsLoading(false);
        setIsLiveConnected(true);
      },
      async (error) => {
        console.warn("Real-time listener warning, attempting API fallback:", error);
        setIsLiveConnected(false);
        try {
          const allRequests = await getAllHostingRequests();
          const safeFallback = Array.isArray(allRequests) ? allRequests : [];
          safeFallback.forEach((req) => {
            if (req?.id) knownRequestIdsRef.current.add(req.id);
          });
          setRequests(safeFallback);
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

  const isAnyModalOpen = Boolean(
    selectedDetailRequest || rejectModalOpen || approvalModalOpen
  );

  // Prevent background scrolling when any modal is open
  useEffect(() => {
    if (!isAnyModalOpen) return;

    const originalOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;

    // Compensate for scrollbar removal to prevent layout shift on desktop
    const scrollBarWidth =
      window.innerWidth - document.documentElement.clientWidth;
    if (scrollBarWidth > 0) {
      document.body.style.paddingRight = `${scrollBarWidth}px`;
    }

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (approvalModalOpen) {
          setApprovalModalOpen(false);
          setApprovedCredentials(null);
          setApprovedRequestData(null);
          setIsExistingOrganiser(false);
        } else if (rejectModalOpen) {
          setRejectModalOpen(false);
          setRejectionReason("");
          setRequestToReject(null);
        } else if (selectedDetailRequest) {
          setSelectedDetailRequest(null);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.style.paddingRight = originalPaddingRight;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isAnyModalOpen, approvalModalOpen, rejectModalOpen, selectedDetailRequest]);

  const handleManualRefresh = async (silent = false) => {
    setIsRefreshing(true);
    try {
      const allRequests = await getAllHostingRequests();
      const safe = Array.isArray(allRequests) ? allRequests : [];
      safe.forEach((req) => {
        if (req?.id) knownRequestIdsRef.current.add(req.id);
      });
      setRequests(safe);
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
    const reqId = req?.id;
    if (!reqId) return;
    setProcessingId(reqId);
    const toastId = `resend-${reqId}`;
    toast.loading(`Resending approval email to ${req.email}...`, { id: toastId });
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
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        toast.success(`Approval email resent to ${req.email}!`, { id: toastId });
      } else {
        toast.error(data.error || "Failed to resend approval email", { id: toastId });
      }
    } catch (err) {
      console.error("Resend approval email error:", err);
      toast.error("Failed to resend approval email", { id: toastId });
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
    const list = requests.filter((req) => {
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

      if (timeRange !== "all" && currentTime > 0) {
        const d = req.createdAt?.toDate
          ? req.createdAt.toDate()
          : new Date(req.createdAt || 0);
        const time = d.getTime();
        const diff = currentTime - time;
        if (timeRange === "today" && diff > 24 * 60 * 60 * 1000) return false;
        if (timeRange === "week" && diff > 7 * 24 * 60 * 60 * 1000) return false;
        if (timeRange === "month" && diff > 30 * 24 * 60 * 60 * 1000) return false;
      }

      return matchesStatus && matchesSearch;
    });

    list.sort((a, b) => {
      const ta = a.createdAt?.toDate
        ? a.createdAt.toDate().getTime()
        : new Date(a.createdAt || 0).getTime();
      const tb = b.createdAt?.toDate
        ? b.createdAt.toDate().getTime()
        : new Date(b.createdAt || 0).getTime();

      if (sortBy === "oldest") return ta - tb;
      if (sortBy === "urgent") {
        if (a.status === "pending" && b.status !== "pending") return -1;
        if (b.status === "pending" && a.status !== "pending") return 1;
        return tb - ta;
      }
      if (sortBy === "title") {
        return (a.eventTitle || "").localeCompare(b.eventTitle || "");
      }
      if (sortBy === "tickets") {
        const tA = Number(a.numberOfTickets || a.expectedAttendees || 0);
        const tB = Number(b.numberOfTickets || b.expectedAttendees || 0);
        return tB - tA;
      }
      return tb - ta;
    });

    return list;
  }, [requests, statusFilter, searchTerm, timeRange, sortBy, currentTime]);

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / pageSize));
  const activePage = Math.min(currentPage, totalPages);
  const startIndex = (activePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredRequests.length);
  const paginatedRequests = filteredRequests.slice(startIndex, endIndex);

  const hasActiveFilters =
    statusFilter !== "all" ||
    Boolean(searchTerm.trim()) ||
    sortBy !== "newest" ||
    timeRange !== "all";

  const resetAllFilters = () => {
    setStatusFilter("all");
    setSearchTerm("");
    setSortBy("newest");
    setTimeRange("all");
    setCurrentPage(1);
    setCurrentTime(Date.now());
  };

  const handleApprove = async (requestId, requestData) => {
    setProcessingId(requestId);
    const toastId = `approve-${requestId}`;
    toast.loading("Approving organizer access...", { id: toastId });
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
        const errorData = await createResponse.json().catch(() => ({}));
        throw new Error(
          errorData.error || "Failed to create organiser account",
        );
      }

      const createData = await createResponse.json().catch(() => ({}));
      const {
        organiserId,
        isExisting,
        organiserEmail: responseEmail,
      } = createData;

      const finalEmail = responseEmail || organiserEmail;

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

      let emailSent = false;
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

        const emailResult = await emailResponse.json().catch(() => ({}));
        if (emailResponse.ok && emailResult.success) {
          emailSent = true;
        }
      } catch (emailError) {
        console.error("Email sending error:", emailError);
      }

      if (emailSent) {
        toast.success("Approved! Email sent to " + requestData.email, { id: toastId });
      } else {
        toast.warning("Approved! (Account active, but email delivery had an issue)", { id: toastId });
      }

      await loadRequests();
    } catch (error) {
      console.error("Approval failed:", error);
      toast.error(error?.message || "Failed to approve request", { id: toastId });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }

    const reqId = requestToReject?.id;
    if (!reqId) return;

    setProcessingId(reqId);
    const toastId = `reject-${reqId}`;
    toast.loading("Rejecting hosting request...", { id: toastId });
    try {
      await rejectHostingRequest(reqId, rejectionReason);

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

      toast.success("Hosting request rejected", { id: toastId });
      setRejectModalOpen(false);
      setRejectionReason("");
      setRequestToReject(null);
      await loadRequests();
    } catch (error) {
      console.error("Failed to reject request:", error);
      toast.error(error?.message || "Failed to reject request", { id: toastId });
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
      <div className="flex items-center justify-center min-h-[65vh] w-full">
        <BrandLoader message="Loading..." fullScreen={false} minHeight="min-h-[65vh]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search & Filter Toolbar */}
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Spacious Search Bar */}
          <div className="relative flex-1 min-w-[260px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9B9EA4]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by event title, organizer name, college, email..."
              className="w-full h-10 pl-10 pr-4 bg-[#1A1C1F] border border-[#2A2D31] rounded-xl text-xs sm:text-sm text-white placeholder:text-[#9B9EA4] focus:outline-none focus:border-[#FE760B] transition-colors"
            />
          </div>

          {/* Status Filter Badges & Live Status */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {/* Real-time Status Indicator (No manual refresh button) */}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#1A1C1F] border border-[#2A2D31] text-xs">
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
                {isLiveConnected ? "Live" : "Syncing"}
              </span>
            </div>

            {/* Status Segmented Buttons */}
            <div className="inline-flex items-center bg-[#1A1C1F] border border-[#2A2D31] rounded-xl p-1 gap-1">
              <button
                onClick={() => {
                  setStatusFilter("all");
                  setCurrentPage(1);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                  statusFilter === "all"
                    ? "bg-[#212327] text-white shadow-sm"
                    : "text-[#9B9EA4] hover:text-white"
                }`}
              >
                All ({counts.total})
              </button>
              <button
                onClick={() => {
                  setStatusFilter(statusFilter === "pending" ? "all" : "pending");
                  setCurrentPage(1);
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                  statusFilter === "pending"
                    ? "bg-[#212327] text-white shadow-sm"
                    : "text-[#9B9EA4] hover:text-white"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#FDE003]" />
                Pending ({counts.pending})
              </button>
              <button
                onClick={() => {
                  setStatusFilter(statusFilter === "approved" ? "all" : "approved");
                  setCurrentPage(1);
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                  statusFilter === "approved"
                    ? "bg-[#212327] text-white shadow-sm"
                    : "text-[#9B9EA4] hover:text-white"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#3DD68C]" />
                Approved ({counts.approved})
              </button>
              <button
                onClick={() => {
                  setStatusFilter(statusFilter === "rejected" ? "all" : "rejected");
                  setCurrentPage(1);
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                  statusFilter === "rejected"
                    ? "bg-[#212327] text-white shadow-sm"
                    : "text-[#9B9EA4] hover:text-white"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B6B]" />
                Rejected ({counts.rejected})
              </button>
            </div>
          </div>
        </div>

        {/* Secondary Filter Controls (Sort & Time Period) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-[#9B9EA4]">
          <div className="flex flex-wrap items-center gap-2">
            {/* Custom Styled Sort Dropdown */}
            <StyledDropdown
              icon={ArrowUpDown}
              label="Sort"
              value={sortBy}
              options={SORT_OPTIONS}
              onChange={(val) => {
                setSortBy(val);
                setCurrentPage(1);
              }}
              align="left"
              dropDirection="down"
              menuClassName="w-56"
            />

            {/* Custom Styled Time Range Dropdown */}
            <StyledDropdown
              icon={Clock}
              label="Period"
              value={timeRange}
              options={PERIOD_OPTIONS}
              onChange={(val) => {
                setTimeRange(val);
                setCurrentTime(Date.now());
                setCurrentPage(1);
              }}
              align="left"
              dropDirection="down"
              menuClassName="w-48"
            />

            {hasActiveFilters && (
              <button
                onClick={resetAllFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-[#FE760B] hover:bg-amber-500/10 transition-colors cursor-pointer"
              >
                <RotateCcw size={12} />
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Requests Table Container */}
      <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left border-collapse">
            <thead>
              <tr className="border-b border-[#2A2D31] bg-[#131517]/50">
                <th className="py-3 px-5 text-[12px] font-semibold text-[#9B9EA4] uppercase tracking-[0.6px] whitespace-nowrap min-w-[220px]">
                  EVENT
                </th>
                <th className="py-3 px-5 text-[12px] font-semibold text-[#9B9EA4] uppercase tracking-[0.6px] whitespace-nowrap min-w-[200px]">
                  REQUESTED BY
                </th>
                <th className="py-3 px-4 text-[12px] font-semibold text-[#9B9EA4] uppercase tracking-[0.6px] text-center whitespace-nowrap">
                  TYPE
                </th>
                <th className="py-3 px-4 text-[12px] font-semibold text-[#9B9EA4] uppercase tracking-[0.6px] text-center whitespace-nowrap">
                  TICKETS
                </th>
                <th className="py-3 px-5 text-[12px] font-semibold text-[#9B9EA4] uppercase tracking-[0.6px] text-center whitespace-nowrap">
                  STATUS
                </th>
                <th className="py-3 px-5 text-[12px] font-semibold text-[#9B9EA4] uppercase tracking-[0.6px] text-right whitespace-nowrap">
                  ACTIONS
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2A2D31]">
              {paginatedRequests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#9B9EA4] text-sm">
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
                      <td className="py-3.5 px-5 min-w-[220px]">
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
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-white group-hover:text-[#FE760B] transition-colors">
                              {request.eventTitle}
                            </div>
                            <div className="text-xs text-[#9B9EA4] mt-0.5 whitespace-nowrap">
                              Sent {formatRequestDate(request.createdAt)}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Requested By Column */}
                      <td className="py-3.5 px-5 min-w-[200px]">
                        <div>
                          <span className="text-sm font-medium text-white">
                            {request.name}
                          </span>
                        </div>
                        <div className="text-xs text-[#9B9EA4] mt-0.5 truncate max-w-[220px]">
                          {request.college || "Independent Organiser"} · {request.email}
                        </div>
                      </td>

                      {/* Type Column */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {request.isPaid ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FE760B]/15 text-[#FF9A4D] border border-[#FE760B]/30">
                            Paid
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/10 text-slate-300">
                            Free
                          </span>
                        )}
                      </td>

                      {/* Tickets Column */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span className="text-sm text-white font-mono font-semibold tabular-nums">
                          {request.numberOfTickets || "—"}
                        </span>
                      </td>

                      {/* Status Column */}
                      <td className="py-3.5 px-5 text-center whitespace-nowrap">
                        {isPending ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/25">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                            Pending
                          </span>
                        ) : isApproved ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            Approved
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/25">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                            Rejected
                          </span>
                        )}
                      </td>

                      {/* Actions Column */}
                      <td
                        className="py-3.5 px-5 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isPending ? (
                          <div className="inline-flex items-center justify-end gap-2">
                            <button
                              onClick={() => openRejectModal(request)}
                              disabled={processingId === request.id}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-all disabled:opacity-50 cursor-pointer"
                            >
                              Reject
                            </button>
                            <button
                              onClick={() => handleApprove(request.id, request)}
                              disabled={processingId === request.id}
                              className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-xs transition-all disabled:opacity-50 inline-flex items-center gap-1 cursor-pointer"
                            >
                              {processingId === request.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : null}
                              Approve
                            </button>
                          </div>
                        ) : isApproved ? (
                          <div className="inline-flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleResendApprovalEmail(request)}
                              disabled={processingId === request.id}
                              title={`Resend approval email to ${request.email}`}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#9B9EA4] hover:text-white bg-[#212327] hover:bg-[#2A2D31] border border-[#2A2D31] transition-all inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                            >
                              <Mail className="w-3.5 h-3.5 text-[#FE760B]" />
                              <span>Resend</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-[#9B9EA4] italic">—</span>
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
        {filteredRequests.length > 0 && (
          <div className="p-4 border-t border-[#2A2D31] flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#131517]/40 text-xs text-[#9B9EA4] text-center sm:text-left">
            <div>
              Showing <span className="font-semibold text-white">{startIndex + 1}</span> to{" "}
              <span className="font-semibold text-white">{endIndex}</span> of{" "}
              <span className="font-semibold text-white">{filteredRequests.length}</span> requests
              {filteredRequests.length !== requests.length && (
                <span className="ml-1 opacity-70">({requests.length} total)</span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={activePage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="h-8 border-[#2A2D31] bg-[#1A1C1F] text-white hover:bg-[#212327]"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline ml-1">Prev</span>
              </Button>

              <div className="flex items-center gap-1">
                {getPaginationRange(activePage, totalPages).map((item, idx) => {
                  if (item === "...") {
                    return (
                      <span key={`dots-${idx}`} className="px-2 py-1 text-[#9B9EA4]">
                        …
                      </span>
                    );
                  }
                  const isCurrent = activePage === item;
                  return (
                    <button
                      key={`page-${item}`}
                      onClick={() => setCurrentPage(item)}
                      className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-semibold transition-all ${
                        isCurrent
                          ? "bg-[#FE760B] text-[#131517] font-bold shadow-sm"
                          : "bg-[#1A1C1F] text-[#D0D0D1] hover:bg-[#212327] border border-[#2A2D31]"
                      }`}
                    >
                      {item}
                    </button>
                  );
                })}
              </div>

              <Button
                variant="outline"
                size="sm"
                disabled={activePage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="h-8 border-[#2A2D31] bg-[#1A1C1F] text-white hover:bg-[#212327]"
              >
                <span className="hidden sm:inline mr-1">Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>

            <StyledDropdown
              label="Rows"
              value={pageSize}
              options={[
                { value: 5, label: "5 / page" },
                { value: 10, label: "10 / page" },
                { value: 20, label: "20 / page" },
                { value: 50, label: "50 / page" },
              ]}
              onChange={(val) => {
                setPageSize(Number(val));
                setCurrentPage(1);
              }}
              dropDirection="up"
              align="right"
              buttonClassName="h-8 px-2.5 rounded-xl border-[#2A2D31] bg-[#1A1C1F] text-white"
              menuClassName="w-32"
            />
          </div>
        )}
      </div>

      {/* Detail Slideout/Modal */}
      {selectedDetailRequest &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 touch-none overscroll-contain"
            onClick={() => setSelectedDetailRequest(null)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="hosting-request-detail-title"
          >
            <div
              className="w-full max-w-lg bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto overscroll-contain touch-pan-y"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3
                      id="hosting-request-detail-title"
                      className="text-lg font-bold text-white"
                    >
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
                  aria-label="Close details"
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
          </div>,
          document.body,
        )}

      {/* Rejection Modal */}
      {rejectModalOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 touch-none overscroll-contain"
            onClick={() => {
              setRejectModalOpen(false);
              setRejectionReason("");
              setRequestToReject(null);
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="reject-request-modal-title"
          >
            <div
              className="w-full max-w-md bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto overscroll-contain touch-pan-y"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3
                  id="reject-request-modal-title"
                  className="text-lg font-bold text-white"
                >
                  Reject Hosting Request
                </h3>
                <button
                  onClick={() => {
                    setRejectModalOpen(false);
                    setRejectionReason("");
                    setRequestToReject(null);
                  }}
                  className="p-1 hover:bg-[#212327] rounded-lg text-[#9B9EA4] hover:text-white transition-colors"
                  aria-label="Close"
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
          </div>,
          document.body,
        )}

      {/* Approval Modal */}
      {approvalModalOpen &&
        approvedCredentials &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 touch-none overscroll-contain"
            onClick={() => {
              setApprovalModalOpen(false);
              setApprovedCredentials(null);
              setApprovedRequestData(null);
              setIsExistingOrganiser(false);
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="approve-request-modal-title"
          >
            <div
              className="w-full max-w-md bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto overscroll-contain touch-pan-y"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#3DD68C]/12 flex items-center justify-center text-[#3DD68C]">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3
                    id="approve-request-modal-title"
                    className="text-base font-bold text-white"
                  >
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
                    aria-label="Copy email"
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
          </div>,
          document.body,
        )}
    </div>
  );
}
