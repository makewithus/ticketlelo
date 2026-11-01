/**
 * TicketLelo Email Infrastructure - Hosting Rejection Template
 *
 * Exact 100% preservation of TicketLelo's hosting rejection email:
 * - Header with logo and "ORGANIZE EVENTS SEAMLESSLY"
 * - Request update headline and applicant name
 * - Rejection reason box in dark brown (#351E27) with #FFD60A header
 * - Detailed request details card and what's next guidance
 * - "SUBMIT NEW REQUEST \u2192" CTA button to /host-event
 */

const escapeHtml = (value = "") =>
  String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));

export function buildRejectionEmail(data) {
  const {
    name = "Organiser",
    eventTitle = "Event",
    rejectionReason = "Not specified",
    numberOfTickets = "100",
    college = "",
    eventDescription = "",
    appUrl = "https://ticketlelo.in",
    hasLogo = true,
  } = data;

  const safeName = escapeHtml(name);
  const safeEvent = escapeHtml(eventTitle);
  const safeReason = escapeHtml(rejectionReason);
  const safeTickets = escapeHtml(numberOfTickets);
  const safeCollege = escapeHtml(college);
  const safeDesc = escapeHtml(eventDescription);

  const logoUrl = "https://www.ticketlelo.in/logo/Ticketlelo-hero.png";
  const logoHtml = `<a href="https://ticketlelo.in" target="_blank" style="text-decoration: none; display: block; border: 0;">
    <img src="${logoUrl}" alt="TicketLelo" height="26" style="height: 26px; width: auto; max-height: 26px; display: block; border: 0; outline: none; text-decoration: none; color: #FE760B; font-weight: 800; font-size: 18px;" />
  </a>`;
  const logoFooterHtml = logoHtml;

  const textBody = `REQUEST UPDATE - TicketLelo
========================================

Dear ${name},

Thank you for your interest in hosting "${eventTitle}" on TicketLelo. After careful review, we regret to inform you that your hosting request has not been approved at this time.

REASON FOR DECLINE:
----------------------------------------
${rejectionReason}

YOUR REQUEST DETAILS:
- Event Title: ${eventTitle}
${college ? `- Organization: ${college}\n` : ""}- Expected Tickets: ${numberOfTickets}
${eventDescription ? `- Description: ${eventDescription}\n` : ""}
WHAT'S NEXT?
1. Review the feedback above and address any concerns
2. Submit a new request with updated information at: ${appUrl}/host-event
3. Contact our support team if you have questions: support@ticketlelo.in

TicketLelo - Smart ticketing platform.
${appUrl}`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hosting Request Update: ${safeEvent}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Arial', sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; background: #ffffff; border-radius: 20px; box-shadow: 0 20px 60px rgba(254, 118, 11, 0.15); overflow: hidden;">
          
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center; background: #000000;">
              ${logoHtml}
              <p style="margin: 0; color: #FFD60A; font-size: 13px; letter-spacing: 2px; text-transform: uppercase; font-weight: 700;">
                ORGANIZE EVENTS SEAMLESSLY
              </p>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 50px 40px 40px;">
              <h2 style="margin: 0 0 10px; color: #1a1a1a; font-size: 32px; font-weight: 900; text-align: center; text-transform: uppercase; letter-spacing: 0.5px;">
                REQUEST UPDATE
              </h2>
              
              <h3 style="margin: 0 0 35px; color: #FF6A00; font-size: 24px; font-weight: 800; text-align: center;">
                ${safeName}
              </h3>
              
              <p style="margin: 0 0 25px; color: #333333; font-size: 16px; line-height: 1.8; text-align: center;">
                Thank you for your interest in hosting <strong style="color: #FF6A00;">"${safeEvent}"</strong> on TicketLelo. After careful review, we regret to inform you that your hosting request has been <strong style="color: #ef4444;">not approved</strong> at this time.
              </p>
              
              <!-- Event Details Card -->
              <table role="presentation" style="width: 100%; background: linear-gradient(135deg, rgba(254, 118, 11, 0.05) 0%, rgba(254, 223, 5, 0.05) 100%); border-radius: 15px; padding: 25px; margin: 30px 0; border-left: 5px solid #FF6A00;">
                <tr>
                  <td>
                    <h3 style="margin: 0 0 20px; color: #FF6A00; font-size: 18px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">
                      YOUR REQUEST DETAILS
                    </h3>
                    <table style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 10px 0; color: #666666; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Event Title:</td>
                        <td style="padding: 10px 0; color: #1a1a1a; font-size: 15px; font-weight: 700; text-align: right;">${safeEvent}</td>
                      </tr>
                      ${safeCollege ? `
                      <tr>
                        <td style="padding: 10px 0; color: #666666; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Organization:</td>
                        <td style="padding: 10px 0; color: #1a1a1a; font-size: 15px; font-weight: 700; text-align: right;">${safeCollege}</td>
                      </tr>` : ""}
                      <tr>
                        <td style="padding: 10px 0; color: #666666; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Expected Tickets:</td>
                        <td style="padding: 10px 0; color: #1a1a1a; font-size: 15px; font-weight: 700; text-align: right;">${safeTickets}</td>
                      </tr>
                      ${safeDesc ? `
                      <tr>
                        <td colspan="2" style="padding: 20px 0 8px; color: #666666; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Description:</td>
                      </tr>
                      <tr>
                        <td colspan="2" style="padding: 0; color: #333333; font-size: 14px; line-height: 1.7;">${safeDesc}</td>
                      </tr>` : ""}
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Rejection Reason -->
              <div style="background: #351E27; padding: 25px; margin: 30px 0; border-radius: 15px;">
                <h3 style="margin: 0 0 15px; color: #FFD60A; font-family: 'Inter', Arial, sans-serif; font-size: 18px; font-weight: 500; line-height: 24px; text-transform: uppercase; letter-spacing: 0.5px;">
                  REASON FOR DECLINE
                </h3>
                <p style="margin: 0; color: #ffffff; font-family: 'Inter', Arial, sans-serif; font-size: 14px; font-weight: 400; line-height: 24px;">
                  ${safeReason}
                </p>
              </div>
              
              <!-- Next Steps -->
              <table role="presentation" style="width: 100%; background: linear-gradient(135deg, rgba(53, 30, 39, 0.05) 0%, rgba(254, 118, 11, 0.05) 100%); border-radius: 15px; padding: 25px; margin: 30px 0; border-left: 5px solid #351E27;">
                <tr>
                  <td>
                    <h3 style="margin: 0 0 15px; color: #351E27; font-size: 18px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">
                      WHAT&#39;S NEXT?
                    </h3>
                    <ul style="margin: 0; padding-left: 20px; color: #333333; font-size: 15px; line-height: 2;">
                      <li><strong>Review the feedback</strong> above and address any concerns</li>
                      <li><strong>Submit a new request</strong> with updated information</li>
                      <li><strong>Contact our support team</strong> if you have questions</li>
                    </ul>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 25px 0 0; color: #666666; font-size: 15px; line-height: 1.8; text-align: center; font-style: italic;">
                We appreciate your understanding and encourage you to reapply once you&#39;ve addressed the feedback provided.
              </p>
            </td>
          </tr>
          
          <!-- CTA Button -->
          <tr>
            <td style="padding: 0 40px 50px; text-align: center;">
              <a href="${appUrl}/host-event"
                 style="display: inline-block; background: #FFD60A; color: #000000; text-decoration: none; padding: 18px 50px; border-radius: 12px; font-weight: 900; font-size: 16px; text-transform: uppercase; letter-spacing: 1px; box-shadow: 0 6px 20px rgba(254, 223, 5, 0.4);">
                SUBMIT NEW REQUEST &rarr;
              </a>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background: #000000; text-align: center;">
              ${logoFooterHtml}
              <p style="margin: 0; color: #FFD60A; font-size: 11px; font-weight: 600;">
                ticketlelo.in
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { html, text: textBody };
}
