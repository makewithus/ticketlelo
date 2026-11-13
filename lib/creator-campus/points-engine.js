import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "../firebase-admin.js";

/**
 * TICKETLELO CREATOR CAMPUS AMBASSADOR PROGRAM
 * Double-Entry Append-Only Points Ledger & Flexible Custom Scoring Engine
 * 
 * Supports:
 * - 3-tier base points priority: Ticket-specific > Event-specific > Global Default
 * - Bonus & milestone engine with one-time milestone lock
 * - Double-entry append-only audit ledger
 * - Idempotent awarding and refund reversals
 */

export const DEFAULT_POINTS_RULES = {
  // Legacy backward-compatibility top-level keys
  paidRegistrationPoints: 10,
  freeRegistrationPoints: 2,
  paidMultiplier: 2,
  milestones: [
    { threshold: 5, bonusPoints: 10 },
    { threshold: 10, bonusPoints: 25 },
    { threshold: 25, bonusPoints: 50 },
    { threshold: 50, bonusPoints: 100 },
  ],

  // Upgraded custom points engine defaults
  global: {
    freeRegistrationPoints: 10,
    freeEligible: true,
    paidType: "multiplier", // "multiplier" | "fixed"
    paidMultiplier: 2,
    paidRegistrationPoints: 20,
    paidEligible: true,
    ineligibleCategories: [],
  },
  eventOverrides: {},
  ticketOverrides: {},
  bonusRules: [],
};

/**
 * Resolves points rule for a specific program, event, and ticket type
 */
export async function resolvePointsRule(programId, eventId = null, ticketId = null) {
  if (!adminDb || !programId) return DEFAULT_POINTS_RULES;

  try {
    const rulesSnap = await adminDb
      .collection("pointsRules")
      .where("programId", "==", programId)
      .limit(1)
      .get();

    if (!rulesSnap.empty) {
      const data = rulesSnap.docs[0].data();
      const mergedGlobal = {
        ...DEFAULT_POINTS_RULES.global,
        ...(data.global || {}),
      };

      // Preserve top-level compatibility if global wasn't explicitly saved
      if (data.freeRegistrationPoints !== undefined && !data.global?.freeRegistrationPoints) {
        mergedGlobal.freeRegistrationPoints = Number(data.freeRegistrationPoints);
      }
      if (data.paidMultiplier !== undefined && !data.global?.paidMultiplier) {
        mergedGlobal.paidMultiplier = Number(data.paidMultiplier);
      }
      if (data.paidRegistrationPoints !== undefined && !data.global?.paidRegistrationPoints) {
        mergedGlobal.paidRegistrationPoints = Number(data.paidRegistrationPoints);
      }

      return {
        ...DEFAULT_POINTS_RULES,
        ...data,
        global: mergedGlobal,
        paidRegistrationPoints: mergedGlobal.paidRegistrationPoints ?? DEFAULT_POINTS_RULES.paidRegistrationPoints,
        freeRegistrationPoints: mergedGlobal.freeRegistrationPoints ?? DEFAULT_POINTS_RULES.freeRegistrationPoints,
        paidMultiplier: mergedGlobal.paidMultiplier ?? DEFAULT_POINTS_RULES.paidMultiplier,
        eventOverrides: data.eventOverrides || {},
        ticketOverrides: data.ticketOverrides || {},
        bonusRules: Array.isArray(data.bonusRules) ? data.bonusRules : [],
        ruleId: rulesSnap.docs[0].id,
        version: Number(data.version || 1),
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
 * Calculate earned points for a registration or ticket order based on:
 * Priority 1: Ticket-specific rule
 * Priority 2: Event-specific rule
 * Priority 3: Global program default
 * Plus bonuses evaluated separately.
 */
export function calculateEarnedPoints({
  isPaid = true,
  ticketCount = 1,
  currentRegistrationsCount = 0,
  rules = DEFAULT_POINTS_RULES,
  eventId = null,
  ticketId = null,
  ticketType = null,
  isCombo = false,
  registrationTimestamp = null,
  awardedMilestoneIds = [],
}) {
  const count = Math.max(1, Number(ticketCount || 1));
  const globalConfig = rules.global || {
    freeRegistrationPoints: Number(rules.freeRegistrationPoints ?? 10),
    freeEligible: true,
    paidType: "multiplier",
    paidMultiplier: Number(rules.paidMultiplier ?? 2),
    paidRegistrationPoints: Number(rules.paidRegistrationPoints ?? 20),
    paidEligible: true,
  };

  let baseRate = 0;
  let appliedRule = null;
  let isEligible = true;

  // ── 1. Check Ticket-Specific Rule (Priority 1) ──
  let matchedTicketRule = null;
  if (rules.ticketOverrides && typeof rules.ticketOverrides === "object") {
    // Try by composite key eventId_ticketId
    if (eventId && ticketId && rules.ticketOverrides[`${eventId}_${ticketId}`]) {
      matchedTicketRule = rules.ticketOverrides[`${eventId}_${ticketId}`];
    } else if (ticketId && rules.ticketOverrides[ticketId]) {
      matchedTicketRule = rules.ticketOverrides[ticketId];
    } else if (eventId && ticketType && rules.ticketOverrides[`${eventId}_${ticketType}`]) {
      matchedTicketRule = rules.ticketOverrides[`${eventId}_${ticketType}`];
    } else if (ticketType && rules.ticketOverrides[ticketType]) {
      matchedTicketRule = rules.ticketOverrides[ticketType];
    } else {
      // Linear scan by eventId + ticketName / ticketId
      const allTicketRules = Object.values(rules.ticketOverrides);
      matchedTicketRule = allTicketRules.find((r) => {
        if (!r || r.isActive === false) return false;
        const eventMatch = !r.eventId || r.eventId === "*" || r.eventId === eventId;
        const ticketMatch =
          r.ticketId === ticketId ||
          r.ticketName === ticketType ||
          r.ticketTitle === ticketType ||
          (ticketId && r.ticketId?.toLowerCase() === ticketId?.toLowerCase()) ||
          (ticketType && r.ticketName?.toLowerCase() === ticketType?.toLowerCase());
        return eventMatch && ticketMatch;
      });
    }
  }

  if (matchedTicketRule && matchedTicketRule.isActive !== false) {
    if (isPaid && matchedTicketRule.paidEligible === false) {
      isEligible = false;
      baseRate = 0;
    } else if (!isPaid && matchedTicketRule.freeEligible === false) {
      isEligible = false;
      baseRate = 0;
    } else {
      baseRate = Number(
        matchedTicketRule.points ??
        (isPaid ? (matchedTicketRule.paidPoints ?? 20) : (matchedTicketRule.freePoints ?? 10))
      );
    }
    appliedRule = {
      level: "ticket",
      ruleId: matchedTicketRule.id || ticketId || "ticket_rule",
      name: matchedTicketRule.ticketName || matchedTicketRule.ticketTitle || ticketType || "Ticket-Specific Rule",
      rate: baseRate,
      isCombo: Boolean(matchedTicketRule.isCombo || isCombo),
      description: `Ticket rule: ${matchedTicketRule.ticketName || ticketType || "Custom Ticket"} (${baseRate} pts/ticket)`,
    };
  }

  // ── 2. Check Event-Specific Rule (Priority 2) ──
  if (!appliedRule) {
    let matchedEventRule = null;
    if (eventId && rules.eventOverrides && typeof rules.eventOverrides === "object") {
      matchedEventRule = rules.eventOverrides[eventId] || Object.values(rules.eventOverrides).find((r) => r.eventId === eventId);
    }

    if (matchedEventRule && matchedEventRule.isActive !== false) {
      if (isPaid && matchedEventRule.paidEligible === false) {
        isEligible = false;
        baseRate = 0;
      } else if (!isPaid && matchedEventRule.freeEligible === false) {
        isEligible = false;
        baseRate = 0;
      } else {
        if (isPaid) {
          if (matchedEventRule.paidType === "fixed") {
            baseRate = Number(matchedEventRule.paidRegistrationPoints ?? 20);
          } else {
            const mult = Number(matchedEventRule.paidMultiplier ?? 2);
            const freeBase = Number(matchedEventRule.freeRegistrationPoints ?? globalConfig.freeRegistrationPoints ?? 10);
            baseRate = mult * freeBase;
          }
        } else {
          baseRate = Number(matchedEventRule.freeRegistrationPoints ?? 10);
        }
      }
      appliedRule = {
        level: "event",
        ruleId: eventId,
        name: matchedEventRule.eventName || matchedEventRule.eventTitle || "Event-Specific Rule",
        rate: baseRate,
        description: `Event override: ${matchedEventRule.eventName || eventId} (${baseRate} pts/ticket)`,
      };
    }
  }

  // ── 3. Fallback to Global Default (Priority 3) ──
  if (!appliedRule) {
    if (rules.global && rules !== DEFAULT_POINTS_RULES) {
      const globalConfig = rules.global;
      if (isPaid && globalConfig.paidEligible === false) {
        isEligible = false;
        baseRate = 0;
      } else if (!isPaid && globalConfig.freeEligible === false) {
        isEligible = false;
        baseRate = 0;
      } else {
        if (isPaid) {
          if (globalConfig.paidType === "fixed") {
            baseRate = Number(globalConfig.paidRegistrationPoints ?? 20);
          } else {
            baseRate = Number(globalConfig.paidMultiplier ?? 2) * Number(globalConfig.freeRegistrationPoints ?? 10);
          }
        } else {
          baseRate = Number(globalConfig.freeRegistrationPoints ?? 10);
        }
      }
    } else {
      // Legacy top-level rules structure / DEFAULT_POINTS_RULES
      if (isPaid) {
        if (rules.paidRegistrationPoints !== undefined) {
          baseRate = Number(rules.paidRegistrationPoints);
        } else if (rules.paidMultiplier !== undefined) {
          baseRate = Number(rules.paidMultiplier) * Number(rules.freeRegistrationPoints ?? DEFAULT_POINTS_RULES.freeRegistrationPoints);
        } else {
          baseRate = Number(DEFAULT_POINTS_RULES.paidRegistrationPoints);
        }
      } else {
        baseRate = Number(rules.freeRegistrationPoints ?? DEFAULT_POINTS_RULES.freeRegistrationPoints);
      }
    }

    appliedRule = {
      level: "global",
      ruleId: "global_default",
      name: "Global Default Rule",
      rate: baseRate,
      description: `Global program default (${baseRate} pts/ticket)`,
    };
  }

  const basePoints = isEligible ? Math.max(0, Math.round(baseRate * count)) : 0;

  // ── 4. Bonus Points Engine (Evaluated Separately) ──
  let bonusPoints = 0;
  let achievedMilestone = null;
  const bonusBreakdown = [];
  const regTime = registrationTimestamp ? new Date(registrationTimestamp).getTime() : Date.now();
  const newTotal = currentRegistrationsCount + count;

  // 4a. Custom Bonus Rules
  if (Array.isArray(rules.bonusRules) && rules.bonusRules.length > 0) {
    for (const bRule of rules.bonusRules) {
      if (!bRule || bRule.isActive === false) continue;

      // Event condition
      if (Array.isArray(bRule.applicableEvents) && bRule.applicableEvents.length > 0) {
        if (!bRule.applicableEvents.includes("*") && (!eventId || !bRule.applicableEvents.includes(eventId))) {
          continue;
        }
      }

      // Ticket condition
      if (Array.isArray(bRule.applicableTickets) && bRule.applicableTickets.length > 0) {
        if (
          !bRule.applicableTickets.includes("*") &&
          (!ticketId || !bRule.applicableTickets.includes(ticketId)) &&
          (!ticketType || !bRule.applicableTickets.includes(ticketType))
        ) {
          continue;
        }
      }

      // Free / Paid condition
      if (bRule.applicableTo === "free_only" && isPaid) continue;
      if (bRule.applicableTo === "paid_only" && !isPaid) continue;

      // Time condition
      if (bRule.startDate && regTime < new Date(bRule.startDate).getTime()) continue;
      if (bRule.endDate && regTime > new Date(bRule.endDate).getTime()) continue;

      // Milestone condition
      if (bRule.bonusType === "milestone" || bRule.milestoneThreshold) {
        const threshold = Number(bRule.milestoneThreshold || bRule.threshold);
        const milestoneKey = bRule.id || `milestone_${threshold}`;
        // Prevent duplicate milestone awards to the same ambassador
        if (awardedMilestoneIds.includes(milestoneKey) || awardedMilestoneIds.includes(String(threshold))) {
          continue;
        }
        if (currentRegistrationsCount < threshold && newTotal >= threshold) {
          const pts = Number(bRule.bonusPoints || 0);
          bonusPoints += pts;
          achievedMilestone = threshold;
          bonusBreakdown.push({
            ruleId: milestoneKey,
            name: bRule.name || `Milestone: ${threshold} Referrals`,
            type: "milestone",
            bonusPoints: pts,
            threshold,
          });
        }
      } else {
        // Standard / Early bird / Booster bonus
        const pts = Number(bRule.bonusPoints || 0);
        bonusPoints += pts;
        bonusBreakdown.push({
          ruleId: bRule.id || "bonus_custom",
          name: bRule.name || "Custom Bonus",
          type: bRule.bonusType || "custom",
          bonusPoints: pts,
        });
      }
    }
  }

  // 4b. Legacy Milestones (Backward Compatibility)
  if (Array.isArray(rules.milestones)) {
    for (const m of rules.milestones) {
      const threshold = Number(m.threshold);
      const milestoneKey = `milestone_${threshold}`;
      const alreadyIncluded = bonusBreakdown.some((b) => b.threshold === threshold);
      const alreadyAwarded =
        awardedMilestoneIds.includes(milestoneKey) || awardedMilestoneIds.includes(String(threshold));

      if (!alreadyIncluded && !alreadyAwarded) {
        if (currentRegistrationsCount < threshold && newTotal >= threshold) {
          const pts = Number(m.bonusPoints || 0);
          bonusPoints += pts;
          achievedMilestone = threshold;
          bonusBreakdown.push({
            ruleId: milestoneKey,
            name: `Milestone: ${threshold} Referrals`,
            type: "milestone",
            bonusPoints: pts,
            threshold,
          });
        }
      }
    }
  }

  return {
    basePoints,
    bonusPoints,
    totalPoints: basePoints + bonusPoints,
    achievedMilestone,
    appliedRule,
    bonusBreakdown,
    eligible: isEligible && (basePoints > 0 || bonusPoints > 0),
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
  ticketId = "general",
  ticketType = "Standard Ticket",
  isCombo = false,
  ticketConfig = null,
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

  // 3. Check previously awarded milestones to prevent duplicate awards
  const pastLedgerSnap = await adminDb
    .collection("pointsLedger")
    .where("ambassadorId", "==", ambassadorId)
    .where("programId", "==", programId)
    .where("status", "==", "completed")
    .get();

  const awardedMilestoneIds = [];
  pastLedgerSnap.docs.forEach((d) => {
    const data = d.data();
    if (Array.isArray(data.bonusBreakdown)) {
      data.bonusBreakdown.forEach((b) => {
        if (b.type === "milestone") {
          if (b.ruleId) awardedMilestoneIds.push(b.ruleId);
          if (b.threshold) awardedMilestoneIds.push(String(b.threshold));
        }
      });
    }
    if (data.achievedMilestone) {
      awardedMilestoneIds.push(String(data.achievedMilestone));
    }
  });

  // 4. Resolve points rules & calculate
  const effectiveTicketId = ticketId || ticketConfig?.id || "general";
  const effectiveTicketType = ticketType || ticketConfig?.title || "Standard Ticket";
  const effectiveIsCombo = Boolean(isCombo || ticketConfig?.tierType === "combo" || ticketConfig?.isCombo);

  const rules = await resolvePointsRule(programId, eventId, effectiveTicketId);
  const calculation = calculateEarnedPoints({
    isPaid,
    ticketCount,
    currentRegistrationsCount: currentReferralCount,
    rules,
    eventId,
    ticketId: effectiveTicketId,
    ticketType: effectiveTicketType,
    isCombo: effectiveIsCombo,
    awardedMilestoneIds,
  });

  if (calculation.totalPoints <= 0) {
    return {
      totalPoints: 0,
      awarded: false,
      reason: "Rule evaluated to zero points or ticket is marked ineligible",
    };
  }

  // 5. Fetch event title for readable ledger recording
  let eventTitle = "";
  if (eventId) {
    try {
      const evDoc = await adminDb.collection("events").doc(eventId).get();
      if (evDoc.exists) {
        eventTitle = evDoc.data().name || evDoc.data().title || "";
      }
    } catch {}
  }

  // 6. Atomic Transaction: Append to pointsLedger and increment ambassador balance
  const ledgerRef = adminDb.collection("pointsLedger").doc();
  const ledgerData = {
    id: ledgerRef.id,
    idempotencyKey,
    ambassadorId,
    ambassadorName: ambData.fullName || ambData.name || "Ambassador",
    userId: userId || ambData.userId || ambassadorId,
    programId,
    eventId: eventId || null,
    eventTitle,
    orderId: orderId || null,
    registrationId: registrationId || null,
    referralCode: referralCode || ambData.referralCode || "",
    ticketId: effectiveTicketId,
    ticketType: effectiveTicketType,
    isCombo: effectiveIsCombo,
    ruleId: rules.id || rules.ruleId || "default_v1",
    ruleVersion: rules.version || 1,
    appliedRule: calculation.appliedRule,
    bonusBreakdown: calculation.bonusBreakdown || [],
    achievedMilestone: calculation.achievedMilestone || null,
    basePoints: calculation.basePoints,
    bonusPoints: calculation.bonusPoints,
    totalPoints: calculation.totalPoints,
    entryType: calculation.bonusPoints > 0 ? "earn_with_bonus" : "earn",
    reason: calculation.appliedRule?.description
      ? `${calculation.appliedRule.description}${calculation.bonusBreakdown?.length > 0 ? ` + ${calculation.bonusBreakdown.map((b) => b.name).join(", ")}` : ""}`
      : isPaid
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
    basePoints: calculation.basePoints,
    bonusPoints: calculation.bonusPoints,
    newBalance: currentPoints + calculation.totalPoints,
    appliedRule: calculation.appliedRule,
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
      ambassadorName: original.ambassadorName || "Ambassador",
      userId: original.userId,
      programId: original.programId,
      eventId: original.eventId,
      eventTitle: original.eventTitle || "",
      orderId: original.orderId,
      registrationId: original.registrationId,
      referralCode: original.referralCode,
      ticketId: original.ticketId || "general",
      ticketType: original.ticketType || "Standard Ticket",
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
  if (!adminDb || !ambassadorId || !programId || pointsAdjustment === undefined || pointsAdjustment === null) {
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
    ambassadorName: ambData.fullName || ambData.name || "Ambassador",
    userId: ambData.userId,
    programId,
    eventId: null,
    eventTitle: "Manual Adjustment",
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


