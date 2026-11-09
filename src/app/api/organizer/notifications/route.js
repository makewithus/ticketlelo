import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-server';
import { getOrganizerNotifications, markOrganizerNotificationRead } from '@/lib/notifications/notification-service';

/**
 * GET /api/organizer/notifications
 * Lists in-app notifications for the logged in organizer.
 */
export async function GET(request) {
  try {
    const caller = await getAuthenticatedUser(request);
    if (!caller) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requestedOrgId = searchParams.get('organizerId');

    const emailLower = (caller.email || '').toLowerCase().trim();
    const isSuperAdmin =
      caller.role === 'superAdmin' ||
      caller.role === 'superadmin' ||
      caller.role === 'admin' ||
      caller.isAdmin === true ||
      emailLower === 'adil4ticketlelo@gmail.com' ||
      emailLower === 'superadmin@ticketlelo.com' ||
      emailLower === (process.env.SUPER_ADMIN_EMAIL || '').toLowerCase().trim();

    const targetOrgId = isSuperAdmin && requestedOrgId
      ? requestedOrgId
      : (caller.organizationId || caller.uid);

    if (!targetOrgId) {
      return NextResponse.json({ error: 'Organizer ID not resolved' }, { status: 400 });
    }

    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') || 20)));

    const notifications = await getOrganizerNotifications(targetOrgId, { limit, unreadOnly });

    return NextResponse.json({
      success: true,
      notifications,
      unreadCount: notifications.filter((n) => !n.read).length,
    });
  } catch (error) {
    console.error('[/api/organizer/notifications] GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch organizer notifications' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/organizer/notifications
 * Marks an organizer notification as read.
 */
export async function PATCH(request) {
  try {
    const caller = await getAuthenticatedUser(request);
    if (!caller) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { notificationId } = body;

    if (!notificationId) {
      return NextResponse.json({ error: 'notificationId is required' }, { status: 400 });
    }

    await markOrganizerNotificationRead(notificationId);
    return NextResponse.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    console.error('[/api/organizer/notifications] PATCH error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update notification' },
      { status: 500 }
    );
  }
}

