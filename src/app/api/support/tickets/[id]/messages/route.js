import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-server';
import { addMessageToTicket } from '@/lib/support/support-service.js';
import { SUPPORT_ROLES } from '@/lib/support/types.js';

export async function POST(request, { params }) {
  try {
    const caller = await getAuthenticatedUser(request);
    if (!caller) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id: ticketId } = await params;
    if (!ticketId) {
      return NextResponse.json({ error: 'ticketId is required' }, { status: 400 });
    }

    const body = await request.json();

    const emailLower = (caller.email || '').toLowerCase().trim();
    const isSuperAdmin =
      caller.role === 'superAdmin' ||
      caller.role === 'superadmin' ||
      caller.role === 'admin' ||
      caller.isAdmin === true ||
      emailLower === 'adil4ticketlelo@gmail.com' ||
      emailLower === 'superadmin@ticketlelo.com' ||
      emailLower === (process.env.SUPER_ADMIN_EMAIL || '').toLowerCase().trim();

    const senderRole = isSuperAdmin ? SUPPORT_ROLES.SUPERADMIN : SUPPORT_ROLES.ORGANIZER;
    const senderId = caller.uid || caller.email;
    const senderName = caller.name || caller.displayName || (isSuperAdmin ? 'TicketLelo Support' : 'Organizer');

    const message = await addMessageToTicket(ticketId, {
      senderId,
      senderName,
      senderRole,
      content: body.content,
      isInternalNote: isSuperAdmin ? Boolean(body.isInternalNote) : false,
      attachments: body.attachments || [],
    });

    return NextResponse.json({
      success: true,
      message,
    });
  } catch (err) {
    console.error('[/api/support/tickets/[id]/messages] POST error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to post message' },
      { status: 500 }
    );
  }
}

