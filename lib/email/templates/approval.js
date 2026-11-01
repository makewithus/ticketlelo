/**
 * TicketLelo Email Infrastructure - Hosting Approval Template
 *
 * Exact 100% preservation of TicketLelo's organizer approval email:
 * - Dark top header with logo and "ORGANISER ACCESS" label
 * - Green status pill "Hosting request approved"
 * - Event details, sign-in email, and direct dashboard link
 * - Dark button CTA to "/login?redirect=/admin/dashboard&email=..."
 * - Step-by-step onboarding guide ("What to do next")
 * - Security notes & footer
 */

const escapeHtml = (value = "") =>
  String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));

export function buildApprovalEmail(data) {
  const {
    name = "Organiser",
    recipientEmail = "",
    eventTitle = "Event",
    hasLogo = true,
    emailBaseUrl = "https://ticketlelo.in",
  } = data;

  const firstName = (name || "Organiser").trim().split(" ")[0];
  const dashboardDisplay = "ticketlelo.in/admin/dashboard";
  const dashboardUrl = `${emailBaseUrl}/admin/dashboard`;
  const ctaUrl = `${emailBaseUrl}/login?redirect=${encodeURIComponent("/admin/dashboard")}&email=${encodeURIComponent(recipientEmail)}`;
  const ctaText = "Access your organiser dashboard \u2192";

  const safeName = escapeHtml(name);
  const safeFirstName = escapeHtml(firstName);
  const safeEvent = escapeHtml(eventTitle);
  const safeEmail = escapeHtml(recipientEmail);
  const safeCtaUrl = escapeHtml(ctaUrl);
  const safeDashboardUrl = escapeHtml(dashboardUrl);

  const logoUrl = "https://www.ticketlelo.in/logo/Ticketlelo-hero.png";
  const logoHtml = `<a href="https://ticketlelo.in" target="_blank" style="text-decoration: none; display: block; border: 0;">
    <img src="${logoUrl}" alt="TicketLelo" height="26" style="height: 26px; width: auto; max-height: 26px; display: block; border: 0; outline: none; text-decoration: none; color: #FE760B; font-weight: 800; font-size: 18px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;" />
  </a>`;

  const textBody = `You're approved, ${firstName}.

Your request to host "${eventTitle}" on TicketLelo has been approved. Your organiser dashboard is ready — set up tickets, invite guests and check people in on the day.

YOUR ORGANISER ACCOUNT
- Event: ${eventTitle}
- Sign-in email: ${recipientEmail}
- Dashboard: ${dashboardDisplay} (${dashboardUrl})

${ctaText}
${ctaUrl}

(For your security, this link expires in 24 hours and works once.)

WHAT TO DO NEXT:
1. Add ticket types - Free or paid, with seat limits.
2. Share your event page - Guests register and get a QR ticket.
3. Check guests in - Scan tickets at the entrance.

KEEP YOUR ACCOUNT SAFE:
- TicketLelo will never ask for your password by email, phone or chat.
- Don't forward this email — the link signs in to your account.
- Didn't ask to host an event? You can ignore this email.

TicketLelo - Smart ticketing for college and community events.
https://ticketlelo.in`;

  const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>Hosting request approved: ${safeEvent}</title>
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100% !important; background-color: #F3F4F6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    @media only screen and (max-width: 600px) {
      .email-container { width: 100% !important; border-radius: 0 !important; }
      .content-padding { padding: 24px 18px !important; }
      .account-details-table td { display: block !important; width: 100% !important; }
      .account-details-table td.val-col { text-align: left !important; padding-top: 2px !important; padding-bottom: 10px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 24px 12px; background-color: #F3F4F6; -webkit-font-smoothing: antialiased;">
  <div style="display: none; max-height: 0px; overflow: hidden; mso-hide: all; font-size: 1px; line-height: 1px; color: #F3F4F6;">
    Your request to host ${safeEvent} on TicketLelo has been approved. Sign in to access your organiser dashboard.
  </div>

  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
    <tr>
      <td align="center">
        <table role="presentation" class="email-container" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 540px; background-color: #FFFFFF; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); border: 1px solid #E5E7EB;">
          
          <!-- Dark Header -->
          <tr>
            <td style="background-color: #131517; padding: 18px 24px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="left" valign="middle">
                    ${logoHtml}
                  </td>
                  <td align="right" valign="middle" style="color: #9B9EA4; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase;">
                    ORGANISER ACCESS
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Email Body -->
          <tr>
            <td class="content-padding" style="padding: 32px 28px 28px 28px; background-color: #FFFFFF;">
              
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 16px;">
                <tr>
                  <td style="background-color: #ECFDF5; border-radius: 9999px; padding: 5px 14px; font-size: 12px; font-weight: 600; color: #059669;">
                    <span style="color: #10B981; font-size: 10px; vertical-align: middle; margin-right: 5px;">&#9679;</span>
                    Hosting request approved
                  </td>
                </tr>
              </table>

              <h1 style="margin: 0 0 10px 0; font-size: 26px; font-weight: 800; color: #111827; letter-spacing: -0.5px; line-height: 1.25;">
                You&#39;re approved, ${safeFirstName}.
              </h1>

              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #4B5563;">
                Your request to host <strong style="color: #111827;">${safeEvent}</strong> on TicketLelo has been approved. Your organiser dashboard is ready &mdash; set up tickets, invite guests and check people in on the day.
              </p>

              <!-- Account Details Box -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 16px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 18px 20px;">
                    <div style="font-size: 11px; font-weight: 700; color: #9CA3AF; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 14px;">
                      YOUR ORGANISER ACCOUNT
                    </div>

                    <table role="presentation" class="account-details-table" border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td valign="middle" style="padding: 6px 0; font-size: 13px; color: #6B7280; width: 140px;">
                          &#127915;&nbsp; Event
                        </td>
                        <td valign="middle" align="right" class="val-col" style="padding: 6px 0; font-size: 13px; font-weight: 700; color: #111827;">
                          ${safeEvent}
                        </td>
                      </tr>
                      <tr>
                        <td valign="middle" style="padding: 6px 0; font-size: 13px; color: #6B7280;">
                          &#9993;&nbsp; Sign-in email
                        </td>
                        <td valign="middle" align="right" class="val-col" style="padding: 6px 0; font-size: 13px; font-weight: 700; color: #111827; font-family: monospace;">
                          ${safeEmail}
                        </td>
                      </tr>
                      <tr>
                        <td valign="middle" style="padding: 6px 0; font-size: 13px; color: #6B7280;">
                          &#128279;&nbsp; Dashboard
                        </td>
                        <td valign="middle" align="right" class="val-col" style="padding: 6px 0; font-size: 13px; font-weight: 700;">
                          <a href="${safeDashboardUrl}" target="_blank" style="color: #FE760B; text-decoration: none;">${dashboardDisplay}</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Primary CTA Button -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 8px;">
                <tr>
                  <td align="center">
                    <a href="${safeCtaUrl}" target="_blank" style="display: inline-block; background-color: #131517; color: #FFFFFF; font-size: 14px; font-weight: 700; text-decoration: none; padding: 13px 32px; border-radius: 12px; letter-spacing: 0.2px; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                      ${ctaText}
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 28px 0; font-size: 11px; color: #9CA3AF; text-align: center; line-height: 1.4;">
                For your security, this link expires in 24 hours and works once.
              </p>

              <!-- WHAT TO DO NEXT -->
              <div style="font-size: 11px; font-weight: 700; color: #9CA3AF; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 12px;">
                WHAT TO DO NEXT
              </div>

              <!-- Steps -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F9FAFB; border-radius: 12px; margin-bottom: 8px;">
                <tr>
                  <td valign="middle" style="padding: 12px 14px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td valign="top" style="width: 28px;">
                          <div style="width: 20px; height: 20px; border-radius: 9999px; background-color: #FE760B; color: #FFFFFF; font-size: 11px; font-weight: 800; text-align: center; line-height: 20px;">
                            1
                          </div>
                        </td>
                        <td valign="middle" style="padding-left: 8px;">
                          <div style="font-size: 13px; font-weight: 700; color: #111827;">Add ticket types</div>
                          <div style="font-size: 12px; color: #6B7280; margin-top: 1px;">Free or paid, with seat limits.</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F9FAFB; border-radius: 12px; margin-bottom: 8px;">
                <tr>
                  <td valign="middle" style="padding: 12px 14px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td valign="top" style="width: 28px;">
                          <div style="width: 20px; height: 20px; border-radius: 9999px; background-color: #FE760B; color: #FFFFFF; font-size: 11px; font-weight: 800; text-align: center; line-height: 20px;">
                            2
                          </div>
                        </td>
                        <td valign="middle" style="padding-left: 8px;">
                          <div style="font-size: 13px; font-weight: 700; color: #111827;">Share your event page</div>
                          <div style="font-size: 12px; color: #6B7280; margin-top: 1px;">Guests register and get a QR ticket.</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F9FAFB; border-radius: 12px; margin-bottom: 24px;">
                <tr>
                  <td valign="middle" style="padding: 12px 14px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td valign="top" style="width: 28px;">
                          <div style="width: 20px; height: 20px; border-radius: 9999px; background-color: #FE760B; color: #FFFFFF; font-size: 11px; font-weight: 800; text-align: center; line-height: 20px;">
                            3
                          </div>
                        </td>
                        <td valign="middle" style="padding-left: 8px;">
                          <div style="font-size: 13px; font-weight: 700; color: #111827;">Check guests in</div>
                          <div style="font-size: 12px; color: #6B7280; margin-top: 1px;">Scan tickets at the entrance.</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 24px; background-color: #F9FAFB; border-top: 1px solid #E5E7EB; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #6B7280;">
                TicketLelo &mdash; Smart ticketing for college and community events.<br/>
                <a href="${emailBaseUrl}" style="color: #FE760B; text-decoration: none;">ticketlelo.in</a>
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
