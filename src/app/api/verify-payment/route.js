import crypto from "node:crypto";
import Razorpay from "razorpay";
import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { configuredPaymentSecret, verifyPaymentHmac } from "@/lib/payment-security";
import { resolveTicketEntitlements } from "@/lib/combos";
import { generateQRCode, generateSignedQRPayload } from "@/lib/qr";
import { getDefaultPaymentProvider } from "@/lib/payments/provider-registry";
import { recordPaymentCaptureLedger } from "@/lib/payments/ledger";
import { scheduleSettlementForOrder } from "@/lib/payments/settlement-engine";
import { sendTicketDeliveryEmail } from "@/src/app/api/send-ticket-email/route";
import { awardPointsForRegistration } from "@/lib/creator-campus/points-engine";

const deterministicId = (orderId) => crypto.createHash("sha256").update(orderId).digest("hex");

export async function POST(request) {
  try {
    const caller = await getAuthenticatedUser(request);
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
    if (caller && caller.uid && order.userId && order.userId !== caller.uid) {
      const orderEmail = String(order.registrationData?.email || "").toLowerCase();
      const callerEmail = String(caller.email || "").toLowerCase();
      if (!orderEmail || !callerEmail || orderEmail !== callerEmail) {
        return NextResponse.json({ success: false, error: "Order access denied" }, { status: 403 });
      }
    }
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

    // If payment was authorized but pending capture (standard for card payments without immediate capture), capture it now
    let paymentRecord = payment;
    if (paymentRecord.status === "authorized") {
      try {
        paymentRecord = await razorpay.payments.capture(paymentId, expectedPaise, "INR");
      } catch (capErr) {
        console.error("Auto-capture failed for ticket payment:", capErr?.message || capErr);
      }
    }

    if (
      providerOrder.id !== orderId ||
      providerOrder.amount !== expectedPaise ||
      providerOrder.currency !== "INR" ||
      paymentRecord.order_id !== orderId ||
      paymentRecord.amount !== expectedPaise ||
      paymentRecord.currency !== "INR" ||
      !["captured", "authorized"].includes(paymentRecord.status) ||
      (order.capturedPaymentId && order.capturedPaymentId !== paymentId)
    ) {
      return NextResponse.json({ success: false, error: "Captured provider payment does not match this order" }, { status: 400 });
    }

    const ticketId = `TKT-${deterministicId(orderId).slice(0, 28).toUpperCase()}`;
    const registrationId = deterministicId(`registration:${orderId}`);
    const ticketRef = adminDb.collection("tickets").doc(ticketId);
    const registrationRef = adminDb.collection("registrations").doc(registrationId);
    const reservationRef = order.reservationId ? adminDb.collection("reservations").doc(order.reservationId) : null;
    const eventRef = adminDb.collection("events").doc(order.eventId);
    const eventSnap = await eventRef.get();
    if (!eventSnap.exists) return NextResponse.json({ success: false, error: "Event not found" }, { status: 404 });
    const event = eventSnap.data();
    const entitlements = resolveTicketEntitlements(order.ticketConfig);
    let qrPayload;
    try {
      qrPayload = generateSignedQRPayload({
        eventSlug: event.slug || order.eventId,
        ticketId,
        entitledSubEventIds: entitlements.entitledSubEventIds,
      });
    } catch (qrErr) {
      console.warn("[verify-payment] QR signing fallback:", qrErr?.message);
      qrPayload = ticketId;
    }

    let qrCodeUrl;
    try {
      qrCodeUrl = await generateQRCode(qrPayload);
    } catch (qrCodeErr) {
      console.warn("[verify-payment] QR code generation fallback:", qrCodeErr?.message);
      try {
        qrCodeUrl = await generateQRCode(ticketId);
      } catch {
        qrCodeUrl = "";
      }
    }
    const buyer = order.registrationData || {};
    const effectiveUserId = order.userId || caller?.uid || buyer.userId || null;
    const effectiveEmail = String(buyer.email || order.registrationData?.email || caller?.email || "").toLowerCase();
    const effectiveName = buyer.fullName || order.registrationData?.fullName || caller?.decodedToken?.name || "Attendee";
    const effectivePhone = buyer.whatsappPhone || buyer.phone || order.registrationData?.whatsappPhone || "";
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
        userId: effectiveUserId,
        eventId: order.eventId,
        eventTitle: event.title || event.name || "Event",
        eventSlug: event.slug || order.eventId,
        ticketTitle: order.ticketConfig?.title || "Standard Ticket",
        quantity: order.quantity || 1,
        entitledSubEventIds: entitlements.entitledSubEventIds,
        entitledTrackNames: entitlements.entitledTrackNames,
        buyerName: effectiveName,
        buyerEmail: effectiveEmail,
        buyerPhone: effectivePhone,
        amountPaid: order.pricing?.finalPayable || 0,
        pricingBreakdown: order.pricing || null,
        ticketDesign: event.ticketDesign || "stub",
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
        userId: effectiveUserId,
        eventId: order.eventId,
        fullName: effectiveName,
        email: effectiveEmail,
        whatsappPhone: effectivePhone,
        formData: buyer.formData || {},
        status: "Unused",
        paymentStatus: "paid",
        ticketDesign: event.ticketDesign || "stub",
        paymentId,
        entitledSubEventIds: entitlements.entitledSubEventIds,
        qrCode: qrCodeUrl,
        qrPayload,
        createdAt: now,
        updatedAt: now,
      });
      transaction.update(orderRef, { status: "paid", paymentId, ticketId, registrationId, paidAt: now, updatedAt: now });
      if (reservationRef) transaction.update(reservationRef, { status: "finalized", finalizedAt: now, updatedAt: now });
      
      // Increment event allocated seats upon completed paid registration
      const paidQty = Number(order.quantity || 1);
      const currentAllocated = Number(event.allocatedSeats || 0);
      transaction.update(eventRef, {
        allocatedSeats: currentAllocated + paidQty,
        updatedAt: now,
      });
    });

    // 8. Independent Settlement & Double-Entry Financial Ledger
    try {
      const organizerSharePaise = Number(order.organizerSharePaise || (expectedPaise - Math.round(Number(order.pricing?.platformFee || 0) * 100)));
      const platformCommissionPaise = Number(order.platformCommissionPaise || Math.round(Number(order.pricing?.platformFee || 0) * 100));

      // Commit balanced double-entry accounting ledger
      await recordPaymentCaptureLedger({
        transactionId: `tx_pay_${orderId}`,
        orderId,
        bookingId: ticketId,
        eventId: order.eventId,
        organizerId: order.organizerId,
        grossAmountPaise: expectedPaise,
        organizerSharePaise,
        platformCommissionPaise
      });

      // Automatically schedule T+4 working-day settlement record
      await scheduleSettlementForOrder({
        id: orderId,
        paymentId,
        capturedPaymentId: paymentId,
        eventId: order.eventId,
        eventTitle: event.title || event.name || "Event Pass",
        organizerId: order.organizerId,
        amount: expectedPaise,
        platformCommissionPaise,
        organizerSharePaise,
        registrationData: buyer,
        createdAt: now.toDate ? now.toDate().toISOString() : new Date().toISOString()
      }).catch(sErr => console.warn("[verify-payment] Settlement scheduling warning:", sErr.message));

      await orderRef.update({
        paymentStatus: "CAPTURED",
        transferStatus: "NOT_APPLICABLE",
        settlementStatus: "SCHEDULED",
        capturedPaymentId: paymentId,
        updatedAt: Timestamp.now()
      });
    } catch (ledgerErr) {
      console.warn("[verify-payment] Ledger or settlement recording warning:", ledgerErr.message);
    }

    // Award Creator Campus Ambassador Points (P08 / Phase 7 & 8)
    const attribution = order.referralAttribution;
    if (attribution && attribution.ambassadorId && attribution.programId) {
      try {
        await awardPointsForRegistration({
          ambassadorId: attribution.ambassadorId,
          userId: attribution.userId,
          programId: attribution.programId,
          eventId: order.eventId,
          orderId,
          registrationId: ticketId,
          referralCode: attribution.referralCode || order.referralCode,
          isPaid: true,
          ticketCount: Number(order.quantity || 1),
          ticketId: order.ticketConfig?.id || "general",
          ticketType: order.ticketConfig?.title || "Standard Ticket",
          isCombo: Boolean(order.ticketConfig?.tierType === "combo" || order.ticketConfig?.isCombo),
          ticketConfig: order.ticketConfig || null,
        });
      } catch (ptsErr) {
        console.warn("[verify-payment] Points awarding warning:", ptsErr?.message);
      }
    }

    // Automatically trigger ticket delivery confirmation email
    const isFirstTime = Boolean(order.isFirstTimeUser);
    try {
      await sendTicketDeliveryEmail({
        ticketId,
        isFirstTimeUser: isFirstTime,
      });
    } catch (emailErr) {
      console.warn("[verify-payment] Delivery email enqueue warning:", emailErr?.message);
    }

    return NextResponse.json({
      success: true,
      message: "Payment verified and ticket issued",
      ticketId,
      isFirstTimeUser: isFirstTime,
    });
  } catch (error) {
    const status = error.message === "Capacity reservation has expired" ? 409 : 500;
    console.error("[verify-payment] Verification failed:", error.message || error, error.stack);
    return NextResponse.json(
      {
        success: false,
        error: status === 409 ? error.message : (error.message || "Payment could not be verified"),
      },
      { status }
    );
  }
}
