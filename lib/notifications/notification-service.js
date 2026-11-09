import { adminDb } from '../firebase-admin.js';

const ADMIN_NOTIFICATIONS_COLLECTION = 'admin_notifications';
const ORGANIZER_NOTIFICATIONS_COLLECTION = 'organizer_notifications';

// In-memory fallback for unit testing without live Firebase
const _inMemoryAdminNotifs = [];
const _inMemoryOrgNotifs = [];

/**
 * Creates an admin notification in the system.
 */
export async function createAdminNotification({
  type, // 'PAYOUT_DUE' | 'PAYOUT_OVERDUE' | 'PAYOUT_DETAILS_UPDATED' | 'PAYOUT_ON_HOLD' | 'PAYOUT_FAILED'
  title,
  message,
  payoutId = null,
  organizerId = null,
  organizerName = null,
  eventId = null,
  eventTitle = null,
  amount = null,
  dueDate = null,
  metadata = {},
}) {
  const now = new Date().toISOString();
  const notifId = `admin_notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const notifDoc = {
    id: notifId,
    type,
    title,
    message,
    payoutId,
    organizerId: organizerId ? String(organizerId) : null,
    organizerName: organizerName || null,
    eventId: eventId ? String(eventId) : null,
    eventTitle: eventTitle || null,
    amount: amount != null ? Number(amount) : null,
    dueDate: dueDate || null,
    read: false,
    readAt: null,
    metadata,
    createdAt: now,
  };

  if (typeof adminDb?.collection === 'function') {
    // Avoid creating duplicate unread notifications for the same payout & type
    if (payoutId && type) {
      try {
        const existing = await adminDb
          .collection(ADMIN_NOTIFICATIONS_COLLECTION)
          .where('payoutId', '==', payoutId)
          .where('type', '==', type)
          .where('read', '==', false)
          .limit(1)
          .get();

        if (!existing.empty) {
          return { id: existing.docs[0].id, ...existing.docs[0].data() };
        }
      } catch (_e) {
        // Fallback to inserting
      }
    }

    await adminDb.collection(ADMIN_NOTIFICATIONS_COLLECTION).doc(notifId).set(notifDoc);
  } else {
    const existing = _inMemoryAdminNotifs.find(
      (n) => n.payoutId === payoutId && n.type === type && !n.read
    );
    if (existing) return existing;
    _inMemoryAdminNotifs.unshift(notifDoc);
  }

  return notifDoc;
}

/**
 * Fetches admin notifications.
 */
export async function getAdminNotifications({ limit = 30, unreadOnly = false } = {}) {
  if (typeof adminDb?.collection !== 'function') {
    let list = [..._inMemoryAdminNotifs];
    if (unreadOnly) list = list.filter((n) => !n.read);
    return list.slice(0, limit);
  }

  try {
    let query = adminDb.collection(ADMIN_NOTIFICATIONS_COLLECTION);
    if (unreadOnly) {
      query = query.where('read', '==', false);
    }
    query = query.orderBy('createdAt', 'desc').limit(limit);
    const snap = await query.get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (_err) {
    // Fallback if index pending
    const snap = await adminDb.collection(ADMIN_NOTIFICATIONS_COLLECTION).limit(limit).get();
    let docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (unreadOnly) docs = docs.filter((n) => !n.read);
    return docs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
}

/**
 * Marks an admin notification as read.
 */
export async function markAdminNotificationRead(notificationId) {
  if (!notificationId) return;
  const now = new Date().toISOString();

  if (typeof adminDb?.collection === 'function') {
    await adminDb
      .collection(ADMIN_NOTIFICATIONS_COLLECTION)
      .doc(notificationId)
      .update({ read: true, readAt: now });
  } else {
    const item = _inMemoryAdminNotifs.find((n) => n.id === notificationId);
    if (item) {
      item.read = true;
      item.readAt = now;
    }
  }
}

/**
 * Creates an in-app notification for an organizer.
 */
export async function createOrganizerNotification({
  organizerId,
  title,
  message,
  type = 'PAYOUT_PAID',
  payoutId = null,
  utr = null,
  amount = null,
  eventTitle = null,
  metadata = {},
}) {
  if (!organizerId) return null;
  const now = new Date().toISOString();
  const notifId = `org_notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const notifDoc = {
    id: notifId,
    organizerId: String(organizerId),
    type,
    title,
    message,
    payoutId,
    utr,
    amount: amount != null ? Number(amount) : null,
    eventTitle: eventTitle || null,
    read: false,
    readAt: null,
    metadata,
    createdAt: now,
  };

  if (typeof adminDb?.collection === 'function') {
    await adminDb.collection(ORGANIZER_NOTIFICATIONS_COLLECTION).doc(notifId).set(notifDoc);
  } else {
    _inMemoryOrgNotifs.unshift(notifDoc);
  }

  return notifDoc;
}

/**
 * Fetches in-app notifications for an organizer.
 */
export async function getOrganizerNotifications(organizerId, { limit = 20, unreadOnly = false } = {}) {
  if (!organizerId) return [];

  if (typeof adminDb?.collection !== 'function') {
    let list = _inMemoryOrgNotifs.filter((n) => n.organizerId === String(organizerId));
    if (unreadOnly) list = list.filter((n) => !n.read);
    return list.slice(0, limit);
  }

  try {
    let query = adminDb
      .collection(ORGANIZER_NOTIFICATIONS_COLLECTION)
      .where('organizerId', '==', String(organizerId));
    if (unreadOnly) {
      query = query.where('read', '==', false);
    }
    query = query.orderBy('createdAt', 'desc').limit(limit);
    const snap = await query.get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (_err) {
    const snap = await adminDb
      .collection(ORGANIZER_NOTIFICATIONS_COLLECTION)
      .where('organizerId', '==', String(organizerId))
      .limit(limit)
      .get();
    let docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (unreadOnly) docs = docs.filter((n) => !n.read);
    return docs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
}

/**
 * Marks an organizer notification as read.
 */
export async function markOrganizerNotificationRead(notificationId) {
  if (!notificationId) return;
  const now = new Date().toISOString();

  if (typeof adminDb?.collection === 'function') {
    await adminDb
      .collection(ORGANIZER_NOTIFICATIONS_COLLECTION)
      .doc(notificationId)
      .update({ read: true, readAt: now });
  } else {
    const item = _inMemoryOrgNotifs.find((n) => n.id === notificationId);
    if (item) {
      item.read = true;
      item.readAt = now;
    }
  }
}

