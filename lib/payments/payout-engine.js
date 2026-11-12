import QRCode from 'qrcode';
import { adminDb } from '../firebase-admin.js';
import { calculateSettlementDates } from './working-calendar.js';
import { recordSettlementPayoutLedger } from './ledger.js';
import { createAdminNotification, createOrganizerNotification } from '../notifications/notification-service.js';
import { enqueueEmail } from '../email/index.js';
import { buildPayoutConfirmedEmail } from '../email/templates/payout-confirmed.js';
import {
  UPI_HANDLES,
  BANK_NAMES,
  PAYOUT_STATUSES,
  validateUpiId,
  validateBankName,
  generateUpiPaymentLink,
} from './payout-constants.js';

export * from './payout-constants.js';

const PAYOUTS_COLLECTION = 'payouts';
const PAYOUT_PROFILES_COLLECTION = 'organizerPayoutProfiles';
const AUDIT_LOGS_COLLECTION = 'financialAuditLogs';

// In-memory fallbacks for test isolation when adminDb is null
export const _inMemoryPayoutProfiles = new Map();
export const _inMemoryPayouts = new Map();
export const _inMemoryAuditLogs = [];

export function _seedMockPayout(payoutId, payoutData) {
  _inMemoryPayouts.set(payoutId, { ...payoutData });
}

export function _getMockPayout(payoutId) {
  return _inMemoryPayouts.get(payoutId);
}

/**
 * Retrieves the saved payout profile for an organizer.
 */
export async function getOrganizerPayoutProfile(organizerId) {
  if (!organizerId) return null;

  if (typeof adminDb?.collection !== 'function') {
    return _inMemoryPayoutProfiles.get(String(organizerId)) || null;
  }

  try {
    const docRef = adminDb.collection(PAYOUT_PROFILES_COLLECTION).doc(String(organizerId));
    const snap = await docRef.get();
    if (snap.exists) {
      return { id: snap.id, ...snap.data() };
    }

    // Fallback: check users collection
    const userDoc = await adminDb.collection('users').doc(String(organizerId)).get();
    if (userDoc.exists) {
      const u = userDoc.data();
      if (u.payoutProfile) {
        return { organizerId: String(organizerId), ...u.payoutProfile };
      }
    }
    return null;
  } catch (err) {
    console.error(`[PayoutEngine] Error getting profile for ${organizerId}:`, err);
    return null;
  }
}

/**
 * Saves or updates an organizer's payout profile with audit logging and Super Admin alert.
 */
export const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const ACCOUNT_NUMBER_REGEX = /^\d{8,18}$/;
export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

export async function saveOrganizerPayoutProfile(organizerId, profileData, callerUser = {}) {
  if (!organizerId) throw new Error('[PayoutEngine] organizerId is required.');

  const {
    username,
    handle,
    customHandle,
    fullUpiId,
    bankName,
    customBankName,
    organizerName,
    email,
    phone,
    accountHolderName,
    accountNumber,
    ifsc,
    pan,
    gstin,
    billingAddress,
  } = profileData;

  // Validate UPI ID if provided or if username/fullUpiId present
  let upiValidation = { isValid: false, upiId: null, username: null, handle: null };
  if (username || fullUpiId) {
    upiValidation = validateUpiId({ username, handle, customHandle, fullUpiId });
    if (!upiValidation.isValid && !accountNumber) {
      throw new Error(upiValidation.error);
    }
  }

  // Validate Bank
  let bankValidation = { isValid: true, bankName: bankName || 'Bank Account', isCustom: false };
  if (bankName || customBankName) {
    bankValidation = validateBankName(bankName, customBankName);
    if (!bankValidation.isValid) {
      throw new Error(bankValidation.error);
    }
  }

  // Validate Bank Account Details if provided
  if (accountNumber) {
    const cleanAcc = String(accountNumber).trim();
    if (!ACCOUNT_NUMBER_REGEX.test(cleanAcc)) {
      throw new Error('Invalid bank account number. Must be between 8 and 18 numeric digits.');
    }
  }

  if (ifsc) {
    const cleanIfsc = String(ifsc).trim().toUpperCase();
    if (!IFSC_REGEX.test(cleanIfsc)) {
      throw new Error('Invalid IFSC code format. Expected 4 letters, zero, and 6 alphanumeric characters (e.g., HDFC0001234).');
    }
  }

  if (pan) {
    const cleanPan = String(pan).trim().toUpperCase();
    if (!PAN_REGEX.test(cleanPan)) {
      throw new Error('Invalid PAN format. Expected 5 letters, 4 digits, and 1 letter (e.g., ABCDE1234F).');
    }
  }

  // Ensure at least one payout method is present (either Bank Account or UPI ID)
  if (!upiValidation.upiId && !accountNumber) {
    throw new Error('Either complete Bank Account details (Account Number & IFSC) or a valid UPI ID must be provided.');
  }

  const existing = await getOrganizerPayoutProfile(organizerId);
  const now = new Date().toISOString();

  const isUpiChanged = existing && existing.upiId !== upiValidation.upiId;
  const isBankChanged = existing && existing.bankName !== bankValidation.bankName;
  const isFirstTime = !existing;

  const cleanAccStr = accountNumber ? String(accountNumber).trim() : null;
  const maskedAcc = cleanAccStr ? `•••• •••• ${cleanAccStr.slice(-4)}` : (existing?.accountNumberMasked || null);

  const profileDoc = {
    organizerId: String(organizerId),
    organizerName: (organizerName || existing?.organizerName || callerUser.displayName || callerUser.fullName || 'Organizer').trim(),
    accountHolderName: (accountHolderName || organizerName || existing?.accountHolderName || callerUser.displayName || '').trim(),
    email: (email || existing?.email || callerUser.email || '').trim().toLowerCase(),
    phone: (phone || existing?.phone || callerUser.phone || '').trim(),
    upiId: upiValidation.upiId || existing?.upiId || null,
    upiUsername: upiValidation.username || existing?.upiUsername || null,
    upiHandle: upiValidation.handle || existing?.upiHandle || null,
    bankName: bankValidation.bankName || existing?.bankName || null,
    customBankName: bankValidation.isCustom ? customBankName.trim() : (existing?.customBankName || null),
    isCustomBank: bankValidation.isCustom,
    accountNumber: cleanAccStr || existing?.accountNumber || null,
    accountNumberMasked: maskedAcc,
    ifsc: ifsc ? String(ifsc).trim().toUpperCase() : (existing?.ifsc || null),
    pan: pan ? String(pan).trim().toUpperCase() : (existing?.pan || null),
    gstin: gstin ? String(gstin).trim().toUpperCase() : (existing?.gstin || null),
    billingAddress: billingAddress || existing?.billingAddress || null,
    payoutMethod: accountNumber ? 'BANK_TRANSFER' : 'UPI',
    lastUpdatedDate: now,
    updatedAt: now,
    updatedBy: callerUser.email || callerUser.uid || 'organizer',
  };

  if (typeof adminDb?.collection === 'function') {
    // 1. Save profile
    await adminDb.collection(PAYOUT_PROFILES_COLLECTION).doc(String(organizerId)).set(profileDoc, { merge: true });

    // 2. Also mirror on user document
    try {
      await adminDb.collection('users').doc(String(organizerId)).set(
        {
          payoutProfile: profileDoc,
          payoutUpiId: upiValidation.upiId,
          payoutBankName: bankValidation.bankName,
          updatedAt: now,
        },
        { merge: true }
      );
    } catch (_uErr) {
      // Non-fatal
    }

    // 3. Record Audit Log
    await adminDb.collection(AUDIT_LOGS_COLLECTION).add({
      action: isFirstTime ? 'PAYOUT_PROFILE_CREATED' : 'PAYOUT_PROFILE_UPDATED',
      organizerId: String(organizerId),
      organizerName: profileDoc.organizerName,
      previousDetails: existing
        ? { upiId: existing.upiId, bankName: existing.bankName }
        : null,
      newDetails: { upiId: profileDoc.upiId, bankName: profileDoc.bankName },
      performedBy: callerUser.email || callerUser.uid || 'organizer',
      timestamp: now,
    });

    // 4. Notify Super Admin if details changed or created
    if (isFirstTime || isUpiChanged || isBankChanged) {
      const changeType = isFirstTime
        ? 'New Payout Details Added'
        : isUpiChanged && isBankChanged
        ? 'UPI ID & Bank Updated'
        : isUpiChanged
        ? 'UPI ID Updated'
        : 'Bank Name Updated';

      await createAdminNotification({
        type: 'PAYOUT_DETAILS_UPDATED',
        title: `Organizer Payout Profile Updated`,
        message: `${profileDoc.organizerName} updated their payout profile: ${changeType} (UPI: ${profileDoc.upiId}, Bank: ${profileDoc.bankName}).`,
        organizerId: String(organizerId),
        organizerName: profileDoc.organizerName,
        metadata: {
          previous: existing ? { upiId: existing.upiId, bankName: existing.bankName } : null,
          current: { upiId: profileDoc.upiId, bankName: profileDoc.bankName },
        },
      });
    }
  } else {
    _inMemoryPayoutProfiles.set(String(organizerId), profileDoc);
    _inMemoryAuditLogs.push({
      action: isFirstTime ? 'PAYOUT_PROFILE_CREATED' : 'PAYOUT_PROFILE_UPDATED',
      organizerId: String(organizerId),
      newDetails: { upiId: profileDoc.upiId, bankName: profileDoc.bankName },
      timestamp: now,
    });
  }

  return profileDoc;
}


/**
 * Generates dynamic Data URL QR code for a UPI URL.
 */
export async function generateUpiQrCode(upiUrl) {
  if (!upiUrl) return null;
  try {
    return await QRCode.toDataURL(upiUrl, {
      width: 320,
      margin: 2,
      color: {
        dark: '#131517',
        light: '#ffffff',
      },
    });
  } catch (err) {
    console.error('[PayoutEngine] QR code generation failed:', err);
    return null;
  }
}

/**
 * Syncs and lists payouts for Super Admin or Organizer.
 * Automatically computes T+4 working days, monitors fund availability, and dispatches notifications.
 */
export async function listPayouts({
  organizerId = null,
  status = 'ALL',
  searchTerm = '',
  limit = 100,
} = {}) {
  const isSuperAdminView = !organizerId || organizerId === 'all';
  const now = new Date();
  const nowMs = now.getTime();

  let payoutsList = [];

  if (typeof adminDb?.collection === 'function') {
    // 1. Fetch saved payouts from Firestore
    let pQuery = adminDb.collection(PAYOUTS_COLLECTION);
    if (!isSuperAdminView) {
      pQuery = pQuery.where('organizerId', '==', String(organizerId));
    }
    const pSnap = await pQuery.get();
    const existingPayoutsMap = new Map();
    pSnap.forEach((doc) => existingPayoutsMap.set(doc.id, { id: doc.id, ...doc.data() }));

    // 2. Fetch events and orders to discover / refresh payout tasks
    let eQuery = adminDb.collection('events');
    if (!isSuperAdminView) {
      eQuery = eQuery.where('organizerId', '==', String(organizerId));
    }
    const eventsSnap = await eQuery.limit(limit * 2).get();

    // Fetch orders to compute financial breakdown
    let oQuery = adminDb.collection('orders');
    if (!isSuperAdminView) {
      oQuery = oQuery.where('organizerId', '==', String(organizerId));
    }
    const ordersSnap = await oQuery.limit(limit * 10).get();

    // Group orders by eventId
    const eventOrdersMap = new Map();
    ordersSnap.forEach((doc) => {
      const d = doc.data();
      const eid = String(d.eventId || '');
      if (!eid) return;
      if (!eventOrdersMap.has(eid)) eventOrdersMap.set(eid, []);
      eventOrdersMap.get(eid).push({ id: doc.id, ...d });
    });

    // 3. Reconcile events into payouts
    for (const evDoc of eventsSnap.docs) {
      const ev = evDoc.data();
      const eventId = evDoc.id;
      const orders = eventOrdersMap.get(eventId) || [];

      // Only generate payout task if event has paid orders or existing payout doc
      const paidOrders = orders.filter(
        (o) => o.status === 'paid' || o.paymentStatus === 'CAPTURED' || o.status === 'success'
      );

      const existingPayout = existingPayoutsMap.get(`TKT-PO-${eventId}`) || existingPayoutsMap.get(eventId);

      if (paidOrders.length === 0 && !existingPayout) {
        continue;
      }

      // Calculate financials
      let grossPaise = 0;
      let platformFeePaise = 0;
      let refundsPaise = 0;
      let earliestCaptureMs = nowMs;

      if (paidOrders.length > 0) {
        paidOrders.forEach((o) => {
          const g = Number(o.amount || o.pricing?.finalPayablePaise || 0);
          const f = Number(o.platformCommissionPaise || o.pricing?.platformFee * 100 || Math.round(g * 0.05));
          const r = Number(o.refundedAmountPaise || 0);
          grossPaise += g;
          platformFeePaise += f;
          refundsPaise += r;

          const capDate = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt || Date.now());
          if (!isNaN(capDate.getTime()) && capDate.getTime() < earliestCaptureMs) {
            earliestCaptureMs = capDate.getTime();
          }
        });
      } else if (existingPayout) {
        grossPaise = existingPayout.grossAmountPaise || 0;
        platformFeePaise = existingPayout.platformFeePaise || 0;
        refundsPaise = existingPayout.refundsPaise || 0;
      }

      // Standard Razorpay processing charge: 2.36% (2% + 18% GST)
      const razorpayFeePaise = Math.round((grossPaise * 236) / 10000);
      const netOrganizerPaise = Math.max(0, grossPaise - platformFeePaise - razorpayFeePaise - refundsPaise);

      // Compute T+4 settlement schedule
      const settlementSchedule = calculateSettlementDates(new Date(earliestCaptureMs));
      const maturityMs = new Date(settlementSchedule.tPlus4OrganizerDate).getTime();
      const isMatured = nowMs >= maturityMs;
      const isOverdue = nowMs >= (maturityMs + 86400000) && (!existingPayout || existingPayout.status !== PAYOUT_STATUSES.PAID);

      // Resolve Organizer Payout Profile
      const orgId = String(ev.organizerId || ev.organizationId || ev.creatorId || existingPayout?.organizerId || '');
      const profile = await getOrganizerPayoutProfile(orgId);

      const payoutId = `TKT-PO-${eventId.substring(0, 10).toUpperCase()}`;
      const payoutRef = `TICKETLELO-PAYOUT-${eventId.substring(0, 8).toUpperCase()}`;

      // Determine Status
      let currentStatus = PAYOUT_STATUSES.PENDING;
      if (existingPayout) {
        currentStatus = existingPayout.status;
      } else if (isMatured) {
        currentStatus = PAYOUT_STATUSES.DUE;
      }

      const payoutRecord = {
        payoutId,
        payoutRef,
        eventId,
        eventTitle: ev.title || existingPayout?.eventTitle || 'Event',
        organizerId: orgId,
        organizerName: profile?.organizerName || ev.organizerName || existingPayout?.organizerName || 'College Organizer',
        organizerEmail: profile?.email || ev.organizerEmail || existingPayout?.organizerEmail || '',
        organizerPhone: profile?.phone || ev.organizerPhone || existingPayout?.organizerPhone || '',
        upiId: profile?.upiId || existingPayout?.upiId || null,
        bankName: profile?.bankName || existingPayout?.bankName || null,
        registrationsCount: paidOrders.length || existingPayout?.registrationsCount || 0,
        grossAmountPaise: grossPaise,
        platformFeePaise,
        razorpayFeePaise,
        refundsPaise,
        netOrganizerPaise,
        currency: 'INR',
        capturedAt: settlementSchedule.capturedAt,
        tPlus2RazorpayDate: settlementSchedule.tPlus2RazorpayDate,
        tPlus4OrganizerDate: settlementSchedule.tPlus4OrganizerDate,
        dueDateFormatted: settlementSchedule.targetSettlementDayFormatted,
        status: currentStatus,
        isOverdue,
        isFundsAvailable: true,
        utr: existingPayout?.utr || null,
        paidAt: existingPayout?.paidAt || null,
        paidBy: existingPayout?.paidBy || null,
        paymentRemarks: existingPayout?.paymentRemarks || null,
        receiptUrl: existingPayout?.receiptUrl || null,
        holdReason: existingPayout?.holdReason || null,
        holdPlacedBy: existingPayout?.holdPlacedBy || null,
        updatedAt: now.toISOString(),
      };

      // Generate UPI payment intent deep link if UPI ID exists
      if (payoutRecord.upiId && payoutRecord.netOrganizerPaise > 0) {
        payoutRecord.upiPaymentUrl = generateUpiPaymentLink({
          upiId: payoutRecord.upiId,
          payeeName: payoutRecord.organizerName,
          amountRupees: (payoutRecord.netOrganizerPaise / 100).toFixed(2),
          payoutRefId: payoutRecord.payoutRef,
          note: `TicketLelo Payout - ${payoutRecord.eventTitle.substring(0, 30)}`,
        });
      }

      // If status newly became DUE, send notification to admin
      if (currentStatus === PAYOUT_STATUSES.DUE && (!existingPayout || existingPayout.status === PAYOUT_STATUSES.PENDING)) {
        await createAdminNotification({
          type: 'PAYOUT_DUE',
          title: 'Payout Due – Action Required',
          message: `Organizer: ${payoutRecord.organizerName} | Event: ${payoutRecord.eventTitle} | Amount: ₹${(payoutRecord.netOrganizerPaise / 100).toLocaleString('en-IN')} | UPI ID: ${payoutRecord.upiId || 'Pending Profile'} | Bank: ${payoutRecord.bankName || 'N/A'} | Due date: ${payoutRecord.dueDateFormatted}`,
          payoutId: payoutRecord.payoutId,
          organizerId: payoutRecord.organizerId,
          organizerName: payoutRecord.organizerName,
          eventId: payoutRecord.eventId,
          eventTitle: payoutRecord.eventTitle,
          amount: payoutRecord.netOrganizerPaise / 100,
          dueDate: payoutRecord.dueDateFormatted,
        });
      }

      // Persist / cache in payouts collection
      await adminDb.collection(PAYOUTS_COLLECTION).doc(payoutId).set(payoutRecord, { merge: true });
      payoutsList.push(payoutRecord);
    }
  } else {
    // In-memory fallback
    payoutsList = Array.from(_inMemoryPayouts.values());
  }

  // Calculate Overview Summary Metrics
  const summary = {
    totalPendingCount: 0,
    totalPendingAmountPaise: 0,
    totalDueTodayCount: 0,
    totalDueTodayAmountPaise: 0,
    totalOverdueCount: 0,
    totalOverdueAmountPaise: 0,
    totalAmountDuePaise: 0,
    totalPaidCount: 0,
    totalPaidAmountPaise: 0,
    totalOnHoldCount: 0,
    totalOnHoldAmountPaise: 0,
    totalFailedCount: 0,
  };

  payoutsList.forEach((p) => {
    const amt = p.netOrganizerPaise || 0;
    if (p.status === PAYOUT_STATUSES.PAID) {
      summary.totalPaidCount += 1;
      summary.totalPaidAmountPaise += amt;
    } else if (p.status === PAYOUT_STATUSES.ON_HOLD) {
      summary.totalOnHoldCount += 1;
      summary.totalOnHoldAmountPaise += amt;
    } else if (p.status === PAYOUT_STATUSES.FAILED) {
      summary.totalFailedCount += 1;
    } else if (p.status === PAYOUT_STATUSES.PENDING) {
      summary.totalPendingCount += 1;
      summary.totalPendingAmountPaise += amt;
    } else if (p.status === PAYOUT_STATUSES.DUE) {
      if (p.isOverdue) {
        summary.totalOverdueCount += 1;
        summary.totalOverdueAmountPaise += amt;
      } else {
        summary.totalDueTodayCount += 1;
        summary.totalDueTodayAmountPaise += amt;
      }
      summary.totalAmountDuePaise += amt;
    }
  });

  // Apply Search Term Filter
  if (searchTerm && searchTerm.trim()) {
    const term = searchTerm.trim().toLowerCase();
    payoutsList = payoutsList.filter(
      (p) =>
        (p.organizerName || '').toLowerCase().includes(term) ||
        (p.eventTitle || '').toLowerCase().includes(term) ||
        (p.payoutId || '').toLowerCase().includes(term) ||
        (p.payoutRef || '').toLowerCase().includes(term) ||
        (p.utr || '').toLowerCase().includes(term) ||
        (p.upiId || '').toLowerCase().includes(term)
    );
  }

  // Apply Status Filter
  if (status && status !== 'ALL') {
    const upperStatus = status.toUpperCase();
    if (upperStatus === 'OVERDUE') {
      payoutsList = payoutsList.filter((p) => p.status === PAYOUT_STATUSES.DUE && p.isOverdue);
    } else if (upperStatus === 'DUE_TODAY') {
      payoutsList = payoutsList.filter((p) => p.status === PAYOUT_STATUSES.DUE && !p.isOverdue);
    } else {
      payoutsList = payoutsList.filter((p) => p.status === upperStatus);
    }
  }

  // Sort: DUE / OVERDUE first, then PENDING, then PAID
  payoutsList.sort((a, b) => {
    const weight = { DUE: 3, PENDING: 2, ON_HOLD: 1, PAID: 0, FAILED: 0 };
    const diff = (weight[b.status] || 0) - (weight[a.status] || 0);
    if (diff !== 0) return diff;
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });

  return {
    summary,
    payouts: payoutsList.slice(0, limit),
    count: payoutsList.length,
  };
}

/**
 * Retrieves a single payout record with detailed financials, organizer profile, and QR code.
 */
export async function getPayoutById(payoutId) {
  if (!payoutId) throw new Error('[PayoutEngine] payoutId is required.');

  let payout = null;
  if (typeof adminDb?.collection === 'function') {
    const snap = await adminDb.collection(PAYOUTS_COLLECTION).doc(payoutId).get();
    if (snap.exists) {
      payout = { id: snap.id, ...snap.data() };
    }
  } else {
    payout = _inMemoryPayouts.get(payoutId) || null;
  }

  if (!payout) {
    throw new Error(`[PayoutEngine] Payout ${payoutId} not found.`);
  }

  // Generate UPI deep link & QR Code if payee upiId exists
  if (payout.upiId && payout.netOrganizerPaise > 0) {
    payout.upiPaymentUrl = generateUpiPaymentLink({
      upiId: payout.upiId,
      payeeName: payout.organizerName,
      amountRupees: (payout.netOrganizerPaise / 100).toFixed(2),
      payoutRefId: payout.payoutRef,
      note: `TicketLelo Payout - ${(payout.eventTitle || '').substring(0, 30)}`,
    });

    try {
      payout.qrCodeDataUrl = await generateUpiQrCode(payout.upiPaymentUrl);
    } catch (_qrErr) {
      payout.qrCodeDataUrl = null;
    }
  }

  return payout;
}

/**
 * Confirms a manual UPI payment made by a Super Admin.
 *
 * Requirements:
 * - Super Admin only.
 * - UTR is strictly required.
 * - Prevents duplicate confirmations (idempotency guard).
 * - Updates payout status to PAID.
 * - Records UTR, payment timestamp, confirming admin details.
 * - Commits double-entry ledger entry.
 * - Dispatches in-app notification & confirmation email to organizer.
 */
export async function confirmPayoutPayment({
  payoutId,
  utr,
  receiptUrl = null,
  remarks = '',
  adminUser = {},
}) {
  if (!payoutId) throw new Error('[PayoutEngine] payoutId is required.');
  const cleanUtr = String(utr || '').trim();
  if (!cleanUtr) {
    throw new Error('[PayoutEngine] UPI Transaction ID / UTR is strictly required to confirm payout.');
  }

  const payout = await getPayoutById(payoutId);

  // Idempotency guard: prevent duplicate payment confirmations
  if (payout.status === PAYOUT_STATUSES.PAID) {
    throw new Error(`[PayoutEngine] Payout ${payoutId} has already been confirmed as Paid (UTR: ${payout.utr}). Duplicate confirmation is blocked.`);
  }

  const now = new Date().toISOString();
  const adminIdentifier = adminUser.email || adminUser.uid || 'SuperAdmin';
  const adminName = adminUser.displayName || adminUser.fullName || adminUser.name || 'Super Admin';

  const updates = {
    status: PAYOUT_STATUSES.PAID,
    utr: cleanUtr,
    paidAt: now,
    paidBy: {
      uid: adminUser.uid || null,
      email: adminUser.email || null,
      name: adminName,
    },
    paymentRemarks: String(remarks || '').trim(),
    receiptUrl: receiptUrl ? String(receiptUrl).trim() : null,
    updatedAt: now,
    statusHistory: [
      ...(payout.statusHistory || []),
      {
        status: PAYOUT_STATUSES.PAID,
        changedAt: now,
        changedBy: adminIdentifier,
        reason: `Manual UPI payment confirmed with UTR: ${cleanUtr}`,
      },
    ],
  };

  if (typeof adminDb?.collection === 'function') {
    // 1. Update payout record
    await adminDb.collection(PAYOUTS_COLLECTION).doc(payoutId).update(updates);

    // 2. Record double-entry ledger payout entry
    try {
      await recordSettlementPayoutLedger({
        transactionId: `payout_${payoutId}`,
        settlementId: payoutId,
        orderId: payout.eventId,
        eventId: payout.eventId,
        organizerId: payout.organizerId,
        amountPaise: payout.netOrganizerPaise,
        providerTransferId: cleanUtr,
      });
    } catch (ledgerErr) {
      console.warn('[PayoutEngine] Ledger recording warning:', ledgerErr.message);
    }

    // 3. Record financial audit log
    await adminDb.collection(AUDIT_LOGS_COLLECTION).add({
      action: 'PAYOUT_CONFIRMED_MANUAL_UPI',
      payoutId,
      eventId: payout.eventId,
      organizerId: payout.organizerId,
      amountPaise: payout.netOrganizerPaise,
      utr: cleanUtr,
      admin: adminIdentifier,
      remarks: remarks || '',
      receiptUrl: receiptUrl || null,
      timestamp: now,
    });

    // 4. Create Organizer In-App Notification
    const amountRupees = (payout.netOrganizerPaise / 100).toLocaleString('en-IN');
    await createOrganizerNotification({
      organizerId: payout.organizerId,
      type: 'PAYOUT_PAID',
      title: 'Your payout has been completed!',
      message: `₹${amountRupees} for ${payout.eventTitle} has been marked as paid.`,
      payoutId,
      utr: cleanUtr,
      amount: payout.netOrganizerPaise / 100,
      eventTitle: payout.eventTitle,
      metadata: {
        bankName: payout.bankName,
        upiId: payout.upiId,
      },
    });

    // 5. Send Email to Organizer via Resend Queue
    if (payout.organizerEmail) {
      try {
        const emailTemplate = buildPayoutConfirmedEmail({
          organizerName: payout.organizerName,
          recipientEmail: payout.organizerEmail,
          eventTitle: payout.eventTitle,
          amountRupees: payout.netOrganizerPaise / 100,
          payoutId,
          utr: cleanUtr,
          upiId: payout.upiId,
          bankName: payout.bankName,
          paidAt: now,
        });

        await enqueueEmail({
          recipient: payout.organizerEmail,
          subject: emailTemplate.subject,
          text: emailTemplate.text,
          html: emailTemplate.html,
          priority: 'P1',
          source: 'payout-confirmation',
          referenceId: payoutId,
        });
      } catch (emailErr) {
        console.warn('[PayoutEngine] Failed to enqueue payout email:', emailErr.message);
      }
    }
  } else {
    const updatedRecord = { ...payout, ...updates };
    _inMemoryPayouts.set(payoutId, updatedRecord);
    _inMemoryAuditLogs.push({
      action: 'PAYOUT_CONFIRMED_MANUAL_UPI',
      payoutId,
      utr: cleanUtr,
      timestamp: now,
    });
  }

  return { ...payout, ...updates };
}

/**
 * Places a payout on administrative hold with a mandatory reason.
 */
export async function holdPayout(payoutId, reason, adminUser = {}) {
  if (!payoutId) throw new Error('[PayoutEngine] payoutId is required.');
  const cleanReason = String(reason || '').trim();
  if (!cleanReason) {
    throw new Error('[PayoutEngine] A mandatory reason must be provided to place payout on hold.');
  }

  const payout = await getPayoutById(payoutId);
  if (payout.status === PAYOUT_STATUSES.PAID) {
    throw new Error('[PayoutEngine] Cannot place an already Paid payout on hold.');
  }

  const now = new Date().toISOString();
  const adminIdentifier = adminUser.email || adminUser.uid || 'SuperAdmin';

  const updates = {
    status: PAYOUT_STATUSES.ON_HOLD,
    holdReason: cleanReason,
    holdPlacedBy: adminIdentifier,
    holdPlacedAt: now,
    updatedAt: now,
    statusHistory: [
      ...(payout.statusHistory || []),
      { status: PAYOUT_STATUSES.ON_HOLD, changedAt: now, changedBy: adminIdentifier, reason: cleanReason },
    ],
  };

  if (typeof adminDb?.collection === 'function') {
    await adminDb.collection(PAYOUTS_COLLECTION).doc(payoutId).update(updates);

    await adminDb.collection(AUDIT_LOGS_COLLECTION).add({
      action: 'PAYOUT_HOLD_PLACED',
      payoutId,
      organizerId: payout.organizerId,
      amountPaise: payout.netOrganizerPaise,
      reason: cleanReason,
      performedBy: adminIdentifier,
      timestamp: now,
    });

    await createAdminNotification({
      type: 'PAYOUT_ON_HOLD',
      title: 'Payout Placed on Hold',
      message: `Payout ${payoutId} for ${payout.eventTitle} (₹${(payout.netOrganizerPaise / 100).toLocaleString('en-IN')}) placed on hold. Reason: ${cleanReason}`,
      payoutId,
      organizerId: payout.organizerId,
    });
  } else {
    _inMemoryPayouts.set(payoutId, { ...payout, ...updates });
  }

  return { ...payout, ...updates };
}

/**
 * Releases administrative hold on a payout.
 */
export async function releasePayoutHold(payoutId, adminUser = {}) {
  if (!payoutId) throw new Error('[PayoutEngine] payoutId is required.');
  const payout = await getPayoutById(payoutId);

  if (payout.status !== PAYOUT_STATUSES.ON_HOLD) {
    throw new Error(`[PayoutEngine] Payout ${payoutId} is not on hold (current: ${payout.status}).`);
  }

  const maturityMs = new Date(payout.tPlus4OrganizerDate || Date.now()).getTime();
  const newStatus = Date.now() >= maturityMs ? PAYOUT_STATUSES.DUE : PAYOUT_STATUSES.PENDING;
  const now = new Date().toISOString();
  const adminIdentifier = adminUser.email || adminUser.uid || 'SuperAdmin';

  const updates = {
    status: newStatus,
    holdReason: null,
    holdPlacedBy: null,
    holdReleasedAt: now,
    updatedAt: now,
    statusHistory: [
      ...(payout.statusHistory || []),
      { status: newStatus, changedAt: now, changedBy: adminIdentifier, reason: 'Hold released by Super Admin' },
    ],
  };

  if (typeof adminDb?.collection === 'function') {
    await adminDb.collection(PAYOUTS_COLLECTION).doc(payoutId).update(updates);

    await adminDb.collection(AUDIT_LOGS_COLLECTION).add({
      action: 'PAYOUT_HOLD_RELEASED',
      payoutId,
      organizerId: payout.organizerId,
      amountPaise: payout.netOrganizerPaise,
      previousStatus: PAYOUT_STATUSES.ON_HOLD,
      newStatus,
      performedBy: adminIdentifier,
      timestamp: now,
    });
  } else {
    _inMemoryPayouts.set(payoutId, { ...payout, ...updates });
  }

  return { ...payout, ...updates };
}

/**
 * Retries a failed payout.
 */
export async function retryPayout(payoutId, adminUser = {}) {
  if (!payoutId) throw new Error('[PayoutEngine] payoutId is required.');
  const payout = await getPayoutById(payoutId);

  if (payout.status !== PAYOUT_STATUSES.FAILED) {
    throw new Error(`[PayoutEngine] Only FAILED payouts can be retried (current: ${payout.status}).`);
  }

  const now = new Date().toISOString();
  const adminIdentifier = adminUser.email || adminUser.uid || 'SuperAdmin';

  const updates = {
    status: PAYOUT_STATUSES.DUE,
    retryCount: (payout.retryCount || 0) + 1,
    lastRetryAt: now,
    updatedAt: now,
    statusHistory: [
      ...(payout.statusHistory || []),
      { status: PAYOUT_STATUSES.DUE, changedAt: now, changedBy: adminIdentifier, reason: 'Admin initiated retry' },
    ],
  };

  if (typeof adminDb?.collection === 'function') {
    await adminDb.collection(PAYOUTS_COLLECTION).doc(payoutId).update(updates);

    await adminDb.collection(AUDIT_LOGS_COLLECTION).add({
      action: 'PAYOUT_RETRY_INITIATED',
      payoutId,
      organizerId: payout.organizerId,
      newStatus: PAYOUT_STATUSES.DUE,
      performedBy: adminIdentifier,
      timestamp: now,
    });
  } else {
    _inMemoryPayouts.set(payoutId, { ...payout, ...updates });
  }

  return { ...payout, ...updates };
}
