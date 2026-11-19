/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { StyledDropdown } from "@/components/ui/styled-dropdown";
import { BrandLoader } from "@/components/ui/brand-loader";
import { SuperAdminTableSkeleton } from "@/components/ui/skeleton";
import { getCachedItem, setCachedItem } from "@/lib/client-cache";
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
import { formatPhoneDisplay } from "@/lib/phone-validation";

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
      year: "numeric",
      timeZone: "Asia/Kolkata",
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
      timeZone: "Asia/Kolkata",
    });
  } catch {
    return "Recently";
  }
}

export function HostingRequestManagement() {
  // Synchronous cache hydration for instant display
  const [requests, setRequests] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = getCachedItem("superadmin_hosting_requests");
        if (Array.isArray(cached) && cached.length > 0) return cached;
      } catch {}
    }
    return [];
  });
  const [isLoading, setIsLoading] = useState(() => requests.length === 0);
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
  const [approvalConfirmModalOpen, setApprovalConfirmModalOpen] = useState(false);
  const [requestToApprove, setRequestToApprove] = useState(null);
  const [isApproving, setIsApproving] = useState(false);
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
        setCachedItem("superadmin_hosting_requests", safeRequests, 10 * 60 * 1000);
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
    selectedDetailRequest || rejectModalOpen || approvalModalOpen || approvalConfirmModalOpen
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
        if (approvalConfirmModalOpen) {
          if (!isApproving) {
            setApprovalConfirmModalOpen(false);
            setRequestToApprove(null);
          }
        } else if (approvalModalOpen) {
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
  }, [isAnyModalOpen, approvalModalOpen, approvalConfirmModalOpen, isApproving, rejectModalOpen, selectedDetailRequest]);

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
          isResend: true,
          requestId: reqId,
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
    let pending = 0;
    let approved = 0;
    let rejected = 0;

    for (const r of requests) {
      const st = (r.status || "pending").toLowerCase().trim();
      if (st === "pending") {
        pending++;
      } else if (st === "approved") {
        approved++;
      } else if (st === "rejected") {
        rejected++;
      } else {
        pending++;
      }
    }

    return {
      total: requests.length,
      pending,
      approved,
      rejected,
    };
  }, [requests]);

  const filteredRequests = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const list = requests.filter((req) => {
      const rawStatus = (req.status || "pending").toLowerCase().trim();
      const matchesStatus =
        statusFilter === "all" ? true : rawStatus === statusFilter;
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
      const rawAStatus = (a.status || "pending").toLowerCase().trim();
      const rawBStatus = (b.status || "pending").toLowerCase().trim();
      const aPending = rawAStatus === "pending";
      const bPending = rawBStatus === "pending";

      const getTime = (item) => {
        if (!item?.createdAt) return 0;
        if (typeof item.createdAt.toMillis === "function") return item.createdAt.toMillis();
        if (typeof item.createdAt.toDate === "function") return item.createdAt.toDate().getTime();
        if (typeof item.createdAt.seconds === "number") return item.createdAt.seconds * 1000;
        const parsed = new Date(item.createdAt).getTime();
        return isNaN(parsed) ? 0 : parsed;
      };

      const ta = getTime(a);
      const tb = getTime(b);

      const tieBreak = (itemA, itemB) => (itemA.id || "").localeCompare(itemB.id || "");

      if (sortBy === "urgent") {
        if (aPending && !bPending) return -1;
        if (!aPending && bPending) return 1;
        const diff = tb - ta;
        return diff !== 0 ? diff : tieBreak(a, b);
      }

      if (sortBy === "oldest") {
        const diff = ta - tb;
        return diff !== 0 ? diff : tieBreak(a, b);
      }

      if (sortBy === "title") {
        const diff = (a.eventTitle || "").localeCompare(b.eventTitle || "");
        return diff !== 0 ? diff : tieBreak(a, b);
      }

      if (sortBy === "tickets") {
        const tA = Number(a.numberOfTickets || a.expectedAttendees || 0);
        const tB = Number(b.numberOfTickets || b.expectedAttendees || 0);
        const diff = tB - tA;
        return diff !== 0 ? diff : tieBreak(a, b);
      }

      // Default: newest
      const diff = tb - ta;
      return diff !== 0 ? diff : tieBreak(a, b);
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

  const openApproveModal = (req) => {
    const rawStatus = (req?.status || "pending").toLowerCase().trim();
    if (rawStatus !== "pending") {
      toast.error(`Cannot approve request: this request is already ${rawStatus}.`);
      return;
    }
    setRequestToApprove(req);
    setApprovalConfirmModalOpen(true);
  };

  const handleConfirmApprove = async () => {
    if (!requestToApprove) return;
    const reqId = requestToApprove.id;
    const rawStatus = (requestToApprove.status || "pending").toLowerCase().trim();
    if (rawStatus !== "pending") {
      toast.error(`Cannot approve request: request is already ${rawStatus}.`);
      setApprovalConfirmModalOpen(false);
      return;
    }

    setProcessingId(reqId);
    setIsApproving(true);
    const toastId = `approve-${reqId}`;
    toast.loading("Approving organizer access...", { id: toastId });

    const startOverall = performance.now();
    try {
      const organiserEmail = requestToApprove.email;

      const tCreateStart = performance.now();
      const createResponse = await fetch("/api/create-organiser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: organiserEmail,
          name: requestToApprove.name,
          phone: requestToApprove.phone,
          college: requestToApprove.college,
          eventTitle: requestToApprove.eventTitle,
        }),
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json().catch(() => ({}));
        throw new Error(
          errorData.error || "Failed to create organiser account",
        );
      }

      const createData = await createResponse.json().catch(() => ({}));
      const createDuration = Math.round(performance.now() - tCreateStart);

      const {
        organiserId,
        isExisting,
        organiserEmail: responseEmail,
      } = createData;

      const finalEmail = responseEmail || organiserEmail;

      const tDbStart = performance.now();
      await updateDoc(doc(db, "hostingRequests", reqId), {
        status: "approved",
        organiserId,
        organiserEmail: finalEmail,
        approvedAt: Timestamp.now(),
        isExisting,
      });
      const dbDuration = Math.round(performance.now() - tDbStart);

      const credentials = {
        organiserId,
        organiserEmail: finalEmail,
      };

      setApprovalConfirmModalOpen(false);
      setApprovedCredentials(credentials);
      setApprovedRequestData(requestToApprove);
      setIsExistingOrganiser(isExisting);
      setApprovalModalOpen(true);

      let emailSent = false;
      const tEmailStart = performance.now();
      try {
        const emailResponse = await fetch("/api/send-approval-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: requestToApprove.name,
            email: requestToApprove.email,
            eventTitle: requestToApprove.eventTitle,
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
      const emailDuration = Math.round(performance.now() - tEmailStart);
      const totalDuration = Math.round(performance.now() - startOverall);

      console.log(`[Approval Performance] Account Provisioning: ${createDuration}ms, Firestore Update: ${dbDuration}ms, Email Dispatch: ${emailDuration}ms, Total: ${totalDuration}ms`);

      if (emailSent) {
        toast.success("Approved! Email sent to " + requestToApprove.email, { id: toastId });
      } else {
        toast.warning("Approved! (Account active, but email delivery had an issue)", { id: toastId });
      }

      setRequestToApprove(null);
      await loadRequests();
    } catch (error) {
      console.error("Approval failed:", error);
      toast.error(error?.message || "Failed to approve request", { id: toastId });
    } finally {
      setProcessingId(null);
      setIsApproving(false);
    }
  };

  const handleApprove = (requestId, requestData) => {
    openApproveModal({ id: requestId, ...requestData });
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

  if (isLoading && requests.length === 0) {
    return <SuperAdminTableSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Search & Filter Toolbar */}
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Spacious Search Bar */}
          <div className="relative flex-1 min-w-[260px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-[#9B9EA4]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by event title, organizer name, college, email..."
              className="w-full h-10 pl-10 pr-4 bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-[#9B9EA4] focus:outline-none focus:border-[#FE760B] transition-colors"
            />
          </div>

          {/* Status Filter Badges & Live Status */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {/* Real-time Status Indicator (No manual refresh button) */}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] text-xs">
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
                  isLiveConnected ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-[#9B9EA4]"
                }`}
              >
                {isLiveConnected ? "Live" : "Syncing"}
              </span>
            </div>

            {/* Status Segmented Buttons */}
            <div className="inline-flex items-center bg-slate-100 dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] rounded-xl p-1 gap-1 flex-wrap sm:flex-nowrap">
              <button
                onClick={() => {
                  setStatusFilter("all");
                  setCurrentPage(1);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                  statusFilter === "all"
                    ? "bg-white dark:bg-[#212327] text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-600 dark:text-[#9B9EA4] hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                All ({counts.total})
              </button>
              <button
                onClick={() => {
                  setStatusFilter("pending");
                  setCurrentPage(1);
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                  statusFilter === "pending"
                    ? "bg-white dark:bg-[#212327] text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-600 dark:text-[#9B9EA4] hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#FDE003]" />
                Pending ({counts.pending})
              </button>
              <button
                onClick={() => {
                  setStatusFilter("approved");
                  setCurrentPage(1);
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                  statusFilter === "approved"
                    ? "bg-white dark:bg-[#212327] text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-600 dark:text-[#9B9EA4] hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#3DD68C]" />
                Approved ({counts.approved})
              </button>
              <button
                onClick={() => {
                  setStatusFilter("rejected");
                  setCurrentPage(1);
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                  statusFilter === "rejected"
                    ? "bg-white dark:bg-[#212327] text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-600 dark:text-[#9B9EA4] hover:text-slate-900 dark:hover:text-white"
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

      {/* Requests Table Container (Desktop table & Mobile card layout) */}
      <div className="bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] rounded-2xl overflow-hidden shadow-xs">
        {/* Desktop Table: Hidden on screens < md */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full min-w-[800px] text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-[#2A2D31] bg-slate-50/70 dark:bg-[#131517]/50">
                <th className="py-3 px-5 text-[12px] font-semibold text-slate-500 dark:text-[#9B9EA4] uppercase tracking-[0.6px] whitespace-nowrap min-w-[220px]">
                  EVENT
                </th>
                <th className="py-3 px-5 text-[12px] font-semibold text-slate-500 dark:text-[#9B9EA4] uppercase tracking-[0.6px] whitespace-nowrap min-w-[200px]">
                  REQUESTED BY
                </th>
                <th className="py-3 px-4 text-[12px] font-semibold text-slate-500 dark:text-[#9B9EA4] uppercase tracking-[0.6px] text-center whitespace-nowrap">
                  TYPE
                </th>
                <th className="py-3 px-4 text-[12px] font-semibold text-slate-500 dark:text-[#9B9EA4] uppercase tracking-[0.6px] text-center whitespace-nowrap">
                  TICKETS
                </th>
                <th className="py-3 px-5 text-[12px] font-semibold text-slate-500 dark:text-[#9B9EA4] uppercase tracking-[0.6px] text-center whitespace-nowrap">
                  STATUS
                </th>
                <th className="py-3 px-5 text-[12px] font-semibold text-slate-500 dark:text-[#9B9EA4] uppercase tracking-[0.6px] text-right whitespace-nowrap">
                  ACTIONS
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-[#2A2D31]">
              {paginatedRequests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 dark:text-[#9B9EA4] text-sm">
                    No hosting requests found matching your filter.
                  </td>
                </tr>
              ) : (
                paginatedRequests.map((request) => {
                  const rawStatus = (request.status || "pending").toLowerCase().trim();
                  const isPending = rawStatus === "pending";
                  const isApproved = rawStatus === "approved";
                  const isRejected = rawStatus === "rejected";

                  return (
                    <tr
                      key={request.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-[#212327]/60 transition-colors group cursor-pointer"
                      onClick={() => setSelectedDetailRequest(request)}
                    >
                      {/* Event Column */}
                      <td className="py-3.5 px-5 min-w-[220px]">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-slate-100 dark:bg-[#212327] border border-slate-200 dark:border-[#2A2D31] flex items-center justify-center font-bold text-xs text-slate-900 dark:text-white">
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
                            <div className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-[#FE760B] transition-colors">
                              {request.eventTitle}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-[#9B9EA4] mt-0.5 whitespace-nowrap">
                              Sent {formatRequestDate(request.createdAt)}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Requested By Column */}
                      <td className="py-3.5 px-5 min-w-[200px]">
                        <div>
                          <span className="text-sm font-medium text-slate-900 dark:text-white">
                            {request.name}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-[#9B9EA4] mt-0.5 truncate max-w-[220px]">
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
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-transparent">
                            Free
                          </span>
                        )}
                      </td>

                      {/* Tickets Column */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span className="text-sm text-slate-900 dark:text-white font-mono font-semibold tabular-nums">
                          {request.numberOfTickets || "—"}
                        </span>
                      </td>

                      {/* Status Column */}
                      <td className="py-3.5 px-5 text-center whitespace-nowrap">
                        {isPending ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-500 dark:text-amber-400 border border-amber-500/25">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400 animate-pulse" />
                            Pending
                          </span>
                        ) : isApproved ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                            Approved
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/25">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 dark:bg-red-400" />
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
                              onClick={() => openApproveModal(request)}
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
                              className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-[#9B9EA4] hover:text-slate-900 dark:hover:text-white bg-white dark:bg-[#212327] hover:bg-slate-50 dark:hover:bg-[#2A2D31] border border-slate-200 dark:border-[#2A2D31] transition-all inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-2xs"
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

        {/* Mobile Card Layout: Rendered on screens < md (375px, 390px, 430px) */}
        <div className="md:hidden divide-y divide-slate-200 dark:divide-[#2A2D31]">
          {paginatedRequests.length === 0 ? (
            <div className="p-8 text-center text-slate-400 dark:text-[#9B9EA4] text-xs">
              No hosting requests found matching your filter.
            </div>
          ) : (
            paginatedRequests.map((request) => {
              const rawStatus = (request.status || "pending").toLowerCase().trim();
              const isPending = rawStatus === "pending";
              const isApproved = rawStatus === "approved";
              const isRejected = rawStatus === "rejected";

              return (
                <div
                  key={request.id}
                  className="p-4 space-y-3 hover:bg-slate-50/50 dark:hover:bg-[#212327]/40 transition-colors"
                >
                  {/* Top: Event Title + Status Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className="flex items-center gap-2.5 min-w-0 cursor-pointer"
                      onClick={() => setSelectedDetailRequest(request)}
                    >
                      <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-slate-100 dark:bg-[#212327] border border-slate-200 dark:border-[#2A2D31] flex items-center justify-center font-bold text-xs text-slate-900 dark:text-white">
                        {request.coverUrl ? (
                          <img
                            src={request.coverUrl}
                            alt={request.eventTitle}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-[#FE760B]">
                            {request.eventTitle?.charAt(0) || "E"}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {request.eventTitle}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-[#9B9EA4]">
                          Sent {formatRequestDate(request.createdAt)}
                        </div>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="shrink-0">
                      {isPending ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-500 dark:text-amber-400 border border-amber-500/25">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          Pending
                        </span>
                      ) : isApproved ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Approved
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/25">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                          Rejected
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Organizer Details */}
                  <div
                    className="bg-slate-50 dark:bg-[#131517]/60 p-3 rounded-xl border border-slate-200 dark:border-[#2A2D31] text-xs space-y-1.5 cursor-pointer"
                    onClick={() => setSelectedDetailRequest(request)}
                  >
                    <div className="flex items-center justify-between text-slate-700 dark:text-[#D0D0D1]">
                      <span className="font-semibold text-slate-900 dark:text-white">{request.name}</span>
                      <span className="text-[11px] text-slate-500 dark:text-[#9B9EA4] truncate max-w-[140px]">
                        {request.college || "Independent Organiser"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-[#9B9EA4]">
                      <span className="truncate max-w-[180px]">{request.email}</span>
                      <span className="font-mono">{formatPhoneDisplay(request.phone)}</span>
                    </div>
                    <div className="flex items-center justify-between pt-1.5 border-t border-slate-200 dark:border-[#2A2D31]/50 text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400">Type:</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          request.isPaid
                            ? "bg-[#FE760B]/15 text-[#FE760B] border border-[#FE760B]/30"
                            : "bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300"
                        }`}>
                          {request.isPaid ? "Paid" : "Free"}
                        </span>
                      </div>
                      <div className="text-slate-700 dark:text-[#D0D0D1]">
                        Tickets: <span className="font-mono font-semibold">{request.numberOfTickets || "—"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Mobile Actions: Accessible touch target >= 44px */}
                  <div className="pt-1">
                    {isPending ? (
                      <div className="grid grid-cols-2 gap-2.5">
                        <button
                          type="button"
                          onClick={() => openRejectModal(request)}
                          disabled={processingId === request.id}
                          className="h-11 rounded-xl text-xs font-semibold text-red-500 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                          <span>Reject</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openApproveModal(request)}
                          disabled={processingId === request.id}
                          className="h-11 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-sm active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          {processingId === request.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Check className="w-4 h-4 stroke-[3]" />
                          )}
                          <span>Approve</span>
                        </button>
                      </div>
                    ) : isApproved ? (
                      <button
                        type="button"
                        onClick={() => handleResendApprovalEmail(request)}
                        disabled={processingId === request.id}
                        className="w-full h-11 rounded-xl text-xs font-semibold text-slate-700 dark:text-[#D0D0D1] bg-slate-100 dark:bg-[#212327] hover:bg-slate-200 dark:hover:bg-[#2A2D31] border border-slate-200 dark:border-[#2A2D31] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
                      >
                        <Mail className="w-4 h-4 text-[#FE760B]" />
                        <span>Resend Approval Email</span>
                      </button>
                    ) : (
                      <div className="text-center py-1.5 px-3 rounded-lg bg-red-500/5 border border-red-500/10 text-xs text-red-500 dark:text-red-400">
                        {request.rejectionReason ? `Reason: ${request.rejectionReason}` : "Request Rejected"}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
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
                      const req = selectedDetailRequest;
                      setSelectedDetailRequest(null);
                      openApproveModal(req);
                    }}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white h-10 rounded-xl text-xs font-semibold shadow-none border-none cursor-pointer"
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

      {/* Approval Confirmation Dialog (Pre-approval guard) */}
      {approvalConfirmModalOpen &&
        requestToApprove &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overscroll-contain animate-in fade-in duration-200"
            onClick={() => {
              if (!isApproving) {
                setApprovalConfirmModalOpen(false);
                setRequestToApprove(null);
              }
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="approve-confirm-title"
          >
            <div
              className="w-full max-w-md bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200 dark:border-[#2A2D31]">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3
                      id="approve-confirm-title"
                      className="text-base font-bold text-slate-900 dark:text-white"
                    >
                      Confirm Organizer Approval
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-[#9B9EA4]">
                      Review details before granting organizer permissions
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (!isApproving) {
                      setApprovalConfirmModalOpen(false);
                      setRequestToApprove(null);
                    }
                  }}
                  disabled={isApproving}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-[#212327] rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors disabled:opacity-50"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Request & Organiser Summary Card */}
              <div className="bg-slate-50 dark:bg-[#212327] border border-slate-200 dark:border-[#2A2D31] rounded-xl p-3.5 space-y-2 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-[#9B9EA4] tracking-wider">
                    EVENT
                  </span>
                  <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                    {requestToApprove.eventTitle}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200 dark:border-[#2A2D31]">
                  <div>
                    <span className="text-[10px] text-slate-400 dark:text-[#9B9EA4]">Host Name</span>
                    <div className="font-semibold text-slate-800 dark:text-[#D0D0D1]">
                      {requestToApprove.name}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 dark:text-[#9B9EA4]">College / Org</span>
                    <div className="font-semibold text-slate-800 dark:text-[#D0D0D1] truncate">
                      {requestToApprove.college || "Independent Organiser"}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 dark:text-[#9B9EA4]">Email</span>
                    <div className="font-mono text-slate-800 dark:text-[#D0D0D1] truncate">
                      {requestToApprove.email}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 dark:text-[#9B9EA4]">Phone</span>
                    <div className="font-mono text-slate-800 dark:text-[#D0D0D1]">
                      {formatPhoneDisplay(requestToApprove.phone)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-[#2A2D31]">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 dark:text-[#9B9EA4]">Type:</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      requestToApprove.isPaid
                        ? "bg-[#FE760B]/15 text-[#FE760B] border border-[#FE760B]/30"
                        : "bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300"
                    }`}>
                      {requestToApprove.isPaid ? "Paid Event" : "Free Event"}
                    </span>
                  </div>
                  <div className="text-[11px] font-semibold text-slate-700 dark:text-[#D0D0D1]">
                    Tickets: <span className="font-mono">{requestToApprove.numberOfTickets || "—"}</span>
                  </div>
                </div>
              </div>

              {/* Effect of Approval Explanation */}
              <div className="p-3 bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/20 rounded-xl space-y-1 text-xs text-amber-700 dark:text-amber-300">
                <div className="font-bold flex items-center gap-1.5 text-xs text-amber-800 dark:text-amber-200">
                  <Info className="w-3.5 h-3.5 shrink-0" />
                  <span>Effect of Approval:</span>
                </div>
                <ul className="list-disc pl-5 space-y-0.5 text-[11px] text-slate-600 dark:text-[#9B9EA4]">
                  <li>Creates or links an organizer account for this email.</li>
                  <li>Grants organizer privileges to create and publish events.</li>
                  <li>Sends an official approval notification email to {requestToApprove.email}.</li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2.5 pt-2">
                <Button
                  type="button"
                  onClick={() => {
                    setApprovalConfirmModalOpen(false);
                    setRequestToApprove(null);
                  }}
                  disabled={isApproving}
                  variant="outline"
                  className="flex-1 bg-slate-100 dark:bg-[#212327] hover:bg-slate-200 dark:hover:bg-[#2A2D31] text-slate-700 dark:text-white border border-slate-200 dark:border-[#2A2D31] h-10 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirmApprove}
                  disabled={isApproving}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-10 rounded-xl text-xs shadow-md transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isApproving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Approving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      <span>Confirm & Approve</span>
                    </>
                  )}
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
