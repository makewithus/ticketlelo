import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-server';
import {
  getPayoutById,
  confirmPayoutPayment,
  holdPayout,
  releasePayoutHold,
  retryPayout,
} from '@/lib/payments/payout-engine';

/**
 * GET /api/superadmin/payouts/[payoutId]
 * Fetches detailed payout breakdown.
 */
export async function GET(request, { params }) {
  try {
    const caller = await getAuthenticatedUser(request);
    if (!caller) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const emailLower = (caller.email || '').toLowerCase().trim();
    const isSuperAdmin =
      caller.role === 'superAdmin' ||
      caller.role === 'superadmin' ||
      caller.role === 'admin' ||
      caller.isAdmin === true ||
      emailLower === 'adil4ticketlelo@gmail.com' ||
      emailLower === 'superadmin@ticketlelo.com' ||
      emailLower === (process.env.SUPER_ADMIN_EMAIL || '').toLowerCase().trim();

    if (!isSuperAdmin) {
      return NextResponse.json({ error: 'Forbidden: Super Admin access required' }, { status: 403 });
    }

    const { payoutId } = await params;
    if (!payoutId) {
      return NextResponse.json({ error: 'Payout ID is required' }, { status: 400 });
    }

    const payout = await getPayoutById(payoutId);
    return NextResponse.json({ success: true, payout });
  } catch (error) {
    console.error('[/api/superadmin/payouts/[payoutId]] GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch payout' },
      { status: 404 }
    );
  }
}

/**
 * POST /api/superadmin/payouts/[payoutId]
 * Performs manual UPI confirmation, hold, release, or retry.
 */
export async function POST(request, { params }) {
  try {
    const caller = await getAuthenticatedUser(request);
    if (!caller) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const emailLower = (caller.email || '').toLowerCase().trim();
    const isSuperAdmin =
      caller.role === 'superAdmin' ||
      caller.role === 'superadmin' ||
      caller.role === 'admin' ||
      caller.isAdmin === true ||
      emailLower === 'adil4ticketlelo@gmail.com' ||
      emailLower === 'superadmin@ticketlelo.com' ||
      emailLower === (process.env.SUPER_ADMIN_EMAIL || '').toLowerCase().trim();

    if (!isSuperAdmin) {
      return NextResponse.json({ error: 'Forbidden: Super Admin access required' }, { status: 403 });
    }

    const { payoutId } = await params;
    if (!payoutId) {
      return NextResponse.json({ error: 'Payout ID is required' }, { status: 400 });
    }

    const body = await request.json();
    const action = (body.action || 'CONFIRM_PAYMENT').toUpperCase();

    if (action === 'CONFIRM_PAYMENT') {
      const { utr, receiptUrl, remarks } = body;
      if (!utr || !String(utr).trim()) {
        return NextResponse.json(
          { error: 'UPI Transaction ID / UTR is required to confirm payment.' },
          { status: 400 }
        );
      }

      const updatedPayout = await confirmPayoutPayment({
        payoutId,
        utr: String(utr).trim(),
        receiptUrl,
        remarks,
        adminUser: caller,
      });

      return NextResponse.json({
        success: true,
        message: `Payout ${payoutId} confirmed and marked as Paid.`,
        payout: updatedPayout,
      });
    }

    if (action === 'HOLD') {
      const { reason } = body;
      if (!reason || !String(reason).trim()) {
        return NextResponse.json(
          { error: 'A mandatory reason is required to place a payout on hold.' },
          { status: 400 }
        );
      }

      const updatedPayout = await holdPayout(payoutId, reason, caller);
      return NextResponse.json({
        success: true,
        message: `Payout ${payoutId} placed on hold.`,
        payout: updatedPayout,
      });
    }

    if (action === 'RELEASE') {
      const updatedPayout = await releasePayoutHold(payoutId, caller);
      return NextResponse.json({
        success: true,
        message: `Hold released for payout ${payoutId}.`,
        payout: updatedPayout,
      });
    }

    if (action === 'RETRY') {
      const updatedPayout = await retryPayout(payoutId, caller);
      return NextResponse.json({
        success: true,
        message: `Retry initiated for payout ${payoutId}.`,
        payout: updatedPayout,
      });
    }

    return NextResponse.json({ error: `Unsupported action: ${action}` }, { status: 400 });
  } catch (error) {
    console.error('[/api/superadmin/payouts/[payoutId]] POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process payout action' },
      { status: 400 }
    );
  }
}

