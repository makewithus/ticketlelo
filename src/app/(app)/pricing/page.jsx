"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { Check, Zap, Star, Crown, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: 0,
    icon: Star,
    iconColor: "text-gray-500",
    iconBg: "bg-gray-100",
    borderColor: "border-gray-200",
    badgeColor: "",
    features: [
      "1 event",
      "300 participants per event",
      "Basic registration form",
      "QR code tickets",
      "Email delivery",
    ],
    limitations: [
      "No custom branding",
      "No payment integration",
      "No analytics",
      "No broadcast messaging",
    ],
    cta: "Current Plan",
    highlighted: false,
  },
  {
    id: "starter",
    name: "Starter",
    price: 999,
    icon: Zap,
    iconColor: "text-[#FF6A00]",
    iconBg: "bg-orange-100",
    borderColor: "border-[#FF6A00]/30",
    badgeColor: "bg-orange-100 text-[#FF6A00]",
    badge: "Popular",
    features: [
      "3 events",
      "1,000 participants per event",
      "Custom branding & theme",
      "Custom event URL slug",
      "Banner image upload",
      "Payment integration (Razorpay)",
      "Social links",
      "Analytics dashboard",
      "Broadcast messaging",
      "Email support",
    ],
    limitations: [],
    cta: "Upgrade to Starter",
    highlighted: true,
  },
  {
    id: "pro",
    name: "Pro",
    price: 2499,
    icon: Crown,
    iconColor: "text-purple-600",
    iconBg: "bg-purple-100",
    borderColor: "border-purple-200",
    badgeColor: "bg-purple-100 text-purple-600",
    badge: "Best Value",
    features: [
      "10 events",
      "Unlimited participants",
      "Everything in Starter",
      "Priority support",
      "Advanced analytics",
      "Early access to new features",
    ],
    limitations: [],
    cta: "Upgrade to Pro",
    highlighted: false,
  },
];

export default function PricingPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [upgrading, setUpgrading] = useState(null);

  const currentPlan = user?.plan || "free";

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
      router.push("/user-login");
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
              toast({ title: "🎉 Plan Upgraded!", description: verifyData.message });
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-orange-50/30 py-16 px-4">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto mb-14">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-orange-100 text-[#FF6A00] rounded-full text-sm font-semibold mb-6">
          <Zap size={14} />
          Simple, Transparent Pricing
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-4">
          Choose Your Plan
        </h1>
        <p className="text-lg text-gray-500">
          Scale your events without limits. Start free, upgrade when you&apos;re
          ready.
        </p>
      </div>

      {/* Plans Grid */}
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        {PLANS.map((plan) => {
          const Icon = plan.icon;
          const isCurrent = currentPlan === plan.id;
          const isUpgrading = upgrading === plan.id;

          return (
            <div
              key={plan.id}
              className={`relative bg-white rounded-3xl border-2 ${plan.borderColor} shadow-sm p-8 flex flex-col transition-all hover:shadow-md ${
                plan.highlighted
                  ? "ring-2 ring-[#FF6A00]/30 shadow-lg shadow-[#FF6A00]/10"
                  : ""
              }`}
            >
              {plan.badge && (
                <div
                  className={`absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold ${plan.badgeColor}`}
                >
                  {plan.badge}
                </div>
              )}

              {isCurrent && (
                <div className="absolute -top-3.5 right-6 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">
                  Current Plan
                </div>
              )}

              <div
                className={`w-12 h-12 ${plan.iconBg} rounded-2xl flex items-center justify-center mb-5`}
              >
                <Icon size={22} className={plan.iconColor} />
              </div>

              <h2 className="text-xl font-extrabold text-gray-900">
                {plan.name}
              </h2>

              <div className="mt-3 mb-6">
                {plan.price === 0 ? (
                  <span className="text-4xl font-extrabold text-gray-900">
                    Free
                  </span>
                ) : (
                  <div className="flex items-end gap-1">
                    <span className="text-4xl font-extrabold text-gray-900">
                      ₹{plan.price.toLocaleString("en-IN")}
                    </span>
                    <span className="text-gray-400 text-sm mb-1">/month</span>
                  </div>
                )}
              </div>

              <ul className="space-y-3 flex-1 mb-8">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <Check
                      size={16}
                      className="text-green-500 flex-shrink-0 mt-0.5"
                    />
                    <span className="text-sm text-gray-700">{feature}</span>
                  </li>
                ))}
                {plan.limitations.map((lim, i) => (
                  <li
                    key={`lim-${i}`}
                    className="flex items-start gap-2.5 opacity-40"
                  >
                    <Check
                      size={16}
                      className="text-gray-300 flex-shrink-0 mt-0.5"
                    />
                    <span className="text-sm text-gray-400 line-through">
                      {lim}
                    </span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleUpgrade(plan.id)}
                disabled={isCurrent || plan.id === "free" || isUpgrading}
                className={`w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                  isCurrent
                    ? "bg-gray-100 text-gray-400 cursor-default"
                    : plan.highlighted
                      ? "bg-[#FF6A00] text-white hover:opacity-90 shadow-md shadow-[#FF6A00]/20"
                      : plan.id === "pro"
                        ? "bg-purple-600 text-white hover:bg-purple-700"
                        : "bg-gray-100 text-gray-400 cursor-default"
                }`}
              >
                {isUpgrading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Processing...
                  </>
                ) : isCurrent ? (
                  "Current Plan"
                ) : (
                  plan.cta
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* FAQ Note */}
      <p className="text-center text-sm text-gray-400 mt-10">
        All plans include QR code ticketing and email delivery. Cancel or
        upgrade anytime.
      </p>
    </div>
  );
}
