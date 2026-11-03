import crypto from 'crypto';
import { adminDb } from '../firebase-admin.js';
import { getDefaultPaymentProvider } from './provider-registry.js';
import {
  CONNECTED_ACCOUNT_STATUSES,
  PAYMENT_STATUSES,
  WEBHOOK_PROCESSING_STATUS
} from './types.js';

const COLLECTION = 'webhookEvents';

/**
 * Validates webhook HMAC signature against raw payload
 */
export function verifyWebhookSignature(rawBody, signature, secret) {
  const webhookSecret = secret || process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!rawBody || !signature || !webhookSecret) {
    return false;
  }

  const expected = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');

  const expectedBuf = Buffer.from(expected, 'utf8');
  const signatureBuf = Buffer.from(signature, 'utf8');

  if (expectedBuf.length !== signatureBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuf, signatureBuf);
}

/**
 * Process a Razorpay webhook event with database-backed idempotency
 */
export async function processWebhookEvent({
  rawBody,
  signature,
  provider = 'razorpay'
}) {
  if (!verifyWebhookSignature(rawBody, signature)) {
    const error = new Error('Invalid webhook signature');
    error.statusCode = 400;
    throw error;
  }

  let eventPayload;
  try {
    eventPayload = typeof rawBody === 'string' ? JSON.parse(rawBody) : JSON.parse(rawBody.toString('utf8'));
  } catch (_e) {
    const error = new Error('Malformed webhook JSON payload');
    error.statusCode = 400;
    throw error;
  }

  const eventId = eventPayload.event_id || eventPayload.id;
  const eventType = eventPayload.event;
  const payloadHash = crypto.createHash('sha256').update(rawBody).digest('hex');

  if (!eventId) {
    throw new Error('Missing event_id in webhook payload');
  }

  if (!adminDb) {
    console.warn('[Webhook] adminDb unavailable, skipping persistence');
    return { status: 'skipped_db_unavailable', eventId };
  }

  // Idempotency check: see if event was already received and processed
  const eventRef = adminDb.collection(COLLECTION).doc(String(eventId));
  const eventDoc = await eventRef.get();

  if (eventDoc.exists) {
    const existing = eventDoc.data();
    if (existing.processingStatus === WEBHOOK_PROCESSING_STATUS.PROCESSED) {
      return {
        status: 'already_processed',
        eventId,
        processedAt: existing.processedAt
      };
    }
  }

  const now = new Date().toISOString();
  await eventRef.set({
    eventId,
    provider,
    eventType,
    payloadHash,
    processingStatus: WEBHOOK_PROCESSING_STATUS.PENDING,
    retryCount: eventDoc.exists ? (eventDoc.data().retryCount || 0) + 1 : 0,
    receivedAt: now
  }, { merge: true });

  try {
    // Dispatch handler based on Route event type
    await dispatchEventHandler(eventType, eventPayload);

    await eventRef.update({
      processingStatus: WEBHOOK_PROCESSING_STATUS.PROCESSED,
      processedAt: new Date().toISOString(),
      errorMessage: null
    });

    return { status: 'success', eventId, eventType };
  } catch (err) {
    console.error(`[Webhook] Error processing event ${eventId} (${eventType}):`, err);
    await eventRef.update({
      processingStatus: WEBHOOK_PROCESSING_STATUS.FAILED,
      lastErrorAt: new Date().toISOString(),
      errorMessage: err.message || 'Unknown processing error'
    });
    throw err;
  }
}

/**
 * Handle specific event types for Razorpay Route
 */
async function dispatchEventHandler(eventType, payload) {
  const entity = payload.payload?.payment?.entity ||
    payload.payload?.transfer?.entity ||
    payload.payload?.account?.entity ||
    payload.payload?.settlement?.entity ||
    payload.payload?.refund?.entity;

  switch (eventType) {
    case 'account.under_review':
    case 'account.activated':
    case 'account.suspended':
    case 'account.rejected': {
      await handleAccountEvent(eventType, entity);
      break;
    }

    case 'transfer.processed':
    case 'transfer.failed': {
      await handleTransferEvent(eventType, entity);
      break;
    }

    case 'settlement.processed': {
      await handleSettlementEvent(entity);
      break;
    }

    case 'payment.captured': {
      // Payment capture updates order and ensures Route split transfer is recorded
      await handlePaymentCapturedEvent(entity);
      break;
    }

    case 'refund.processed': {
      await handleRefundProcessedEvent(entity);
      break;
    }

    default:
      // Other events are safely acknowledged without failing
      break;
  }
}

async function handleAccountEvent(eventType, accountEntity) {
  if (!accountEntity || !accountEntity.id) return;
  const providerAccountId = accountEntity.id;

  let newStatus = CONNECTED_ACCOUNT_STATUSES.UNDER_REVIEW;
  if (eventType === 'account.activated') newStatus = CONNECTED_ACCOUNT_STATUSES.ACTIVE;
  if (eventType === 'account.suspended') newStatus = CONNECTED_ACCOUNT_STATUSES.SUSPENDED;
  if (eventType === 'account.rejected') newStatus = CONNECTED_ACCOUNT_STATUSES.REJECTED;

  // Find connected account by providerAccountId in Firestore
  const snap = await adminDb
    .collection('connectedAccounts')
    .where('providerAccountId', '==', providerAccountId)
    .limit(1)
    .get();

  if (!snap.empty) {
    const docRef = snap.docs[0].ref;
    await docRef.update({
      verificationStatus: newStatus,
      onboardingStatus: newStatus,
      capabilities: accountEntity.capabilities || {},
      settlementEligibility: newStatus === CONNECTED_ACCOUNT_STATUSES.ACTIVE,
      lastWebhookSyncAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }
}

async function handleTransferEvent(eventType, transferEntity) {
  if (!transferEntity || !transferEntity.id) return;
  const transferId = transferEntity.id;
  const status = eventType === 'transfer.processed' ? 'PROCESSED' : 'FAILED';

  const snap = await adminDb
    .collection('paymentSplits')
    .where('providerTransferId', '==', transferId)
    .limit(1)
    .get();

  if (!snap.empty) {
    await snap.docs[0].ref.update({
      transferStatus: status,
      updatedAt: new Date().toISOString()
    });
  }
}

async function handleSettlementEvent(settlementEntity) {
  if (!settlementEntity || !settlementEntity.id) return;
  const settlementId = settlementEntity.id;

  await adminDb.collection('settlements').doc(settlementId).set({
    settlementId,
    amountPaise: settlementEntity.amount,
    currency: settlementEntity.currency || 'INR',
    settlementStatus: settlementEntity.status?.toUpperCase() || 'PROCESSED',
    settlementDate: new Date().toISOString(),
    raw: settlementEntity
  }, { merge: true });
}

async function handlePaymentCapturedEvent(paymentEntity) {
  if (!paymentEntity || !paymentEntity.order_id) return;
  const rzpOrderId = paymentEntity.order_id;

  const snap = await adminDb
    .collection('orders')
    .where('razorpayOrderId', '==', rzpOrderId)
    .limit(1)
    .get();

  if (!snap.empty) {
    const orderDoc = snap.docs[0];
    const orderData = orderDoc.data();

    if (orderData.paymentStatus !== PAYMENT_STATUSES.CAPTURED && orderData.status !== 'success') {
      await orderDoc.ref.update({
        paymentStatus: PAYMENT_STATUSES.CAPTURED,
        status: 'success',
        razorpayPaymentId: paymentEntity.id,
        capturedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
  }
}

async function handleRefundProcessedEvent(refundEntity) {
  if (!refundEntity || !refundEntity.payment_id) return;
  const paymentId = refundEntity.payment_id;

  const snap = await adminDb
    .collection('orders')
    .where('razorpayPaymentId', '==', paymentId)
    .limit(1)
    .get();

  if (!snap.empty) {
    await snap.docs[0].ref.update({
      paymentStatus: PAYMENT_STATUSES.REFUNDED,
      refundedAmountPaise: refundEntity.amount,
      updatedAt: new Date().toISOString()
    });
  }
}
