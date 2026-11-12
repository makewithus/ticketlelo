import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "../firebase-admin.js";

/**
 * TICKETLELO CREATOR CAMPUS AMBASSADOR PROGRAM
 * Double-Entry Append-Only Points Ledger & Calculation Engine
 */

export const DEFAULT_POINTS_RULES = {
  paidRegistrationPoints: 10,
  freeRegistrationPoints: 2,
  milestones: [
    { threshold: 5, bonusPoints: 10 },
    { threshold: 10, bonusPoints: 25 },
    { threshold: 25, bonusPoints: 50 },
    { threshold: 50, bonusPoints: 100 },
  ],
};

/**
 * Resolves points rule for a specific program, event, and ticket type
 */
export async function resolvePointsRule(programId, eventId, ticketId = null) {
  if (!adminDb || !programId) return DEFAULT_POINTS_RULES;

  try {
    const rulesSnap = await adminDb
      .collection("pointsRules")
      .where("programId", "==", programId)
      .limit(1)
      .get();

    if (!rulesSnap.empty) {
      const data = rulesSnap.docs[0].data();
      // Check event override
      if (eventId && data.eventOverrides && data.eventOverrides[eventId]) {
        return {
          ...DEFAULT_POINTS_RULES,
          ...data,
          ...data.eventOverrides[eventId],
          ruleId: rulesSnap.docs[0].id,
          version: data.version || 1,
        };
      }
      return {
        ...DEFAULT_POINTS_RULES,
        ...data,
        ruleId: rulesSnap.docs[0].id,
        version: data.version || 1,
      };
    }
  } catch (err) {
    console.warn("[points-engine] Could not fetch custom rules, using defaults:", err?.message);
  }

  return {
    ...DEFAULT_POINTS_RULES,
    ruleId: "default_v1",
    version: 1,
  };
}

/**
 * Calculate earned points for a registration or ticket order
 */
export function calculateEarnedPoints({
  isPaid = true,
  ticketCount = 1,
  currentRegistrationsCount = 0,
  rules = DEFAULT_POINTS_RULES,
}) {
  const baseRate = isPaid
    ? Number(rules.paidRegistrationPoints ?? 10)
    : Number(rules.freeRegistrationPoints ?? 2);

  const basePoints = Math.max(0, Math.round(baseRate * Math.max(1, Number(ticketCount || 1))));

  let bonusPoints = 0;
  let achievedMilestone = null;

  const newTotal = currentRegistrationsCount + Number(ticketCount || 1);
  if (Array.isArray(rules.milestones)) {
    for (const m of rules.milestones) {
      if (currentRegistrationsCount < m.threshold && newTotal >= m.threshold) {
        bonusPoints += Number(m.bonusPoints || 0);
        achievedMilestone = m.threshold;
      }
    }
  }

  return {
    basePoints,
    bonusPoints,
    totalPoints: basePoints + bonusPoints,
    achievedMilestone,
  };
}

/**
 * Atomically award points for an eligible registration through the append-only ledger
 */
export async function awardPointsForRegistration({
  ambassadorId,
  userId,
  programId,
  eventId,
  orderId = null,
  registrationId,
  referralCode,
  isPaid = true,
  ticketCount = 1,
}) {
  if (!adminDb || !ambassadorId || !programId) {
    throw new Error("Missing parameters for points awarding");
  }

  const idempotencyKey = `pts_${programId}_${orderId || registrationId}_${ambassadorId}`;

  // 1. Check idempotency: Ensure this transaction has not already awarded points
  const existingLedgerSnap = await adminDb
    .collection("pointsLedger")
    .where("idempotencyKey", "==", idempotencyKey)
    .limit(1)
    .get();

  if (!existingLedgerSnap.empty) {
    return {
      alreadyProcessed: true,
      entry: existingLedgerSnap.docs[0].data(),
    };
  }

  // 2. Fetch ambassador record to verify active status
  let ambRef = adminDb.collection("programAmbassadors").doc(ambassadorId);
  let ambSnap = await ambRef.get();

  // If not found in programAmbassadors, check legacy ambassadors collection
  let isLegacy = false;
  if (!ambSnap.exists) {
    const legRef = adminDb.collection("ambassadors").doc(ambassadorId);
    const legSnap = await legRef.get();
    if (legSnap.exists && legSnap.data().status === "approved") {
      isLegacy = true;
      ambRef = legRef;
      ambSnap = legSnap;
    } else {
      throw new Error("Ambassador is not active or approved");
    }
  } else if (ambSnap.data().status !== "active") {
    throw new Error("Ambassador profile is currently suspended or inactive");
  }

  const ambData = ambSnap.data();
  const currentPoints = Number(ambData.totalPoints || ambData.metrics?.points || 0);
  const currentReferralCount = Number(ambData.referralCount || ambData.metrics?.registrations || 0);

  // 3. Resolve points rules
  const rules = await resolvePointsRule(programId, eventId);
  const calculation = calculateEarnedPoints({
    isPaid,
    ticketCount,
    currentRegistrationsCount: currentReferralCount,
    rules,
  });

  if (calculation.totalPoints <= 0) {
    return {
      totalPoints: 0,
      awarded: false,
      reason: "Rule evaluated to zero points",
    };
  }

  // 4. Atomic Transaction: Append to pointsLedger and increment ambassador balance
  const ledgerRef = adminDb.collection("pointsLedger").doc();
  const ledgerData = {
    id: ledgerRef.id,
    idempotencyKey,
    ambassadorId,
    userId: userId || ambData.userId || ambassadorId,
    programId,
    eventId: eventId || null,
    orderId: orderId || null,
    registrationId: registrationId || null,
    referralCode: referralCode || ambData.referralCode || "",
    ruleId: rules.ruleId || "default_v1",
    ruleVersion: rules.version || 1,
    ruleSnapshot: {
      paidRegistrationPoints: rules.paidRegistrationPoints,
      freeRegistrationPoints: rules.freeRegistrationPoints,
    },
    basePoints: calculation.basePoints,
    bonusPoints: calculation.bonusPoints,
    totalPoints: calculation.totalPoints,
    entryType: calculation.bonusPoints > 0 ? "earn_with_bonus" : "earn",
    reason: isPaid
      ? `Earned points for paid ticket registration (${ticketCount} pass)`
      : `Earned points for free event registration`,
    status: "completed",
    reversalRef: null,
    createdAt: Timestamp.now(),
  };

  await adminDb.runTransaction(async (t) => {
    t.set(ledgerRef, ledgerData);

    if (isLegacy) {
      t.update(ambRef, {
        "metrics.points": currentPoints + calculation.totalPoints,
        "metrics.registrations": currentReferralCount + Number(ticketCount || 1),
        updatedAt: Timestamp.now(),
      });
    } else {
      t.update(ambRef, {
        totalPoints: currentPoints + calculation.totalPoints,
        referralCount: currentReferralCount + Number(ticketCount || 1),
        updatedAt: Timestamp.now(),
      });
    }
  });

  return {
    awarded: true,
    ledgerId: ledgerRef.id,
    pointsAwarded: calculation.totalPoints,
    newBalance: currentPoints + calculation.totalPoints,
  };
}

/**
 * Reverses points when an order is cancelled or refunded
 */
export async function reversePointsForOrder({ orderId, reason = "Order Refunded" }) {
  if (!adminDb || !orderId) return { reversedCount: 0 };

  const entriesSnap = await adminDb
    .collection("pointsLedger")
    .where("orderId", "==", orderId)
    .where("status", "==", "completed")
    .get();

  if (entriesSnap.empty) {
    return { reversedCount: 0, message: "No active points ledger entries found for this order" };
  }

  let totalReversed = 0;

  for (const docEntry of entriesSnap.docs) {
    const original = docEntry.data();
    if (original.entryType === "reversal") continue;

    const reversalRef = adminDb.collection("pointsLedger").doc();
    const reversalData = {
      id: reversalRef.id,
      idempotencyKey: `rev_${original.id}`,
      ambassadorId: original.ambassadorId,
      userId: original.userId,
      programId: original.programId,
      eventId: original.eventId,
      orderId: original.orderId,
      registrationId: original.registrationId,
      referralCode: original.referralCode,
      basePoints: -Math.abs(original.basePoints),
      bonusPoints: -Math.abs(original.bonusPoints),
      totalPoints: -Math.abs(original.totalPoints),
      entryType: "reversal",
      reason: String(reason || "Order Refunded"),
      status: "completed",
      reversalRef: original.id,
      createdAt: Timestamp.now(),
    };

    const ambRef = adminDb.collection("programAmbassadors").doc(original.ambassadorId);

    await adminDb.runTransaction(async (t) => {
      t.set(reversalRef, reversalData);
      t.update(docEntry.ref, {
        status: "reversed",
        reversedAt: Timestamp.now(),
      });

      const ambDoc = await t.get(ambRef);
      if (ambDoc.exists) {
        const cur = Number(ambDoc.data().totalPoints || 0);
        t.update(ambRef, {
          totalPoints: Math.max(0, cur - original.totalPoints),
          updatedAt: Timestamp.now(),
        });
      }
    });

    totalReversed += original.totalPoints;
  }

  return {
    reversedCount: entriesSnap.size,
    totalPointsReversed: totalReversed,
  };
}

/**
 * Authorized manual adjustment of points by organizer or superAdmin
 */
export async function adjustPointsManually({
  ambassadorId,
  programId,
  pointsAdjustment,
  reason,
  adjustedByUid,
}) {
  if (!adminDb || !ambassadorId || !programId || !pointsAdjustment) {
    throw new Error("Missing parameters for manual adjustment");
  }

  const ambRef = adminDb.collection("programAmbassadors").doc(ambassadorId);
  const ambDoc = await ambRef.get();
  if (!ambDoc.exists) throw new Error("Ambassador profile not found");

  const ambData = ambDoc.data();
  const curPoints = Number(ambData.totalPoints || 0);
  const delta = Math.round(Number(pointsAdjustment));
  const newBalance = Math.max(0, curPoints + delta);

  const ledgerRef = adminDb.collection("pointsLedger").doc();
  const ledgerData = {
    id: ledgerRef.id,
    idempotencyKey: `adj_${ledgerRef.id}`,
    ambassadorId,
    userId: ambData.userId,
    programId,
    eventId: null,
    basePoints: delta,
    bonusPoints: 0,
    totalPoints: delta,
    entryType: "adjustment",
    reason: String(reason || "Manual Organizer Adjustment"),
    status: "completed",
    reversalRef: null,
    adjustedBy: adjustedByUid,
    createdAt: Timestamp.now(),
  };

  await adminDb.runTransaction(async (t) => {
    t.set(ledgerRef, ledgerData);
    t.update(ambRef, {
      totalPoints: newBalance,
      updatedAt: Timestamp.now(),
    });
  });

  return {
    success: true,
    delta,
    newBalance,
    ledgerId: ledgerRef.id,
  };
}

