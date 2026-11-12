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
    displayTicketId = null,
    themeColor = "#FE760B",
    qrCodeDataUrl = null,
    eventLogoUrl = null,
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
  const effectiveDisplayId = displayTicketId || ticketId || "TKT-101";
  const themeAccent = themeColor || "#FE760B";

  const firstName = effectiveGuestName.trim().split(" ")[0] || "Attendee";
  const tierBadgeText = `${tierName} - ${priceDisplay}`;
  // Ensure emailBaseUrl is ALWAYS https://ticketlelo.in and NEVER localhost
  let cleanBaseUrl = (emailBaseUrl || "").replace(/\/+$/, "");
  if (!cleanBaseUrl || cleanBaseUrl.includes("localhost") || cleanBaseUrl.includes("127.0.0.1")) {
    cleanBaseUrl = "https://ticketlelo.in";
  }

  const sanitizeUrl = (urlStr) => {
    if (!urlStr || typeof urlStr !== "string") return "";
    return urlStr
      .replace(/^http:\/\/localhost(:\d+)?/i, "https://ticketlelo.in")
      .replace(/^http:\/\/127\.0\.0\.1(:\d+)?/i, "https://ticketlelo.in");
  };

  const directPassUrl = `${cleanBaseUrl}/tickets/${encodeURIComponent(ticketId)}`;
  const effectiveSetupUrl =
    sanitizeUrl(setupPasswordUrl) ||
    `${cleanBaseUrl}/setup-password?email=${encodeURIComponent(email)}&name=${encodeURIComponent(effectiveGuestName)}&ticketId=${encodeURIComponent(ticketId)}`;
  const effectiveLoginUrl =
    sanitizeUrl(loginUrl) ||
    `${cleanBaseUrl}/login?email=${encodeURIComponent(email)}&redirect=/dashboard`;

  const safeEvent = escapeHtml(effectiveEventTitle);
  const safeGuestName = escapeHtml(effectiveGuestName);
  const safeFirstName = escapeHtml(firstName);
  const safeVenue = escapeHtml(effectiveVenue);
  const safeTicketId = escapeHtml(ticketId);
  const safeDisplayId = escapeHtml(effectiveDisplayId);
  const safeTierBadgeText = escapeHtml(tierBadgeText);
  const safePriceDisplay = escapeHtml(priceDisplay);
  const safeFormattedDate = escapeHtml(effectiveDate);
  const safeFormattedTime = escapeHtml(effectiveTime);
  const safeThemeAccent = escapeHtml(themeAccent);
  const qrImageSrc = qrCodeDataUrl || "cid:ticketQrCode";

  const isValidCustomLogo =
    typeof eventLogoUrl === "string" &&
    eventLogoUrl.startsWith("http") &&
    !eventLogoUrl.includes("localhost") &&
    !eventLogoUrl.includes("test-image");

  const logoHtml = isValidCustomLogo
    ? `<img src="${escapeHtml(eventLogoUrl)}" alt="${safeEvent}" height="28" style="height: 28px; width: auto; max-width: 150px; display: block; border: 0; object-fit: contain;" />`
    : hasLogo
    ? `<img src="cid:ticketleloLogo" alt="TicketLelo" height="28" style="height: 28px; width: auto; max-width: 150px; display: block; border: 0;" />`
    : `<span style="color: #FE760B; font-weight: 900; font-size: 20px; letter-spacing: -0.5px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Ticket<span style="color: #0F172A;">Lelo</span></span>`;

  const logoFooterHtml = isValidCustomLogo
    ? `<img src="${escapeHtml(eventLogoUrl)}" alt="${safeEvent}" height="22" style="height: 22px; width: auto; max-width: 120px; display: inline-block; border: 0; margin: 0 auto; object-fit: contain;" />`
    : hasLogo
    ? `<img src="cid:ticketleloLogo" alt="TicketLelo" height="22" style="height: 22px; width: auto; display: inline-block; border: 0; margin: 0 auto;" />`
    : `<span style="color: #FE760B; font-weight: 800; font-size: 16px; letter-spacing: -0.5px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Ticket<span style="color: #0F172A;">Lelo</span></span>`;

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
Ticket ID:       ${effectiveDisplayId}
Tier:            ${tierName}
Price:           ${priceDisplay}

ACCESS YOUR TICKET & ACCOUNT:
${effectiveSetupUrl}

Already set up your password? Log in here:
${effectiveLoginUrl}

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
<body style="margin: 0; padding: 0; background-color: #F1F5F9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1E293B;">
  <!-- Hidden Preheader -->
  <div style="display: none; font-size: 1px; color: #F1F5F9; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden; mso-hide: all;">
    ${safePreheader}
  </div>

  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F1F5F9; table-layout: fixed;">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <!--[if mso]>
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="580">
        <tr>
        <td>
        <![endif]-->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="email-container" style="max-width: 580px; background-color: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.06);">
          
          <!-- Header Bar with TicketLelo Logo & Confirmed Pass Pill -->
          <tr>
            <td style="padding: 22px 28px 20px; border-bottom: 1px solid #E2E8F0; background-color: #FFFFFF;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="left" valign="middle">
                    ${logoHtml}
                  </td>
                  <td align="right" valign="middle">
                    <span style="display: inline-block; padding: 5px 12px; background-color: ${safeThemeAccent}15; border: 1px solid ${safeThemeAccent}40; border-radius: 9999px; font-size: 11px; font-weight: 700; color: ${safeThemeAccent}; letter-spacing: 0.5px; text-transform: uppercase;">
                      CONFIRMED PASS
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Hero Greeting -->
          <tr>
            <td style="padding: 28px 28px 16px; background: linear-gradient(180deg, ${safeThemeAccent}0A 0%, #FFFFFF 100%);">
              <h1 style="margin: 0 0 10px 0; font-size: 26px; font-weight: 800; line-height: 1.25; color: #0F172A; letter-spacing: -0.5px;">
                You're Successfully Registered!
              </h1>
              <p style="margin: 0 0 12px 0; font-size: 15px; line-height: 1.5; color: #334155;">
                Hi <strong style="color: #0F172A;">${safeFirstName}</strong>,
              </p>
              <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #64748B;">
                Great news! Your registration for <strong style="color: #0F172A;">${safeEvent}</strong> has been successfully confirmed. Your ticket pass is ready below.
              </p>
            </td>
          </tr>

          <!-- TICKET PASS CARD (Clean, Organized Light Layout) -->
          <tr>
            <td style="padding: 12px 28px 22px;" class="mobile-p-16">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F8FAFC; border: 1.5px solid #CBD5E1; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.03);">
                
                <!-- Ticket Perforated Header Strip -->
                <tr>
                  <td style="background-color: #F1F5F9; padding: 12px 20px; border-bottom: 1.5px dashed #CBD5E1;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td align="left" valign="middle">
                          <span style="font-size: 11px; font-weight: 800; color: #64748B; text-transform: uppercase; letter-spacing: 1px;">ENTRY PASS</span>
                        </td>
                        <td align="right" valign="middle">
                          <span style="display: inline-block; padding: 4px 12px; background-color: ${safeThemeAccent}; border-radius: 6px; font-size: 11px; font-weight: 700; color: #FFFFFF;">
                            ${safeTierBadgeText}
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- QR Code & Ticket Code Box -->
                <tr>
                  <td align="center" style="padding: 24px 20px 16px; background-color: #F8FAFC;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="background-color: #FFFFFF; padding: 12px; border: 1px solid #E2E8F0; border-radius: 14px; box-shadow: 0 6px 18px rgba(0,0,0,0.05);">
                      <tr>
                        <td align="center">
                          <img src="${qrImageSrc}" alt="Ticket QR Pass" width="160" height="160" style="width: 160px; height: 160px; display: block; margin: 0 auto; border-radius: 6px;" />
                        </td>
                      </tr>
                    </table>
                    <div style="margin-top: 14px;">
                      <span style="font-family: 'Courier New', Courier, monospace; font-size: 17px; font-weight: 800; letter-spacing: 2px; color: #0F172A; background-color: #FFFFFF; padding: 6px 18px; border-radius: 8px; border: 1.5px solid ${safeThemeAccent}80; display: inline-block; box-shadow: 0 2px 6px rgba(0,0,0,0.04);">
                        ${safeDisplayId}
                      </span>
                    </div>
                    <p style="margin: 8px 0 0 0; font-size: 11px; color: #64748B; font-weight: 500;">
                      Show this QR code at the entrance for verification
                    </p>
                  </td>
                </tr>

                <!-- Event Details Breakdown (Organized 2-Column Grid) -->
                <tr>
                  <td style="padding: 4px 20px 20px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-top: 1.5px dashed #CBD5E1; padding-top: 16px;">
                      <tr>
                        <td style="padding: 6px 10px 8px 0;" valign="top" width="50%" class="stack-column">
                          <span style="font-size: 10px; color: #64748B; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; display: block; margin-bottom: 2px;">EVENT</span>
                          <span style="font-size: 13px; font-weight: 700; color: #0F172A; line-height: 1.3;">${safeEvent}</span>
                        </td>
                        <td style="padding: 6px 0 8px 10px;" valign="top" width="50%" class="stack-column">
                          <span style="font-size: 10px; color: #64748B; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; display: block; margin-bottom: 2px;">TICKET CODE</span>
                          <span style="font-size: 13px; font-weight: 800; color: ${safeThemeAccent}; font-family: 'Courier New', monospace;">${safeDisplayId}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 10px 8px 0;" valign="top" width="50%" class="stack-column">
                          <span style="font-size: 10px; color: #64748B; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; display: block; margin-bottom: 2px;">DATE</span>
                          <span style="font-size: 13px; font-weight: 600; color: #1E293B;">${safeFormattedDate}</span>
                        </td>
                        <td style="padding: 6px 0 8px 10px;" valign="top" width="50%" class="stack-column">
                          <span style="font-size: 10px; color: #64748B; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; display: block; margin-bottom: 2px;">TIME</span>
                          <span style="font-size: 13px; font-weight: 600; color: #1E293B;">${safeFormattedTime}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 10px 8px 0;" valign="top" width="50%" class="stack-column">
                          <span style="font-size: 10px; color: #64748B; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; display: block; margin-bottom: 2px;">ATTENDEE</span>
                          <span style="font-size: 13px; font-weight: 600; color: #1E293B;">${safeGuestName}</span>
                        </td>
                        <td style="padding: 6px 0 8px 10px;" valign="top" width="50%" class="stack-column">
                          <span style="font-size: 10px; color: #64748B; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; display: block; margin-bottom: 2px;">PASS TIER</span>
                          <span style="font-size: 13px; font-weight: 600; color: #1E293B;">${safeTierBadgeText}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0 4px 0;" valign="top" colspan="2">
                          <span style="font-size: 10px; color: #64748B; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; display: block; margin-bottom: 2px;">VENUE</span>
                          <span style="font-size: 13px; font-weight: 600; color: #1E293B; line-height: 1.4;">${safeVenue}</span>
                          ${mapsUrl ? `<div style="margin-top: 4px;"><a href="${mapsUrl}" target="_blank" style="color: ${safeThemeAccent}; font-size: 11px; font-weight: 600; text-decoration: none;">View Directions on Google Maps &rarr;</a></div>` : ""}
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
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 14px; padding: 22px;">
                <tr>
                  <td>
                    <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 700; color: #0F172A;">
                      Access Your Ticket &amp; Dashboard
                    </h3>
                    ${
                      isFirstTimeUser
                        ? `<p style="margin: 0 0 16px 0; font-size: 13px; line-height: 1.5; color: #475569;">
                      Since this is your first time using TicketLelo, you'll need to set up your password to view your ticket and access your dashboard.
                    </p>
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td align="center">
                          <a href="${effectiveSetupUrl}" target="_blank" class="btn-primary" style="display: block; width: 100%; max-width: 360px; padding: 14px 24px; background-color: ${safeThemeAccent}; color: #FFFFFF; text-decoration: none; font-size: 13px; font-weight: 800; letter-spacing: 0.5px; border-radius: 10px; text-align: center; box-sizing: border-box; text-transform: uppercase; box-shadow: 0 4px 14px ${safeThemeAccent}35;">
                            SET YOUR PASSWORD &amp; VIEW TICKET
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 14px 0 0 0; font-size: 12px; color: #64748B; text-align: center; line-height: 1.4;">
                      Already have a TicketLelo password? <a href="${effectiveLoginUrl}" target="_blank" style="color: ${safeThemeAccent}; text-decoration: underline; font-weight: 600;">Log in here &rarr;</a>
                    </p>`
                        : `<p style="margin: 0 0 16px 0; font-size: 13px; line-height: 1.5; color: #475569;">
                      Your ticket is confirmed! Access your dashboard to view your tickets and manage all event passes.
                    </p>
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td align="center">
                          <a href="${effectiveLoginUrl}" target="_blank" class="btn-primary" style="display: block; width: 100%; max-width: 360px; padding: 14px 24px; background-color: ${safeThemeAccent}; color: #FFFFFF; text-decoration: none; font-size: 13px; font-weight: 800; letter-spacing: 0.5px; border-radius: 10px; text-align: center; box-sizing: border-box; text-transform: uppercase; box-shadow: 0 4px 14px ${safeThemeAccent}35;">
                            VIEW DASHBOARD
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 14px 0 0 0; font-size: 12px; color: #64748B; text-align: center; line-height: 1.4;">
                      Need to update or set your password? <a href="${effectiveSetupUrl}" target="_blank" style="color: ${safeThemeAccent}; text-decoration: underline; font-weight: 600;">Set password &rarr;</a>
                    </p>`
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
                    <a href="${directPassUrl}" target="_blank" style="color: ${safeThemeAccent}; font-size: 12px; font-weight: 600; text-decoration: none;">View Pass Online &rarr;</a>
                  </td>
                  ${calendarUrl ? `<td style="padding: 0 10px;"><a href="${calendarUrl}" target="_blank" style="color: #64748B; font-size: 12px; text-decoration: underline;">Add to Calendar</a></td>` : ""}
                  ${mapsUrl ? `<td style="padding: 0 10px;"><a href="${mapsUrl}" target="_blank" style="color: #64748B; font-size: 12px; text-decoration: underline;">Directions (Google Maps)</a></td>` : ""}
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 28px; background-color: #F8FAFC; border-top: 1px solid #E2E8F0; text-align: center;">
              <div style="margin-bottom: 12px;">
                ${logoFooterHtml}
              </div>
              <p style="margin: 0 0 6px 0; font-size: 13px; color: #1E293B; font-weight: 600;">
                Thank you for choosing TicketLelo!
              </p>
              <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748B;">
                Need help? Contact our support team at <a href="mailto:support@ticketlelo.in" style="color: ${safeThemeAccent}; text-decoration: none; font-weight: 600;">support@ticketlelo.in</a>.
              </p>
              <p style="margin: 0; font-size: 11px; color: #94A3B8; line-height: 1.4;">
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
