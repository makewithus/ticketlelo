"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  Check,
  X,
  Eye,
  EyeOff,
  Mail,
  Calendar,
  Users,
  MapPin,
  Copy,
  CheckCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  getAllHostingRequests,
  rejectHostingRequest,
  updateOrganiserCredentials,
} from "@/lib/hosting-requests";
import { doc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export function HostingRequestManagement() {
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showCredentials, setShowCredentials] = useState({});
  const [editingCredentials, setEditingCredentials] = useState(null);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [requestToReject, setRequestToReject] = useState(null);
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [approvedCredentials, setApprovedCredentials] = useState(null);
  const [approvedRequestData, setApprovedRequestData] = useState(null);
  const [isExistingOrganiser, setIsExistingOrganiser] = useState(false);

  useEffect(() => {
    loadRequests();
  }, []);

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

  // Generate secure password (alphanumeric + @ only for good UX)
  const generateSecurePassword = () => {
    const letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const numbers = "0123456789";
    let password = "";

    // Add 6 letters
    for (let i = 0; i < 6; i++) {
      password += letters.charAt(Math.floor(Math.random() * letters.length));
    }

    // Add 5 numbers
    for (let i = 0; i < 5; i++) {
      password += numbers.charAt(Math.floor(Math.random() * numbers.length));
    }

    // Add 1 @ symbol
    password += "@";

    // Shuffle the password for better security
    return password
      .split("")
      .sort(() => Math.random() - 0.5)
      .join("");
  };

  // Generate organiser email from event name (clean format)
  const generateOrganiserEmail = (eventTitle, suffix = "") => {
    const sanitized = eventTitle
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .substring(0, 20);
    const emailPrefix = suffix ? `${sanitized}${suffix}` : sanitized;
    return `${emailPrefix}@ticketlelo.com`;
  };

  const handleApprove = async (requestId, requestData) => {
    setProcessingId(requestId);
    try {
      console.log("🔄 Starting approval process...", {
        requestId,
        eventTitle: requestData.eventTitle,
      });

      // Generate credentials
      // IMPORTANT: Generate email as eventname@ticketlelo.com (NOT personal email)
      // For existing users, API will return their ORIGINAL email from database
      const organiserEmail = generateOrganiserEmail(requestData.eventTitle);
      const organiserPassword = generateSecurePassword();
      console.log("✅ Generated email for new user:", organiserEmail);
      console.log(
        "ℹ️ (If user exists, API will return their original email from database)",
      );

      // Create organiser account using server-side API (won't affect current session)
      console.log("🔐 Creating organiser account via API...");
      const createResponse = await fetch("/api/create-organiser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: organiserEmail,
          password: organiserPassword,
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
        organiserPassword: responsePassword,
      } = createData;
      console.log("✅ Organiser account ready:", organiserId);

      // Use email and password from API response (handles both new and existing users)
      const finalEmail = responseEmail || organiserEmail;
      const finalPassword = responsePassword || organiserPassword;

      console.log("📧 Credentials to show:", {
        email: finalEmail,
        isExisting,
        message: isExisting
          ? "Updated existing account"
          : "Created new account",
      });

      if (isExisting) {
        console.log(
          "✅ Used existing account, updated password, and increased event limit",
        );
        toast.info(
          "Organiser already exists. Password updated and event limit increased!",
        );
      }

      // Update hosting request
      console.log("📋 Updating hosting request status...");
      await updateDoc(doc(db, "hostingRequests", requestId), {
        status: "approved",
        organiserId,
        organiserEmail: finalEmail,
        organiserPassword: finalPassword,
        approvedAt: Timestamp.now(),
        isExisting,
      });
      console.log("✅ Hosting request updated");

      const credentials = {
        organiserId,
        organiserEmail: finalEmail,
        organiserPassword: finalPassword,
      };

      // Store credentials and request data for modal
      setApprovedCredentials(credentials);
      setApprovedRequestData(requestData);
      setIsExistingOrganiser(isExisting);
      setApprovalModalOpen(true);

      // Send approval email
      console.log("📧 Sending approval email...");
      try {
        const emailResponse = await fetch("/api/send-approval-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: requestData.name,
            email: requestData.email,
            eventTitle: requestData.eventTitle,
            organiserEmail: credentials.organiserEmail,
            organiserPassword: credentials.organiserPassword,
            isExisting,
          }),
        });

        const emailResult = await emailResponse.json();
        if (emailResult.success) {
          console.log("✅ Email sent successfully");
          toast.success("✅ Approved! Email sent to " + requestData.email);
        } else {
          console.warn("⚠️ Email failed:", emailResult.error);
          toast.warning(
            "⚠️ Approved but email failed: " +
              (emailResult.error || "Unknown error"),
          );
        }
      } catch (emailError) {
        console.error("❌ Email sending error:", emailError);
        toast.warning("⚠️ Approved but failed to send email notification");
      }

      // Reload requests
      await loadRequests();
    } catch (error) {
      console.error("❌ Approval failed:", error);
      toast.error("❌ " + (error.message || "Failed to approve request"));
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

  const handleUpdateCredentials = async (request) => {
    try {
      await updateOrganiserCredentials(
        request.organiserId,
        newEmail,
        newPassword,
      );
      toast.success("Credentials updated successfully");
      setEditingCredentials(null);
      setNewEmail("");
      setNewPassword("");
      loadRequests();
    } catch (error) {
      console.error("Failed to update credentials:", error);
      toast.error(error.message || "Failed to update credentials");
    }
  };

  const toggleShowPassword = (requestId) => {
    setShowCredentials((prev) => ({
      ...prev,
      [requestId]: !prev[requestId],
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  const pendingRequests = requests.filter((r) => r.status === "pending");
  const approvedRequests = requests.filter((r) => r.status === "approved");
  const rejectedRequests = requests.filter((r) => r.status === "rejected");

  return (
    <div className="space-y-8">
      {/* Pending Requests */}
      <section>
        <h2 className="text-2xl font-bold text-slate-100 mb-4">
          Pending Requests ({pendingRequests.length})
        </h2>
        <div className="grid gap-4">
          {pendingRequests.length === 0 ? (
            <p className="text-slate-500 text-center py-8">
              No pending requests
            </p>
          ) : (
            pendingRequests.map((request) => (
              <div
                key={request.id}
                className="bg-slate-900/60 dark:bg-slate-900/60 rounded-lg shadow border border-emerald-500/10 p-6 border-l-4 border-yellow-500"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-slate-100">
                      {request.eventTitle}
                    </h3>
                    <p className="text-sm text-slate-300 mt-1">
                      Requested by {request.name}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleApprove(request.id, request)}
                      disabled={processingId === request.id}
                      className="bg-emerald-600 hover:bg-emerald-700"
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
                      variant="destructive"
                      onClick={() => openRejectModal(request)}
                      disabled={processingId === request.id}
                    >
                      <X className="w-4 h-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Mail className="w-4 h-4" />
                    {request.email}
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <Users className="w-4 h-4" />
                    {request.phone}
                  </div>
                  {request.college && (
                    <div className="flex items-center gap-2 text-slate-300">
                      <MapPin className="w-4 h-4" />
                      {request.college}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-slate-300">
                    <Users className="w-4 h-4" />
                    {request.numberOfTickets} tickets
                  </div>
                </div>

                {request.description && (
                  <p className="mt-4 text-slate-300 text-sm">
                    {request.description}
                  </p>
                )}

                <div className="mt-4 flex items-center gap-4">
                  {request.isPaid && (
                    <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                      Paid Event
                    </span>
                  )}
                  <span className="text-xs text-slate-500">
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
      </section>

      {/* Approved Requests */}
      <section>
        <h2 className="text-2xl font-bold text-slate-100 mb-4">
          Approved Organisers ({approvedRequests.length})
        </h2>
        <div className="grid gap-4">
          {approvedRequests.map((request) => (
            <div
              key={request.id}
              className="bg-slate-900/60 dark:bg-slate-900/60 rounded-lg shadow border border-emerald-500/10 p-6 border-l-4 border-emerald-500"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold text-slate-100">
                    {request.eventTitle}
                  </h3>
                  <p className="text-sm text-slate-300 mt-1">
                    Organiser: {request.name}
                  </p>
                </div>
                <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                  Approved
                </span>
              </div>

              <div className="bg-black border border-emerald-500/30 rounded-lg p-4 space-y-3">
                <h4 className="font-semibold text-emerald-400 flex items-center gap-2">
                  <span>🔐</span> Organiser Credentials
                </h4>

                {editingCredentials === request.id ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-emerald-400 mb-1">
                        Email
                      </label>
                      <Input
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder={request.organiserEmail}
                        className="text-sm bg-black/50 border-emerald-500/30 text-emerald-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-emerald-400 mb-1">
                        Password
                      </label>
                      <Input
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="New password"
                        className="text-sm bg-black/50 border-emerald-500/30 text-emerald-400"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleUpdateCredentials(request)}
                        className="bg-emerald-600 hover:bg-emerald-700"
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingCredentials(null);
                          setNewEmail("");
                          setNewPassword("");
                        }}
                        className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between bg-black/50 p-3 rounded border border-emerald-500/20">
                      <div>
                        <p className="text-xs text-emerald-400/70">Email</p>
                        <p className="font-mono text-sm text-emerald-400">
                          {request.organiserEmail}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between bg-black/50 p-3 rounded border border-emerald-500/20">
                      <div className="flex-1">
                        <p className="text-xs text-emerald-400/70">Password</p>
                        <p className="font-mono text-sm text-emerald-400">
                          {showCredentials[request.id]
                            ? request.organiserPassword
                            : "••••••••••••"}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleShowPassword(request.id)}
                        className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                      >
                        {showCredentials[request.id] ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingCredentials(request.id);
                        setNewEmail(request.organiserEmail);
                        setNewPassword(request.organiserPassword);
                      }}
                      className="w-full border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                    >
                      Edit Credentials
                    </Button>
                  </>
                )}
              </div>

              <div className="mt-4 text-xs text-slate-500">
                Approved:{" "}
                {request.approvedAt?.toDate
                  ? new Date(request.approvedAt.toDate()).toLocaleDateString()
                  : "N/A"}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Rejected Requests */}
      {rejectedRequests.length > 0 && (
        <section>
          <h2 className="text-2xl font-bold text-slate-100 mb-4">
            Rejected Requests ({rejectedRequests.length})
          </h2>
          <div className="grid gap-4">
            {rejectedRequests.map((request) => (
              <div
                key={request.id}
                className="bg-slate-900/60 dark:bg-slate-900/60 rounded-lg shadow border border-emerald-500/10 p-6 border-l-4 border-red-500 opacity-75"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-bold text-slate-100">
                      {request.eventTitle}
                    </h3>
                    <p className="text-sm text-slate-300 mt-1">
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
        </section>
      )}

      {/* Rejection Modal */}
      {rejectModalOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
            onClick={() => {
              setRejectModalOpen(false);
              setRejectionReason("");
              setRequestToReject(null);
            }}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[51] w-[90vw] max-w-lg">
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-emerald-500/20 rounded-2xl p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">
                  Reject Hosting Request
                </h3>
                <button
                  onClick={() => {
                    setRejectModalOpen(false);
                    setRejectionReason("");
                    setRequestToReject(null);
                  }}
                  className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {requestToReject && (
                <div className="mb-4 p-4 bg-black/30 rounded-xl border border-emerald-500/10">
                  <h4 className="text-emerald-400 font-semibold mb-1">
                    {requestToReject.eventTitle}
                  </h4>
                  <p className="text-sm text-gray-400">
                    Requested by {requestToReject.name}
                  </p>
                  <p className="text-sm text-gray-400">
                    {requestToReject.email}
                  </p>
                </div>
              )}

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Rejection Reason <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Please provide a detailed reason for rejection..."
                  rows={5}
                  className="w-full px-4 py-3 bg-black/30 border border-emerald-500/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 transition-colors resize-none"
                />
                <p className="text-xs text-gray-400 mt-2">
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
                  className="flex-1 bg-red-500 hover:bg-red-400 disabled:bg-red-500/50 text-white font-semibold py-2.5 rounded-xl transition-all"
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
                  className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2.5 rounded-xl transition-all"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Approval Modal */}
      {approvalModalOpen && approvedCredentials && (
        <>
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
            onClick={() => {
              setApprovalModalOpen(false);
              setApprovedCredentials(null);
              setApprovedRequestData(null);
              setIsExistingOrganiser(false);
            }}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[51] w-[90vw] max-w-lg">
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-emerald-500/30 rounded-2xl p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-emerald-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white">
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
                  className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {approvedRequestData && (
                <div className="mb-4 p-4 bg-black/30 rounded-xl border border-emerald-500/10">
                  <h4 className="text-emerald-400 font-semibold mb-1">
                    {approvedRequestData.eventTitle}
                  </h4>
                  <p className="text-sm text-gray-400">
                    Organiser: {approvedRequestData.name}
                  </p>
                  <p className="text-sm text-gray-400">
                    {approvedRequestData.email}
                  </p>
                </div>
              )}

              <div className="mb-4 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                <p className="text-sm text-emerald-400 flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Approval email sent to {approvedRequestData?.email}
                </p>
              </div>

              <div className="bg-black border border-emerald-500/30 rounded-xl p-4 space-y-4 mb-6">
                <h4 className="font-semibold text-emerald-400 flex items-center gap-2">
                  <span>🔐</span> Organiser Credentials
                </h4>

                <div className="bg-black/50 p-3 rounded border border-emerald-500/20">
                  <p className="text-xs text-emerald-400/70 mb-1">EMAIL</p>
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-sm text-emerald-400">
                      {approvedCredentials.organiserEmail}
                    </p>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(
                          approvedCredentials.organiserEmail,
                        );
                        toast.success("Email copied!");
                      }}
                      className="p-1.5 hover:bg-emerald-500/10 rounded transition-colors"
                    >
                      <Copy className="w-4 h-4 text-emerald-400" />
                    </button>
                  </div>
                </div>

                <div className="bg-black/50 p-3 rounded border border-emerald-500/20">
                  <p className="text-xs text-emerald-400/70 mb-1">PASSWORD</p>
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-sm text-emerald-400">
                      {approvedCredentials.organiserPassword}
                    </p>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(
                          approvedCredentials.organiserPassword,
                        );
                        toast.success("Password copied!");
                      }}
                      className="p-1.5 hover:bg-emerald-500/10 rounded transition-colors"
                    >
                      <Copy className="w-4 h-4 text-emerald-400" />
                    </button>
                  </div>
                </div>

                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
                  <p className="text-xs text-emerald-400">
                    {isExistingOrganiser ? (
                      <>
                        💡 <strong>IMPORTANT:</strong> This organiser already
                        had an account. Their{" "}
                        <strong>password has been updated</strong> to the one
                        shown above. The old password will no longer work. Event
                        limit increased.
                      </>
                    ) : (
                      <>
                        💡 <strong>Note:</strong> The organiser will use these
                        credentials to login via the "Organiser" portal and
                        create their event. You can edit these credentials
                        anytime from the approved requests section.
                      </>
                    )}
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
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-semibold py-2.5 rounded-xl transition-all"
              >
                Done
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
