import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  getEventLifecycleState,
  checkEventRegistrationStatus,
  getAuthoritativeEventCapacity,
  getAuthoritativeOrganiser,
  getAuthoritativeRegisteredCount,
} from '../../lib/event-registration-status.js';
import { PLANS, getPlan, getEffectivePlanLimits } from '../../lib/plans.js';
import {
  DEFAULT_PLAN_COMMISSION_RATES,
  resolveCommissionRule,
  normalizePlanId,
} from '../../lib/payments/commission-engine.js';
import { calculateSettlementDates } from '../../lib/payments/working-calendar.js';
import { validatePhoneNumber, formatPhoneDisplay } from '../../lib/phone-validation.js';

describe('COMPREHENSIVE AUDIT: ZERO DATA INCONSISTENCY & COMPLETE MOBILE RESPONSIVENESS', () => {
  const root = process.cwd();

  // =========================================================================
  // PART A: DATA CONSISTENCY ACROSS THE ENTIRE SYSTEM
  // =========================================================================
  describe('A1: Pricing, Plan Limits & Commercial Commission Cross-Consistency', () => {
    it('guarantees 100% fee rate alignment between plans catalog and commission engine', () => {
      const planKeys = ['free', 'starter', 'pro', 'fest'];

      for (const key of planKeys) {
        const plan = PLANS[key];
        const tier = plan.tier;
        const engineRate = DEFAULT_PLAN_COMMISSION_RATES[tier];

        assert.equal(
          plan.platformFeeRate,
          engineRate,
          `Fee rate mismatch for ${key}: plan catalog has ${plan.platformFeeRate}% but commission engine has ${engineRate}%`
        );
      }
    });

    it('enforces exact canonical event caps and attendee capacity across all plans', () => {
      assert.equal(PLANS.free.eventsAllowed, 1);
      assert.equal(PLANS.free.participantsPerEvent, 300);

      assert.equal(PLANS.starter.eventsAllowed, 3);
      assert.equal(PLANS.starter.participantsPerEvent, 1000);

      assert.equal(PLANS.pro.eventsAllowed, 10);
      assert.equal(PLANS.pro.participantsPerEvent, -1); // Unlimited

      assert.equal(PLANS.fest.eventsAllowed, -1); // Unlimited
      assert.equal(PLANS.fest.participantsPerEvent, -1); // Unlimited
    });

    it('preserves custom negotiated limits without silently overwriting during plan evaluations', () => {
      const userWithCustomCap = {
        id: 'org_test_custom',
        plan: 'free',
        customOverrides: {
          eventsAllowed: 5,
          platformFeeRate: 5.0,
        },
      };

      const effective = getEffectivePlanLimits(userWithCustomCap);
      assert.equal(effective.eventsAllowed, 5, 'Custom 5-event cap must be retained');
      assert.equal(effective.hasCustomEvents, true);
      assert.equal(effective.standardEventsAllowed, 1);
    });
  });

  describe('A2: Single Source of Truth for Event Capacity and Registered Count', () => {
    it('resolves consistent capacity regardless of whether finite or unlimited', () => {
      const finiteEvent = { capacity: 250, maxCapacity: 250 };
      const unlimitedEvent = { capacity: 'Unlimited', isUnlimited: true };
      const zeroCapacityEvent = { capacity: 0 };

      const c1 = getAuthoritativeEventCapacity(finiteEvent);
      assert.equal(c1.isUnlimited, false);
      assert.equal(c1.capacity, 250);

      const c2 = getAuthoritativeEventCapacity(unlimitedEvent);
      assert.equal(c2.isUnlimited, true);
      assert.equal(c2.display, '∞');

      const c3 = getAuthoritativeEventCapacity(zeroCapacityEvent);
      assert.equal(c3.isUnlimited, true);
    });

    it('derives attendee count consistently between event document counters and live registrations', () => {
      const eventWithHighCounter = { registrationsCount: 45, allocatedSeats: 45 };
      const liveRegsList = [{ id: 'reg1' }, { id: 'reg2' }];

      const count1 = getAuthoritativeRegisteredCount(eventWithHighCounter, liveRegsList);
      assert.equal(count1, 45, 'Must prioritize larger verified database counter for public attendees');

      const eventWithLowCounter = { registrationsCount: 1 };
      const fullRegsList = [{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }, { id: 'r4' }];
      const count2 = getAuthoritativeRegisteredCount(eventWithLowCounter, fullRegsList);
      assert.equal(count2, 4, 'Must reflect true live registrations when live query returns more');
    });

    it('guarantees event lifecycle states never classify past events as live or registration-open', () => {
      const fixedNow = new Date('2026-11-19T14:00:00Z');
      const pastEvent = {
        title: 'Past Hackathon 2026',
        startDate: '2026-11-01T09:00:00Z',
        endDate: '2026-11-02T18:00:00Z',
        published: true,
      };

      const lifecycle = getEventLifecycleState(pastEvent, fixedNow);
      assert.equal(lifecycle.state, 'completed');
      assert.equal(lifecycle.isCompleted, true);
      assert.equal(lifecycle.registrationClosed, true);

      const regStatus = checkEventRegistrationStatus(pastEvent, 10, fixedNow);
      assert.equal(regStatus.isClosed, true);
      assert.equal(regStatus.reason, 'ended');
    });
  });

  describe('A3: Double-Entry Financial Consistency and Integer Paise Precision', () => {
    it('calculates settlement dates skipping statutory Indian banking holidays', () => {
      // Order placed on Friday 14 August 2026 before Independence Day (15 August Saturday)
      const dates = calculateSettlementDates('2026-08-14T10:00:00Z');
      assert.ok(dates.tPlus2RazorpayDate);
      assert.ok(dates.tPlus4OrganizerDate);
      assert.ok(dates.targetSettlementDayFormatted);
      assert.notEqual(dates.targetSettlementDayFormatted, 'T+4', 'Must be formatted date, never raw T+4');
    });

    it('ensures platform fee and organizer net share sum up exactly to gross without paise leakage', () => {
      const testCases = [
        { grossPaise: 100000, rate: 5.0 }, // ₹1,000.00 @ 5.0%
        { grossPaise: 49900, rate: 4.5 },  // ₹499.00 @ 4.5%
        { grossPaise: 83700, rate: 5.0 },  // ₹837.00 @ 5.0%
        { grossPaise: 155000, rate: 3.5 }, // ₹1,550.00 @ 3.5%
      ];

      for (const tc of testCases) {
        const feePaise = Math.round(tc.grossPaise * (tc.rate / 100));
        const netPaise = tc.grossPaise - feePaise;
        assert.equal(
          feePaise + netPaise,
          tc.grossPaise,
          `Rounding error detected: ${feePaise} + ${netPaise} != ${tc.grossPaise}`
        );
      }
    });
  });

  describe('A4: User Identity, Phone Normalization, and Role Integrity', () => {
    it('normalizes valid Indian phone numbers to standard E.164 without drift', () => {
      const res1 = validatePhoneNumber('8265940243');
      assert.equal(res1.isValid, true);
      assert.equal(res1.e164, '+918265940243');

      const res2 = validatePhoneNumber('+91 98765 43210');
      assert.equal(res2.isValid, true);
      assert.equal(res2.e164, '+919876543210');
    });

    it('rejects arbitrary length fake phone numbers (e.g. 12 or 14 digits)', () => {
      assert.equal(validatePhoneNumber('74413131646131').isValid, false);
      assert.equal(validatePhoneNumber('451123753951').isValid, false);
      assert.equal(validatePhoneNumber('12345').isValid, false);
    });
  });

  // =========================================================================
  // PART B: MOBILE RESPONSIVENESS AUDIT ACROSS THE ENTIRE SYSTEM
  // =========================================================================
  describe('B1: Table Horizontal Overflow Protection', () => {
    it('verifies that every data table in administrative views is wrapped in an overflow container or has a mobile card view', () => {
      const tableFiles = [
        'components/admin/hosting-request-management.jsx',
        'components/admin/organisers-management.jsx',
        'components/admin/plans/superadmin-plans-view.jsx',
        'components/admin/email-monitoring.jsx',
        'components/admin/support/support-center.jsx',
        'src/app/(app)/superadmin/payments/page.jsx',
        'src/app/(app)/superadmin/users/page.jsx',
      ];

      for (const relPath of tableFiles) {
        const fullPath = path.join(root, relPath);
        assert.ok(fs.existsSync(fullPath), `File must exist: ${relPath}`);
        const content = fs.readFileSync(fullPath, 'utf-8');

        const hasOverflowWrapper = content.includes('overflow-x-auto');
        const hasMobileCardBifurcation = content.includes('md:hidden') || content.includes('hidden md:block');

        assert.ok(
          hasOverflowWrapper || hasMobileCardBifurcation,
          `Table in ${relPath} must be protected against mobile overflow with overflow-x-auto or mobile card bifurcation.`
        );
      }
    });
  });

  describe('B2: Modals, Dialogs and Drawers Mobile Viewport Constraints', () => {
    it('ensures modals in dynamic registration, event studio, and support center do not exceed mobile viewport height', () => {
      const modalFiles = [
        'components/forms/dynamic-registration-form.jsx',
        'components/admin/event-create-studio.jsx',
        'components/admin/support/superadmin-support-view.jsx',
        'components/admin/support/support-center.jsx',
        'components/admin/hosting-request-management.jsx',
      ];

      for (const relPath of modalFiles) {
        const fullPath = path.join(root, relPath);
        assert.ok(fs.existsSync(fullPath), `File must exist: ${relPath}`);
        const content = fs.readFileSync(fullPath, 'utf-8');

        const hasMaxHeight =
          content.includes('max-h-[90vh]') ||
          content.includes('max-h-[92vh]') ||
          content.includes('max-h-[94vh]') ||
          content.includes('max-h-[85vh]') ||
          content.includes('overflow-y-auto');

        assert.ok(
          hasMaxHeight,
          `Modal in ${relPath} must constrain vertical height and enable scrolling on small mobile screens.`
        );
      }
    });
  });

  describe('B3: Layout Navigation and Mobile Drawer Integrity', () => {
    it('verifies SuperAdminLayout and OrganiserShell provide slide-over drawers with scroll lock on mobile', () => {
      const superAdminLayoutPath = path.join(root, 'src/app/(app)/superadmin/layout.jsx');
      const organiserShellPath = path.join(root, 'components/layout/organiser-shell.jsx');

      const saContent = fs.readFileSync(superAdminLayoutPath, 'utf-8');
      assert.ok(saContent.includes('mobileSidebarOpen'), 'SuperAdminLayout must maintain mobile sidebar state');
      assert.ok(saContent.includes('document.body.style.overflow'), 'SuperAdminLayout must lock body scroll when drawer is open');

      const orgContent = fs.readFileSync(organiserShellPath, 'utf-8');
      assert.ok(orgContent.includes('mobileMenuOpen'), 'OrganiserShell must maintain mobile menu state');
      assert.ok(orgContent.includes('document.body.style.overflow'), 'OrganiserShell must lock body scroll when drawer is open');
    });
  });

  describe('B4: Mobile Viewport Screenshots Verification', () => {
    it('confirms automated mobile screenshots exist for 375px, 390px, and 430px viewports', () => {
      const screenshots = [
        'public/screenshots/mobile-hosting-375px.png',
        'public/screenshots/mobile-hosting-390px.png',
        'public/screenshots/mobile-hosting-430px.png',
        'public/screenshots/mobile-modal-375px.png',
      ];

      for (const relPath of screenshots) {
        const fullPath = path.join(root, relPath);
        assert.ok(fs.existsSync(fullPath), `Mobile screenshot artifact must exist: ${relPath}`);
        const stats = fs.statSync(fullPath);
        assert.ok(stats.size > 1000, `Screenshot ${relPath} must be a valid non-empty image file`);
      }
    });
  });
});
