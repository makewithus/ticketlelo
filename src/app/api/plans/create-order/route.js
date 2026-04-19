import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { PLANS } from "@/lib/plans";

/**
 * POST /api/plans/create-order
 * Creates a Razorpay order for plan purchase using platform credentials.
 */
export async function POST(request) {
  try {
    const { planId, userId } = await request.json();

    if (!planId || !userId) {
      return NextResponse.json(
        { success: false, error: "planId and userId are required" },
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

    if (plan.price === 0) {
      return NextResponse.json(
        { success: false, error: "Free plan does not require payment" },
        { status: 400 },
      );
    }

    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return NextResponse.json(
        { success: false, error: "Razorpay credentials not configured" },
        { status: 500 },
      );
    }

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const order = await razorpay.orders.create({
      amount: plan.price * 100, // paise
      currency: "INR",
      receipt: `plan_${planId}_${Date.now().toString().slice(-10)}`,
      notes: {
        userId,
        planId,
        planName: plan.name,
      },
    });

    return NextResponse.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      planName: plan.name,
      planPrice: plan.price,
    });
  } catch (error) {
    console.error("Plan order creation error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
