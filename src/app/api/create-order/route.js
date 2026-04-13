import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * Multi-Tenant Razorpay Order Creation
 *
 * This API creates a Razorpay order using the organiser's credentials
 * Each organiser has their own Razorpay account and credentials
 *
 * Flow:
 * 1. Get eventId from request
 * 2. Fetch event details from Firestore
 * 3. Get organiserId from event
 * 4. Fetch organiser's Razorpay credentials from customForms
 * 5. Initialize Razorpay with organiser's credentials
 * 6. Create order with event amount
 * 7. Return order details to frontend
 */

export async function POST(request) {
  try {
    const { eventId, registrationData, finalAmount, couponId } =
      await request.json();

    console.log("📝 Creating Razorpay order for event:", eventId);
    if (finalAmount) {
      console.log("🎫 Coupon applied! Final amount:", finalAmount);
    }

    // 1. Fetch event details (using client SDK)
    const eventDoc = await getDoc(doc(db, "events", eventId));
    if (!eventDoc.exists()) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const event = { id: eventDoc.id, ...eventDoc.data() };
    console.log("✅ Event found:", event.name);

    // 2. Get custom form for this event (contains payment settings)
    let customForm = null;

    // Try to find by eventId query (using client SDK)
    const formsRef = collection(db, "customForms");
    const q = query(formsRef, where("eventId", "==", eventId));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const formDoc = querySnapshot.docs[0];
      customForm = { id: formDoc.id, ...formDoc.data() };
    }

    if (!customForm || !customForm.isPaid) {
      return NextResponse.json(
        { error: "This event is not a paid event" },
        { status: 400 },
      );
    }

    console.log("✅ Custom form found with payment enabled");

    // 3. Get Razorpay credentials from custom form
    const { paymentCredentials, amount } = customForm;

    if (
      !paymentCredentials ||
      !paymentCredentials.razorpayKeyId ||
      !paymentCredentials.razorpayKeySecret
    ) {
      return NextResponse.json(
        { error: "Razorpay credentials not configured for this event" },
        { status: 400 },
      );
    }

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "Invalid event amount" },
        { status: 400 },
      );
    }

    console.log("✅ Razorpay credentials found");
    console.log("💰 Amount:", amount);

    // 4. Initialize Razorpay with organiser's credentials
    const razorpay = new Razorpay({
      key_id: paymentCredentials.razorpayKeyId,
      key_secret: paymentCredentials.razorpayKeySecret,
    });

    console.log("✅ Razorpay instance created");

    // 5. Create order
    // Use finalAmount if coupon applied, otherwise use event amount
    const orderAmount = finalAmount || amount;
    console.log(
      "💰 Order amount:",
      orderAmount,
      finalAmount ? "(with coupon)" : "(original)",
    );

    const order = await razorpay.orders.create({
      amount: Math.round(orderAmount * 100), // Convert to paise
      currency: "INR",
      receipt: `event_${eventId}_${Date.now()}`,
      notes: {
        eventId: eventId,
        eventName: event.name,
        registrantName: registrationData?.fullName || "User",
        registrantEmail: registrationData?.email || "",
      },
    });

    console.log("✅ Razorpay order created:", order.id);

    // 6. Return order details (including key_id for frontend checkout)
    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        razorpayKeyId: paymentCredentials.razorpayKeyId, // Frontend needs this for checkout
      },
      eventDetails: {
        name: event.name,
        amount: amount,
      },
    });
  } catch (error) {
    console.error("❌ Error creating Razorpay order:", error);
    return NextResponse.json(
      {
        error: error.message || "Failed to create order",
        details: error.error?.description || "",
      },
      { status: 500 },
    );
  }
}
