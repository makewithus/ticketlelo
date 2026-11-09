import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-server';
import { retrySettlement } from '@/lib/payments/settlement-engine';

export async function POST(request) {
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

    const { settlementId, reason = 'Super Admin initiated transfer retry' } = await request.json();

    if (!settlementId) {
      return NextResponse.json({ error: 'settlementId is required' }, { status: 400 });
    }

    const result = await retrySettlement(settlementId, {
      adminId: caller.uid || caller.email,
      reason,
    });

    return NextResponse.json({
      success: true,
      message: `Settlement ${settlementId} requeued for transfer`,
      settlement: result,
    });
  } catch (err) {
    console.error('[/api/superadmin/settlements/retry] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to retry settlement' },
      { status: 500 }
    );
  }
}

