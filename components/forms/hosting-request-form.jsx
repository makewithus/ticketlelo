"use client";

import { useState, useEffect, useRef } from "react";
import {
  CheckCircle2,
  Loader2,
  AlertCircle,
  Clock,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { createHostingRequest } from "@/lib/hosting-requests";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";

import Link from "next/link";

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const DRAFT_KEY = "ticketlelo_hosting_form_draft";

export function HostingRequestForm() {
  const router = useRouter();
  const { user, loading: authLoading, refreshUser } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [requestId, setRequestId] = useState(null);
  const [requestStatus, setRequestStatus] = useState("pending"); // "pending" | "approved" | "rejected"
  const [isApproved, setIsApproved] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const hasTriggeredApprovalRef = useRef(false);

  // Deterministic initial state ensures 100% match between SSR and client initial render
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    college: "",
    eventTitle: "",
    description: "",
    isPaid: false,
    numberOfTickets: "",
  });

  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  // 1. Initial check: restore active request for signed-in user
  useEffect(() => {
    let isMounted = true;

    const checkActiveRequest = async () => {
      // Super Admins administer the platform and never have a pending hosting request
      if (
        user?.role === "superAdmin" ||
        user?.email === "adil4ticketlelo@gmail.com" ||
        user?.email === "superadmin@ticketlelo.com"
      ) {
        return;
      }

      const storedReqId =
        typeof window !== "undefined"
          ? sessionStorage.getItem("ticketlelo_submitted_req_id") ||
            localStorage.getItem("ticketlelo_submitted_req_id")
          : null;
      const storedEmail =
        typeof window !== "undefined"
          ? sessionStorage.getItem("ticketlelo_submitted_req_email") ||
            user?.email
          : user?.email;

      const lookupParam = storedReqId
        ? `id=${encodeURIComponent(storedReqId)}`
        : storedEmail
        ? `email=${encodeURIComponent(storedEmail)}`
        : null;

      if (!lookupParam) return;

      try {
        const res = await fetch(`/api/hosting-requests/status?${lookupParam}`);
        if (!res.ok) return;
        const data = await res.json();

        if (!isMounted) return;

        // If request belongs to a different email than signed-in user, ignore it and clear storage
        if (
          user?.email &&
          data.request?.email &&
          data.request.email.toLowerCase() !== user.email.toLowerCase()
        ) {
          try {
            sessionStorage.removeItem("ticketlelo_submitted_req_id");
            sessionStorage.removeItem("ticketlelo_submitted_req_email");
            localStorage.removeItem("ticketlelo_submitted_req_id");
            localStorage.removeItem("ticketlelo_submitted_req_email");
          } catch (_) {}
          return;
        }

        if (data.found && data.request) {
          setRequestId(data.request.id);
          setRequestStatus(data.status);
          if (data.request.rejectionReason) {
            setRejectionReason(data.request.rejectionReason);
          }
          setFormData((prev) => ({
            ...prev,
            name: data.request.name || prev.name,
            email: data.request.email || prev.email,
            phone: data.request.phone || prev.phone,
            college: data.request.college || prev.college,
            eventTitle: data.request.eventTitle || prev.eventTitle,
            description: data.request.description || prev.description,
            isPaid: Boolean(data.request.isPaid),
            numberOfTickets: data.request.numberOfTickets || prev.numberOfTickets,
          }));

          setSubmitted(true);

          if (data.isApproved) {
            setIsApproved(true);
            setRequestStatus("approved");
          }
        }
      } catch (err) {
        console.warn("Could not check active hosting request:", err);
      }
    };

    if (!authLoading) {
      checkActiveRequest();
    }

    return () => {
      isMounted = false;
    };
  }, [user?.email, user?.role, authLoading]);

  // 2. Real-time approval listener (polling API + Firestore doc listener)
  useEffect(() => {
    if (!submitted || isApproved) return;
    if (user?.role === "superAdmin" || user?.email === "adil4ticketlelo@gmail.com") return;

    let isMounted = true;
    let pollInterval = null;
    let unsubscribeFirestore = null;

    const checkStatus = async () => {
      try {
        const queryParam = requestId
          ? `id=${encodeURIComponent(requestId)}`
          : formData.email
          ? `email=${encodeURIComponent(formData.email)}`
          : user?.email
          ? `email=${encodeURIComponent(user.email)}`
          : null;

        if (!queryParam) return;

        const res = await fetch(`/api/hosting-requests/status?${queryParam}`);
        if (!res.ok) return;
        const data = await res.json();

        if (!isMounted) return;

        if (data.isApproved) {
          setIsApproved(true);
          setRequestStatus("approved");
          if (data.request?.eventTitle) {
            setFormData((prev) => ({
              ...prev,
              eventTitle: data.request.eventTitle || prev.eventTitle,
              college: data.request.college || prev.college,
              numberOfTickets: data.request.numberOfTickets || prev.numberOfTickets,
            }));
          }
        } else if (data.status === "rejected") {
          setRequestStatus("rejected");
          setRejectionReason(data.request?.rejectionReason || "");
        }
      } catch (e) {
        console.warn("Real-time poll error:", e);
      }
    };

    // Gentle fallback poll every 8 seconds (Firestore snapshot below handles immediate push)
    pollInterval = setInterval(checkStatus, 8000);

    // Also attach Firestore doc snapshot listener if requestId is known
    if (requestId) {
      import("@/lib/firebase").then(({ db }) => {
        import("firebase/firestore").then(({ doc, onSnapshot }) => {
          try {
            unsubscribeFirestore = onSnapshot(
              doc(db, "hostingRequests", requestId),
              (docSnap) => {
                if (!docSnap.exists() || !isMounted) return;
                const reqData = docSnap.data();
                if (reqData.status === "approved") {
                  setIsApproved(true);
                  setRequestStatus("approved");
                } else if (reqData.status === "rejected") {
                  setRequestStatus("rejected");
                  setRejectionReason(reqData.rejectionReason || "");
                }
              },
              (err) => {
                console.warn("Firestore snapshot subscription notice:", err.message);
              }
            );
          } catch (err) {}
        });
      });
    }

    return () => {
      isMounted = false;
      if (pollInterval) clearInterval(pollInterval);
      if (unsubscribeFirestore) unsubscribeFirestore();
    };
  }, [submitted, isApproved, requestId, formData.email, user?.email, user?.role]);

  // 3. Sync if user role changes in auth context in real-time
  useEffect(() => {
    if (
      submitted &&
      !isApproved &&
      user?.role === "organiser" &&
      user?.role !== "superAdmin"
    ) {
      const timer = setTimeout(() => {
        setIsApproved(true);
        setRequestStatus("approved");
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [user?.role, submitted, isApproved]);

  // 4. Countdown and automatic redirect when approved
  useEffect(() => {
    if (!isApproved) return;
    if (hasTriggeredApprovalRef.current) return;
    hasTriggeredApprovalRef.current = true;

    let isMounted = true;
    toast.success("Hosting request approved! Redirecting to organiser dashboard...");

    // Clean up stored request keys from storage
    try {
      sessionStorage.removeItem("ticketlelo_submitted_req_id");
      sessionStorage.removeItem("ticketlelo_submitted_req_email");
      localStorage.removeItem("ticketlelo_submitted_req_id");
      localStorage.removeItem("ticketlelo_submitted_req_email");
    } catch (_) {}

    // Force refresh token and cookie in the background
    refreshUser?.().catch((e) => console.warn("Failed refreshing user on approval:", e));

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          if (isMounted) {
            setIsRedirecting(true);
            window.location.href = "/admin/dashboard";
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [isApproved, refreshUser]);

  // Restore any saved draft from storage post-hydration to prevent SSR mismatch
  useEffect(() => {
    if (submitted || isApproved) return;
    const timer = setTimeout(() => {
      try {
        const saved =
          sessionStorage.getItem(DRAFT_KEY) || localStorage.getItem(DRAFT_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === "object") {
            setFormData((prev) => ({
              ...prev,
              name: parsed.name || prev.name,
              email: parsed.email || prev.email,
              phone: parsed.phone || prev.phone,
              college: parsed.college || prev.college,
              eventTitle: parsed.eventTitle || prev.eventTitle,
              description: parsed.description || prev.description,
              isPaid:
                parsed.isPaid !== undefined
                  ? Boolean(parsed.isPaid)
                  : prev.isPaid,
              numberOfTickets: parsed.numberOfTickets || prev.numberOfTickets,
            }));
          }
        }
      } catch (e) {
        console.warn("Storage restoration error:", e);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [submitted, isApproved]);

  // Pre-fill and synchronize user profile details with authenticated user
  useEffect(() => {
    if (!user) return;
    const timer = setTimeout(() => {
      setFormData((prev) => {
        const nextName = prev.name || user.fullName || user.displayName || "";
        const nextEmail = user.email || prev.email;
        const nextPhone =
          prev.phone ||
          (user.whatsappPhone
            ? String(user.whatsappPhone).replace(/\D/g, "").slice(0, 10)
            : "");
        if (prev.name === nextName && prev.email === nextEmail && prev.phone === nextPhone) {
          return prev;
        }
        return {
          ...prev,
          name: nextName,
          email: nextEmail,
          phone: nextPhone,
        };
      });
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email, user?.fullName, user?.displayName, user?.whatsappPhone]);

  // Continuously persist form draft to sessionStorage & localStorage
  useEffect(() => {
    try {
      const hasContent = Object.values(formData).some((v) => Boolean(v));
      if (hasContent) {
        const json = JSON.stringify(formData);
        sessionStorage.setItem(DRAFT_KEY, json);
        localStorage.setItem(DRAFT_KEY, json);
      }
    } catch (e) {}
  }, [formData]);

  const validateField = (fieldName, value) => {
    const val = typeof value === "string" ? value.trim() : value;

    switch (fieldName) {
      case "name": {
        if (!val) return "Full name is required.";
        if (/\d/.test(val)) return "Full name cannot contain numbers (letters only).";
        if (val.length < 2) return "Full name must be at least 2 characters.";
        return "";
      }
      case "email": {
        if (!val) return "Email address is required.";
        if (!EMAIL_REGEX.test(val)) {
          return "Please enter a valid email address with '@' (e.g. name@domain.com).";
        }
        if (user?.email && val.toLowerCase() !== user.email.toLowerCase()) {
          return `Request email must match your signed-in account email (${user.email}).`;
        }
        return "";
      }
      case "phone": {
        const digits = String(val || "").replace(/\D/g, "");
        if (!digits) return "Phone number is required.";
        if (digits.length !== 10) {
          return "Phone number must be exactly 10 digits.";
        }
        return "";
      }
      case "college": {
        if (!val) return "College or organisation is required.";
        if (val.length < 2) return "Please enter at least 2 characters.";
        return "";
      }
      case "eventTitle": {
        if (!val) return "Event title is required.";
        if (val.length < 3) return "Event title must be at least 3 characters.";
        return "";
      }
      case "description": {
        if (!val) return "Event description is required.";
        if (val.length < 10) return "Event description must be at least 10 characters.";
        return "";
      }
      case "numberOfTickets": {
        if (val === "" || val === null || val === undefined) {
          return "Expected tickets is required.";
        }
        const num = parseInt(val, 10);
        if (isNaN(num) || num <= 0) {
          return "Expected tickets must be a valid number of at least 1.";
        }
        return "";
      }
      default:
        return "";
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    let finalValue = type === "checkbox" ? checked : value;

    if (name === "name") {
      finalValue = value.replace(/[0-9]/g, "");
    }

    setFormData((prev) => ({
      ...prev,
      [name]: finalValue,
    }));

    if (touched[name]) {
      const fieldError = validateField(name, finalValue);
      setErrors((prev) => ({
        ...prev,
        [name]: fieldError,
      }));
    }
  };

  const handlePhoneChange = (e) => {
    let raw = e.target.value;
    let digits = raw.replace(/\D/g, "");

    if (digits.length === 12 && digits.startsWith("91")) {
      digits = digits.slice(2);
    }
    digits = digits.slice(0, 10);

    setFormData((prev) => ({
      ...prev,
      phone: digits,
    }));

    if (touched.phone) {
      const fieldError = validateField("phone", digits);
      setErrors((prev) => ({
        ...prev,
        phone: fieldError,
      }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    const fieldError = validateField(name, value);
    setErrors((prev) => ({
      ...prev,
      [name]: fieldError,
    }));
  };

  const validateAll = () => {
    const newErrors = {};
    const fields = [
      "name",
      "email",
      "phone",
      "college",
      "eventTitle",
      "description",
      "numberOfTickets",
    ];

    fields.forEach((field) => {
      const error = validateField(field, formData[field]);
      if (error) {
        newErrors[field] = error;
      }
    });

    setErrors(newErrors);
    setTouched({
      name: true,
      email: true,
      phone: true,
      college: true,
      eventTitle: true,
      description: true,
      numberOfTickets: true,
    });

    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const formValidationErrors = validateAll();
    const errorKeys = Object.keys(formValidationErrors);

    if (errorKeys.length > 0) {
      const firstErrorMessage = formValidationErrors[errorKeys[0]];
      toast.error(firstErrorMessage);
      return;
    }

    // If user is NOT signed in:
    // Persist all details so user never has to fill them again, then redirect to login/signup
    if (!user) {
      const pendingData = {
        ...formData,
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim(),
        college: formData.college.trim(),
        eventTitle: formData.eventTitle.trim(),
        description: formData.description.trim(),
        numberOfTickets: formData.numberOfTickets,
        isPaid: Boolean(formData.isPaid),
      };

      try {
        const json = JSON.stringify(pendingData);
        sessionStorage.setItem(DRAFT_KEY, json);
        localStorage.setItem(DRAFT_KEY, json);
      } catch (storageErr) {
        console.warn("Storage save error:", storageErr);
      }

      toast.info("Please sign in or create an account to submit your request.");
      router.push(
        `/login?redirect=/host-event&email=${encodeURIComponent(
          pendingData.email
        )}&name=${encodeURIComponent(pendingData.name)}`
      );
      return;
    }

    setIsLoading(true);

    try {
      const submissionEmail = user?.email
        ? user.email.trim().toLowerCase()
        : formData.email.trim().toLowerCase();

      const submissionResult = await createHostingRequest({
        ...formData,
        name: formData.name.trim(),
        email: submissionEmail,
        phone: formData.phone.trim(),
        college: formData.college.trim(),
        eventTitle: formData.eventTitle.trim(),
        description: formData.description.trim(),
        numberOfTickets: parseInt(formData.numberOfTickets, 10),
        isPaid: Boolean(formData.isPaid),
        userId: user.uid || user.id || null,
        userAccountEmail: user.email || null,
      });

      const newId = submissionResult?.id || submissionResult?.request?.id || null;
      if (newId) {
        setRequestId(newId);
        try {
          sessionStorage.setItem("ticketlelo_submitted_req_id", newId);
          sessionStorage.setItem("ticketlelo_submitted_req_email", submissionEmail);
          localStorage.setItem("ticketlelo_submitted_req_id", newId);
          localStorage.setItem("ticketlelo_submitted_req_email", submissionEmail);
        } catch (e) {}
      }

      // Clear draft storage upon successful submission
      try {
        sessionStorage.removeItem(DRAFT_KEY);
        localStorage.removeItem(DRAFT_KEY);
      } catch (e) {}

      toast.success("Request sent and waiting for approval!");
      setRequestStatus("pending");
      setSubmitted(true);
    } catch (error) {
      console.error("Error submitting request:", error);
      toast.error(
        error.message || "Failed to submit hosting request. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        {/* Left Column: Branding, Title, Steps */}
        <div className="lg:col-span-5 space-y-6 pt-2">
          {/* Logo */}
          <div className="mb-4">
            <img
              src="/logo/ticketlelo-logo-nav.png"
              alt="TicketLelo"
              className="h-9 w-auto object-contain"
            />
          </div>

          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-[#FFFFFF] tracking-tight mb-3">
              Host your event<br className="hidden sm:inline" /> on TicketLelo
            </h1>
            <p className="text-[#9B9EA4] text-sm leading-relaxed">
              Send your details once. Our team reviews the request in real time and emails your organiser credentials.
            </p>
          </div>

          {/* Steps */}
          <div className="space-y-5 pt-4">
            <div className="flex items-start gap-3">
              <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${isApproved ? "bg-[#10B981]" : "bg-[#FE760B]"}`} />
              <div>
                <p className="text-sm font-semibold text-white">Send this request</p>
                <p className="text-xs text-[#9B9EA4] mt-0.5">
                  {submitted ? "Completed · Details sent" : "About two minutes · All details required"}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${isApproved ? "bg-[#10B981]" : submitted ? "bg-[#FDE003] animate-pulse" : "bg-[#5C6066]"}`} />
              <div>
                <p className={`text-sm font-semibold ${isApproved || submitted ? "text-white" : "text-[#D0D0D1]"}`}>
                  Real-time review
                </p>
                <p className="text-xs text-[#9B9EA4] mt-0.5">
                  {isApproved
                    ? "Approved by Super Admin"
                    : submitted
                    ? "In review right now..."
                    : "Approved or followed up by email"}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${isApproved ? "bg-[#FE760B] animate-pulse" : "bg-[#5C6066]"}`} />
              <div>
                <p className={`text-sm font-semibold ${isApproved ? "text-white" : "text-[#D0D0D1]"}`}>
                  Sign in & create your event
                </p>
                <p className="text-xs text-[#9B9EA4] mt-0.5">
                  {isApproved ? "Ready · Opening Organiser Dashboard" : "Tickets, forms, banner, and instant QR check-in"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Form Card */}
        <div className="lg:col-span-7">
          <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-6 sm:p-8 shadow-xl">
            {submitted ? (
              <div className="flex min-h-[440px] flex-col justify-center text-center items-center py-6 px-2">
                {isApproved ? (
                  <>
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40 shadow-xl shadow-[#10B981]/25 animate-pulse">
                      <CheckCircle2 className="h-9 w-9 text-[#10B981]" />
                    </div>

                    {/* Status badge: Approved */}
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#10B981]/15 border border-[#10B981]/30 text-[#10B981] text-xs font-semibold mb-3">
                      <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                      <span>Request approved by Super Admin!</span>
                    </div>

                    <h2 className="mb-2 text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                      Hosting request approved!
                    </h2>
                    <p className="max-w-md text-[#D0D0D1] text-sm leading-relaxed mb-5">
                      Your request to host <strong className="text-white">&quot;{formData.eventTitle}&quot;</strong> has been approved. You now have full organiser permissions.
                    </p>

                    {/* Live countdown & redirect banner */}
                    <div className="w-full max-w-md p-4 rounded-xl bg-gradient-to-r from-[#10B981]/20 via-[#10B981]/10 to-[#10B981]/5 border border-[#10B981]/35 text-left mb-5">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 text-xs font-semibold text-[#10B981]">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Redirecting to Organiser Dashboard...</span>
                        </div>
                        <span className="text-xs font-mono font-bold text-white bg-[#10B981]/30 px-2 py-0.5 rounded-full">
                          {countdown}s
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-[#212327] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#10B981] transition-all duration-1000 ease-linear rounded-full"
                          style={{ width: `${Math.max(10, ((3 - countdown) / 3) * 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Summary Card */}
                    <div className="w-full max-w-md bg-[#212327] border border-[#2A2D31] rounded-xl p-4 text-left text-xs space-y-2 mb-5">
                      <div className="flex justify-between items-center py-1 border-b border-[#2A2D31]/50">
                        <span className="text-[#9B9EA4]">Sign-in Email</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-white font-medium">{formData.email}</span>
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-semibold text-[10px]">
                            Organiser
                          </span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-[#2A2D31]/50">
                        <span className="text-[#9B9EA4]">Organisation</span>
                        <span className="text-white font-medium">{formData.college}</span>
                      </div>
                      <div className="flex justify-between items-center py-1">
                        <span className="text-[#9B9EA4]">Expected Tickets</span>
                        <span className="text-white font-medium font-mono">
                          {formData.numberOfTickets} tickets
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setIsRedirecting(true);
                          window.location.href = "/admin/dashboard";
                        }}
                        className="px-6 py-2.5 rounded-xl bg-[#FE760B] hover:bg-[#FF8A2B] text-white font-bold text-sm transition-all shadow-lg shadow-[#FE760B]/25 flex items-center gap-2"
                      >
                        {isRedirecting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Opening Dashboard...</span>
                          </>
                        ) : (
                          <>
                            <span>Go to Organiser Dashboard</span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => router.push("/")}
                        className="px-4 py-2.5 rounded-xl bg-[#212327] hover:bg-[#2A2D31] text-[#9B9EA4] hover:text-white border border-[#2A2D31] font-medium text-sm transition-colors"
                      >
                        Back to Home
                      </button>
                    </div>
                  </>
                ) : requestStatus === "rejected" ? (
                  <>
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/15 text-red-400 border border-red-500/30">
                      <AlertCircle className="h-8 w-8" />
                    </div>

                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/25 text-red-400 text-xs font-semibold mb-3">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Hosting request not approved</span>
                    </div>

                    <h2 className="mb-2 text-2xl font-bold text-white tracking-tight">
                      Request could not be approved
                    </h2>
                    <p className="max-w-md text-[#9B9EA4] text-sm leading-relaxed mb-4">
                      {rejectionReason ||
                        "Our super admin team was unable to approve this request with the current details."}
                    </p>

                    <div className="flex items-center gap-3 mt-4">
                      <button
                        type="button"
                        onClick={() => {
                          setSubmitted(false);
                          setRequestStatus("pending");
                          setIsApproved(false);
                        }}
                        className="px-5 py-2.5 rounded-xl bg-[#FE760B] hover:bg-[#FF8A2B] text-white font-semibold text-sm transition-colors"
                      >
                        Submit New Request
                      </button>
                      <button
                        type="button"
                        onClick={() => router.push("/")}
                        className="px-4 py-2.5 rounded-xl bg-[#212327] hover:bg-[#2A2D31] text-white border border-[#2A2D31] font-medium text-sm transition-colors"
                      >
                        Back to TicketLelo
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
                      <CheckCircle2 className="h-8 w-8" />
                    </div>

                    {/* Status badge: Waiting for approval */}
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FDE003]/10 border border-[#FDE003]/25 text-[#FDE003] text-xs font-semibold mb-3">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Request sent and waiting for approval</span>
                    </div>

                    <h2 className="mb-2 text-2xl font-bold text-white tracking-tight">
                      Hosting request submitted
                    </h2>
                    <p className="max-w-md text-[#9B9EA4] text-sm leading-relaxed mb-6">
                      Your request to host <strong className="text-white">&quot;{formData.eventTitle}&quot;</strong> has reached our super admin team.
                    </p>

                    {/* Summary Card */}
                    <div className="w-full max-w-md bg-[#212327] border border-[#2A2D31] rounded-xl p-4 text-left text-xs space-y-2 mb-5">
                      <div className="flex justify-between items-center py-1 border-b border-[#2A2D31]/50">
                        <span className="text-[#9B9EA4]">Sign-in Email</span>
                        <span className="text-white font-medium">{formData.email}</span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-[#2A2D31]/50">
                        <span className="text-[#9B9EA4]">Organisation</span>
                        <span className="text-white font-medium">{formData.college}</span>
                      </div>
                      <div className="flex justify-between items-center py-1">
                        <span className="text-[#9B9EA4]">Expected Tickets</span>
                        <span className="text-white font-medium font-mono">
                          {formData.numberOfTickets} tickets
                        </span>
                      </div>
                    </div>

                    <div className="max-w-md p-3.5 rounded-xl bg-[#FE760B]/10 border border-[#FE760B]/20 text-[#FE760B] text-xs text-left mb-5">
                      <p className="font-semibold mb-1">What happens next?</p>
                      <p className="text-[#D0D0D1] leading-relaxed">
                        After the super admin approved, the email <strong>{formData.email}</strong> will be unlocked with organiser access. An approval email with your organiser dashboard link and login details will be sent automatically.
                      </p>
                    </div>

                    <div className="flex items-center gap-3 mb-4">
                      <button
                        type="button"
                        onClick={() => router.push("/")}
                        className="px-5 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-black font-semibold text-sm transition-colors"
                      >
                        Back to TicketLelo
                      </button>
                      <button
                        type="button"
                        onClick={() => router.push("/dashboard")}
                        className="px-4 py-2.5 rounded-xl bg-[#212327] hover:bg-[#2A2D31] text-white border border-[#2A2D31] font-medium text-sm transition-colors"
                      >
                        My Account
                      </button>
                    </div>

                    {/* Real-time pulse indicator */}
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#212327] border border-[#2A2D31] text-[11px] text-[#9B9EA4]">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                      </span>
                      <span>Live status: listening for approval in real time</span>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="space-y-6">
                {/* SECTION 1: ABOUT YOU */}
                <div>
                  <p className="text-xs font-semibold text-[#9B9EA4] uppercase tracking-wider mb-3">
                    About you
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Full Name */}
                    <div>
                      <label className="block text-xs font-medium text-[#D0D0D1] mb-1.5">
                        Full name <span className="text-[#FE760B]">*</span>
                      </label>
                      <input
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        placeholder="John Doe"
                        autoComplete="name"
                        className={`w-full px-3.5 py-2.5 rounded-xl bg-[#212327] border text-sm text-white placeholder-[#9B9EA4] focus:outline-none transition-colors ${
                          errors.name && touched.name
                            ? "border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                            : "border-[#2A2D31] focus:border-[#FE760B] focus:ring-1 focus:ring-[#FE760B]"
                        }`}
                      />
                      {errors.name && touched.name && (
                        <p className="mt-1 text-xs text-red-400 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          <span>{errors.name}</span>
                        </p>
                      )}
                    </div>

                    {/* Email */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-medium text-[#D0D0D1]">
                          Email <span className="text-[#FE760B]">*</span>
                        </label>
                        {user?.email && (
                          <span className="text-[10px] text-[#3DD68C] font-mono bg-[#3DD68C]/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <CheckCircle2 className="w-2.5 h-2.5" /> Verified Account
                          </span>
                        )}
                      </div>
                      <input
                        type="email"
                        name="email"
                        value={user?.email ? user.email : formData.email}
                        readOnly={Boolean(user?.email)}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        placeholder="john@example.com"
                        autoComplete="email"
                        className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-white placeholder-[#9B9EA4] focus:outline-none transition-colors ${
                          user?.email
                            ? "opacity-85 cursor-not-allowed bg-[#1A1C1F] border-[#2A2D31]"
                            : "bg-[#212327] border-[#2A2D31] focus:border-[#FE760B] focus:ring-1 focus:ring-[#FE760B]"
                        } ${
                          errors.email && touched.email
                            ? "border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                            : ""
                        }`}
                      />
                      {errors.email && touched.email && (
                        <p className="mt-1 text-xs text-red-400 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          <span>{errors.email}</span>
                        </p>
                      )}
                    </div>

                    {/* Phone Number */}
                    <div>
                      <label className="block text-xs font-medium text-[#D0D0D1] mb-1.5">
                        Phone number <span className="text-[#FE760B]">*</span>
                      </label>
                      <div
                        className={`flex rounded-xl bg-[#212327] border overflow-hidden transition-colors ${
                          errors.phone && touched.phone
                            ? "border-red-500 focus-within:border-red-500 focus-within:ring-1 focus-within:ring-red-500"
                            : "border-[#2A2D31] focus-within:border-[#FE760B] focus-within:ring-1 focus-within:ring-[#FE760B]"
                        }`}
                      >
                        <span className="inline-flex items-center px-3 text-xs font-semibold text-[#9B9EA4] bg-[#1A1C1F] border-r border-[#2A2D31] select-none">
                          +91
                        </span>
                        <input
                          type="tel"
                          inputMode="numeric"
                          name="phone"
                          value={formData.phone}
                          onChange={handlePhoneChange}
                          onBlur={handleBlur}
                          placeholder="9876543210"
                          maxLength={10}
                          autoComplete="tel-national"
                          className="w-full px-3.5 py-2.5 bg-transparent text-sm text-white placeholder-[#9B9EA4] focus:outline-none"
                        />
                      </div>
                      {errors.phone && touched.phone && (
                        <p className="mt-1 text-xs text-red-400 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          <span>{errors.phone}</span>
                        </p>
                      )}
                    </div>

                    {/* College / Organisation */}
                    <div>
                      <label className="block text-xs font-medium text-[#D0D0D1] mb-1.5">
                        College / organisation <span className="text-[#FE760B]">*</span>
                      </label>
                      <input
                        name="college"
                        value={formData.college}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        placeholder="ABC University"
                        className={`w-full px-3.5 py-2.5 rounded-xl bg-[#212327] border text-sm text-white placeholder-[#9B9EA4] focus:outline-none transition-colors ${
                          errors.college && touched.college
                            ? "border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                            : "border-[#2A2D31] focus:border-[#FE760B] focus:ring-1 focus:ring-[#FE760B]"
                        }`}
                      />
                      {errors.college && touched.college && (
                        <p className="mt-1 text-xs text-red-400 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          <span>{errors.college}</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* SECTION 2: YOUR EVENT */}
                <div className="pt-2">
                  <p className="text-xs font-semibold text-[#9B9EA4] uppercase tracking-wider mb-3">
                    Your event
                  </p>
                  <div className="space-y-3.5">
                    {/* Event Title */}
                    <div>
                      <label className="block text-xs font-medium text-[#D0D0D1] mb-1.5">
                        Event title <span className="text-[#FE760B]">*</span>
                      </label>
                      <input
                        name="eventTitle"
                        value={formData.eventTitle}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        placeholder="Tech Fest 2026"
                        className={`w-full px-3.5 py-2.5 rounded-xl bg-[#212327] border text-sm text-white placeholder-[#9B9EA4] focus:outline-none transition-colors ${
                          errors.eventTitle && touched.eventTitle
                            ? "border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                            : "border-[#2A2D31] focus:border-[#FE760B] focus:ring-1 focus:ring-[#FE760B]"
                        }`}
                      />
                      {errors.eventTitle && touched.eventTitle && (
                        <p className="mt-1 text-xs text-red-400 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          <span>{errors.eventTitle}</span>
                        </p>
                      )}
                    </div>

                    {/* Event Description */}
                    <div>
                      <label className="block text-xs font-medium text-[#D0D0D1] mb-1.5">
                        Event description <span className="text-[#FE760B]">*</span>
                      </label>
                      <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        placeholder="What's the event about? Who is it for?"
                        rows={3}
                        className={`w-full px-3.5 py-2.5 rounded-xl bg-[#212327] border text-sm text-white placeholder-[#9B9EA4] focus:outline-none transition-colors resize-none ${
                          errors.description && touched.description
                            ? "border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                            : "border-[#2A2D31] focus:border-[#FE760B] focus:ring-1 focus:ring-[#FE760B]"
                        }`}
                      />
                      {errors.description && touched.description && (
                        <p className="mt-1 text-xs text-red-400 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          <span>{errors.description}</span>
                        </p>
                      )}
                    </div>

                    {/* Expected Tickets & Paid Event Toggle */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-end">
                      <div>
                        <label className="block text-xs font-medium text-[#D0D0D1] mb-1.5">
                          Expected tickets <span className="text-[#FE760B]">*</span>
                        </label>
                        <input
                          type="number"
                          name="numberOfTickets"
                          value={formData.numberOfTickets}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          placeholder="100"
                          min="1"
                          className={`w-full px-3.5 py-2.5 rounded-xl bg-[#212327] border text-sm text-white placeholder-[#9B9EA4] focus:outline-none transition-colors ${
                            errors.numberOfTickets && touched.numberOfTickets
                              ? "border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                              : "border-[#2A2D31] focus:border-[#FE760B] focus:ring-1 focus:ring-[#FE760B]"
                          }`}
                        />
                        {errors.numberOfTickets && touched.numberOfTickets && (
                          <p className="mt-1 text-xs text-red-400 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3 shrink-0" />
                            <span>{errors.numberOfTickets}</span>
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#212327] border border-[#2A2D31] h-[42px]">
                        <span className="text-xs font-medium text-[#D0D0D1]">
                          Paid event
                        </span>
                        <button
                          type="button"
                          role="switch"
                          suppressHydrationWarning
                          aria-checked={formData.isPaid}
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              isPaid: !prev.isPaid,
                            }))
                          }
                          className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none"
                          style={{
                            backgroundColor: formData.isPaid ? "#FE760B" : "#2A2D31",
                          }}
                        >
                          <span
                            aria-hidden="true"
                            suppressHydrationWarning
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                              formData.isPaid ? "translate-x-4" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#2A2D31]">
                  <button
                    type="button"
                    onClick={() => router.push("/")}
                    disabled={isLoading}
                    className="px-4 py-2 text-sm font-medium text-[#9B9EA4] hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-5 py-2.5 rounded-lg bg-white hover:bg-slate-100 text-black font-semibold text-sm transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-60"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-black" />
                        <span>Submitting...</span>
                      </>
                    ) : (
                      "Submit request"
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
