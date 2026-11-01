/**
 * TicketLelo Email Infrastructure - Event Reminder Template
 *
 * Exact 100% preservation of TicketLelo's 24-hour & 2-hour event reminders:
 * - Gradient brand header (TicketLelo)
 * - Dynamic urgency banner ("Tomorrow" in #FF6A00 or "In 2 Hours" in #e53e3e)
 * - Event detail card with date, time, location
 * - Ticket ID callout card
 * - Scannable ticket reminder & footer
 */

const escapeHtml = (value = "") =>
  String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));

export function buildReminderEmail(data) {
  const {
    recipientName = "Attendee",
    eventName = "Event",
    eventDate = "Tomorrow",
    eventTime = "12:00 PM",
    eventLocation = "TBA",
    ticketId = "",
    reminderLabel = "Tomorrow",
    urgencyColor = "#FF6A00",
  } = data;

  const safeName = escapeHtml(recipientName);
  const safeEvent = escapeHtml(eventName);
  const safeDate = escapeHtml(eventDate);
  const safeTime = escapeHtml(eventTime);
  const safeLoc = escapeHtml(eventLocation);
  const safeTicket = escapeHtml(ticketId ? ticketId.slice(-10).toUpperCase() : "");

  const textBody = `Event Reminder: ${eventName} is ${reminderLabel}!
========================================

Hello ${recipientName},

This is a friendly reminder that you have a ticket for:
${eventName}

Date:     ${eventDate}
Time:     ${eventTime}
Location: ${eventLocation}
${ticketId ? `Ticket ID: ${ticketId}\n` : ""}
Please ensure you have your QR code ticket ready for entry.
Your ticket was sent to you via email when you registered.

Powered by TicketLelo · Smart Ticketing for India
https://ticketlelo.in`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reminder: ${safeEvent} is ${reminderLabel}!</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #FF6A00 0%, #FFD60A 100%); padding: 30px; text-align: center;">
      <h1 style="color: #000; margin: 0; font-size: 28px; font-weight: bold;">TicketLelo</h1>
      <p style="color: #000; margin: 5px 0 0; font-size: 14px; opacity: 0.8;">Smart Ticketing Platform</p>
    </div>
    
    <!-- Urgency Banner -->
    <div style="background-color: ${urgencyColor}; padding: 12px; text-align: center;">
      <p style="color: white; margin: 0; font-size: 16px; font-weight: bold;">
        Reminder: Your event is ${reminderLabel}!
      </p>
    </div>
    
    <!-- Content -->
    <div style="padding: 35px 30px;">
      <p style="font-size: 18px; color: #333; margin-top: 0;">
        Hello <strong>${safeName}</strong>,
      </p>
      <p style="font-size: 15px; color: #555; line-height: 1.6;">
        This is a friendly reminder that you have a ticket for:
      </p>
      
      <!-- Event Card -->
      <div style="background: #f8f9fa; border-radius: 12px; padding: 25px; margin: 25px 0; border-left: 5px solid ${urgencyColor};">
        <h2 style="color: #1a1a1a; margin: 0 0 15px; font-size: 22px;">${safeEvent}</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; vertical-align: top;">
              <span style="color: #888; font-size: 13px;">Date</span>
              <br>
              <strong style="color: #333; font-size: 14px;">${safeDate}</strong>
            </td>
            <td style="padding: 6px 0; vertical-align: top;">
              <span style="color: #888; font-size: 13px;">Time</span>
              <br>
              <strong style="color: #333; font-size: 14px;">${safeTime}</strong>
            </td>
          </tr>
          <tr>
            <td colspan="2" style="padding: 10px 0 0;">
              <span style="color: #888; font-size: 13px;">Location</span>
              <br>
              <strong style="color: #333; font-size: 14px;">${safeLoc}</strong>
            </td>
          </tr>
        </table>
      </div>
      
      ${safeTicket ? `
      <div style="background: #fff3e0; border: 1px solid #ffb74d; border-radius: 8px; padding: 15px; text-align: center;">
        <p style="margin: 0 0 5px; color: #888; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Your Ticket ID</p>
        <p style="margin: 0; font-size: 18px; font-weight: bold; color: #e65100; letter-spacing: 2px; font-family: monospace;">
          ${safeTicket}
        </p>
      </div>
      ` : ""}
      
      <p style="font-size: 14px; color: #555; margin-top: 25px; line-height: 1.6;">
        Please ensure you have your QR code ticket ready for entry. Your ticket was sent to you via email when you registered.
      </p>
    </div>
    
    <!-- Footer -->
    <div style="background: #f9f9f9; padding: 20px 30px; border-top: 1px solid #eee; text-align: center;">
      <p style="color: #999; font-size: 12px; margin: 0;">
        Powered by <strong>TicketLelo</strong> &middot; Smart Ticketing for India
      </p>
      <p style="color: #bbb; font-size: 11px; margin: 5px 0 0;">
        www.ticketlelo.in
      </p>
    </div>
  </div>
</body>
</html>`;

  return { html, text: textBody };
}
