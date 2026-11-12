import { adminDb } from '../firebase-admin.js';
import { CONNECTED_ACCOUNT_STATUSES, PAYMENT_PROVIDERS } from './types.js';
import { getDefaultPaymentProvider, getPaymentProvider } from './provider-registry.js';

const COLLECTION = 'connectedAccounts';

/**
 * Fetch an organizer's connected account record from Firestore
 */
export async function getOrganizerConnectedAccount(organizerId) {
  if (!organizerId) return null;
  if (!adminDb) return null;

  const doc = await adminDb.collection(COLLECTION).doc(String(organizerId)).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

/**
 * Initiate onboarding for an organizer
 */
export async function initiateOrganizerOnboarding({
  organizerId,
  email,
  legalBusinessName,
  businessType = 'individual',
  phone,
  provider = PAYMENT_PROVIDERS.RAZORPAY_ROUTE
}) {
  if (!organizerId || !email || !legalBusinessName) {
    throw new Error('[ConnectedAccounts] organizerId, email, and legalBusinessName are required.');
  }

  const existing = await getOrganizerConnectedAccount(organizerId);
  if (existing && existing.providerAccountId && existing.verificationStatus === CONNECTED_ACCOUNT_STATUSES.ACTIVE) {
    return {
      connectedAccount: existing,
      alreadyActive: true
    };
  }

  const paymentProvider = getPaymentProvider(provider);

  // Call provider's account onboarding API
  const onboardingResult = await paymentProvider.onboardCreator({
    organizerId,
    email,
    legalBusinessName,
    businessType,
    phone
  });

  const now = new Date().toISOString();
  const accountData = {
    organizerId: String(organizerId),
    provider,
    providerAccountId: onboardingResult.providerAccountId,
    legalBusinessName,
    businessType,
    email,
    phone: phone || null,
    onboardingStatus: onboardingResult.status,
    verificationStatus: onboardingResult.status,
    capabilities: onboardingResult.raw?.capabilities || {},
    settlementEligibility: onboardingResult.status === CONNECTED_ACCOUNT_STATUSES.ACTIVE,
    requirements: onboardingResult.raw?.requirements || [],
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    lastSyncAt: now
  };

  if (adminDb) {
    await adminDb.collection(COLLECTION).doc(String(organizerId)).set(accountData, { merge: true });
  }

  return {
    connectedAccount: accountData,
    alreadyActive: false
  };
}

/**
 * Synchronize live account status with payment provider
 */
export async function syncOrganizerAccountStatus(organizerId) {
  const account = await getOrganizerConnectedAccount(organizerId);
  if (!account || !account.providerAccountId) {
    return {
      status: CONNECTED_ACCOUNT_STATUSES.NOT_CONNECTED,
      isReadyForTransfers: false,
      isReadyForSettlement: false
    };
  }

  const provider = getPaymentProvider(account.provider || PAYMENT_PROVIDERS.RAZORPAY_ROUTE);
  const statusInfo = await provider.getAccountStatus(account.providerAccountId);

  const now = new Date().toISOString();
  const updates = {
    verificationStatus: statusInfo.status,
    onboardingStatus: statusInfo.status,
    capabilities: statusInfo.capabilities || account.capabilities || {},
    settlementEligibility: statusInfo.isReadyForSettlement,
    requirements: statusInfo.requirements || [],
    lastSyncAt: now,
    updatedAt: now
  };

  if (adminDb) {
    await adminDb.collection(COLLECTION).doc(String(organizerId)).update(updates);
  }

  return {
    ...account,
    ...updates,
    isReadyForTransfers: statusInfo.isReadyForTransfers
  };
}

/**
 * Gatekeeper: Checks if an organizer is eligible to sell paid tickets.
 * In the independent settlement architecture, attendee payments flow directly
 * to TicketLelo's master Razorpay account, and settlements are managed independently
 * on a T+4 schedule via Super Admin bank/UPI payouts.
 * Organizers are NEVER blocked by a linked Razorpay account.
 */
export async function checkOrganizerEligibilityForPaidEvents(organizerId) {
  return {
    eligible: true,
    reason: 'INDEPENDENT_SETTLEMENT_GATEWAY_ACTIVE',
    account: null
  };
}

/**
 * Server-side assertion: throws an error if organizer cannot host a paid event
 * (Always succeeds in independent settlement architecture)
 */
export async function assertOrganizerPaidEventEligible(organizerId) {
  return {
    eligible: true,
    reason: 'INDEPENDENT_SETTLEMENT_GATEWAY_ACTIVE',
    account: null
  };
}
