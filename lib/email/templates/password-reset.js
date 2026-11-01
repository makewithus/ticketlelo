/**
 * TicketLelo Email Infrastructure - Password Reset Template
 *
 * Exact preservation of TicketLelo's password reset email:
 * - Brand styling with #FE760B button
 * - Security advisory and direct link fallback
 * - Multi-part plain text alternative
 */

const escapeHtml = (value = "") =>
  String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));

export function buildPasswordResetEmail(data) {
  const {
    name = "Organiser",
    email = "",
    eventTitle = "Event",
    resetLink = "",
  } = data;

  const safeName = escapeHtml(name);
  const safeEvent = escapeHtml(eventTitle);
  const safeResetLink = escapeHtml(resetLink);

  const textBody = `Hello ${name},

A password reset was requested for your TicketLelo organiser account (${email}) for "${eventTitle}".

Reset your password here:
${resetLink}

If you did not request this, please contact support@ticketlelo.in immediately.
This link is secure and time-limited.

TicketLelo Support`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Reset your TicketLelo password: ${safeEvent}</title>
</head>
<body style="margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif; background-color: #131517; color: #FFFFFF;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 500px; margin: 0 auto; background-color: #1A1C1F; border: 1px solid #2A2D31; border-radius: 16px; padding: 28px;">
    <tr>
      <td>
        <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 800; color: #FFFFFF;">
          Reset your password
        </h2>
        <p style="margin: 0 0 12px; font-size: 14px; color: #D0D0D1; line-height: 1.5;">
          Hello ${safeName},
        </p>
        <p style="margin: 0 0 24px; font-size: 14px; color: #9B9EA4; line-height: 1.5;">
          A password reset was requested for your TicketLelo organiser account for <strong>${safeEvent}</strong>.
        </p>
        <div style="margin: 0 0 24px;">
          <a href="${safeResetLink}" style="display: inline-block; padding: 12px 24px; background-color: #FE760B; color: #131517; font-weight: bold; text-decoration: none; border-radius: 10px; font-size: 14px;">
            Reset Password &rarr;
          </a>
        </div>
        <p style="font-size: 12px; color: #9B9EA4; line-height: 1.4; margin: 0 0 8px;">
          Or copy this link into your browser:
        </p>
        <p style="font-size: 12px; color: #FE760B; word-break: break-all; margin: 0;">
          <a href="${safeResetLink}" style="color: #FE760B; text-decoration: underline;">${safeResetLink}</a>
        </p>
        <hr style="border: none; border-top: 1px solid #2A2D31; margin: 24px 0;" />
        <p style="font-size: 11px; color: #6C7075; margin: 0;">
          If you did not request this, you can safely ignore this email.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { html, text: textBody };
}
