/**
 * Server-side utility for sending transactional emails via Resend with persistent queueing.
 * Refactored to delegate to TicketLelo's centralized email subsystem (`@/lib/email`).
 *
 * Fully backward-compatible with legacy callers (`messages/send`, `cron/process-reminders`, etc.).
 *
 * @param {{
 *   to: string,
 *   subject: string,
 *   html: string,
 *   text?: string,
 *   priority?: string,
 *   emailType?: string,
 *   eventId?: string,
 *   ticketId?: string,
 *   bookingId?: string,
 *   attachments?: Array
 * }} options
 * @returns {Promise<{ success: boolean, jobId?: string }>}
 */
import { enqueueEmail } from "./email/queue.js";
import { EmailPriority, EmailType } from "./email/types.js";

export const sendEmail = async ({
  to,
  subject,
  html,
  text,
  priority = EmailPriority.P2,
  emailType = EmailType.TRANSACTIONAL,
  eventId,
  ticketId,
  bookingId,
  attachments,
}) => {
  if (!to) return { success: false, reason: "missing_recipient" };

  return await enqueueEmail({
    to,
    subject,
    html,
    text,
    priority,
    emailType,
    eventId,
    ticketId,
    bookingId,
    attachments,
  });
};
