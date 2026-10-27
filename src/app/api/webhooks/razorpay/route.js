import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { configuredPaymentSecret, verifyPaymentHmac } from "@/lib/payment-security";
import { releaseTicketCapacity } from "@/lib/capacity-reservation";

export async function POST(request) {
  try {
    if (!adminDb) return NextResponse.json({ error: "Payment service unavailable" }, { status: 503 });
    const rawBody = await request.text();
    const signature = request.headers.get("x-razorpay-signature");
    const webhookSecret = configuredPaymentSecret(process.env.RAZORPAY_WEBHOOK_SECRET);
    if (!signature) return NextResponse.json({ error: "Missing x-razorpay-signature header" }, { status: 400 });
    if (!webhookSecret) return NextResponse.json({ error: "Payment webhook is not configured" }, { status: 503 });
    if (!verifyPaymentHmac(rawBody, signature, webhookSecret)) return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });

    let payload;
    try { payload = JSON.parse(rawBody); } catch { return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 }); }
    // Razorpay's event payload includes a stable event `id`. Never fall back to
    // a timestamp: retries would then bypass deduplication.
    const eventId = typeof payload.id === "string" ? payload.id.trim() : "";
    const eventType = payload.event;
    if (!/^[-A-Za-z0-9_]{1,128}$/.test(eventId) || typeof eventType !== "string" || eventType.length > 100) {
      return NextResponse.json({ error: "Invalid webhook event id or type" }, { status: 400 });
    }

    const entity = payload.payload?.payment?.entity || payload.payload?.refund?.entity;
    if (!entity?.id) return NextResponse.json({ error: "Missing payment or refund entity" }, { status: 400 });
    let providerOrderId = entity.order_id;
    if (eventType === "refund.processed" && !providerOrderId && entity.payment_id) {
      const orders = await adminDb.collection("orders").where("paymentId", "==", entity.payment_id).limit(2).get();
      const capturedOrders = orders.empty
        ? await adminDb.collection("orders").where("capturedPaymentId", "==", entity.payment_id).limit(2).get()
        : orders;
      if (capturedOrders.size === 1) providerOrderId = capturedOrders.docs[0].id;
      else return NextResponse.json({ error: "Refund payment does not identify one internal order" }, { status: 404 });
    }
    if (!providerOrderId) return NextResponse.json({ error: "Missing provider order id" }, { status: 400 });
    const orderRef = adminDb.collection("orders").doc(providerOrderId);
    const eventRef = adminDb.collection("webhookEvents").doc(eventId);
    const now = Timestamp.now();
    let shouldRelease = false;

    await adminDb.runTransaction(async (tx) => {
      const [eventSnap, orderSnap] = await Promise.all([tx.get(eventRef), tx.get(orderRef)]);
      if (eventSnap.exists) return;
      if (!orderSnap.exists) throw new Error("Order not found");
      const order = orderSnap.data();
      if (order.razorpayOrderId && order.razorpayOrderId !== providerOrderId) throw new Error("Provider order mismatch");

      if (eventType === "payment.captured") {
        const expected = Number(order.pricing?.finalPayablePaise);
        if (entity.status !== "captured" || !Number.isSafeInteger(expected) || Number(entity.amount) !== expected || entity.currency !== "INR") {
          throw new Error("Captured payment does not match the internal order");
        }
        // Ticket issuance happens only after the API verifies the provider order
        // and payment by fetching them from Razorpay.
        if (order.status === "pending") tx.update(orderRef, {
          status: "captured_pending_fulfillment",
          capturedPaymentId: entity.id,
          webhookCapturedAt: now,
          updatedAt: now,
        });
      } else if (eventType === "payment.failed") {
        if (order.status === "pending") {
          tx.update(orderRef, { status: "failed", errorDescription: entity.error_description || "Payment failed", updatedAt: now });
          shouldRelease = Boolean(order.reservationId);
        }
      } else if (eventType === "refund.processed") {
        const refundAmountPaise = Number(entity.amount);
        if (!Number.isSafeInteger(refundAmountPaise) || refundAmountPaise <= 0 || !entity.payment_id) throw new Error("Invalid refund entity");
        const refundRef = adminDb.collection("paymentRefunds").doc(entity.id);
        const refundSnap = await tx.get(refundRef);
        if (!refundSnap.exists) {
          const totalRefunded = Number(order.refundedAmountPaise || 0) + refundAmountPaise;
          const expected = Number(order.pricing?.finalPayablePaise);
          if (!Number.isSafeInteger(expected) || totalRefunded > expected) throw new Error("Refund total exceeds internal order amount");
          tx.create(refundRef, { id: entity.id, orderId: providerOrderId, paymentId: entity.payment_id, amountPaise: refundAmountPaise, createdAt: now });
          tx.update(orderRef, {
            refundedAmountPaise: totalRefunded,
            refundId: entity.id,
            status: totalRefunded === expected ? "refunded" : "partially_refunded",
            updatedAt: now,
          });
          if (totalRefunded === expected && order.ticketId) {
            tx.update(adminDb.collection("tickets").doc(order.ticketId), { status: "Revoked", revokedReason: "Refund processed", revokedAt: now, updatedAt: now });
          }
          // Commission reversal is intentionally not guessed here: the existing
          // ledger has no partial-refund accounting contract.
        }
      }
      tx.create(eventRef, { id: eventId, eventType, orderId: providerOrderId, processedAt: now, status: "processed" });
    });

    if (shouldRelease) await releaseTicketCapacity((await orderRef.get()).data()?.reservationId);
    return NextResponse.json({ received: true, status: "processed", event: eventType });
  } catch (error) {
    const clientError = ["Order not found", "Provider order mismatch", "Captured payment does not match the internal order", "Invalid refund entity", "Refund total exceeds internal order amount"].includes(error.message);
    console.error("[webhooks/razorpay] Processing failed:", error.message);
    return NextResponse.json({ error: clientError ? error.message : "Webhook processing failed" }, { status: clientError ? 400 : 500 });
  }
}
