/**
 * TicketLelo Email Infrastructure - Hosting Confirmation Template
 *
 * Exact 100% preservation of TicketLelo's hosting request received email:
 * - Dark top header with logo and "HOSTING REQUEST"
 * - Yellow status pill "Hosting request received"
 * - Details table with Event, College/Organisation, Expected Tickets, Contact Email
 * - "What happens next?" section
 * - Dark footer
 */

const escapeHtml = (value = "") =>
  String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));

export function buildHostingConfirmEmail(data) {
  const {
    name = "Organiser",
    eventTitle = "Event",
    college = "Institution",
    parsedTickets = "100",
    email = "",
    hasLogo = true,
  } = data;

  const firstName = (name || "Organiser").trim().split(" ")[0];
  const safeName = escapeHtml(name);
  const safeFirstName = escapeHtml(firstName);
  const safeEvent = escapeHtml(eventTitle);
  const safeCollege = escapeHtml(college);
  const safeTickets = escapeHtml(parsedTickets);
  const safeEmail = escapeHtml(email);

  const logoUrl = "https://www.ticketlelo.in/logo/Ticketlelo-hero.png";
  const logoHtml = `<a href="https://ticketlelo.in" target="_blank" style="text-decoration: none; display: block; border: 0;">
    <img src="${logoUrl}" alt="TicketLelo" height="26" style="height: 26px; width: auto; max-height: 26px; display: block; border: 0; outline: none; text-decoration: none; color: #FE760B; font-weight: 800; font-size: 18px;" />
  </a>`;

  const textBody = `We've received your request, ${firstName}.

Thank you for choosing TicketLelo. Your request to host "${eventTitle}" is now under review by our Super Admin team.

REQUEST DETAILS:
- Event: ${eventTitle}
- College / Organisation: ${college}
- Expected Tickets: ${parsedTickets}
- Contact Email: ${email}

WHAT HAPPENS NEXT?
Our Super Admin team verifies and reviews hosting requests within 24 hours. Once approved, you will receive an approval email with your organiser dashboard sign-in details.

TicketLelo - Smart ticketing for college and community events.
https://ticketlelo.in`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hosting request received: ${safeEvent}</title>
</head>
<body style="margin: 0; padding: 24px 12px; background-color: #F3F4F6; font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 540px; margin: 0 auto; background-color: #FFFFFF; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); border: 1px solid #E5E7EB;">
    <tr>
      <td style="background-color: #131517; padding: 18px 24px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td align="left">${logoHtml}</td>
            <td align="right" style="color: #9B9EA4; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase;">HOSTING REQUEST</td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding: 32px 28px 28px 28px;">
        <div style="background-color: #FEF3C7; border-radius: 9999px; display: inline-block; padding: 5px 14px; font-size: 12px; font-weight: 600; color: #D97706; margin-bottom: 16px;">
          <span style="color: #F59E0B; font-size: 10px; margin-right: 5px;">&#9679;</span>
          Hosting request received
        </div>
        <h1 style="margin: 0 0 10px 0; font-size: 24px; font-weight: 800; color: #111827; line-height: 1.25;">
          We&#39;ve received your request, ${safeFirstName}.
        </h1>
        <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #4B5563;">
          Thank you for choosing TicketLelo. Your request to host <strong style="color: #111827;">${safeEvent}</strong> is now under review by our Super Admin team.
        </p>
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 16px; margin-bottom: 24px; padding: 16px;">
          <tr>
            <td style="padding: 6px 0; font-size: 13px; color: #6B7280;">&#127915;&nbsp; Event</td>
            <td align="right" style="padding: 6px 0; font-size: 13px; font-weight: 700; color: #111827;">${safeEvent}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-size: 13px; color: #6B7280;">&#127979;&nbsp; College / Organisation</td>
            <td align="right" style="padding: 6px 0; font-size: 13px; font-weight: 700; color: #111827;">${safeCollege}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-size: 13px; color: #6B7280;">&#127915;&nbsp; Expected Tickets</td>
            <td align="right" style="padding: 6px 0; font-size: 13px; font-weight: 700; color: #111827;">${safeTickets}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-size: 13px; color: #6B7280;">&#9993;&nbsp; Contact Email</td>
            <td align="right" style="padding: 6px 0; font-size: 13px; font-weight: 700; color: #111827; font-family: monospace;">${safeEmail}</td>
          </tr>
        </table>
        <div style="font-size: 11px; font-weight: 700; color: #9CA3AF; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 12px;">
          WHAT HAPPENS NEXT?
        </div>
        <p style="margin: 0 0 16px 0; font-size: 13px; line-height: 1.6; color: #4B5563;">
          Our Super Admin team verifies and reviews hosting requests within 24 hours. Once approved, you will receive an approval email with your organiser dashboard sign-in details.
        </p>
      </td>
    </tr>
    <tr>
      <td align="center" style="background-color: #131517; padding: 24px; text-align: center;">
        <p style="margin: 0; font-size: 11px; color: #6B7280;">
          TicketLelo &mdash; Smart ticketing for college and community events.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { html, text: textBody };
}
