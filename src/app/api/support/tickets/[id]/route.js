import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-server';
import {
  getTicketById,
  updateTicketStatus,
  assignTicket,
} from '@/lib/support/support-service.js';
import { SUPPORT_ROLES } from '@/lib/support/types.js';

export async function GET(request, { params }) {
  try {
    const caller = await getAuthenticatedUser(request);
    if (!caller) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id: ticketId } = await params;
    if (!ticketId) {
      return NextResponse.json({ error: 'ticketId is required' }, { status: 400 });
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

    const callerRole = isSuperAdmin ? SUPPORT_ROLES.SUPERADMIN : SUPPORT_ROLES.ORGANIZER;
    const callerId = caller.organizationId || caller.uid;

    const ticket = await getTicketById(ticketId, { callerRole, callerId });
    if (!ticket) {
      return NextResponse.json({ error: 'Support ticket not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, ticket });
  } catch (err) {
    console.error('[/api/support/tickets/[id]] GET error:', err);
    const status = err.statusCode || 500;
    return NextResponse.json({ error: err.message || 'Failed to fetch ticket' }, { status });
  }
}

export async function PATCH(request, { params }) {
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

    const { id: ticketId } = await params;
    const body = await request.json();

    let updatedTicket = null;

    if (body.status) {
      updatedTicket = await updateTicketStatus(ticketId, {
        newStatus: body.status,
        adminId: caller.uid || caller.email,
        reason: body.reason || 'Admin updated ticket status',
      });
    }

    if (body.assignedTo) {
      await assignTicket(ticketId, {
        assignedTo: body.assignedTo,
        assignedToName: body.assignedToName || body.assignedTo,
        adminId: caller.uid,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Ticket updated successfully',
      ticket: updatedTicket,
    });
  } catch (err) {
    console.error('[/api/support/tickets/[id]] PATCH error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to update ticket' },
      { status: 500 }
    );
  }
}

