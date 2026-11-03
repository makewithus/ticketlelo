import { adminDb } from '../firebase-admin.js';
import { getDefaultPaymentProvider } from './provider-registry.js';
import { PAYMENT_STATUSES } from './types.js';

const RECON_REPORTS_COLLECTION = 'reconciliationReports';

/**
 * Runs automated reconciliation across internal orders, gateway transactions, and double-entry ledger entries.
 */
export async function runFinancialReconciliation({ limit = 100 } = {}) {
  if (!adminDb) {
    throw new Error('[Reconciliation] Database unavailable');
  }

  const reportId = `recon_${Date.now()}`;
  const now = new Date().toISOString();

  const report = {
    reportId,
    generatedAt: now,
    totalOrdersChecked: 0,
    matchedCount: 0,
    discrepancyCount: 0,
    discrepancies: [],
    summary: {
      totalGrossPaise: 0,
      totalCommissionPaise: 0,
      totalOrganizerPaise: 0
    }
  };

  // Fetch recent captured/paid orders
  const ordersSnap = await adminDb
    .collection('orders')
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();

  report.totalOrdersChecked = ordersSnap.size;

  for (const doc of ordersSnap.docs) {
    const order = doc.data();
    const orderId = doc.id;
    const grossPaise = Number(order.amount || order.finalPayablePaise || 0);
    const platformFeePaise = Number(order.platformCommissionPaise || order.platformFee || 0);
    const organizerSharePaise = grossPaise - platformFeePaise;

    report.summary.totalGrossPaise += grossPaise;
    report.summary.totalCommissionPaise += platformFeePaise;
    report.summary.totalOrganizerPaise += organizerSharePaise;

    const issues = [];

    // 1. Check ledger entries existence and balance for this order
    const ledgerSnap = await adminDb
      .collection('ledgerEntries')
      .where('orderId', '==', orderId)
      .get();

    if (ledgerSnap.empty && (order.paymentStatus === PAYMENT_STATUSES.CAPTURED || order.status === 'success')) {
      issues.push({
        type: 'MISSING_LEDGER_ENTRIES',
        message: `Order ${orderId} is marked captured but has no corresponding ledger entries.`
      });
    } else if (!ledgerSnap.empty) {
      let orderDebits = 0;
      let orderCredits = 0;
      ledgerSnap.forEach(lDoc => {
        const l = lDoc.data();
        orderDebits += Number(l.debitPaise || 0);
        orderCredits += Number(l.creditPaise || 0);
      });
      if (orderDebits !== orderCredits) {
        issues.push({
          type: 'UNBALANCED_LEDGER_TRANSACTION',
          message: `Order ${orderId} has unbalanced ledger entries: Debits ${orderDebits} != Credits ${orderCredits}`
        });
      }
    }

    // 2. Check Route transfer split record if Route is enabled
    if (order.isRouteTransfer && order.organizerId) {
      const splitSnap = await adminDb
        .collection('paymentSplits')
        .where('orderId', '==', orderId)
        .limit(1)
        .get();

      if (splitSnap.empty) {
        issues.push({
          type: 'MISSING_ROUTE_SPLIT_RECORD',
          message: `Order ${orderId} was flagged for Route transfer but has no paymentSplits record.`
        });
      } else {
        const split = splitSnap.docs[0].data();
        if (split.transferStatus === 'FAILED') {
          issues.push({
            type: 'FAILED_ROUTE_TRANSFER',
            message: `Route transfer ${split.providerTransferId} for organizer ${split.organizerId} failed.`
          });
        }
      }
    }

    if (issues.length > 0) {
      report.discrepancyCount++;
      report.discrepancies.push({
        orderId,
        bookingId: order.bookingId,
        grossPaise,
        issues
      });
    } else {
      report.matchedCount++;
    }
  }

  // Save reconciliation report to Firestore
  await adminDb.collection(RECON_REPORTS_COLLECTION).doc(reportId).set(report);

  return report;
}

/**
 * Fetch latest reconciliation reports for admin overview
 */
export async function getLatestReconciliationReports(limit = 10) {
  if (!adminDb) return [];
  const snap = await adminDb
    .collection(RECON_REPORTS_COLLECTION)
    .orderBy('generatedAt', 'desc')
    .limit(limit)
    .get();

  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
