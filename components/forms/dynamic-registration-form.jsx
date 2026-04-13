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
import { signup, getUserByEmail, login } from "@/lib/auth";
import {
  createRegistration,
  checkDuplicateRegistration,
  checkDuplicatePhoneForEvent,
  getEvent,
} from "@/lib/firestore";
import { sendRegistrationConfirmation } from "@/lib/email";
import { generateQRCode } from "@/lib/qr";
import { generateRandomPassword } from "@/lib/password-utils";
import { useCoupon } from "@/lib/coupons";
import { doc, setDoc, updateDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { updatePassword as firebaseUpdatePassword } from "firebase/auth";
import {
  Loader2,
  Sparkles,
  CheckCircle,
  X,
  LogIn,
  Key,
  RefreshCw,
} from "lucide-react";

export function DynamicRegistrationForm({ eventId, event, initialForm }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [customForm, setCustomForm] = useState(null);
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [userCredentials, setUserCredentials] = useState({
    email: "",
    password: "",
  });
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
      if (initialForm) {
        // Custom form exists - use it
        console.log("⚡ Using prefetched form - instant load!");
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
        console.log("ℹ️ No custom form found (prefetched), using default form");
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
        
        toast.info("Using default registration form. Contact event organizer for custom forms.", {
          duration: 4000,
        });
      }
      return;
    }

    async function loadForm() {
      try {
        console.log("📋 Loading custom form for event:", eventId);
        setFormLoadError(null);
        
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        const response = await fetch(`/api/get-custom-form?eventId=${eventId}`, {
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to load form");
        }

        if (data.success && data.form) {
          console.log("✅ Custom form loaded successfully");
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
          console.log("ℹ️ No custom form found, using default form");
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
          
          toast.info("Using default registration form. Contact event organizer for custom forms.", {
            duration: 4000,
          });
        } else {
          throw new Error(data.message || "Failed to load registration form");
        }
      } catch (error) {
        console.error("❌ Error loading custom form:", error);
        
        if (error.name === 'AbortError') {
          setFormLoadError("Form loading timed out. Click retry to try again.");
          toast.error("Loading timed out. Please retry.");
        } else {
          setFormLoadError(error.message || "Failed to load registration form");
          toast.error("Failed to load form: " + (error.message || "Unknown error"));
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
        newErrors[field.id] = `${field.label || field.name || "This field"} is required`;
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
      console.log("🔐 LOGGING IN EXISTING USER");

      // Login with email and password
      const user = await login(tempFormData.email, loginPassword);
      console.log("✅ LOGIN SUCCESSFUL:", user.id);

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
      console.error("❌ Login error:", error);
      if (
        error.message?.includes("wrong-password") ||
        error.message?.includes("invalid-credential")
      ) {
        toast.error("🔒 Incorrect password. Please try again.");
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
          registrationData: { fullName: user.fullName, email: user.email },
          finalAmount: couponData?.finalAmount,
          couponId: couponData?.couponId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create payment order");
      }

      const orderData = await response.json();

      if (!orderData.success) {
        throw new Error(orderData.error || "Failed to create order");
      }

      const options = {
        key: orderData.order.razorpayKeyId,
        amount: orderData.order.amount,
        currency: orderData.order.currency,
        name: "Ticketलेलो",
        description: `Ticket for ${event?.name || "Event"}`,
        order_id: orderData.order.id,
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
              toast.success("Payment successful! ✅");

              if (couponData && couponData.couponId) {
                try {
                  await useCoupon(couponData.couponId, user.id);
                } catch (error) {
                  console.error("Failed to mark coupon as used:", error);
                }
              }

              await registerExistingUser(user, response.razorpay_payment_id);
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

  // Register existing user for event (after login and optional payment)
  const registerExistingUser = async (user, paymentId = null) => {
    try {
      const ticketId = `TKT-${Date.now()}-${Math.random().toString(36).slice(2, 11).toUpperCase()}`;
      const qrCode = await generateQRCode(ticketId);

      const registrationData = {
        userId: user.id,
        eventId,
        ticketId,
        fullName: tempFormData.fullName || user.fullName || user.email,
        email: user.email,
        whatsappPhone: tempFormData.phone || user.whatsappPhone || "",
        customFieldResponses: formData,
        status: "Unused",
        qrCode,
        paymentStatus: tempFormData.isPaid ? "paid" : "free",
        paymentId: paymentId || null,
        createdAt: new Date().toISOString(),
      };

      await createRegistration(registrationData);
      console.log("✅ Registration created for existing user");

      // Send ticket email
      try {
        console.log("📧 [registerExistingUser] Sending ticket email WITHOUT password");
        await sendRegistrationConfirmation(
          user.email,
          tempFormData.fullName || user.fullName || user.email,
          event?.name || "Event",
          ticketId,
        );
        toast.success(`✅ Ticket sent to ${user.email}!`);
      } catch (error) {
        console.error("Failed to send ticket email:", error);
        toast.error("Registration successful but failed to send email");
      }

      // Redirect to dashboard
      toast.success("🎉 Registration successful!");
      setTimeout(() => router.push("/dashboard"), 2000);

      setIsLoading(false);
      setPaymentProcessing(false);
    } catch (error) {
      console.error("❌ Registration error:", error);
      toast.error("Failed to complete registration: " + error.message);
      setIsLoading(false);
      setPaymentProcessing(false);
      setTimeout(() => router.push("/"), 2000);
    }
  };

  // Proceed with event registration after authentication
  const proceedWithRegistration = async (user, password) => {
    try {
      console.log("📝 PROCEEDING WITH REGISTRATION:");
      console.log("   User:", user?.email);
      console.log("   Event:", tempEventData?.name);

      const { email, phone, fullName, eventId, event, customForm, formData } =
        tempFormData;

      // Generate ticket
      const ticketId = `TKT-${Date.now()}-${Math.random().toString(36).slice(2, 11).toUpperCase()}`;
      const qrCode = await generateQRCode(ticketId);

      // Create registration
      const registrationData = {
        userId: user.id,
        eventId: eventId,
        ticketId,
        fullName: fullName || email,
        email: email,
        whatsappPhone: phone || "",
        customFieldResponses: formData,
        status: "Unused",
        qrCode,
        paymentStatus: tempFormData.isPaid ? "paid" : "free",
        createdAt: new Date().toISOString(),
      };

      await createRegistration(registrationData);
      console.log("✅ Registration created");

      // Send confirmation email with PDF ticket AND CREDENTIALS
      try {
        console.log("📧 [proceedWithRegistration - NEW USER] Sending ticket WITH password");
        console.log("📧 Sending ticket with credentials to email:", email);
        console.log(
          "   Password being sent:",
          password ? "✅ Available" : "❌ Missing",
        );
        await sendRegistrationConfirmation(
          email,
          fullName || email,
          event?.name || "Event",
          ticketId,
          password, // Pass password for new users
        );
        toast.success(`✅ Your ticket and login credentials sent to ${email}!`);
      } catch (error) {
        console.error("Email error:", error);
        toast.error(
          "Registration successful but failed to send email. Check your dashboard for ticket.",
        );
      }

      // Show success modal with credentials
      setUserCredentials({
        email: user?.email || "",
        phone: user?.whatsappPhone || "",
        password: password,
      });

      setShowSuccessModal(true);
      setIsLoading(false);
    } catch (error) {
      console.error("❌ Registration error:", error);
      toast.error("Registration failed: " + error.message);
      setIsLoading(false);
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
      console.log("📧 FORM SUBMISSION - Extracted Data:");
      console.log("📧 Email field found:", emailField?.name, emailField?.id);
      console.log("📧 Email from form:", email);
      console.log("📞 Phone field found:", phoneField?.name, phoneField?.id);
      console.log("📞 Phone from form:", phone);
      console.log("👤 Name field found:", nameField?.name, nameField?.id);
      console.log("👤 Name from form:", fullName);
      console.log("📝 Full form data:", formData);
      console.log("=".repeat(50));

      // Email is required - don't proceed without it
      if (!email || email === "") {
        toast.error("❌ Email is required. Please provide your email address.");
        setIsLoading(false);
        return;
      }

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        toast.error("❌ Please provide a valid email address.");
        setIsLoading(false);
        return;
      }

      console.log("✅ Using user's email:", email);

      // Phone validation - only enforce if phone field exists in form
      if (phoneField && (!phone || phone === "")) {
        console.log("❌ Phone field exists but no value provided");
        toast.error(
          "❌ Phone number is required. Please provide your phone number.",
        );
        setIsLoading(false);
        return;
      }

      console.log(
        "✅ Phone validation passed. Phone:",
        phone || "(not required)",
      );

      // Check for duplicate EMAIL BEFORE anything else
      const isDuplicateEmail = await checkDuplicateRegistration(email, eventId);
      if (isDuplicateEmail) {
        toast.error("⚠️ This email is already registered for this event!");
        setIsLoading(false);
        return;
      }

      // Check for duplicate PHONE BEFORE anything else (only if phone is provided)
      if (phone && phone !== "") {
        const isDuplicatePhone = await checkDuplicatePhoneForEvent(
          phone,
          eventId,
        );
        if (isDuplicatePhone) {
          toast.error(
            "⚠️ This phone number is already registered for this event!",
          );
          setIsLoading(false);
          return;
        }
      }

      // Check if user already exists
      console.log("🔍 Checking if user exists...");
      let existingUser = null;
      try {
        existingUser = await getUserByEmail(email);
        if (existingUser) {
          console.log("⚠️ EXISTING USER FOUND:");
          console.log("   User ID:", existingUser.id);
          console.log("   Email:", existingUser.email);
          console.log("   Name:", existingUser.fullName);
          console.log("   → Will NOT send password (user already has credentials)");
          toast.info(`Welcome back! We found your account for ${email}`, {
            duration: 4000,
          });
        } else {
          console.log("✅ NEW USER - No existing account found");
          console.log("   → Will generate password and send credentials");
          toast.info(`Creating new account for ${email}`, {
            duration: 3000,
          });
        }
      } catch (err) {
        console.log("ℹ️ No existing user found (error caught):", err.message);
        toast.info(`Creating new account for ${email}`, {
          duration: 3000,
        });
      }

      const isPaidEvent = customForm?.isPaid &&customForm?.amount > 0;

      console.log("=".repeat(60));
      console.log("💰 PAYMENT CHECK:");
      console.log("   customForm.isPaid:", customForm?.isPaid);
      console.log("   customForm.amount:", customForm?.amount);
      console.log("   isPaidEvent (calculated):", isPaidEvent);
      console.log("   isDefault form:", customForm?.isDefault);
      if (customForm?.isDefault) {
        console.log("   ⚠️ Using DEFAULT FORM - inherited from event:");
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

      // NO LOGIN MODAL - Payment/Registration happens immediately
      if (isPaidEvent) {
        // PAID EVENT - Initiate payment first (for both new and existing users)
        console.log("💳 PAID EVENT DETECTED - Initiating payment flow");
        console.log("   Amount to charge: ₹", customForm?.amount);
        await handlePaymentFlow(email, phone, fullName, existingUser);
      } else {
        console.log("🆓 FREE EVENT - Registering without payment");
        // FREE EVENT - Register immediately
        if (existingUser) {
          console.log("=".repeat(50));
          console.log("🔄 EXISTING USER - FREE EVENT");
          console.log("   No password will be sent (user already has credentials)");
          console.log("=".repeat(50));
          await registerExistingUserDirectly(
            existingUser,
            email,
            phone,
            fullName,
            null,
            false,
          );
        } else {
          console.log("=".repeat(50));
          console.log("🆕 NEW USER - FREE EVENT");
          const autoPassword = generateRandomPassword();
          console.log("🔑 Generated password:", autoPassword);
          console.log("📧 Password WILL be sent in email");
          console.log("=".repeat(50));
          await createAccountAndRegister(
            email,
            phone,
            fullName,
            autoPassword,
            null,
          );
        }
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
          registrationData: { fullName, email },
          finalAmount: couponData?.finalAmount,
          couponId: couponData?.couponId,
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
      const options = {
        key: orderData.order.razorpayKeyId,
        amount: orderData.order.amount,
        currency: orderData.order.currency,
        name: "Ticketलेलो",
        description: `Ticket for ${event?.name || "Event"}`,
        order_id: orderData.order.id,
        handler: async function (response) {
          try {
            console.log("💳 Payment successful");

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
              toast.success("Payment successful! ✅");

              // Mark coupon as used
              if (couponData && couponData.couponId) {
                try {
                  const userId = existingUser?.id || "temp";
                  await useCoupon(couponData.couponId, userId);
                } catch (error) {
                  console.error("Failed to mark coupon as used:", error);
                }
              }

              // ALWAYS CREATE NEW CREDENTIALS FOR PAID EVENTS
              console.log("=".repeat(50));
              console.log("💳 PAID EVENT - GENERATING NEW CREDENTIALS");
              const autoPassword = generateRandomPassword();
              console.log("🔑 Generated 6-char password:", autoPassword);
              console.log("📧 Password WILL be sent in email");
              console.log("=".repeat(50));

              if (existingUser) {
                // EXISTING USER - Update their password and send new credentials
                console.log("🔄 EXISTING USER - Updating with NEW password");
                await createAccountAndRegister(
                  email,
                  phone,
                  fullName,
                  autoPassword,
                  response.razorpay_payment_id,
                );
              } else {
                // NEW USER - Create account with password
                console.log("🆕 NEW USER - Creating account with password");
                await createAccountAndRegister(
                  email,
                  phone,
                  fullName,
                  autoPassword,
                  response.razorpay_payment_id,
                );
              }
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

  // Create account and register for event
  const createAccountAndRegister = async (
    email,
    phone,
    fullName,
    password,
    paymentId,
  ) => {
    try {
      console.log("🔐 Creating/Updating user account with new credentials...");
      console.log("   Email:", email);
      console.log("   Password:", password);
      console.log("   Using tempFormData:", tempFormData ? "Available" : "Missing");

      let user = null;
      let isNewUser = false;

      // Check if user already exists
      const existingUserCheck = await getUserByEmail(email);

      if (existingUserCheck) {
        // EXISTING USER - Update their password in both Firebase Auth AND Firestore
        console.log("🔄 User exists - Updating password in Firebase Auth and Firestore");
        
        try {
          // Update Firebase Auth password via Admin SDK
          const updatePasswordResponse = await fetch("/api/update-user-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              uid: existingUserCheck.id,
              newPassword: password,
            }),
          });

          const updatePasswordResult = await updatePasswordResponse.json();
          
          if (!updatePasswordResult.success) {
            throw new Error("Failed to update Firebase Auth password");
          }
          
          console.log("✅ Firebase Auth password updated");

          // Update Firestore password and name
          const userRef = doc(db, "users", existingUserCheck.id);
          
          const updateData = {
            password: password,
          };
          
          // Update fullName if provided
          if (fullName && fullName.trim()) {
            updateData.fullName = fullName.trim();
          }
          
          // Only update phone if it's different and provided
          if (phone && phone !== existingUserCheck.whatsappPhone) {
            updateData.whatsappPhone = phone;
          }
          
          await updateDoc(userRef, updateData);
          
          user = {
            ...existingUserCheck,
            password: password,
            fullName: fullName?.trim() || existingUserCheck.fullName,
            whatsappPhone: phone || existingUserCheck.whatsappPhone,
          };
          
          console.log("✅ Existing user updated with new password in both Auth and Firestore");
          isNewUser = false;
        } catch (updateError) {
          console.error("❌ Failed to update existing user password:", updateError);
          throw new Error("Failed to update password. Please try again.");
        }
      } else {
        // NEW USER - Create Firebase Auth account and Firestore document
        console.log("🆕 Creating new user account");
        
        user = await signup(
          email,
          password,
          fullName || email,
          phone || "",
        );
        
        console.log("✅ New user account created:", user.id);
        isNewUser = true;
      }

      // Generate ticket
      const ticketId = `TKT-${Date.now()}-${Math.random().toString(36).slice(2, 11).toUpperCase()}`;
      const qrCode = await generateQRCode(ticketId);

      // Create registration
      const registrationData = {
        userId: user.id,
        eventId: tempFormData?.eventId || eventId,
        ticketId,
        fullName: user.fullName || fullName || email,
        email,
        whatsappPhone: phone || user.whatsappPhone || "",
        customFieldResponses: tempFormData?.formData || {},
        status: "Unused",
        qrCode,
        paymentStatus: tempFormData?.isPaid ? "paid" : "free",
        paymentId: paymentId || null,
        createdAt: new Date().toISOString(),
      };

      await createRegistration(registrationData);
      console.log("✅ Registration created");

      // Send ticket email WITH CREDENTIALS (for both new and existing users)
      try {
        console.log("=".repeat(60));
        console.log(`📧 [${isNewUser ? 'NEW' : 'EXISTING'} USER] Sending ticket WITH password`);
        console.log("=== 📧 CALLING sendRegistrationConfirmation ===");
        console.log("   Email:", email);
        console.log("   FullName:", user.fullName || fullName || email);
        console.log("   EventName:", tempFormData?.event?.name || "Event");
        console.log("   TicketId:", ticketId);
        console.log("   Password:", password);
        console.log("   Password type:", typeof password);
        console.log("   Password length:", password?.length);
        console.log("=".repeat(60));

        await sendRegistrationConfirmation(
          email,
          user.fullName || fullName || email,
          tempFormData?.event?.name || "Event",
          ticketId,
          password,
        );
        console.log("✅ Ticket email with credentials sent successfully!");
        toast.success("📧 Ticket and login credentials sent to your email!");
      } catch (error) {
        console.error("Failed to send ticket email:", error);
        toast.error("Failed to send ticket email");
      }

      // Show success modal with credentials
      console.log("✅ Setting credentials for success modal:");
      console.log("   Email:", email);
      console.log("   Password:", password);
      setUserCredentials({ email, password });
      setShowSuccessModal(true);
      setIsLoading(false);
      setPaymentProcessing(false);
    } catch (error) {
      console.error("❌ Account creation/update error:", error);
      toast.error("Failed to process account: " + error.message);
      setIsLoading(false);
      setPaymentProcessing(false);
      setTimeout(() => router.push("/"), 2000);
    }
  };

  // Register existing user for event (NO login required, NO credentials sent)
  const registerExistingUserDirectly = async (
    user,
    email,
    phone,
    fullName,
    paymentId = null,
    isPaid = false,
  ) => {
    try {
      console.log("🔄 Registering existing user...");

      // Generate ticket
      const ticketId = `TKT-${Date.now()}-${Math.random().toString(36).slice(2, 11).toUpperCase()}`;
      const qrCode = await generateQRCode(ticketId);

      // Create registration
      const registrationData = {
        userId: user.id,
        eventId,
        ticketId,
        fullName: fullName || user.fullName || email,
        email: email,
        whatsappPhone: phone || user.whatsappPhone || "",
        customFieldResponses: formData,
        status: "Unused",
        qrCode,
        paymentStatus: isPaid ? "paid" : "free",
        paymentId: paymentId || null,
        createdAt: new Date().toISOString(),
      };

      await createRegistration(registrationData);
      console.log("✅ Registration created for existing user");

      // Send ticket email (NOT credentials - they already have them)
      try {
        console.log("📧 [registerExistingUserDirectly] Sending ticket email WITHOUT password");
        await sendRegistrationConfirmation(
          email,
          fullName || user.fullName || email,
          event?.name || "Event",
          ticketId,
        );
        console.log("✅ Ticket email sent");
        toast.success(`✅ Ticket sent to ${email}!`);
      } catch (error) {
        console.error("Failed to send ticket email:", error);
        toast.error("Registration successful but failed to send ticket email.");
      }

      // Show success modal WITHOUT credentials (they already have them)
      setUserCredentials({
        email: email,
        password: "", // Empty - they already have credentials
        isExistingUser: true, // Flag to indicate existing user
      });
      setShowSuccessModal(true);
      setIsLoading(false);
      setPaymentProcessing(false);
    } catch (error) {
      console.error("❌ Registration error:", error);
      toast.error("Registration failed: " + error.message);
      setIsLoading(false);
      setPaymentProcessing(false);
      setTimeout(() => router.push("/"), 2000);
    }
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
          <div key={field.id} className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-slate-300">
              {field.label || field.name || "Field"}{" "}
              {field.required && <span className="text-red-500">*</span>}
            </label>
            <Input
              type={field.type}
              placeholder={
                field.placeholder ||
                `Enter ${(field.label || field.name)?.toLowerCase() || "value"}`
              }
              value={value}
              onChange={(e) => updateValue(e.target.value)}
              disabled={isLoading}
              className="h-12 bg-white dark:bg-slate-900 border-emerald-200 dark:border-slate-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-600 focus:border-emerald-500 rounded-xl"
            />
            {error && (
              <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
            )}
          </div>
        );

      case "textarea":
        return (
          <div key={field.id} className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-slate-300">
              {field.label || field.name || "Field"}{" "}
              {field.required && <span className="text-red-500">*</span>}
            </label>
            <Textarea
              placeholder={
                field.placeholder ||
                `Enter ${(field.label || field.name)?.toLowerCase() || "text"}`
              }
              value={value}
              onChange={(e) => updateValue(e.target.value)}
              disabled={isLoading}
              className="min-h-[80px] bg-white dark:bg-slate-900 border-emerald-200 dark:border-slate-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-600 focus:border-emerald-500 rounded-xl resize-none"
            />
            {error && (
              <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
            )}
          </div>
        );

      case "radio":
        return (
          <div key={field.id} className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-slate-300">
              {field.label || field.name || "Field"}{" "}
              {field.required && <span className="text-red-500">*</span>}
            </label>
            <div className="space-y-2">
              {field.options?.map((option, idx) => (
                <label
                  key={idx}
                  className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-slate-800 rounded-xl hover:border-emerald-400 dark:hover:border-emerald-500/50 cursor-pointer transition-colors"
                >
                  <input
                    type="radio"
                    name={field.id}
                    value={option}
                    checked={value === option}
                    onChange={(e) => updateValue(e.target.value)}
                    disabled={isLoading}
                    className="w-4 h-4 text-emerald-500 border-emerald-300 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-gray-900 dark:text-white">
                    {option}
                  </span>
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
          <div key={field.id} className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-slate-300">
              {field.label || field.name || "Field"}{" "}
              {field.required && <span className="text-red-500">*</span>}
            </label>
            <Select
              value={value}
              onValueChange={updateValue}
              disabled={isLoading}
            >
              <SelectTrigger className="h-12 bg-white dark:bg-slate-900 border-emerald-200 dark:border-slate-800 text-gray-900 dark:text-white focus:border-emerald-500 rounded-xl">
                <SelectValue
                  placeholder={`Select ${(field.label || field.name)?.toLowerCase() || "option"}`}
                />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-900 border-emerald-200 dark:border-slate-800">
                {field.options?.map((option, idx) => (
                  <SelectItem
                    key={idx}
                    value={option}
                    className="text-gray-900 dark:text-white"
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
            onClick={() => setRetryCount(prev => prev + 1)}
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
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mb-4" />
        <p className="text-sm text-gray-600 dark:text-slate-400 animate-pulse">
          Loading registration form...
        </p>
        <p className="text-xs text-gray-500 dark:text-slate-500 mt-2">
          This usually takes just a few seconds
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="w-full">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Register for {event?.name || "Event"}
          </h2>
          <p className="text-sm text-gray-600 dark:text-slate-400">
            Fill in your details below to secure your spot.
          </p>
        </div>

        {/* Show amount if paid event */}
        {customForm.isPaid && customForm.amount > 0 && (
          <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-xl">
            <p className="text-sm font-medium text-emerald-900 dark:text-emerald-400">
              Amount: ₹{customForm.amount}
            </p>
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
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-slate-300">
                  Coupon Code (Optional)
                </label>
                {!couponData ? (
                  <div className="flex gap-2">
                    <div className="relative flex-1 input-glow rounded-xl">
                      <Input
                        placeholder="Enter coupon code"
                        value={couponCode}
                        onChange={(e) =>
                          setCouponCode(e.target.value.toUpperCase())
                        }
                        disabled={isLoading || couponValidating}
                        className="h-12 bg-white dark:bg-slate-900 border-emerald-200 dark:border-slate-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-600 focus:border-emerald-500 rounded-xl uppercase"
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={handleApplyCoupon}
                      disabled={
                        isLoading || couponValidating || !couponCode.trim()
                      }
                      className="h-12 px-6 bg-purple-600 hover:bg-purple-500 text-white rounded-xl"
                    >
                      {couponValidating ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Apply"
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <CheckCircle className="w-4 h-4 text-emerald-400" />
                          <span className="text-sm font-semibold text-emerald-400">
                            Coupon Applied: {couponCode}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400">
                          <div>Original: ₹{couponData.originalAmount}</div>
                          <div className="text-emerald-400  font-semibold">
                            {couponData.discountPercent}% OFF - You save ₹
                            {couponData.discountAmount}
                          </div>
                          <div className="text-lg font-bold text-white mt-1">
                            Final Price: ₹{couponData.finalAmount}
                          </div>
                        </div>
                      </div>
                      <Button
                        type="button"
                        onClick={removeCoupon}
                        variant="ghost"
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        <X className="w-4 h-4" />
                      </Button>
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

          <Button
            type="submit"
            disabled={isLoading || paymentProcessing}
            className="w-full h-12 text-base font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all rounded-xl gap-2"
          >
            {isLoading || paymentProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {paymentProcessing ? "Processing Payment..." : "Registering..."}
              </>
            ) : customForm?.isPaid && customForm?.amount > 0 ? (
              <>
                <Sparkles className="w-4 h-4" />
                {couponData ? (
                  <>
                    Pay ₹{couponData.finalAmount} & Register
                    <span className="text-xs opacity-75">
                      (₹{couponData.discountAmount} saved)
                    </span>
                  </>
                ) : (
                  `Pay ₹${customForm.amount} & Register`
                )}
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Register Now
              </>
            )}
          </Button>
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
                  🔐 Welcome Back!
                </h3>
                <p className="text-xs text-blue-400">Login to continue</p>
              </div>
            </div>

            <div className="space-y-5 mb-6">
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <p className="text-sm text-blue-400 mb-2">
                  ✨ <strong>Your Email:</strong>
                </p>
                <p className="font-mono text-lg text-white break-all">
                  {tempFormData?.email || "Email not found"}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-blue-400 font-semibold">
                  🔒 Enter Your Password
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
                    ⚠️ Password must be at least 6 characters
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
                  className="text-sm text-blue-400 hover:text-blue-300 hover:underline transition-colors"
                >
                  🔑 Forgot password? Reset it here
                </button>
              </div>

              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                <p className="text-xs text-amber-400">
                  💡 <strong>Note:</strong> Use the password you set when you
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
          <div className="bg-white dark:bg-slate-900 rounded-xl p-8 shadow-2xl max-w-lg w-full border border-emerald-500/20">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Registration Complete
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-slate-400">
                    Your ticket is ready
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSuccessModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="space-y-5">
              {/* Ticket Info */}
              <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-emerald-900 dark:text-emerald-300 mb-1">
                      Ticket Sent to Email
                    </p>
                    <p className="text-sm text-emerald-700 dark:text-emerald-400">
                      Check your inbox for the PDF ticket with QR code
                    </p>
                  </div>
                </div>
              </div>

              {/* LOGIN CREDENTIALS - Show if password exists */}
              {userCredentials.password && (
                <div className="bg-slate-50 dark:bg-slate-800 border-2 border-emerald-500 rounded-lg p-5">
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-200 dark:border-slate-700">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                    </div>
                    <h4 className="text-slate-900 dark:text-white font-semibold text-base">Your Login Credentials</h4>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-slate-600 dark:text-slate-400 text-xs font-medium mb-1.5">Email Address</label>
                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5">
                        <p className="font-mono text-slate-900 dark:text-white text-sm break-all">
                          {userCredentials.email}
                        </p>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-slate-600 dark:text-slate-400 text-xs font-medium mb-1.5">Password</label>
                      <div className="bg-white dark:bg-slate-900 border-2 border-emerald-500 rounded-lg px-4 py-3">
                        <p className="font-mono text-slate-900 dark:text-white text-xl font-bold tracking-wider text-center">
                          {userCredentials.password}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2.5">
                    <p className="text-amber-800 dark:text-amber-300 text-xs text-center font-medium">
                      💾 Save these credentials - you'll need them to sign in and access your dashboard
                    </p>
                  </div>
                </div>
              )}

              {/* Info Message */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm text-blue-900 dark:text-blue-300">
                  <strong>What's next?</strong> Use the credentials above to login and view your tickets, or change your password anytime from your dashboard.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-slate-700">
              <Button
                onClick={() => {
                  setShowSuccessModal(false);
                  toast.info("Please sign in with your credentials to access your dashboard", {
                    duration: 4000,
                  });
                  router.push("/");
                }}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-medium"
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
