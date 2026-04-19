import nodemailer from "nodemailer";

/**
 * Server-side utility for sending transactional emails via SMTP (Nodemailer).
 * Use this in API routes — NOT in client-side code.
 *
 * @param {{ to: string, subject: string, html: string }} options
 * @returns {Promise<void>}
 */
export const sendEmail = async ({ to, subject, html }) => {
  if (!process.env.SMTP_EMAIL || !process.env.SMTP_PASSWORD) {
    console.warn("⚠️  SMTP credentials not configured. Email not sent to:", to);
    return;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.SMTP_EMAIL,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: `"TicketLelo" <${process.env.SMTP_EMAIL}>`,
    to,
    subject,
    html,
  });
};
