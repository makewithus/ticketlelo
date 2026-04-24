"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { signup, getUserByEmail } from "@/lib/auth";
import {
  createRegistration,
  checkDuplicateRegistration,
  getEvent,
} from "@/lib/firestore";
import { sendRegistrationConfirmation } from "@/lib/email";
import { generateQRCode } from "@/lib/qr";
import { useCoupon } from "@/lib/coupons";
import {
  User,
  Mail,
  Phone,
  MessageSquare,
  ChevronDown,
  Loader2,
  Sparkles,
  CheckCircle,
  X,
} from "lucide-react";

/* ─── Country codes ─── */
const COUNTRY_CODES = [
  { code: "+91", country: "India", flag: "🇮🇳", len: 10 },
  { code: "+1", country: "United States", flag: "🇺🇸", len: 10 },
  { code: "+44", country: "United Kingdom", flag: "🇬🇧", len: 10 },
  { code: "+1", country: "Canada", flag: "🇨🇦", len: 10 },
  { code: "+61", country: "Australia", flag: "🇦🇺", len: 9 },
  { code: "+49", country: "Germany", flag: "🇩🇪", len: 11 },
  { code: "+33", country: "France", flag: "🇫🇷", len: 9 },
  { code: "+39", country: "Italy", flag: "🇮🇹", len: 10 },
  { code: "+34", country: "Spain", flag: "🇪🇸", len: 9 },
  { code: "+31", country: "Netherlands", flag: "🇳🇱", len: 9 },
  { code: "+971", country: "UAE", flag: "🇦🇪", len: 9 },
  { code: "+966", country: "Saudi Arabia", flag: "🇸🇦", len: 9 },
  { code: "+92", country: "Pakistan", flag: "🇵🇰", len: 10 },
  { code: "+880", country: "Bangladesh", flag: "🇧🇩", len: 10 },
  { code: "+94", country: "Sri Lanka", flag: "🇱🇰", len: 9 },
  { code: "+977", country: "Nepal", flag: "🇳🇵", len: 10 },
  { code: "+65", country: "Singapore", flag: "🇸🇬", len: 8 },
  { code: "+60", country: "Malaysia", flag: "🇲🇾", len: 10 },
  { code: "+62", country: "Indonesia", flag: "🇮🇩", len: 11 },
  { code: "+81", country: "Japan", flag: "🇯🇵", len: 10 },
];

const registrationSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  whatsappPhone: z.string().min(8, "Phone number is too short"),
  eventId: z.string().min(1, "Please select an event"),
  message: z.string().optional(),
});

export function RegistrationForm({ events, preSelectedEventId }) {
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [userCredentials, setUserCredentials] = useState({
    email: "",
    phone: "",
  });
  const [selectedEventId, setSelectedEventId] = useState(
    preSelectedEventId || "",
  );
  const [selectedCountry, setSelectedCountry] = useState(COUNTRY_CODES[0]);
  const [countryOpen, setCountryOpen] = useState(false);
  const [phoneValue, setPhoneValue] = useState("");
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [eventPaymentInfo, setEventPaymentInfo] = useState(null);
  const nextFieldRef = useRef(null);

  // Coupon state
  const [couponCode, setCouponCode] = useState("");
  const [couponValidating, setCouponValidating] = useState(false);
  const [couponData, setCouponData] = useState(null);
  const [couponError, setCouponError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm({
    resolver: zodResolver(registrationSchema),
    defaultValues: { eventId: preSelectedEventId || "" },
  });

  useEffect(() => {
    if (preSelectedEventId) {
      setSelectedEventId(preSelectedEventId);
      setValue("eventId", preSelectedEventId);
    }
  }, [preSelectedEventId, setValue]);

  // If no pre-selected event, pick the first active event automatically
  useEffect(() => {
    if (preSelectedEventId) return;
    if (!selectedEventId && events && events.length > 0) {
      const ev = events.find((e) => e.isActive) || events[0];
      if (ev) {
        setSelectedEventId(ev.id);
        setValue("eventId", ev.id);
        handleEventChange(ev.id);
      }
    }
  }, [events, preSelectedEventId, selectedEventId, setValue]);

  // Load payment info when event changes
  useEffect(() => {
    if (selectedEventId) {
      fetch(`/api/get-custom-form?eventId=${selectedEventId}`)
        .then((res) => res.json())
        .then((data) => setEventPaymentInfo(data.form))
        .catch((err) => console.error("Error fetching payment info:", err));
    }
  }, [selectedEventId]);

  const handleEventChange = async (newEventId) => {
    setSelectedEventId(newEventId);
    setValue("eventId", newEventId);

    // Fetch payment info for the event
    try {
      const response = await fetch(
        `/api/get-custom-form?eventId=${newEventId}`,
      );
      if (response.ok) {
        const data = await response.json();
        setEventPaymentInfo(data.form);
      }
    } catch (error) {
      console.error("Error fetching event payment info:", error);
    }
  };

  const handlePhoneChange = useCallback(
    (e) => {
      const digits = e.target.value.replace(/\D/g, "");
      const maxLen = selectedCountry.len;
      const trimmed = digits.slice(0, maxLen);
      setPhoneValue(trimmed);
      setValue("whatsappPhone", selectedCountry.code + trimmed, {
        shouldValidate: trimmed.length >= maxLen,
      });
      if (trimmed.length >= maxLen && nextFieldRef.current) {
        nextFieldRef.current.focus();
      }
    },
    [selectedCountry, setValue],
  );

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      toast.error("Please enter a coupon code");
      return;
    }

    if (!selectedEventId) {
      toast.error("Please select an event first");
      return;
    }

    if (!eventPaymentInfo?.amount) {
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
          eventId: selectedEventId,
          amount: eventPaymentInfo.amount,
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

  const onSubmit = async (data) => {
    setIsLoading(true);
    try {
      const isDuplicate = await checkDuplicateRegistration(
        data.email,
        data.eventId,
      );
      if (isDuplicate) {
        toast.error("You are already registered for this event");
        setIsLoading(false);
        return;
      }

      // Get event data to check if it's paid
      const eventData = await getEvent(data.eventId);
      if (!eventData) throw new Error("Event not found");

      // Check if event has custom form with payment
      const formResponse = await fetch(
        `/api/get-custom-form?eventId=${data.eventId}`,
      );
      let customForm = null;
      if (formResponse.ok) {
        const formData = await formResponse.json();
        customForm = formData.form;
      }

      let user = await getUserByEmail(data.email);
      if (!user) {
        user = await signup(
          data.email,
          Math.random().toString(36).slice(-8),
          data.fullName,
          data.whatsappPhone,
        );
      }

      const ticketId = `TKT-${Date.now()}-${Math.random().toString(36).slice(2, 11).toUpperCase()}`;
      const qrCode = await generateQRCode(ticketId);

      // Create registration (but mark as pending if payment required)
      const registrationData = {
        userId: user.id,
        eventId: data.eventId,
        ticketId,
        fullName: data.fullName,
        email: data.email,
        whatsappPhone: data.whatsappPhone,
        message: data.message,
        status: "Unused",
        qrCode,
        paymentStatus: customForm?.isPaid ? "pending" : "free",
      };

      const registrationRef = await createRegistration(registrationData);
      const registrationId = registrationRef.id;

      // If it's a paid event, initiate Razorpay payment
      if (customForm?.isPaid && customForm?.amount > 0) {
        console.log("💳 Initiating payment for paid event");
        setPaymentProcessing(true);

        try {
          // Create Razorpay order
          const orderPayload = {
            eventId: data.eventId,
            registrationData: {
              fullName: data.fullName,
              email: data.email,
            },
          };

          // If coupon is applied, include discounted amount and coupon ID
          if (couponData && couponData.valid) {
            orderPayload.finalAmount = couponData.finalAmount;
            orderPayload.couponId = couponData.couponId;
            console.log(
              "🎫 Applying coupon discount:",
              couponData.discountPercent + "%",
            );
          }

          const orderResponse = await fetch("/api/create-order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(orderPayload),
          });

          if (!orderResponse.ok) {
            throw new Error("Failed to create payment order");
          }

          const orderData = await orderResponse.json();

          if (!orderData.success) {
            throw new Error(orderData.error || "Failed to create order");
          }

          // Load Razorpay checkout
          const options = {
            key: orderData.order.razorpayKeyId,
            amount: orderData.order.amount,
            currency: orderData.order.currency,
            name: "Ticketलेलो",
            description: `Ticket for ${eventData.name}`,
            order_id: orderData.order.id,
            handler: async function (response) {
              try {
                // Verify payment
                const verifyResponse = await fetch("/api/verify-payment", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_signature: response.razorpay_signature,
                    eventId: data.eventId,
                    registrationId: registrationId,
                  }),
                });

                const verifyData = await verifyResponse.json();

                if (verifyData.success) {
                  toast.success("Payment successful! ✅");

                  // Mark coupon as used if it was applied
                  if (couponData && couponData.couponId) {
                    try {
                      await useCoupon(couponData.couponId, user.id);
                      console.log(
                        "✅ Coupon marked as used:",
                        couponData.couponId,
                      );
                    } catch (error) {
                      console.error("Failed to mark coupon as used:", error);
                      // Don't fail the registration if this fails
                    }
                  }

                  // Send confirmation email
                  const emailSent = await sendRegistrationConfirmation(
                    data.email,
                    data.fullName,
                    eventData.name,
                    ticketId,
                  );

                  if (emailSent) {
                    toast.success("Check your email for the PDF ticket.");
                  }

                  // Show success modal
                  setUserCredentials({
                    email: data.email,
                    phone: data.whatsappPhone,
                  });
                  setShowSuccessModal(true);

                  reset();
                  setPhoneValue("");
                  if (!preSelectedEventId) {
                    setSelectedEventId("");
                  }
                } else {
                  toast.error("Payment verification failed");
                }
              } catch (error) {
                console.error("Payment verification error:", error);
                toast.error("Payment verification failed");
              } finally {
                setPaymentProcessing(false);
                setIsLoading(false);
              }
            },
            prefill: {
              name: data.fullName,
              email: data.email,
              contact: data.whatsappPhone,
            },
            theme: {
              color: customForm?.theme?.color || "#10b981",
            },
            modal: {
              ondismiss: function () {
                setPaymentProcessing(false);
                setIsLoading(false);
                toast.error("Payment cancelled");
              },
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
        } catch (paymentError) {
          console.error("Payment error:", error);
          toast.error(paymentError.message || "Payment initiation failed");
          setPaymentProcessing(false);
          setIsLoading(false);
        }
      } else {
        // Free event - complete registration
        const emailSent = await sendRegistrationConfirmation(
          data.email,
          data.fullName,
          eventData.name,
          ticketId,
        );

        if (emailSent) {
          toast.success(
            "Registration successful! Check your email for the PDF ticket.",
          );
        } else {
          toast.success(
            "Registration successful! You can download your ticket from the dashboard.",
          );
        }

        // Show success modal with credentials
        setUserCredentials({ email: data.email, phone: data.whatsappPhone });
        setShowSuccessModal(true);

        reset();
        setPhoneValue("");
        if (!preSelectedEventId) {
          setSelectedEventId("");
        }
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Registration error:", error);
      toast.error(error.message || "Registration failed. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 w-full">
        {/* Full Name */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-slate-300">
            Full Name *
          </label>
          <div className="relative input-glow rounded-xl">
            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
            <Input
              placeholder="Enter your full name"
              {...register("fullName")}
              disabled={isLoading}
              className="h-12 pl-10 bg-white dark:bg-slate-900 border-[#FF6A00]/20 dark:border-slate-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-600 focus:border-[#FF6A00] rounded-xl"
            />
          </div>
          {errors.fullName && (
            <p className="text-sm text-red-500 dark:text-red-400">
              {errors.fullName.message}
            </p>
          )}
        </div>

        {/* Email */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-slate-300">
            Email *
          </label>
          <div className="relative input-glow rounded-xl">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
            <Input
              type="email"
              placeholder="you@example.com"
              {...register("email")}
              disabled={isLoading}
              className="h-12 pl-10 bg-white dark:bg-slate-900 border-[#FF6A00]/20 dark:border-slate-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-600 focus:border-[#FF6A00] rounded-xl"
            />
          </div>
          {errors.email && (
            <p className="text-sm text-red-500 dark:text-red-400">
              {errors.email.message}
            </p>
          )}
        </div>

        {/* WhatsApp Phone */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-slate-300">
            WhatsApp Phone *
          </label>
          <div className="flex gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setCountryOpen(!countryOpen)}
                className="h-12 px-3 flex items-center gap-1.5 border border-[#FF6A00]/20 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-sm text-gray-700 dark:text-slate-300 hover:border-[#FF6A00] dark:hover:border-[#FF6A00]/50 transition-colors min-w-[100px]"
              >
                <span className="text-lg">{selectedCountry.flag}</span>
                <span className="font-medium">{selectedCountry.code}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-gray-400 dark:text-slate-500 transition-transform ${countryOpen ? "rotate-180" : ""}`}
                />
              </button>
              {countryOpen && (
                <div className="absolute left-0 top-full mt-1 w-64 max-h-52 overflow-y-auto z-50 bg-white dark:bg-slate-900 border border-[#FF6A00]/20 dark:border-slate-700 rounded-xl shadow-2xl shadow-[#FF6A00]/10 dark:shadow-black/50">
                  {COUNTRY_CODES.map((c, idx) => (
                    <button
                      key={`${c.code}-${idx}`}
                      type="button"
                      onClick={() => {
                        setSelectedCountry(c);
                        setCountryOpen(false);
                        setPhoneValue("");
                        setValue("whatsappPhone", "");
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-[#FF6A00]/5 dark:hover:bg-[#FF6A00]/10 transition-colors ${selectedCountry === c ? "bg-[#FFD60A]/10 dark:bg-[#FF6A00]/10 text-[#FF6A00] dark:text-[#FF6A00]" : "text-gray-700 dark:text-slate-300"}`}
                    >
                      <span className="text-lg">{c.flag}</span>
                      <span className="flex-1 text-left">{c.country}</span>
                      <span className="text-gray-400 dark:text-slate-500 font-mono text-xs">
                        {c.code}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative flex-1 input-glow rounded-xl">
              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
              <Input
                type="tel"
                placeholder={`${"0".repeat(selectedCountry.len)}`}
                value={phoneValue}
                onChange={handlePhoneChange}
                disabled={isLoading}
                maxLength={selectedCountry.len}
                className="h-12 pl-10 bg-white dark:bg-slate-900 border-[#FF6A00]/20 dark:border-slate-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-600 focus:border-[#FF6A00] rounded-xl font-mono tracking-wider"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 dark:text-slate-600 font-mono">
                {phoneValue.length}/{selectedCountry.len}
              </span>
            </div>
          </div>
          <input type="hidden" {...register("whatsappPhone")} />
          {errors.whatsappPhone && (
            <p className="text-sm text-red-500 dark:text-red-400">
              {errors.whatsappPhone.message}
            </p>
          )}
        </div>

        {/* Message */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-slate-300">
            Message (Optional)
          </label>
          <div className="relative input-glow rounded-xl">
            <MessageSquare className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-400 dark:text-slate-500" />
            <Textarea
              placeholder="Any special requests or message?"
              {...register("message")}
              disabled={isLoading}
              className="pl-10 min-h-[80px] bg-white dark:bg-slate-900 border-[#FF6A00]/20 dark:border-slate-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-600 focus:border-[#FF6A00] rounded-xl resize-none"
            />
          </div>
        </div>

        {/* Coupon Code (only show for paid events) */}
        {eventPaymentInfo?.isPaid && eventPaymentInfo?.amount > 0 && (
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
                    className="h-12 bg-white dark:bg-slate-900 border-[#FF6A00]/20 dark:border-slate-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-600 focus:border-[#FF6A00] rounded-xl uppercase"
                  />
                </div>
                <Button
                  type="button"
                  onClick={handleApplyCoupon}
                  disabled={isLoading || couponValidating || !couponCode.trim()}
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
              <div className="bg-[#FF6A00]/10 border border-[#FF6A00]/30 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle className="w-4 h-4 text-[#FF6A00]" />
                      <span className="text-sm font-semibold text-[#FF6A00]">
                        Coupon Applied: {couponCode}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400">
                      <div>Original: ₹{couponData.originalAmount}</div>
                      <div className="text-[#FF6A00] font-semibold">
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
          className="w-full h-12 text-base font-semibold bg-[#FF6A00] hover:bg-[#E65C00] text-white shadow-lg shadow-[#FF6A00]/25 hover:shadow-[#FF6A00]/40 transition-all rounded-xl gap-2"
        >
          {isLoading || paymentProcessing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {paymentProcessing ? "Processing Payment..." : "Registering..."}
            </>
          ) : eventPaymentInfo?.isPaid && eventPaymentInfo?.amount > 0 ? (
            <>
              <Sparkles className="w-4 h-4" />
              {couponData && couponData.valid ? (
                <>
                  Pay ₹{couponData.finalAmount}{" "}
                  <span className="line-through text-xs opacity-50">
                    ₹{eventPaymentInfo.amount}
                  </span>{" "}
                  & Register
                </>
              ) : (
                `Pay ₹${eventPaymentInfo.amount} & Register`
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

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-[#FF6A00]/30 rounded-2xl p-6 shadow-2xl max-w-md w-full animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <div className="w-12 h-12 rounded-full bg-[#FF6A00]/20 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-[#FF6A00]" />
                </div>
                <h3 className="text-xl font-bold text-white">
                  Registration Successful!
                </h3>
              </div>
              <button
                onClick={() => setShowSuccessModal(false)}
                className="p-1 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <p className="text-slate-300">
                🎉 You can now access the{" "}
                <strong className="text-[#FF6A00]">User Portal</strong> with
                your credentials:
              </p>

              <div className="bg-black/50 p-4 rounded-xl border border-[#FF6A00]/20 space-y-3">
                <div>
                  <p className="text-xs text-[#FF6A00]/70 mb-1">EMAIL</p>
                  <p className="font-mono text-sm text-[#FF6A00]">
                    {userCredentials.email}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#FF6A00]/70 mb-1">PHONE NUMBER</p>
                  <p className="font-mono text-sm text-[#FF6A00]">
                    {userCredentials.phone}
                  </p>
                </div>
              </div>

              <div className="bg-[#FF6A00]/10 border border-[#FF6A00]/30 rounded-lg p-3">
                <p className="text-xs text-[#FF6A00]">
                  💡 <strong>Note:</strong> Use these credentials to sign in to
                  the User Portal and view all your tickets.
                </p>
              </div>
            </div>

            <Button
              onClick={() => setShowSuccessModal(false)}
              className="w-full bg-[#FF6A00] hover:bg-[#FFD60A] text-white font-semibold"
            >
              Got it!
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
