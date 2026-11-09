import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-server';
import { getAdminNotifications, markAdminNotificationRead } from '@/lib/notifications/notification-service';

/**
 * GET /api/superadmin/notifications
 * Lists admin notifications (payouts due, overdue, profile updates, holds, failures).
 */
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
      return NextResponse.json({ error: 'Super Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 30)));

    const notifications = await getAdminNotifications({ limit, unreadOnly });

    return NextResponse.json({
      success: true,
      notifications,
      unreadCount: notifications.filter((n) => !n.read).length,
    });
  } catch (error) {
    console.error('[/api/superadmin/notifications] GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch admin notifications' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/superadmin/notifications
 * Marks a notification as read.
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

    await markAdminNotificationRead(notificationId);
    return NextResponse.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    console.error('[/api/superadmin/notifications] PATCH error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update notification' },
      { status: 500 }
    );
  }
}

