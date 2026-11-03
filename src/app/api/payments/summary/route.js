import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-server';
import { getLedgerSummaryForOrganizer } from '@/lib/payments/ledger';
import { adminDb } from '@/lib/firebase-admin';

/**
 * GET /api/payments/summary
 * Fetch financial rollup metrics and transaction history for organizer or platform
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
    const limitParam = Number(searchParams.get('limit') || 50);

    const emailLower = (caller.email || '').toLowerCase().trim();
    const isSuperAdmin =
      caller.role === 'superAdmin' ||
      caller.role === 'superadmin' ||
      caller.role === 'admin' ||
      caller.isAdmin === true ||
      emailLower === 'adil4ticketlelo@gmail.com' ||
      emailLower === 'superadmin@ticketlelo.com' ||
      emailLower === (process.env.SUPER_ADMIN_EMAIL || '').toLowerCase().trim();

    if (!isSuperAdmin && requestedOrgId && requestedOrgId !== caller.organizationId && requestedOrgId !== caller.uid) {
      return NextResponse.json({ error: 'Forbidden: Access denied' }, { status: 403 });
    }

    const targetOrgId = isSuperAdmin
      ? (requestedOrgId && requestedOrgId !== 'all' ? requestedOrgId : null)
      : (requestedOrgId || caller.organizationId || caller.uid);

    if (!adminDb) {
      return NextResponse.json({ error: 'Database service unavailable' }, { status: 503 });
    }

    // 1. Rollup totals from Ledger
    let ledgerTotals = await getLedgerSummaryForOrganizer(targetOrgId);

    // 2. Fetch recent transactions for table display
    let query = adminDb.collection('orders');
    if (targetOrgId) {
      query = query.where('organizerId', '==', String(targetOrgId));
    }
    if (eventId) {
      query = query.where('eventId', '==', String(eventId));
    }

    query = query.orderBy('createdAt', 'desc').limit(limitParam);
    let ordersSnap;
    try {
      ordersSnap = await query.get();
    } catch {
      // Fallback query if compound index is pending
      ordersSnap = await adminDb.collection('orders').limit(limitParam).get();
    }

    // If ledger summary was empty but orders exist, aggregate from orders
    if (ledgerTotals.grossSalesPaise === 0 && !ordersSnap.empty) {
      let calcGross = 0;
      let calcFee = 0;
      let calcRefund = 0;

      ordersSnap.docs.forEach(doc => {
        const d = doc.data();
        const isPaid = d.status === 'paid' || d.paymentStatus === 'CAPTURED' || d.status === 'success';
        if (isPaid) {
          const gross = Number(d.amount || d.finalPayablePaise || 0);
          const fee = Number(d.platformCommissionPaise || d.platformFee || Math.round(gross * 0.03));
          const refund = Number(d.refundedAmountPaise || 0);
          calcGross += gross;
          calcFee += fee;
          calcRefund += refund;
        }
      });

      if (calcGross > 0) {
        ledgerTotals = {
          grossSalesPaise: calcGross,
          organizerNetPaise: Math.max(0, calcGross - calcFee - calcRefund),
          platformCommissionPaise: calcFee,
          refundedPaise: calcRefund
        };
      }
    }

    const transactions = ordersSnap.docs.map(doc => {
      const data = doc.data();
      const grossPaise = Number(data.amount || data.finalPayablePaise || 0);
      const platformFeePaise = Number(data.platformCommissionPaise || data.platformFee || 0);
      const organizerSharePaise = grossPaise - platformFeePaise;

      return {
        id: doc.id,
        orderId: doc.id,
        bookingId: data.bookingId || doc.id,
        eventId: data.eventId,
        eventTitle: data.eventTitle || 'Event',
        buyerName: data.registrationData?.fullName || 'Attendee',
        buyerEmail: data.registrationData?.email || '',
        ticketTitle: data.ticketConfig?.title || 'Ticket',
        quantity: data.quantity || 1,
        grossPaise,
        platformFeePaise,
        organizerSharePaise,
        refundedAmountPaise: data.refundedAmountPaise || 0,
        paymentStatus: data.paymentStatus || data.status || 'pending',
        transferStatus: data.transferStatus || 'NOT_APPLICABLE',
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt
      };
    });

    return NextResponse.json({
      success: true,
      summary: ledgerTotals,
      transactions
    });
  } catch (error) {
    console.error('[API/payments/summary GET] Error:', error.message);
    return NextResponse.json({ error: error.message || 'Failed to fetch summary' }, { status: 500 });
  }
}
