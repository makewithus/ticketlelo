import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-server';
import { runFinancialReconciliation, getLatestReconciliationReports } from '@/lib/payments/reconciliation';

/**
 * GET /api/payments/reconcile
 * Fetch latest reconciliation runs
 */
export async function GET(request) {
  try {
    const caller = await getAuthenticatedUser(request);
    if (!caller) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (caller.role !== 'superadmin' && caller.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Superadmin access required' }, { status: 403 });
    }

    const reports = await getLatestReconciliationReports(10);
    return NextResponse.json({ success: true, reports });
  } catch (error) {
    console.error('[API/payments/reconcile GET] Error:', error.message);
    return NextResponse.json({ error: error.message || 'Failed to fetch reconciliation reports' }, { status: 500 });
  }
}

/**
 * POST /api/payments/reconcile
 * Trigger automated reconciliation audit
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

    const { limit = 100 } = await request.json().catch(() => ({}));
    const report = await runFinancialReconciliation({ limit: Number(limit) || 100 });

    return NextResponse.json({
      success: true,
      message: 'Reconciliation audit completed',
      report
    });
  } catch (error) {
    console.error('[API/payments/reconcile POST] Error:', error.message);
    return NextResponse.json({ error: error.message || 'Reconciliation failed' }, { status: 500 });
  }
}
