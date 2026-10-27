import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { adminDb } from "@/lib/firebase-admin";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { configuredPaymentSecret, verifyPaymentHmac } from "@/lib/payment-security";
import { PLANS } from "@/lib/plans";

export async function POST(request) {
  try {
    const caller = await getAuthenticatedUser(request);
    if (!caller) return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
    if (!adminDb) return NextResponse.json({ success: false, error: "Payment service unavailable" }, { status: 503 });

    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = await request.json();
    const secret = configuredPaymentSecret(process.env.RAZORPAY_KEY_SECRET);
    if (!secret || !orderId || !paymentId || !verifyPaymentHmac(`${orderId}|${paymentId}`, signature, secret)) {
      return NextResponse.json({ success: false, error: "Payment verification failed" }, { status: 400 });
    }

    const planOrderRef = adminDb.collection("planOrders").doc(orderId);
    const planOrderSnap = await planOrderRef.get();
    if (!planOrderSnap.exists) return NextResponse.json({ success: false, error: "Plan order not found" }, { status: 404 });
    const planOrder = planOrderSnap.data();
    if (planOrder.userId !== caller.uid) return NextResponse.json({ success: false, error: "Order access denied" }, { status: 403 });
    const plan = PLANS[planOrder.planId];
    if (!plan || planOrder.amount !== plan.price * 100 || planOrder.currency !== "INR") {
      return NextResponse.json({ success: false, error: "Plan order amount mismatch" }, { status: 400 });
    }

    const razorpay = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: secret });
    const [providerOrder, payment] = await Promise.all([
      razorpay.orders.fetch(orderId),
      razorpay.payments.fetch(paymentId),
    ]);
    if (providerOrder.id !== orderId || providerOrder.amount !== planOrder.amount || providerOrder.currency !== "INR" ||
      payment.order_id !== orderId || payment.amount !== planOrder.amount || payment.currency !== "INR" || payment.status !== "captured") {
      return NextResponse.json({ success: false, error: "Provider payment does not match this plan order" }, { status: 400 });
    }

    await adminDb.runTransaction(async (transaction) => {
      const latestOrder = await transaction.get(planOrderRef);
      if (!latestOrder.exists) throw new Error("Plan order not found");
      if (latestOrder.data().status === "paid") {
        if (latestOrder.data().paymentId !== paymentId) throw new Error("Plan order already settled with another payment");
        return;
      }
      if (latestOrder.data().status !== "pending") throw new Error("Plan order is not pending");
      transaction.update(adminDb.collection("users").doc(caller.uid), {
        plan: planOrder.planId,
        eventsAllowed: plan.eventsAllowed,
        planStartDate: new Date(),
        planPaymentId: paymentId,
        planOrderId: orderId,
        updatedAt: new Date(),
      });
      transaction.update(planOrderRef, { status: "paid", paymentId, paidAt: new Date(), updatedAt: new Date() });
    });

    return NextResponse.json({ success: true, plan: planOrder.planId, message: `Successfully upgraded to ${plan.name} plan` });
  } catch (error) {
    console.error("Plan payment verification failed:", error.code || "unexpected-error");
    return NextResponse.json({ success: false, error: "Plan payment could not be verified" }, { status: 500 });
  }
}
