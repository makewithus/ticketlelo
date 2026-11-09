import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-server';
import {
  resolveCommissionRule,
  saveCommissionRule,
  savePlanCommissionRule,
  getAllCommissionConfigurations,
} from '@/lib/payments/commission-engine';

/**
 * GET /api/payments/commission
 * Resolve effective platform commission rule for an event, organizer, or all plan tiers
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');
    const organizerId = searchParams.get('organizerId');
    const planId = searchParams.get('planId');
    const fetchAll = searchParams.get('all') === 'true';

    if (fetchAll) {
      const configurations = await getAllCommissionConfigurations();
      return NextResponse.json({ success: true, configurations });
    }

    const rule = await resolveCommissionRule({ eventId, organizerId, planId });
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
      return NextResponse.json({ error: 'Forbidden: Superadmin access required' }, { status: 403 });
    }

    const body = await request.json();

    // If configuring a plan tier (START / CAMPUS / FEST)
    if (body.planTier || body.planId) {
      const planId = body.planTier || body.planId;
      const ratePercent = body.ratePercent;
      const reason = body.reason || 'Admin updated plan platform fee';

      const rule = await savePlanCommissionRule({
        planId,
        ratePercent,
        updatedBy: caller.email || caller.uid,
        reason,
      });

      return NextResponse.json({
        success: true,
        message: `Plan fee for ${rule.planTier} updated to ${rule.ratePercent}%`,
        rule,
      });
    }

    // Custom rule (global / organizer / event)
    const {
      targetType,
      targetId,
      commissionType,
      ratePercent,
      fixedFeePaise,
      minCommissionPaise,
      maxCommissionPaise,
      currency,
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
      updatedBy: caller.email || caller.uid,
    });

    return NextResponse.json({
      success: true,
      message: `Commission rule version ${savedRule.version} saved successfully`,
      rule: savedRule,
    });
  } catch (error) {
    console.error('[API/payments/commission POST] Error:', error.message);
    return NextResponse.json({ error: error.message || 'Failed to save commission rule' }, { status: 500 });
  }
}
