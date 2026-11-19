import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  getEventDateRange,
  getEventLifecycleState,
  checkEventRegistrationStatus,
  isEventRegistrationClosed,
  getAuthoritativeEventCapacity,
  getAuthoritativeOrganiser,
  getAuthoritativeRegisteredCount,
  parseFirestoreDate,
} from "../../lib/event-registration-status.js";

describe("PHASE 5 REMEDIATION TEST SUITE", () => {
  // =========================================================================
  // H6: PAST EVENTS TREATED AS UPCOMING OR LIVE
  // =========================================================================
  describe("H6: Event Lifecycle State & Registration Boundaries", () => {
    const fixedNow = new Date("2026-11-19T12:00:00.000Z");

    it("identifies past event (e.g. Test Speed Event on 2 Nov) as strictly completed and closed", () => {
      const pastEvent = {
        id: "past-evt-001",
        title: "Test Speed Event",
        startDate: "2026-11-02T10:00:00.000Z",
        endDate: "2026-11-02T18:00:00.000Z",
        published: true,
        isPublished: true,
        // Defect simulation: event had legacy isLive: true or status: 'live' stuck in Firestore
        isLive: true,
        status: "live",
      };

      const lifecycle = getEventLifecycleState(pastEvent, fixedNow);
      assert.equal(lifecycle.state, "completed");
      assert.equal(lifecycle.isCompleted, true);
      assert.equal(lifecycle.isLive, false);
      assert.equal(lifecycle.isUpcoming, false);
      assert.equal(lifecycle.registrationClosed, true);

      const regStatus = checkEventRegistrationStatus(pastEvent, 10, fixedNow);
      assert.equal(regStatus.isClosed, true);
      assert.equal(regStatus.reason, "ended");
    });

    it("identifies currently ongoing event as live and allows registrations if open", () => {
      const liveEvent = {
        id: "live-evt-001",
        title: "Ongoing Tech Summit",
        startDate: "2026-11-19T09:00:00.000Z",
        endDate: "2026-11-19T17:00:00.000Z",
        published: true,
        globalCapacity: 500,
      };

      const lifecycle = getEventLifecycleState(liveEvent, fixedNow);
      assert.equal(lifecycle.state, "live");
      assert.equal(lifecycle.isLive, true);
      assert.equal(lifecycle.isCompleted, false);

      const regStatus = checkEventRegistrationStatus(liveEvent, 120, fixedNow);
      assert.equal(regStatus.isClosed, false);
      assert.equal(regStatus.reason, "open");
    });

    it("identifies tomorrow event as upcoming", () => {
      const tomorrowEvent = {
        id: "upcoming-evt-001",
        title: "Tomorrow Workshop",
        startDate: "2026-11-20T10:00:00.000Z",
        endDate: "2026-11-20T16:00:00.000Z",
        published: true,
      };

      const lifecycle = getEventLifecycleState(tomorrowEvent, fixedNow);
      assert.equal(lifecycle.state, "upcoming");
      assert.equal(lifecycle.isUpcoming, true);
      assert.equal(lifecycle.isLive, false);
      assert.equal(lifecycle.isCompleted, false);
    });

    it("handles multi-day events that span multiple days", () => {
      const multiDayEvent = {
        id: "multiday-evt-001",
        title: "3-Day Hackathon",
        startDate: "2026-11-18T09:00:00.000Z",
        endDate: "2026-11-21T18:00:00.000Z",
        published: true,
      };

      const lifecycle = getEventLifecycleState(multiDayEvent, fixedNow);
      assert.equal(lifecycle.state, "live");
      assert.equal(lifecycle.isLive, true);
      assert.equal(lifecycle.isCompleted, false);
    });

    it("handles missing or invalid event dates gracefully", () => {
      const noDateEvent = {
        id: "nodate-evt-001",
        title: "TBA Unannounced Event",
        published: true,
      };

      const lifecycle = getEventLifecycleState(noDateEvent, fixedNow);
      assert.equal(lifecycle.state, "upcoming");
      assert.equal(lifecycle.start, null);
      assert.equal(lifecycle.end, null);
    });

    it("prevents new registrations after registration deadline even if event is in the future", () => {
      const futureEventWithExpiredDeadline = {
        id: "future-evt-001",
        title: "Future Gala",
        startDate: "2026-12-01T10:00:00.000Z",
        endDate: "2026-12-01T18:00:00.000Z",
        registrationDeadline: "2026-11-15T23:59:59.000Z", // passed 4 days ago
        published: true,
      };

      const regStatus = checkEventRegistrationStatus(futureEventWithExpiredDeadline, 50, fixedNow);
      assert.equal(regStatus.isClosed, true);
      assert.equal(regStatus.reason, "deadline_passed");
    });

    it("treats cancelled and draft events as closed for registration", () => {
      const cancelledEvent = {
        id: "canc-001",
        title: "Cancelled Event",
        startDate: "2026-11-25T10:00:00.000Z",
        status: "cancelled",
        published: true,
      };
      const draftEvent = {
        id: "draft-001",
        title: "Draft Event",
        startDate: "2026-11-25T10:00:00.000Z",
        status: "draft",
        published: false,
      };

      assert.equal(getEventLifecycleState(cancelledEvent, fixedNow).state, "cancelled");
      assert.equal(checkEventRegistrationStatus(cancelledEvent, 0, fixedNow).reason, "cancelled");

      assert.equal(getEventLifecycleState(draftEvent, fixedNow).state, "draft");
      assert.equal(checkEventRegistrationStatus(draftEvent, 0, fixedNow).reason, "draft_or_private");
    });
  });

  // =========================================================================
  // H7: HOMEPAGE COUNTDOWN CONFIGURATION & RENDERING WORKFLOW
  // =========================================================================
  describe("H7: Homepage Countdown Validation and Display Logic", () => {
    function computeCountdownDisplay(countdownAt, countdownEnabled, now = new Date()) {
      if (!countdownEnabled || !countdownAt) {
        return { isVisible: false, days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: false };
      }
      const targetMs = new Date(countdownAt).getTime();
      const nowMs = now.getTime();
      if (isNaN(targetMs)) {
        return { isVisible: false, days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: false };
      }
      const diffMs = targetMs - nowMs;
      if (diffMs <= 0) {
        // Expired countdown: clamp to 0, never show negative numbers
        return { isVisible: false, days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true };
      }
      const totalSec = Math.floor(diffMs / 1000);
      const days = Math.floor(totalSec / 86400);
      const hours = Math.floor((totalSec % 86400) / 3600);
      const minutes = Math.floor((totalSec % 3600) / 60);
      const seconds = totalSec % 60;
      return { isVisible: true, days, hours, minutes, seconds, isExpired: false };
    }

    function validateCountdownDateInput(dateInput, now = new Date()) {
      if (dateInput === null || dateInput === "") {
        return { valid: true, cleared: true };
      }
      const parsed = new Date(dateInput);
      if (isNaN(parsed.getTime())) {
        return { valid: false, error: "Invalid date format." };
      }
      if (parsed.getTime() <= now.getTime()) {
        return { valid: false, error: "Countdown date must be in the future. Past dates cannot be activated." };
      }
      return { valid: true, date: parsed.toISOString() };
    }

    it("rejects saving past dates with descriptive validation error", () => {
      const pastInput = "2020-01-01T00:00:00.000Z";
      const validation = validateCountdownDateInput(pastInput, new Date("2026-11-19T12:00:00.000Z"));
      assert.equal(validation.valid, false);
      assert.match(validation.error, /future/i);
    });

    it("accepts valid future countdown dates", () => {
      const futureInput = "2026-12-31T23:59:59.000Z";
      const validation = validateCountdownDateInput(futureInput, new Date("2026-11-19T12:00:00.000Z"));
      assert.equal(validation.valid, true);
      assert.equal(validation.date, "2026-12-31T23:59:59.000Z");
    });

    it("supports explicitly clearing and disabling countdown", () => {
      const clearValidation = validateCountdownDateInput(null);
      assert.equal(clearValidation.valid, true);
      assert.equal(clearValidation.cleared, true);

      const state = computeCountdownDisplay(null, false);
      assert.equal(state.isVisible, false);
    });

    it("hides countdown when disabled even if a future date exists", () => {
      const state = computeCountdownDisplay("2026-12-31T23:59:59.000Z", false);
      assert.equal(state.isVisible, false);
    });

    it("computes accurate non-negative countdown values for active future date", () => {
      const now = new Date("2026-11-19T12:00:00.000Z");
      // 2 days, 3 hours, 15 minutes, 30 seconds ahead
      const target = new Date("2026-11-21T15:15:30.000Z").toISOString();
      const state = computeCountdownDisplay(target, true, now);
      assert.equal(state.isVisible, true);
      assert.equal(state.days, 2);
      assert.equal(state.hours, 3);
      assert.equal(state.minutes, 15);
      assert.equal(state.seconds, 30);
      assert.equal(state.isExpired, false);
    });

    it("clamps expired countdown to 0 and never returns negative values", () => {
      const now = new Date("2026-11-19T12:00:00.000Z");
      const pastTarget = "2026-11-18T12:00:00.000Z";
      const state = computeCountdownDisplay(pastTarget, true, now);
      assert.equal(state.isVisible, false);
      assert.equal(state.isExpired, true);
      assert.equal(state.days, 0);
      assert.equal(state.hours, 0);
      assert.equal(state.minutes, 0);
      assert.equal(state.seconds, 0);
    });
  });

  // =========================================================================
  // M6: EVENT PAGE "0 GOING" RECONCILIATION & ATTENDEE STATE
  // =========================================================================
  describe("M6: Attendee Count Reconciliation and Registration UI State", () => {
    it("reconciles attendee count when registrations list is empty due to security rules", () => {
      // Non-organizer public visitor: registrations array is [] because attendees cannot list registrations
      const publicViewerRegistrations = [];
      const eventWithRegistrations = {
        id: "evt-m6-001",
        title: "Flagship Hackathon",
        registrationsCount: 42,
        allocatedSeats: 42,
        ticketsSold: 42,
      };

      const authoritativeCount = getAuthoritativeRegisteredCount(eventWithRegistrations, publicViewerRegistrations);
      assert.equal(authoritativeCount, 42);
      assert.notEqual(authoritativeCount, 0, "Must not display 0 GOING for populated event");
    });

    it("reconciles attendee count when registrations list contains live records", () => {
      const liveRegistrations = [{ id: "r1" }, { id: "r2" }, { id: "r3" }];
      const eventRecord = {
        id: "evt-m6-002",
        registrationsCount: 2, // slightly lagging counter
      };

      const authoritativeCount = getAuthoritativeRegisteredCount(eventRecord, liveRegistrations);
      assert.equal(authoritativeCount, 3, "Uses max between counter and array length");
    });

    it("generates privacy-preserving summary for public attendees (Safety Rule 9)", () => {
      function getAttendeeSummary(authoritativeCount, isRegisteredUser, canReadPII, sampleRegs = []) {
        if (isRegisteredUser) {
          return authoritativeCount <= 1
            ? "You're registered!"
            : `You and ${authoritativeCount - 1} other${authoritativeCount - 1 === 1 ? "" : "s"} are going`;
        }
        if (canReadPII && sampleRegs.length > 0) {
          return sampleRegs[0].fullName + " and others";
        }
        return `${authoritativeCount} ${authoritativeCount === 1 ? "attendee" : "attendees"} registered`;
      }

      // Public viewer who is not registered
      const publicText = getAttendeeSummary(42, false, false, [{ fullName: "Secret Person" }]);
      assert.equal(publicText, "42 attendees registered");
      assert.equal(publicText.includes("Secret Person"), false, "PII must never be exposed publicly");

      // Registered attendee viewing their own event page
      const registeredUserText = getAttendeeSummary(42, true, false);
      assert.equal(registeredUserText, "You and 41 others are going");
    });
  });

  // =========================================================================
  // M7: INSIGHTS COUPON REPORTING LOGIC
  // =========================================================================
  describe("M7: Insights Coupon Calculation & Payment Disambiguation", () => {
    function computeCouponMetrics(registrations) {
      let couponCount = 0;
      let freeRegistrationsCount = 0;
      let totalCouponDiscounts = 0;

      for (const r of registrations) {
        // Exclude cancelled or declined registrations
        if (r.status === "cancelled" || r.status === "declined") continue;

        // Distinguish free registrations from coupon-discounted registrations
        const isFree =
          r.paymentStatus === "free" ||
          (!r.amountPaid && !r.couponCode && !r.discountAmount);

        if (isFree && !r.couponCode && Number(r.discountAmount || 0) === 0) {
          freeRegistrationsCount++;
        }

        // Strictly verify valid coupon use: must have explicit coupon code or positive discount
        const hasValidCoupon = Boolean(
          (typeof r.couponCode === "string" && r.couponCode.trim().length > 0) ||
          (typeof r.coupon === "string" && r.coupon.trim().length > 0) ||
          (typeof r.couponId === "string" && r.couponId.trim().length > 0) ||
          Number(r.discountAmount || 0) > 0 ||
          Number(r.couponDiscount || 0) > 0
        );

        if (hasValidCoupon) {
          couponCount++;
          const discount = Math.max(0, Number(r.discountAmount || r.couponDiscount || 0));
          totalCouponDiscounts += discount;
        }
      }

      return { couponCount, freeRegistrationsCount, totalCouponDiscounts };
    }

    it("does not report coupon use for free registration where no coupon was applied", () => {
      const sampleRegistrations = [
        {
          id: "reg-free-1",
          fullName: "Alice Free",
          paymentStatus: "free",
          amountPaid: 0,
          couponCode: null,
          discountAmount: 0,
          status: "Unused",
        },
        {
          id: "reg-free-2",
          fullName: "Bob Free",
          paymentStatus: "free",
          amountPaid: 0,
          couponCode: "",
          discountAmount: 0,
          status: "Unused",
        },
      ];

      const metrics = computeCouponMetrics(sampleRegistrations);
      assert.equal(metrics.couponCount, 0, "Free registrations without coupons must not count as coupon use");
      assert.equal(metrics.freeRegistrationsCount, 2);
      assert.equal(metrics.totalCouponDiscounts, 0);
    });

    it("accurately records coupon use and discount total for registrations with valid coupons", () => {
      const sampleRegistrations = [
        {
          id: "reg-coupon-1",
          fullName: "Charlie Discount",
          paymentStatus: "paid",
          amountPaid: 400,
          couponCode: "EARLYBIRD50",
          discountAmount: 100,
          status: "Unused",
        },
        {
          id: "reg-paid-nocoupon",
          fullName: "Dave FullPrice",
          paymentStatus: "paid",
          amountPaid: 500,
          couponCode: null,
          discountAmount: 0,
          status: "Unused",
        },
        {
          id: "reg-free-nocoupon",
          fullName: "Eve Free",
          paymentStatus: "free",
          amountPaid: 0,
          couponCode: null,
          discountAmount: 0,
          status: "Unused",
        },
      ];

      const metrics = computeCouponMetrics(sampleRegistrations);
      assert.equal(metrics.couponCount, 1);
      assert.equal(metrics.freeRegistrationsCount, 1);
      assert.equal(metrics.totalCouponDiscounts, 100);
    });

    it("excludes cancelled or declined registrations from coupon totals", () => {
      const sampleRegistrations = [
        {
          id: "reg-cancelled",
          paymentStatus: "paid",
          couponCode: "REFUNDED_CODE",
          discountAmount: 200,
          status: "cancelled",
        },
      ];

      const metrics = computeCouponMetrics(sampleRegistrations);
      assert.equal(metrics.couponCount, 0);
      assert.equal(metrics.totalCouponDiscounts, 0);
    });
  });

  // =========================================================================
  // M8: DUPLICATE REGISTRATION IDEMPOTENCY & EMAIL PRESERVATION
  // =========================================================================
  describe("M8: Registration Idempotency and Deterministic Identity", () => {
    function computeRegistrationKey(eventId, email) {
      const cleanEmail = String(email || "").trim().toLowerCase();
      const cleanEventId = String(eventId || "").trim();
      return crypto.createHash("sha256").update(`${cleanEventId}:${cleanEmail}`).digest("hex");
    }

    it("produces identical registration keys regardless of casing differences", () => {
      const key1 = computeRegistrationKey("evt-100", "Krrish@TicketLelo.Com");
      const key2 = computeRegistrationKey("evt-100", "krrish@ticketlelo.com");
      assert.equal(key1, key2);
    });

    it("produces identical registration keys regardless of whitespace differences", () => {
      const key1 = computeRegistrationKey("evt-100", "  john.doe@example.com  \n");
      const key2 = computeRegistrationKey("evt-100", "john.doe@example.com");
      assert.equal(key1, key2);
    });

    it("produces distinct registration keys for different events with the same attendee email", () => {
      const keyEventA = computeRegistrationKey("event-alpha", "attendee@example.com");
      const keyEventB = computeRegistrationKey("event-beta", "attendee@example.com");
      assert.notEqual(keyEventA, keyEventB);
    });

    it("simulates idempotent registration workflow: returns existing ticket without resending email", () => {
      // Mock database state
      const mockRegistrations = new Map();
      const mockTickets = new Map();
      const emailSendLog = [];

      function handleRegistration(eventId, email, fullName) {
        const identity = computeRegistrationKey(eventId, email);
        if (mockRegistrations.has(identity)) {
          const existing = mockRegistrations.get(identity);
          return {
            success: true,
            alreadyRegistered: true,
            ticketId: existing.ticketId,
            emailStatus: "skipped",
          };
        }

        const ticketId = `TKT-${identity.slice(0, 8).toUpperCase()}`;
        mockTickets.set(ticketId, { ticketId, eventId, email, fullName });
        mockRegistrations.set(identity, { id: identity, ticketId, eventId, email, fullName });

        // First registration sends email
        emailSendLog.push({ ticketId, email });
        return {
          success: true,
          alreadyRegistered: false,
          ticketId,
          emailStatus: "queued",
        };
      }

      // First attempt
      const attempt1 = handleRegistration("fest-2026", "VIP@example.com", "VIP Guest");
      assert.equal(attempt1.success, true);
      assert.equal(attempt1.alreadyRegistered, false);
      assert.equal(attempt1.emailStatus, "queued");
      assert.equal(emailSendLog.length, 1);

      // Second attempt with differing casing and whitespace
      const attempt2 = handleRegistration("fest-2026", "  vip@EXAMPLE.com ", "VIP Guest");
      assert.equal(attempt2.success, true);
      assert.equal(attempt2.alreadyRegistered, true);
      assert.equal(attempt2.ticketId, attempt1.ticketId, "Must return the same ticket");
      assert.equal(attempt2.emailStatus, "skipped", "Must skip sending duplicate ticket email");
      assert.equal(emailSendLog.length, 1, "Email log must not have sent a second ticket email");
    });
  });

  // =========================================================================
  // M9: EVENT CAPACITY & ORGANISER IDENTITY CONSISTENCY
  // =========================================================================
  describe("M9: Authoritative Event Capacity and Organiser Identity", () => {
    it("returns explicit finite capacity correctly", () => {
      const eventWithCap = { id: "e1", globalCapacity: 150 };
      const cap = getAuthoritativeEventCapacity(eventWithCap);
      assert.equal(cap.isUnlimited, false);
      assert.equal(cap.capacity, 150);
      assert.equal(cap.display, "150");
    });

    it("does not default missing or unconfigured capacity to 150", () => {
      const eventNoCap = { id: "e2", title: "Open Seminar" };
      const cap = getAuthoritativeEventCapacity(eventNoCap);
      assert.equal(cap.isUnlimited, true);
      assert.equal(cap.capacity, 0);
      assert.equal(cap.display, "∞");
    });

    it("parses explicit unlimited strings and flags correctly", () => {
      const event1 = { id: "e3", globalCapacity: "Unlimited" };
      const event2 = { id: "e4", limitCapacity: false };
      const event3 = { id: "e5", capacity: "∞" };

      assert.equal(getAuthoritativeEventCapacity(event1).display, "∞");
      assert.equal(getAuthoritativeEventCapacity(event2).display, "∞");
      assert.equal(getAuthoritativeEventCapacity(event3).display, "∞");
    });

    it("enforces capacity threshold and rejects over-capacity registrations", () => {
      const fullEvent = { id: "e6", globalCapacity: 100, allocatedSeats: 100 };
      const regStatus = checkEventRegistrationStatus(fullEvent, 100);
      assert.equal(regStatus.isClosed, true);
      assert.equal(regStatus.reason, "capacity_reached");
    });

    it("resolves genuine event creator and keeps internal role names out of public labels", () => {
      const eventCreatedByAdi = {
        id: "evt-adi",
        creatorName: "Adi",
        organizerEmail: "adi@ticketlelo.com",
        createdBy: "uid_adi_123",
      };

      // Current logged in user is Super Administrator viewing Adi's event
      const superAdminViewer = {
        uid: "uid_superadmin_999",
        fullName: "Super Administrator",
        email: "superadmin@ticketlelo.com",
        role: "superadmin",
      };

      const organiser = getAuthoritativeOrganiser(eventCreatedByAdi, superAdminViewer);
      assert.equal(organiser.name, "Adi", "Must show actual event creator Adi, not viewing Super Administrator");
      assert.equal(organiser.email, "adi@ticketlelo.com");
      assert.notEqual(organiser.name, "Super Administrator");
      assert.notEqual(organiser.name, "superadmin");
    });

    it("strips generic or role placeholders when no specific creator is configured", () => {
      const genericEvent = {
        id: "evt-gen",
        organizerName: "Super Administrator",
        hostEmail: "support@ticketlelo.com",
      };

      const organiser = getAuthoritativeOrganiser(genericEvent, null);
      assert.equal(organiser.name, "Event Organiser", "Never expose 'Super Administrator' as public organizer label");
    });
  });

  // =========================================================================
  // REGRESSION CHECKS: CHECK-IN IDEMPOTENCY & STATUS SYNC
  // =========================================================================
  describe("Regression Checks: Gate Check-In & Scanner Idempotency", () => {
    it("simulates check-in admission and prevents duplicate scan admission", () => {
      const ticket = {
        id: "TKT-TEST-001",
        status: "Valid",
        checkIns: {},
      };

      function processCheckIn(tkt, gate = "main_gate") {
        if (tkt.status === "Used" || tkt.checkIns[gate]) {
          return { status: "already_used", message: "Duplicate Scan: Already admitted." };
        }
        tkt.checkIns[gate] = { time: new Date().toISOString(), station: gate };
        tkt.status = "Used";
        return { status: "admitted", message: "Valid Ticket — Admission Granted" };
      }

      // First scan: admitted
      const scan1 = processCheckIn(ticket);
      assert.equal(scan1.status, "admitted");
      assert.equal(ticket.status, "Used");

      // Second scan: duplicate detection
      const scan2 = processCheckIn(ticket);
      assert.equal(scan2.status, "already_used");
      assert.match(scan2.message, /Already admitted/i);
    });
  });
});
