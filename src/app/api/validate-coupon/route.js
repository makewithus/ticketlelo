import { NextResponse } from "next/server";
import { adminDb, isFirebaseAdminReady } from "@/lib/firebase-admin";

export async function POST(request) {
  try {
    if (!isFirebaseAdminReady() || !adminDb) {
      return NextResponse.json(
        { success: false, error: "Firebase Admin SDK not configured" },
        { status: 503 },
      );
    }

    const { couponCode, eventId, amount } = await request.json();

    if (!couponCode || !eventId) {
      return NextResponse.json(
        { success: false, error: "Missing coupon code or event ID" },
        { status: 400 },
      );
    }

    console.log(`🎫 Validating coupon: ${couponCode} for event: ${eventId}`);

    // Query Firestore for the coupon
    const couponsSnapshot = await adminDb
      .collection("coupons")
      .where("code", "==", couponCode.toUpperCase())
      .where("eventId", "==", eventId)
      .limit(1)
      .get();

    if (couponsSnapshot.empty) {
      console.log("❌ Coupon not found");
      return NextResponse.json({
        valid: false,
        message: "Invalid coupon code",
      });
    }

    const couponDoc = couponsSnapshot.docs[0];
    const coupon = couponDoc.data();

    // Check if coupon is already used
    if (coupon.isUsed) {
      console.log("❌ Coupon already used");
      return NextResponse.json({
        valid: false,
        message: "This coupon code has already been used",
      });
    }

    // Check expiry date
    const validUntil = coupon.validUntil.toDate();
    if (validUntil < new Date()) {
      console.log("❌ Coupon expired");
      return NextResponse.json({
        valid: false,
        message: "This coupon code has expired",
      });
    }

    // Calculate discount
    const discountPercent = coupon.discountPercent;
    const originalAmount = parseFloat(amount) || 0;
    const discountAmount = (originalAmount * discountPercent) / 100;
    const finalAmount = originalAmount - discountAmount;

    console.log(`✅ Coupon valid: ${discountPercent}% off`);
    console.log(`   Original: ₹${originalAmount}`);
    console.log(`   Discount: ₹${discountAmount}`);
    console.log(`   Final: ₹${finalAmount}`);

    return NextResponse.json({
      valid: true,
      message: `Coupon applied! ${discountPercent}% discount`,
      couponId: couponDoc.id,
      discountPercent,
      originalAmount,
      discountAmount,
      finalAmount: Math.round(finalAmount * 100) / 100, // Round to 2 decimals
    });
  } catch (error) {
    console.error("❌ Error validating coupon:", error);
    return NextResponse.json(
      { success: false, error: "Error validating coupon" },
      { status: 500 },
    );
  }
}
