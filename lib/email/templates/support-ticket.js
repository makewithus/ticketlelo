/**
 * TicketLelo Support Notification Email Templates
 *
 * Professional HTML & plain-text responsive templates with TicketLelo dark & orange (#FE760B) branding.
 */

function formatInr(paise) {
  if (!paise || isNaN(paise)) return "₹0.00";
  return `₹${(Number(paise) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * 1. Super Admin New Ticket Alert Email Template
 */
export function renderSuperAdminNewTicketEmail({ ticket, adminUrl }) {
  const subject = `[TicketLelo Support] New Ticket #${ticket.ticketId} – ${ticket.category}`;
  const submittedAt = new Date(ticket.createdAt || Date.now()).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "full",
    timeStyle: "short",
  });

  const relatedHtml = ticket.relatedEntity
    ? `
      <div style="margin: 16px 0; padding: 12px 16px; background-color: #212327; border-left: 3px solid #FE760B; border-radius: 8px;">
        <p style="margin: 0; font-size: 13px; color: #D0D0D1;">
          <strong style="color: #FE760B;">Linked Financial Record:</strong> ${ticket.relatedEntity.type.toUpperCase()} <code>${ticket.relatedEntity.id}</code>
          ${ticket.relatedEntity.amountPaise ? `<br />Amount: <strong>${formatInr(ticket.relatedEntity.amountPaise)}</strong>` : ""}
          ${ticket.relatedEntity.status ? `<br />Status: <strong>${ticket.relatedEntity.status}</strong>` : ""}
        </p>
      </div>
    `
    : "";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 24px; background-color: #0E1012; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #F3F4F6;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #17191C; border: 1px solid #2A2D31; border-radius: 16px; overflow: hidden;">
    <!-- Header -->
    <tr>
      <td style="padding: 24px 32px; background-color: #1A1C1F; border-bottom: 1px solid #2A2D31;">
        <table width="100%">
          <tr>
            <td>
              <span style="font-size: 20px; font-weight: 800; color: #FFFFFF; letter-spacing: -0.5px;">Ticket<span style="color: #FE760B;">Lelo</span></span>
              <span style="display: block; font-size: 11px; color: #9E9E9F; margin-top: 2px;">Super Admin Support Desk</span>
            </td>
            <td align="right">
              <span style="display: inline-block; padding: 4px 10px; font-size: 11px; font-weight: 700; color: #FE760B; background-color: rgba(254, 118, 11, 0.12); border: 1px solid rgba(254, 118, 11, 0.3); border-radius: 20px;">
                ${ticket.priority || "NORMAL"} PRIORITY
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Body -->
    <tr>
      <td style="padding: 32px;">
        <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 700; color: #FFFFFF;">
          New Support Ticket #${ticket.ticketId}
        </h2>

        <table width="100%" style="font-size: 13px; color: #D0D0D1; margin-bottom: 24px; border-collapse: collapse;">
          <tr style="border-bottom: 1px solid #2A2D31;">
            <td style="padding: 8px 0; color: #9E9E9F; width: 130px;">Organizer:</td>
            <td style="padding: 8px 0; font-weight: 600; color: #FFFFFF;">${ticket.organizerName}</td>
          </tr>
          <tr style="border-bottom: 1px solid #2A2D31;">
            <td style="padding: 8px 0; color: #9E9E9F;">Email:</td>
            <td style="padding: 8px 0;"><a href="mailto:${ticket.email}" style="color: #FE760B; text-decoration: none;">${ticket.email}</a></td>
          </tr>
          <tr style="border-bottom: 1px solid #2A2D31;">
            <td style="padding: 8px 0; color: #9E9E9F;">Phone:</td>
            <td style="padding: 8px 0; color: #FFFFFF;">${ticket.phone}</td>
          </tr>
          <tr style="border-bottom: 1px solid #2A2D31;">
            <td style="padding: 8px 0; color: #9E9E9F;">Category:</td>
            <td style="padding: 8px 0; font-weight: 600; color: #FFFFFF;">${ticket.category}</td>
          </tr>
          <tr style="border-bottom: 1px solid #2A2D31;">
            <td style="padding: 8px 0; color: #9E9E9F;">Submitted At:</td>
            <td style="padding: 8px 0; color: #9E9E9F;">${submittedAt}</td>
          </tr>
        </table>

        ${relatedHtml}

        <div style="margin: 20px 0; padding: 16px; background-color: #1A1C1F; border: 1px solid #2A2D31; border-radius: 12px;">
          <h4 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 700; color: #FFFFFF;">Subject: ${ticket.subject}</h4>
          <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #D0D0D1; white-space: pre-wrap;">${ticket.description}</p>
        </div>

        <!-- Call to Action -->
        <table width="100%" style="margin-top: 32px;">
          <tr>
            <td align="center">
              <a href="${adminUrl}" style="display: inline-block; padding: 14px 28px; background-color: #FE760B; color: #131517; font-size: 13px; font-weight: 800; text-decoration: none; border-radius: 12px; box-shadow: 0 4px 12px rgba(254, 118, 11, 0.3);">
                Open Ticket in Super Admin Suite &rarr;
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="padding: 20px 32px; background-color: #141618; border-top: 1px solid #2A2D31; font-size: 11px; color: #6E7178; text-align: center;">
        TicketLelo Automated Support Notification System &bull; Confidential
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const text = `
[TicketLelo Support] New Ticket #${ticket.ticketId}

Priority: ${ticket.priority || "NORMAL"}
Organizer: ${ticket.organizerName}
Email: ${ticket.email}
Phone: ${ticket.phone}
Category: ${ticket.category}
Submitted: ${submittedAt}

Subject: ${ticket.subject}
Description:
${ticket.description}

${ticket.relatedEntity ? `Linked Record: ${ticket.relatedEntity.type} ${ticket.relatedEntity.id}` : ""}

View ticket in Super Admin Suite:
${adminUrl}
  `.trim();

  return { subject, html, text };
}

/**
 * 2. Organizer Confirmation Email Template
 */
export function renderOrganizerConfirmationEmail({ ticket, ticketUrl, slaHours = 24 }) {
  const subject = `[TicketLelo Support] Ticket Received #${ticket.ticketId}`;
  const submittedAt = new Date(ticket.createdAt || Date.now()).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 24px; background-color: #0E1012; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #F3F4F6;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #17191C; border: 1px solid #2A2D31; border-radius: 16px; overflow: hidden;">
    <tr>
      <td style="padding: 24px 32px; background-color: #1A1C1F; border-bottom: 1px solid #2A2D31;">
        <span style="font-size: 20px; font-weight: 800; color: #FFFFFF;">Ticket<span style="color: #FE760B;">Lelo</span></span>
      </td>
    </tr>
    <tr>
      <td style="padding: 32px;">
        <h2 style="margin: 0 0 12px 0; font-size: 18px; color: #FFFFFF;">We've received your request!</h2>
        <p style="margin: 0 0 20px 0; font-size: 13px; color: #D0D0D1; line-height: 1.5;">
          Hello ${ticket.organizerName}, thank you for contacting TicketLelo Help & Support. We have logged your ticket and our dedicated operations team is reviewing it.
        </p>

        <div style="margin: 20px 0; padding: 16px; background-color: #212327; border: 1px solid #2A2D31; border-radius: 12px; font-size: 13px;">
          <p style="margin: 0 0 6px 0; color: #9E9E9F;">Ticket ID: <strong style="color: #FE760B;">#${ticket.ticketId}</strong></p>
          <p style="margin: 0 0 6px 0; color: #9E9E9F;">Category: <strong style="color: #FFFFFF;">${ticket.category}</strong></p>
          <p style="margin: 0 0 6px 0; color: #9E9E9F;">Subject: <strong style="color: #FFFFFF;">${ticket.subject}</strong></p>
          <p style="margin: 0; color: #9E9E9F;">Logged At: <span style="color: #D0D0D1;">${submittedAt}</span></p>
        </div>

        <p style="font-size: 13px; color: #9E9E9F; line-height: 1.5;">
          Our typical response window is within <strong>${slaHours} business hours</strong>. You can track updates and post replies at any time:
        </p>

        <table width="100%" style="margin-top: 24px;">
          <tr>
            <td align="center">
              <a href="${ticketUrl}" style="display: inline-block; padding: 12px 24px; background-color: #FE760B; color: #131517; font-size: 13px; font-weight: 700; text-decoration: none; border-radius: 10px;">
                View Your Support Ticket &rarr;
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding: 16px 32px; background-color: #141618; border-top: 1px solid #2A2D31; font-size: 11px; color: #6E7178; text-align: center;">
        TicketLelo Creator Operations &bull; Need immediate assistance? Check your Organizer Dashboard.
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const text = `
Ticket Received #${ticket.ticketId}

Hello ${ticket.organizerName},
Your support ticket has been logged successfully with TicketLelo Help & Support.

Ticket ID: #${ticket.ticketId}
Category: ${ticket.category}
Subject: ${ticket.subject}
Submitted: ${submittedAt}

Expected Response Window: Within ${slaHours} business hours.

You can view your ticket and reply directly here:
${ticketUrl}
  `.trim();

  return { subject, html, text };
}

/**
 * 3. Organizer Reply Alert Email Template
 */
export function renderOrganizerReplyEmail({ ticket, reply, ticketUrl }) {
  const subject = `[TicketLelo Support] Update on Ticket #${ticket.ticketId}: ${ticket.subject}`;

  const html = `
<!DOCTYPE html>
<html>
<body style="margin: 0; padding: 24px; background-color: #0E1012; font-family: -apple-system, BlinkMacSystemFont, sans-serif; color: #F3F4F6;">
  <table width="100%" style="max-width: 600px; margin: 0 auto; background-color: #17191C; border: 1px solid #2A2D31; border-radius: 16px; padding: 24px;">
    <tr>
      <td>
        <h3 style="margin: 0 0 16px 0; color: #FFFFFF;">Update on Ticket #${ticket.ticketId}</h3>
        <p style="font-size: 13px; color: #D0D0D1;">
          Our support team has posted an update regarding your issue:
        </p>
        <div style="margin: 16px 0; padding: 16px; background-color: #212327; border-left: 3px solid #FE760B; border-radius: 8px; font-size: 13px; color: #F3F4F6; white-space: pre-wrap;">
${reply.content}
        </div>
        <p style="font-size: 12px; color: #9E9E9F;">
          Posted by <strong>${reply.senderName || "TicketLelo Support"}</strong>
        </p>
        <div style="margin-top: 24px; text-align: center;">
          <a href="${ticketUrl}" style="display: inline-block; padding: 12px 24px; background-color: #FE760B; color: #131517; font-weight: 700; text-decoration: none; border-radius: 10px; font-size: 13px;">
            Continue Conversation &rarr;
          </a>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const text = `
Update on Ticket #${ticket.ticketId}
Subject: ${ticket.subject}

Reply from ${reply.senderName || "TicketLelo Support"}:
${reply.content}

View and reply here:
${ticketUrl}
  `.trim();

  return { subject, html, text };
}

/**
 * 4. Status Changed Notification Email Template
 */
export function renderStatusChangeEmail({ ticket, newStatus, ticketUrl }) {
  const subject = `[TicketLelo Support] Status Updated: #${ticket.ticketId} is now ${newStatus}`;

  const html = `
<!DOCTYPE html>
<html>
<body style="margin: 0; padding: 24px; background-color: #0E1012; font-family: -apple-system, BlinkMacSystemFont, sans-serif; color: #F3F4F6;">
  <table width="100%" style="max-width: 600px; margin: 0 auto; background-color: #17191C; border: 1px solid #2A2D31; border-radius: 16px; padding: 24px;">
    <tr>
      <td>
        <h3 style="margin: 0 0 12px 0; color: #FFFFFF;">Ticket Status Updated</h3>
        <p style="font-size: 13px; color: #D0D0D1;">
          Hello ${ticket.organizerName || "Organizer"}, your support ticket <strong>#${ticket.ticketId}</strong> (${ticket.subject}) has been updated to:
        </p>
        <div style="display: inline-block; margin: 12px 0; padding: 6px 14px; background-color: rgba(254, 118, 11, 0.15); border: 1px solid #FE760B; border-radius: 20px; font-weight: 700; color: #FE760B; font-size: 13px;">
          ${newStatus}
        </div>
        <p style="font-size: 13px; color: #9E9E9F;">
          ${newStatus === "RESOLVED" ? "If your inquiry is resolved, no further action is needed. Otherwise, feel free to reopen or reply." : "Click below to review the latest details."}
        </p>
        <div style="margin-top: 20px;">
          <a href="${ticketUrl}" style="color: #FE760B; text-decoration: none; font-size: 13px; font-weight: 600;">
            View Ticket #${ticket.ticketId} &rarr;
          </a>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const text = `
Ticket #${ticket.ticketId} status updated to: ${newStatus}
Subject: ${ticket.subject}

View ticket details:
${ticketUrl}
  `.trim();

  return { subject, html, text };
}
