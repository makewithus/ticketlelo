import { adminDb } from '../firebase-admin.js';
import { generateSupportTicketId } from './ticket-id-generator.js';
import { validateTicketPayload, validateMessagePayload } from './support-validator.js';
import {
  SUPPORT_STATUSES,
  SUPPORT_PRIORITIES,
  SUPPORT_ROLES,
  ALLOWED_STATUS_TRANSITIONS,
} from './types.js';
import { enqueueEmail } from '../email/queue.js';
import { EmailPriority } from '../email/types.js';
import {
  renderSuperAdminNewTicketEmail,
  renderOrganizerConfirmationEmail,
  renderOrganizerReplyEmail,
  renderStatusChangeEmail,
} from '../email/templates/support-ticket.js';
import { getAppBaseUrl } from '../app-url.js';

const TICKETS_COLLECTION = 'supportTickets';
const MESSAGES_SUBCOLLECTION = 'messages';

const _inMemoryTickets = new Map();
const _inMemoryMessages = new Map();

/**
 * Resolves configured recipient email for Super Admin support alerts.
 * Checks Firestore site settings, then environment variable, with platform fallback.
 */
export async function getSuperAdminSupportEmail() {
  if (process.env.SUPER_ADMIN_SUPPORT_EMAIL) {
    return process.env.SUPER_ADMIN_SUPPORT_EMAIL.trim().toLowerCase();
  }
  if (process.env.SUPER_ADMIN_EMAIL) {
    return process.env.SUPER_ADMIN_EMAIL.trim().toLowerCase();
  }

  if (adminDb) {
    try {
      const siteDoc = await adminDb.collection('siteSettings').doc('general').get();
      if (siteDoc.exists && siteDoc.data()?.supportNotificationEmail) {
        return siteDoc.data().supportNotificationEmail.trim().toLowerCase();
      }
    } catch (_err) {
      // ignore db error, fall back to default
    }
  }

  return 'adil4ticketlelo@gmail.com';
}

/**
 * Creates a new support ticket and initiates durable email notifications.
 */
export async function createSupportTicket({
  organizerId,
  fullName,
  email,
  phone,
  category,
  subject,
  description,
  priority = SUPPORT_PRIORITIES.MEDIUM,
  relatedEntity = null,
  attachments = [],
}) {
  const validated = validateTicketPayload({
    fullName,
    email,
    phone,
    category,
    subject,
    description,
    priority,
    relatedEntity,
    attachments,
  });

  const ticketId = await generateSupportTicketId();
  const now = new Date().toISOString();

  const ticketDoc = {
    ticketId,
    organizerId: String(organizerId),
    organizerName: validated.fullName,
    email: validated.email,
    phone: validated.phone,
    category: validated.category,
    subject: validated.subject,
    description: validated.description,
    priority: validated.priority,
    status: SUPPORT_STATUSES.OPEN,
    relatedEntity: validated.relatedEntity || null,
    attachments: validated.attachments || [],
    assignedTo: null,
    assignedToName: null,
    messageCount: 1,
    lastMessageAt: now,
    lastMessageBy: 'organizer',
    statusHistory: [
      {
        status: SUPPORT_STATUSES.OPEN,
        changedAt: now,
        reason: 'Ticket submitted by organizer',
      },
    ],
    createdAt: now,
    updatedAt: now,
  };

  const initialMessage = {
    messageId: `msg_${Date.now()}_init`,
    ticketId,
    senderId: String(organizerId),
    senderName: validated.fullName,
    senderRole: SUPPORT_ROLES.ORGANIZER,
    content: validated.description,
    isInternalNote: false,
    attachments: validated.attachments || [],
    createdAt: now,
  };

  if (typeof adminDb?.collection === 'function') {
    const ticketRef = adminDb.collection(TICKETS_COLLECTION).doc(ticketId);
    await ticketRef.set(ticketDoc);
    await ticketRef.collection(MESSAGES_SUBCOLLECTION).doc(initialMessage.messageId).set(initialMessage);
  } else {
    _inMemoryTickets.set(ticketId, { ...ticketDoc });
    _inMemoryMessages.set(ticketId, [{ ...initialMessage }]);
  }

  // Durable Email Notification Dispatch (Resend Outbox)
  try {
    const baseUrl = getAppBaseUrl();
    const adminUrl = `${baseUrl}/superadmin/support?ticketId=${ticketId}`;
    const organizerTicketUrl = `${baseUrl}/admin/support?ticketId=${ticketId}`;

    const adminRecipient = await getSuperAdminSupportEmail();

    // 1. Alert Super Admin (P1 High Priority)
    const adminEmailPayload = renderSuperAdminNewTicketEmail({
      ticket: ticketDoc,
      adminUrl,
    });

    await enqueueEmail({
      to: adminRecipient,
      subject: adminEmailPayload.subject,
      html: adminEmailPayload.html,
      text: adminEmailPayload.text,
      priority: EmailPriority.P1,
      emailType: 'support_admin_alert',
      idempotencyKey: `email_admin_support_${ticketId}`,
      ticketId,
    }).catch((e) => console.warn('[SupportService] Super Admin email queue warning:', e.message));

    // 2. Send Organizer Confirmation Email (P2 Priority)
    const organizerEmailPayload = renderOrganizerConfirmationEmail({
      ticket: ticketDoc,
      ticketUrl: organizerTicketUrl,
      slaHours: 24,
    });

    await enqueueEmail({
      to: validated.email,
      subject: organizerEmailPayload.subject,
      html: organizerEmailPayload.html,
      text: organizerEmailPayload.text,
      priority: EmailPriority.P2,
      emailType: 'support_organizer_confirmation',
      idempotencyKey: `email_org_support_${ticketId}`,
      ticketId,
    }).catch((e) => console.warn('[SupportService] Organizer confirmation email queue warning:', e.message));
  } catch (emailErr) {
    console.error('[SupportService] Notification dispatch error:', emailErr.message);
  }

  return {
    ...ticketDoc,
    messages: [initialMessage],
  };
}

/**
 * Retrieves ticket details and conversation thread with strict role-based privacy enforcement.
 */
export async function getTicketById(ticketId, { callerRole = SUPPORT_ROLES.ORGANIZER, callerId = null } = {}) {
  if (!ticketId) throw new Error('[SupportService] ticketId is required');

  const isSuperAdmin = callerRole === SUPPORT_ROLES.SUPERADMIN || callerRole === 'superAdmin' || callerRole === 'admin';

  if (typeof adminDb?.collection !== 'function') {
    const ticket = _inMemoryTickets.get(ticketId);
    if (!ticket) return null;

    if (!isSuperAdmin && callerId && ticket.organizerId !== String(callerId)) {
      const error = new Error('Access denied: You do not have permission to view this ticket');
      error.statusCode = 403;
      throw error;
    }

    let messages = [...(_inMemoryMessages.get(ticketId) || [])];
    if (!isSuperAdmin) {
      messages = messages.filter((m) => !m.isInternalNote);
    }

    return {
      ...ticket,
      messages,
    };
  }

  const docRef = adminDb.collection(TICKETS_COLLECTION).doc(ticketId);
  const snap = await docRef.get();
  if (!snap.exists) return null;

  const ticket = snap.data();

  // Organizer ownership enforcement
  if (!isSuperAdmin && callerId && ticket.organizerId !== String(callerId)) {
    const error = new Error('Access denied: You do not have permission to view this ticket');
    error.statusCode = 403;
    throw error;
  }

  // Fetch conversation messages
  const messagesSnap = await docRef.collection(MESSAGES_SUBCOLLECTION).orderBy('createdAt', 'asc').get();
  let messages = messagesSnap.docs.map((d) => d.data());

  // CRITICAL SECURITY ENFORCEMENT:
  // If caller is NOT a Super Admin or Support Agent, strip all private internal notes!
  if (!isSuperAdmin) {
    messages = messages.filter((m) => !m.isInternalNote);
  }

  return {
    ...ticket,
    messages,
  };
}

/**
 * Appends a message (public reply or private internal note) to a ticket thread.
 */
export async function addMessageToTicket(
  ticketId,
  {
    senderId,
    senderName,
    senderRole = SUPPORT_ROLES.ORGANIZER,
    content,
    isInternalNote = false,
    attachments = [],
  }
) {
  const validated = validateMessagePayload({
    content,
    isInternalNote,
    attachments,
  });

  let ticket;
  let ticketRef = null;
  if (typeof adminDb?.collection === 'function') {
    ticketRef = adminDb.collection(TICKETS_COLLECTION).doc(ticketId);
    const ticketSnap = await ticketRef.get();
    if (!ticketSnap.exists) throw new Error(`[SupportService] Ticket ${ticketId} not found`);
    ticket = ticketSnap.data();
  } else {
    ticket = _inMemoryTickets.get(ticketId);
    if (!ticket) throw new Error(`[SupportService] Ticket ${ticketId} not found`);
  }

  const isSuperAdmin = senderRole === SUPPORT_ROLES.SUPERADMIN || senderRole === 'superAdmin' || senderRole === 'admin';

  // Only superadmin can create private internal notes
  const effectiveIsInternalNote = isSuperAdmin ? Boolean(validated.isInternalNote) : false;

  const now = new Date().toISOString();
  const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  const messageDoc = {
    messageId,
    ticketId,
    senderId: String(senderId),
    senderName: senderName || (isSuperAdmin ? 'TicketLelo Support' : ticket.organizerName),
    senderRole: isSuperAdmin ? SUPPORT_ROLES.SUPERADMIN : SUPPORT_ROLES.ORGANIZER,
    content: validated.content,
    isInternalNote: effectiveIsInternalNote,
    attachments: validated.attachments || [],
    createdAt: now,
  };

  if (ticketRef) {
    await ticketRef.collection(MESSAGES_SUBCOLLECTION).doc(messageId).set(messageDoc);
  } else {
    const list = _inMemoryMessages.get(ticketId) || [];
    list.push(messageDoc);
    _inMemoryMessages.set(ticketId, list);
  }

  // Status updates & email notifications
  let statusUpdate = {};
  if (isSuperAdmin) {
    if (!effectiveIsInternalNote) {
      // Admin sent a public reply: organizer needs to be notified
      statusUpdate = {
        status: SUPPORT_STATUSES.WAITING_FOR_ORGANIZER,
        updatedAt: now,
        lastMessageAt: now,
        lastMessageBy: 'admin',
      };

      try {
        const baseUrl = getAppBaseUrl();
        const organizerTicketUrl = `${baseUrl}/admin/support?ticketId=${ticketId}`;
        const replyPayload = renderOrganizerReplyEmail({
          ticket,
          reply: messageDoc,
          ticketUrl: organizerTicketUrl,
        });

        await enqueueEmail({
          to: ticket.email,
          subject: replyPayload.subject,
          html: replyPayload.html,
          text: replyPayload.text,
          priority: EmailPriority.P1,
          emailType: 'support_admin_reply',
          idempotencyKey: `email_reply_${messageId}`,
          ticketId,
        }).catch((e) => console.warn('[SupportService] Admin reply email warning:', e.message));
      } catch (err) {
        console.warn('[SupportService] Failed dispatching organizer reply notification:', err.message);
      }
    } else {
      // Internal note: do not notify organizer, only update timestamp
      statusUpdate = {
        updatedAt: now,
        lastMessageAt: now,
      };
    }
  } else {
    // Organizer sent a reply: reopen or set to IN_PROGRESS
    statusUpdate = {
      status: SUPPORT_STATUSES.IN_PROGRESS,
      updatedAt: now,
      lastMessageAt: now,
      lastMessageBy: 'organizer',
    };
  }

  if (ticketRef) {
    await ticketRef.update({
      ...statusUpdate,
      messageCount: (ticket.messageCount || 1) + 1,
    });
  } else {
    const updatedTicket = {
      ...ticket,
      ...statusUpdate,
      messageCount: (ticket.messageCount || 1) + 1,
    };
    _inMemoryTickets.set(ticketId, updatedTicket);
  }

  return messageDoc;
}

/**
 * Transitions ticket status with audit trail and optional notification.
 */
export async function updateTicketStatus(ticketId, { newStatus, adminId = 'superadmin', reason = 'Status updated' }) {
  if (!SUPPORT_STATUSES[newStatus]) {
    throw new Error(`[SupportService] Invalid status: ${newStatus}`);
  }

  let ticket;
  let ticketRef = null;
  if (typeof adminDb?.collection === 'function') {
    ticketRef = adminDb.collection(TICKETS_COLLECTION).doc(ticketId);
    const snap = await ticketRef.get();
    if (!snap.exists) throw new Error(`[SupportService] Ticket ${ticketId} not found`);
    ticket = snap.data();
  } else {
    ticket = _inMemoryTickets.get(ticketId);
    if (!ticket) throw new Error(`[SupportService] Ticket ${ticketId} not found`);
  }

  const oldStatus = ticket.status;
  const now = new Date().toISOString();
  const statusHistory = [
    ...(ticket.statusHistory || []),
    { status: newStatus, changedAt: now, changedBy: adminId, reason },
  ];

  if (ticketRef) {
    await ticketRef.update({
      status: newStatus,
      statusHistory,
      updatedAt: now,
    });
  } else {
    _inMemoryTickets.set(ticketId, {
      ...ticket,
      status: newStatus,
      statusHistory,
      updatedAt: now,
    });
  }

  // Notify organizer if ticket marked RESOLVED or CLOSED
  if (['RESOLVED', 'CLOSED'].includes(newStatus) && oldStatus !== newStatus) {
    try {
      const baseUrl = getAppBaseUrl();
      const organizerTicketUrl = `${baseUrl}/admin/support?ticketId=${ticketId}`;
      const payload = renderStatusChangeEmail({
        ticket,
        newStatus,
        ticketUrl: organizerTicketUrl,
      });

      await enqueueEmail({
        to: ticket.email,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
        priority: EmailPriority.P2,
        emailType: 'support_status_change',
        idempotencyKey: `email_status_${ticketId}_${newStatus}`,
        ticketId,
      }).catch((e) => console.warn('[SupportService] Status change email warning:', e.message));
    } catch (_e) {
      // ignore
    }
  }

  return { ...ticket, status: newStatus, updatedAt: now };
}

/**
 * Assigns a ticket to a support staff member
 */
export async function assignTicket(ticketId, { assignedTo, assignedToName, adminId = 'superadmin' }) {
  if (typeof adminDb?.collection === 'function') {
    const ticketRef = adminDb.collection(TICKETS_COLLECTION).doc(ticketId);
    const now = new Date().toISOString();

    await ticketRef.update({
      assignedTo,
      assignedToName: assignedToName || assignedTo,
      updatedAt: now,
    });
  } else {
    const ticket = _inMemoryTickets.get(ticketId);
    if (ticket) {
      _inMemoryTickets.set(ticketId, {
        ...ticket,
        assignedTo,
        assignedToName: assignedToName || assignedTo,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  return { ticketId, assignedTo, assignedToName };
}

/**
 * Lists tickets for an organizer with status filtering and pagination
 */
export async function listTicketsForOrganizer(organizerId, { status = 'ALL', limitParam = 50 } = {}) {
  if (!organizerId) return [];

  if (typeof adminDb?.collection !== 'function') {
    let list = Array.from(_inMemoryTickets.values()).filter(t => t.organizerId === String(organizerId));
    if (status && status !== 'ALL') {
      list = list.filter(t => t.status === status);
    }
    return list;
  }

  let query = adminDb
    .collection(TICKETS_COLLECTION)
    .where('organizerId', '==', String(organizerId));

  if (status && status !== 'ALL') {
    query = query.where('status', '==', status);
  }

  query = query.orderBy('createdAt', 'desc').limit(limitParam);

  try {
    const snap = await query.get();
    return snap.docs.map((doc) => doc.data());
  } catch (_idxErr) {
    // Fallback if compound index is pending
    const snap = await adminDb
      .collection(TICKETS_COLLECTION)
      .where('organizerId', '==', String(organizerId))
      .limit(limitParam)
      .get();
    return snap.docs.map((doc) => doc.data());
  }
}

/**
 * Lists tickets for Super Admin with multi-field search and filters
 */
export async function listTicketsForSuperAdmin({
  status = 'ALL',
  category = 'ALL',
  priority = 'ALL',
  searchTerm = '',
  limitParam = 100,
} = {}) {
  if (typeof adminDb?.collection !== 'function') {
    let list = Array.from(_inMemoryTickets.values());
    if (status && status !== 'ALL') list = list.filter(t => t.status === status);
    if (category && category !== 'ALL') list = list.filter(t => t.category === category);
    if (priority && priority !== 'ALL') list = list.filter(t => t.priority === priority);
    if (searchTerm && searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(t =>
        (t.ticketId || '').toLowerCase().includes(q) ||
        (t.subject || '').toLowerCase().includes(q) ||
        (t.organizerName || '').toLowerCase().includes(q) ||
        (t.email || '').toLowerCase().includes(q) ||
        (t.phone || '').toLowerCase().includes(q) ||
        (t.relatedEntity?.orderId || '').toLowerCase().includes(q) ||
        (t.relatedEntity?.id || '').toLowerCase().includes(q) ||
        (t.relatedEntity?.settlementId || '').toLowerCase().includes(q)
      );
    }
    return list;
  }

  let query = adminDb.collection(TICKETS_COLLECTION);

  if (status && status !== 'ALL') {
    query = query.where('status', '==', status);
  }
  if (category && category !== 'ALL') {
    query = query.where('category', '==', category);
  }
  if (priority && priority !== 'ALL') {
    query = query.where('priority', '==', priority);
  }

  query = query.orderBy('createdAt', 'desc').limit(limitParam);

  let tickets = [];
  try {
    const snap = await query.get();
    tickets = snap.docs.map((doc) => doc.data());
  } catch (_err) {
    const snap = await adminDb.collection(TICKETS_COLLECTION).limit(limitParam).get();
    tickets = snap.docs.map((doc) => doc.data());
  }

  if (searchTerm && searchTerm.trim()) {
    const term = searchTerm.toLowerCase().trim();
    tickets = tickets.filter(
      (t) =>
        t.ticketId?.toLowerCase().includes(term) ||
        t.organizerName?.toLowerCase().includes(term) ||
        t.email?.toLowerCase().includes(term) ||
        t.phone?.toLowerCase().includes(term) ||
        t.subject?.toLowerCase().includes(term)
    );
  }

  return tickets;
}
