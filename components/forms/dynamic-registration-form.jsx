"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { signup, login, getCurrentUser } from "@/lib/auth";
import {
  getEvent,
} from "@/lib/firestore";
import { sendRegistrationConfirmation } from "@/lib/email";
import { sendPasswordResetEmail } from "firebase/auth";
import { db, auth } from "@/lib/firebase";
import { doc, onSnapshot, collection, query, where } from "firebase/firestore";
import { useAuth } from "@/context/auth-context";
import { getCustomFormByEvent } from "@/lib/form-generator";
import {
  Loader2,
  Sparkles,
  CheckCircle,
  X,
  LogIn,
  Key,
  RefreshCw,
  Mail,
  Info,
  User,
  Phone,
  Lock,
  Building2,
  Tag,
  Ticket,
  AlertCircle,
  ShieldCheck,
  Eye,
  EyeOff,
} from "lucide-react";

/**
 * Default fallback questions used ONLY when an event has no custom form configured in Form Builder.
 */
const DEFAULT_FALLBACK_FIELDS = [
  {
    id: "fullName",
    label: "Name",
    name: "Name",
    type: "text",
    required: true,
    placeholder: "Your full name",
  },
  {
    id: "email",
    label: "Email",
    name: "Email",
    type: "email",
    required: true,
    placeholder: "you@example.com",
  },
  {
    id: "whatsappPhone",
    label: "Phone / WhatsApp",
    name: "Phone / WhatsApp",
    type: "tel",
    required: true,
    placeholder: "+91 98765 43210",
  },
  {
    id: "college",
    label: "College name",
    name: "College name",
    type: "text",
    required: false,
    placeholder: "Your college",
  },
  {
    id: "yearOfStudy",
    label: "Year of study",
    name: "Year of study",
    type: "dropdown",
    required: false,
    placeholder: "Select",
    options: [
      "1st Year",
      "2nd Year",
      "3rd Year",
      "4th Year",
      "Postgraduate",
    ],
  },
];

/**
 * Sanitizes organizer custom form fields to ensure consistent property access:
 * id, label, name, type, required, placeholder, options.
 * Does NOT inject synthetic/hardcoded fields that the organizer never configured.
 */
function sanitizeCustomFields(fields = []) {
  if (!Array.isArray(fields)) return [];
  return fields
    .filter((f) => f && typeof f === "object")
    .map((f, index) => {
      const id = f.id !== undefined && f.id !== null ? f.id : `field_${index}`;
      const name = f.name || f.label || `Field ${index + 1}`;
      const label = f.label || f.name || `Field ${index + 1}`;
      return {
        ...f,
        id,
        name,
        label,
        type: f.type || "text",
        required: Boolean(f.required),
        placeholder:
          f.placeholder ||
          (f.type === "tel"
            ? "+91 98765 43210"
            : f.type === "email"
            ? "you@example.com"
            : `Your ${label.toLowerCase()}`),
        options: Array.isArray(f.options) ? f.options : [],
      };
    });
}

export function DynamicRegistrationForm({ eventId, event: initialEvent, initialForm, ...props }) {
  const router = useRouter();
  const { user: authUser } = useAuth();
  const effectiveUser = authUser || auth.currentUser;

  // Real-time Event and Live Registrations listener
  const [currentEvent, setCurrentEvent] = useState(initialEvent || props.event || null);
  const [liveRegistrationsCount, setLiveRegistrationsCount] = useState(0);

  useEffect(() => {
    if (initialEvent || props.event) {
      setCurrentEvent(initialEvent || props.event);
    }
  }, [initialEvent, props.event]);

  useEffect(() => {
    const targetId = eventId || initialEvent?.id || props.event?.id || currentEvent?.id;
    if (!targetId || !db) return;

    let unsubEvent = null;
    let unsubRegs = null;

    try {
      unsubEvent = onSnapshot(
        doc(db, "events", targetId),
        (snap) => {
          if (snap.exists()) {
            const data = { id: snap.id, ...snap.data() };
            setCurrentEvent((prev) => ({ ...(prev || {}), ...data }));
          }
        },
        (err) => console.warn("Real-time event subscription warning:", err?.message)
      );
    } catch (err) {
      console.warn("Could not bind real-time event listener:", err);
    }

    try {
      const q = query(collection(db, "registrations"), where("eventId", "==", targetId));
      unsubRegs = onSnapshot(
        q,
        (snap) => {
          setLiveRegistrationsCount(snap.size);
        },
        (err) => console.warn("Real-time registrations subscription warning:", err?.message)
      );
    } catch (err) {
      console.warn("Could not bind real-time registrations listener:", err);
    }

    return () => {
      if (typeof unsubEvent === "function") unsubEvent();
      if (typeof unsubRegs === "function") unsubRegs();
    };
  }, [eventId, initialEvent?.id, props.event?.id]);

  const activeEvent = currentEvent || initialEvent || props.event || {};

  const [isLoading, setIsLoading] = useState(false);
  const [customForm, setCustomForm] = useState(null);
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [tempFormData, setTempFormData] = useState(null);
  const [loginPassword, setLoginPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const themeColor = activeEvent?.themeColor || "#FE760B";
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [isPendingApproval, setIsPendingApproval] = useState(false);
  const [formLoadError, setFormLoadError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  // Coupon state
  const [couponCode, setCouponCode] = useState("");
  const [couponValidating, setCouponValidating] = useState(false);
  const [couponData, setCouponData] = useState(null);
  const [couponError, setCouponError] = useState("");

  // Registration Closure & Capacity Controls (Computed authoritatively in real time)
  const isEventCancelled = Boolean(
    activeEvent?.status === "cancelled" || activeEvent?.isCancelled
  );

  const isEventEnded = Boolean(
    activeEvent?.status === "ended" ||
    activeEvent?.status === "completed" ||
    activeEvent?.isEnded === true
  );

  // Authoritative explicit closure evaluation:
  // If closeRegistrationEnabled is explicitly false, closure rule is disabled and registration is open.
  let isRegistrationClosedExplicit = false;
  if (activeEvent?.closeRegistrationEnabled === true) {
    if (activeEvent?.closeRegistrationMode === "now" || activeEvent?.registrationClosed === true) {
      isRegistrationClosedExplicit = true;
    }
  } else if (activeEvent?.closeRegistrationEnabled === false) {
    isRegistrationClosedExplicit = false;
  } else {
    // Fallback for older event records before closeRegistrationEnabled field was introduced
    isRegistrationClosedExplicit = Boolean(
      (activeEvent?.registrationClosed === true && activeEvent?.registrationStatus !== "Open") ||
      (activeEvent?.isRegistrationClosed === true && activeEvent?.registrationStatus !== "Open") ||
      activeEvent?.registrationStatus === "Closed" ||
      activeEvent?.registrationStatus === "closed" ||
      activeEvent?.status === "closed"
    );
  }

  const allocatedSeats = Math.max(
    Number(activeEvent?.allocatedSeats || 0),
    liveRegistrationsCount
  );

  const isCapacityClosed = Boolean(
    activeEvent?.closeRegistrationEnabled === true &&
    activeEvent?.closeRegistrationMode === "capacity" &&
    typeof activeEvent?.closeRegistrationCapacity === "number" &&
    Number(activeEvent.closeRegistrationCapacity) > 0 &&
    allocatedSeats >= Number(activeEvent.closeRegistrationCapacity)
  );

  const totalSeats = Number(
    activeEvent?.globalCapacity ||
    activeEvent?.capacity ||
    activeEvent?.maxCapacity ||
    0
  );

  const isGlobalCapacityReached = Boolean(
    Boolean(activeEvent?.limitCapacity) &&
    totalSeats > 0 &&
    allocatedSeats >= totalSeats
  );

  const isClosedForRegistration =
    isEventCancelled ||
    isEventEnded ||
    isRegistrationClosedExplicit ||
    isCapacityClosed ||
    isGlobalCapacityReached;

  // Helper to build initial form values with user pre-population
  const buildInitialData = (fields) => {
    const initialData = {};
    if (!Array.isArray(fields)) return initialData;
    fields.forEach((field) => {
      if (field.id !== undefined && field.id !== null) {
        initialData[field.id] = "";
      }
      if (field.name) {
        initialData[field.name] = "";
      }
    });
    const signedIn = authUser || auth.currentUser;
    if (signedIn) {
      const emailF = fields.find((f) => {
        const t = String(f?.type || "").toLowerCase();
        const n = String(f?.name || f?.label || f?.id || "").toLowerCase();
        return t === "email" || n === "email" || n.includes("email");
      });
      const nameF = fields.find((f) => {
        const n = String(f?.name || f?.label || f?.id || "").toLowerCase();
        return (
          n === "fullname" ||
          n === "name" ||
          (n.includes("name") &&
            !n.includes("college") &&
            !n.includes("school") &&
            !n.includes("team") &&
            !n.includes("company"))
        );
      });
      const phoneF = fields.find((f) => {
        const t = String(f?.type || "").toLowerCase();
        const n = String(f?.name || f?.label || f?.id || "").toLowerCase();
        return (
          t === "tel" ||
          n.includes("phone") ||
          n.includes("mobile") ||
          n.includes("whatsapp") ||
          n.includes("contact")
        );
      });
      if (emailF && signedIn.email) {
        initialData[emailF.id] = signedIn.email;
        if (emailF.name) initialData[emailF.name] = signedIn.email;
      }
      if (nameF && (signedIn.displayName || signedIn.fullName)) {
        const nVal = signedIn.displayName || signedIn.fullName;
        initialData[nameF.id] = nVal;
        if (nameF.name) initialData[nameF.name] = nVal;
      }
      if (phoneF && (signedIn.phoneNumber || signedIn.whatsappPhone)) {
        const pVal = signedIn.phoneNumber || signedIn.whatsappPhone;
        initialData[phoneF.id] = pVal;
        if (phoneF.name) initialData[phoneF.name] = pVal;
      }
    }
    return initialData;
  };

  // Auto-fill and lock logged-in attendee details when auth initializes or changes
  useEffect(() => {
    const userToSync = authUser || auth.currentUser;
    if (userToSync && customForm?.fields) {
      setFormData((prev) => {
        const next = { ...prev };
        let updated = false;
        const emailF = customForm.fields.find((f) => {
          const t = String(f?.type || "").toLowerCase();
          const n = String(f?.name || f?.label || f?.id || "").toLowerCase();
          return t === "email" || n === "email" || n.includes("email");
        });
        const nameF = customForm.fields.find((f) => {
          const n = String(f?.name || f?.label || f?.id || "").toLowerCase();
          return (
            n === "fullname" ||
            n === "name" ||
            (n.includes("name") &&
              !n.includes("college") &&
              !n.includes("school") &&
              !n.includes("team") &&
              !n.includes("company"))
          );
        });
        const phoneF = customForm.fields.find((f) => {
          const t = String(f?.type || "").toLowerCase();
          const n = String(f?.name || f?.label || f?.id || "").toLowerCase();
          return (
            t === "tel" ||
            n.includes("phone") ||
            n.includes("mobile") ||
            n.includes("whatsapp") ||
            n.includes("contact")
          );
        });
        if (emailF && userToSync.email && next[emailF.id] !== userToSync.email) {
          next[emailF.id] = userToSync.email;
          if (emailF.name) next[emailF.name] = userToSync.email;
          updated = true;
        }
        if (nameF && !next[nameF.id] && (userToSync.displayName || userToSync.fullName)) {
          const nVal = userToSync.displayName || userToSync.fullName;
          next[nameF.id] = nVal;
          if (nameF.name) next[nameF.name] = nVal;
          updated = true;
        }
        if (phoneF && !next[phoneF.id] && (userToSync.phoneNumber || userToSync.whatsappPhone)) {
          const pVal = userToSync.phoneNumber || userToSync.whatsappPhone;
          next[phoneF.id] = pVal;
          if (phoneF.name) next[phoneF.name] = pVal;
          updated = true;
        }
        return updated ? next : prev;
      });
    }
  }, [authUser, customForm]);

  // Fetch custom form structure with timeout and retry (only if not prefetched)
  useEffect(() => {
    // If we already have initialForm (not undefined), use it and skip the fetch
    if (initialForm !== undefined) {
      const timer = setTimeout(() => {
        if (initialForm && Array.isArray(initialForm.fields) && initialForm.fields.length > 0) {
          // Custom form exists with organizer fields - sanitize without synthetic injections
          console.log(" Using prefetched custom form");
          const sanitizedFields = sanitizeCustomFields(initialForm.fields);
          const normalizedForm = {
            ...initialForm,
            fields: sanitizedFields,
          };
          setCustomForm(normalizedForm);
          setFormData(buildInitialData(sanitizedFields));
        } else {
          // No custom form fields exist - use default fallback form
          console.log("No custom form fields found (prefetched), using default form");
          const defaultForm = {
            ...(initialForm || {}),
            eventId: eventId,
            fields: DEFAULT_FALLBACK_FIELDS,
            theme: {
              logo: null,
              color: "#10b981",
            },
            isPaid: event?.isPaid ?? ((event?.price || event?.ticketPrice) > 0),
            amount: event?.price ?? event?.ticketPrice ?? 199,
            enableCoupons: true,
            status: "published",
            isDefault: true,
          };

          setCustomForm(defaultForm);
          setFormData(buildInitialData(DEFAULT_FALLBACK_FIELDS));
        }
      }, 0);
      return () => clearTimeout(timer);
    }

    async function loadForm() {
      try {
        setFormLoadError(null);

        // 1. First attempt fast direct load from Firestore client
        try {
          const directForm = await getCustomFormByEvent(eventId);
          if (directForm && Array.isArray(directForm.fields) && directForm.fields.length > 0) {
            console.log("Custom form loaded directly from Firestore");
            const sanitizedFields = sanitizeCustomFields(directForm.fields);
            const formToUse = {
              ...directForm,
              fields: sanitizedFields,
            };
            setCustomForm(formToUse);
            setFormData(buildInitialData(sanitizedFields));
            setRetryCount(0);
            return;
          }
        } catch (directErr) {
          console.warn("Direct form fetch fallback to API:", directErr);
        }

        // 2. Fallback to API route
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        const response = await fetch(
          `/api/get-custom-form?eventId=${eventId}`,
          {
            signal: controller.signal,
          },
        );

        clearTimeout(timeoutId);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to load form");
        }

        if (data.success && data.form && Array.isArray(data.form.fields) && data.form.fields.length > 0) {
          console.log("Custom form loaded successfully from API");
          const sanitizedFields = sanitizeCustomFields(data.form.fields);
          const formToUse = {
            ...data.form,
            fields: sanitizedFields,
          };
          setCustomForm(formToUse);
          setFormData(buildInitialData(sanitizedFields));
          setRetryCount(0);
        } else {
          // No custom form exists - fallback to default form
          console.log("No custom form configured, applying default fallback form");
          const defaultForm = {
            eventId: eventId,
            fields: DEFAULT_FALLBACK_FIELDS,
            theme: {
              logo: null,
              color: "#10b981",
            },
            isPaid: event?.isPaid ?? ((event?.price || event?.ticketPrice) > 0),
            amount: event?.price ?? event?.ticketPrice ?? 199,
            enableCoupons: true,
            status: "published",
            isDefault: true,
          };

          setCustomForm(defaultForm);
          setFormData(buildInitialData(DEFAULT_FALLBACK_FIELDS));
          setRetryCount(0);
        }
      } catch (error) {
        console.error("Error loading custom form:", error);

        if (error.name === "AbortError") {
          setFormLoadError("Form loading timed out. Click retry to try again.");
          toast.error("Loading timed out. Please retry.");
        } else {
          setFormLoadError(error.message || "Failed to load registration form");
          toast.error(
            "Failed to load form: " + (error.message || "Unknown error"),
          );
        }
      }
    }

    if (eventId) {
      loadForm();
    }
  }, [eventId, retryCount, initialForm]);

  // Load Razorpay script
  useEffect(() => {
    if (customForm?.isPaid) {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      document.body.appendChild(script);
    }
  }, [customForm]);

  const validateForm = () => {
    const newErrors = {};

    customForm?.fields?.forEach((field) => {
      const rawVal =
        formData[field.id] !== undefined && formData[field.id] !== ""
          ? formData[field.id]
          : (field.name && formData[field.name] !== undefined ? formData[field.name] : "");
      const trimmedVal = typeof rawVal === "string" ? rawVal.trim() : rawVal;

      if (field.required && (trimmedVal === "" || trimmedVal === null || trimmedVal === undefined)) {
        newErrors[field.id] =
          `${field.label || field.name || "This field"} is required`;
        return;
      }

      // Email validation - only if field type is email and value is present
      if (field.type === "email" && trimmedVal) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmedVal)) {
          newErrors[field.id] = "Invalid email address";
        }
      }

      // Phone validation - 10-digit validation only if field is phone and value is present
      const isPhoneField =
        field.type === "tel" ||
        String(field.id).toLowerCase().includes("phone") ||
        String(field.id).toLowerCase().includes("whatsapp") ||
        String(field.label || field.name).toLowerCase().includes("phone") ||
        String(field.label || field.name).toLowerCase().includes("whatsapp") ||
        String(field.label || field.name).toLowerCase().includes("contact");

      if (isPhoneField && trimmedVal) {
        const digitsOnly = String(trimmedVal).replace(/\D/g, "");
        const isTenDigitValid =
          digitsOnly.length === 10 ||
          (digitsOnly.length === 12 && digitsOnly.startsWith("91")) ||
          (digitsOnly.length === 11 && digitsOnly.startsWith("0"));

        if (!isTenDigitValid) {
          newErrors[field.id] = "Please enter a valid 10-digit phone number";
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Coupon handlers
  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      toast.error("Please enter a coupon code");
      return;
    }

    if (!customForm?.amount) {
      toast.error("This event is free. No coupon needed!");
      return;
    }

    setCouponValidating(true);
    setCouponError("");

    try {
      const response = await fetch("/api/validate-coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          couponCode: couponCode.trim(),
          eventId,
          amount: customForm.amount,
        }),
      });

      const data = await response.json();

      if (data.valid) {
        setCouponData(data);
        setCouponError("");
        toast.success(
          data.message || `${data.discountPercent}% discount applied!`,
        );
      } else {
        setCouponData(null);
        setCouponError(data.message || "Invalid coupon code");
        toast.error(data.message || "Invalid coupon code");
      }
    } catch (error) {
      console.error("Error validating coupon:", error);
      setCouponData(null);
      setCouponError("Failed to validate coupon");
      toast.error("Failed to validate coupon");
    } finally {
      setCouponValidating(false);
    }
  };

  const removeCoupon = () => {
    setCouponCode("");
    setCouponData(null);
    setCouponError("");
    toast.info("Coupon removed");
  };

  // Handle EXISTING user login
  const handleExistingUserLogin = async () => {
    if (!loginPassword || loginPassword.length < 6) {
      toast.error("Please enter your password (at least 6 characters)");
      return;
    }

    setIsLoggingIn(true);

    try {
      console.log("LOGGING IN EXISTING USER");

      // Login with email and password
      const user = await login(tempFormData.email, loginPassword);
      console.log("LOGIN SUCCESSFUL:", user.id);

      setShowLoginModal(false);

      const isPaidEvent = tempFormData.isPaid;

      if (isPaidEvent) {
        // Paid event - initiate payment with logged-in user
        await handlePaymentFlowForExistingUser(user);
      } else {
        // Free event - register directly
        await registerExistingUser(user);
      }
    } catch (error) {
      console.error("Login error:", error);
      if (
        error.message?.includes("wrong-password") ||
        error.message?.includes("invalid-credential")
      ) {
        toast.error("Incorrect password. Please try again.");
      } else {
        toast.error("Login failed: " + error.message);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Handle payment for existing logged-in users
  const handlePaymentFlowForExistingUser = async (user) => {
    try {
      setPaymentProcessing(true);

      const response = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          registrationData: { fullName: user.fullName, email: user.email, whatsappPhone: user.whatsappPhone, formData: tempFormData?.formData || {} },
          couponCode: couponCode || null,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create payment order");
      }

      const orderData = await response.json();

      if (!orderData.success) {
        throw new Error(orderData.error || "Failed to create order");
      }

      const gatewayOrder = orderData.order || {
        id: orderData.razorpayOrderId || orderData.orderId,
        razorpayKeyId: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
      };
      const options = {
        key: gatewayOrder.razorpayKeyId || orderData.keyId,
        amount: gatewayOrder.amount,
        currency: gatewayOrder.currency,
        name: "Ticketलेलो",
        description: `Ticket for ${event?.name || "Event"}`,
        order_id: gatewayOrder.id,
        handler: async function (response) {
          try {
            const verifyResponse = await fetch("/api/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                eventId,
              }),
            });

            const verifyData = await verifyResponse.json();

            if (verifyData.success) {
              const emailSent = verifyData.ticketId
                ? await sendRegistrationConfirmation(user.email, tempFormData.fullName || user.fullName || user.email, event?.name || "Event", verifyData.ticketId)
                : false;
              toast.success(emailSent ? "Payment complete. Ticket sent to your email." : "Payment complete. Ticket is available in your dashboard.");

              setShowSuccessModal(true);
              setPaymentProcessing(false);
              setIsLoading(false);
            } else {
              toast.error("Payment verification failed");
              setPaymentProcessing(false);
              setIsLoading(false);
              setTimeout(() => router.push("/"), 2000);
            }
          } catch (error) {
            console.error("Payment verification error:", error);
            toast.error("Payment verification failed");
            setPaymentProcessing(false);
            setIsLoading(false);
            setTimeout(() => router.push("/"), 2000);
          }
        },
        modal: {
          ondismiss: function () {
            toast.error("Payment cancelled");
            setPaymentProcessing(false);
            setIsLoading(false);
            setTimeout(() => router.push("/"), 2000);
          },
        },
        theme: {
          color: customForm?.theme?.color || "#10b981",
        },
      };

      if (!window.Razorpay) {
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.async = true;
        script.onload = () => {
          const rzp = new window.Razorpay(options);
          rzp.open();
        };
        document.body.appendChild(script);
      } else {
        const rzp = new window.Razorpay(options);
        rzp.open();
      }
    } catch (error) {
      console.error("Payment initialization error:", error);
      toast.error("Failed to initialize payment");
      setPaymentProcessing(false);
      setIsLoading(false);
      setTimeout(() => router.push("/"), 2000);
    }
  };

  // Server-owned free admission issuance is idempotent and capacity checked.
  const registerExistingUser = async (user, payloadData = null) => {
    try {
      const dataToSend = payloadData || tempFormData?.formData || {};
      const response = await fetch("/api/register-free", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, formData: dataToSend }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Registration failed");
      const requiresApproval = Boolean(event?.requireApproval || result.requiresApproval);
      setIsPendingApproval(requiresApproval);
      if (requiresApproval) {
        toast.info("Registration submitted! Organiser approval is required.");
      } else {
        const attendeeName = dataToSend.fullName || tempFormData?.fullName || user.fullName || user.email;
        const emailSent = await sendRegistrationConfirmation(
          user.email,
          attendeeName,
          event?.name || "Event",
          result.ticketId
        );
        toast.success(
          result.alreadyRegistered
            ? "You are already registered for this event"
            : "Registration successful"
        );
        if (!emailSent)
          toast.info("Sign in to your attendee dashboard to view your ticket");
      }
      setShowSuccessModal(true);
    } catch (error) {
      console.error("Free registration failed:", error.message);
      toast.error(error.message || "Registration failed");
    } finally {
      setIsLoading(false);
      setPaymentProcessing(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isClosedForRegistration) {
      toast.error("Registration is closed for this event.");
      return;
    }

    if (!validateForm()) {
      toast.error("Please fill all required fields correctly");
      return;
    }

    setIsLoading(true);

    try {
      // Find form field values - check both type, id, and label for robust matching
      const emailField = customForm?.fields?.find((f) => {
        const type = String(f?.type || "").toLowerCase();
        const name = String(f?.name || f?.label || "").toLowerCase();
        const id = String(f?.id || "").toLowerCase();
        return type === "email" || name.includes("email") || id.includes("email");
      });
      const phoneField = customForm?.fields?.find((f) => {
        const type = String(f?.type || "").toLowerCase();
        const name = String(f?.name || f?.label || "").toLowerCase();
        const id = String(f?.id || "").toLowerCase();
        return (
          type === "tel" ||
          name.includes("phone") ||
          name.includes("mobile") ||
          name.includes("contact") ||
          name.includes("whatsapp") ||
          id.includes("phone") ||
          id.includes("mobile") ||
          id.includes("whatsapp")
        );
      });
      const nameField = customForm?.fields?.find((f) => {
        const name = String(f?.name || f?.label || "").toLowerCase();
        const id = String(f?.id || "").toLowerCase();
        return (
          id === "fullname" ||
          id === "name" ||
          id === "attendee_name" ||
          (name.includes("name") &&
            !name.includes("college") &&
            !name.includes("school") &&
            !name.includes("team") &&
            !name.includes("company"))
        );
      });

      let email =
        effectiveUser?.email ||
        (emailField ? (formData[emailField.id] || formData[emailField.name]) : "") ||
        formData.email ||
        auth.currentUser?.email ||
        "";
      email = typeof email === "string" ? email.trim().toLowerCase() : "";

      let phone =
        (phoneField ? (formData[phoneField.id] || formData[phoneField.name]) : "") ||
        formData.whatsappPhone ||
        formData.phone ||
        auth.currentUser?.phoneNumber ||
        "";
      phone = typeof phone === "string" ? phone.trim() : "";

      let fullName =
        (nameField ? (formData[nameField.id] || formData[nameField.name]) : "") ||
        formData.fullName ||
        formData.name ||
        auth.currentUser?.displayName ||
        "Attendee";
      fullName = typeof fullName === "string" ? fullName.trim() : "Attendee";

      // Log extracted values for debugging
      console.log("=".repeat(50));
      console.log("FORM SUBMISSION - Extracted Data:");
      console.log("Email field found:", emailField?.name || emailField?.label, emailField?.id);
      console.log("Email from form:", email);
      console.log(" Phone field found:", phoneField?.name || phoneField?.label, phoneField?.id);
      console.log(" Phone from form:", phone);
      console.log(" Name field found:", nameField?.name || nameField?.label, nameField?.id);
      console.log(" Name from form:", fullName);
      console.log(" Full form data:", formData);
      console.log("=".repeat(50));

      // Email is required for ticket delivery & account identity
      if (!email || email === "") {
        toast.info("Please sign in to register for this event");
        setShowLoginModal(true);
        setIsLoading(false);
        return;
      }

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        toast.error("Please provide a valid email address.");
        setIsLoading(false);
        return;
      }

      // Phone validation - enforce valid 10-digit number ONLY if phoneField is in the form schema
      if (phoneField) {
        if (phoneField.required && (!phone || phone === "")) {
          toast.error("Phone number is required. Please provide your phone number.");
          setIsLoading(false);
          return;
        }
        if (phone) {
          const phoneDigits = String(phone).replace(/\D/g, "");
          const isTenDigitValid =
            phoneDigits.length === 10 ||
            (phoneDigits.length === 12 && phoneDigits.startsWith("91")) ||
            (phoneDigits.length === 11 && phoneDigits.startsWith("0"));

          if (!isTenDigitValid) {
            toast.error("Please provide a valid 10-digit phone number.");
            setIsLoading(false);
            return;
          }
        }
      }

      const signedInUser = auth.currentUser;
      if (
        signedInUser &&
        signedInUser.email &&
        email &&
        signedInUser.email.toLowerCase() !== email.toLowerCase()
      ) {
        toast.error("Sign in with the email address entered on this form");
        setIsLoading(false);
        return;
      }

      // Build unified, canonical form payload containing all organizer fields
      const payloadFormData = {
        ...formData,
        fullName: fullName || "Attendee",
        name: fullName || "Attendee",
        email: email,
        whatsappPhone: phone || "",
        phone: phone || "",
      };
      customForm?.fields?.forEach((f) => {
        const val =
          formData[f.id] !== undefined && formData[f.id] !== ""
            ? formData[f.id]
            : (f.name && formData[f.name] !== undefined ? formData[f.name] : "");
        if (f.id !== undefined && f.id !== null) {
          payloadFormData[f.id] = val;
        }
        if (f.name) {
          payloadFormData[f.name] = val;
        }
        if (f.label) {
          payloadFormData[f.label] = val;
        }
      });
      if (nameField?.id) {
        payloadFormData[nameField.id] = fullName;
      }
      if (emailField?.id) {
        payloadFormData[emailField.id] = email;
      }
      if (phoneField?.id) {
        payloadFormData[phoneField.id] = phone;
      }

      const existingUser = signedInUser
        ? (await getCurrentUser(signedInUser.uid)) || {
            id: signedInUser.uid,
            email: signedInUser.email,
            fullName: signedInUser.displayName || fullName,
          }
        : null;

      const isPaidEvent = customForm?.isPaid && customForm?.amount > 0;

      // Store form data for state persistence
      const submissionContext = {
        email,
        phone,
        fullName,
        eventId,
        event,
        customForm,
        formData: payloadFormData,
        isPaid: isPaidEvent,
      };
      setTempFormData(submissionContext);

      if (isPaidEvent) {
        let checkoutUser = existingUser;
        if (!checkoutUser) {
          const secretBytes = new Uint8Array(32);
          window.crypto.getRandomValues(secretBytes);
          const oneTimeSecret = Array.from(secretBytes, (byte) =>
            byte.toString(16).padStart(2, "0")
          ).join("");
          try {
            checkoutUser = await signup(
              email,
              oneTimeSecret,
              fullName || email,
              phone || ""
            );
            await sendPasswordResetEmail(auth, email);
          } catch (accountError) {
            if (
              accountError.code === "auth/email-already-in-use" ||
              /already exists/i.test(accountError.message || "")
            ) {
              setShowLoginModal(true);
              setIsLoading(false);
              return;
            }
            throw accountError;
          }
        }
        await handlePaymentFlow(
          email,
          phone,
          fullName,
          checkoutUser,
          payloadFormData
        );
      } else if (existingUser) {
        await registerExistingUser(existingUser, payloadFormData);
      } else {
        const secretBytes = new Uint8Array(32);
        window.crypto.getRandomValues(secretBytes);
        const oneTimeSecret = Array.from(secretBytes, (byte) =>
          byte.toString(16).padStart(2, "0")
        ).join("");
        await createAccountAndRegister(
          email,
          phone,
          fullName,
          oneTimeSecret,
          payloadFormData
        );
      }
    } catch (error) {
      console.error("Registration error:", error);
      toast.error(error.message || "Registration failed. Please try again.");
      setIsLoading(false);
    }
  };

  // Handle payment flow for both new and existing users
  const handlePaymentFlow = async (
    email,
    phone,
    fullName,
    existingUser = null,
    payloadData = null
  ) => {
    try {
      setPaymentProcessing(true);
      const dataToSend = payloadData || tempFormData?.formData || {};

      const response = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          registrationData: {
            fullName,
            email,
            whatsappPhone: phone,
            formData: dataToSend,
          },
          couponCode: couponCode || null,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create payment order");
      }

      const orderData = await response.json();

      if (!orderData.success) {
        throw new Error(orderData.error || "Failed to create order");
      }

      // Load Razorpay checkout
      const gatewayOrder = orderData.order || {
        id: orderData.razorpayOrderId || orderData.orderId,
        razorpayKeyId: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
      };
      const options = {
        key: gatewayOrder.razorpayKeyId || orderData.keyId,
        amount: gatewayOrder.amount,
        currency: gatewayOrder.currency,
        name: "Ticketलेलो",
        description: `Ticket for ${event?.name || "Event"}`,
        order_id: gatewayOrder.id,
        handler: async function (response) {
          try {
            console.log(" Payment successful");

            // Verify payment
            const verifyResponse = await fetch("/api/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                eventId,
              }),
            });

            const verifyData = await verifyResponse.json();

            if (verifyData.success) {
              const emailSent = verifyData.ticketId
                ? await sendRegistrationConfirmation(
                    email,
                    fullName || email,
                    event?.name || "Event",
                    verifyData.ticketId
                  )
                : false;
              toast.success(
                emailSent
                  ? "Payment complete. Ticket sent to your email."
                  : "Payment complete. Ticket is available in your dashboard."
              );

              setShowSuccessModal(true);
              setPaymentProcessing(false);
              setIsLoading(false);
            } else {
              toast.error("Payment verification failed");
              setPaymentProcessing(false);
              setIsLoading(false);
              setTimeout(() => router.push("/"), 2000);
            }
          } catch (error) {
            console.error("Payment verification error:", error);
            toast.error("Payment verification failed");
            setPaymentProcessing(false);
            setIsLoading(false);
            setTimeout(() => router.push("/"), 2000);
          }
        },
        modal: {
          ondismiss: function () {
            toast.error("Payment cancelled");
            setPaymentProcessing(false);
            setIsLoading(false);
            setTimeout(() => router.push("/"), 2000);
          },
        },
        theme: {
          color: customForm?.theme?.color || "#10b981",
        },
      };

      // Load Razorpay script if not loaded
      if (!window.Razorpay) {
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.async = true;
        script.onload = () => {
          const rzp = new window.Razorpay(options);
          rzp.open();
        };
        document.body.appendChild(script);
      } else {
        const rzp = new window.Razorpay(options);
        rzp.open();
      }
    } catch (error) {
      console.error("Payment initialization error:", error);
      toast.error("Failed to initialize payment");
      setPaymentProcessing(false);
      setIsLoading(false);
      setTimeout(() => router.push("/"), 2000);
    }
  };

  const createAccountAndRegister = async (
    email,
    phone,
    fullName,
    password,
    payloadData = null
  ) => {
    try {
      const user = await signup(
        email,
        password,
        fullName || email,
        phone || ""
      );
      await sendPasswordResetEmail(auth, email);
      const dataToSend = payloadData || tempFormData?.formData || {};
      const response = await fetch("/api/register-free", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: eventId,
          formData: dataToSend,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Registration failed");
      const requiresApproval = Boolean(event?.requireApproval || result.requiresApproval);
      setIsPendingApproval(requiresApproval);
      if (requiresApproval) {
        toast.info("Registration submitted! Organiser approval is required.");
      } else {
        const emailSent = await sendRegistrationConfirmation(
          email,
          user.fullName || fullName || email,
          event?.name || "Event",
          result.ticketId
        );
        toast.success(
          emailSent
            ? "Registration complete and ticket sent"
            : "Registration complete. Sign in to view your ticket"
        );
      }
      setShowSuccessModal(true);
    } catch (error) {
      console.error("Free account registration failed:", error.message);
      if (error.code === "auth/email-already-in-use" || /already exists/i.test(error.message || "")) {
        setShowLoginModal(true);
        toast.info("An account already exists. Sign in to continue.");
      } else {
        toast.error(error.message || "Registration failed");
      }
    } finally {
      setIsLoading(false);
      setPaymentProcessing(false);
    }
  };


  const getFieldIcon = (field) => {
    const id = String(field?.id ?? "").toLowerCase();
    const type = String(field?.type ?? "").toLowerCase();
    const label = String(field?.label || field?.name || "").toLowerCase();

    if (type === "email" || id.includes("email") || label.includes("email")) {
      return <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-[rgba(6,26,63,0.54)] dark:text-slate-400 pointer-events-none" />;
    }
    if (type === "tel" || id.includes("phone") || id.includes("mobile") || id.includes("whatsapp") || label.includes("phone")) {
      return <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-[rgba(6,26,63,0.54)] dark:text-slate-400 pointer-events-none" />;
    }
    if (id.includes("password") || label.includes("password")) {
      return <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-[rgba(6,26,63,0.54)] dark:text-slate-400 pointer-events-none" />;
    }
    if (id.includes("name") || label.includes("name") || id.includes("user")) {
      return <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-[rgba(6,26,63,0.54)] dark:text-slate-400 pointer-events-none" />;
    }
    if (id.includes("college") || id.includes("university") || id.includes("school") || id.includes("company") || id.includes("org") || label.includes("college") || label.includes("school")) {
      return <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-[rgba(6,26,63,0.54)] dark:text-slate-400 pointer-events-none" />;
    }
    return <Tag className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-[rgba(6,26,63,0.54)] dark:text-slate-400 pointer-events-none" />;
  };

  const renderField = (field) => {
    const value =
      formData[field.id] !== undefined && formData[field.id] !== ""
        ? formData[field.id]
        : (field.name && formData[field.name] !== undefined ? formData[field.name] : "");
    const error = errors[field.id] || (field.name ? errors[field.name] : null);

    const updateValue = (newValue) => {
      setFormData((prev) => {
        const next = { ...prev, [field.id]: newValue };
        if (field.name) next[field.name] = newValue;
        return next;
      });
      if (errors[field.id] || (field.name && errors[field.name])) {
        setErrors((prev) => {
          const next = { ...prev, [field.id]: null };
          if (field.name) next[field.name] = null;
          return next;
        });
      }
    };

    switch (field.type) {
      case "text":
      case "email":
      case "tel": {
        const isTel = field.type === "tel";
        const isEmail =
          field.type === "email" ||
          String(field.name || field.label || field.id).toLowerCase() === "email" ||
          String(field.name || field.label || field.id).toLowerCase().includes("email");
        const isUserLoggedIn = Boolean(effectiveUser?.email);
        const isEmailLocked = isEmail && isUserLoggedIn;
        const fieldValue = isEmailLocked
          ? effectiveUser.email
          : (formData[field.id] !== undefined && formData[field.id] !== ""
            ? formData[field.id]
            : (field.name && formData[field.name] !== undefined ? formData[field.name] : ""));

        const handleInputChange = (e) => {
          if (isEmailLocked) return;
          let val = e.target.value;
          if (isTel) {
            // Allow only numbers, +, -, and spaces
            val = val.replace(/[^\d+\s-]/g, "");
            // If doesn't start with '+', cap raw digits at 10
            if (!val.startsWith("+")) {
              const digits = val.replace(/\D/g, "");
              if (digits.length > 10) {
                val = digits.slice(0, 10);
              }
            } else {
              // Country code +91 with 10 digits = 12 digits total
              const digits = val.replace(/\D/g, "");
              if (digits.length > 12) {
                val = "+" + digits.slice(0, 12);
              }
            }
          }
          updateValue(val);
        };

        const handleBlur = () => {
          if (isTel && value) {
            const digits = String(value).replace(/\D/g, "");
            const isTenDigitValid =
              digits.length === 10 ||
              (digits.length === 12 && digits.startsWith("91")) ||
              (digits.length === 11 && digits.startsWith("0"));
            if (!isTenDigitValid) {
              setErrors((prev) => ({
                ...prev,
                [field.id]: "Please enter a valid 10-digit phone number",
              }));
            }
          }
        };

        return (
          <div key={field.id} className="space-y-1.5 w-full">
            <div className="flex items-center justify-between gap-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-[#D0D0D1]">
                {field.label || field.name || "Field"}{" "}
                {field.required && <span className="text-red-500">*</span>}
              </label>
              {isEmailLocked && (
                <span className="text-[10px] text-[#3DD68C] font-mono bg-[#3DD68C]/10 px-2 py-0.5 rounded-full flex items-center gap-1 font-semibold select-none">
                  <CheckCircle className="w-2.5 h-2.5" /> Verified Account
                </span>
              )}
            </div>
            <div className="relative">
              <input
                type={isEmail ? "email" : field.type}
                inputMode={isTel ? "tel" : isEmail ? "email" : undefined}
                maxLength={isTel ? 15 : undefined}
                placeholder={
                  field.placeholder ||
                  (isTel
                    ? "10-digit mobile number"
                    : `Your ${String(field.label || field.name || "value").toLowerCase()}`)
                }
                value={fieldValue}
                readOnly={isEmailLocked}
                onChange={handleInputChange}
                onBlur={handleBlur}
                disabled={isLoading}
                className={`w-full px-3.5 py-2.5 h-11 border rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-[#9B9EA4] focus:outline-none transition-all text-base sm:text-sm ${
                  isEmailLocked
                    ? "bg-slate-100 dark:bg-[#1A1C1F] cursor-not-allowed opacity-90 border-slate-200 dark:border-[#2A2D31] select-none pr-10"
                    : error
                    ? "border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500 bg-slate-50 dark:bg-[#212327]"
                    : "border-slate-200 dark:border-[#2A2D31] focus:border-[#FE760B] focus:ring-1 focus:ring-[#FE760B] bg-slate-50 dark:bg-[#212327]"
                }`}
              />
              {isEmailLocked && (
                <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none select-none" />
              )}
            </div>
            {isEmailLocked && (
              <p className="text-[11px] text-slate-500 dark:text-[#9B9EA4] flex items-center gap-1">
                <span>Email is locked to your account for security and consistency.</span>
              </p>
            )}
            {error && !isEmailLocked && (
              <p className="text-[11px] text-red-500 dark:text-red-400 mt-1 font-medium">{error}</p>
            )}
          </div>
        );
      }

      case "textarea":
        return (
          <div key={field.id} className="space-y-1.5 w-full">
            <label className="block text-xs font-semibold text-slate-700 dark:text-[#D0D0D1]">
              {field.label || field.name || "Field"}{" "}
              {field.required && <span className="text-red-500">*</span>}
            </label>
            <textarea
              placeholder={
                field.placeholder ||
                `Enter ${String(field.label || field.name || "text").toLowerCase()}`
              }
              value={value}
              onChange={(e) => updateValue(e.target.value)}
              disabled={isLoading}
              rows={3}
              className="w-full p-3 bg-slate-50 dark:bg-[#212327] border border-slate-200 dark:border-[#2A2D31] rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-[#9B9EA4] focus:outline-none focus:border-[#FE760B] focus:ring-1 focus:ring-[#FE760B] transition-all text-base sm:text-sm resize-none"
            />
            {error && (
              <p className="text-[11px] text-red-500 dark:text-red-400">{error}</p>
            )}
          </div>
        );

      case "radio":
        return (
          <div key={field.id} className="space-y-2 w-full">
            <label className="block text-xs font-semibold text-slate-700 dark:text-[#D0D0D1]">
              {field.label || field.name || "Field"}{" "}
              {field.required && <span className="text-red-500">*</span>}
            </label>
            <div className="space-y-2">
              {field.options?.map((option, idx) => (
                <label
                  key={idx}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                    value === option
                      ? "bg-[#FE760B]/10 border-[#FE760B] text-[#FE760B] font-medium"
                      : "bg-slate-50 dark:bg-[#212327] border-slate-200 dark:border-[#2A2D31] text-slate-700 dark:text-[#D0D0D1] hover:border-slate-300 dark:hover:border-[#3A3D42]"
                  }`}
                >
                  <input
                    type="radio"
                    name={String(field.id)}
                    value={option}
                    checked={value === option}
                    onChange={(e) => updateValue(e.target.value)}
                    disabled={isLoading}
                    className="w-4 h-4 text-[#FE760B] border-slate-300 dark:border-[#2A2D31] focus:ring-[#FE760B]"
                  />
                  <span className="text-sm font-medium">{option}</span>
                </label>
              ))}
            </div>
            {error && (
              <p className="text-[11px] text-red-500 dark:text-red-400">{error}</p>
            )}
          </div>
        );

      case "dropdown":
        return (
          <div key={field.id} className="space-y-1.5 w-full">
            <label className="block text-xs font-semibold text-slate-700 dark:text-[#D0D0D1]">
              {field.label || field.name || "Field"}{" "}
              {field.required && <span className="text-red-500">*</span>}
            </label>
            <Select
              value={value}
              onValueChange={updateValue}
              disabled={isLoading}
            >
              <SelectTrigger className="w-full h-11 px-3.5 py-2.5 bg-slate-50 dark:bg-[#212327] border border-slate-200 dark:border-[#2A2D31] rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-[#FE760B] text-base sm:text-sm">
                <SelectValue
                  placeholder={field.placeholder || "Select"}
                />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-[#1A1C1F] border border-slate-200 dark:border-[#2A2D31] text-slate-900 dark:text-white shadow-2xl rounded-xl">
                {field.options?.map((option, idx) => (
                  <SelectItem
                    key={idx}
                    value={option}
                    className="text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-[#212327] text-sm cursor-pointer"
                  >
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {error && (
              <p className="text-[11px] text-red-500 dark:text-red-400">{error}</p>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  if (formLoadError) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-5 max-w-md text-center">
          <X className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-red-900 dark:text-red-400 mb-1">
            Failed to Load Form
          </h3>
          <p className="text-xs text-red-700 dark:text-red-300 mb-3">
            {formLoadError}
          </p>
          <Button
            onClick={() => setRetryCount((prev) => prev + 1)}
            className="bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs h-8 px-3"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!customForm) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4">
        <Loader2 className="w-6 h-6 animate-spin text-[#FF6A00] mb-2" />
        <p className="text-xs text-slate-500 dark:text-slate-400 animate-pulse">
          Loading registration form...
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="w-full">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col space-y-4">
            {customForm.fields
              ?.filter((field) => field.id && field.type)
              .map((field) => renderField(field))}
          </div>

          {/* Coupon Code (only show for paid events) */}
          {customForm.isPaid &&
            customForm.amount > 0 &&
            customForm.enableCoupons && (
              <div className="space-y-1.5 w-full">
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#D0D0D1]">
                  Coupon code
                </label>
                {!couponData ? (
                  <div className="flex gap-2">
                    <input
                      placeholder="Optional"
                      value={couponCode}
                      onChange={(e) =>
                        setCouponCode(e.target.value.toUpperCase())
                      }
                      disabled={isLoading || couponValidating}
                      className="flex-1 min-w-0 px-3.5 py-2 h-11 bg-slate-50 dark:bg-[#212327] border border-slate-200 dark:border-[#2A2D31] rounded-xl text-base sm:text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-[#9B9EA4] focus:outline-none focus:border-[#FE760B] transition-all uppercase"
                    />
                    <button
                      type="button"
                      onClick={handleApplyCoupon}
                      disabled={
                        isLoading || couponValidating || !couponCode.trim()
                      }
                      className="px-4 py-2 h-11 bg-slate-100 hover:bg-slate-200 dark:bg-[#212327] dark:hover:bg-[#2A2D31] border border-slate-200 dark:border-[#2A2D31] text-slate-800 dark:text-white font-semibold text-sm rounded-xl transition-all flex items-center justify-center shrink-0"
                    >
                      {couponValidating ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Apply"
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="bg-[#FE760B]/10 border border-[#FE760B]/30 rounded-xl p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-[#FE760B]" />
                          <span className="text-sm font-semibold text-[#FE760B]">
                            {couponCode}: {couponData.discountPercent}% OFF
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={removeCoupon}
                        className="text-xs text-slate-500 dark:text-[#9B9EA4] hover:text-slate-800 dark:hover:text-white underline ml-2"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )}
                {couponError && (
                  <p className="text-[11px] text-red-500 dark:text-red-400">
                    {couponError}
                  </p>
                )}
              </div>
            )}

          {/* High Contrast CTA Button or Closed for Registration */}
          {isClosedForRegistration ? (
            <button
              type="button"
              disabled
              className="w-full bg-slate-200 dark:bg-[#1E2024] text-slate-500 dark:text-[#9B9EA4] border border-slate-300 dark:border-[#2A2D31] cursor-not-allowed font-bold h-12 rounded-xl flex items-center justify-center gap-2 text-sm sm:text-base mt-4 opacity-80 shadow-none select-none transition-all"
            >
              <AlertCircle className="w-4 h-4 text-[#FE760B]" />
              <span>Registration Closed</span>
            </button>
          ) : (
            <button
              type="submit"
              disabled={isLoading || paymentProcessing}
              className="w-full bg-[#131517] hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-[#131517] disabled:opacity-50 disabled:cursor-not-allowed font-bold h-12 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 text-sm sm:text-base mt-4 cursor-pointer"
            >
              {isLoading || paymentProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white dark:text-black" />
                  <span>{paymentProcessing ? "Processing Payment..." : "Registering..."}</span>
                </>
              ) : customForm?.isPaid && customForm?.amount > 0 ? (
                <span>
                  {couponData ? (
                    `Pay ₹${couponData.finalAmount} & register`
                  ) : (
                    `Pay ₹${customForm.amount} & register`
                  )}
                </span>
              ) : (
                <span>Register</span>
              )}
            </button>
          )}
          <p className="text-center text-xs text-slate-500 dark:text-[#9B9EA4] mt-2">
            Secure payment via Razorpay
          </p>
        </form>
      </div>

      {/* Login Modal for Existing Users */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl sm:rounded-3xl p-5 xs:p-6 sm:p-7 shadow-2xl max-w-md w-full max-h-[90dvh] overflow-y-auto animate-scale-in text-white">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-5 sm:mb-6">
              <div className="flex items-center gap-3">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border"
                  style={{
                    backgroundColor: `${themeColor}15`,
                    borderColor: `${themeColor}35`,
                    color: themeColor,
                  }}
                >
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    Welcome Back!
                  </h3>
                  <p className="text-xs text-[#9B9EA4] mt-0.5">
                    Sign in to your account to complete registration
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowLoginModal(false);
                  setLoginPassword("");
                  setIsLoading(false);
                }}
                className="p-1.5 rounded-lg text-[#9B9EA4] hover:text-white hover:bg-[#212327] transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 sm:space-y-5 mb-6">
              {/* Email Display Card */}
              <div className="bg-[#212327] border border-[#2A2D31] rounded-xl p-3.5 sm:p-4">
                <p className="text-[11px] font-bold tracking-wider uppercase text-[#9B9EA4] mb-1 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" style={{ color: themeColor }} />
                  <span>Your Email Address</span>
                </p>
                <p className="font-mono text-sm sm:text-base font-bold text-white break-all">
                  {tempFormData?.email || "Email not found"}
                </p>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[#D0D0D1]">
                  Enter Your Password
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your account password..."
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && handleExistingUserLogin()
                    }
                    className="h-11 sm:h-12 bg-[#131517] border border-[#2A2D31] focus:border-[#FE760B] focus:ring-1 focus:ring-[#FE760B] text-white font-mono rounded-xl pl-3.5 pr-11 text-sm placeholder:text-[#9B9EA4]/50 transition-all"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9B9EA4] hover:text-white transition-colors p-1"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {loginPassword && loginPassword.length < 6 && (
                  <p className="text-xs text-red-400 mt-1">
                    Password must be at least 6 characters
                  </p>
                )}
              </div>

              {/* Forgot Password Link */}
              <div className="text-center pt-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowLoginModal(false);
                    router.push("/login");
                  }}
                  className="text-xs font-semibold text-[#FE760B] hover:text-[#FF8A2B] hover:underline transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Key className="w-3.5 h-3.5" />
                  Forgot password? Reset it here
                </button>
              </div>

              {/* Official Note */}
              <div className="bg-[#212327] border border-[#2A2D31] rounded-xl p-3 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-[#FE760B] shrink-0 mt-0.5" />
                <p className="text-xs text-[#9B9EA4] leading-relaxed">
                  <strong className="text-white font-semibold">Note:</strong> Use the password you set when you first registered on TicketLelo.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleExistingUserLogin}
                disabled={
                  isLoggingIn || !loginPassword || loginPassword.length < 6
                }
                style={{
                  backgroundColor: themeColor,
                }}
                className="flex-1 h-11 sm:h-12 text-[#131517] font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-105 active:scale-[0.99]"
              >
                {isLoggingIn ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#131517]" />
                    <span>Logging in...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 text-[#131517]" />
                    <span>Login &amp; Continue</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLoginModal(false);
                  setLoginPassword("");
                  setIsLoading(false);
                }}
                disabled={isLoggingIn}
                className="h-11 sm:h-12 px-5 bg-[#212327] hover:bg-[#2A2D31] text-[#D0D0D1] hover:text-white border border-[#2A2D31] font-semibold rounded-xl transition-colors text-sm cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-[#1A1C1F] rounded-2xl sm:rounded-3xl p-5 xs:p-6 sm:p-8 shadow-2xl max-w-lg w-full border border-[#2A2D31] max-h-[90dvh] overflow-y-auto animate-scale-in text-white">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#2A2D31]">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{
                    backgroundColor: isPendingApproval ? "rgba(253,224,3,0.15)" : `${themeColor}15`,
                    borderColor: isPendingApproval ? "rgba(253,224,3,0.35)" : `${themeColor}35`,
                    color: isPendingApproval ? "#FDE003" : themeColor,
                  }}
                >
                  <CheckCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">
                    {isPendingApproval ? "Registration Submitted" : "Registration Complete"}
                  </h3>
                  <p className="text-xs text-[#9B9EA4]">
                    {isPendingApproval ? "Pending organiser review" : "Your ticket is ready"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSuccessModal(false)}
                className="p-1.5 hover:bg-[#212327] rounded-lg text-[#9B9EA4] hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="space-y-4">
              {/* Ticket Info */}
              <div
                className="rounded-xl p-4 border"
                style={{
                  backgroundColor: isPendingApproval ? "rgba(253,224,3,0.08)" : `${themeColor}12`,
                  borderColor: isPendingApproval ? "rgba(253,224,3,0.25)" : `${themeColor}30`,
                }}
              >
                <div className="flex items-start gap-3">
                  <CheckCircle
                    className="w-5 h-5 shrink-0 mt-0.5"
                    style={{ color: isPendingApproval ? "#FDE003" : themeColor }}
                  />
                  <div className="flex-1">
                    <p
                      className="font-bold text-sm mb-1"
                      style={{ color: isPendingApproval ? "#FDE003" : themeColor }}
                    >
                      {isPendingApproval ? "Application Pending Organiser Approval" : "Registration Confirmed"}
                    </p>
                    <p className="text-xs text-[#D0D0D1]">
                      {isPendingApproval
                        ? "This event requires approval from the organiser. You will be able to view and use your ticket once your application has been approved."
                        : "Your pass has been generated. You can view or download it from your attendee dashboard."}
                    </p>
                  </div>
                </div>
              </div>

              {/* Info Message */}
              <div className="bg-[#212327] border border-[#2A2D31] rounded-xl p-4">
                <p className="text-xs text-[#D0D0D1] leading-relaxed">
                  <strong className="text-white">What&apos;s next?</strong> Sign in to your attendee dashboard with your registered email to view available tickets and QR passes.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 mt-6 pt-4 border-t border-[#2A2D31]">
              <button
                type="button"
                onClick={() => {
                  setShowSuccessModal(false);
                  toast.info(
                    "Please sign in with your credentials to access your dashboard",
                    { duration: 4000 }
                  );
                  router.push("/login");
                }}
                style={{ backgroundColor: themeColor }}
                className="flex-1 h-11 sm:h-12 text-[#131517] font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 text-sm cursor-pointer hover:brightness-105"
              >
                Sign In to Dashboard
              </button>
              <button
                type="button"
                onClick={() => setShowSuccessModal(false)}
                className="h-11 sm:h-12 px-5 bg-[#212327] hover:bg-[#2A2D31] text-[#D0D0D1] hover:text-white border border-[#2A2D31] font-semibold rounded-xl transition-colors text-sm cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
