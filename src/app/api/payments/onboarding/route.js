import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-server';
import {
  initiateOrganizerOnboarding,
  syncOrganizerAccountStatus,
  getOrganizerConnectedAccount
} from '@/lib/payments/connected-accounts';
import { PAYMENT_PROVIDERS } from '@/lib/payments/types';

/**
 * GET /api/payments/onboarding
 * Query current onboarding status and capability flags for the organizer
 */
export async function GET(request) {
  try {
    const caller = await getAuthenticatedUser(request);
    if (!caller) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requestedOrgId = searchParams.get('organizerId');

    // Strict tenant isolation: Caller must be the organizer or a superadmin
    const organizerId = requestedOrgId || caller.organizationId || caller.uid;
    const isOwner = caller.organizationId === organizerId || caller.uid === organizerId;
    const isSuperAdmin = caller.role === 'superadmin' || caller.role === 'admin';

    if (!isOwner && !isSuperAdmin) {
      return NextResponse.json({ error: 'Forbidden: Access to this organizer account is denied' }, { status: 403 });
    }

    // Sync status with payment provider if sync=true flag passed
    const shouldSync = searchParams.get('sync') === 'true';
    let account = null;

    if (shouldSync) {
      account = await syncOrganizerAccountStatus(organizerId);
    } else {
      account = await getOrganizerConnectedAccount(organizerId);
    }

    if (!account) {
      return NextResponse.json({
        connected: false,
        status: 'NOT_CONNECTED',
        isReadyForTransfers: false,
        isReadyForSettlement: false
      });
    }

    // Never leak raw banking credentials or secret metadata
    const sanitizedAccount = {
      connected: true,
      organizerId: account.organizerId,
      provider: account.provider,
      providerAccountId: account.providerAccountId,
      legalBusinessName: account.legalBusinessName,
      businessType: account.businessType,
      verificationStatus: account.verificationStatus,
      onboardingStatus: account.onboardingStatus,
      settlementEligibility: Boolean(account.settlementEligibility),
      capabilities: account.capabilities || {},
      requirements: account.requirements || [],
      lastSyncAt: account.lastSyncAt,
      createdAt: account.createdAt
    };

    return NextResponse.json({ success: true, account: sanitizedAccount });
  } catch (error) {
    console.error('[API/payments/onboarding GET] Error:', error.message);
    return NextResponse.json({ error: error.message || 'Failed to fetch onboarding status' }, { status: 500 });
  }
}

/**
 * POST /api/payments/onboarding
 * Initiate Route linked account creation for an organizer
 */
export async function POST(request) {
  try {
    const caller = await getAuthenticatedUser(request);
    if (!caller) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const {
      organizerId: reqOrgId,
      legalBusinessName,
      businessType = 'individual',
      email,
      phone,
      provider = PAYMENT_PROVIDERS.RAZORPAY_ROUTE
    } = body;

    const targetOrgId = reqOrgId || caller.organizationId || caller.uid;
    const isOwner = caller.organizationId === targetOrgId || caller.uid === targetOrgId;
    const isSuperAdmin = caller.role === 'superadmin' || caller.role === 'admin';

    if (!isOwner && !isSuperAdmin) {
      return NextResponse.json({ error: 'Forbidden: Access to this organizer account is denied' }, { status: 403 });
    }

    if (!legalBusinessName) {
      return NextResponse.json({ error: 'legalBusinessName is required' }, { status: 400 });
    }

    const contactEmail = email || caller.email;
    if (!contactEmail) {
      return NextResponse.json({ error: 'email is required' }, { status: 400 });
    }

    const result = await initiateOrganizerOnboarding({
      organizerId: targetOrgId,
      email: contactEmail,
      legalBusinessName,
      businessType,
      phone,
      provider
    });

    return NextResponse.json({
      success: true,
      message: result.alreadyActive ? 'Account is already active' : 'Connected account onboarding initiated',
      account: {
        organizerId: result.connectedAccount.organizerId,
        provider: result.connectedAccount.provider,
        providerAccountId: result.connectedAccount.providerAccountId,
        verificationStatus: result.connectedAccount.verificationStatus,
        settlementEligibility: result.connectedAccount.settlementEligibility
      }
    });
  } catch (error) {
    console.error('[API/payments/onboarding POST] Error:', error.message);
    return NextResponse.json({ error: error.message || 'Failed to initiate onboarding' }, { status: 500 });
  }
}
