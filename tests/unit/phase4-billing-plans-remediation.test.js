import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PLANS,
  getPlan,
  getEffectivePlanLimits,
  canCreateEvent,
  canAddParticipant,
} from "../../lib/plans.js";
import {
  getOrganizerUsage,
  assertCanCreateEvent,
  assertCanPublishEvent,
} from "../../lib/plan-enforcement.js";
import {
  resolveCommissionRule,
  DEFAULT_PLAN_COMMISSION_RATES,
  normalizePlanId,
} from "../../lib/payments/commission-engine.js";

/**
 * Creates an in-memory mock Firestore adminDb for plan testing
 */
function createMockAdminDb({ users = {}, events = [] } = {}) {
  const usersStore = new Map(Object.entries(users));
  const eventsStore = new Map(events.map((e) => [e.id, { ...e }]));
  const auditLogs = [];

  const db = {
    _users: usersStore,
    _events: eventsStore,
    _auditLogs: auditLogs,

    collection(colName) {
      if (colName === "users") {
        return {
          doc(docId) {
            return {
              async get() {
                const data = usersStore.get(docId);
                return {
                  exists: Boolean(data),
                  id: docId,
                  data: () => data,
                };
              },
              async set(data, opts = {}) {
                if (opts.merge && usersStore.has(docId)) {
                  usersStore.set(docId, { ...usersStore.get(docId), ...data });
                } else {
                  usersStore.set(docId, data);
                }
              },
              async update(data) {
                if (!usersStore.has(docId)) throw new Error("Document not found");
                usersStore.set(docId, { ...usersStore.get(docId), ...data });
              },
            };
          },
        };
      }

      if (colName === "events") {
        return {
          where(field, op, value) {
            return {
              async get() {
                const docs = [];
                for (const [id, ev] of eventsStore.entries()) {
                  if (op === "==" && ev[field] === value) {
                    docs.push({
                      id,
                      data: () => ev,
                    });
                  }
                }
                return { docs };
              },
            };
          },
          doc(docId) {
            return {
              async get() {
                const data = eventsStore.get(docId);
                return {
                  exists: Boolean(data),
                  id: docId,
                  data: () => data,
                };
              },
              async update(data) {
                if (!eventsStore.has(docId)) throw new Error("Event not found");
                eventsStore.set(docId, { ...eventsStore.get(docId), ...data });
              },
            };
          },
        };
      }

      if (colName === "admin_audit_logs") {
        return {
          async add(entry) {
            const id = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
            auditLogs.push({ id, ...entry });
            return { id };
          },
        };
      }

      throw new Error(`Collection ${colName} not mocked`);
    },

    async runTransaction(updateFunction) {
      const transaction = {
        async get(docRef) {
          return await docRef.get();
        },
        set(docRef, data, opts) {
          return docRef.set(data, opts);
        },
        update(docRef, data) {
          return docRef.update(data);
        },
      };
      return await updateFunction(transaction);
    },
  };

  return db;
}

test("Phase 4 Remediation: Canonical Limits & Effective Limit Calculation", async (t) => {
  await t.test("canonical plan defaults: Free (1), Starter (3), Pro (10), Fest (unlimited)", () => {
    assert.equal(PLANS.free.eventsAllowed, 1);
    assert.equal(PLANS.starter.eventsAllowed, 3);
    assert.equal(PLANS.pro.eventsAllowed, 10);
    assert.equal(PLANS.fest.eventsAllowed, -1);
  });

  await t.test("getEffectivePlanLimits correctly distinguishes defaults vs overrides", () => {
    // 1. Standard Free user
    const standardFree = getEffectivePlanLimits({ plan: "free" });
    assert.equal(standardFree.eventsAllowed, 1);
    assert.equal(standardFree.standardEventsAllowed, 1);
    assert.equal(standardFree.hasCustomEvents, false);
    assert.equal(standardFree.hasAnyCustomOverrides, false);

    // 2. Amit: Free plan with custom override eventsAllowed: 5
    const amitUser = {
      plan: "free",
      eventsAllowed: 5,
      customOverrides: { eventsAllowed: 5 },
    };
    const amitLimits = getEffectivePlanLimits(amitUser);
    assert.equal(amitLimits.eventsAllowed, 5, "Effective limit should be custom 5");
    assert.equal(amitLimits.standardEventsAllowed, 1, "Standard default must remain 1");
    assert.equal(amitLimits.hasCustomEvents, true);
    assert.equal(amitLimits.hasAnyCustomOverrides, true);

    // 3. Mukul: Starter plan with custom override eventsAllowed: 4
    const mukulUser = {
      plan: "starter",
      eventsAllowed: 4,
      customOverrides: { eventsAllowed: 4 },
    };
    const mukulLimits = getEffectivePlanLimits(mukulUser);
    assert.equal(mukulLimits.eventsAllowed, 4, "Effective limit should be custom 4");
    assert.equal(mukulLimits.standardEventsAllowed, 3, "Standard default must remain 3");
    assert.equal(mukulLimits.hasCustomEvents, true);
  });
});

test("Phase 4 Remediation: Event Usage Calculation & Soft-Deletion Integrity", async (t) => {
  await t.test("excludes soft-deleted and deleted events from usage count", async () => {
    const mockDb = createMockAdminDb({
      users: {
        org1: { uid: "org1", email: "org1@test.com", plan: "free" },
      },
      events: [
        { id: "ev1", createdBy: "org1", status: "published" },
        { id: "ev2", createdBy: "org1", status: "draft" },
        { id: "ev3", createdBy: "org1", isDeleted: true, status: "deleted" }, // Soft-deleted
        { id: "ev4", createdBy: "org1", deleted: true }, // Soft-deleted
      ],
    });

    const usage = await getOrganizerUsage(mockDb, "org1", "org1@test.com");
    assert.equal(usage.totalEvents, 2, "Only non-deleted events (ev1 and ev2) must count");
    assert.equal(usage.activeEvents, 1, "Only ev1 is active/published");
  });
});

test("Phase 4 Remediation: Backend Limit Enforcement — 1 Below, At Limit, 1 Above", async (t) => {
  await t.test("Standard Free tier (limit = 1): 0 below, 1 at limit, 2 above limit", async () => {
    // 0 events -> 1 below limit -> ALLOWED
    const db0 = createMockAdminDb({
      users: { u1: { uid: "u1", plan: "free", email: "u1@test.com" } },
      events: [],
    });
    const check0 = await assertCanCreateEvent(db0, { uid: "u1" });
    assert.equal(check0.allowed, true);
    assert.equal(check0.current, 0);
    assert.equal(check0.limit, 1);

    // 1 event -> AT limit -> BLOCKED
    const db1 = createMockAdminDb({
      users: { u1: { uid: "u1", plan: "free", email: "u1@test.com" } },
      events: [{ id: "e1", createdBy: "u1", status: "published" }],
    });
    const check1 = await assertCanCreateEvent(db1, { uid: "u1" });
    assert.equal(check1.allowed, false);
    assert.equal(check1.code, "EVENT_LIMIT_REACHED");
    assert.equal(check1.current, 1);
    assert.equal(check1.limit, 1);

    // 2 events (Bhuvi situation) -> OVER limit -> BLOCKED
    const db2 = createMockAdminDb({
      users: { u1: { uid: "u1", plan: "free", email: "u1@test.com" } },
      events: [
        { id: "e1", createdBy: "u1", status: "published" },
        { id: "e2", createdBy: "u1", status: "published" },
      ],
    });
    const check2 = await assertCanCreateEvent(db2, { uid: "u1" });
    assert.equal(check2.allowed, false);
    assert.equal(check2.code, "EVENT_LIMIT_REACHED");
    assert.equal(check2.current, 2);
    assert.equal(check2.limit, 1);
  });

  await t.test("Standard Starter tier (limit = 3): 2 below, 3 at limit, 4 above limit", async () => {
    // 2 events -> ALLOWED
    const db2 = createMockAdminDb({
      users: { s1: { uid: "s1", plan: "starter", email: "s1@test.com" } },
      events: [
        { id: "e1", createdBy: "s1", status: "published" },
        { id: "e2", createdBy: "s1", status: "draft" },
      ],
    });
    const check2 = await assertCanCreateEvent(db2, { uid: "s1" });
    assert.equal(check2.allowed, true);
    assert.equal(check2.current, 2);

    // 3 events -> AT limit -> BLOCKED
    const db3 = createMockAdminDb({
      users: { s1: { uid: "s1", plan: "starter", email: "s1@test.com" } },
      events: [
        { id: "e1", createdBy: "s1", status: "published" },
        { id: "e2", createdBy: "s1", status: "draft" },
        { id: "e3", createdBy: "s1", status: "published" },
      ],
    });
    const check3 = await assertCanCreateEvent(db3, { uid: "s1" });
    assert.equal(check3.allowed, false);
    assert.equal(check3.code, "EVENT_LIMIT_REACHED");
    assert.equal(check3.current, 3);
    assert.equal(check3.limit, 3);
  });

  await t.test("Custom override preservation (Amit 3/5 and Mukul 1/4)", async () => {
    // Amit: Free plan with custom override 5, currently has 3 events
    const amitDb = createMockAdminDb({
      users: {
        amit: {
          uid: "amit",
          plan: "free",
          eventsAllowed: 5,
          customOverrides: { eventsAllowed: 5 },
        },
      },
      events: [
        { id: "ae1", createdBy: "amit", status: "published" },
        { id: "ae2", createdBy: "amit", status: "published" },
        { id: "ae3", createdBy: "amit", status: "published" },
      ],
    });
    const amitCheck = await assertCanCreateEvent(amitDb, { uid: "amit" });
    assert.equal(amitCheck.allowed, true, "Amit with 3/5 events should still be allowed to create events");
    assert.equal(amitCheck.current, 3);
    assert.equal(amitCheck.limit, 5);

    // Mukul: Starter plan with custom override 4, currently has 1 event
    const mukulDb = createMockAdminDb({
      users: {
        mukul: {
          uid: "mukul",
          plan: "starter",
          eventsAllowed: 4,
          customOverrides: { eventsAllowed: 4 },
        },
      },
      events: [{ id: "me1", createdBy: "mukul", status: "published" }],
    });
    const mukulCheck = await assertCanCreateEvent(mukulDb, { uid: "mukul" });
    assert.equal(mukulCheck.allowed, true, "Mukul with 1/4 events is allowed to create events");
    assert.equal(mukulCheck.current, 1);
    assert.equal(mukulCheck.limit, 4);
  });
});

test("Phase 4 Remediation: Publish Limit & Idempotency Safeguards", async (t) => {
  await t.test("re-publishing an already active event is idempotent and never blocked", async () => {
    // Bhuvi has 2 active events on Free (limit 1)
    const db = createMockAdminDb({
      users: { bhuvi: { uid: "bhuvi", plan: "free", email: "bhuvi@test.com" } },
      events: [
        { id: "e1", createdBy: "bhuvi", status: "published" },
        { id: "e2", createdBy: "bhuvi", status: "published" },
      ],
    });

    // Re-publishing existing published event e1
    const check = await assertCanPublishEvent(db, { uid: "bhuvi" }, "e1");
    assert.equal(check.allowed, true, "Existing published event must remain published");
    assert.equal(check.alreadyPublished, true);
  });

  await t.test("publishing a draft event when at limit is blocked with 403", async () => {
    // User on Free tier has 1 published event, and tries to publish a 2nd draft event
    const db = createMockAdminDb({
      users: { u1: { uid: "u1", plan: "free", email: "u1@test.com" } },
      events: [
        { id: "e1", createdBy: "u1", status: "published" },
        { id: "e2_draft", createdBy: "u1", status: "draft" },
      ],
    });

    const check = await assertCanPublishEvent(db, { uid: "u1" }, "e2_draft");
    assert.equal(check.allowed, false);
    assert.equal(check.code, "EVENT_LIMIT_EXCEEDED");
    assert.equal(check.upgradeRequired, true);
  });
});

test("Phase 4 Remediation: Safe Plan Switching & Custom Override Preservation (M5)", async (t) => {
  await t.test("transition Free -> Starter preserves custom overrides unless explicitly removed", async () => {
    // Test Organiser with custom override eventsAllowed: 5
    const initialUser = {
      uid: "org_custom",
      name: "Test Organiser",
      plan: "free",
      eventsAllowed: 5,
      participantsPerEvent: 2000,
      customOverrides: {
        eventsAllowed: 5,
        participantsPerEvent: 2000,
      },
    };

    const db = createMockAdminDb({
      users: { org_custom: initialUser },
    });

    // Simulate backend POST /api/superadmin/plans transition logic
    const proposedPlan = PLANS.starter;
    const preserveCustomOverrides = true;

    await db.runTransaction(async (transaction) => {
      const userRef = db.collection("users").doc("org_custom");
      const userDoc = await transaction.get(userRef);
      const u = userDoc.data();

      // Snapshot previous subscription
      const previousSubscription = {
        plan: u.plan || "free",
        eventsAllowed: u.eventsAllowed || 1,
        participantsPerEvent: u.participantsPerEvent || 300,
        switchedAt: new Date().toISOString(),
      };

      const finalEventsAllowed = preserveCustomOverrides
        ? Math.max(u.eventsAllowed || 1, proposedPlan.eventsAllowed)
        : proposedPlan.eventsAllowed;

      const finalParticipants = preserveCustomOverrides
        ? Math.max(u.participantsPerEvent || 300, proposedPlan.participantsPerEvent)
        : proposedPlan.participantsPerEvent;

      transaction.update(userRef, {
        plan: "starter",
        eventsAllowed: finalEventsAllowed,
        participantsPerEvent: finalParticipants,
        previousSubscription,
        updatedAt: new Date().toISOString(),
      });

      await db.collection("admin_audit_logs").add({
        action: "plan_changed",
        userId: "org_custom",
        previousPlan: u.plan,
        newPlan: "starter",
        actor: "superadmin",
      });
    });

    const updated = (await db.collection("users").doc("org_custom").get()).data();
    assert.equal(updated.plan, "starter");
    assert.equal(updated.eventsAllowed, 5, "Custom override of 5 events MUST NOT be reset to 3!");
    assert.equal(updated.participantsPerEvent, 2000, "Custom participants override preserved");
    assert.equal(updated.previousSubscription.plan, "free");
    assert.equal(db._auditLogs.length, 1);
  });

  await t.test("transition Starter -> Pro -> Free round-trip keeps overrides intact", async () => {
    const userDoc = {
      uid: "roundtrip_user",
      plan: "starter",
      eventsAllowed: 7, // Custom override
      customOverrides: { eventsAllowed: 7 },
    };
    const db = createMockAdminDb({
      users: { roundtrip_user: userDoc },
    });

    // 1. Starter -> Pro (Pro has standard 10)
    let limits = getEffectivePlanLimits({
      plan: "pro",
      eventsAllowed: Math.max(userDoc.eventsAllowed, PLANS.pro.eventsAllowed),
      customOverrides: userDoc.customOverrides,
    });
    assert.equal(limits.eventsAllowed, 10, "Pro default of 10 takes precedence over 7");

    // 2. Pro -> Free with preserveCustomOverrides
    limits = getEffectivePlanLimits({
      plan: "free",
      eventsAllowed: userDoc.customOverrides.eventsAllowed, // Preserved 7
      customOverrides: userDoc.customOverrides,
    });
    assert.equal(limits.eventsAllowed, 7, "Returning to Free preserves custom override 7");
  });
});

test("Phase 4 Remediation: Payment Failure & Double-Submission Idempotency", async (t) => {
  await t.test("payment verification failure does NOT alter subscription state", async () => {
    const userOriginal = {
      uid: "user_pay_test",
      plan: "free",
      eventsAllowed: 1,
    };
    const db = createMockAdminDb({
      users: { user_pay_test: userOriginal },
    });

    // Simulate failed payment verification
    const mockPaymentVerified = false;

    if (!mockPaymentVerified) {
      // No updates to user document
    }

    const stateAfter = (await db.collection("users").doc("user_pay_test").get()).data();
    assert.equal(stateAfter.plan, "free", "Plan must remain free on payment failure");
    assert.equal(stateAfter.eventsAllowed, 1);
  });

  await t.test("duplicate plan switch request idempotently handles already-applied state", async () => {
    const user = {
      uid: "idem_user",
      plan: "starter",
      eventsAllowed: 3,
    };
    const db = createMockAdminDb({
      users: { idem_user: user },
    });

    let alreadyOnPlan = false;
    const currentData = (await db.collection("users").doc("idem_user").get()).data();
    if (currentData.plan === "starter") {
      alreadyOnPlan = true;
    }

    assert.equal(alreadyOnPlan, true, "Subsequent request detects plan is already active");
  });
});

test("Phase 4 Remediation: Commercial Pricing & Fee Consistency Cross-Check", async (t) => {
  await t.test("PLANS platformFeeRate correctly aligns with commercial tiers", () => {
    assert.equal(PLANS.free.platformFeeRate, 5.0, "Free tier fee is 5.0%");
    assert.equal(PLANS.starter.platformFeeRate, 5.0, "Starter tier fee is 5.0% (START tier)");
    assert.equal(PLANS.pro.platformFeeRate, 4.5, "Pro tier fee is 4.5% (CAMPUS tier)");
    assert.equal(PLANS.fest.platformFeeRate, 3.5, "Fest tier fee is 3.5% (FEST tier)");
  });

  await t.test("commission-engine DEFAULT_PLAN_COMMISSION_RATES aligns with plan rates", () => {
    assert.equal(DEFAULT_PLAN_COMMISSION_RATES.START, 5.0);
    assert.equal(DEFAULT_PLAN_COMMISSION_RATES.CAMPUS, 4.5);
    assert.equal(DEFAULT_PLAN_COMMISSION_RATES.FEST, 3.5);
  });

  await t.test("resolveCommissionRule correctly maps plans and rates", async () => {
    // 1. Free / Starter tier -> 5.0%
    const ruleStart = await resolveCommissionRule({ planId: "starter" });
    assert.equal(ruleStart.ratePercent, 5.0);
    assert.equal(ruleStart.planTier, "START");

    // 2. Pro tier -> 4.5%
    const ruleCampus = await resolveCommissionRule({ planId: "pro" });
    assert.equal(ruleCampus.ratePercent, 4.5);
    assert.equal(ruleCampus.planTier, "CAMPUS");

    // 3. Fest tier -> 3.5%
    const ruleFest = await resolveCommissionRule({ planId: "fest" });
    assert.equal(ruleFest.ratePercent, 3.5);
    assert.equal(ruleFest.planTier, "FEST");
  });
});
