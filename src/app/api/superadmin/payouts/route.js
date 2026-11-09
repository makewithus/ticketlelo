import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-server';
import { listPayouts } from '@/lib/payments/payout-engine';

/**
 * GET /api/superadmin/payouts
 * Fetches payout overview statistics and filterable payout management tasks.
 */
export async function GET(request) {
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

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'ALL';
    const searchTerm = searchParams.get('search') || '';
    const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit') || 100)));

    const result = await listPayouts({
      organizerId: 'all',
      status,
      searchTerm,
      limit,
    });

    return NextResponse.json({
      success: true,
      summary: result.summary,
      payouts: result.payouts,
      count: result.count,
    });
  } catch (error) {
    console.error('[/api/superadmin/payouts] GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to list payouts' },
      { status: 500 }
    );
  }
}

