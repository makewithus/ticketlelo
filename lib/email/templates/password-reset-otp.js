/**
 * TicketLelo Email Infrastructure - Password Reset OTP Template
 *
 * Branded 6-digit verification code email for password recovery:
 * - Signature TicketLelo dark canvas (#131517)
 * - Brand orange accent (#FE760B)
 * - Prominent 6-digit security code box
 * - 15-minute expiration notice
 * - Client-safe inline HTML with plain-text alternative
 */

export function buildPasswordResetOtpEmail({ code, email }) {
  const safeCode = String(code || "").trim();
  const safeEmail = String(email || "").trim();

  const text = `TicketLelo Password Reset Verification Code

We received a request to reset the password for your TicketLelo account (${safeEmail}).

YOUR 6-DIGIT VERIFICATION CODE:
${safeCode}

This code is valid for 15 minutes. Please do not share this code with anyone.

If you did not request a password reset, you can safely ignore this email. Your account remains secure.

TicketLelo Security Team
https://ticketlelo.in`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your TicketLelo Password Reset Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0E1012; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #FFFFFF; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0E1012; padding: 40px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 520px; background-color: #1A1C1F; border: 1px solid #2A2D31; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);">
          
          <!-- Top Accent Line -->
          <tr>
            <td height="4" style="background-color: #FE760B; font-size: 0; line-height: 0;">&nbsp;</td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 24px 32px; text-align: left;">
              <span style="font-size: 20px; font-weight: 800; letter-spacing: -0.5px; color: #FE760B;">Ticket<span style="color: #FFFFFF;">Lelo</span></span>
              <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9B9EA4; margin-top: 4px;">Account Security</div>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 0 32px 32px 32px;">
              <h1 style="font-size: 22px; font-weight: 700; color: #FFFFFF; margin: 0 0 12px 0; letter-spacing: -0.3px;">
                Password Reset Code
              </h1>
              
              <p style="font-size: 14px; line-height: 22px; color: #9B9EA4; margin: 0 0 24px 0;">
                We received a request to reset your TicketLelo password. Use the verification code below to verify your identity and set a new password.
              </p>

              <!-- OTP Display Box -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #131517; border: 1px solid #2A2D31; border-radius: 12px; margin: 0 0 24px 0;">
                <tr>
                  <td align="center" style="padding: 24px;">
                    <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700; color: #9B9EA4; margin-bottom: 8px;">
                      Verification Code
                    </div>
                    <div style="font-family: 'SF Mono', Monaco, Consolas, monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #FE760B;">
                      ${safeCode}
                    </div>
                    <div style="font-size: 12px; color: #6E7178; margin-top: 8px;">
                      Valid for 15 minutes
                    </div>
                  </td>
                </tr>
              </table>

              <p style="font-size: 13px; line-height: 20px; color: #6E7178; margin: 0 0 8px 0;">
                <strong style="color: #9B9EA4;">Security Tip:</strong> Never share this code with anyone. TicketLelo staff will never ask for your code or password.
              </p>
              
              <p style="font-size: 13px; line-height: 20px; color: #6E7178; margin: 0;">
                If you did not request a password reset, you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #131517; border-top: 1px solid #2A2D31; text-align: center;">
              <p style="font-size: 12px; color: #6E7178; margin: 0 0 6px 0;">
                TicketLelo &bull; Smart ticketing for college and community events
              </p>
              <p style="font-size: 11px; color: #4B4E54; margin: 0;">
                Sent to ${safeEmail}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { html, text };
}
