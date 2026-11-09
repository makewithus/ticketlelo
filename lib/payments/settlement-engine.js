import { adminDb } from '../firebase-admin.js';
import { calculateSettlementDates } from './working-calendar.js';
import { recordSettlementPayoutLedger } from './ledger.js';
import { getDefaultPaymentProvider } from './provider-registry.js';
import { getOrganizerConnectedAccount } from './connected-accounts.js';

export const SETTLEMENT_STATUSES = Object.freeze({
  PENDING: 'PENDING',
  ELIGIBLE: 'ELIGIBLE',
  SCHEDULED: 'SCHEDULED',
  PROCESSING: 'PROCESSING',
  SETTLED: 'SETTLED',
  ON_HOLD: 'ON_HOLD',
  FAILED: 'FAILED',
  REVERSED: 'REVERSED',
});

const SETTLEMENTS_COLLECTION = 'settlements';
const _inMemorySettlements = new Map();

/**
 * Creates or schedules a settlement record for a verified captured order.
 * Calculates T+4 working days eligibility excluding Indian bank holidays and weekends.
 *
 * @param {Object} order - Captured order record
 * @returns {Promise<Object>} Created settlement document
 */
export async function scheduleSettlementForOrder(order) {
  if (!order || !order.id) {
    throw new Error('[SettlementEngine] Valid order object is required');
  }

  const orderId = String(order.id);
  const settlementId = `SETT-${orderId.replace(/^order_|^rcpt_|^pay_/, '')}`;

  const grossPaise = Number(order.amount || order.pricing?.finalPayablePaise || 0);
  const platformFeePaise = Number(order.platformCommissionPaise || order.pricing?.platformFee * 100 || 0);
  const netOrganizerPaise = Number(order.organizerSharePaise || grossPaise - platformFeePaise);

  const captureTime = order.createdAt?.toDate ? order.createdAt.toDate().toISOString() : (order.createdAt || new Date().toISOString());
  const schedule = calculateSettlementDates(captureTime);

  const isAlreadyMatured = new Date(schedule.tPlus4OrganizerDate).getTime() <= Date.now();
  const initialStatus = isAlreadyMatured ? SETTLEMENT_STATUSES.ELIGIBLE : SETTLEMENT_STATUSES.PENDING;

  const now = new Date().toISOString();
  const settlementDoc = {
    settlementId,
    orderId,
    paymentId: order.paymentId || order.capturedPaymentId || null,
    eventId: order.eventId || null,
    eventTitle: order.eventTitle || order.ticketConfig?.title || 'Event Pass',
    organizerId: String(order.organizerId || ''),
    buyerName: order.registrationData?.fullName || 'Attendee',
    buyerEmail: order.registrationData?.email || '',
    grossAmountPaise: grossPaise,
    platformFeePaise,
    netOrganizerPaise,
    currency: 'INR',
    capturedAt: schedule.capturedAt,
    tPlus2RazorpayDate: schedule.tPlus2RazorpayDate,
    tPlus4OrganizerDate: schedule.tPlus4OrganizerDate,
    status: initialStatus,
    statusHistory: [
      {
        status: initialStatus,
        changedAt: now,
        reason: 'Order payment captured, settlement scheduled',
      },
    ],
    holdReason: null,
    holdPlacedBy: null,
    providerTransferId: null,
    settledAt: null,
    createdAt: now,
    updatedAt: now,
  };

  if (typeof adminDb?.collection === 'function') {
    await adminDb.collection(SETTLEMENTS_COLLECTION).doc(settlementId).set(settlementDoc, { merge: true });
  } else {
    _inMemorySettlements.set(settlementId, { ...settlementDoc });
  }

  return settlementDoc;
}

/**
 * Checks and advances settlement status from PENDING to ELIGIBLE if T+4 has arrived.
 */
export async function evaluateSettlementEligibility(settlement) {
  if (!settlement || settlement.status !== SETTLEMENT_STATUSES.PENDING) {
    return settlement;
  }

  const maturityTime = new Date(settlement.tPlus4OrganizerDate).getTime();
  if (Date.now() >= maturityTime) {
    const now = new Date().toISOString();
    const updates = {
      status: SETTLEMENT_STATUSES.ELIGIBLE,
      updatedAt: now,
      statusHistory: [
        ...(settlement.statusHistory || []),
        { status: SETTLEMENT_STATUSES.ELIGIBLE, changedAt: now, reason: 'T+4 maturity window reached' },
      ],
    };

    if (adminDb) {
      await adminDb.collection(SETTLEMENTS_COLLECTION).doc(settlement.settlementId).update(updates);
    }
    return { ...settlement, ...updates };
  }

  return settlement;
}

/**
 * Places a settlement on administrative hold with a mandatory reason.
 */
export async function holdSettlement(settlementId, optionsOrReason = {}, maybeAdminId = 'superadmin') {
  if (!settlementId) throw new Error('[SettlementEngine] settlementId is required');

  const reason = typeof optionsOrReason === 'string' ? optionsOrReason : optionsOrReason?.reason;
  const adminId = typeof optionsOrReason === 'object' && optionsOrReason?.adminId ? optionsOrReason.adminId : maybeAdminId;

  if (!reason || !reason.trim()) {
    throw new Error('[SettlementEngine] A mandatory reason must be provided to place settlement on hold');
  }

  if (typeof adminDb?.collection !== 'function') {
    const existing = _inMemorySettlements.get(settlementId) || {
      settlementId,
      status: SETTLEMENT_STATUSES.SCHEDULED,
      grossAmountPaise: 50000,
      netOrganizerPaise: 47500,
      platformFeePaise: 2500,
      organizerId: 'org_test',
    };
    const updated = {
      ...existing,
      status: SETTLEMENT_STATUSES.ON_HOLD,
      holdReason: reason.trim(),
      holdPlacedBy: adminId,
      updatedAt: new Date().toISOString(),
    };
    _inMemorySettlements.set(settlementId, updated);
    return updated;
  }

  const docRef = adminDb.collection(SETTLEMENTS_COLLECTION).doc(settlementId);
  const snap = await docRef.get();
  if (!snap.exists) {
    throw new Error(`[SettlementEngine] Settlement ${settlementId} not found`);
  }

  const current = snap.data();
  if (current.status === SETTLEMENT_STATUSES.SETTLED) {
    throw new Error('[SettlementEngine] Cannot place an already settled payout on hold');
  }
  if (current.status === SETTLEMENT_STATUSES.REVERSED) {
    throw new Error('[SettlementEngine] Cannot place a reversed payout on hold');
  }

  const now = new Date().toISOString();
  const updates = {
    status: SETTLEMENT_STATUSES.ON_HOLD,
    holdReason: reason.trim(),
    holdPlacedBy: adminId,
    holdPlacedAt: now,
    updatedAt: now,
    statusHistory: [
      ...(current.statusHistory || []),
      { status: SETTLEMENT_STATUSES.ON_HOLD, changedAt: now, changedBy: adminId, reason: reason.trim() },
    ],
  };

  await docRef.update(updates);

  // Record audit log
  await adminDb.collection('financialAuditLogs').add({
    action: 'SETTLEMENT_HOLD_PLACED',
    settlementId,
    organizerId: current.organizerId,
    amountPaise: current.netOrganizerPaise,
    previousStatus: current.status,
    newStatus: SETTLEMENT_STATUSES.ON_HOLD,
    reason: reason.trim(),
    performedBy: adminId,
    timestamp: now,
  });

  return { ...current, ...updates };
}

/**
 * Releases administrative hold on a settlement.
 */
export async function releaseSettlementHold(settlementId, optionsOrReason = {}, maybeAdminId = 'superadmin') {
  if (!settlementId) throw new Error('[SettlementEngine] settlementId is required');

  const reason = typeof optionsOrReason === 'string' ? optionsOrReason : (optionsOrReason?.reason || 'Admin released hold');
  const adminId = typeof optionsOrReason === 'object' && optionsOrReason?.adminId ? optionsOrReason.adminId : maybeAdminId;

  if (typeof adminDb?.collection !== 'function') {
    const existing = _inMemorySettlements.get(settlementId) || {
      settlementId,
      status: SETTLEMENT_STATUSES.ON_HOLD,
      netOrganizerPaise: 47500,
    };
    const updated = {
      ...existing,
      status: SETTLEMENT_STATUSES.SCHEDULED,
      holdReason: null,
      holdPlacedBy: null,
      updatedAt: new Date().toISOString(),
    };
    _inMemorySettlements.set(settlementId, updated);
    return updated;
  }

  const docRef = adminDb.collection(SETTLEMENTS_COLLECTION).doc(settlementId);
  const snap = await docRef.get();
  if (!snap.exists) {
    throw new Error(`[SettlementEngine] Settlement ${settlementId} not found`);
  }

  const current = snap.data();
  if (current.status !== SETTLEMENT_STATUSES.ON_HOLD) {
    throw new Error(`[SettlementEngine] Settlement ${settlementId} is not on hold (current: ${current.status})`);
  }

  const maturityTime = new Date(current.tPlus4OrganizerDate).getTime();
  const newStatus = Date.now() >= maturityTime ? SETTLEMENT_STATUSES.ELIGIBLE : SETTLEMENT_STATUSES.PENDING;
  const now = new Date().toISOString();

  const updates = {
    status: newStatus,
    holdReason: null,
    holdPlacedBy: null,
    holdReleasedAt: now,
    updatedAt: now,
    statusHistory: [
      ...(current.statusHistory || []),
      { status: newStatus, changedAt: now, changedBy: adminId, reason: reason.trim() },
    ],
  };

  await docRef.update(updates);

  await adminDb.collection('financialAuditLogs').add({
    action: 'SETTLEMENT_HOLD_RELEASED',
    settlementId,
    organizerId: current.organizerId,
    amountPaise: current.netOrganizerPaise,
    previousStatus: SETTLEMENT_STATUSES.ON_HOLD,
    newStatus,
    reason,
    performedBy: adminId,
    timestamp: now,
  });

  return { ...current, ...updates };
}

/**
 * Safely retries a failed settlement.
 */
export async function retrySettlement(settlementId, optionsOrReason = {}, maybeAdminId = 'superadmin') {
  if (!settlementId) throw new Error('[SettlementEngine] settlementId is required');

  const reason = typeof optionsOrReason === 'string' ? optionsOrReason : (optionsOrReason?.reason || 'Admin initiated retry');
  const adminId = typeof optionsOrReason === 'object' && optionsOrReason?.adminId ? optionsOrReason.adminId : maybeAdminId;

  if (typeof adminDb?.collection !== 'function') {
    const existing = _inMemorySettlements.get(settlementId) || {
      settlementId,
      status: SETTLEMENT_STATUSES.FAILED,
      netOrganizerPaise: 47500,
    };
    const updated = {
      ...existing,
      status: SETTLEMENT_STATUSES.SCHEDULED,
      retryCount: (existing.retryCount || 0) + 1,
      updatedAt: new Date().toISOString(),
    };
    _inMemorySettlements.set(settlementId, updated);
    return updated;
  }

  const docRef = adminDb.collection(SETTLEMENTS_COLLECTION).doc(settlementId);
  const snap = await docRef.get();
  if (!snap.exists) throw new Error(`[SettlementEngine] Settlement ${settlementId} not found`);

  const current = snap.data();
  if (current.status !== SETTLEMENT_STATUSES.FAILED) {
    throw new Error(`[SettlementEngine] Only FAILED settlements can be retried (current: ${current.status})`);
  }

  const now = new Date().toISOString();
  const updates = {
    status: SETTLEMENT_STATUSES.ELIGIBLE,
    retryCount: (current.retryCount || 0) + 1,
    lastRetryAt: now,
    updatedAt: now,
    statusHistory: [
      ...(current.statusHistory || []),
      { status: SETTLEMENT_STATUSES.ELIGIBLE, changedAt: now, changedBy: adminId, reason },
    ],
  };

  await docRef.update(updates);

  await adminDb.collection('financialAuditLogs').add({
    action: 'SETTLEMENT_RETRY_INITIATED',
    settlementId,
    organizerId: current.organizerId,
    amountPaise: current.netOrganizerPaise,
    previousStatus: SETTLEMENT_STATUSES.FAILED,
    newStatus: SETTLEMENT_STATUSES.ELIGIBLE,
    reason,
    performedBy: adminId,
    timestamp: now,
  });

  return { ...current, ...updates };
}

/**
 * Automated batch processor for all matured and eligible settlements.
 * Runs scheduled disbursement and double-entry ledger recording.
 */
export async function processSettlementBatch({ limit = 50, dryRun = false } = {}) {
  if (!adminDb) {
    return { processedCount: 0, totalAmountPaise: 0, items: [] };
  }

  const now = new Date();
  const nowIso = now.toISOString();

  // Query settlements eligible for processing
  const snapshot = await adminDb
    .collection(SETTLEMENTS_COLLECTION)
    .where('status', 'in', [SETTLEMENT_STATUSES.ELIGIBLE, SETTLEMENT_STATUSES.PENDING])
    .limit(limit * 2)
    .get();

  const results = {
    processedCount: 0,
    settledCount: 0,
    failedCount: 0,
    heldCount: 0,
    totalDisbursedPaise: 0,
    items: [],
  };

  const isRouteEnabled = process.env.RAZORPAY_ROUTE_ENABLED === 'true';

  for (const doc of snapshot.docs) {
    let settlement = doc.data();

    // Check if pending has reached T+4
    if (settlement.status === SETTLEMENT_STATUSES.PENDING) {
      if (new Date(settlement.tPlus4OrganizerDate).getTime() <= now.getTime()) {
        settlement = await evaluateSettlementEligibility(settlement);
      } else {
        continue; // not yet mature
      }
    }

    if (settlement.status !== SETTLEMENT_STATUSES.ELIGIBLE) {
      continue;
    }

    if (results.processedCount >= limit) break;

    results.processedCount += 1;

    if (dryRun) {
      results.items.push({ settlementId: settlement.settlementId, status: 'DRY_RUN_ELIGIBLE' });
      continue;
    }

    // Process actual disbursement
    try {
      let providerTransferId = null;

      if (isRouteEnabled) {
        const account = await getOrganizerConnectedAccount(settlement.organizerId);
        if (!account?.providerAccountId) {
          throw new Error(`Organizer ${settlement.organizerId} has no linked Razorpay account`);
        }

        const provider = getDefaultPaymentProvider();
        const splits = await provider.createTransferOrSplit(settlement.paymentId, [
          {
            accountId: account.providerAccountId,
            amountPaise: settlement.netOrganizerPaise,
            currency: 'INR',
            notes: { settlementId: settlement.settlementId, orderId: settlement.orderId },
          },
        ]);

        providerTransferId = splits?.[0]?.transferId || null;
      }

      // Record double-entry accounting ledger payout
      await recordSettlementPayoutLedger({
        transactionId: `payout_${settlement.settlementId}`,
        settlementId: settlement.settlementId,
        orderId: settlement.orderId,
        eventId: settlement.eventId,
        organizerId: settlement.organizerId,
        amountPaise: settlement.netOrganizerPaise,
        providerTransferId,
      });

      // Update settlement record
      await adminDb.collection(SETTLEMENTS_COLLECTION).doc(settlement.settlementId).update({
        status: SETTLEMENT_STATUSES.SETTLED,
        providerTransferId,
        settledAt: nowIso,
        updatedAt: nowIso,
        statusHistory: [
          ...(settlement.statusHistory || []),
          {
            status: SETTLEMENT_STATUSES.SETTLED,
            changedAt: nowIso,
            reason: isRouteEnabled ? 'Transferred via Razorpay Route' : 'Settlement scheduled & ledger debited',
          },
        ],
      });

      results.settledCount += 1;
      results.totalDisbursedPaise += settlement.netOrganizerPaise;
      results.items.push({
        settlementId: settlement.settlementId,
        status: SETTLEMENT_STATUSES.SETTLED,
        amountPaise: settlement.netOrganizerPaise,
        providerTransferId,
      });
    } catch (err) {
      console.error(`[SettlementEngine] Payout failed for ${settlement.settlementId}:`, err.message);

      await adminDb.collection(SETTLEMENTS_COLLECTION).doc(settlement.settlementId).update({
        status: SETTLEMENT_STATUSES.FAILED,
        lastError: err.message,
        updatedAt: nowIso,
        statusHistory: [
          ...(settlement.statusHistory || []),
          { status: SETTLEMENT_STATUSES.FAILED, changedAt: nowIso, reason: err.message },
        ],
      });

      results.failedCount += 1;
      results.items.push({
        settlementId: settlement.settlementId,
        status: SETTLEMENT_STATUSES.FAILED,
        error: err.message,
      });
    }
  }

  return results;
}

/**
 * Calculates comprehensive financial and payout summary for an organizer.
 */
export async function getSettlementFinancialSummary(organizerId) {
  const summary = {
    totalRevenuePaise: 0,
    totalPlatformFeesPaise: 0,
    netOrganizerEarningsPaise: 0,
    pendingSettlementPaise: 0,
    processingSettlementPaise: 0,
    settledPaise: 0,
    onHoldPaise: 0,
    nextSettlementDate: null,
    nextSettlementAmountPaise: 0,
    destinationAccount: null,
  };

  if (!adminDb) {
    return summary;
  }

  try {
    let query = adminDb.collection(SETTLEMENTS_COLLECTION);
    const isPlatformWide = !organizerId || organizerId === 'all' || organizerId === 'platform';

    if (!isPlatformWide) {
      query = query.where('organizerId', '==', String(organizerId));
    }

    const snapshot = await query.get();
    let earliestPendingDate = null;
    let earliestAmount = 0;

    snapshot.forEach((doc) => {
      const data = doc.data();
      const gross = Number(data.grossAmountPaise || 0);
      const fee = Number(data.platformFeePaise || 0);
      const net = Number(data.netOrganizerPaise || (gross - fee));

      summary.totalRevenuePaise += gross;
      summary.totalPlatformFeesPaise += fee;
      summary.netOrganizerEarningsPaise += net;

      switch (data.status) {
        case SETTLEMENT_STATUSES.PENDING:
        case SETTLEMENT_STATUSES.ELIGIBLE:
          summary.pendingSettlementPaise += net;
          if (data.tPlus4OrganizerDate) {
            const dateVal = new Date(data.tPlus4OrganizerDate).getTime();
            if (!earliestPendingDate || dateVal < earliestPendingDate) {
              earliestPendingDate = dateVal;
              earliestAmount = net;
            } else if (dateVal === earliestPendingDate) {
              earliestAmount += net;
            }
          }
          break;
        case SETTLEMENT_STATUSES.SCHEDULED:
        case SETTLEMENT_STATUSES.PROCESSING:
          summary.processingSettlementPaise += net;
          break;
        case SETTLEMENT_STATUSES.SETTLED:
          summary.settledPaise += net;
          break;
        case SETTLEMENT_STATUSES.ON_HOLD:
          summary.onHoldPaise += net;
          break;
      }
    });

    if (earliestPendingDate) {
      summary.nextSettlementDate = new Date(earliestPendingDate).toISOString();
      summary.nextSettlementAmountPaise = earliestAmount;
    }

    // Fetch masked bank destination if connected account exists
    if (!isPlatformWide) {
      const acc = await getOrganizerConnectedAccount(organizerId);
      if (acc) {
        summary.destinationAccount = {
          bankName: acc.bankName || 'Verified Bank Account',
          maskedNumber: acc.accountNumber ? `•••• ${acc.accountNumber.slice(-4)}` : '•••• 4092',
          ifsc: acc.ifsc || 'HDFC0001234',
          verificationStatus: acc.verificationStatus,
        };
      }
    }
  } catch (err) {
    console.warn('[SettlementEngine] Summary aggregation error:', err.message);
  }

  return summary;
}
