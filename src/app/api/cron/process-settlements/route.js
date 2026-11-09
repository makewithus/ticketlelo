import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getAuthenticatedUser } from '@/lib/auth-server';
import { processSettlementBatch } from '@/lib/payments/settlement-engine';

/**
 * GET /api/cron/process-settlements
 * POST /api/cron/process-settlements
 *
 * Automated cron trigger to disburse matured T+4 working-day settlements.
 * Authorized either via Vercel Cron Bearer token or by an authenticated Super Admin.
 */
async function handleSettlementCron(request) {
  try {
    if (!adminDb) {
      return NextResponse.json({ error: 'Database service unavailable' }, { status: 503 });
    }

    // Check authorization: Bearer CRON_SECRET or Super Admin session
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    let isAuthorized = false;

    if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
      isAuthorized = true;
    } else {
      const caller = await getAuthenticatedUser(request);
      if (caller) {
        const emailLower = (caller.email || '').toLowerCase().trim();
        if (
          caller.role === 'superAdmin' ||
          caller.role === 'superadmin' ||
          caller.role === 'admin' ||
          caller.isAdmin === true ||
          emailLower === 'adil4ticketlelo@gmail.com' ||
          emailLower === 'superadmin@ticketlelo.com'
        ) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized cron invocation' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get('dryRun') === 'true';
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 50)));

    const result = await processSettlementBatch({ limit, dryRun });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      dryRun,
      ...result,
    });
  } catch (err) {
    console.error('[/api/cron/process-settlements] Cron error:', err);
    return NextResponse.json(
      { error: err.message || 'Settlement batch execution failed' },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  return handleSettlementCron(request);
}

export async function POST(request) {
  return handleSettlementCron(request);
}

