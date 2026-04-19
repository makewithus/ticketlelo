import { NextResponse } from "next/server";
import crypto from "crypto";
import { adminDb } from "@/lib/firebase-admin";
import { PLANS } from "@/lib/plans";

/**
 * POST /api/plans/verify-payment
 * Verifies Razorpay payment signature and upgrades user plan.
 */
export async function POST(request) {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      userId,
      planId,
    } = await request.json();

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature ||
      !userId ||
      !planId
    ) {
      return NextResponse.json(
        { success: false, error: "Missing required payment fields" },
        { status: 400 },
      );
    }

    // Verify signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return NextResponse.json(
        { success: false, error: "Payment verification failed — invalid signature" },
        { status: 400 },
      );
    }

    const plan = PLANS[planId];
    if (!plan) {
      return NextResponse.json(
        { success: false, error: "Invalid plan" },
        { status: 400 },
      );
    }

    // Upgrade plan in Firestore
    await adminDb.collection("users").doc(userId).update({
      plan: planId,
      eventsAllowed: plan.eventsAllowed,
      planStartDate: new Date(),
      planPaymentId: razorpay_payment_id,
      planOrderId: razorpay_order_id,
      updatedAt: new Date(),
    });

    console.log(`✅ Plan upgraded: userId=${userId} planId=${planId} paymentId=${razorpay_payment_id}`);

    return NextResponse.json({
      success: true,
      plan: planId,
      message: `Successfully upgraded to ${plan.name} plan`,
    });
  } catch (error) {
    console.error("Plan payment verification error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
