import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-server';
import {
  createSupportTicket,
  listTicketsForOrganizer,
  listTicketsForSuperAdmin,
} from '@/lib/support/support-service.js';

export async function GET(request) {
  try {
    const caller = await getAuthenticatedUser(request);
    if (!caller) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'ALL';
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

    if (isSuperAdmin && searchParams.get('all') === 'true') {
      const tickets = await listTicketsForSuperAdmin({
        status,
        category: searchParams.get('category') || 'ALL',
        priority: searchParams.get('priority') || 'ALL',
        searchTerm: searchParams.get('search') || '',
        limitParam,
      });
      return NextResponse.json({ success: true, tickets });
    }

    const organizerId = caller.organizationId || caller.uid;
    const tickets = await listTicketsForOrganizer(organizerId, { status, limitParam });

    return NextResponse.json({ success: true, tickets });
  } catch (err) {
    console.error('[/api/support/tickets] GET error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to list support tickets' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const caller = await getAuthenticatedUser(request);
    if (!caller) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const organizerId = caller.organizationId || caller.uid;

    const ticket = await createSupportTicket({
      organizerId,
      fullName: body.fullName || caller.name || caller.displayName || 'Organizer',
      email: body.email || caller.email,
      phone: body.phone || caller.phone || '+91 99999 99999',
      category: body.category,
      subject: body.subject,
      description: body.description,
      priority: body.priority,
      relatedEntity: body.relatedEntity,
      attachments: body.attachments,
    });

    return NextResponse.json({
      success: true,
      message: 'Support ticket submitted successfully',
      ticket,
    });
  } catch (err) {
    console.error('[/api/support/tickets] POST error:', err);
    const statusCode = err.name === 'ZodError' ? 400 : 500;
    return NextResponse.json(
      {
        error: err.errors ? err.errors.map((e) => e.message).join(', ') : err.message,
      },
      { status: statusCode }
    );
  }
}

