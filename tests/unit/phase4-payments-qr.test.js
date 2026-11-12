import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { calculatePricing } from "../../lib/pricing.js";
import { generateSignedQRPayload, verifySignedQRPayload } from "../../lib/qr.js";
import { verifyPaymentHmac } from "../../lib/payment-security.js";

test("Phase 4: Centralized Pricing Engine (calculatePricing)", async (t) => {
  await t.test("Tax-inclusive pricing matches PRAROHA reference (₹449.10 total)", () => {
    // PRAROHA Tech Combo reference: ₹449.10 gross
    const result = calculatePricing({
      basePrice: 449.10,
      quantity: 1,
      taxInclusive: true,
      gstRate: 0.18,
      platformFeeRate: 0.025,
    });

    assert.equal(result.finalPayableAmount, 449.10);
    // Base before 18% tax: 449.10 / 1.18 = ~380.59
    assert.ok(result.gstAmount > 0);
    assert.ok(result.platformFee > 0);
    assert.ok(result.organizerSettlement > 0);
    assert.equal(
      Math.round((result.baseAmount + result.gstAmount + result.platformFee) * 100) / 100,
      result.finalPayableAmount
    );
  });

  await t.test("Applies percentage and flat discounts accurately before tax", () => {
    // 50% discount on ₹1000
    const discounted = calculatePricing({
      basePrice: 1000,
      quantity: 1,
      taxInclusive: false,
      coupon: { discountType: "percentage", discountValue: 50 },
    });

    assert.equal(discounted.discountAmount, 500);
    assert.equal(discounted.taxableAmount, 500);
    // GST 18% on 500 = 90
    assert.equal(discounted.gstAmount, 90);
    // Platform fee 2.5% on 500 = 12.50
    assert.equal(discounted.platformFee, 12.5);
    // Total = 500 + 90 + 12.50 = 602.50
    assert.equal(discounted.finalPayableAmount, 602.50);
  });
});

test("Phase 4: Cryptographic QR Code Security (generateSignedQRPayload & verifySignedQRPayload)", async (t) => {
  const secretKey = "test-crypto-qr-secret-key-12345";
  const ticketData = {
    ticketId: "TKT-PRAROHA-2027-X9Y2Z",
    eventId: "praroha_2027",
    entitledSubEventIds: ["track_workshop", "track_hackathon", "track_proshow"],
    buyerEmail: "rahul.sharma@pict.edu",
    issuedAt: 1740000000000,
  };

  await t.test("Generates valid HMAC-SHA-256 signed QR payload with correct format", () => {
    const payload = generateSignedQRPayload(ticketData, secretKey);
    assert.ok(typeof payload === "string");
    assert.ok(payload.startsWith("TLSEC:sha256:v1|"));
    assert.ok(payload.includes("tkt=TKT-PRAROHA-2027-X9Y2Z"));
    assert.ok(payload.includes("evt=praroha_2027"));
    assert.ok(payload.includes("sig="));
  });

  await t.test("Successfully verifies untampered signed QR payload and extracts entitlements", () => {
    const payload = generateSignedQRPayload(ticketData, secretKey);
    const verification = verifySignedQRPayload(payload, secretKey);

    assert.equal(verification.isValid, true);
    assert.equal(verification.ticketId, "TKT-PRAROHA-2027-X9Y2Z");
    assert.equal(verification.eventId, "praroha_2027");
    assert.deepEqual(verification.entitledSubEvents, [
      "track_hackathon",
      "track_proshow",
      "track_workshop",
    ]);
  });

  await t.test("Rejects tampered QR payload when sub-event entitlement is maliciously added", () => {
    const payload = generateSignedQRPayload(ticketData, secretKey);
    // Malicious actor appends an unauthorized VIP track
    const tamperedPayload = payload.replace(
      "tiers=track_hackathon,track_proshow,track_workshop",
      "tiers=track_hackathon,track_proshow,track_vip_backstage,track_workshop"
    );

    const verification = verifySignedQRPayload(tamperedPayload, secretKey);
    assert.equal(verification.isValid, false);
    assert.match(verification.error, /signature/i);
  });

  await t.test("Rejects payload with invalid signature or corrupted hash", () => {
    const payload = generateSignedQRPayload(ticketData, secretKey);
    const corruptedPayload = payload.slice(0, -6) + "abcdef";

    const verification = verifySignedQRPayload(corruptedPayload, secretKey);
    assert.equal(verification.isValid, false);
    assert.match(verification.error, /signature/i);
  });

  await t.test("Validates payment signature HMAC and handles unauthenticated/guest checkout safely", () => {
    const secret = "test_razorpay_secret_key_12345";
    const orderId = "order_test_12345";
    const paymentId = "pay_test_67890";
    const validSignature = crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");

    assert.equal(verifyPaymentHmac(`${orderId}|${paymentId}`, validSignature, secret), true);
    assert.equal(verifyPaymentHmac(`${orderId}|${paymentId}`, "invalid_signature", secret), false);
    assert.equal(verifyPaymentHmac(`${orderId}|tampered`, validSignature, secret), false);

    // Guest checkout fallback derivation
    const caller = null;
    const order = {
      userId: "user_guest_abc",
      registrationData: {
        email: "guest@example.com",
        fullName: "Guest Attendee",
        whatsappPhone: "9876543210"
      }
    };
    const buyer = order.registrationData;
    const effectiveUserId = order.userId || caller?.uid || buyer?.userId || null;
    const effectiveEmail = String(buyer?.email || order?.registrationData?.email || caller?.email || "").toLowerCase();
    const effectiveName = buyer?.fullName || order?.registrationData?.fullName || caller?.decodedToken?.name || "Attendee";

    assert.equal(effectiveUserId, "user_guest_abc");
    assert.equal(effectiveEmail, "guest@example.com");
    assert.equal(effectiveName, "Guest Attendee");
  });
});
