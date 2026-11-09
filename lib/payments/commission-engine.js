import { COMMISSION_TYPES } from './types.js';
import { adminDb } from '../firebase-admin.js';

/**
 * CTO Specification Default Platform Fee Rates by Plan Tier:
 * START:  5.0%
 * CAMPUS: 4.5%
 * FEST:   3.5%
 */
export const DEFAULT_PLAN_COMMISSION_RATES = Object.freeze({
  START: 5.0,   // 5% platform fee
  CAMPUS: 4.5,  // 4.5% platform fee
  FEST: 3.5,    // 3.5% platform fee
});

export const PLAN_ALIASES = Object.freeze({
  free: 'START',
  starter: 'START',
  start: 'START',
  pro: 'CAMPUS',
  campus: 'CAMPUS',
  fest: 'FEST',
  enterprise: 'FEST',
});

/**
 * Normalizes any plan string or alias to canonical 'START' | 'CAMPUS' | 'FEST'
 */
export function normalizePlanId(planId) {
  if (!planId || typeof planId !== 'string') return 'START';
  const clean = planId.trim().toLowerCase();
  return PLAN_ALIASES[clean] || (['START', 'CAMPUS', 'FEST'].includes(planId.toUpperCase()) ? planId.toUpperCase() : 'START');
}

/**
 * Global platform fallback commission rule (if no plan or custom override is matched)
 */
export const DEFAULT_COMMISSION_RULE = Object.freeze({
  version: 1,
  targetType: 'global',
  targetId: 'platform_default',
  commissionType: COMMISSION_TYPES.PERCENTAGE,
  ratePercent: 5.00, // Default 5.0% (START tier baseline)
  fixedFeePaise: 0,
  minCommissionPaise: 0,
  maxCommissionPaise: null,
  currency: 'INR',
  active: true,
});

/**
 * Validates monetary inputs to ensure non-negative integer paise
 */
function validatePaise(amountPaise, fieldName = 'amountPaise') {
  if (typeof amountPaise !== 'number' || !Number.isInteger(amountPaise) || amountPaise < 0) {
    throw new TypeError(`[CommissionEngine] ${fieldName} must be a non-negative integer paise. Received: ${amountPaise}`);
  }
}

/**
 * Pure calculation function for platform commission and organizer net share.
 * Strictly uses integer paise arithmetic.
 *
 * @param {number} grossAmountPaise - Total ticket/order value in paise
 * @param {Object} rule - Commission configuration rule
 * @returns {Object} Immutable calculation breakdown
 */
export function calculateCommissionBreakdown(grossAmountPaise, rule = DEFAULT_COMMISSION_RULE) {
  validatePaise(grossAmountPaise, 'grossAmountPaise');

  const ruleRate = typeof rule?.ratePercent === 'number' ? Math.max(0, rule.ratePercent) : 5.0;

  if (grossAmountPaise === 0) {
    return {
      grossAmountPaise: 0,
      platformCommissionPaise: 0,
      organizerSharePaise: 0,
      gatewayFeeEstimatePaise: 0,
      taxOnCommissionPaise: 0,
      currency: rule?.currency || 'INR',
      ruleSnapshot: {
        version: rule?.version || 1,
        targetType: rule?.targetType || 'global',
        targetId: rule?.targetId || 'default',
        commissionType: rule?.commissionType || COMMISSION_TYPES.PERCENTAGE,
        ratePercent: ruleRate,
        fixedFeePaise: rule?.fixedFeePaise ?? 0,
      },
    };
  }

  const commissionType = rule.commissionType || COMMISSION_TYPES.PERCENTAGE;
  const ratePercent = ruleRate;
  const fixedFeePaise = typeof rule.fixedFeePaise === 'number' ? Math.max(0, Math.round(rule.fixedFeePaise)) : 0;

  let calculatedCommissionPaise = 0;

  switch (commissionType) {
    case COMMISSION_TYPES.PERCENTAGE: {
      // Basis points precision calculation: (gross * (rate * 100)) / 10000
      const basisPoints = Math.round(ratePercent * 100);
      calculatedCommissionPaise = Math.round((grossAmountPaise * basisPoints) / 10000);
      break;
    }
    case COMMISSION_TYPES.FIXED: {
      calculatedCommissionPaise = fixedFeePaise;
      break;
    }
    case COMMISSION_TYPES.PERCENTAGE_PLUS_FIXED: {
      const basisPoints = Math.round(ratePercent * 100);
      const percentagePart = Math.round((grossAmountPaise * basisPoints) / 10000);
      calculatedCommissionPaise = percentagePart + fixedFeePaise;
      break;
    }
    default: {
      calculatedCommissionPaise = Math.round((grossAmountPaise * Math.round(ratePercent * 100)) / 10000);
    }
  }

  // Minimum cap
  if (typeof rule.minCommissionPaise === 'number' && rule.minCommissionPaise > 0) {
    calculatedCommissionPaise = Math.max(calculatedCommissionPaise, Math.round(rule.minCommissionPaise));
  }

  // Maximum cap
  if (typeof rule.maxCommissionPaise === 'number' && rule.maxCommissionPaise > 0) {
    calculatedCommissionPaise = Math.min(calculatedCommissionPaise, Math.round(rule.maxCommissionPaise));
  }

  // Cap commission at gross amount (platform cannot charge more than the ticket price)
  calculatedCommissionPaise = Math.min(grossAmountPaise, Math.max(0, calculatedCommissionPaise));

  // Organizer gets the remainder
  const organizerSharePaise = grossAmountPaise - calculatedCommissionPaise;

  // Invariant verification
  if (calculatedCommissionPaise + organizerSharePaise !== grossAmountPaise) {
    throw new Error(
      `[CommissionEngine] Invariant violation: commission (${calculatedCommissionPaise}) + organizerShare (${organizerSharePaise}) !== gross (${grossAmountPaise})`
    );
  }

  // GST on platform commission (18% standard GST on service charge)
  const gstRate = typeof rule.gstRatePercent === 'number' ? rule.gstRatePercent : 18;
  const taxOnCommissionPaise = Math.round((calculatedCommissionPaise * Math.round(gstRate * 100)) / 10000);

  // Gateway fee estimate (e.g. Razorpay standard 2% + 18% GST = 2.36%)
  const gatewayFeeEstimatePaise = Math.round((grossAmountPaise * 236) / 10000);

  return {
    grossAmountPaise,
    platformCommissionPaise: calculatedCommissionPaise,
    organizerSharePaise,
    gatewayFeeEstimatePaise,
    taxOnCommissionPaise,
    currency: rule.currency || 'INR',
    ruleSnapshot: {
      version: rule.version || 1,
      targetType: rule.targetType || 'global',
      targetId: rule.targetId || 'platform_default',
      commissionType,
      ratePercent,
      fixedFeePaise,
      minCommissionPaise: rule.minCommissionPaise ?? null,
      maxCommissionPaise: rule.maxCommissionPaise ?? null,
      planTier: rule.planTier || null,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Resolves the applicable commission rule by strict precedence:
 * 1. Event-specific override (`targetType: 'event'`, `targetId: eventId`)
 * 2. Organizer-specific override (`targetType: 'organizer'`, `targetId: organizerId`)
 * 3. Organizer's subscription plan tier (`START: 5%`, `CAMPUS: 4.5%`, `FEST: 3.5%`) from Firestore or defaults
 * 4. Custom global rule in DB (`targetType: 'global'`)
 * 5. Default global fallback
 */
export async function resolveCommissionRule({ eventId, organizerId, planId = null, subscriptionPlan = null } = {}) {
  let resolvedPlan = planId || subscriptionPlan ? normalizePlanId(planId || subscriptionPlan) : null;

  if (typeof adminDb?.collection !== 'function') {
    const rate = resolvedPlan ? DEFAULT_PLAN_COMMISSION_RATES[resolvedPlan] : 5.0;
    return {
      ...DEFAULT_COMMISSION_RULE,
      ratePercent: rate || 5.0,
      planTier: resolvedPlan || 'START',
    };
  }

  try {
    const coll = adminDb.collection('marketplaceCommissions');

    // 1. Check event-specific override
    if (eventId) {
      const eventDoc = await coll.doc(`event_${eventId}`).get();
      if (eventDoc.exists) {
        const data = eventDoc.data();
        if (data.active !== false) {
          return { ...data, targetType: 'event', targetId: eventId };
        }
      }
    }

    // 2. Check organizer-specific override
    if (organizerId) {
      const orgDoc = await coll.doc(`organizer_${organizerId}`).get();
      if (orgDoc.exists) {
        const data = orgDoc.data();
        if (data.active !== false) {
          return { ...data, targetType: 'organizer', targetId: organizerId };
        }
      }

      // If plan not explicitly provided, fetch organizer's plan from users collection
      if (!resolvedPlan) {
        try {
          const userDoc = await adminDb.collection('users').doc(String(organizerId)).get();
          if (userDoc.exists) {
            const userData = userDoc.data();
            const rawPlan = userData.subscriptionPlan || userData.plan || userData.currentPlan;
            resolvedPlan = normalizePlanId(rawPlan);
          }
        } catch (_uErr) {
          // ignore user fetch errors, fall back to START
        }
      }
    }

    // 3. Check plan-specific rule in database (configured by Super Admin)
    if (!resolvedPlan) resolvedPlan = 'START';
    const planDoc = await coll.doc(`plan_${resolvedPlan.toLowerCase()}`).get();
    if (planDoc.exists) {
      const data = planDoc.data();
      if (data.active !== false) {
        return {
          ...data,
          targetType: 'plan',
          targetId: resolvedPlan,
          planTier: resolvedPlan,
        };
      }
    }

    // 4. Return canonical default rate for the plan
    const defaultPlanRate = DEFAULT_PLAN_COMMISSION_RATES[resolvedPlan] ?? 5.0;
    return {
      version: 1,
      targetType: 'plan_default',
      targetId: resolvedPlan,
      commissionType: COMMISSION_TYPES.PERCENTAGE,
      ratePercent: defaultPlanRate,
      fixedFeePaise: 0,
      currency: 'INR',
      planTier: resolvedPlan,
      active: true,
    };
  } catch (err) {
    console.warn('[CommissionEngine] Error resolving rule from Firestore, falling back to default:', err.message);
  }

  const defaultRate = resolvedPlan ? (DEFAULT_PLAN_COMMISSION_RATES[resolvedPlan] ?? 5.0) : 5.0;
  return {
    ...DEFAULT_COMMISSION_RULE,
    ratePercent: defaultRate,
    planTier: resolvedPlan || 'START',
  };
}

/**
 * Super Admin method to configure a custom commission rule (global, organizer, or event)
 */
export async function saveCommissionRule({
  targetType = 'global',
  targetId = 'platform_default',
  commissionType = COMMISSION_TYPES.PERCENTAGE,
  ratePercent = 5.0,
  fixedFeePaise = 0,
  minCommissionPaise = null,
  maxCommissionPaise = null,
  currency = 'INR',
  updatedBy = 'admin',
}) {
  const now = new Date().toISOString();

  if (typeof adminDb?.collection !== 'function') {
    return {
      version: 1,
      targetType,
      targetId,
      commissionType,
      ratePercent: Number(ratePercent),
      fixedFeePaise: Number(fixedFeePaise || 0),
      minCommissionPaise: minCommissionPaise ? Number(minCommissionPaise) : null,
      maxCommissionPaise: maxCommissionPaise ? Number(maxCommissionPaise) : null,
      currency,
      active: true,
      updatedBy,
      updatedAt: now,
    };
  }

  const docId = targetType === 'global' ? 'global_default' : `${targetType}_${targetId}`;
  const docRef = adminDb.collection('marketplaceCommissions').doc(docId);
  const snap = await docRef.get();
  const currentVersion = snap.exists ? (snap.data().version || 1) : 0;

  const newRule = {
    version: currentVersion + 1,
    targetType,
    targetId,
    commissionType,
    ratePercent: Number(ratePercent),
    fixedFeePaise: Number(fixedFeePaise || 0),
    minCommissionPaise: minCommissionPaise ? Number(minCommissionPaise) : null,
    maxCommissionPaise: maxCommissionPaise ? Number(maxCommissionPaise) : null,
    currency,
    active: true,
    updatedBy,
    updatedAt: now,
  };

  await docRef.set(newRule, { merge: true });
  return newRule;
}

/**
 * Super Admin method to configure a plan's platform fee rate
 * E.g., START -> 5%, CAMPUS -> 4.5%, FEST -> 3.5%
 */
export async function savePlanCommissionRule({
  planId,
  ratePercent,
  updatedBy = 'admin',
  reason = 'Admin updated platform fee',
}) {
  const canonicalPlan = normalizePlanId(planId);
  const numRate = Number(ratePercent);
  if (isNaN(numRate) || numRate < 0 || numRate > 50) {
    throw new Error('[CommissionEngine] ratePercent must be a valid percentage between 0 and 50%');
  }

  const now = new Date().toISOString();

  if (typeof adminDb?.collection !== 'function') {
    return {
      version: 1,
      targetType: 'plan',
      targetId: canonicalPlan,
      planTier: canonicalPlan,
      commissionType: COMMISSION_TYPES.PERCENTAGE,
      ratePercent: numRate,
      fixedFeePaise: 0,
      currency: 'INR',
      active: true,
      updatedBy,
      updatedAt: now,
    };
  }

  const docId = `plan_${canonicalPlan.toLowerCase()}`;
  const docRef = adminDb.collection('marketplaceCommissions').doc(docId);
  const existing = await docRef.get();
  const currentVersion = existing.exists ? (existing.data().version || 1) : 0;
  const previousRate = existing.exists ? existing.data().ratePercent : DEFAULT_PLAN_COMMISSION_RATES[canonicalPlan];

  const newRule = {
    version: currentVersion + 1,
    targetType: 'plan',
    targetId: canonicalPlan,
    planTier: canonicalPlan,
    commissionType: COMMISSION_TYPES.PERCENTAGE,
    ratePercent: numRate,
    fixedFeePaise: 0,
    currency: 'INR',
    active: true,
    updatedBy,
    updatedAt: now,
  };

  await docRef.set(newRule, { merge: true });

  // Record audit log
  try {
    await adminDb.collection('financialAuditLogs').add({
      action: 'UPDATE_PLATFORM_FEE_RATE',
      target: docId,
      planTier: canonicalPlan,
      previousRate,
      newRate: numRate,
      reason,
      performedBy: updatedBy,
      timestamp: now,
    });
  } catch (_auditErr) {
    console.warn('[CommissionEngine] Failed to record audit log:', _auditErr.message);
  }

  return newRule;
}

/**
 * Retrieves all platform fee configurations for Super Admin inspection
 */
export async function getAllCommissionConfigurations() {
  const defaults = [
    { planTier: 'START', name: 'Start Plan', defaultRate: DEFAULT_PLAN_COMMISSION_RATES.START },
    { planTier: 'CAMPUS', name: 'Campus Plan', defaultRate: DEFAULT_PLAN_COMMISSION_RATES.CAMPUS },
    { planTier: 'FEST', name: 'Fest Plan', defaultRate: DEFAULT_PLAN_COMMISSION_RATES.FEST },
  ];

  if (typeof adminDb?.collection !== 'function') {
    return defaults.map((d) => ({
      ...d,
      currentRate: d.defaultRate,
      version: 1,
      isCustom: false,
    }));
  }

  try {
    const snap = await adminDb.collection('marketplaceCommissions').get();
    const map = new Map();
    snap.forEach((doc) => map.set(doc.id, doc.data()));

    return defaults.map((d) => {
      const docKey = `plan_${d.planTier.toLowerCase()}`;
      const saved = map.get(docKey);
      return {
        ...d,
        currentRate: saved ? Number(saved.ratePercent) : d.defaultRate,
        version: saved?.version || 1,
        updatedAt: saved?.updatedAt || null,
        updatedBy: saved?.updatedBy || null,
        isCustom: Boolean(saved),
      };
    });
  } catch (err) {
    console.warn('[CommissionEngine] Error fetching configurations:', err.message);
    return defaults.map((d) => ({ ...d, currentRate: d.defaultRate, version: 1, isCustom: false }));
  }
}
