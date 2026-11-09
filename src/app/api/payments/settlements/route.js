import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-server';
import { adminDb } from '@/lib/firebase-admin';
import {
  getSettlementFinancialSummary,
  SETTLEMENT_STATUSES,
} from '@/lib/payments/settlement-engine';
import { listPayouts } from '@/lib/payments/payout-engine';

/**
 * GET /api/payments/settlements
 * Returns settlement overview metrics and detailed settlement records.
 */
export async function GET(request) {
  try {
    const caller = await getAuthenticatedUser(request);
    if (!caller) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requestedOrgId = searchParams.get('organizerId');
    const eventId = searchParams.get('eventId');
    const statusFilter = searchParams.get('status') || 'ALL';
    const limitParam = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 50)));

    const emailLower = (caller.email || '').toLowerCase().trim();
    const isSuperAdmin =
      caller.role === 'superAdmin' ||
      caller.role === 'superadmin' ||
      caller.role === 'admin' ||
      caller.isAdmin === true ||
      emailLower === 'adil4ticketlelo@gmail.com' ||
      emailLower === 'superadmin@ticketlelo.com' ||
      emailLower === (process.env.SUPER_ADMIN_EMAIL || '').toLowerCase().trim();

    // Permission enforcement: non-admins cannot query other organizers' settlements
    if (!isSuperAdmin && requestedOrgId && requestedOrgId !== caller.organizationId && requestedOrgId !== caller.uid) {
      return NextResponse.json({ error: 'Forbidden: Access denied' }, { status: 403 });
    }

    const targetOrgId = isSuperAdmin
      ? (requestedOrgId && requestedOrgId !== 'all' ? requestedOrgId : null)
      : (requestedOrgId || caller.organizationId || caller.uid);

    if (!adminDb) {
      return NextResponse.json({ error: 'Database service unavailable' }, { status: 503 });
    }

    // 1. Fetch Rollup Financial Summary
    const summary = await getSettlementFinancialSummary(targetOrgId);

    // 2. Query Settlement Records
    let query = adminDb.collection('settlements');
    if (targetOrgId) {
      query = query.where('organizerId', '==', String(targetOrgId));
    }
    if (eventId) {
      query = query.where('eventId', '==', String(eventId));
    }
    if (statusFilter && statusFilter !== 'ALL' && SETTLEMENT_STATUSES[statusFilter]) {
      query = query.where('status', '==', statusFilter);
    }

    query = query.orderBy('createdAt', 'desc').limit(limitParam);

    let settlementsSnap;
    try {
      settlementsSnap = await query.get();
    } catch (_idxErr) {
      // Fallback if composite index is pending
      let fallbackQuery = adminDb.collection('settlements');
      if (targetOrgId) fallbackQuery = fallbackQuery.where('organizerId', '==', String(targetOrgId));
      fallbackQuery = fallbackQuery.limit(limitParam);
      settlementsSnap = await fallbackQuery.get();
    }

    const settlements = settlementsSnap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        ...d,
      };
    });

    // Also fetch event-level organizer payout tasks
    let payouts = [];
    try {
      const payoutsRes = await listPayouts({
        organizerId: targetOrgId,
        limit: limitParam,
      });
      payouts = payoutsRes.payouts || [];
    } catch (_pErr) {
      // Fallback
    }

    return NextResponse.json({
      success: true,
      summary,
      settlements,
      payouts,
      count: settlements.length,
    });
  } catch (error) {
    console.error('[/api/payments/settlements] Error fetching settlements:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch settlements' },
      { status: 500 }
    );
  }
}

