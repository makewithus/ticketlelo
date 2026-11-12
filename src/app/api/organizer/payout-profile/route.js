import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-server';
import {
  getOrganizerPayoutProfile,
  saveOrganizerPayoutProfile,
  validateUpiId,
  validateBankName,
  UPI_HANDLES,
  BANK_NAMES,
} from '@/lib/payments/payout-engine';

/**
 * GET /api/organizer/payout-profile
 * Fetches the organizer's saved payout profile.
 */
export async function GET(request) {
  try {
    const caller = await getAuthenticatedUser(request);
    if (!caller) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requestedOrgId = searchParams.get('organizerId');

    const emailLower = (caller.email || '').toLowerCase().trim();
    const isSuperAdmin =
      caller.role === 'superAdmin' ||
      caller.role === 'superadmin' ||
      caller.role === 'admin' ||
      caller.isAdmin === true ||
      emailLower === 'adil4ticketlelo@gmail.com' ||
      emailLower === 'superadmin@ticketlelo.com' ||
      emailLower === (process.env.SUPER_ADMIN_EMAIL || '').toLowerCase().trim();

    const targetOrgId = isSuperAdmin
      ? (requestedOrgId || caller.organizationId || caller.uid)
      : (caller.organizationId || caller.uid);

    if (!targetOrgId) {
      return NextResponse.json({ error: 'Organizer ID not resolved' }, { status: 400 });
    }

    const profile = await getOrganizerPayoutProfile(targetOrgId);

    return NextResponse.json({
      success: true,
      profile: profile || null,
      availableHandles: UPI_HANDLES,
      availableBanks: BANK_NAMES,
    });
  } catch (error) {
    console.error('[/api/organizer/payout-profile] GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch payout profile' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/organizer/payout-profile
 * Saves or updates organizer payout details with UPI and Bank validation.
 */
export async function POST(request) {
  try {
    const caller = await getAuthenticatedUser(request);
    if (!caller) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const {
      organizerId: requestedOrgId,
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
    } = body;

    const emailLower = (caller.email || '').toLowerCase().trim();
    const isSuperAdmin =
      caller.role === 'superAdmin' ||
      caller.role === 'superadmin' ||
      caller.role === 'admin' ||
      caller.isAdmin === true ||
      emailLower === 'adil4ticketlelo@gmail.com' ||
      emailLower === 'superadmin@ticketlelo.com' ||
      emailLower === (process.env.SUPER_ADMIN_EMAIL || '').toLowerCase().trim();

    const targetOrgId = isSuperAdmin && requestedOrgId
      ? requestedOrgId
      : (caller.organizationId || caller.uid);

    if (!targetOrgId) {
      return NextResponse.json({ error: 'Organizer ID not resolved' }, { status: 400 });
    }

    // Verify format if UPI is provided
    let upiResult = { isValid: true, disclaimer: null };
    if (username || fullUpiId) {
      upiResult = validateUpiId({ username, handle, customHandle, fullUpiId });
      if (!upiResult.isValid && !accountNumber) {
        return NextResponse.json({ error: upiResult.error }, { status: 400 });
      }
    }

    if (bankName || customBankName) {
      const bankResult = validateBankName(bankName, customBankName);
      if (!bankResult.isValid) {
        return NextResponse.json({ error: bankResult.error }, { status: 400 });
      }
    }

    const savedProfile = await saveOrganizerPayoutProfile(
      targetOrgId,
      {
        username,
        handle,
        customHandle,
        fullUpiId,
        bankName,
        customBankName,
        organizerName: organizerName || caller.displayName || caller.fullName || 'Organizer',
        email: email || caller.email || '',
        phone: phone || caller.phone || '',
        accountHolderName,
        accountNumber,
        ifsc,
        pan,
        gstin,
        billingAddress,
      },
      caller
    );

    return NextResponse.json({
      success: true,
      message: 'Payout profile saved successfully.',
      profile: savedProfile,
      disclaimer: upiResult?.disclaimer || null,
    });
  } catch (error) {
    console.error('[/api/organizer/payout-profile] POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to save payout profile' },
      { status: 500 }
    );
  }
}

