import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { configuredPaymentSecret } from "@/lib/payment-security";
import { Timestamp } from "firebase-admin/firestore";
import { calculateOrderPricing } from "@/lib/pricing";
import { reserveTicketCapacity, releaseCapacityReservation } from "@/lib/capacity-reservation";
import { validateCouponCode } from "@/lib/coupons";
import { adminDb, isFirebaseAdminReady } from "@/lib/firebase-admin";
import { getAuthenticatedUser } from "@/lib/auth-server";

/**
 * Server-Authoritative Razorpay Order Creation
 * Computes price server-side, validates coupons, reserves capacity, and creates gateway order (P07, SEC-03, SEC-04).
 */
export async function POST(request) {
  try {
    const caller = await getAuthenticatedUser(request);
    if (!caller) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const {
      eventId,
      ticketId, // comboId or subEventId or "general"
      quantity = 1,
      couponCode = null,
      referralCode = null,
      registrationData = {},
    } = await request.json();

    if (!eventId) {
      return NextResponse.json({ error: "eventId is required." }, { status: 400 });
    }
    if (!adminDb || !isFirebaseAdminReady()) {
      return NextResponse.json({ error: "Checkout service unavailable" }, { status: 503 });
    }
    const safeEmail = String(registrationData.email || "").trim().toLowerCase();
    if (!caller.email || safeEmail !== caller.email.trim().toLowerCase()) {
      return NextResponse.json({ error: "Checkout email must match the signed-in account" }, { status: 403 });
    }

    const qty = Number(quantity);
    if (!Number.isSafeInteger(qty) || qty < 1) {
      return NextResponse.json({ error: "quantity must be a positive integer" }, { status: 400 });
    }
    const keyId = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    const keySecret = configuredPaymentSecret(process.env.RAZORPAY_KEY_SECRET);
    if (!keyId || !keySecret) {
      return NextResponse.json({ error: "Payment checkout is not configured" }, { status: 503 });
    }

    // 1. Fetch Event details
    const eventDoc = await adminDb.collection("events").doc(eventId).get();
    if (!eventDoc.exists()) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    const event = { id: eventDoc.id, ...eventDoc.data() };

    // 2. Resolve Ticket / Combo Configuration & Base Price Server-Side
    let ticketConfig = null;
    let basePrice = Number(event.ticketPrice || event.price || event.amount || 0);

    if (ticketId && ticketId !== "general") {
      // Check if it's a combo / fest pass
      const comboSnap = await adminDb.collection("combos").doc(ticketId).get();
      if (comboSnap.exists && comboSnap.data().parentEventId === eventId && comboSnap.data().isActive !== false) {
        ticketConfig = { id: comboSnap.id, ...comboSnap.data() };
        basePrice = Number(ticketConfig.price || 0);
      } else {
        // Check if it's an individual sub-event
        const subSnap = await adminDb.collection("subEvents").doc(ticketId).get();
        const sub = subSnap.exists ? { id: subSnap.id, ...subSnap.data() } : null;
        if (sub && sub.parentEventId === eventId && sub.isPublished !== false) {
          ticketConfig = {
            id: sub.id,
            title: sub.title,
            subEventId: sub.id,
            price: sub.standalonePrice,
            tierType: "single",
          };
          basePrice = Number(sub.standalonePrice || 0);
        }
      }
    }

    if (!ticketConfig) {
      ticketConfig = {
        id: "general",
        title: event.title || event.name || "General Admission",
        price: basePrice,
        tierType: "single",
      };
    }

    // 3. Coupon Validation Server-Side
    let discountAmount = 0;
    if (couponCode) {
      try {
        const couponResult = await validateCouponCode(couponCode, eventId, basePrice * qty);
        if (couponResult && couponResult.isValid) {
          discountAmount = Number(couponResult.discountAmount || 0);
        }
      } catch (cErr) {
        console.warn("[create-order] Coupon validation error:", cErr.message);
      }
    }

    // 4. Calculate Authoritative Itemized Pricing
    const pricing = calculateOrderPricing({
      basePrice,
      quantity: qty,
      discountAmount,
      isTaxInclusive: true, // Default per PRAROHA specification
    });

    // 5. Atomically Reserve Capacity (prevents overselling during payment attempt)
    let reservation = null;
    try {
      reservation = await reserveTicketCapacity({
        parentEventId: eventId,
        ticketConfig,
        quantity: qty,
        buyerEmail: registrationData.email,
      });
    } catch (capErr) {
      return NextResponse.json(
        { error: capErr.message || "Capacity reservation failed. Ticket may be sold out." },
        { status: 409 }
      );
    }

    // Gateway failures must release the reservation and remain failures.
    let razorpayOrderId;
    try {
      const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
      const rzpOrder = await razorpay.orders.create({
        amount: pricing.finalPayablePaise,
        currency: "INR",
        receipt: `rcpt_${Date.now()}`,
        notes: { eventId, ticketTitle: ticketConfig.title, reservationId: reservation.id },
      });
      razorpayOrderId = rzpOrder.id;
    } catch {
      await releaseCapacityReservation(reservation.id);
      return NextResponse.json({ error: "Payment provider could not create the order" }, { status: 502 });
    }

    // 7. Persist Pending Order Record
    const orderRecord = {
      id: razorpayOrderId,
      eventId,
      ticketConfig,
      quantity: qty,
      pricing,
      reservationId: reservation?.id || null,
      referralCode: referralCode || null,
      registrationData: {
        userId: caller.uid,
        fullName: String(registrationData.fullName || caller.decodedToken?.name || "Attendee").slice(0, 120),
        email: safeEmail,
        whatsappPhone: String(registrationData.whatsappPhone || registrationData.phone || "").slice(0, 32),
        formData: registrationData.formData && typeof registrationData.formData === "object" ? registrationData.formData : {},
      },
      userId: caller.uid,
      status: "pending", // "pending" | "paid" | "failed" | "refunded"
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    await adminDb.collection("orders").doc(razorpayOrderId).create(orderRecord);

    return NextResponse.json({
      success: true,
      orderId: razorpayOrderId,
      razorpayOrderId,
      keyId,
      amount: pricing.finalPayablePaise,
      currency: "INR",
      pricing,
      reservationId: reservation?.id || null,
      ticketTitle: ticketConfig.title,
    });
  } catch (error) {
    console.error("[create-order] Error creating order:", error.message);
    return NextResponse.json(
      { error: error.message || "Failed to create payment order" },
      { status: 500 }
    );
  }
}
