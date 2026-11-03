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
 * Gatekeeper: Checks if an organizer is eligible to sell paid tickets
 * Free events are ALWAYS permitted and do not require onboarding.
 */
export async function checkOrganizerEligibilityForPaidEvents(organizerId) {
  // If route feature flag is explicitly disabled, platform operates in legacy/direct merchant mode
  const isRouteEnabled = process.env.RAZORPAY_ROUTE_ENABLED === 'true';
  if (!isRouteEnabled) {
    return {
      eligible: true,
      reason: 'MARKETPLACE_ROUTE_DISABLED_LEGACY_MODE',
      account: null
    };
  }

  if (!organizerId) {
    return {
      eligible: false,
      reason: 'MISSING_ORGANIZER_ID',
      account: null
    };
  }

  const account = await getOrganizerConnectedAccount(organizerId);
  if (!account) {
    return {
      eligible: false,
      reason: 'ACCOUNT_NOT_CONNECTED',
      account: null
    };
  }

  if (account.verificationStatus !== CONNECTED_ACCOUNT_STATUSES.ACTIVE) {
    return {
      eligible: false,
      reason: `ACCOUNT_${account.verificationStatus}`,
      account
    };
  }

  return {
    eligible: true,
    reason: 'ACTIVE_AND_VERIFIED',
    account
  };
}

/**
 * Server-side assertion: throws an error if organizer cannot host a paid event
 */
export async function assertOrganizerPaidEventEligible(organizerId) {
  const result = await checkOrganizerEligibilityForPaidEvents(organizerId);
  if (!result.eligible) {
    const error = new Error(`Organizer is not eligible to publish paid events: ${result.reason}`);
    error.code = 'ORGANIZER_PAYMENT_ACCOUNT_INELIGIBLE';
    error.details = result;
    throw error;
  }
  return result.account;
}
