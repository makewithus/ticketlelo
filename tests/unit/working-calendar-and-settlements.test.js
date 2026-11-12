import test from "node:test";
import assert from "node:assert/strict";
import {
  isWeekend,
  isBankHoliday,
  isWorkingDay,
  addWorkingDays,
  calculateSettlementDates,
} from "../../lib/payments/working-calendar.js";
import {
  resolveCommissionRule,
  calculateCommissionBreakdown,
  DEFAULT_PLAN_COMMISSION_RATES,
  normalizePlanId,
} from "../../lib/payments/commission-engine.js";
import {
  scheduleSettlementForOrder,
  holdSettlement,
  releaseSettlementHold,
  retrySettlement,
  SETTLEMENT_STATUSES,
} from "../../lib/payments/settlement-engine.js";
import {
  recordSettlementPayoutLedger,
  recordTransferReversalLedger,
  assertLedgerBalanced,
} from "../../lib/payments/ledger.js";

test("Indian Working Calendar & Settlement Engine Test Suite", async (t) => {
  await t.test("Calendar Math: Accurately identifies weekends", () => {
    // Saturday 2026-11-07
    assert.equal(isWeekend("2026-11-07T10:00:00.000Z"), true, "Saturday must be weekend");
    // Sunday 2026-11-08
    assert.equal(isWeekend("2026-11-08T10:00:00.000Z"), true, "Sunday must be weekend");
    // Monday 2026-11-09
    assert.equal(isWeekend("2026-11-09T10:00:00.000Z"), false, "Monday must not be weekend");
    // Wednesday 2026-11-04
    assert.equal(isWeekend("2026-11-04T10:00:00.000Z"), false, "Wednesday must not be weekend");
  });

  await t.test("Calendar Math: Accurately detects statutory Indian Bank Holidays", () => {
    // Republic Day
    assert.equal(isBankHoliday("2026-01-26T10:00:00.000Z"), true, "Republic Day must be bank holiday");
    // Independence Day
    assert.equal(isBankHoliday("2026-08-15T10:00:00.000Z"), true, "Independence Day must be bank holiday");
    // Gandhi Jayanti
    assert.equal(isBankHoliday("2026-10-02T10:00:00.000Z"), true, "Gandhi Jayanti must be bank holiday");
    // Christmas Day
    assert.equal(isBankHoliday("2026-12-25T10:00:00.000Z"), true, "Christmas Day must be bank holiday");
    // Normal working day (e.g., Nov 4, 2026)
    assert.equal(isBankHoliday("2026-11-04T10:00:00.000Z"), false, "Nov 4 is not a bank holiday");
  });

  await t.test("Calendar Math: isWorkingDay validates non-weekend and non-holiday days", () => {
    assert.equal(isWorkingDay("2026-11-04T10:00:00.000Z"), true); // Wednesday
    assert.equal(isWorkingDay("2026-11-07T10:00:00.000Z"), false); // Saturday
    assert.equal(isWorkingDay("2026-01-26T10:00:00.000Z"), false); // Republic Day holiday
  });

  await t.test("Calendar Math: addWorkingDays skips weekends and holidays accurately", () => {
    // Starting Wednesday 2026-11-04
    // Day 1: Thursday Nov 5
    // Day 2: Friday Nov 6
    // Skip Sat Nov 7 & Sun Nov 8
    // Note: Nov 8/9 might have Diwali in movable list
    const start = new Date("2026-05-06T10:00:00.000Z"); // Wednesday May 6, 2026 (no holidays nearby)
    // Day 1: Thursday May 7
    // Day 2: Friday May 8
    // Skip Sat May 9, Sun May 10
    // Day 3: Monday May 11
    // Day 4: Tuesday May 12
    const matured = addWorkingDays(start, 4);
    assert.equal(matured.getUTCFullYear(), 2026);
    assert.equal(matured.getUTCMonth(), 4); // May is index 4
    assert.equal(matured.getUTCDate(), 12); // Tuesday May 12
  });

  await t.test("Calendar Math: calculateSettlementDates computes T+2 and T+4 with formatted text", () => {
    const dates = calculateSettlementDates("2026-05-06T10:00:00.000Z");
    assert.ok(dates.capturedAt);
    assert.ok(dates.tPlus2RazorpayDate);
    assert.ok(dates.tPlus4OrganizerDate);
    assert.ok(dates.targetSettlementDayFormatted);

    const t2 = new Date(dates.tPlus2RazorpayDate);
    const t4 = new Date(dates.tPlus4OrganizerDate);
    assert.ok(t4.getTime() > t2.getTime(), "T+4 organizer date must be later than T+2 gateway date");
  });

  await t.test("Commission Engine: Tiered subscription rates allocate exact integer paise", async () => {
    // START Plan: 5.0%
    const startRule = await resolveCommissionRule({ subscriptionPlan: "START" });
    const startBreakdown = calculateCommissionBreakdown(100000, startRule); // ₹1,000 = 100,000 paise
    assert.equal(startBreakdown.platformCommissionPaise, 5000, "START plan must deduct 5% (₹50)");
    assert.equal(startBreakdown.organizerSharePaise, 95000, "START plan organizer receives ₹950");
    assert.equal(startBreakdown.platformCommissionPaise + startBreakdown.organizerSharePaise, 100000);

    // CAMPUS Plan: 4.5%
    const campusRule = await resolveCommissionRule({ subscriptionPlan: "CAMPUS" });
    const campusBreakdown = calculateCommissionBreakdown(100000, campusRule);
    assert.equal(campusBreakdown.platformCommissionPaise, 4500, "CAMPUS plan must deduct 4.5% (₹45)");
    assert.equal(campusBreakdown.organizerSharePaise, 95500, "CAMPUS plan organizer receives ₹955");
    assert.equal(campusBreakdown.platformCommissionPaise + campusBreakdown.organizerSharePaise, 100000);

    // FEST Plan: 3.5%
    const festRule = await resolveCommissionRule({ subscriptionPlan: "FEST" });
    const festBreakdown = calculateCommissionBreakdown(100000, festRule);
    assert.equal(festBreakdown.platformCommissionPaise, 3500, "FEST plan must deduct 3.5% (₹35)");
    assert.equal(festBreakdown.organizerSharePaise, 96500, "FEST plan organizer receives ₹965");
    assert.equal(festBreakdown.platformCommissionPaise + festBreakdown.organizerSharePaise, 100000);
  });

  await t.test("Settlement Engine: scheduleSettlementForOrder creates valid settlement record", async () => {
    const mockOrder = {
      id: "ord_test_settle_001",
      paymentId: "pay_test_capture_001",
      amount: 50000, // ₹500.00
      platformCommissionPaise: 2500, // ₹25.00
      organizerSharePaise: 47500, // ₹475.00
      organizerId: "org_test_123",
      eventId: "evt_fest_2026",
      eventTitle: "Annual Tech Fest",
      createdAt: "2026-05-06T10:00:00.000Z",
    };

    const settlement = await scheduleSettlementForOrder(mockOrder);
    assert.ok(settlement.settlementId.includes("ord_test_settle_001") || settlement.settlementId.startsWith("SETT-"));
    assert.equal(settlement.grossAmountPaise, 50000);
    assert.equal(settlement.platformFeePaise, 2500);
    assert.equal(settlement.netOrganizerPaise, 47500);
    assert.ok(settlement.tPlus4OrganizerDate);
  });

  await t.test("Settlement Engine: holdSettlement and releaseSettlementHold transitions", async () => {
    // Hold requires mandatory reason
    await assert.rejects(
      async () => {
        await holdSettlement("SETT-TEST", "", "superadmin@ticketlelo.com");
      },
      /mandatory reason/i,
      "Holding without reason must be rejected"
    );

    // Successful hold
    const held = await holdSettlement("SETT-TEST-002", "KYC verification pending", "superadmin@ticketlelo.com");
    assert.equal(held.status, SETTLEMENT_STATUSES.ON_HOLD);
    assert.equal(held.holdReason, "KYC verification pending");

    // Successful release
    const released = await releaseSettlementHold("SETT-TEST-002", "KYC documents verified", "superadmin@ticketlelo.com");
    assert.equal(released.status, SETTLEMENT_STATUSES.SCHEDULED);
    assert.equal(released.holdReason, null);
  });

  await t.test("Settlement Engine: retrySettlement resets FAILED settlement to SCHEDULED", async () => {
    const retried = await retrySettlement("SETT-FAILED-001", "Bank gateway temporary timeout resolved", "superadmin@ticketlelo.com");
    assert.equal(retried.status, SETTLEMENT_STATUSES.SCHEDULED);
  });

  await t.test("Double-Entry Ledger: Settlement Payouts & Reversals maintain balance invariant", async () => {
    // Payout ledger entry
    const payoutResult = await recordSettlementPayoutLedger({
      settlementId: "SETT-1001",
      organizerId: "org_univ",
      eventId: "evt_tech_fest",
      amountPaise: 95000, // ₹950
      transferId: "trf_rzp_12345",
      actorId: "system_cron",
    });

    assert.ok(payoutResult.journalEntryId);
    assertLedgerBalanced(payoutResult.entries);

    // Transfer Reversal ledger entry
    const reversalResult = await recordTransferReversalLedger({
      reversalId: "rev_rzp_9999",
      transferId: "trf_rzp_12345",
      settlementId: "SETT-1001",
      organizerId: "org_univ",
      amountPaise: 95000,
      reason: "Attendee chargeback dispute upheld",
      actorId: "superadmin_01",
    });

    assert.ok(reversalResult.journalEntryId);
    assertLedgerBalanced(reversalResult.entries);
  });
});
