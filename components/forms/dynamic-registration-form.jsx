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
  ShieldCheck,
} from "lucide-react";

export function DynamicRegistrationForm({ eventId, event, initialForm }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [customForm, setCustomForm] = useState(null);
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [tempFormData, setTempFormData] = useState(null);
  const [loginPassword, setLoginPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [formLoadError, setFormLoadError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  // Coupon state
  const [couponCode, setCouponCode] = useState("");
  const [couponValidating, setCouponValidating] = useState(false);
  const [couponData, setCouponData] = useState(null);
  const [couponError, setCouponError] = useState("");

  // Fetch custom form structure with timeout and retry (only if not prefetched)
  useEffect(() => {
    // If we already have initialForm (not undefined), use it and skip the fetch
    if (initialForm !== undefined) {
      const timer = setTimeout(() => {
        if (initialForm) {
          // Custom form exists - use it
          console.log(" Using prefetched form - instant load!");
          setCustomForm(initialForm);

          // Initialize form data with empty values
          const initialData = {};
          initialForm.fields?.forEach((field) => {
            if (field.id) {
              initialData[field.id] = "";
            }
          });
          setFormData(initialData);
        } else {
          // initialForm is null - no custom form exists, use default
          console.log("No custom form found (prefetched), using default form");
          const defaultForm = {
            eventId: eventId,
            fields: [
              {
                id: "fullName",
                label: "Full Name",
                type: "text",
                required: true,
                placeholder: "Enter your full name",
              },
              {
                id: "email",
                label: "Email Address",
                type: "email",
                required: true,
                placeholder: "your.email@example.com",
              },
              {
                id: "phone",
                label: "Phone Number",
                type: "tel",
                required: true,
                placeholder: "+91 XXXXX XXXXX",
              },
            ],
            theme: {
              logo: null,
              color: "#10b981",
            },
            // INHERIT payment info from actual event
            isPaid: event?.isPaid || false,
            amount: event?.ticketPrice || 0,
            enableCoupons: true, // Always enable coupons for default forms
            status: "published",
            isDefault: true,
          };

          setCustomForm(defaultForm);
          setFormData({
            fullName: "",
            email: "",
            phone: "",
          });
        }
      }, 0);
      return () => clearTimeout(timer);
    }

    async function loadForm() {
      try {
        setFormLoadError(null);

        // Create abort controller for timeout
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

        if (data.success && data.form) {
          console.log("Custom form loaded successfully");
          setCustomForm(data.form);

          // Initialize form data with empty values
          const initialData = {};
          data.form.fields?.forEach((field) => {
            // Skip fields without proper structure
            if (!field.id) {
              console.warn("Skipping field without ID:", field);
              return;
            }
            initialData[field.id] = "";
          });
          setFormData(initialData);
          setRetryCount(0); // Reset retry count on success
        } else if (data.success && !data.form) {
          // No custom form exists - create a default one
          const defaultForm = {
            eventId: eventId,
            fields: [
              {
                id: "fullName",
                label: "Full Name",
                type: "text",
                required: true,
                placeholder: "Enter your full name",
              },
              {
                id: "email",
                label: "Email Address",
                type: "email",
                required: true,
                placeholder: "your.email@example.com",
              },
              {
                id: "phone",
                label: "Phone Number",
                type: "tel",
                required: true,
                placeholder: "+91 XXXXX XXXXX",
              },
            ],
            theme: {
              logo: null,
              color: "#10b981",
            },
            // INHERIT payment info from actual event
            isPaid: event?.isPaid || false,
            amount: event?.ticketPrice || 0,
            enableCoupons: true, // Always enable coupons for default forms
            status: "published",
            isDefault: true,
          };

          setCustomForm(defaultForm);
          setFormData({
            fullName: "",
            email: "",
            phone: "",
          });
          setRetryCount(0);


        } else {
          throw new Error(data.message || "Failed to load registration form");
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

    customForm.fields?.forEach((field) => {
      if (field.required && !formData[field.id]?.trim()) {
        newErrors[field.id] =
          `${field.label || field.name || "This field"} is required`;
      }

      // Email validation
      if (field.type === "email" && formData[field.id]) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData[field.id])) {
          newErrors[field.id] = "Invalid email address";
        }
      }

      // Phone validation - be more lenient
      if (field.type === "tel" && formData[field.id]) {
        // Remove all non-digit characters for validation
        const digitsOnly = formData[field.id].replace(/\D/g, "");
        // Must have at least 8 digits
        if (digitsOnly.length < 8) {
          newErrors[field.id] = "Phone number must have at least 8 digits";
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
  const registerExistingUser = async (user) => {
    try {
      const response = await fetch("/api/register-free", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, formData: tempFormData?.formData || {} }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Registration failed");
      const emailSent = await sendRegistrationConfirmation(user.email, tempFormData?.fullName || user.fullName || user.email, event?.name || "Event", result.ticketId);
      toast.success(result.alreadyRegistered ? "You are already registered for this event" : "Registration successful");
      if (!emailSent) toast.info("Sign in to your attendee dashboard to view your ticket");
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

    if (!validateForm()) {
      toast.error("Please fill all required fields correctly");
      return;
    }

    setIsLoading(true);

    try {
      // Find form field values - check both type and name for better matching
      const emailField = customForm.fields?.find(
        (f) => f.type === "email" || f.name?.toLowerCase().includes("email"),
      );
      const phoneField = customForm.fields?.find(
        (f) =>
          f.type === "tel" ||
          f.name?.toLowerCase().includes("phone") ||
          f.name?.toLowerCase().includes("mobile") ||
          f.name?.toLowerCase().includes("contact") ||
          f.name?.toLowerCase().includes("whatsapp") ||
          (f.name?.toLowerCase().includes("number") &&
            !f.name?.toLowerCase().includes("ticket")),
      );
      const nameField = customForm.fields?.find((f) =>
        f.name?.toLowerCase().includes("name"),
      );

      let email = emailField ? formData[emailField.id]?.trim() : "";
      const phone = phoneField ? formData[phoneField.id]?.trim() : "";
      const fullName = nameField ? formData[nameField.id]?.trim() : "";

      // Log extracted values for debugging
      console.log("=".repeat(50));
      console.log("FORM SUBMISSION - Extracted Data:");
      console.log("Email field found:", emailField?.name, emailField?.id);
      console.log("Email from form:", email);
      console.log(" Phone field found:", phoneField?.name, phoneField?.id);
      console.log(" Phone from form:", phone);
      console.log(" Name field found:", nameField?.name, nameField?.id);
      console.log(" Name from form:", fullName);
      console.log(" Full form data:", formData);
      console.log("=".repeat(50));

      // Email is required - don't proceed without it
      if (!email || email === "") {
        toast.error("Email is required. Please provide your email address.");
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

      console.log("Using user's email:", email);

      // Phone validation - only enforce if phone field exists in form
      if (phoneField && (!phone || phone === "")) {
        console.log("Phone field exists but no value provided");
        toast.error(
          "Phone number is required. Please provide your phone number.",
        );
        setIsLoading(false);
        return;
      }

      console.log(
        "Phone validation passed. Phone:",
        phone || "(not required)",
      );

      const signedInUser = auth.currentUser;
      if (signedInUser && signedInUser.email?.toLowerCase() !== email.toLowerCase()) {
        toast.error("Sign in with the email address entered on this form");
        setIsLoading(false);
        return;
      }
      const existingUser = signedInUser
        ? (await getCurrentUser(signedInUser.uid)) || { id: signedInUser.uid, email: signedInUser.email, fullName: signedInUser.displayName || fullName }
        : null;

      const isPaidEvent = customForm?.isPaid && customForm?.amount > 0;

      console.log("=".repeat(60));
      console.log(" PAYMENT CHECK:");
      console.log("   customForm.isPaid:", customForm?.isPaid);
      console.log("   customForm.amount:", customForm?.amount);
      console.log("   isPaidEvent (calculated):", isPaidEvent);
      console.log("   isDefault form:", customForm?.isDefault);
      if (customForm?.isDefault) {
        console.log("   Using DEFAULT FORM - inherited from event:");
        console.log("      event.isPaid:", event?.isPaid);
        console.log("      event.ticketPrice:", event?.ticketPrice);
      }
      console.log("=".repeat(60));

      // Store form data for processing
      setTempFormData({
        email,
        phone,
        fullName,
        eventId,
        event,
        customForm,
        formData,
        isPaid: isPaidEvent,
      });

      if (isPaidEvent) {
        let checkoutUser = existingUser;
        if (!checkoutUser) {
          const secretBytes = new Uint8Array(32);
          window.crypto.getRandomValues(secretBytes);
          const oneTimeSecret = Array.from(secretBytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
          try {
            checkoutUser = await signup(email, oneTimeSecret, fullName || email, phone || "");
            await sendPasswordResetEmail(auth, email);
          } catch (accountError) {
            if (accountError.code === "auth/email-already-in-use" || /already exists/i.test(accountError.message || "")) {
              setShowLoginModal(true);
              setIsLoading(false);
              return;
            }
            throw accountError;
          }
        }
        await handlePaymentFlow(email, phone, fullName, checkoutUser);
      } else if (existingUser) {
        await registerExistingUser(existingUser);
      } else {
        const secretBytes = new Uint8Array(32);
        window.crypto.getRandomValues(secretBytes);
        const oneTimeSecret = Array.from(secretBytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
        await createAccountAndRegister(email, phone, fullName, oneTimeSecret);
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
  ) => {
    try {
      setPaymentProcessing(true);

      const response = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          registrationData: { fullName, email, whatsappPhone: phone, formData: tempFormData?.formData || {} },
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
                ? await sendRegistrationConfirmation(email, fullName || email, event?.name || "Event", verifyData.ticketId)
                : false;
              toast.success(emailSent ? "Payment complete. Ticket sent to your email." : "Payment complete. Ticket is available in your dashboard.");

              // The trusted verification route owns paid ticket issuance. Do not
              // create a second client-side ticket/registration after payment.
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
            console.log("Payment cancelled");
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

  const createAccountAndRegister = async (email, phone, fullName, password) => {
    try {
      const user = await signup(email, password, fullName || email, phone || "");
      await sendPasswordResetEmail(auth, email);
      const response = await fetch("/api/register-free", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: tempFormData?.eventId || eventId, formData: tempFormData?.formData || {} }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Registration failed");
      const emailSent = await sendRegistrationConfirmation(email, user.fullName || fullName || email, tempFormData?.event?.name || "Event", result.ticketId);
      toast.success(emailSent ? "Registration complete and ticket sent" : "Registration complete. Sign in to view your ticket");
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
    const id = (field.id || "").toLowerCase();
    const type = (field.type || "").toLowerCase();
    const label = (field.label || field.name || "").toLowerCase();

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
    const value = formData[field.id] || "";
    const error = errors[field.id];

    const updateValue = (newValue) => {
      setFormData((prev) => ({ ...prev, [field.id]: newValue }));
      if (errors[field.id]) {
        setErrors((prev) => ({ ...prev, [field.id]: null }));
      }
    };

    switch (field.type) {
      case "text":
      case "email":
      case "tel":
        return (
          <div key={field.id} className="space-y-1.5">
            <label className="block text-sm font-medium text-[#061a3f] dark:text-slate-200">
              {field.label || field.name || "Field"}{" "}
              {field.required && <span className="text-red-500">*</span>}
            </label>
            <div className="relative">
              {getFieldIcon(field)}
              <input
                type={field.type}
                placeholder={
                  field.placeholder ||
                  `Enter ${(field.label || field.name)?.toLowerCase() || "value"}`
                }
                value={value}
                onChange={(e) => updateValue(e.target.value)}
                disabled={isLoading}
                className="w-full pl-11 pr-4 py-3 bg-[#eef2ff] dark:bg-slate-900 border border-[#c7d2fe] dark:border-slate-800 rounded-xl text-[#061a3f] dark:text-white placeholder:text-[rgba(6,26,63,0.42)] dark:placeholder:text-slate-500 focus:outline-none focus:border-[#3157ff] focus:ring-2 focus:ring-[#3157ff]/20 transition-all font-medium text-sm"
              />
            </div>
            {error && (
              <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
            )}
          </div>
        );

      case "textarea":
        return (
          <div key={field.id} className="space-y-1.5">
            <label className="block text-sm font-medium text-[#061a3f] dark:text-slate-200">
              {field.label || field.name || "Field"}{" "}
              {field.required && <span className="text-red-500">*</span>}
            </label>
            <textarea
              placeholder={
                field.placeholder ||
                `Enter ${(field.label || field.name)?.toLowerCase() || "text"}`
              }
              value={value}
              onChange={(e) => updateValue(e.target.value)}
              disabled={isLoading}
              rows={3}
              className="w-full p-3 bg-[#eef2ff] dark:bg-slate-900 border border-[#c7d2fe] dark:border-slate-800 rounded-xl text-[#061a3f] dark:text-white placeholder:text-[rgba(6,26,63,0.42)] dark:placeholder:text-slate-500 focus:outline-none focus:border-[#3157ff] focus:ring-2 focus:ring-[#3157ff]/20 transition-all font-medium text-sm resize-none"
            />
            {error && (
              <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
            )}
          </div>
        );

      case "radio":
        return (
          <div key={field.id} className="space-y-2">
            <label className="block text-sm font-medium text-[#061a3f] dark:text-slate-200">
              {field.label || field.name || "Field"}{" "}
              {field.required && <span className="text-red-500">*</span>}
            </label>
            <div className="space-y-2">
              {field.options?.map((option, idx) => (
                <label
                  key={idx}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
                    value === option
                      ? "bg-[#3157ff]/10 border-[#3157ff] text-[#3157ff] dark:bg-[#3157ff]/15"
                      : "bg-[#eef2ff]/70 dark:bg-slate-900/60 border-[#c7d2fe]/70 dark:border-slate-800 hover:border-[#3157ff]/60 text-[#061a3f] dark:text-slate-200"
                  }`}
                >
                  <input
                    type="radio"
                    name={field.id}
                    value={option}
                    checked={value === option}
                    onChange={(e) => updateValue(e.target.value)}
                    disabled={isLoading}
                    className="w-4 h-4 text-[#3157ff] border-[#c7d2fe] dark:border-slate-700 focus:ring-[#3157ff]"
                  />
                  <span className="text-sm font-medium">{option}</span>
                </label>
              ))}
            </div>
            {error && (
              <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
            )}
          </div>
        );

      case "dropdown":
        return (
          <div key={field.id} className="space-y-1.5">
            <label className="block text-sm font-medium text-[#061a3f] dark:text-slate-200">
              {field.label || field.name || "Field"}{" "}
              {field.required && <span className="text-red-500">*</span>}
            </label>
            <Select
              value={value}
              onValueChange={updateValue}
              disabled={isLoading}
            >
              <SelectTrigger className="w-full h-12 bg-[#eef2ff] dark:bg-slate-900 border border-[#c7d2fe] dark:border-slate-800 rounded-xl text-[#061a3f] dark:text-white focus:outline-none focus:border-[#3157ff] focus:ring-2 focus:ring-[#3157ff]/20 transition-all font-medium text-sm">
                <SelectValue
                  placeholder={`Select ${(field.label || field.name)?.toLowerCase() || "option"}`}
                />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-900 border border-[var(--tl-line)] dark:border-slate-800 text-[#061a3f] dark:text-white shadow-xl">
                {field.options?.map((option, idx) => (
                  <SelectItem
                    key={idx}
                    value={option}
                    className="text-[#061a3f] dark:text-slate-100 hover:bg-[#eef2ff] dark:hover:bg-slate-800"
                  >
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {error && (
              <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  if (formLoadError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 max-w-md text-center">
          <X className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-red-900 dark:text-red-400 mb-2">
            Failed to Load Form
          </h3>
          <p className="text-sm text-red-700 dark:text-red-300 mb-4">
            {formLoadError}
          </p>
          <Button
            onClick={() => setRetryCount((prev) => prev + 1)}
            className="bg-red-600 hover:bg-red-500 text-white rounded-xl"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!customForm) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF6A00] mb-4" />
        <p className="text-sm text-slate-400 animate-pulse">
          Loading registration form...
        </p>
        <p className="text-xs text-slate-500 mt-2">
          This usually takes just a few seconds
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="w-full">
        {/* Show amount if paid event */}
        {customForm.isPaid && customForm.amount > 0 && (
          <div className="mb-5 p-3.5 bg-[#eef2ff] dark:bg-slate-900 border border-[#c7d2fe] dark:border-slate-800 rounded-xl flex items-center justify-between">
            <span className="text-xs font-semibold text-[#061a3f] dark:text-slate-300">Registration Fee (18% GST Incl.)</span>
            <span className="text-base font-bold text-[#3157ff] dark:text-blue-400">₹{customForm.amount}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {customForm.fields
            ?.filter((field) => field.id && field.type)
            .map((field) => renderField(field))}

          {/* Coupon Code (only show for paid events) */}
          {customForm.isPaid &&
            customForm.amount > 0 &&
            customForm.enableCoupons && (
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-[#061a3f] dark:text-slate-200">
                  Coupon Code (Optional)
                </label>
                {!couponData ? (
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Tag className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[rgba(6,26,63,0.54)] dark:text-slate-400 pointer-events-none" />
                      <input
                        placeholder="ENTER COUPON CODE"
                        value={couponCode}
                        onChange={(e) =>
                          setCouponCode(e.target.value.toUpperCase())
                        }
                        disabled={isLoading || couponValidating}
                        className="w-full pl-10 pr-4 py-2.5 h-11 bg-[#eef2ff] dark:bg-slate-900 border border-[#c7d2fe] dark:border-slate-800 rounded-xl text-sm font-medium text-[#061a3f] dark:text-white placeholder:text-[rgba(6,26,63,0.42)] dark:placeholder:text-slate-500 focus:outline-none focus:border-[#3157ff] focus:ring-2 focus:ring-[#3157ff]/20 transition-all uppercase"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleApplyCoupon}
                      disabled={
                        isLoading || couponValidating || !couponCode.trim()
                      }
                      className="h-11 px-5 bg-[#3157ff] hover:bg-[#173cf4] text-white font-semibold text-sm rounded-xl shadow-md transition-all flex items-center justify-center"
                    >
                      {couponValidating ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Apply"
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="bg-[#3157ff]/10 border border-[#3157ff]/30 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <CheckCircle className="w-4 h-4 text-[#3157ff]" />
                          <span className="text-sm font-semibold text-[#3157ff]">
                            Coupon Applied: {couponCode}
                          </span>
                        </div>
                        <div className="text-xs text-[rgba(6,26,63,0.7)] dark:text-slate-400">
                          <div>Original: ₹{couponData.originalAmount}</div>
                          <div className="text-[#3157ff] font-semibold">
                            {couponData.discountPercent}% OFF - You save ₹{couponData.discountAmount}
                          </div>
                          <div className="text-base font-bold text-[#061a3f] dark:text-white mt-1">
                            Final Price: ₹{couponData.finalAmount}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={removeCoupon}
                        className="text-red-500 hover:text-red-600 p-1 rounded-lg hover:bg-red-500/10 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
                {couponError && (
                  <p className="text-sm text-red-500 dark:text-red-400">
                    {couponError}
                  </p>
                )}
              </div>
            )}

          <button
            type="submit"
            disabled={isLoading || paymentProcessing}
            className="w-full bg-[#3157ff] hover:bg-[#173cf4] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 h-12 rounded-xl transition-all shadow-lg shadow-[rgba(49,87,255,0.3)] hover:shadow-[rgba(49,87,255,0.4)] flex items-center justify-center gap-2 active:scale-[0.99] text-base"
          >
            {isLoading || paymentProcessing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>{paymentProcessing ? "Processing Payment..." : "Registering..."}</span>
              </>
            ) : customForm?.isPaid && customForm?.amount > 0 ? (
              <>
                <Ticket className="w-5 h-5" />
                <span>
                  {couponData ? (
                    `Pay ₹${couponData.finalAmount} & Register`
                  ) : (
                    `Pay ₹${customForm.amount} & Register`
                  )}
                </span>
              </>
            ) : (
              <>
                <Ticket className="w-5 h-5" />
                <span>Register Now</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Login Modal for Existing Users */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 border-2 border-blue-500/40 rounded-2xl p-6 shadow-2xl max-w-md w-full animate-scale-in">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Key className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">
                  Welcome Back!
                </h3>
                <p className="text-xs text-blue-400">Login to continue</p>
              </div>
            </div>

            <div className="space-y-5 mb-6">
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <p className="text-sm text-blue-400 mb-2 flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  <strong>Your Email:</strong>
                </p>
                <p className="font-mono text-lg text-white break-all">
                  {tempFormData?.email || "Email not found"}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-blue-400 font-semibold">
                  Enter Your Password
                </label>
                <Input
                  type="password"
                  placeholder="Enter your password..."
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  onKeyPress={(e) =>
                    e.key === "Enter" && handleExistingUserLogin()
                  }
                  className="h-12 bg-slate-900 border-blue-500/30 text-white font-mono"
                  autoFocus
                />
                {loginPassword && loginPassword.length < 6 && (
                  <p className="text-xs text-red-400">
                    Password must be at least 6 characters
                  </p>
                )}
              </div>

              {/* Forgot Password Link */}
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setShowLoginModal(false);
                    router.push("/");
                  }}
                  className="text-sm text-blue-400 hover:text-blue-300 hover:underline transition-colors flex items-center justify-center gap-2 mx-auto"
                >
                  <Key className="w-4 h-4" />
                  Forgot password? Reset it here
                </button>
              </div>

              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex gap-3">
                <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-400">
                  <strong>Note:</strong> Use the password you set when you
                  first registered.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleExistingUserLogin}
                disabled={
                  isLoggingIn || !loginPassword || loginPassword.length < 6
                }
                className="flex-1 h-12 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold"
              >
                {isLoggingIn ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Logging in...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Login & Continue
                  </>
                )}
              </Button>
              <Button
                onClick={() => {
                  setShowLoginModal(false);
                  setLoginPassword("");
                  setIsLoading(false);
                }}
                variant="outline"
                disabled={isLoggingIn}
                className="border-blue-500/30 hover:bg-blue-500/10 text-blue-400"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-xl p-8 shadow-2xl max-w-lg w-full border border-[#FF6A00]/30">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#FF6A00] flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">
                    Registration Complete
                  </h3>
                  <p className="text-sm text-slate-400">Your ticket is ready</p>
                </div>
              </div>
              <button
                onClick={() => setShowSuccessModal(false)}
                className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* Content */}
            <div className="space-y-5">
              {/* Ticket Info */}
              <div className="bg-[#FF6A00]/10 border border-[#FF6A00]/30 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    <svg
                      className="w-5 h-5 text-[#FF6A00]"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-[#FF6A00] mb-1">
                      Registration status
                    </p>
                    <p className="text-sm text-[#FF6A00]/70">
                      Sign in to your attendee dashboard to view available tickets.
                    </p>
                  </div>
                </div>
              </div>

              {/* Info Message */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm text-blue-900 dark:text-blue-300">
                  <strong>What&apos;s next?</strong> Sign in to the attendee dashboard
                  with your account. Use password recovery if you need to set or
                  reset your password.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-slate-700">
              <Button
                onClick={() => {
                  setShowSuccessModal(false);
                  toast.info(
                    "Please sign in with your credentials to access your dashboard",
                    {
                      duration: 4000,
                    },
                  );
                  router.push("/user-login");
                }}
                className="flex-1 bg-[#FF6A00] hover:bg-[#FFD60A] text-black font-medium"
              >
                Sign In to Dashboard
              </Button>
              <Button
                onClick={() => setShowSuccessModal(false)}
                variant="outline"
                className="border-gray-300 dark:border-slate-600 hover:bg-gray-100 dark:hover:bg-slate-800"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
