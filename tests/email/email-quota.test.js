import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { QuotaLedger } from "../../lib/email/quota-ledger.js";
import {
  getNextDailyQuotaReset,
  getNextMonthlyQuotaReset,
} from "../../lib/email/config.js";
import {
  DailyQuotaExhaustedError,
  MonthlyQuotaExhaustedError,
} from "../../lib/email/errors.js";
import { EmailPriority } from "../../lib/email/types.js";

describe("Phase 3 & 8: Atomic Quota Ledger & Safety Margin Engine", () => {
  beforeEach(() => {
    QuotaLedger.resetMemoryLedger();
    process.env.EMAIL_DAILY_LIMIT = "100";
    process.env.EMAIL_MONTHLY_LIMIT = "3000";
    process.env.EMAIL_SAFETY_MARGIN = "5";
  });

  test("calculates accurate UTC midnight reset time", () => {
    // Fixed reference time: 2026-11-01T15:30:00Z
    const ref = new Date("2026-11-01T15:30:00.000Z");
    const nextReset = getNextDailyQuotaReset(ref);

    assert.equal(nextReset.toISOString(), "2026-11-02T00:00:00.000Z");
    assert.equal(nextReset.getUTCHours(), 0);
    assert.equal(nextReset.getUTCMinutes(), 0);
    assert.equal(nextReset.getUTCSeconds(), 0);
  });

  test("calculates accurate UTC monthly reset time", () => {
    const ref = new Date("2026-11-15T10:00:00.000Z");
    const nextMonth = getNextMonthlyQuotaReset(ref);

    assert.equal(nextMonth.toISOString(), "2026-12-01T00:00:00.000Z");
    assert.equal(nextMonth.getUTCDate(), 1);
    assert.equal(nextMonth.getUTCHours(), 0);
  });

  test("atomically reserves quota within daily limit", async () => {
    const fixedNow = new Date("2026-11-01T10:00:00Z");
    const res1 = await QuotaLedger.reserveQuota(EmailPriority.P0, 10, fixedNow);
    assert.equal(res1.dailyUsed, 10);
    assert.equal(res1.dailyRemaining, 90);

    const res2 = await QuotaLedger.reserveQuota(EmailPriority.P1, 5, fixedNow);
    assert.equal(res2.dailyUsed, 15);
    assert.equal(res2.dailyRemaining, 85);
  });

  test("enforces safety margin for lower priority emails", async () => {
    const fixedNow = new Date("2026-11-01T10:00:00Z");
    // Consume 95 of 100 emails. Exactly 5 remaining (= safety margin)
    await QuotaLedger.reserveQuota(EmailPriority.P0, 95, fixedNow);

    // Normal P2 email should be rejected by safety margin
    await assert.rejects(
      async () => await QuotaLedger.reserveQuota(EmailPriority.P2, 1, fixedNow),
      DailyQuotaExhaustedError
    );

    // Promotional P3 email should be rejected by safety margin
    await assert.rejects(
      async () => await QuotaLedger.reserveQuota(EmailPriority.P3, 1, fixedNow),
      DailyQuotaExhaustedError
    );

    // Critical P0 ticket email CAN still consume within the safety margin
    const p0Res = await QuotaLedger.reserveQuota(EmailPriority.P0, 1, fixedNow);
    assert.equal(p0Res.dailyUsed, 96);
    assert.equal(p0Res.dailyRemaining, 4);
  });

  test("throws DailyQuotaExhaustedError when daily limit is exhausted", async () => {
    const fixedNow = new Date("2026-11-01T10:00:00Z");
    // Consume all 100 emails
    await QuotaLedger.reserveQuota(EmailPriority.P0, 100, fixedNow);

    await assert.rejects(
      async () => await QuotaLedger.reserveQuota(EmailPriority.P0, 1, fixedNow),
      (err) => {
        assert.ok(err instanceof DailyQuotaExhaustedError);
        assert.ok(err.nextResetAt instanceof Date);
        assert.equal(err.nextResetAt.toISOString(), "2026-11-02T00:00:00.000Z");
        return true;
      }
    );
  });

  test("releases quota on aborted send", async () => {
    const fixedNow = new Date("2026-11-01T10:00:00Z");
    await QuotaLedger.reserveQuota(EmailPriority.P0, 5, fixedNow);
    assert.equal((await QuotaLedger.getQuotaUsage(fixedNow)).dailyUsed, 5);

    await QuotaLedger.releaseQuota(2, fixedNow);
    assert.equal((await QuotaLedger.getQuotaUsage(fixedNow)).dailyUsed, 3);
  });
});
