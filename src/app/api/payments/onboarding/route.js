import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-server';
import { saveOrganizerPayoutProfile, getOrganizerPayoutProfile } from '@/lib/payments/payout-engine';

/**
 * GET /api/payments/onboarding
 * Query current payout and settlement readiness for the organizer.
 * In the independent settlement architecture, organizers are immediately ready
 * to publish events and receive payments without a linked Razorpay account.
 */
export async function GET(request) {
  try {
    const caller = await getAuthenticatedUser(request);
    if (!caller) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requestedOrgId = searchParams.get('organizerId');

    const organizerId = requestedOrgId || caller.organizationId || caller.uid;
    const isOwner = caller.organizationId === organizerId || caller.uid === organizerId;
    const isSuperAdmin = caller.role === 'superadmin' || caller.role === 'admin' || caller.role === 'superAdmin';

    if (!isOwner && !isSuperAdmin) {
      return NextResponse.json({ error: 'Forbidden: Access to this organizer account is denied' }, { status: 403 });
    }

    const profile = await getOrganizerPayoutProfile(organizerId);

    const sanitizedAccount = {
      connected: true,
      organizerId,
      provider: 'manual',
      providerAccountId: profile?.accountNumber ? `bank_${organizerId.slice(0, 8)}` : (profile?.upiId || `payout_${organizerId.slice(0, 8)}`),
      legalBusinessName: profile?.organizerName || 'Organizer',
      verificationStatus: 'ACTIVE',
      onboardingStatus: 'ACTIVE',
      settlementEligibility: true,
      isReadyForTransfers: true,
      isReadyForSettlement: true,
      payoutMethod: profile?.payoutMethod || (profile?.accountNumber ? 'BANK_TRANSFER' : 'UPI'),
      hasPayoutProfile: Boolean(profile),
      updatedAt: profile?.updatedAt || new Date().toISOString()
    };

    return NextResponse.json({ success: true, account: sanitizedAccount });
  } catch (error) {
    console.error('[API/payments/onboarding GET] Error:', error.message);
    return NextResponse.json({ error: error.message || 'Failed to fetch payout status' }, { status: 500 });
  }
}

/**
 * POST /api/payments/onboarding
 * Saves organizer bank account or UPI payout details for independent settlements.
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
      organizerName,
      email,
      phone,
      accountHolderName,
      accountNumber,
      ifsc,
      bankName,
      upiId,
      pan,
      gstin,
      billingAddress,
    } = body;

    const targetOrgId = reqOrgId || caller.organizationId || caller.uid;
    const isOwner = caller.organizationId === targetOrgId || caller.uid === targetOrgId;
    const isSuperAdmin = caller.role === 'superadmin' || caller.role === 'admin' || caller.role === 'superAdmin';

    if (!isOwner && !isSuperAdmin) {
      return NextResponse.json({ error: 'Forbidden: Access to this organizer account is denied' }, { status: 403 });
    }

    const savedProfile = await saveOrganizerPayoutProfile(
      targetOrgId,
      {
        organizerName: legalBusinessName || organizerName || caller.displayName || 'Organizer',
        accountHolderName: accountHolderName || legalBusinessName || organizerName || caller.displayName || '',
        accountNumber,
        ifsc,
        bankName: bankName || 'Bank Account',
        fullUpiId: upiId || null,
        email: email || caller.email || '',
        phone: phone || caller.phone || '',
        pan,
        gstin,
        billingAddress,
      },
      caller
    );

    return NextResponse.json({
      success: true,
      message: 'Payout details saved successfully for independent settlements.',
      account: {
        organizerId: targetOrgId,
        provider: 'manual',
        verificationStatus: 'ACTIVE',
        settlementEligibility: true,
        payoutProfile: savedProfile
      }
    });
  } catch (error) {
    console.error('[API/payments/onboarding POST] Error:', error.message);
    return NextResponse.json({ error: error.message || 'Failed to save payout details' }, { status: 500 });
  }
}
