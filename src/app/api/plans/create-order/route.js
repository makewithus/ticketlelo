import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { PLANS } from "@/lib/plans";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { adminDb } from "@/lib/firebase-admin";

/**
 * POST /api/plans/create-order
 * Creates a Razorpay order for plan purchase using platform credentials.
 */
export async function POST(request) {
  try {
    const caller = await getAuthenticatedUser(request);
    if (!caller) return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
    const { planId } = await request.json();
    const userId = caller.uid;

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

    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET || !adminDb) {
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

    await adminDb.collection("planOrders").doc(order.id).create({
      id: order.id,
      userId,
      planId,
      amount: order.amount,
      currency: order.currency,
      status: "pending",
      createdAt: new Date(),
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
