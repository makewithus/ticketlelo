"use client";

import { useState, useEffect } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import {
  getAllHostingRequests,
  rejectHostingRequest,
} from "@/lib/hosting-requests";
import { doc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

const REQUESTS_PAGE_SIZE = 5;

function paginate(items, page) {
  const totalPages = Math.max(1, Math.ceil(items.length / REQUESTS_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * REQUESTS_PAGE_SIZE;
  return {
    currentPage,
    totalPages,
    pageItems: items.slice(start, start + REQUESTS_PAGE_SIZE),
    start: items.length === 0 ? 0 : start + 1,
    end: Math.min(start + REQUESTS_PAGE_SIZE, items.length),
  };
}

function PaginationControls({ label, total, pageInfo, onPageChange }) {
  if (total <= REQUESTS_PAGE_SIZE) return null;

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-lg border border-[var(--tl-line)] bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-[rgba(6,26,63,0.64)]">
        Showing{" "}
        <span className="font-semibold text-[#061a3f]">
          {pageInfo.start}-{pageInfo.end}
        </span>{" "}
        of <span className="font-semibold text-[#061a3f]">{total}</span>{" "}
        {label}
      </p>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pageInfo.currentPage === 1}
          onClick={() => onPageChange(pageInfo.currentPage - 1)}
          className="border-[var(--tl-line)] bg-white text-[#061a3f] hover:bg-[#3157ff]/10"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Previous
        </Button>
        <span className="min-w-20 text-center text-sm font-semibold text-[#061a3f]">
          {pageInfo.currentPage} / {pageInfo.totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pageInfo.currentPage === pageInfo.totalPages}
          onClick={() => onPageChange(pageInfo.currentPage + 1)}
          className="border-[var(--tl-line)] bg-white text-[#061a3f] hover:bg-[#3157ff]/10"
        >
          Next
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function HostingRequestManagement() {
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [requestToReject, setRequestToReject] = useState(null);
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [approvedCredentials, setApprovedCredentials] = useState(null);
  const [approvedRequestData, setApprovedRequestData] = useState(null);
  const [isExistingOrganiser, setIsExistingOrganiser] = useState(false);
  const [pendingPage, setPendingPage] = useState(1);
  const [approvedPage, setApprovedPage] = useState(1);
  const [rejectedPage, setRejectedPage] = useState(1);

  const loadRequests = async () => {
    try {
      const allRequests = await getAllHostingRequests();
      setRequests(allRequests);
    } catch (error) {
      console.error("Failed to load requests:", error);
      toast.error("Failed to load hosting requests");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadRequests();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const handleApprove = async (requestId, requestData) => {
    setProcessingId(requestId);
    try {
      console.log(" Starting approval process...", {
        requestId,
        eventTitle: requestData.eventTitle,
      });

      const organiserEmail = requestData.email;

      // Create organiser account using server-side API (won't affect current session)
      console.log(" Creating organiser account via API...");
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
      console.log(" Organiser account ready:", organiserId);

      // Organizer approval never changes or returns a password.
      const finalEmail = responseEmail || organiserEmail;
      toast.info(isExisting
        ? "Organizer access approved. Their existing password was not changed."
        : "Organizer access approved. They can set a password with Forgot password.");

      // Update hosting request
      console.log(" Updating hosting request status...");
      await updateDoc(doc(db, "hostingRequests", requestId), {
        status: "approved",
        organiserId,
        organiserEmail: finalEmail,
        approvedAt: Timestamp.now(),
        isExisting,
      });
      console.log(" Hosting request updated");

      const credentials = {
        organiserId,
        organiserEmail: finalEmail,
      };

      // Store credentials and request data for modal
      setApprovedCredentials(credentials);
      setApprovedRequestData(requestData);
      setIsExistingOrganiser(isExisting);
      setApprovalModalOpen(true);

      // Send approval email
      console.log(" Sending approval email...");
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
          console.log(" Email sent successfully");
          toast.success("Approved! Email sent to " + requestData.email);
        } else {
          console.warn(" Email failed:", emailResult.error);
          toast.warning(
            "Approved but email failed: " +
              (emailResult.error || "Unknown error"),
          );
        }
      } catch (emailError) {
        console.error(" Email sending error:", emailError);
        toast.warning("Approved but failed to send email notification");
      }

      // Reload requests
      await loadRequests();
    } catch (error) {
      console.error(" Approval failed:", error);
      toast.error(error.message || "Failed to approve request");
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

      // Send rejection email
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
        toast.warning("Rejected but failed to send email notification");
      }

      toast.success("Hosting request rejected");
      setRejectModalOpen(false);
      setRejectionReason("");
      setRequestToReject(null);
      loadRequests();
    } catch (error) {
      console.error("Failed to reject request:", error);
      toast.error(error.message || "Failed to reject request");
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
        <Loader2 className="w-8 h-8 animate-spin text-[#3157ff]" />
      </div>
    );
  }

  const pendingRequests = requests.filter((r) => r.status === "pending");
  const approvedRequests = requests.filter((r) => r.status === "approved");
  const rejectedRequests = requests.filter((r) => r.status === "rejected");
  const pendingPageInfo = paginate(pendingRequests, pendingPage);
  const approvedPageInfo = paginate(approvedRequests, approvedPage);
  const rejectedPageInfo = paginate(rejectedRequests, rejectedPage);

  return (
    <div className="space-y-8">
      {/* Pending Requests */}
      <section>
        <h2 className="text-2xl font-extrabold text-[#061a3f] mb-4">
          Pending Requests ({pendingRequests.length})
        </h2>
        <div className="grid gap-4">
          {pendingRequests.length === 0 ? (
            <p className="text-[rgba(6,26,63,0.56)] text-center py-8">
              No pending requests
            </p>
          ) : (
            pendingPageInfo.pageItems.map((request) => (
              <div
                key={request.id}
                className="tl-auth-card p-6 border-l-4 border-l-[#ffe000]"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-[#061a3f]">
                      {request.eventTitle}
                    </h3>
                    <p className="text-sm text-[rgba(6,26,63,0.64)] mt-1">
                      Requested by {request.name}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleApprove(request.id, request)}
                      disabled={processingId === request.id}
                      className="tl-primary-action font-bold"
                    >
                      {processingId === request.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Check className="w-4 h-4 mr-1" />
                          Approve
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => openRejectModal(request)}
                      disabled={processingId === request.id}
                      className="tl-danger-action"
                    >
                      <X className="w-4 h-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2 text-[rgba(6,26,63,0.72)]">
                    <Mail className="w-4 h-4" />
                    {request.email}
                  </div>
                  <div className="flex items-center gap-2 text-[rgba(6,26,63,0.72)]">
                    <Users className="w-4 h-4" />
                    {request.phone}
                  </div>
                  {request.college && (
                    <div className="flex items-center gap-2 text-[rgba(6,26,63,0.72)]">
                      <MapPin className="w-4 h-4" />
                      {request.college}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-[rgba(6,26,63,0.72)]">
                    <Users className="w-4 h-4" />
                    {request.numberOfTickets} tickets
                  </div>
                </div>

                {request.description && (
                  <p className="mt-4 text-[rgba(6,26,63,0.72)] text-sm">
                    {request.description}
                  </p>
                )}

                <div className="mt-4 flex items-center gap-4">
                  {request.isPaid && (
                    <span className="px-3 py-1 bg-[#ffe000]/30 text-[#061a3f] rounded-full text-xs font-medium">
                      Paid Event
                    </span>
                  )}
                  <span className="text-xs text-[rgba(6,26,63,0.56)]">
                    Submitted:{" "}
                    {request.createdAt?.toDate
                      ? new Date(
                          request.createdAt.toDate(),
                        ).toLocaleDateString()
                      : "N/A"}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
        <PaginationControls
          label="pending requests"
          total={pendingRequests.length}
          pageInfo={pendingPageInfo}
          onPageChange={setPendingPage}
        />
      </section>

      {/* Approved Requests */}
      <section>
        <h2 className="text-2xl font-extrabold text-[#061a3f] mb-4">
          Approved Organisers ({approvedRequests.length})
        </h2>
        <div className="grid gap-4">
          {approvedPageInfo.pageItems.map((request) => (
            <div
              key={request.id}
              className="tl-auth-card p-6 border-l-4 border-l-[#3157ff]"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold text-[#061a3f]">
                    {request.eventTitle}
                  </h3>
                  <p className="text-sm text-[rgba(6,26,63,0.64)] mt-1">
                    Organiser: {request.name}
                  </p>
                </div>
                <span className="px-3 py-1 bg-[#008d46]/10 text-[#008d46] rounded-full text-xs font-medium">
                  Approved
                </span>
              </div>

              <div className="bg-[#f8fafc] border border-[var(--tl-line)] rounded-lg p-4 space-y-3">
                <h4 className="font-semibold text-[#061a3f]">Organizer sign-in</h4>
                <p className="font-mono text-sm text-[#061a3f]">{request.organiserEmail}</p>
                <p className="text-xs text-[rgba(6,26,63,0.64)]">
                  Passwords are not stored or shown here. The organizer can use the Forgot password flow to set or recover access.
                </p>
              </div>

              <div className="mt-4 text-xs text-[rgba(6,26,63,0.56)]">
                Approved:{" "}
                {request.approvedAt?.toDate
                  ? new Date(request.approvedAt.toDate()).toLocaleDateString()
                  : "N/A"}
              </div>
            </div>
          ))}
        </div>
        <PaginationControls
          label="approved organisers"
          total={approvedRequests.length}
          pageInfo={approvedPageInfo}
          onPageChange={setApprovedPage}
        />
      </section>

      {/* Rejected Requests */}
      {rejectedRequests.length > 0 && (
        <section>
          <h2 className="text-2xl font-extrabold text-[#061a3f] mb-4">
            Rejected Requests ({rejectedRequests.length})
          </h2>
          <div className="grid gap-4">
            {rejectedPageInfo.pageItems.map((request) => (
              <div
                key={request.id}
                className="tl-auth-card p-6 border-l-4 border-l-red-500 opacity-90"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-bold text-[#061a3f]">
                      {request.eventTitle}
                    </h3>
                    <p className="text-sm text-[rgba(6,26,63,0.64)] mt-1">
                      {request.name}
                    </p>
                  </div>
                  <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                    Rejected
                  </span>
                </div>
              </div>
            ))}
          </div>
          <PaginationControls
            label="rejected requests"
            total={rejectedRequests.length}
            pageInfo={rejectedPageInfo}
            onPageChange={setRejectedPage}
          />
        </section>
      )}

      {/* Rejection Modal */}
      {rejectModalOpen && typeof document !== "undefined" && createPortal(
        <>
          <div
            className="fixed inset-0 z-[200] overscroll-contain bg-[#061a3f]/55 backdrop-blur-sm"
            onClick={() => {
              setRejectModalOpen(false);
              setRejectionReason("");
              setRequestToReject(null);
            }}
          />
          <div className="tl-system-theme tl-modal-frame fixed inset-0 z-[201] flex items-center justify-center overflow-y-auto overscroll-contain p-3 sm:p-5" onClick={(event) => event.stopPropagation()}>
            <div role="dialog" aria-modal="true" aria-labelledby="rejection-modal-title" className="tl-auth-card my-auto max-h-[min(92dvh,48rem)] w-full max-w-md overflow-y-auto p-4 sm:p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 id="rejection-modal-title" className="text-xl font-bold text-[#061a3f]">
                  Reject Hosting Request
                </h3>
                <button
                  onClick={() => {
                    setRejectModalOpen(false);
                    setRejectionReason("");
                    setRequestToReject(null);
                  }}
                  className="p-1 hover:bg-[#3157ff]/10 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-[rgba(6,26,63,0.56)]" />
                </button>
              </div>

              {requestToReject && (
                <div className="mb-4 p-4 bg-[#3157ff]/10 rounded-lg border border-[#3157ff]/20">
                  <h4 className="text-[#061a3f] font-semibold mb-1">
                    {requestToReject.eventTitle}
                  </h4>
                  <p className="text-sm text-[rgba(6,26,63,0.64)]">
                    Requested by {requestToReject.name}
                  </p>
                  <p className="text-sm text-[rgba(6,26,63,0.64)]">
                    {requestToReject.email}
                  </p>
                </div>
              )}

              <div className="mb-6">
                <label className="block text-sm font-medium text-[#061a3f] mb-2">
                  Rejection Reason <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Please provide a detailed reason for rejection..."
                  rows={5}
                  className="w-full px-4 py-3 bg-white border border-[var(--tl-line)] rounded-lg text-[#061a3f] placeholder:text-[rgba(6,26,63,0.45)] focus:outline-none focus:border-[#3157ff] transition-colors resize-none"
                />
                <p className="text-xs text-[rgba(6,26,63,0.56)] mt-2">
                  This reason will be sent to the user via email.
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={handleReject}
                  disabled={
                    !rejectionReason.trim() ||
                    processingId === requestToReject?.id
                  }
                  className="tl-danger-action flex-1 font-semibold py-2.5 transition-all disabled:opacity-50"
                >
                  {processingId === requestToReject?.id ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />{" "}
                      Rejecting...
                    </>
                  ) : (
                    <>Reject Request</>
                  )}
                </Button>
                <Button
                  onClick={() => {
                    setRejectModalOpen(false);
                    setRejectionReason("");
                    setRequestToReject(null);
                  }}
                  className="flex-1 bg-white hover:bg-[#3157ff]/10 text-[#061a3f] border border-[var(--tl-line)] font-semibold py-2.5 rounded-lg transition-all"
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
            className="fixed inset-0 z-[200] overscroll-contain bg-[#061a3f]/55 backdrop-blur-sm"
            onClick={() => {
              setApprovalModalOpen(false);
              setApprovedCredentials(null);
              setApprovedRequestData(null);
              setIsExistingOrganiser(false);
            }}
          />
          <div className="tl-system-theme tl-modal-frame fixed inset-0 z-[201] flex items-center justify-center overflow-y-auto overscroll-contain p-3 sm:p-4">
            <div className="tl-auth-card max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto p-4 sm:max-h-[calc(100dvh-2rem)] sm:p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-lg bg-[#008d46]/10 flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-[#008d46]" />
                  </div>
                  <h3 id="approval-modal-title" className="text-lg font-bold text-[#061a3f]">
                    Request Approved!
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setApprovalModalOpen(false);
                    setApprovedCredentials(null);
                    setIsExistingOrganiser(false);
                    setApprovedRequestData(null);
                  }}
                  className="p-1 hover:bg-[#3157ff]/10 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-[rgba(6,26,63,0.56)]" />
                </button>
              </div>

              {approvedRequestData && (
                <div className="mb-3 rounded-lg border border-[#3157ff]/20 bg-[#3157ff]/10 p-3">
                  <h4 className="text-[#061a3f] font-semibold mb-1">
                    {approvedRequestData.eventTitle}
                  </h4>
                  <p className="text-sm text-[rgba(6,26,63,0.64)]">
                    Organiser: {approvedRequestData.name}
                  </p>
                  <p className="text-sm text-[rgba(6,26,63,0.64)]">
                    {approvedRequestData.email}
                  </p>
                </div>
              )}

              <div className="mb-3 rounded-lg border border-[#008d46]/20 bg-[#008d46]/10 p-3">
                <p className="text-sm text-[#008d46] flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Approval email sent to {approvedRequestData?.email}
                </p>
              </div>

              <div className="mb-3 space-y-2 rounded-lg border border-[var(--tl-line)] bg-[#f8fafc] p-3">
                <h4 className="font-semibold text-[#061a3f] flex items-center gap-2">
                  <KeyRound className="h-4 w-4" /> Organiser Credentials
                </h4>

                <div className="rounded border border-[var(--tl-line)] bg-white p-2.5">
                  <p className="mb-1 text-xs text-[rgba(6,26,63,0.56)]">EMAIL</p>
                  <div className="flex items-center justify-between gap-2">
                    <p className="min-w-0 break-all font-mono text-sm text-[#061a3f]">
                      {approvedCredentials.organiserEmail}
                    </p>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(
                          approvedCredentials.organiserEmail,
                        );
                        toast.success("Email copied!");
                      }}
                      className="p-1.5 hover:bg-[#3157ff]/10 rounded transition-colors"
                    >
                      <Copy className="w-4 h-4 text-[#3157ff]" />
                    </button>
                  </div>
                </div>

                <div className="rounded-lg border border-[#ffe000]/50 bg-[#ffe000]/20 p-2.5">
                  <p className="text-xs text-[#061a3f] flex gap-2">
                    <Info className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                    {isExistingOrganiser ? (
                      <>This existing account keeps its current password. No credential was reset.</>
                    ) : (
                      <>The organizer can set a password using Forgot password on the organizer sign-in page.</>
                    )}
                    </span>
                  </p>
                </div>
              </div>

              <Button
                onClick={() => {
                  setApprovalModalOpen(false);
                  setApprovedCredentials(null);
                  setApprovedRequestData(null);
                  setIsExistingOrganiser(false);
                }}
                className="tl-primary-action min-h-10 w-full py-2 font-semibold transition-all"
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
