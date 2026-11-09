import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-server';
import {
  listTicketsForSuperAdmin,
  updateTicketStatus,
  assignTicket,
} from '@/lib/support/support-service.js';

export async function GET(request) {
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

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'ALL';
    const category = searchParams.get('category') || 'ALL';
    const priority = searchParams.get('priority') || 'ALL';
    const searchTerm = searchParams.get('search') || '';
    const limitParam = Number(searchParams.get('limit') || 100);

    const tickets = await listTicketsForSuperAdmin({
      status,
      category,
      priority,
      searchTerm,
      limitParam,
    });

    return NextResponse.json({
      success: true,
      tickets,
      count: tickets.length,
    });
  } catch (err) {
    console.error('[/api/superadmin/support] GET error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to list support tickets' },
      { status: 500 }
    );
  }
}

export async function PATCH(request) {
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

    const body = await request.json();
    const { ticketId, status, assignedTo, assignedToName, reason } = body;

    if (!ticketId) {
      return NextResponse.json({ error: 'ticketId is required' }, { status: 400 });
    }

    let result = null;
    if (status) {
      result = await updateTicketStatus(ticketId, {
        newStatus: status,
        adminId: caller.uid || caller.email,
        reason: reason || 'Super Admin updated status',
      });
    }

    if (assignedTo) {
      result = await assignTicket(ticketId, {
        assignedTo,
        assignedToName,
        adminId: caller.uid || caller.email,
      });
    }

    return NextResponse.json({
      success: true,
      ticket: result,
    });
  } catch (err) {
    console.error('[/api/superadmin/support] PATCH error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to update ticket' },
      { status: 500 }
    );
  }
}

