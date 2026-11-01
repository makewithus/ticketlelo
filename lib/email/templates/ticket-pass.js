/**
 * TicketLelo Email Infrastructure - Ticket Pass Template
 *
 * Exact 100% preservation of TicketLelo's signature dark-theme ticket email:
 * - Canvas `#131517`, Card `#1A1C1F`, Border `#2A2D31`, Accent `#FE760B`, Yellow `#FDE003`
 * - Embedded high-res scannable QR pass with perforated stub styling
 * - Pass ID, Tier, Price, Event Date, Time, and Venue
 * - Direct pass link, Google Maps link, and Add-to-Calendar action
 * - Multi-part plain text alternative for maximum email deliverability
 */

const escapeHtml = (value = "") =>
  String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));

/**
 * Builds the exact branded HTML and plain-text body for a ticket confirmation pass.
 *
 * @param {Object} data
 * @returns {{ html: string, text: string }}
 */
export function buildTicketPassEmail(data) {
  const {
    eventTitle = "Tech Fest 2026",
    guestName = "Guest",
    ticketId = "TKT-00000000",
    venue = "Main Auditorium",
    formattedDate = "Thu, 29 Oct 2026",
    formattedTime = "12:00 – 5:00 PM IST",
    tierName = "General",
    priceDisplay = "Free",
    hasLogo = true,
    emailBaseUrl = "https://ticketlelo.in",
    eventPageUrl = "",
    mapsUrl = "",
    calendarUrl = "",
  } = data;

  const firstName = guestName.trim().split(" ")[0] || "Guest";
  const tierBadgeText = `${tierName} - ${priceDisplay}`;
  const directPassUrl = `${emailBaseUrl}/tickets/${ticketId}`;

  const safeEvent = escapeHtml(eventTitle);
  const safeGuestName = escapeHtml(guestName);
  const safeFirstName = escapeHtml(firstName);
  const safeVenue = escapeHtml(venue);
  const safeTicketId = escapeHtml(ticketId);
  const safeTierBadgeText = escapeHtml(tierBadgeText);
  const safePriceDisplay = escapeHtml(priceDisplay);

  const logoHtml = hasLogo
    ? `<img src="cid:ticketleloLogo" alt="TicketLelo" height="26" style="height: 26px; width: auto; display: block; border: 0;" />`
    : `<span style="color: #FE760B; font-weight: 800; font-size: 18px; letter-spacing: -0.5px;">Ticket<span style="color: #FFFFFF;">Lelo</span></span>`;

  const logoFooterHtml = hasLogo
    ? `<img src="cid:ticketleloLogo" alt="TicketLelo" height="22" style="height: 22px; width: auto; display: inline-block; border: 0; margin: 0 auto;" />`
    : `<span style="color: #FE760B; font-weight: 800; font-size: 16px;">Ticket<span style="color: #FFFFFF;">Lelo</span></span>`;

  const textBody = `TICKETLELO - YOUR TICKET
========================================

Hi ${firstName},

You are confirmed for ${eventTitle}!
Your digital entry pass is ready. Show the attached QR code or PDF at the entrance.

TICKET DETAILS
----------------------------------------
Pass ID:   ${ticketId}
Tier:      ${tierName}
Price:     ${priceDisplay}
Event:     ${eventTitle}
Date:      ${formattedDate}
Time:      ${formattedTime}
Venue:     ${venue}

View pass online: ${directPassUrl}
${mapsUrl ? `Venue directions: ${mapsUrl}\n` : ""}${calendarUrl ? `Add to calendar: ${calendarUrl}\n` : ""}
Need help? Contact support@ticketlelo.in
Powered by TicketLelo - Smart Ticketing Platform`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Your Ticket for ${safeEvent}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #131517; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #FFFFFF;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #131517; table-layout: fixed;">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; background-color: #1A1C1F; border: 1px solid #2A2D31; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.4);">
          
          <!-- Header -->
          <tr>
            <td style="padding: 24px 28px 20px; border-bottom: 1px solid #2A2D31; background-color: #1A1C1F;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="left" valign="middle">
                    ${logoHtml}
                  </td>
                  <td align="right" valign="middle">
                    <span style="display: inline-block; padding: 4px 10px; background-color: rgba(61, 214, 140, 0.12); border: 1px solid rgba(61, 214, 140, 0.3); border-radius: 9999px; font-size: 11px; font-weight: 600; color: #3DD68C; letter-spacing: 0.3px;">
                      CONFIRMED PASS
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Hero Greeting -->
          <tr>
            <td style="padding: 28px 28px 12px; background: linear-gradient(180deg, rgba(254, 118, 11, 0.08) 0%, rgba(26, 28, 31, 0) 100%);">
              <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: 600; color: #FE760B; letter-spacing: 0.8px; text-transform: uppercase;">
                You're going to
              </p>
              <h1 style="margin: 0 0 10px 0; font-size: 26px; font-weight: 800; line-height: 1.25; color: #FFFFFF; letter-spacing: -0.5px;">
                ${safeEvent}
              </h1>
              <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #9B9EA4;">
                Hi <strong style="color: #FFFFFF;">${safeFirstName}</strong>, here is your confirmed entry pass. Show the scannable QR code below or open the attached PDF ticket when you arrive at the gate.
              </p>
            </td>
          </tr>

          <!-- TICKET PASS CARD -->
          <tr>
            <td style="padding: 16px 28px 24px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #131517; border: 1px solid #2A2D31; border-radius: 16px; overflow: hidden;">
                
                <!-- Ticket Header Band -->
                <tr>
                  <td style="background-color: #212327; padding: 12px 18px; border-bottom: 1px dashed #2A2D31;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td align="left">
                          <span style="font-size: 11px; font-weight: 700; color: #9B9EA4; text-transform: uppercase; letter-spacing: 0.5px;">ENTRY PASS</span>
                        </td>
                        <td align="right">
                          <span style="display: inline-block; padding: 2px 8px; background-color: #FE760B; border-radius: 6px; font-size: 11px; font-weight: 700; color: #FFFFFF;">
                            ${safeTierBadgeText}
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- QR Code & Pass ID -->
                <tr>
                  <td align="center" style="padding: 24px 20px 16px; background-color: #131517;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="background-color: #FFFFFF; padding: 12px; border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.5);">
                      <tr>
                        <td align="center">
                          <img src="cid:ticketQrCode" alt="Ticket QR Pass" width="180" height="180" style="width: 180px; height: 180px; display: block; margin: 0 auto; border-radius: 4px;" />
                        </td>
                      </tr>
                    </table>
                    <div style="margin-top: 14px;">
                      <span style="font-family: 'Courier New', Courier, monospace; font-size: 16px; font-weight: 800; letter-spacing: 2px; color: #FFFFFF; background-color: #1A1C1F; padding: 6px 14px; border-radius: 8px; border: 1px solid #2A2D31; display: inline-block;">
                        ${safeTicketId}
                      </span>
                    </div>
                    <p style="margin: 8px 0 0; font-size: 11px; color: #9B9EA4; letter-spacing: 0.5px; text-transform: uppercase;">
                      Show at entrance for scan
                    </p>
                  </td>
                </tr>

                <!-- Event Details Breakdown -->
                <tr>
                  <td style="padding: 0 18px 18px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-top: 1px dashed #2A2D31; padding-top: 14px;">
                      <tr>
                        <td style="padding: 6px 0;" valign="top" width="50%">
                          <span style="font-size: 11px; color: #9B9EA4; text-transform: uppercase; font-weight: 600; display: block; margin-bottom: 2px;">DATE</span>
                          <span style="font-size: 13px; font-weight: 600; color: #FFFFFF;">${formattedDate}</span>
                        </td>
                        <td style="padding: 6px 0;" valign="top" width="50%">
                          <span style="font-size: 11px; color: #9B9EA4; text-transform: uppercase; font-weight: 600; display: block; margin-bottom: 2px;">TIME</span>
                          <span style="font-size: 13px; font-weight: 600; color: #FFFFFF;">${formattedTime}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0;" valign="top" colspan="2">
                          <span style="font-size: 11px; color: #9B9EA4; text-transform: uppercase; font-weight: 600; display: block; margin-bottom: 2px;">VENUE</span>
                          <span style="font-size: 13px; font-weight: 600; color: #FFFFFF; line-height: 1.4;">${safeVenue}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0;" valign="top" width="50%">
                          <span style="font-size: 11px; color: #9B9EA4; text-transform: uppercase; font-weight: 600; display: block; margin-bottom: 2px;">ATTENDEE</span>
                          <span style="font-size: 13px; font-weight: 600; color: #FFFFFF;">${safeGuestName}</span>
                        </td>
                        <td style="padding: 6px 0;" valign="top" width="50%">
                          <span style="font-size: 11px; color: #9B9EA4; text-transform: uppercase; font-weight: 600; display: block; margin-bottom: 2px;">PRICE PAID</span>
                          <span style="font-size: 13px; font-weight: 700; color: #3DD68C;">${safePriceDisplay}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- Quick Action Buttons -->
          <tr>
            <td style="padding: 0 28px 24px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="padding-bottom: 12px;">
                    <a href="${directPassUrl}" target="_blank" style="display: block; width: 100%; max-width: 320px; padding: 13px 20px; background-color: #FE760B; color: #FFFFFF; text-decoration: none; font-size: 14px; font-weight: 700; border-radius: 10px; text-align: center; box-sizing: border-box;">
                      Open Pass in Browser &rarr;
                    </a>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        ${calendarUrl ? `<td style="padding: 0 6px;"><a href="${calendarUrl}" target="_blank" style="color: #9B9EA4; font-size: 12px; text-decoration: underline;">Add to Calendar</a></td>` : ""}
                        ${mapsUrl ? `<td style="padding: 0 6px;"><a href="${mapsUrl}" target="_blank" style="color: #9B9EA4; font-size: 12px; text-decoration: underline;">Directions (Maps)</a></td>` : ""}
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 28px; background-color: #131517; border-top: 1px solid #2A2D31; text-align: center;">
              <div style="margin-bottom: 12px;">
                ${logoFooterHtml}
              </div>
              <p style="margin: 0 0 6px 0; font-size: 12px; color: #9B9EA4;">
                Smart Ticketing. Total Control. One Click.
              </p>
              <p style="margin: 0; font-size: 11px; color: #6C7075; line-height: 1.4;">
                You received this email because you registered for ${safeEvent} on TicketLelo.<br/>
                If you have questions, reach us at <a href="mailto:support@ticketlelo.in" style="color: #FE760B; text-decoration: none;">support@ticketlelo.in</a>.
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
