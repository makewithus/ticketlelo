import { NextResponse } from "next/server";
import crypto from "crypto";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * Multi-Tenant Razorpay Payment Verification
 *
 * This API verifies the Razorpay payment signature using the organiser's secret
 *
 * Flow:
 * 1. Get payment details from frontend
 * 2. Fetch event and organiser's Razorpay secret
 * 3. Verify signature using crypto
 * 4. Store payment record in Firestore
 * 5. Return success/failure
 */

export async function POST(request) {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      eventId,
      registrationId,
    } = await request.json();

    console.log("🔐 Verifying payment...");
    console.log("Order ID:", razorpay_order_id);
    console.log("Payment ID:", razorpay_payment_id);

    // 1. Fetch custom form to get Razorpay secret (using client SDK)
    const formsRef = collection(db, "customForms");
    const q = query(formsRef, where("eventId", "==", eventId));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return NextResponse.json(
        { error: "Event configuration not found" },
        { status: 404 },
      );
    }

    const formDoc = querySnapshot.docs[0];
    const customForm = { id: formDoc.id, ...formDoc.data() };

    const { paymentCredentials } = customForm;

    if (!paymentCredentials || !paymentCredentials.razorpayKeySecret) {
      return NextResponse.json(
        { error: "Payment credentials not found" },
        { status: 400 },
      );
    }

    console.log("✅ Razorpay secret retrieved");

    // 2. Verify signature
    const generatedSignature = crypto
      .createHmac("sha256", paymentCredentials.razorpayKeySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      console.log("❌ Signature verification failed");
      return NextResponse.json(
        { error: "Invalid payment signature" },
        { status: 400 },
      );
    }

    console.log("✅ Payment signature verified");

    // 3. Fetch event details (using client SDK)
    const eventDoc = await getDoc(doc(db, "events", eventId));
    const event = { id: eventDoc.id, ...eventDoc.data() };

    // 4. Store payment record
    const paymentData = {
      eventId,
      eventName: event.name,
      registrationId: registrationId || null,
      organiserId: event.organiserId || null,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      amount: customForm.amount,
      currency: "INR",
      status: "success",
      createdAt: serverTimestamp(),
      verifiedAt: serverTimestamp(),
    };

    const paymentRef = await addDoc(collection(db, "payments"), paymentData);
    console.log("✅ Payment record created:", paymentRef.id);

    // 5. Update registration with payment status (using client SDK)
    if (registrationId) {
      await updateDoc(doc(db, "registrations", registrationId), {
        paymentStatus: "paid",
        paymentId: paymentRef.id,
        razorpay_payment_id,
        paidAt: serverTimestamp(),
      });
      console.log("✅ Registration updated with payment status");
    }

    return NextResponse.json({
      success: true,
      message: "Payment verified successfully",
      paymentId: paymentRef.id,
    });
  } catch (error) {
    console.error("❌ Error verifying payment:", error);
    return NextResponse.json(
      { error: error.message || "Payment verification failed" },
      { status: 500 },
    );
  }
}
