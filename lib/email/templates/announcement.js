/**
 * TicketLelo Email Infrastructure - Announcement Template
 *
 * Exact 100% preservation of TicketLelo's broadcast announcement email:
 * - Gradient brand header ("Event Update")
 * - Content card with #FF6A00 border accent
 * - Plain-text alternative
 * - TicketLelo footer
 */

const escapeHtml = (value = "") =>
  String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));

export function buildAnnouncementEmail(data) {
  const {
    recipientName = "Attendee",
    title = "Event Update",
    content = "",
    eventName = "",
  } = data;

  const safeName = escapeHtml(recipientName);
  const safeTitle = escapeHtml(title);
  const safeContent = escapeHtml(content);

  const textBody = `${title}
========================================

Hello ${recipientName},

${content}

----------------------------------------
This is an important message from the event organizers.
Powered by TicketLelo - Smart Ticketing Platform
https://ticketlelo.in`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${safeTitle}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: Arial, sans-serif;">
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
    <div style="background: linear-gradient(135deg, #FF6A00 0%, #FFD60A 100%); padding: 30px; text-align: center;">
      <h1 style="color: #000; margin: 0; font-size: 28px; font-weight: bold;">${safeTitle}</h1>
    </div>
    <div style="padding: 30px; background: #fff;">
      <p style="font-size: 16px; color: #333; margin-top: 0;">Hello ${safeName},</p>
      <div style="background-color: #f5f5f5; padding: 25px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #FF6A00;">
        <div style="font-size: 15px; line-height: 1.6; color: #333; white-space: pre-wrap;">${safeContent}</div>
      </div>
      <p style="color: #666; font-size: 14px; margin-top: 30px;">
        This is an important message from the event organizers.
      </p>
    </div>
    <div style="background: #f9f9f9; padding: 20px; text-align: center; border-top: 1px solid #ddd;">
      <p style="color: #999; font-size: 12px; margin: 0;">
        Powered by <strong>TicketLelo</strong> - Smart Ticketing Platform
      </p>
    </div>
  </div>
</body>
</html>`;

  return { html, text: textBody };
}
