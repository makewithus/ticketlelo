import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-server';
import { processMarketplaceRefund } from '@/lib/payments/refunds';
import { adminDb } from '@/lib/firebase-admin';

/**
 * POST /api/payments/refund
 * Initiates full or partial refund with Route transfer reversals
 */
export async function POST(request) {
  try {
    const caller = await getAuthenticatedUser(request);
    if (!caller) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { orderId, amountPaise, reason } = body;

    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
    }

    if (!adminDb) {
      return NextResponse.json({ error: 'Database service unavailable' }, { status: 503 });
    }

    // Security check: Check order ownership
    const orderDoc = await adminDb.collection('orders').doc(orderId).get();
    if (!orderDoc.exists) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const orderData = orderDoc.data();
    const isSuperAdmin = caller.role === 'superadmin' || caller.role === 'admin';
    const isEventOrganizer = orderData.organizerId === caller.organizationId || orderData.organizerId === caller.uid;

    if (!isSuperAdmin && !isEventOrganizer) {
      return NextResponse.json({ error: 'Forbidden: You do not have authorization to refund this order' }, { status: 403 });
    }

    const result = await processMarketplaceRefund({
      orderId,
      amountPaise: amountPaise ? Number(amountPaise) : null,
      reason: reason || 'Refund issued via TicketLelo dashboard',
      initiatedBy: caller.email || caller.uid
    });

    return NextResponse.json({
      success: true,
      message: result.isFullRefund ? 'Full refund completed' : 'Partial refund completed',
      refund: result.refundRecord
    });
  } catch (error) {
    console.error('[API/payments/refund POST] Error:', error.message);
    return NextResponse.json({ error: error.message || 'Refund processing failed' }, { status: 500 });
  }
}
