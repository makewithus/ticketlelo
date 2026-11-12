/**
 * TicketLelo Email Infrastructure - Ticket Pass Template
 *
 * Exact 100% preservation of TicketLelo's signature dark-theme ticket email:
 * - Canvas `#131517`, Card `#1A1C1F`, Border `#2A2D31`, Accent `#FE760B`, Yellow `#FDE003`
 * - Embedded high-res scannable QR pass with perforated stub styling
 * - Pass ID, Tier, Price, Event Date, Time, and Venue
 * - Direct pass link, Google Maps link, and Add-to-Calendar action
 * - Multi-part plain text alternative for maximum email deliverability
 * - Responsive cross-client HTML with MSO / Outlook desktop compatibility
 * - Contextual HTML escaping on all dynamic variables (SEC-6, R34)
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
export function buildTicketPassEmail(data = {}) {
  const {
    eventTitle = "Event Pass",
    guestName = "Attendee",
    ticketId = "TKT-00000000",
    venue = "Venue details to be announced",
    formattedDate = "Date to be announced",
    formattedTime = "Time to be announced",
    tierName = "General",
    priceDisplay = "Free",
    hasLogo = true,
    emailBaseUrl = "https://ticketlelo.in",
    eventPageUrl = "",
    mapsUrl = "",
    calendarUrl = "",
    isFirstTimeUser = true,
    setupPasswordUrl = "",
    loginUrl = "",
    email = "",
  } = data;

  const effectiveEventTitle = eventTitle || "Event Pass";
  const effectiveGuestName = guestName || "Attendee";
  const effectiveVenue = venue || "Venue details to be announced";
  const effectiveDate = formattedDate || "Date to be announced";
  const effectiveTime = formattedTime || "Time to be announced";

  const firstName = effectiveGuestName.trim().split(" ")[0] || "Attendee";
  const tierBadgeText = `${tierName} - ${priceDisplay}`;
  const directPassUrl = `${emailBaseUrl}/tickets/${encodeURIComponent(ticketId)}`;
  const effectiveSetupUrl =
    setupPasswordUrl ||
    `${emailBaseUrl}/setup-password?email=${encodeURIComponent(email)}&ticketId=${encodeURIComponent(ticketId)}`;
  const effectiveLoginUrl =
    loginUrl ||
    `${emailBaseUrl}/login?email=${encodeURIComponent(email)}&redirect=/dashboard`;

  const safeEvent = escapeHtml(effectiveEventTitle);
  const safeGuestName = escapeHtml(effectiveGuestName);
  const safeFirstName = escapeHtml(firstName);
  const safeVenue = escapeHtml(effectiveVenue);
  const safeTicketId = escapeHtml(ticketId);
  const safeTierBadgeText = escapeHtml(tierBadgeText);
  const safePriceDisplay = escapeHtml(priceDisplay);
  const safeFormattedDate = escapeHtml(effectiveDate);
  const safeFormattedTime = escapeHtml(effectiveTime);

  const logoHtml = hasLogo
    ? `<img src="cid:ticketleloLogo" alt="TicketLelo" height="26" style="height: 26px; width: auto; display: block; border: 0;" />`
    : `<span style="color: #FE760B; font-weight: 800; font-size: 18px; letter-spacing: -0.5px;">Ticket<span style="color: #FFFFFF;">Lelo</span></span>`;

  const logoFooterHtml = hasLogo
    ? `<img src="cid:ticketleloLogo" alt="TicketLelo" height="22" style="height: 22px; width: auto; display: inline-block; border: 0; margin: 0 auto;" />`
    : `<span style="color: #FE760B; font-weight: 800; font-size: 16px;">Ticket<span style="color: #FFFFFF;">Lelo</span></span>`;

  const textBody = `TICKETLELO - YOUR TICKET
TICKETLELO — REGISTRATION CONFIRMED
========================================

Hi ${firstName},

Great news! Your registration for ${eventTitle} has been successfully confirmed.
Your ticket is ready to access through your TicketLelo account.

EVENT DETAILS
----------------------------------------
Event:           ${eventTitle}
Date:            ${formattedDate}
Time:            ${formattedTime || "Time to be announced"}
Venue:           ${venue}
Registration ID: ${ticketId}
Tier:            ${tierName}
Price:           ${priceDisplay}

${
  isFirstTimeUser
    ? `ACCESS YOUR TICKET
----------------------------------------
Since this is your first time using TicketLelo, you'll need to set up your password to access your ticket.
Once you've set your password, you can log in to TicketLelo and find all your event tickets in one place through your personal dashboard.

SET YOUR PASSWORD & VIEW TICKET:
${effectiveSetupUrl}

Already have a TicketLelo password? Simply log in using your registered email address:
${effectiveLoginUrl}`
    : `ACCESS YOUR TICKET
----------------------------------------
Your ticket is ready to access through your TicketLelo account.
Log in anytime to find all your event tickets in one place through your personal dashboard.

LOG IN TO VIEW YOUR TICKET:
${effectiveLoginUrl}`
}

Direct pass link: ${directPassUrl}
${mapsUrl ? `Venue directions: ${mapsUrl}\n` : ""}${calendarUrl ? `Add to calendar: ${calendarUrl}\n` : ""}

Thank you for choosing TicketLelo!
Need help? Contact support@ticketlelo.in
© TicketLelo. All rights reserved.`;

  const preheaderText = isFirstTimeUser
    ? "Your event registration is confirmed. Set your password to access your ticket."
    : "Your event registration is confirmed. Log in to access your ticket.";
  const safePreheader = escapeHtml(preheaderText);

  const html = `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>You're Registered! Your Ticket Is Ready on TicketLelo</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style type="text/css">
    @media screen and (max-width: 600px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .mobile-p-16 { padding-left: 16px !important; padding-right: 16px !important; }
      .stack-column { display: block !important; width: 100% !important; max-width: 100% !important; }
      .btn-primary { width: 100% !important; display: block !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #131517; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #FFFFFF;">
  <!-- Hidden Preheader -->
  <div style="display: none; font-size: 1px; color: #131517; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden; mso-hide: all;">
    ${safePreheader}
  </div>

  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #131517; table-layout: fixed;">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <!--[if mso]>
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="560">
        <tr>
        <td>
        <![endif]-->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="email-container" style="max-width: 560px; background-color: #1A1C1F; border: 1px solid #2A2D31; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.4);">
          
          <!-- Header -->
          <tr>
            <td style="padding: 24px 28px 20px; border-bottom: 1px solid #2A2D31; background-color: #1A1C1F;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="left" valign="middle">
                    ${logoHtml}
                  </td>
                  <td align="right" valign="middle">
                    <span style="display: inline-block; padding: 4px 10px; background-color: rgba(254, 118, 11, 0.12); border: 1px solid rgba(254, 118, 11, 0.3); border-radius: 9999px; font-size: 11px; font-weight: 700; color: #FE760B; letter-spacing: 0.3px;">
                      WELCOME TO TICKETLELO
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Hero Greeting -->
          <tr>
            <td style="padding: 28px 28px 16px; background: linear-gradient(180deg, rgba(254, 118, 11, 0.08) 0%, rgba(26, 28, 31, 0) 100%);">
              <h1 style="margin: 0 0 10px 0; font-size: 26px; font-weight: 800; line-height: 1.25; color: #FFFFFF; letter-spacing: -0.5px;">
                You're Successfully Registered!
              </h1>
              <p style="margin: 0 0 14px 0; font-size: 14px; line-height: 1.5; color: #D0D0D1;">
                Hi <strong style="color: #FFFFFF;">${safeFirstName}</strong>,
              </p>
              <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #9B9EA4;">
                Great news! Your registration for <strong style="color: #FFFFFF;">${safeEvent}</strong> has been successfully confirmed. Your ticket is ready to access through your TicketLelo account.
              </p>
            </td>
          </tr>

          <!-- TICKET PASS CARD -->
          <tr>
            <td style="padding: 12px 28px 20px;" class="mobile-p-16">
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
                  <td align="center" style="padding: 20px 20px 16px; background-color: #131517;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="background-color: #FFFFFF; padding: 10px; border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.5);">
                      <tr>
                        <td align="center">
                          <img src="cid:ticketQrCode" alt="Ticket QR Pass" width="160" height="160" style="width: 160px; height: 160px; display: block; margin: 0 auto; border-radius: 4px;" />
                        </td>
                      </tr>
                    </table>
                    <div style="margin-top: 12px;">
                      <span style="font-family: 'Courier New', Courier, monospace; font-size: 15px; font-weight: 800; letter-spacing: 2px; color: #FFFFFF; background-color: #1A1C1F; padding: 5px 12px; border-radius: 8px; border: 1px solid #2A2D31; display: inline-block;">
                        ${safeTicketId}
                      </span>
                    </div>
                  </td>
                </tr>

                <!-- Event Details Breakdown -->
                <tr>
                  <td style="padding: 0 18px 18px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-top: 1px dashed #2A2D31; padding-top: 14px;">
                      <tr>
                        <td style="padding: 5px 0;" valign="top" width="50%" class="stack-column">
                          <span style="font-size: 10px; color: #9B9EA4; text-transform: uppercase; font-weight: 600; display: block; margin-bottom: 2px;">EVENT</span>
                          <span style="font-size: 12px; font-weight: 700; color: #FFFFFF;">${safeEvent}</span>
                        </td>
                        <td style="padding: 5px 0;" valign="top" width="50%" class="stack-column">
                          <span style="font-size: 10px; color: #9B9EA4; text-transform: uppercase; font-weight: 600; display: block; margin-bottom: 2px;">REGISTRATION ID</span>
                          <span style="font-size: 12px; font-weight: 700; color: #FE760B;">${safeTicketId}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 5px 0;" valign="top" width="50%" class="stack-column">
                          <span style="font-size: 10px; color: #9B9EA4; text-transform: uppercase; font-weight: 600; display: block; margin-bottom: 2px;">DATE</span>
                          <span style="font-size: 12px; font-weight: 600; color: #FFFFFF;">${safeFormattedDate}</span>
                        </td>
                        <td style="padding: 5px 0;" valign="top" width="50%" class="stack-column">
                          <span style="font-size: 10px; color: #9B9EA4; text-transform: uppercase; font-weight: 600; display: block; margin-bottom: 2px;">TIME</span>
                          <span style="font-size: 12px; font-weight: 600; color: #FFFFFF;">${safeFormattedTime}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 5px 0;" valign="top" colspan="2">
                          <span style="font-size: 10px; color: #9B9EA4; text-transform: uppercase; font-weight: 600; display: block; margin-bottom: 2px;">VENUE</span>
                          <span style="font-size: 12px; font-weight: 600; color: #FFFFFF; line-height: 1.4;">${safeVenue}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- TICKET ACCESS SECTION (FIRST-TIME OR RETURNING USER) -->
          <tr>
            <td style="padding: 0 28px 24px;" class="mobile-p-16">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #212327; border: 1px solid #2A2D31; border-radius: 14px; padding: 20px;">
                <tr>
                  <td>
                    <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 700; color: #FFFFFF;">
                      Access Your Ticket
                    </h3>
                    ${
                      isFirstTimeUser
                        ? `<p style="margin: 0 0 16px 0; font-size: 13px; line-height: 1.5; color: #D0D0D1;">
                            Since this is your first time using TicketLelo, you'll need to set up your password to access your ticket.
                            Once you've set your password, you can log in to TicketLelo and find all your event tickets in one place through your personal dashboard.
                          </p>
                          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                            <tr>
                              <td align="center">
                                <a href="${effectiveSetupUrl}" target="_blank" class="btn-primary" style="display: block; width: 100%; max-width: 340px; padding: 14px 24px; background-color: #FE760B; color: #FFFFFF; text-decoration: none; font-size: 13px; font-weight: 800; letter-spacing: 0.5px; border-radius: 10px; text-align: center; box-sizing: border-box; text-transform: uppercase;">
                                  SET YOUR PASSWORD &amp; VIEW TICKET
                                </a>
                              </td>
                            </tr>
                          </table>
                          <p style="margin: 14px 0 0 0; font-size: 11px; color: #9B9EA4; text-align: center; line-height: 1.4;">
                            Already have a TicketLelo password? <a href="${effectiveLoginUrl}" target="_blank" style="color: #FE760B; text-decoration: underline;">Simply log in using your registered email address to access your tickets.</a>
                          </p>`
                        : `<p style="margin: 0 0 16px 0; font-size: 13px; line-height: 1.5; color: #D0D0D1;">
                            Your ticket is ready to access through your TicketLelo account. Log in anytime to find all your event tickets in one place through your personal dashboard.
                          </p>
                          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                            <tr>
                              <td align="center">
                                <a href="${effectiveLoginUrl}" target="_blank" class="btn-primary" style="display: block; width: 100%; max-width: 340px; padding: 14px 24px; background-color: #FE760B; color: #FFFFFF; text-decoration: none; font-size: 13px; font-weight: 800; letter-spacing: 0.5px; border-radius: 10px; text-align: center; box-sizing: border-box; text-transform: uppercase;">
                                  LOG IN TO VIEW YOUR TICKET
                                </a>
                              </td>
                            </tr>
                          </table>`
                    }
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Quick Links (Map & Calendar) -->
          <tr>
            <td style="padding: 0 28px 24px;" class="mobile-p-16" align="center">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                <tr>
                  <td style="padding: 0 10px;">
                    <a href="${directPassUrl}" target="_blank" style="color: #FE760B; font-size: 12px; font-weight: 600; text-decoration: none;">View Pass Online &rarr;</a>
                  </td>
                  ${calendarUrl ? `<td style="padding: 0 10px;"><a href="${calendarUrl}" target="_blank" style="color: #9B9EA4; font-size: 12px; text-decoration: underline;">Add to Calendar</a></td>` : ""}
                  ${mapsUrl ? `<td style="padding: 0 10px;"><a href="${mapsUrl}" target="_blank" style="color: #9B9EA4; font-size: 12px; text-decoration: underline;">Directions (Google Maps)</a></td>` : ""}
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
              <p style="margin: 0 0 6px 0; font-size: 12px; color: #D0D0D1; font-weight: 600;">
                Thank you for choosing TicketLelo!
              </p>
              <p style="margin: 0 0 8px 0; font-size: 11px; color: #9B9EA4;">
                Need help? Contact our support team at <a href="mailto:support@ticketlelo.in" style="color: #FE760B; text-decoration: none;">support@ticketlelo.in</a>.
              </p>
              <p style="margin: 0; font-size: 11px; color: #6C7075; line-height: 1.4;">
                &copy; TicketLelo. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
        <!--[if mso]>
        </td>
        </tr>
        </table>
        <![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { html, text: textBody };
}
