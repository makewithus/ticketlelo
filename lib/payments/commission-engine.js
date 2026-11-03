import { COMMISSION_TYPES } from './types.js';
import { adminDb } from '../firebase-admin.js';

/**
 * Default global platform commission rule
 * 3.00% platform commission, 0 fixed fee, in INR.
 */
export const DEFAULT_COMMISSION_RULE = Object.freeze({
  version: 1,
  targetType: 'global',
  targetId: 'platform_default',
  commissionType: COMMISSION_TYPES.PERCENTAGE,
  ratePercent: 3.00, // 3%
  fixedFeePaise: 0,
  minCommissionPaise: 0,
  maxCommissionPaise: null,
  currency: 'INR',
  active: true
});

/**
 * Validates monetary inputs to ensure integer paise and positive amounts
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
        ratePercent: rule?.ratePercent ?? 3.00,
        fixedFeePaise: rule?.fixedFeePaise ?? 0
      }
    };
  }

  const commissionType = rule.commissionType || COMMISSION_TYPES.PERCENTAGE;
  const ratePercent = typeof rule.ratePercent === 'number' ? Math.max(0, rule.ratePercent) : 0;
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
      // Default fallback to 3%
      calculatedCommissionPaise = Math.round((grossAmountPaise * 300) / 10000);
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

  // Separate GST on platform commission if applicable (e.g. 18% standard GST on service charge)
  // Note: Represented separately without mutating organizerSharePaise
  const gstRate = typeof rule.gstRatePercent === 'number' ? rule.gstRatePercent : 18;
  const taxOnCommissionPaise = Math.round((calculatedCommissionPaise * Math.round(gstRate * 100)) / 10000);

  // Gateway fee estimate (e.g. Razorpay standard 2% + 18% GST on fee = 2.36%)
  // Tracked for ledger reporting
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
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * Resolves the applicable commission rule from Firestore by precedence:
 * 1. Event-specific rule (`targetType: 'event'`, `targetId: eventId`)
 * 2. Organizer-specific rule (`targetType: 'organizer'`, `targetId: organizerId`)
 * 3. Platform default rule (`targetType: 'global'`)
 */
export async function resolveCommissionRule({ eventId, organizerId } = {}) {
  if (!adminDb) {
    return DEFAULT_COMMISSION_RULE;
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

    // 2. Check organizer-specific tier
    if (organizerId) {
      const orgDoc = await coll.doc(`organizer_${organizerId}`).get();
      if (orgDoc.exists) {
        const data = orgDoc.data();
        if (data.active !== false) {
          return { ...data, targetType: 'organizer', targetId: organizerId };
        }
      }
    }

    // 3. Check custom global rule in DB
    const globalDoc = await coll.doc('global_default').get();
    if (globalDoc.exists) {
      const data = globalDoc.data();
      if (data.active !== false) {
        return { ...data, targetType: 'global', targetId: 'platform_default' };
      }
    }
  } catch (err) {
    console.warn('[CommissionEngine] Error resolving rule from Firestore, falling back to default:', err.message);
  }

  return DEFAULT_COMMISSION_RULE;
}

/**
 * Admin method to save or update a versioned commission rule
 */
export async function saveCommissionRule(ruleData) {
  if (!adminDb) {
    throw new Error('[CommissionEngine] Database connection unavailable');
  }

  const {
    targetType, // 'global' | 'organizer' | 'event'
    targetId,
    commissionType = COMMISSION_TYPES.PERCENTAGE,
    ratePercent = 3.0,
    fixedFeePaise = 0,
    minCommissionPaise = 0,
    maxCommissionPaise = null,
    currency = 'INR',
    updatedBy = 'admin'
  } = ruleData;

  if (!['global', 'organizer', 'event'].includes(targetType)) {
    throw new Error(`[CommissionEngine] Invalid targetType: ${targetType}`);
  }

  const docId = targetType === 'global' ? 'global_default' : `${targetType}_${targetId}`;
  const docRef = adminDb.collection('marketplaceCommissions').doc(docId);
  const existing = await docRef.get();
  const currentVersion = existing.exists ? (existing.data().version || 1) : 0;

  const newRule = {
    version: currentVersion + 1,
    targetType,
    targetId: targetId || 'default',
    commissionType,
    ratePercent: Number(ratePercent),
    fixedFeePaise: Number(fixedFeePaise),
    minCommissionPaise: minCommissionPaise ? Number(minCommissionPaise) : null,
    maxCommissionPaise: maxCommissionPaise ? Number(maxCommissionPaise) : null,
    currency,
    active: true,
    updatedBy,
    updatedAt: new Date().toISOString()
  };

  await docRef.set(newRule, { merge: true });
  return newRule;
}
