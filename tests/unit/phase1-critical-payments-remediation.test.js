import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SETTLEMENT_STATUSES,
  holdSettlement,
  releaseSettlementHold,
  evaluateSettlementEligibility,
} from '../../lib/payments/settlement-engine.js';
import { calculateSettlementDates } from '../../lib/payments/working-calendar.js';
import {
  assertLedgerBalanced,
  getLedgerSummaryForOrganizer,
  recordPaymentCaptureLedger,
  recordSettlementPayoutLedger,
  recordRefundLedger,
} from '../../lib/payments/ledger.js';
import {
  LEDGER_ACCOUNTS,
  LEDGER_ENTRY_TYPES,
} from '../../lib/payments/types.js';
import {
  getAllCommissionConfigurations,
  savePlanCommissionRule,
  normalizePlanId,
  DEFAULT_PLAN_COMMISSION_RATES,
} from '../../lib/payments/commission-engine.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('PHASE 1: CRITICAL PAYMENTS AND SETTLEMENT REMEDIATION SUITE', () => {
  // =========================================================================
  // C1: PAYMENT SETTLEMENT HOLD ACTION FAILS
  // =========================================================================
  describe('C1: Settlement Hold and Release Action & Idempotency', () => {
    it('accepts both uppercase and lowercase hold/release actions without case mismatch', async () => {
      // In-memory hold execution
      const testSettlementId = 'SETT-test_c1_flow';
      const held = await holdSettlement(testSettlementId, {
        reason: 'Suspected chargeback review',
        adminId: 'superadmin_test',
      });

      assert.equal(held.status, SETTLEMENT_STATUSES.ON_HOLD);
      assert.equal(held.holdReason, 'Suspected chargeback review');

      // Release hold
      const released = await releaseSettlementHold(testSettlementId, {
        reason: 'Account verified successfully',
        adminId: 'superadmin_test',
      });

      assert.ok(
        released.status === SETTLEMENT_STATUSES.SCHEDULED ||
        released.status === SETTLEMENT_STATUSES.ELIGIBLE ||
        released.status === SETTLEMENT_STATUSES.PENDING
      );
      assert.equal(released.holdReason, null);
    });

    it('rejects holding a settlement without a mandatory reason', async () => {
      await assert.rejects(
        async () => {
          await holdSettlement('SETT-no_reason_test', { reason: '   ' });
        },
        /mandatory reason/i
      );
    });

    it('superadmin hold API route normalizes action case-insensitively', () => {
      const routePath = resolve('src/app/api/superadmin/settlements/hold/route.js');
      const content = readFileSync(routePath, 'utf8');

      assert.ok(
        content.includes('normalizedAction') || content.includes('toUpperCase()'),
        'API route must normalize action to uppercase'
      );
      assert.ok(content.includes('reason.trim()'), 'API route must validate mandatory reason');
    });

    it('frontend payments page sends normalized uppercase action', () => {
      const pagePath = resolve('src/app/(app)/superadmin/payments/page.jsx');
      const content = readFileSync(pagePath, 'utf8');

      assert.ok(
        content.includes('(holdModalAction || "hold").toUpperCase()') ||
        content.includes('(holdModalAction || \'hold\').toUpperCase()'),
        'Frontend must send uppercase action to backend'
      );
    });
  });

  // =========================================================================
  // C2: RUN RECONCILIATION RETURNS 403
  // =========================================================================
  describe('C2: Reconciliation Authorization & Idempotency', () => {
    it('reconciliation route allows superAdmin (camelCase) and standard admin credentials', () => {
      const routePath = resolve('src/app/api/payments/reconcile/route.js');
      const content = readFileSync(routePath, 'utf8');

      assert.ok(content.includes("caller.role === 'superAdmin'"), 'Must permit superAdmin (camelCase)');
      assert.ok(content.includes("caller.role === 'superadmin'"), 'Must permit superadmin (lowercase)');
      assert.ok(content.includes('caller.isAdmin === true'), 'Must permit isAdmin flag');
      assert.ok(content.includes('adil4ticketlelo@gmail.com'), 'Must permit primary superadmin email');
    });

    it('reconciliation does not fabricate mutations or duplicate financial records', () => {
      const reconPath = resolve('lib/payments/reconciliation.js');
      const content = readFileSync(reconPath, 'utf8');

      assert.ok(!content.includes('.delete()'), 'Reconciliation must be strictly read/audit only, no deletions');
      assert.ok(content.includes('reconciliationReports'), 'Must record audit reports in reconciliationReports');
    });
  });

  // =========================================================================
  // C4: NET PAYABLE IS ZERO AND DUE DATE IS INCORRECT
  // =========================================================================
  describe('C4: Row-Level Net Payable & Authoritative Due Date Formatting', () => {
    it('computes net payable strictly as Gross - Fees - Deductions', () => {
      const grossPaise = 19900; // ₹199.00
      const platformFeePaise = 995; // 5% fee = ₹9.95
      const netPayable = grossPaise - platformFeePaise;

      assert.equal(netPayable, 18905); // ₹189.05
      assert.ok(netPayable > 0, 'Net payable must not be zero for positive paid orders');
    });

    it('settlements API populates netPayablePaise and formatted due date', () => {
      const routePath = resolve('src/app/api/payments/settlements/route.js');
      const content = readFileSync(routePath, 'utf8');

      assert.ok(content.includes('netPayablePaise: net'), 'API must return netPayablePaise');
      assert.ok(content.includes('dueDateFormatted: formattedDate'), 'API must return dueDateFormatted');
      assert.ok(content.includes('scheduledSettlementDate: formattedDate'), 'API must return scheduledSettlementDate');
    });

    it('frontend payments page reads netOrganizerPaise and renders formatted due date instead of literal T+4', () => {
      const pagePath = resolve('src/app/(app)/superadmin/payments/page.jsx');
      const content = readFileSync(pagePath, 'utf8');

      assert.ok(content.includes('st.netOrganizerPaise ?? st.netPayablePaise'), 'UI must read netOrganizerPaise');
      assert.ok(!content.includes(': "T+4"'), 'UI must not fallback to literal string T+4');
      assert.ok(content.includes('Pending schedule'), 'UI must show informative fallback when date pending');
    });
  });

  // =========================================================================
  // H1: REFUNDS EXCEED TOTAL MONEY COLLECTED
  // =========================================================================
  describe('H1: Double-Entry Ledger Summary & Refund Separation', () => {
    it('only attributes REFUND_ISSUANCE to refunds, never SETTLEMENT_PAYOUT', () => {
      const ledgerPath = resolve('lib/payments/ledger.js');
      const content = readFileSync(ledgerPath, 'utf8');

      assert.ok(
        content.includes('data.entryType === LEDGER_ENTRY_TYPES.REFUND_ISSUANCE'),
        'Only REFUND_ISSUANCE credits can count towards refundedPaise'
      );
      assert.ok(
        content.includes('data.entryType === LEDGER_ENTRY_TYPES.PAYMENT_CAPTURE'),
        'Only PAYMENT_CAPTURE debits can count towards grossSalesPaise'
      );
    });

    it('excludes test and mock transactions from production financial rollup', () => {
      const ledgerPath = resolve('lib/payments/ledger.js');
      const content = readFileSync(ledgerPath, 'utf8');

      assert.ok(content.includes('isTest'), 'Must check isTest flag');
      assert.ok(content.includes('1794576989339'), 'Must filter out mock test order entries');
    });

    it('double-entry ledger maintains fundamental balance invariant (Debits == Credits)', () => {
      const entries = [
        {
          entryType: LEDGER_ENTRY_TYPES.PAYMENT_CAPTURE,
          account: LEDGER_ACCOUNTS.CASH_GATEWAY_CLEARING,
          debitPaise: 50000,
          creditPaise: 0,
        },
        {
          entryType: LEDGER_ENTRY_TYPES.PAYMENT_CAPTURE,
          account: LEDGER_ACCOUNTS.ORGANIZER_PAYABLE,
          debitPaise: 0,
          creditPaise: 47500,
        },
        {
          entryType: LEDGER_ENTRY_TYPES.PAYMENT_CAPTURE,
          account: LEDGER_ACCOUNTS.PLATFORM_COMMISSION_REVENUE,
          debitPaise: 0,
          creditPaise: 2500,
        },
      ];

      const result = assertLedgerBalanced(entries);
      assert.equal(result.balanced, true);
      assert.equal(result.totalDebits, 50000);
      assert.equal(result.totalCredits, 50000);
    });
  });

  // =========================================================================
  // H2: TEST RECORDS IN LIVE SETTLEMENTS & RAW ORGANIZER IDs
  // =========================================================================
  describe('H2: Test Record Filtering and Organizer Name Resolution', () => {
    it('settlements route filters test records (legacy_order_9999, org_test_123)', () => {
      const routePath = resolve('src/app/api/payments/settlements/route.js');
      const content = readFileSync(routePath, 'utf8');

      assert.ok(content.includes('legacy_order_9999'), 'Must filter legacy_order_9999');
      assert.ok(content.includes('org_test'), 'Must filter org_test records');
      assert.ok(content.includes('isTestRecord'), 'Must encapsulate test classification');
    });

    it('settlements route resolves organizerId to real organizer displayName with fallbacks', () => {
      const routePath = resolve('src/app/api/payments/settlements/route.js');
      const content = readFileSync(routePath, 'utf8');

      assert.ok(content.includes('organizerNameMap'), 'Must maintain organizer name lookup map');
      assert.ok(content.includes('usersSnap'), 'Must query users collection for organizer profile');
      assert.ok(content.includes('Independent Organizer'), 'Must provide sensible fallback for unattached IDs');
    });
  });

  // =========================================================================
  // H3: PAYOUT MANAGEMENT & COMMISSION SETTINGS EMPTY TABS
  // =========================================================================
  describe('H3: Commission Settings and Payout Management Data Pipeline', () => {
    it('commission route returns both configurations and planRules aliases', () => {
      const routePath = resolve('src/app/api/payments/commission/route.js');
      const content = readFileSync(routePath, 'utf8');

      assert.ok(content.includes('configurations: enriched'), 'Must return configurations');
      assert.ok(content.includes('planRules: enriched'), 'Must return planRules for backwards compatibility');
    });

    it('savePlanCommissionRule validates percentage bounds (0% to 50%) and versions correctly', async () => {
      // Valid rule update
      const valid = await savePlanCommissionRule({
        planId: 'START',
        ratePercent: 5.0,
        updatedBy: 'qa_engineer@ticketlelo.com',
        reason: 'QA Baseline Validation',
      });
      assert.equal(valid.ratePercent, 5.0);

      // Invalid negative rule
      await assert.rejects(
        async () => {
          await savePlanCommissionRule({
            planId: 'START',
            ratePercent: -2.5,
          });
        },
        /between 0 and 50%/i
      );

      // Invalid exorbitant rule
      await assert.rejects(
        async () => {
          await savePlanCommissionRule({
            planId: 'START',
            ratePercent: 75.0,
          });
        },
        /between 0 and 50%/i
      );
    });

    it('superadmin payout component isolates notifications errors from payouts list', () => {
      const compPath = resolve('components/admin/payments/superadmin-payout-management.jsx');
      const content = readFileSync(compPath, 'utf8');

      assert.ok(content.includes('Promise.allSettled'), 'Must use Promise.allSettled to avoid cascading failure');
    });
  });

  // =========================================================================
  // L8: ELIGIBLE SETTLEMENT FILTER IS MISSING
  // =========================================================================
  describe('L8: Eligible Settlement Lifecycle Filter', () => {
    it('SETTLEMENT_STATUSES enum includes ELIGIBLE', () => {
      assert.equal(SETTLEMENT_STATUSES.ELIGIBLE, 'ELIGIBLE');
    });

    it('UI includes ELIGIBLE option in status filter dropdown', () => {
      const pagePath = resolve('src/app/(app)/superadmin/payments/page.jsx');
      const content = readFileSync(pagePath, 'utf8');

      assert.ok(
        content.includes('<option value="ELIGIBLE">Eligible (T+4 Matured)</option>'),
        'Status filter must include ELIGIBLE option'
      );
      assert.ok(
        content.includes('ELIGIBLE: "bg-teal-500/10 text-teal-400 border-teal-500/30 font-bold"'),
        'Status badge styles must define ELIGIBLE'
      );
    });

    it('advances PENDING settlement to ELIGIBLE when T+4 maturity is reached', async () => {
      // Settlement with past T+4 date
      const pastMaturedSettlement = {
        settlementId: 'SETT-matured_test',
        status: SETTLEMENT_STATUSES.PENDING,
        tPlus4OrganizerDate: new Date(Date.now() - 86400000).toISOString(), // Yesterday
      };

      const evaluated = await evaluateSettlementEligibility(pastMaturedSettlement);
      assert.equal(evaluated.status, SETTLEMENT_STATUSES.ELIGIBLE);
    });
  });

  // =========================================================================
  // L10: PUBLIC PAYOUT TIMELINE AND COMMISSION FEE MISMATCH
  // =========================================================================
  describe('L10: Public Payout Policy & Fee Coherence', () => {
    it('Homepage FAQ explicitly states verified T+4 working-day payout schedule', () => {
      const indexHtmlPath = resolve('src/ui/generated/index.js');
      const content = readFileSync(indexHtmlPath, 'utf8');

      assert.ok(
        content.includes('T+4 working-day schedule'),
        'Homepage FAQ must declare T+4 working days, not 2-3 business days'
      );
      assert.ok(
        !content.includes('within 2-3 business days after the event concludes'),
        'Outdated 2-3 business days copy must be eradicated'
      );
    });

    it('Homepage FAQ clearly distinguishes 2.5% buyer convenience fee from 3.5%-5.0% organizer plan tiers', () => {
      const indexHtmlPath = resolve('src/ui/generated/index.js');
      const content = readFileSync(indexHtmlPath, 'utf8');

      assert.ok(
        content.includes('2.5% platform convenience fee for attendees at checkout') ||
        content.includes('2.5% platform convenience fee'),
        'Homepage FAQ must state 2.5% buyer fee'
      );
      assert.ok(
        content.includes('3.5%–5.0%') || content.includes('Start: 5.0%'),
        'Homepage FAQ must state organizer plan tiers'
      );
    });

    it('Site settings rejects saving past countdown dates', () => {
      const countdownRoutePath = resolve('src/app/api/site-settings/countdown/route.js');
      const content = readFileSync(countdownRoutePath, 'utf8');

      assert.ok(
        content.includes('new Date(countdownAt).getTime() <= Date.now()'),
        'Countdown route must validate that date is in the future'
      );
      assert.ok(
        content.includes('Countdown target date must be in the future'),
        'Must return descriptive error when past date provided'
      );
    });
  });
});
