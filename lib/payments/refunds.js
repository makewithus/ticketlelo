import { adminDb } from '../firebase-admin.js';
import { getDefaultPaymentProvider, getPaymentProvider } from './provider-registry.js';
import { recordRefundLedger } from './ledger.js';
import { PAYMENT_STATUSES, REFUND_STATUSES, REFUND_TYPES } from './types.js';

const REFUNDS_COLLECTION = 'marketplaceRefunds';
const PAYMENTS_COLLECTION = 'orders';

/**
 * Execute full or partial refund for a TicketLelo marketplace order
 */
export async function processMarketplaceRefund({
  orderId,
  amountPaise = null, // null implies full refund
  reason = 'Customer requested refund',
  initiatedBy = 'organizer',
  refundType = REFUND_TYPES.FULL
}) {
  if (!orderId) {
    throw new Error('[Refunds] orderId is required');
  }
  if (!adminDb) {
    throw new Error('[Refunds] Database connection unavailable');
  }

  // 1. Fetch order document
  const orderRef = adminDb.collection(PAYMENTS_COLLECTION).doc(orderId);
  const orderDoc = await orderRef.get();
  if (!orderDoc.exists) {
    throw new Error(`[Refunds] Order ${orderId} not found`);
  }

  const orderData = orderDoc.data();
  const grossPaise = Number(orderData.amount || orderData.finalPayablePaise || 0);
  const previouslyRefundedPaise = Number(orderData.refundedAmountPaise || 0);
  const refundablePaise = grossPaise - previouslyRefundedPaise;

  if (refundablePaise <= 0) {
    throw new Error(`[Refunds] Order ${orderId} is already fully refunded`);
  }

  const targetRefundPaise = amountPaise !== null ? Number(amountPaise) : refundablePaise;

  if (!Number.isInteger(targetRefundPaise) || targetRefundPaise <= 0) {
    throw new TypeError(`[Refunds] Invalid targetRefundPaise: ${targetRefundPaise}`);
  }

  if (targetRefundPaise > refundablePaise) {
    throw new Error(`[Refunds] Requested refund (${targetRefundPaise} paise) exceeds refundable balance (${refundablePaise} paise)`);
  }

  // 2. Calculate split of refund between organizer and platform
  // Proportional breakdown based on original split
  const originalPlatformFee = Number(orderData.platformCommissionPaise || orderData.platformFee || 0);
  const originalOrganizerShare = grossPaise - originalPlatformFee;

  let organizerRefundSharePaise = 0;
  let platformRefundCommissionPaise = 0;

  if (grossPaise > 0) {
    organizerRefundSharePaise = Math.round((targetRefundPaise * originalOrganizerShare) / grossPaise);
    platformRefundCommissionPaise = targetRefundPaise - organizerRefundSharePaise;
  }

  // 3. Invoke Payment Provider Refund
  const providerPaymentId = orderData.razorpayPaymentId || orderData.providerPaymentId;
  let providerRefundResult = null;

  if (providerPaymentId) {
    const provider = getDefaultPaymentProvider();
    providerRefundResult = await provider.refundPayment(providerPaymentId, {
      amountPaise: targetRefundPaise,
      reverseAllTransfers: true, // Route will reverse organizer linked account transfer
      notes: {
        orderId,
        reason,
        platform: 'TicketLelo'
      }
    });
  }

  const refundId = `ref_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  // 4. Record Refund Document in Firestore
  const refundRecord = {
    refundId,
    orderId,
    bookingId: orderData.bookingId || orderId,
    eventId: orderData.eventId || null,
    organizerId: orderData.organizerId || null,
    amountPaise: targetRefundPaise,
    organizerRefundSharePaise,
    platformRefundCommissionPaise,
    providerRefundId: providerRefundResult?.providerRefundId || null,
    refundType: targetRefundPaise === refundablePaise ? REFUND_TYPES.FULL : REFUND_TYPES.PARTIAL,
    status: REFUND_STATUSES.PROCESSED,
    reason,
    initiatedBy,
    createdAt: now
  };

  await adminDb.collection(REFUNDS_COLLECTION).doc(refundId).set(refundRecord);

  // 5. Update Order Document
  const newRefundedTotal = previouslyRefundedPaise + targetRefundPaise;
  const isFullRefund = newRefundedTotal >= grossPaise;

  await orderRef.update({
    refundedAmountPaise: newRefundedTotal,
    paymentStatus: isFullRefund ? PAYMENT_STATUSES.REFUNDED : PAYMENT_STATUSES.PARTIALLY_REFUNDED,
    updatedAt: now
  });

  // 6. Invalidate issued tickets if full refund
  if (isFullRefund && orderData.bookingId) {
    const ticketsSnap = await adminDb
      .collection('tickets')
      .where('bookingId', '==', orderData.bookingId)
      .get();

    const batch = adminDb.batch();
    ticketsSnap.forEach(tDoc => {
      batch.update(tDoc.ref, {
        status: 'cancelled_refunded',
        invalidatedAt: now,
        invalidationReason: reason
      });
    });
    await batch.commit();
  }

  // 7. Write Double-Entry Accounting Ledger
  await recordRefundLedger({
    transactionId: `tx_${refundId}`,
    refundId,
    orderId,
    eventId: orderData.eventId,
    organizerId: orderData.organizerId,
    refundGrossPaise: targetRefundPaise,
    organizerRefundSharePaise,
    platformRefundCommissionPaise
  });

  return {
    success: true,
    refundRecord,
    isFullRefund
  };
}

/**
 * Batch processor for Event Cancellation
 * Iterates through all paid orders for an event, triggers refunds and invalidates tickets
 */
export async function processEventCancellationRefunds(eventId, reason = 'Event cancelled by organizer') {
  if (!eventId) throw new Error('[Refunds] eventId is required');
  if (!adminDb) throw new Error('[Refunds] Database unavailable');

  const ordersSnap = await adminDb
    .collection(PAYMENTS_COLLECTION)
    .where('eventId', '==', String(eventId))
    .where('paymentStatus', 'in', ['CAPTURED', 'TRANSFERRED', 'success', 'paid'])
    .get();

  const results = {
    eventId,
    totalOrders: ordersSnap.size,
    successfulRefunds: 0,
    failedRefunds: 0,
    errors: []
  };

  for (const doc of ordersSnap.docs) {
    try {
      await processMarketplaceRefund({
        orderId: doc.id,
        reason,
        initiatedBy: 'event_cancellation',
        refundType: REFUND_TYPES.EVENT_CANCELLATION
      });
      results.successfulRefunds++;
    } catch (err) {
      console.error(`[Refunds] Cancellation refund failed for order ${doc.id}:`, err.message);
      results.failedRefunds++;
      results.errors.push({ orderId: doc.id, error: err.message });
    }
  }

  return results;
}
