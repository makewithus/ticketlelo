"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { Loader2, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function PricingPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [upgrading, setUpgrading] = useState(null);

  const currentPlan = user?.plan || "free";

  const userInitials = (user?.fullName || user?.email || "U").trim().charAt(0).toUpperCase();
  const photoURL = user?.photoURL || "";

  // Load Razorpay checkout script
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.head.appendChild(script);
    return () => {
      if (document.head.contains(script)) document.head.removeChild(script);
    };
  }, []);

  const handleUpgrade = async (planId) => {
    if (!user) {
      router.push("/login");
      return;
    }

    if (planId === currentPlan) return;
    if (planId === "free") return;

    setUpgrading(planId);
    try {
      // Step 1: Create Razorpay order
      const orderRes = await fetch("/api/plans/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, userId: user.id }),
      });
      const orderData = await orderRes.json();

      if (!orderData.success) {
        toast({ title: "Error", description: orderData.error, variant: "destructive" });
        setUpgrading(null);
        return;
      }

      // Step 2: Open Razorpay checkout
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Ticketलेलो",
        description: `${orderData.planName} Plan`,
        order_id: orderData.orderId,
        prefill: {
          name: user.fullName || user.email,
          email: user.email,
        },
        theme: { color: "#FF6A00" },
        handler: async (response) => {
          try {
            // Step 3: Verify payment and upgrade plan
            const verifyRes = await fetch("/api/plans/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                userId: user.id,
                planId,
              }),
            });
            const verifyData = await verifyRes.json();

            if (verifyData.success) {
              toast({ title: " Plan Upgraded!", description: verifyData.message });
              router.refresh();
              router.push("/admin/dashboard");
            } else {
              toast({ title: "Payment Failed", description: verifyData.error, variant: "destructive" });
            }
          } catch (err) {
            console.error("Verification error:", err);
            toast({ title: "Error", description: "Payment verification failed", variant: "destructive" });
          } finally {
            setUpgrading(null);
          }
        },
        modal: {
          ondismiss: () => setUpgrading(null),
        },
      };

      if (!window.Razorpay) {
        toast({ title: "Error", description: "Payment gateway not loaded. Please refresh.", variant: "destructive" });
        setUpgrading(null);
        return;
      }

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error("Upgrade error:", err);
      toast({ title: "Error", description: "Failed to initiate payment", variant: "destructive" });
      setUpgrading(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#131517] text-white selection:bg-[#FE760B] selection:text-white relative flex flex-col justify-between">
      {/* Subtle top ambient glow */}
      <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-[#FE760B]/10 via-[#FE760B]/5 to-transparent pointer-events-none" />

      {/* Top Header Navigation matching Image 2 */}
      <header className="relative z-20 w-full px-4 sm:px-6 lg:px-8 py-3 sm:py-4 flex items-center justify-between">
        <div className="flex items-center gap-3 sm:gap-4">
          <Link href="/" className="shrink-0 flex items-center group">
            <Image
              src="/logo/ticketlelo-logo-nav.png"
              alt="TicketLelo"
              width={100}
              height={26}
              className="h-6 sm:h-7 w-auto object-contain transition-opacity group-hover:opacity-95"
              priority
            />
          </Link>
          <Link
            href={
              user?.role === "superAdmin"
                ? "/superadmin"
                : user?.role === "organiser"
                ? "/admin/dashboard"
                : user
                ? "/dashboard"
                : "/"
            }
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-[#D0D0D1] hover:text-white transition-colors"
          >
            <ArrowLeft size={14} className="shrink-0" />
            <span>Back to dashboard</span>
          </Link>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle inline />
          {/* Profile Circle at Top Right */}
          <Link
            href={
              user?.role === "superAdmin"
                ? "/superadmin"
                : user?.role === "organiser" || user?.isAdmin
                ? "/admin/dashboard"
                : "/dashboard"
            }
            title="Profile"
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#22C55E] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs hover:opacity-90 transition-opacity overflow-hidden"
          >
            {photoURL ? (
              <img
                src={photoURL}
                alt="Account"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            ) : (
              userInitials
            )}
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 pb-10 flex-1 flex flex-col justify-center">
        {/* Header Section matching Image 2 */}
        <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-10">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#FE760B] mb-2 sm:mb-2.5">
            SIMPLE, TRANSPARENT PRICING
          </p>
          <h1 className="text-3xl sm:text-4xl lg:text-[40px] font-bold text-white tracking-tight mb-2 sm:mb-2.5">
            Choose your plan
          </h1>
          <p className="text-xs sm:text-sm text-[#9B9EA4] font-normal">
            Start free, upgrade when you&apos;re ready. Cancel or change anytime.
          </p>
        </div>

        {/* 3 Cards Grid strictly matching Image 2 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6 items-stretch max-w-5xl mx-auto w-full">
          {/* Card 1: Free */}
          <div
            className={`bg-[#1A1C1F] rounded-2xl p-5 sm:p-6 flex flex-col justify-between transition-all ${
              currentPlan === "free"
                ? "border border-[#2A2D31]"
                : "border border-[#2A2D31] hover:border-[#3A3D42]"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-3.5">
                <h2 className="text-base sm:text-lg font-bold text-white">Free</h2>
                {currentPlan === "free" && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#212327] border border-[#2A2D31] text-[11px] text-[#D0D0D1] font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                    <span>Current plan</span>
                  </div>
                )}
              </div>

              {/* Price */}
              <div className="flex items-baseline gap-1 mb-5 sm:mb-6">
                <span className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  ₹0
                </span>
                <span className="text-xs text-[#9B9EA4] font-normal">/ month</span>
              </div>

              {/* Features List with refined font-medium weight */}
              <ul className="space-y-3 text-xs text-[#D0D0D1]">
                <li className="flex items-center gap-2.5">
                  <span className="text-[#10B981] font-semibold shrink-0">✓</span>
                  <span className="font-medium text-[#D0D0D1]">1 event</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="text-[#10B981] font-semibold shrink-0">✓</span>
                  <span className="font-medium text-[#D0D0D1]">300 guests per event</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="text-[#10B981] font-semibold shrink-0">✓</span>
                  <span className="font-medium text-[#D0D0D1]">Basic registration form</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="text-[#10B981] font-semibold shrink-0">✓</span>
                  <span className="font-medium text-[#D0D0D1]">QR tickets & email delivery</span>
                </li>
                <li className="flex items-center gap-2.5 text-[#9B9EA4]">
                  <span className="text-[#9B9EA4] font-semibold shrink-0">✕</span>
                  <span className="font-medium text-[#9B9EA4]">No payments, branding, insights or blasts</span>
                </li>
              </ul>
            </div>

            {/* Button */}
            <div className="mt-6 sm:mt-8">
              <button
                type="button"
                disabled={currentPlan === "free" || upgrading}
                onClick={() => handleUpgrade("free")}
                className="w-full py-2.5 sm:py-3 rounded-xl font-medium text-xs sm:text-sm bg-[#212327] border border-[#2A2D31] text-[#9B9EA4] cursor-default text-center transition-colors"
              >
                {currentPlan === "free" ? "Your current plan" : "Select Free"}
              </button>
            </div>
          </div>

          {/* Card 2: Starter (Highlighted in Image 2) */}
          <div
            className="bg-[#1A1C1F] rounded-2xl p-5 sm:p-6 flex flex-col justify-between relative transition-all border-2 border-[#FE760B] shadow-xl shadow-[#FE760B]/10"
          >
            <div>
              <div className="flex items-center justify-between mb-3.5">
                <h2 className="text-base sm:text-lg font-bold text-white">Starter</h2>
                <div className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#2A1D13] text-[#FE760B] border border-[#FE760B]/30 text-[10px] sm:text-[11px] font-semibold">
                  Popular
                </div>
              </div>

              {/* Price */}
              <div className="flex items-baseline gap-1 mb-5 sm:mb-6">
                <span className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  ₹999
                </span>
                <span className="text-xs text-[#9B9EA4] font-normal">/ month</span>
              </div>

              {/* Features List with refined font-medium weight */}
              <ul className="space-y-3 text-xs text-[#D0D0D1]">
                <li className="flex items-center gap-2.5">
                  <span className="text-[#10B981] font-semibold shrink-0">✓</span>
                  <span className="font-medium text-[#D0D0D1]">3 events</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="text-[#10B981] font-semibold shrink-0">✓</span>
                  <span className="font-medium text-[#D0D0D1]">1,000 guests per event</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="text-[#10B981] font-semibold shrink-0">✓</span>
                  <span className="font-medium text-[#D0D0D1]">Razorpay payments & coupons</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="text-[#10B981] font-semibold shrink-0">✓</span>
                  <span className="font-medium text-[#D0D0D1]">Custom branding, banner & URL</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="text-[#10B981] font-semibold shrink-0">✓</span>
                  <span className="font-medium text-[#D0D0D1]">Insights & blasts</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="text-[#10B981] font-semibold shrink-0">✓</span>
                  <span className="font-medium text-[#D0D0D1]">Email support</span>
                </li>
              </ul>
            </div>

            {/* Button */}
            <div className="mt-6 sm:mt-8">
              <button
                type="button"
                disabled={currentPlan === "starter" || upgrading}
                onClick={() => handleUpgrade("starter")}
                className={`w-full py-2.5 sm:py-3 rounded-xl font-semibold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 ${
                  currentPlan === "starter"
                    ? "bg-[#212327] border border-[#2A2D31] text-[#9B9EA4] cursor-default"
                    : "bg-[#FE760B] hover:bg-[#FF8A2B] text-[#131517] shadow-lg shadow-[#FE760B]/20"
                }`}
              >
                {upgrading === "starter" ? (
                  <>
                    <Loader2 size={16} className="animate-spin text-[#131517]" />
                    <span>Processing...</span>
                  </>
                ) : currentPlan === "starter" ? (
                  "Your current plan"
                ) : (
                  "Upgrade to Starter"
                )}
              </button>
            </div>
          </div>

          {/* Card 3: Pro */}
          <div
            className="bg-[#1A1C1F] rounded-2xl p-5 sm:p-6 flex flex-col justify-between transition-all border border-[#2A2D31] hover:border-[#3A3D42]"
          >
            <div>
              <div className="flex items-center justify-between mb-3.5">
                <h2 className="text-base sm:text-lg font-bold text-white">Pro</h2>
                <div className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#2B2816] text-[#FDE003] border border-[#FDE003]/30 text-[10px] sm:text-[11px] font-semibold">
                  Best value
                </div>
              </div>

              {/* Price */}
              <div className="flex items-baseline gap-1 mb-5 sm:mb-6">
                <span className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  ₹2,499
                </span>
                <span className="text-xs text-[#9B9EA4] font-normal">/ month</span>
              </div>

              {/* Features List with refined font-medium weight */}
              <ul className="space-y-3 text-xs text-[#D0D0D1]">
                <li className="flex items-center gap-2.5">
                  <span className="text-[#10B981] font-semibold shrink-0">✓</span>
                  <span className="font-medium text-[#D0D0D1]">10 events</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="text-[#10B981] font-semibold shrink-0">✓</span>
                  <span className="font-medium text-[#D0D0D1]">Unlimited guests</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="text-[#10B981] font-semibold shrink-0">✓</span>
                  <span className="font-medium text-[#D0D0D1]">Everything in Starter</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="text-[#10B981] font-semibold shrink-0">✓</span>
                  <span className="font-medium text-[#D0D0D1]">Advanced insights</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="text-[#10B981] font-semibold shrink-0">✓</span>
                  <span className="font-medium text-[#D0D0D1]">Priority support & early access</span>
                </li>
              </ul>
            </div>

            {/* Button: White CTA matching Image 2 */}
            <div className="mt-6 sm:mt-8">
              <button
                type="button"
                disabled={currentPlan === "pro" || upgrading}
                onClick={() => handleUpgrade("pro")}
                className={`w-full py-2.5 sm:py-3 rounded-xl font-semibold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 ${
                  currentPlan === "pro"
                    ? "bg-[#212327] border border-[#2A2D31] text-[#9B9EA4] cursor-default"
                    : "bg-white hover:bg-slate-100 text-[#131517] shadow-md"
                }`}
              >
                {upgrading === "pro" ? (
                  <>
                    <Loader2 size={16} className="animate-spin text-[#131517]" />
                    <span>Processing...</span>
                  </>
                ) : currentPlan === "pro" ? (
                  "Your current plan"
                ) : (
                  "Upgrade to Pro"
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Footer Note matching Image 2 */}
        <p className="text-center text-xs text-[#9B9EA4] font-normal mt-8 sm:mt-10">
          All plans include QR ticketing and email delivery.
        </p>
      </div>
    </div>
  );
}
