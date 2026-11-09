import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-server';
import { holdSettlement, releaseSettlementHold } from '@/lib/payments/settlement-engine';

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

    const { settlementId, action = 'HOLD', reason } = await request.json();

    if (!settlementId) {
      return NextResponse.json({ error: 'settlementId is required' }, { status: 400 });
    }

    if (action === 'HOLD') {
      if (!reason || !reason.trim()) {
        return NextResponse.json(
          { error: 'A mandatory reason is required to place a settlement on hold' },
          { status: 400 }
        );
      }

      const result = await holdSettlement(settlementId, {
        reason: reason.trim(),
        adminId: caller.uid || caller.email,
      });

      return NextResponse.json({
        success: true,
        message: `Settlement ${settlementId} placed on hold`,
        settlement: result,
      });
    } else if (action === 'RELEASE') {
      const result = await releaseSettlementHold(settlementId, {
        adminId: caller.uid || caller.email,
        reason: reason || 'Admin released hold',
      });

      return NextResponse.json({
        success: true,
        message: `Hold released for settlement ${settlementId}`,
        settlement: result,
      });
    } else {
      return NextResponse.json({ error: `Invalid action: ${action}. Expected HOLD or RELEASE.` }, { status: 400 });
    }
  } catch (err) {
    console.error('[/api/superadmin/settlements/hold] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to process settlement hold action' },
      { status: 500 }
    );
  }
}

