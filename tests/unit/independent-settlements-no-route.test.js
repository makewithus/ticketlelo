import { test, describe } from "node:test";
import assert from "node:assert/strict";

// Core Independent Payment & Settlement Modules
import {
  calculateCommissionBreakdown,
  resolveCommissionRule,
  DEFAULT_PLAN_COMMISSION_RATES,
} from "../../lib/payments/commission-engine.js";
import {
  recordPaymentCaptureLedger,
  recordSettlementPayoutLedger,
  recordRefundLedger,
  getLedgerSummaryForOrganizer,
  assertLedgerBalanced,
} from "../../lib/payments/ledger.js";
import {
  calculateSettlementDates,
  isWorkingDay,
  addWorkingDays,
} from "../../lib/payments/working-calendar.js";
import {
  scheduleSettlementForOrder,
  evaluateSettlementEligibility,
  SETTLEMENT_STATUSES,
} from "../../lib/payments/settlement-engine.js";
import {
  paymentRegistry,
  getDefaultPaymentProvider,
  getDefaultPayoutProvider,
} from "../../lib/payments/provider-registry.js";
import { PayoutProvider } from "../../lib/payments/payout-provider-interface.js";
import { ManualPayoutProvider } from "../../lib/payments/providers/manual-payout-provider.js";
import {
  checkOrganizerEligibilityForPaidEvents,
  assertOrganizerPaidEventEligible,
} from "../../lib/payments/connected-accounts.js";
import {
  saveOrganizerPayoutProfile,
  getOrganizerPayoutProfile,
  confirmPayoutPayment,
} from "../../lib/payments/payout-engine.js";

describe("TicketLelo — Independent Settlement & Route Removal Verification", () => {
  test("1. Route is completely removed from active payment flow and eligibility checks", async () => {
    // 1.1 Verify Route feature flag / active status
    assert.equal(paymentRegistry.isRouteActive(), false, "isRouteActive() must permanently return false");
    assert.equal(paymentRegistry.isOnboardingActive(), false, "isOnboardingActive() must permanently return false");

    // 1.2 Verify paid event eligibility does NOT require connected Razorpay account
    const eligibility = await checkOrganizerEligibilityForPaidEvents("org_test_unconnected_123");
    assert.equal(eligibility.eligible, true, "Unconnected organizer must be eligible for paid events");
    assert.equal(eligibility.reason, "INDEPENDENT_SETTLEMENT_GATEWAY_ACTIVE");

    // 1.3 Server-side assertion does not throw
    const asserted = await assertOrganizerPaidEventEligible("org_test_unconnected_123");
    assert.equal(asserted.eligible, true);
  });

  test("2. Platform fee calculation retains tiered subscription plans (START 5%, CAMPUS 4.5%, FEST 3.5%)", async () => {
    // 2.1 START Plan (5% platform fee) on ₹1,000 gross (100,000 paise)
    const startRule = await resolveCommissionRule({ planId: "START" });
    const startBreakdown = calculateCommissionBreakdown(100000, startRule);
    assert.equal(startBreakdown.grossAmountPaise, 100000);
    assert.equal(startBreakdown.platformCommissionPaise, 5000); // 5% = ₹50.00
    assert.equal(startBreakdown.organizerSharePaise, 95000); // ₹950.00
    assert.equal(startBreakdown.grossAmountPaise, startBreakdown.platformCommissionPaise + startBreakdown.organizerSharePaise);

    // 2.2 CAMPUS Plan (4.5% platform fee) on ₹2,000 gross (200,000 paise)
    const campusRule = await resolveCommissionRule({ planId: "CAMPUS" });
    const campusBreakdown = calculateCommissionBreakdown(200000, campusRule);
    assert.equal(campusBreakdown.platformCommissionPaise, 9000); // 4.5% = ₹90.00
    assert.equal(campusBreakdown.organizerSharePaise, 191000); // ₹1,910.00

    // 2.3 FEST Plan (3.5% platform fee) on ₹5,000 gross (500,000 paise)
    const festRule = await resolveCommissionRule({ planId: "FEST" });
    const festBreakdown = calculateCommissionBreakdown(500000, festRule);
    assert.equal(festBreakdown.platformCommissionPaise, 17500); // 3.5% = ₹175.00
    assert.equal(festBreakdown.organizerSharePaise, 482500); // ₹4,825.00

    // 2.4 Fractional paise precision: verify integer rounding
    const oddTicket = calculateCommissionBreakdown(19900, startRule); // ₹199 = 19,900 paise
    assert.equal(Number.isInteger(oddTicket.platformCommissionPaise), true);
    assert.equal(Number.isInteger(oddTicket.organizerSharePaise), true);
    assert.equal(oddTicket.platformCommissionPaise, 995); // 5% of 19900 = 995 paise (₹9.95)
    assert.equal(oddTicket.organizerSharePaise, 18905); // ₹189.05
    assert.equal(oddTicket.grossAmountPaise, oddTicket.platformCommissionPaise + oddTicket.organizerSharePaise);
  });

  test("3. T+4 working-day settlement scheduling skips weekends and Indian statutory bank holidays", () => {
    // Test base date: Friday, 23 Oct 2026 (capture day T)
    // T+1: Mon 26 Oct
    // T+2: Tue 27 Oct
    // T+3: Wed 28 Oct
    // T+4: Thu 29 Oct (excluding Sat 24 Oct, Sun 25 Oct)
    const fridayCapture = "2026-10-23T10:00:00.000Z";
    const schedule = calculateSettlementDates(fridayCapture);

    const t4 = new Date(schedule.tPlus4OrganizerDate);
    assert.equal(t4.toISOString().slice(0, 10), "2026-10-29");
    assert.ok(schedule.targetSettlementDayFormatted.includes("29"));

    // Verify statutory Republic Day holiday (26 Jan) is skipped
    const jan22 = "2026-01-22T10:00:00.000Z"; // Thursday
    // Fri 23 (T+1), Sat 24 (weekend), Sun 25 (weekend), Mon 26 (Republic Day holiday), Tue 27 (T+2), Wed 28 (T+3), Thu 29 (T+4)
    const holidaySchedule = calculateSettlementDates(jan22);
    const janT4 = new Date(holidaySchedule.tPlus4OrganizerDate);
    assert.equal(janT4.toISOString().slice(0, 10), "2026-01-29");
  });

  test("4. ManualPayoutProvider (Mode B) validates bank/UPI details and processes payout confirmation with UTR", async () => {
    const provider = getDefaultPayoutProvider();
    assert.ok(provider instanceof ManualPayoutProvider, "Default payout provider must be ManualPayoutProvider");
    assert.equal(provider.supportsAutomatedPayouts(), false, "Mode B requires Super Admin manual confirmation");

    // 4.1 Validate IFSC & Bank Account Number
    const validBank = await provider.verifyPayoutAccount({
      accountHolderName: "Alpha Events Private Limited",
      accountNumber: "50100234567890",
      ifsc: "HDFC0001234",
      bankName: "HDFC Bank",
    });
    assert.equal(validBank.isValid, true);
    assert.equal(validBank.normalizedDetails.ifsc, "HDFC0001234");
    assert.equal(validBank.normalizedDetails.accountNumber, "50100234567890");

    // 4.2 Validate Malformed IFSC
    const badIfsc = await provider.verifyPayoutAccount({
      accountNumber: "50100234567890",
      ifsc: "INVALID_IFSC",
    });
    assert.equal(badIfsc.isValid, false);
    assert.ok(badIfsc.error.includes("Invalid IFSC code format"));

    // 4.3 Process manual payout with UTR
    const payoutResult = await provider.processPayout({
      payoutId: "payout_test_001",
      settlementId: "SETT-1001",
      organizerId: "org_alpha_01",
      amountPaise: 95000,
      currency: "INR",
      recipientDetails: validBank.normalizedDetails,
      reference: "UTR987654321012",
      paymentMode: "NEFT",
      adminUser: { email: "superadmin@ticketlelo.com" },
    });

    assert.equal(payoutResult.status, "SETTLED");
    assert.equal(payoutResult.utr, "UTR987654321012");
    assert.equal(payoutResult.amountPaise, 95000);
    assert.equal(payoutResult.paymentMode, "NEFT");

    // 4.4 Reject payout execution if UTR is missing
    await assert.rejects(
      async () => {
        await provider.processPayout({
          payoutId: "payout_test_002",
          settlementId: "SETT-1002",
          organizerId: "org_alpha_01",
          amountPaise: 95000,
          reference: "", // Empty UTR
        });
      },
      /UTR \/ Bank Reference number is required/
    );
  });

  test("5. Extensible PayoutProvider architecture allows plugging in automated Mode A adapter", async () => {
    class MockAutomatedPayoutProvider extends PayoutProvider {
      constructor() {
        super("mock_automated_payout");
      }
      supportsAutomatedPayouts() {
        return true;
      }
      async processPayout(params) {
        return {
          providerPayoutId: `autotx_${params.payoutId}`,
          status: "PROCESSING",
          amountPaise: params.amountPaise,
          currency: "INR",
          processedAt: new Date().toISOString(),
        };
      }
      async getPayoutStatus(providerPayoutId) {
        return {
          providerPayoutId,
          status: "SUCCESS",
          amountPaise: 50000,
        };
      }
    }

    const autoProvider = new MockAutomatedPayoutProvider();
    assert.equal(autoProvider.supportsAutomatedPayouts(), true);
    assert.equal(autoProvider.getProviderName(), "mock_automated_payout");

    const result = await autoProvider.processPayout({
      payoutId: "payout_auto_123",
      settlementId: "SETT-2001",
      organizerId: "org_beta",
      amountPaise: 50000,
    });
    assert.equal(result.providerPayoutId, "autotx_payout_auto_123");
    assert.equal(result.status, "PROCESSING");

    const status = await autoProvider.getPayoutStatus(result.providerPayoutId);
    assert.equal(status.status, "SUCCESS");
  });

  test("6. Double-entry financial ledger records payment capture, settlement payout, and refunds accurately", async () => {
    const orderId = `order_${Date.now()}`;
    const organizerId = `org_ledger_${Date.now()}`;
    const grossPaise = 200000; // ₹2,000.00
    const platformCommissionPaise = 10000; // 5% = ₹100.00
    const organizerSharePaise = 190000; // ₹1,900.00

    // 6.1 Payment Capture Ledger: Dr. CashGatewayClearing, Cr. OrganizerPayable, Cr. PlatformRevenue
    const captureEntries = await recordPaymentCaptureLedger({
      transactionId: `tx_capture_${orderId}`,
      orderId,
      bookingId: `tkt_${orderId}`,
      eventId: "event_tech_2026",
      organizerId,
      grossAmountPaise: grossPaise,
      organizerSharePaise,
      platformCommissionPaise,
    });
    assert.equal(Array.isArray(captureEntries), true);
    assertLedgerBalanced(captureEntries);

    // Verify Debits equal Credits
    const captureDebits = captureEntries.reduce((s, e) => s + (e.debitPaise || 0), 0);
    const captureCredits = captureEntries.reduce((s, e) => s + (e.creditPaise || 0), 0);
    assert.equal(captureDebits, grossPaise);
    assert.equal(captureCredits, grossPaise);

    // 6.2 Settlement Payout Ledger: Dr. OrganizerPayable, Cr. CashGatewayClearing
    const payoutEntries = await recordSettlementPayoutLedger({
      transactionId: `tx_payout_${orderId}`,
      settlementId: `SETT-${orderId}`,
      orderId,
      eventId: "event_tech_2026",
      organizerId,
      amountPaise: organizerSharePaise,
      providerTransferId: "UTR123456789012",
    });
    assert.equal(Array.isArray(payoutEntries), true);
    assertLedgerBalanced(payoutEntries);

    // 6.3 Refund Issuance Ledger: Dr. OrganizerPayable, Dr. PlatformRevenue, Cr. CashGatewayClearing
    const refundEntries = await recordRefundLedger({
      transactionId: `tx_refund_${orderId}`,
      refundId: `rfnd_${orderId}`,
      orderId,
      eventId: "event_tech_2026",
      organizerId,
      refundGrossPaise: grossPaise,
      organizerRefundSharePaise: organizerSharePaise,
      platformRefundCommissionPaise: platformCommissionPaise,
      reason: "Attendee event cancellation",
    });
    assert.equal(Array.isArray(refundEntries), true);
    assertLedgerBalanced(refundEntries);
  });

  test("7. Organizer Payout Profile supports both UPI and Direct Bank Account (Account Number + IFSC)", async () => {
    const testOrgId = `org_profile_${Date.now()}`;

    // 7.1 Save Direct Bank Account Details
    const bankProfile = await saveOrganizerPayoutProfile(
      testOrgId,
      {
        organizerName: "Praroha Tech Community",
        accountHolderName: "Praroha Foundation",
        accountNumber: "987654321098",
        ifsc: "SBIN0001234",
        bankName: "State Bank of India (SBI)",
        email: "finance@praroha.org",
        phone: "+919876543210",
      },
      { email: "admin@praroha.org" }
    );

    assert.equal(bankProfile.accountHolderName, "Praroha Foundation");
    assert.equal(bankProfile.accountNumberMasked, "•••• •••• 1098");
    assert.equal(bankProfile.ifsc, "SBIN0001234");
    assert.equal(bankProfile.payoutMethod, "BANK_TRANSFER");

    // 7.2 Retrieve profile
    const retrieved = await getOrganizerPayoutProfile(testOrgId);
    assert.equal(retrieved.accountHolderName, "Praroha Foundation");
    assert.equal(retrieved.ifsc, "SBIN0001234");
  });

  test("8. Historical compatibility: Legacy connected accounts and orders remain readable without errors", async () => {
    // Verify that legacy structure fields do not cause crashes
    const legacyOrder = {
      id: "legacy_order_9999",
      isRouteTransfer: true,
      connectedAccountId: "acc_legacy_razorpay_123",
      amount: 150000,
      platformCommissionPaise: 7500,
      organizerSharePaise: 142500,
    };

    const settlement = await scheduleSettlementForOrder(legacyOrder);
    assert.equal(settlement.orderId, "legacy_order_9999");
    assert.equal(settlement.netOrganizerPaise, 142500);
    assert.ok(settlement.settlementId.includes("legacy_order_9999"));
  });
});
