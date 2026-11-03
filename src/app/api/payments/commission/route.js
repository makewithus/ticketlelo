import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-server';
import { resolveCommissionRule, saveCommissionRule } from '@/lib/payments/commission-engine';

/**
 * GET /api/payments/commission
 * Resolve effective platform commission rule for an event or organizer
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');
    const organizerId = searchParams.get('organizerId');

    const rule = await resolveCommissionRule({ eventId, organizerId });
    return NextResponse.json({ success: true, rule });
  } catch (error) {
    console.error('[API/payments/commission GET] Error:', error.message);
    return NextResponse.json({ error: error.message || 'Failed to resolve commission rule' }, { status: 500 });
  }
}

/**
 * POST /api/payments/commission
 * Superadmin endpoint to configure or update versioned platform commissions
 */
export async function POST(request) {
  try {
    const caller = await getAuthenticatedUser(request);
    if (!caller) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (caller.role !== 'superadmin' && caller.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Superadmin access required' }, { status: 403 });
    }

    const body = await request.json();
    const {
      targetType, // 'global' | 'organizer' | 'event'
      targetId,
      commissionType,
      ratePercent,
      fixedFeePaise,
      minCommissionPaise,
      maxCommissionPaise,
      currency
    } = body;

    const savedRule = await saveCommissionRule({
      targetType,
      targetId,
      commissionType,
      ratePercent,
      fixedFeePaise,
      minCommissionPaise,
      maxCommissionPaise,
      currency,
      updatedBy: caller.email || caller.uid
    });

    return NextResponse.json({
      success: true,
      message: `Commission rule version ${savedRule.version} saved successfully`,
      rule: savedRule
    });
  } catch (error) {
    console.error('[API/payments/commission POST] Error:', error.message);
    return NextResponse.json({ error: error.message || 'Failed to save commission rule' }, { status: 500 });
  }
}
