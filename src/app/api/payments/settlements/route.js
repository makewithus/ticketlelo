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

    const rawFilter = (statusFilter || 'ALL').toUpperCase();
    const normalizedFilter = rawFilter === 'HELD' ? 'ON_HOLD' : (rawFilter === 'COMPLETED' ? 'SETTLED' : rawFilter);
    if (normalizedFilter !== 'ALL' && SETTLEMENT_STATUSES[normalizedFilter]) {
      query = query.where('status', '==', normalizedFilter);
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

    const rawSettlements = settlementsSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Distinguish test vs production (H2)
    const isTestRecord = (s) =>
      Boolean(
        s.isTest ||
        s.testMode ||
        s.environment === 'test' ||
        String(s.orderId || '').startsWith('test_') ||
        String(s.orderId || '') === 'legacy_order_9999' ||
        String(s.orderId || '').startsWith('ord_test') ||
        String(s.organizerId || '').startsWith('org_test') ||
        String(s.id || '').includes('test_settle') ||
        String(s.id || '').includes('legacy_order_9999')
      );

    const includeTest = searchParams.get('includeTest') === 'true';
    const filteredSettlements = includeTest ? rawSettlements : rawSettlements.filter((s) => !isTestRecord(s));

    // Resolve organizer names from users collection (H2)
    const orgIds = Array.from(new Set(filteredSettlements.map((s) => s.organizerId).filter(Boolean)));
    const organizerNameMap = new Map();
    if (orgIds.length > 0 && adminDb) {
      try {
        for (let i = 0; i < orgIds.length; i += 30) {
          const chunk = orgIds.slice(i, i + 30);
          const usersSnap = await adminDb.collection('users').where('__name__', 'in', chunk).get();
          usersSnap.forEach((uDoc) => {
            const u = uDoc.data();
            const resolvedName = u.displayName || u.name || u.organizationName || u.college || u.email;
            if (resolvedName) organizerNameMap.set(uDoc.id, resolvedName);
          });
        }
      } catch (_orgErr) {
        console.warn('Failed to resolve organizer names:', _orgErr.message);
      }
    }

    const nowMs = Date.now();
    const settlements = filteredSettlements.map((d) => {
      const gross = Number(d.grossAmountPaise || 0);
      const fee = Number(d.platformFeePaise || 0);
      const net = Number(d.netOrganizerPaise ?? (gross - fee));
      const maturityMs = d.tPlus4OrganizerDate ? new Date(d.tPlus4OrganizerDate).getTime() : 0;
      const isMatured = maturityMs > 0 && nowMs >= maturityMs;

      let effectiveStatus = d.status;
      if (effectiveStatus === SETTLEMENT_STATUSES.PENDING && isMatured) {
        effectiveStatus = SETTLEMENT_STATUSES.ELIGIBLE;
      }

      const formattedDate = d.tPlus4OrganizerDate
        ? new Date(d.tPlus4OrganizerDate).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })
        : null;

      const resolvedOrgName =
        d.organizerName ||
        organizerNameMap.get(d.organizerId) ||
        (d.organizerId ? `Organizer (${d.organizerId.slice(0, 8)})` : 'Independent Organizer');

      return {
        ...d,
        id: d.id,
        settlementId: d.settlementId || d.id,
        status: effectiveStatus,
        netOrganizerPaise: net,
        netPayablePaise: net,
        grossAmountPaise: gross,
        platformFeePaise: fee,
        organizerName: resolvedOrgName,
        dueDateFormatted: formattedDate,
        scheduledSettlementDate: formattedDate,
        dueDate: d.tPlus4OrganizerDate,
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

