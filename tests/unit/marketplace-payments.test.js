import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  calculateCommissionBreakdown,
  DEFAULT_COMMISSION_RULE
} from "../../lib/payments/commission-engine.js";
import {
  assertLedgerBalanced
} from "../../lib/payments/ledger.js";
import {
  COMMISSION_TYPES,
  LEDGER_ACCOUNTS,
  LEDGER_ENTRY_TYPES,
  PAYMENT_STATUSES,
  CONNECTED_ACCOUNT_STATUSES
} from "../../lib/payments/types.js";
import { RazorpayRouteProvider } from "../../lib/payments/providers/razorpay-route.js";
import { verifyWebhookSignature } from "../../lib/payments/webhook-processor.js";

test("Marketplace Payments: Commission Engine Integer Paise Calculations", async (t) => {
  await t.test("Standard 3% platform commission allocates exactly ₹30 platform and ₹970 organizer on ₹1,000 gross", () => {
    // ₹1,000 = 100,000 paise
    const result = calculateCommissionBreakdown(100000, {
      version: 1,
      targetType: "global",
      targetId: "platform_default",
      commissionType: COMMISSION_TYPES.PERCENTAGE,
      ratePercent: 3.0,
      fixedFeePaise: 0,
      currency: "INR"
    });

    assert.equal(result.grossAmountPaise, 100000);
    assert.equal(result.platformCommissionPaise, 3000); // ₹30.00
    assert.equal(result.organizerSharePaise, 97000);    // ₹970.00
    assert.equal(result.platformCommissionPaise + result.organizerSharePaise, result.grossAmountPaise);
  });

  await t.test("Fixed fee commission allocates exact flat fee regardless of ticket value", () => {
    const fixedRule = {
      version: 1,
      targetType: "organizer",
      targetId: "org_vip",
      commissionType: COMMISSION_TYPES.FIXED,
      fixedFeePaise: 2500, // ₹25.00 flat per ticket
      currency: "INR"
    };

    const result = calculateCommissionBreakdown(50000, fixedRule); // ₹500 ticket
    assert.equal(result.platformCommissionPaise, 2500);
    assert.equal(result.organizerSharePaise, 47500);
    assert.equal(result.platformCommissionPaise + result.organizerSharePaise, 50000);
  });

  await t.test("Compound commission (percentage + fixed fee) calculates both accurately", () => {
    const compoundRule = {
      version: 2,
      targetType: "global",
      targetId: "compound_tier",
      commissionType: COMMISSION_TYPES.PERCENTAGE_PLUS_FIXED,
      ratePercent: 2.5,   // 2.5%
      fixedFeePaise: 1000, // ₹10.00 fixed
      currency: "INR"
    };

    // ₹2,000 ticket = 200,000 paise
    // 2.5% of 200,000 = 5,000 paise + 1,000 fixed = 6,000 paise (₹60.00)
    const result = calculateCommissionBreakdown(200000, compoundRule);
    assert.equal(result.platformCommissionPaise, 6000);
    assert.equal(result.organizerSharePaise, 194000);
    assert.equal(result.platformCommissionPaise + result.organizerSharePaise, 200000);
  });

  await t.test("Enforces minimum and maximum commission caps strictly", () => {
    const cappedRule = {
      version: 1,
      targetType: "global",
      targetId: "capped_tier",
      commissionType: COMMISSION_TYPES.PERCENTAGE,
      ratePercent: 10.0,
      minCommissionPaise: 5000, // Minimum ₹50
      maxCommissionPaise: 15000 // Maximum ₹150
    };

    // Low amount: 10% of ₹200 (20,000 paise) = 2,000 paise -> Clamped to min 5,000 paise
    const lowResult = calculateCommissionBreakdown(20000, cappedRule);
    assert.equal(lowResult.platformCommissionPaise, 5000);
    assert.equal(lowResult.organizerSharePaise, 15000);

    // High amount: 10% of ₹3,000 (300,000 paise) = 30,000 paise -> Clamped to max 15,000 paise
    const highResult = calculateCommissionBreakdown(300000, cappedRule);
    assert.equal(highResult.platformCommissionPaise, 15000);
    assert.equal(highResult.organizerSharePaise, 285000);
  });

  await t.test("Zero ticket price yields zero commission and zero organizer share", () => {
    const result = calculateCommissionBreakdown(0);
    assert.equal(result.grossAmountPaise, 0);
    assert.equal(result.platformCommissionPaise, 0);
    assert.equal(result.organizerSharePaise, 0);
  });

  await t.test("Rejects negative, non-integer, or floating point amounts", () => {
    assert.throws(() => calculateCommissionBreakdown(-500), TypeError);
    assert.throws(() => calculateCommissionBreakdown(499.50), TypeError);
    assert.throws(() => calculateCommissionBreakdown("100000"), TypeError);
  });
});

test("Marketplace Payments: Double-Entry Financial Ledger Invariants", async (t) => {
  await t.test("Accepts balanced double-entry transaction where Debits equal Credits", () => {
    const balancedEntries = [
      {
        entryType: LEDGER_ENTRY_TYPES.PAYMENT_CAPTURE,
        account: LEDGER_ACCOUNTS.CASH_GATEWAY_CLEARING,
        debitPaise: 100000,
        creditPaise: 0
      },
      {
        entryType: LEDGER_ENTRY_TYPES.PAYMENT_CAPTURE,
        account: LEDGER_ACCOUNTS.ORGANIZER_PAYABLE,
        debitPaise: 0,
        creditPaise: 97000
      },
      {
        entryType: LEDGER_ENTRY_TYPES.PAYMENT_CAPTURE,
        account: LEDGER_ACCOUNTS.PLATFORM_COMMISSION_REVENUE,
        debitPaise: 0,
        creditPaise: 3000
      }
    ];

    const result = assertLedgerBalanced(balancedEntries);
    assert.equal(result.balanced, true);
    assert.equal(result.totalDebits, 100000);
    assert.equal(result.totalCredits, 100000);
  });

  await t.test("Strictly rejects unbalanced transaction where Debits != Credits", () => {
    const unbalancedEntries = [
      {
        entryType: LEDGER_ENTRY_TYPES.PAYMENT_CAPTURE,
        account: LEDGER_ACCOUNTS.CASH_GATEWAY_CLEARING,
        debitPaise: 100000,
        creditPaise: 0
      },
      {
        entryType: LEDGER_ENTRY_TYPES.PAYMENT_CAPTURE,
        account: LEDGER_ACCOUNTS.ORGANIZER_PAYABLE,
        debitPaise: 0,
        creditPaise: 95000 // 2,000 paise unaccounted!
      }
    ];

    assert.throws(() => assertLedgerBalanced(unbalancedEntries), /Unbalanced transaction/);
  });

  await t.test("Rejects empty ledger entries array", () => {
    assert.throws(() => assertLedgerBalanced([]), /Cannot record empty ledger entries/);
  });

  await t.test("Rejects entry with simultaneous debit and credit", () => {
    const invalidEntries = [
      {
        entryType: LEDGER_ENTRY_TYPES.PAYMENT_CAPTURE,
        account: LEDGER_ACCOUNTS.CASH_GATEWAY_CLEARING,
        debitPaise: 100,
        creditPaise: 100
      }
    ];
    assert.throws(() => assertLedgerBalanced(invalidEntries), /cannot have both positive debit and positive credit/);
  });
});

test("Marketplace Payments: Route Provider & Cryptographic Signature Security", async (t) => {
  const testSecret = "test_razorpay_secret_key_abcdef123456";
  const provider = new RazorpayRouteProvider({
    keyId: "rzp_test_12345",
    keySecret: testSecret,
    webhookSecret: "whsec_test_secret_67890"
  });

  await t.test("Verifies valid payment HMAC-SHA256 signature using timingSafeEqual", async () => {
    const orderId = "order_N123456789";
    const paymentId = "pay_P987654321";
    const validSignature = crypto
      .createHmac("sha256", testSecret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    const isValid = await provider.verifyPaymentSignature({
      providerOrderId: orderId,
      providerPaymentId: paymentId,
      signature: validSignature
    });

    assert.equal(isValid, true);
  });

  await t.test("Rejects tampered payment signature", async () => {
    const orderId = "order_N123456789";
    const paymentId = "pay_P987654321";
    const tamperedSignature = "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";

    const isValid = await provider.verifyPaymentSignature({
      providerOrderId: orderId,
      providerPaymentId: paymentId,
      signature: tamperedSignature
    });

    assert.equal(isValid, false);
  });

  await t.test("Maps Razorpay linked account statuses to TicketLelo status enums correctly", () => {
    assert.equal(provider._mapAccountStatus("created"), CONNECTED_ACCOUNT_STATUSES.ONBOARDING_PENDING);
    assert.equal(provider._mapAccountStatus("activated"), CONNECTED_ACCOUNT_STATUSES.ACTIVE);
    assert.equal(provider._mapAccountStatus("under_review"), CONNECTED_ACCOUNT_STATUSES.UNDER_REVIEW);
    assert.equal(provider._mapAccountStatus("restricted"), CONNECTED_ACCOUNT_STATUSES.RESTRICTED);
    assert.equal(provider._mapAccountStatus("suspended"), CONNECTED_ACCOUNT_STATUSES.SUSPENDED);
    assert.equal(provider._mapAccountStatus(null), CONNECTED_ACCOUNT_STATUSES.NOT_CONNECTED);
  });

  await t.test("Verifies Webhook signature correctly and rejects tampered webhook payloads", () => {
    const webhookSecret = "whsec_super_secret_test_key";
    const rawPayload = JSON.stringify({
      event: "transfer.processed",
      id: "evt_123456",
      payload: { transfer: { entity: { id: "trf_123", amount: 97000 } } }
    });

    const validSig = crypto.createHmac("sha256", webhookSecret).update(rawPayload).digest("hex");
    assert.equal(verifyWebhookSignature(rawPayload, validSig, webhookSecret), true);

    const tamperedPayload = rawPayload.replace("97000", "99000");
    assert.equal(verifyWebhookSignature(tamperedPayload, validSig, webhookSecret), false);
  });
});
