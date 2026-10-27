import crypto from "node:crypto";
import Razorpay from "razorpay";
import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { configuredPaymentSecret, verifyPaymentHmac } from "@/lib/payment-security";
import { resolveTicketEntitlements } from "@/lib/combos";
import { generateQRCode, generateSignedQRPayload } from "@/lib/qr";

const deterministicId = (orderId) => crypto.createHash("sha256").update(orderId).digest("hex");

export async function POST(request) {
  try {
    const caller = await getAuthenticatedUser(request);
    if (!caller) return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
    if (!adminDb) return NextResponse.json({ success: false, error: "Payment service unavailable" }, { status: 503 });

    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature, eventId } = await request.json();
    const secret = configuredPaymentSecret(process.env.RAZORPAY_KEY_SECRET);
    if (!orderId || !paymentId || !secret || !verifyPaymentHmac(`${orderId}|${paymentId}`, signature, secret)) {
      return NextResponse.json({ success: false, error: "Payment verification failed" }, { status: 400 });
    }

    const orderRef = adminDb.collection("orders").doc(orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
    const order = orderSnap.data();
    if (order.userId !== caller.uid) return NextResponse.json({ success: false, error: "Order access denied" }, { status: 403 });
    if (eventId && eventId !== order.eventId) return NextResponse.json({ success: false, error: "Order event mismatch" }, { status: 400 });
    if (order.status === "paid" && order.ticketId) {
      return NextResponse.json({ success: true, alreadyVerified: true, ticketId: order.ticketId });
    }
    if (!["pending", "captured_pending_fulfillment"].includes(order.status)) return NextResponse.json({ success: false, error: "Order is not payable" }, { status: 409 });

    const keyId = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    if (!keyId) return NextResponse.json({ success: false, error: "Payment provider is not configured" }, { status: 503 });
    const razorpay = new Razorpay({ key_id: keyId, key_secret: secret });
    const [providerOrder, payment] = await Promise.all([
      razorpay.orders.fetch(orderId),
      razorpay.payments.fetch(paymentId),
    ]);
    const expectedPaise = Number(order.pricing?.finalPayablePaise);
    if (providerOrder.id !== orderId || providerOrder.amount !== expectedPaise || providerOrder.currency !== "INR" ||
      payment.order_id !== orderId || payment.amount !== expectedPaise || payment.currency !== "INR" || payment.status !== "captured" ||
      (order.capturedPaymentId && order.capturedPaymentId !== paymentId)) {
      return NextResponse.json({ success: false, error: "Captured provider payment does not match this order" }, { status: 400 });
    }

    const ticketId = `TKT-${deterministicId(orderId).slice(0, 28).toUpperCase()}`;
    const registrationId = deterministicId(`registration:${orderId}`);
    const ticketRef = adminDb.collection("tickets").doc(ticketId);
    const registrationRef = adminDb.collection("registrations").doc(registrationId);
    const reservationRef = order.reservationId ? adminDb.collection("reservations").doc(order.reservationId) : null;
    const eventSnap = await adminDb.collection("events").doc(order.eventId).get();
    if (!eventSnap.exists) return NextResponse.json({ success: false, error: "Event not found" }, { status: 404 });
    const event = eventSnap.data();
    const entitlements = resolveTicketEntitlements(order.ticketConfig);
    const qrPayload = generateSignedQRPayload({
      eventSlug: event.slug || order.eventId,
      ticketId,
      entitledSubEventIds: entitlements.entitledSubEventIds,
    });
    const qrCodeUrl = await generateQRCode(qrPayload);
    const buyer = order.registrationData || {};
    const now = Timestamp.now();

    await adminDb.runTransaction(async (transaction) => {
      const [freshOrder, freshTicket, freshRegistration, reservation] = await Promise.all([
        transaction.get(orderRef),
        transaction.get(ticketRef),
        transaction.get(registrationRef),
        reservationRef ? transaction.get(reservationRef) : Promise.resolve(null),
      ]);
      if (!freshOrder.exists) throw new Error("Order disappeared");
      if (freshOrder.data().status === "paid") return;
      if (!["pending", "captured_pending_fulfillment"].includes(freshOrder.data().status)) throw new Error("Order is not payable");
      if (freshOrder.data().capturedPaymentId && freshOrder.data().capturedPaymentId !== paymentId) throw new Error("Captured payment does not match order");
      if (freshTicket.exists || freshRegistration.exists) throw new Error("Conflicting ticket issuance record");
      if (reservationRef) {
        if (!reservation?.exists || reservation.data().status !== "reserved") throw new Error("Capacity reservation is no longer active");
        const expiry = reservation.data().expiresAt?.toDate?.();
        if (expiry && expiry.getTime() <= Date.now()) throw new Error("Capacity reservation has expired");
      }

      transaction.create(ticketRef, {
        id: ticketId,
        ticketId,
        orderId,
        paymentId,
        userId: caller.uid,
        eventId: order.eventId,
        eventTitle: event.title || event.name || "Event",
        eventSlug: event.slug || order.eventId,
        ticketTitle: order.ticketConfig?.title || "Standard Ticket",
        quantity: order.quantity || 1,
        entitledSubEventIds: entitlements.entitledSubEventIds,
        entitledTrackNames: entitlements.entitledTrackNames,
        buyerName: buyer.fullName || "Attendee",
        buyerEmail: String(buyer.email || caller.email).toLowerCase(),
        buyerPhone: buyer.whatsappPhone || "",
        amountPaid: order.pricing?.finalPayable || 0,
        pricingBreakdown: order.pricing || null,
        qrPayload,
        qrCodeUrl,
        status: "Valid",
        checkIns: {},
        issuedAt: now,
        updatedAt: now,
      });
      transaction.create(registrationRef, {
        id: registrationId,
        ticketId,
        orderId,
        userId: caller.uid,
        eventId: order.eventId,
        fullName: buyer.fullName || "Attendee",
        email: String(buyer.email || caller.email).toLowerCase(),
        whatsappPhone: buyer.whatsappPhone || "",
        formData: buyer.formData || {},
        status: "Unused",
        paymentStatus: "paid",
        paymentId,
        entitledSubEventIds: entitlements.entitledSubEventIds,
        createdAt: now,
        updatedAt: now,
      });
      transaction.update(orderRef, { status: "paid", paymentId, ticketId, registrationId, paidAt: now, updatedAt: now });
      if (reservationRef) transaction.update(reservationRef, { status: "finalized", finalizedAt: now, updatedAt: now });
    });

    return NextResponse.json({ success: true, message: "Payment verified and ticket issued", ticketId });
  } catch (error) {
    const status = error.message === "Capacity reservation has expired" ? 409 : 500;
    console.error("[verify-payment] Verification failed:", error.code || "unexpected-error");
    return NextResponse.json({ success: false, error: status === 409 ? error.message : "Payment could not be verified" }, { status });
  }
}
