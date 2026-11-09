/**
 * TicketLelo Email Infrastructure - Organizer Payout Completed Template
 *
 * Dispatched when a Super Admin completes and confirms an organizer payout via UPI.
 * Communicates:
 * - Net payout amount paid
 * - Event name & ID
 * - Unique payout reference ID
 * - UPI Transaction ID / UTR
 * - Payee UPI ID & destination bank
 * - Link to Settlements section
 */

const escapeHtml = (value = "") =>
  String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));

export function buildPayoutConfirmedEmail(data) {
  const {
    organizerName = "Organizer",
    recipientEmail = "",
    eventTitle = "Event",
    amountRupees = 0,
    payoutId = "",
    utr = "",
    upiId = "",
    bankName = "",
    paidAt = new Date().toISOString(),
    emailBaseUrl = "https://ticketlelo.in",
  } = data;

  const formattedAmount = `₹${Number(amountRupees).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  const formattedDate = new Date(paidAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const dashboardUrl = `${emailBaseUrl}/admin/payments`;

  const safeOrganizer = escapeHtml(organizerName);
  const safeEvent = escapeHtml(eventTitle);
  const safePayoutId = escapeHtml(payoutId);
  const safeUtr = escapeHtml(utr);
  const safeUpiId = escapeHtml(upiId);
  const safeBank = escapeHtml(bankName);
  const safeDashboardUrl = escapeHtml(dashboardUrl);

  const textBody = `Your payout has been completed!

${formattedAmount} for ${eventTitle} has been marked as paid.

PAYOUT DETAILS:
- Payout Reference: ${payoutId}
- Event: ${eventTitle}
- Net Amount Paid: ${formattedAmount}
- Payment Method: UPI
- Payee UPI ID: ${upiId}
- Destination Bank: ${bankName || "Linked Bank"}
- UPI Transaction ID / UTR: ${utr}
- Paid At: ${formattedDate}

View your settlements and financial reports on TicketLelo:
${dashboardUrl}

Need support? Contact us at support@ticketlelo.com.
TicketLelo Payments & Settlements Team`;

  const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payout Completed - ${safeEvent}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0d0f11; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #ffffff;">
  <div style="max-width: 560px; margin: 40px auto; background-color: #17191C; border: 1px solid #2A2D31; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
    
    <!-- Header -->
    <div style="background-color: #131517; padding: 24px 32px; border-bottom: 1px solid #2A2D31; display: flex; align-items: center; justify-content: space-between;">
      <a href="https://ticketlelo.in" target="_blank" style="text-decoration: none; display: inline-block;">
        <span style="color: #FE760B; font-weight: 800; font-size: 20px; letter-spacing: -0.5px;">TicketLelo</span>
      </a>
      <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #10b981; font-weight: 700; background-color: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); padding: 4px 10px; border-radius: 9999px;">
        Payout Completed
      </span>
    </div>

    <!-- Body -->
    <div style="padding: 32px;">
      <h1 style="margin: 0 0 12px; font-size: 22px; font-weight: 700; color: #ffffff;">
        Your payout has been completed!
      </h1>
      <p style="margin: 0 0 24px; font-size: 14px; color: #A0A5AD; line-height: 1.5;">
        Hi ${safeOrganizer}, your settlement of <strong style="color: #FE760B; font-size: 16px;">${formattedAmount}</strong> for <strong>${safeEvent}</strong> has been transferred via UPI and confirmed by TicketLelo Finance.
      </p>

      <!-- Amount Highlight Card -->
      <div style="background: linear-gradient(135deg, rgba(254, 118, 11, 0.1) 0%, rgba(254, 118, 11, 0.02) 100%); border: 1px solid rgba(254, 118, 11, 0.3); border-radius: 12px; padding: 20px; margin-bottom: 24px; text-align: center;">
        <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #A0A5AD; margin-bottom: 4px;">Net Paid to UPI</div>
        <div style="font-size: 32px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">${formattedAmount}</div>
        <div style="font-size: 12px; color: #10b981; margin-top: 6px; font-weight: 600;">✓ Settled via UPI Transfer</div>
      </div>

      <!-- Settlement Breakdown Details -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px;">
        <tbody>
          <tr style="border-bottom: 1px solid #23262A;">
            <td style="padding: 10px 0; color: #828892;">Payout Reference</td>
            <td style="padding: 10px 0; text-align: right; font-family: monospace; color: #FE760B; font-weight: 600;">${safePayoutId}</td>
          </tr>
          <tr style="border-bottom: 1px solid #23262A;">
            <td style="padding: 10px 0; color: #828892;">Event</td>
            <td style="padding: 10px 0; text-align: right; color: #ffffff; font-weight: 500;">${safeEvent}</td>
          </tr>
          <tr style="border-bottom: 1px solid #23262A;">
            <td style="padding: 10px 0; color: #828892;">UPI Transaction ID / UTR</td>
            <td style="padding: 10px 0; text-align: right; font-family: monospace; color: #10b981; font-weight: 700;">${safeUtr}</td>
          </tr>
          <tr style="border-bottom: 1px solid #23262A;">
            <td style="padding: 10px 0; color: #828892;">Payee UPI ID</td>
            <td style="padding: 10px 0; text-align: right; font-family: monospace; color: #ffffff;">${safeUpiId}</td>
          </tr>
          ${safeBank ? `
          <tr style="border-bottom: 1px solid #23262A;">
            <td style="padding: 10px 0; color: #828892;">Bank</td>
            <td style="padding: 10px 0; text-align: right; color: #ffffff;">${safeBank}</td>
          </tr>` : ""}
          <tr>
            <td style="padding: 10px 0; color: #828892;">Payment Date</td>
            <td style="padding: 10px 0; text-align: right; color: #A0A5AD;">${formattedDate}</td>
          </tr>
        </tbody>
      </table>

      <!-- CTA -->
      <div style="text-align: center; margin-bottom: 24px;">
        <a href="${safeDashboardUrl}" target="_blank" style="display: inline-block; background-color: #FE760B; color: #0d0f11; font-weight: 700; font-size: 14px; text-decoration: none; padding: 12px 28px; border-radius: 10px; box-shadow: 0 4px 14px rgba(254, 118, 11, 0.4);">
          View Settlements Dashboard &rarr;
        </a>
      </div>

      <p style="margin: 0; font-size: 11px; color: #626772; text-align: center; line-height: 1.5;">
        This payment confirmation was automatically generated by TicketLelo Finance.<br>
        If you have questions regarding this disbursement, reply directly or email <a href="mailto:support@ticketlelo.com" style="color: #FE760B; text-decoration: none;">support@ticketlelo.com</a>.
      </p>
    </div>

  </div>
</body>
</html>`;

  return {
    subject: `Your payout has been completed! ${formattedAmount} for ${eventTitle}`,
    text: textBody,
    html: htmlBody,
  };
}

