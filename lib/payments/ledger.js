import crypto from 'crypto';
import { adminDb } from '../firebase-admin.js';
import { LEDGER_ACCOUNTS, LEDGER_ENTRY_TYPES } from './types.js';

const COLLECTION = 'ledgerEntries';

/**
 * Validates that total debits strictly equal total credits.
 * In double-entry bookkeeping: SUM(debits) === SUM(credits).
 */
export function assertLedgerBalanced(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('[Ledger] Cannot record empty ledger entries');
  }

  let totalDebits = 0;
  let totalCredits = 0;

  for (const entry of entries) {
    const debit = Number(entry.debitPaise || 0);
    const credit = Number(entry.creditPaise || 0);

    if (!Number.isInteger(debit) || debit < 0) {
      throw new TypeError(`[Ledger] debitPaise must be non-negative integer. Got: ${entry.debitPaise}`);
    }
    if (!Number.isInteger(credit) || credit < 0) {
      throw new TypeError(`[Ledger] creditPaise must be non-negative integer. Got: ${entry.creditPaise}`);
    }
    if (debit === 0 && credit === 0) {
      throw new Error(`[Ledger] Entry cannot have both 0 debit and 0 credit for account ${entry.account}`);
    }
    if (debit > 0 && credit > 0) {
      throw new Error(`[Ledger] Entry cannot have both positive debit and positive credit for account ${entry.account}`);
    }

    totalDebits += debit;
    totalCredits += credit;
  }

  if (totalDebits !== totalCredits) {
    throw new Error(`[Ledger] Unbalanced transaction: Total Debits (${totalDebits}) !== Total Credits (${totalCredits})`);
  }

  return { totalDebits, totalCredits, balanced: true };
}

/**
 * Commits a balanced set of ledger entries to Firestore inside a batch or transaction.
 */
export async function commitLedgerTransaction(transactionId, entries, metadata = {}) {
  assertLedgerBalanced(entries);

  const now = new Date().toISOString();
  const preparedDocs = entries.map((e, idx) => ({
    id: `${transactionId}_${idx}`,
    transactionId,
    entryType: e.entryType,
    account: e.account,
    debitPaise: e.debitPaise || 0,
    creditPaise: e.creditPaise || 0,
    currency: e.currency || 'INR',
    organizerId: e.organizerId ? String(e.organizerId) : null,
    eventId: e.eventId ? String(e.eventId) : null,
    bookingId: e.bookingId ? String(e.bookingId) : null,
    orderId: e.orderId ? String(e.orderId) : null,
    reference: e.reference || transactionId,
    description: e.description || '',
    metadata: { ...metadata, ...(e.metadata || {}) },
    createdAt: now
  }));

  if (typeof adminDb?.batch === 'function') {
    const batch = adminDb.batch();
    for (const docData of preparedDocs) {
      const ref = adminDb.collection(COLLECTION).doc(docData.id);
      batch.set(ref, docData);
    }
    await batch.commit();
  }

  preparedDocs.transactionId = transactionId;
  preparedDocs.journalEntryId = transactionId;
  preparedDocs.entries = preparedDocs;

  return preparedDocs;
}

/**
 * Creates double-entry records for a successful ticket payment capture:
 *
 * 1. DEBIT:  CASH_GATEWAY_CLEARING (Gross ticket amount received)
 * 2. CREDIT: ORGANIZER_PAYABLE     (Net ticket revenue owed/routed to organizer)
 * 3. CREDIT: PLATFORM_COMMISSION_REVENUE (TicketLelo platform fee)
 *
 * Total Debits = grossAmountPaise
 * Total Credits = organizerSharePaise + platformCommissionPaise
 * Since grossAmountPaise = organizerSharePaise + platformCommissionPaise, entries balance perfectly!
 */
export async function recordPaymentCaptureLedger({
  transactionId,
  orderId,
  bookingId,
  eventId,
  organizerId,
  grossAmountPaise,
  organizerSharePaise,
  platformCommissionPaise,
  currency = 'INR'
}) {
  const entries = [
    {
      entryType: LEDGER_ENTRY_TYPES.PAYMENT_CAPTURE,
      account: LEDGER_ACCOUNTS.CASH_GATEWAY_CLEARING,
      debitPaise: grossAmountPaise,
      creditPaise: 0,
      currency,
      organizerId,
      eventId,
      bookingId,
      orderId,
      reference: orderId,
      description: `Gross ticket payment captured for order ${orderId}`
    },
    {
      entryType: LEDGER_ENTRY_TYPES.PAYMENT_CAPTURE,
      account: LEDGER_ACCOUNTS.ORGANIZER_PAYABLE,
      debitPaise: 0,
      creditPaise: organizerSharePaise,
      currency,
      organizerId,
      eventId,
      bookingId,
      orderId,
      reference: orderId,
      description: `Net earnings allocated to organizer ${organizerId}`
    },
    {
      entryType: LEDGER_ENTRY_TYPES.PAYMENT_CAPTURE,
      account: LEDGER_ACCOUNTS.PLATFORM_COMMISSION_REVENUE,
      debitPaise: 0,
      creditPaise: platformCommissionPaise,
      currency,
      organizerId,
      eventId,
      bookingId,
      orderId,
      reference: orderId,
      description: `Platform commission earned for order ${orderId}`
    }
  ];

  return commitLedgerTransaction(transactionId || `capture_${orderId}`, entries, { orderId, bookingId, eventId });
}

/**
 * Records double-entry records for a refund:
 *
 * 1. DEBIT:  ORGANIZER_PAYABLE (Organizer portion refunded / transfer reversed)
 * 2. DEBIT:  PLATFORM_COMMISSION_REVENUE (Platform commission refunded if applicable)
 * 3. CREDIT: CASH_GATEWAY_CLEARING (Gross cash returned to attendee via gateway)
 */
export async function recordRefundLedger({
  transactionId,
  refundId,
  orderId,
  eventId,
  organizerId,
  refundGrossPaise,
  organizerRefundSharePaise,
  platformRefundCommissionPaise = 0,
  currency = 'INR'
}) {
  const entries = [
    {
      entryType: LEDGER_ENTRY_TYPES.REFUND_ISSUANCE,
      account: LEDGER_ACCOUNTS.ORGANIZER_PAYABLE,
      debitPaise: organizerRefundSharePaise,
      creditPaise: 0,
      currency,
      organizerId,
      eventId,
      orderId,
      reference: refundId,
      description: `Organizer share reversed for refund ${refundId}`
    },
    {
      entryType: LEDGER_ENTRY_TYPES.REFUND_ISSUANCE,
      account: LEDGER_ACCOUNTS.PLATFORM_COMMISSION_REVENUE,
      debitPaise: platformRefundCommissionPaise,
      creditPaise: 0,
      currency,
      organizerId,
      eventId,
      orderId,
      reference: refundId,
      description: `Platform commission reversed for refund ${refundId}`
    },
    {
      entryType: LEDGER_ENTRY_TYPES.REFUND_ISSUANCE,
      account: LEDGER_ACCOUNTS.CASH_GATEWAY_CLEARING,
      debitPaise: 0,
      creditPaise: refundGrossPaise,
      currency,
      organizerId,
      eventId,
      orderId,
      reference: refundId,
      description: `Cash refunded to attendee via gateway for order ${orderId}`
    }
  ];

  return commitLedgerTransaction(transactionId || `refund_${refundId}`, entries, { refundId, orderId });
}

/**
 * Records double-entry records for an organizer settlement payout:
 *
 * 1. DEBIT:  ORGANIZER_PAYABLE (Disbursing owed funds to organizer linked bank account)
 * 2. CREDIT: CASH_GATEWAY_CLEARING (Reducing cash clearing balance held at gateway)
 */
export async function recordSettlementPayoutLedger({
  transactionId,
  settlementId,
  orderId,
  eventId,
  organizerId,
  amountPaise,
  providerTransferId = null,
  currency = 'INR'
}) {
  const entries = [
    {
      entryType: LEDGER_ENTRY_TYPES.SETTLEMENT_PAYOUT,
      account: LEDGER_ACCOUNTS.ORGANIZER_PAYABLE,
      debitPaise: amountPaise,
      creditPaise: 0,
      currency,
      organizerId,
      eventId,
      orderId,
      reference: settlementId,
      description: `Disbursed settlement ${settlementId} to organizer ${organizerId}${providerTransferId ? ` (Transfer: ${providerTransferId})` : ''}`
    },
    {
      entryType: LEDGER_ENTRY_TYPES.SETTLEMENT_PAYOUT,
      account: LEDGER_ACCOUNTS.CASH_GATEWAY_CLEARING,
      debitPaise: 0,
      creditPaise: amountPaise,
      currency,
      organizerId,
      eventId,
      orderId,
      reference: settlementId,
      description: `Gateway clearing deduction for settlement ${settlementId}`
    }
  ];

  return commitLedgerTransaction(transactionId || `sett_${settlementId}`, entries, {
    settlementId,
    orderId,
    providerTransferId
  });
}

/**
 * Records double-entry records for a transfer reversal (clawback/dispute):
 *
 * 1. DEBIT:  CASH_GATEWAY_CLEARING (Cash returned from organizer linked account back to gateway clearing)
 * 2. CREDIT: ORGANIZER_PAYABLE     (Reversing the previous payout debit)
 */
export async function recordTransferReversalLedger({
  transactionId,
  reversalId,
  settlementId,
  orderId,
  organizerId,
  amountPaise,
  currency = 'INR'
}) {
  const entries = [
    {
      entryType: LEDGER_ENTRY_TYPES.TRANSFER_REVERSAL,
      account: LEDGER_ACCOUNTS.CASH_GATEWAY_CLEARING,
      debitPaise: amountPaise,
      creditPaise: 0,
      currency,
      organizerId,
      orderId,
      reference: reversalId,
      description: `Reversal ${reversalId} received into clearing from settlement ${settlementId}`
    },
    {
      entryType: LEDGER_ENTRY_TYPES.TRANSFER_REVERSAL,
      account: LEDGER_ACCOUNTS.ORGANIZER_PAYABLE,
      debitPaise: 0,
      creditPaise: amountPaise,
      currency,
      organizerId,
      orderId,
      reference: reversalId,
      description: `Liability restored for reversed payout ${settlementId}`
    }
  ];

  return commitLedgerTransaction(transactionId || `rev_${reversalId}`, entries, {
    reversalId,
    settlementId,
    orderId
  });
}

/**
 * Query ledger summary for an organizer or platform-wide
 */
export async function getLedgerSummaryForOrganizer(organizerId) {
  if (typeof adminDb?.collection !== 'function') {
    return {
      grossSalesPaise: 0,
      organizerNetPaise: 0,
      platformCommissionPaise: 0,
      refundedPaise: 0
    };
  }

  let query = adminDb.collection(COLLECTION);
  const isPlatformWide = !organizerId || organizerId === 'all' || organizerId === 'platform';
  if (!isPlatformWide) {
    query = query.where('organizerId', '==', String(organizerId));
  }

  const snapshot = await query.get();

  let grossSalesPaise = 0;
  let organizerNetPaise = 0;
  let platformCommissionPaise = 0;
  let refundedPaise = 0;

  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.account === LEDGER_ACCOUNTS.CASH_GATEWAY_CLEARING) {
      if (data.debitPaise > 0) grossSalesPaise += data.debitPaise;
      if (data.creditPaise > 0) refundedPaise += data.creditPaise;
    }
    if (data.account === LEDGER_ACCOUNTS.ORGANIZER_PAYABLE) {
      // Credit increases payable (earnings), Debit decreases payable (refunds)
      organizerNetPaise += (data.creditPaise - data.debitPaise);
    }
    if (data.account === LEDGER_ACCOUNTS.PLATFORM_COMMISSION_REVENUE) {
      platformCommissionPaise += (data.creditPaise - data.debitPaise);
    }
  });

  return {
    grossSalesPaise,
    organizerNetPaise,
    platformCommissionPaise,
    refundedPaise
  };
}
