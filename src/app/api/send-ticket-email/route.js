import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import path from "path";
import fs from "fs";
import QRCode from "qrcode";
import { generatePDFTicket } from "@/lib/tickets";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { adminDb } from "@/lib/firebase-admin";
import { parseFirestoreDate } from "@/lib/date-utils";

const escapeHtml = (value = "") =>
  String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));

function getEmailBaseUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "https://ticketlelo.in";
}

function formatDateDisplay(rawDate) {
  if (!rawDate) return "Thu, 29 Oct 2026";
  const d = parseFirestoreDate(rawDate);
  if (d && !isNaN(d.getTime())) {
    try {
      return d.toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return String(rawDate);
    }
  }
  return typeof rawDate === "string" ? rawDate : "Thu, 29 Oct 2026";
}

/**
 * API Route: Generate PDF ticket and send it via email
 * POST /api/send-ticket-email
 * Body: { ticketId }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { ticketId } = body;
    const caller = await getAuthenticatedUser(request);
    if (!caller) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (!ticketId || !adminDb) {
      return NextResponse.json({ error: "ticketId is required" }, { status: 400 });
    }

    const ticketSnapshot = await adminDb.collection("tickets").doc(ticketId).get();
    const registrationSnapshot = await adminDb
      .collection("registrations")
      .where("ticketId", "==", ticketId)
      .limit(1)
      .get();

    if (!ticketSnapshot.exists && registrationSnapshot.empty) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const persistedTicket = ticketSnapshot.exists ? ticketSnapshot.data() : null;
    const registration = registrationSnapshot.empty
      ? persistedTicket
      : { id: registrationSnapshot.docs[0].id, ...registrationSnapshot.docs[0].data() };

    const ownerUid = registration.userId || persistedTicket?.userId;
    const ownerEmail = String(
      registration.email || registration.buyerEmail || persistedTicket?.buyerEmail || "",
    ).toLowerCase();
    const callerEmail = String(caller.email || "").toLowerCase();

    const isOwner =
      (ownerUid && ownerUid === caller.uid) ||
      (caller.decodedToken?.email_verified === true && ownerEmail && ownerEmail === callerEmail);

    if (!isOwner && caller.role !== "superAdmin") {
      return NextResponse.json({ error: "Ticket access denied" }, { status: 403 });
    }

    const email = ownerEmail;
    if (!email || !process.env.SMTP_EMAIL || !process.env.SMTP_PASSWORD) {
      return NextResponse.json({ error: "Ticket email delivery is not configured" }, { status: 503 });
    }

    const eventSnapshot = await adminDb.collection("events").doc(registration.eventId).get();
    const event = eventSnapshot.exists ? { id: eventSnapshot.id, ...eventSnapshot.data() } : null;
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const eventTitle = event.name || event.title || "Tech Fest 2026";
    const guestName = registration.fullName || registration.buyerName || "Aarav Kumar";
    const firstName = guestName.trim().split(" ")[0] || "Guest";
    const venue = event.venue || event.location || "Main Auditorium, School of Engineering";
    const formattedDate = formatDateDisplay(event.date || event.startDate);
    const formattedTime = event.time || event.startTime || "12:00 – 5:00 PM IST";
    const tierName = registration.tierName || registration.subEventName || "General";
    const isPaid = Boolean(event.isPaid || registration.price || registration.amount);
    const priceValue = registration.price || registration.amount || event.price || 199;
    const priceDisplay = isPaid ? `₹${priceValue}` : "Free";
    const tierBadgeText = `${tierName} - ${priceDisplay}`;

    const emailBaseUrl = getEmailBaseUrl();
    const eventPageUrl = `${emailBaseUrl}/e/${event.slug || event.id}`;
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `${venue} ${event.location || ""}`.trim() || eventTitle,
    )}`;
    const calEventDate = parseFirestoreDate(event.date || event.startDate) || new Date();
    const calDateStr = calEventDate.toISOString().replace(/-|:|\.\d\d\d/g, "");
    const calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
      eventTitle,
    )}&details=${encodeURIComponent(
      `Your entry pass: ${ticketId}. Show your QR at the entrance.`,
    )}&location=${encodeURIComponent(venue)}&dates=${calDateStr}/${calDateStr}`;

    // Generate scannable QR Code buffer for email embedding
    const qrPayload = registration.qrCode || persistedTicket?.qrCodeUrl || ticketId;
    const qrBuffer = await QRCode.toBuffer(String(qrPayload), {
      width: 320,
      margin: 1,
      color: { dark: "#000000", light: "#ffffff" },
    });

    // Generate PDF ticket attachment
    const pdfBlob = await generatePDFTicket(
      { ...registration, ticketId, qrCode: qrPayload },
      event,
      qrPayload,
    );
    const pdfArrayBuffer = await pdfBlob.arrayBuffer();
    const pdfBuffer = Buffer.from(pdfArrayBuffer);

    // Prepare attachments
    const attachments = [
      {
        filename: `${eventTitle.replace(/[^a-zA-Z0-9_-]/g, "_")}-Pass-${ticketId}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
      {
        filename: "ticket-qr.png",
        content: qrBuffer,
        cid: "ticketQrCode",
      },
    ];

    const logoPath = path.join(process.cwd(), "public", "logo", "ticketlelo-logo-nav.png");
    const hasLogo = fs.existsSync(logoPath);
    if (hasLogo) {
      attachments.push({
        filename: "ticketlelo-logo.png",
        path: logoPath,
        cid: "ticketleloLogo",
      });
    }

    const logoHtml = hasLogo
      ? `<img src="cid:ticketleloLogo" alt="TicketLelo" height="26" style="height: 26px; width: auto; display: block; border: 0;" />`
      : `<span style="color: #FE760B; font-weight: 800; font-size: 18px; letter-spacing: -0.5px;">Ticket<span style="color: #FFFFFF;">Lelo</span></span>`;

    const logoFooterHtml = hasLogo
      ? `<img src="cid:ticketleloLogo" alt="TicketLelo" height="22" style="height: 22px; width: auto; display: inline-block; border: 0; margin: 0 auto;" />`
      : `<span style="color: #FE760B; font-weight: 800; font-size: 16px;">Ticket<span style="color: #FFFFFF;">Lelo</span></span>`;

    // RFC 5322 Message-ID
    const domain = "ticketlelo.in";
    const uniqueId = `tl-tkt-${ticketId.toLowerCase().replace(/[^a-z0-9]/g, "")}-${Date.now()}`;
    const messageId = `<${uniqueId}@${domain}>`;

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT || 587) === 465,
      auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    const safeEvent = escapeHtml(eventTitle);
    const safeGuestName = escapeHtml(guestName);
    const safeFirstName = escapeHtml(firstName);
    const safeVenue = escapeHtml(venue);
    const safeTicketId = escapeHtml(ticketId);
    const safeTierBadgeText = escapeHtml(tierBadgeText);
    const safePriceDisplay = escapeHtml(priceDisplay);

    // Multi-part plain text body mirroring the HTML ticket (essential for high deliverability)
    const textBody = `TICKETLELO - YOUR TICKET

You're in!

See you at ${eventTitle}!

Hi ${firstName}, your registration is confirmed. Show the QR code attached to this email at the entrance — on your phone or printed.

TICKET DETAILS
Event: ${eventTitle}
Tier: ${tierBadgeText}
Date: ${formattedDate}
Time: ${formattedTime}
Venue: ${venue}
Guest: ${guestName}
Ticket ID: ${ticketId}

One scan per ticket. Your high-resolution entry pass PDF is attached to this email.

QUICK ACTIONS:
- Add to Calendar: ${calendarUrl}
- Get Directions: ${mapsUrl}
- Event Page: ${eventPageUrl}

GOOD TO KNOW:
- Arrive a little early — check-in opens at the venue entrance.
- Your ticket is also saved under My tickets when you sign in on TicketLelo.
- Questions about the event? Contact the organiser from the event page.

TicketLelo - Smart ticketing for college and community events.
https://ticketlelo.in

You received this email because you registered for ${eventTitle} on TicketLelo.`;

    // HTML matching Image 4 specification
    const htmlBody = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>Your ticket for ${safeEvent} - TicketLelo</title>
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100% !important; background-color: #F3F4F6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    @media only screen and (max-width: 600px) {
      .email-container { width: 100% !important; border-radius: 0 !important; }
      .content-padding { padding: 24px 16px !important; }
      .action-buttons td { display: block !important; width: 100% !important; padding: 4px 0 !important; }
      .action-buttons a { display: block !important; width: 100% !important; box-sizing: border-box !important; text-align: center !important; }
      .ticket-grid td { display: block !important; width: 100% !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 24px 12px; background-color: #F3F4F6; -webkit-font-smoothing: antialiased;">
  <!-- Hidden Preheader Preview Text -->
  <div style="display: none; max-height: 0px; overflow: hidden; mso-hide: all; font-size: 1px; line-height: 1px; color: #F3F4F6;">
    Your ticket for ${safeEvent} is confirmed! Ticket ID: ${safeTicketId}. Show your QR at the entrance.
    &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>

  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
    <tr>
      <td align="center">
        <!-- Main Email Container Card -->
        <table role="presentation" class="email-container" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px; background-color: #FFFFFF; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); border: 1px solid #E5E7EB;">
          
          <!-- 1. Dark Top Header matching Image 4 -->
          <tr>
            <td style="background-color: #131517; padding: 18px 24px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="left" valign="middle">
                    ${logoHtml}
                  </td>
                  <td align="right" valign="middle" style="color: #9B9EA4; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase;">
                    YOUR TICKET
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- 2. Email Body -->
          <tr>
            <td class="content-padding" style="padding: 30px 24px 24px 24px; background-color: #FFFFFF;">
              
              <!-- Orange Status Pill matching Image 4 -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 16px;">
                <tr>
                  <td style="background-color: #FFF7ED; border-radius: 9999px; padding: 5px 14px; font-size: 12px; font-weight: 600; color: #EA580C;">
                    <span style="color: #FE760B; font-size: 10px; vertical-align: middle; margin-right: 5px;">&#9679;</span>
                    You&#39;re in
                  </td>
                </tr>
              </table>

              <!-- Main Title matching Image 4 -->
              <h1 style="margin: 0 0 10px 0; font-size: 26px; font-weight: 800; color: #111827; letter-spacing: -0.5px; line-height: 1.25;">
                See you at ${safeEvent}!
              </h1>

              <!-- Subtitle Description -->
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #4B5563;">
                Hi ${safeFirstName}, your registration is confirmed. Show the QR code below at the entrance &mdash; on your phone or printed.
              </p>

              <!-- ================= 3. PHYSICAL TICKET PASS CONTAINER matching Image 4 ================= -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 20px; overflow: hidden; margin-bottom: 24px; box-shadow: 0 6px 20px rgba(0,0,0,0.06);">
                
                <!-- Ticket Artwork Banner matching Image 4 -->
                <tr>
                  <td style="padding: 0; background: #FE760B; line-height: 0;">
                    ${
                      event.coverImage
                        ? `<img src="${escapeHtml(event.coverImage)}" alt="${safeEvent}" style="width: 100%; height: auto; max-height: 220px; object-fit: cover; display: block;" />`
                        : `
                        <!-- Themed festival banner matching Image 4 -->
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background: linear-gradient(135deg, #FE760B 0%, #F59E0B 50%, #FCD34D 100%);">
                          <tr>
                            <td style="padding: 28px 24px; position: relative;">
                              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                                <tr>
                                  <td valign="middle">
                                    <div style="font-family: 'Impact', 'Arial Black', sans-serif; font-size: 36px; line-height: 0.95; font-weight: 900; color: #FFFFFF; text-shadow: 2px 2px 0px #131517; font-style: italic; letter-spacing: 1px;">
                                      ${safeEvent.toUpperCase()}
                                    </div>
                                    <div style="font-size: 12px; font-weight: 800; color: #131517; letter-spacing: 2px; text-transform: uppercase; margin-top: 6px;">
                                      OFFICIAL ENTRY PASS &bull; 2026
                                    </div>
                                  </td>
                                  <td align="right" valign="middle" style="width: 80px;">
                                    <div style="background-color: #EC4899; color: #FFFFFF; font-weight: 900; font-size: 14px; padding: 12px 14px; border-radius: 14px; transform: rotate(6deg); display: inline-block; box-shadow: 0 4px 10px rgba(236,72,153,0.4); text-align: center; border: 2px dashed #FFFFFF;">
                                      ${safePriceDisplay}
                                    </div>
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>
                      `
                    }
                  </td>
                </tr>

                <!-- Event Details Section matching Image 4 -->
                <tr>
                  <td style="padding: 22px 24px 18px 24px; background-color: #FFFFFF;">
                    
                    <!-- Event Title & Tier Badge row -->
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 18px;">
                      <tr>
                        <td valign="top">
                          <div style="font-size: 10px; font-weight: 700; color: #9CA3AF; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 2px;">
                            EVENT
                          </div>
                          <div style="font-size: 18px; font-weight: 800; color: #111827; letter-spacing: -0.3px;">
                            ${safeEvent}
                          </div>
                        </td>
                        <td align="right" valign="top">
                          <span style="display: inline-block; background-color: #18181B; color: #FDE047; font-size: 11px; font-weight: 800; padding: 4px 12px; border-radius: 9999px; letter-spacing: 0.3px;">
                            ${safeTierBadgeText}
                          </span>
                        </td>
                      </tr>
                    </table>

                    <!-- 2-Column Meta Grid matching Image 4 -->
                    <table role="presentation" class="ticket-grid" border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <!-- Left Column: Date & Venue -->
                        <td valign="top" style="width: 50%; padding-right: 12px;">
                          <div style="font-size: 10px; font-weight: 700; color: #9CA3AF; letter-spacing: 0.8px; text-transform: uppercase;">
                            DATE
                          </div>
                          <div style="font-size: 13px; font-weight: 700; color: #111827; margin-top: 2px; margin-bottom: 14px;">
                            ${escapeHtml(formattedDate)}
                          </div>

                          <div style="font-size: 10px; font-weight: 700; color: #9CA3AF; letter-spacing: 0.8px; text-transform: uppercase;">
                            VENUE
                          </div>
                          <div style="font-size: 13px; font-weight: 700; color: #111827; margin-top: 2px; line-height: 1.4;">
                            ${safeVenue}
                          </div>
                        </td>

                        <!-- Right Column: Time & Guest -->
                        <td valign="top" style="width: 50%; padding-left: 12px;">
                          <div style="font-size: 10px; font-weight: 700; color: #9CA3AF; letter-spacing: 0.8px; text-transform: uppercase;">
                            TIME
                          </div>
                          <div style="font-size: 13px; font-weight: 700; color: #111827; margin-top: 2px; margin-bottom: 14px;">
                            ${escapeHtml(formattedTime)}
                          </div>

                          <div style="font-size: 10px; font-weight: 700; color: #9CA3AF; letter-spacing: 0.8px; text-transform: uppercase;">
                            GUEST
                          </div>
                          <div style="font-size: 13px; font-weight: 700; color: #111827; margin-top: 2px;">
                            ${safeGuestName}
                          </div>
                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>

                <!-- Perforation Notch Line matching Image 4 -->
                <tr>
                  <td style="padding: 0; background-color: #FFFFFF;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <!-- Left Cutout Notch -->
                        <td style="width: 14px; background-color: #F3F4F6; height: 26px; border-radius: 0 13px 13px 0; border: 1px solid #E5E7EB; border-left: none;"></td>
                        <!-- Dashed divider line in the center -->
                        <td valign="middle" style="padding: 0 8px;">
                          <div style="border-top: 2px dashed #D1D5DB; height: 1px; width: 100%;"></div>
                        </td>
                        <!-- Right Cutout Notch -->
                        <td style="width: 14px; background-color: #F3F4F6; height: 26px; border-radius: 13px 0 0 13px; border: 1px solid #E5E7EB; border-right: none;"></td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- QR Code & Ticket ID Section matching Image 4 -->
                <tr>
                  <td style="padding: 20px 24px; background-color: #FFFFFF;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <!-- Left: QR code image -->
                        <td valign="middle" style="width: 120px;">
                          <div style="border: 1px solid #E5E7EB; border-radius: 12px; padding: 6px; width: 110px; background-color: #FFFFFF; text-align: center;">
                            <img src="cid:ticketQrCode" alt="Ticket QR" width="110" height="110" style="width: 110px; height: 110px; display: block; border-radius: 6px;" />
                          </div>
                        </td>
                        <!-- Right: Ticket ID & Instructions -->
                        <td valign="middle" style="padding-left: 18px;">
                          <div style="font-size: 10px; font-weight: 700; color: #9CA3AF; letter-spacing: 1px; text-transform: uppercase;">
                            TICKET ID
                          </div>
                          <div style="font-family: 'Courier New', Courier, monospace; font-size: 16px; font-weight: 800; color: #111827; letter-spacing: 0.5px; margin: 4px 0 8px 0;">
                            ${safeTicketId}
                          </div>
                          <div style="font-size: 12px; color: #6B7280; line-height: 1.4;">
                            Show this QR at the entrance. One scan per ticket.
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

              </table>

              <!-- 4. Action Buttons matching Image 4 -->
              <table role="presentation" class="action-buttons" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px;">
                <tr>
                  <!-- Button 1: Add to calendar -->
                  <td align="left" style="width: 33.3%; padding-right: 4px;">
                    <a href="${calendarUrl}" target="_blank" style="display: block; background-color: #131517; color: #FFFFFF; font-size: 12px; font-weight: 700; text-decoration: none; padding: 11px 12px; border-radius: 10px; text-align: center;">
                      &#128197;&nbsp; Add to calendar
                    </a>
                  </td>
                  <!-- Button 2: Get directions -->
                  <td align="center" style="width: 33.3%; padding: 0 4px;">
                    <a href="${mapsUrl}" target="_blank" style="display: block; background-color: #FFFFFF; border: 1px solid #E5E7EB; color: #374151; font-size: 12px; font-weight: 700; text-decoration: none; padding: 11px 12px; border-radius: 10px; text-align: center;">
                      &#128205;&nbsp; Get directions
                    </a>
                  </td>
                  <!-- Button 3: Event page -->
                  <td align="right" style="width: 33.3%; padding-left: 4px;">
                    <a href="${eventPageUrl}" target="_blank" style="display: block; background-color: #FFFFFF; border: 1px solid #E5E7EB; color: #374151; font-size: 12px; font-weight: 700; text-decoration: none; padding: 11px 12px; border-radius: 10px; text-align: center;">
                      &#128279;&nbsp; Event page
                    </a>
                  </td>
                </tr>
              </table>

              <!-- 5. Good to know Card matching Image 4 -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 14px;">
                <tr>
                  <td style="padding: 16px 18px;">
                    <div style="font-size: 13px; font-weight: 700; color: #111827; margin-bottom: 8px;">
                      Good to know
                    </div>
                    <ul style="margin: 0; padding-left: 18px; font-size: 12px; line-height: 1.7; color: #4B5563;">
                      <li>Arrive a little early &mdash; check-in opens at the venue entrance.</li>
                      <li>Your ticket is also saved under <strong style="color: #111827;">My tickets</strong> when you sign in.</li>
                      <li>Questions about the event? Contact the organiser from the event page.</li>
                    </ul>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- 6. Dark Footer matching Image 4 -->
          <tr>
            <td align="center" style="background-color: #131517; padding: 28px 24px; text-align: center;">
              ${logoFooterHtml}
              <p style="margin: 12px 0 4px 0; font-size: 12px; color: #9B9EA4; line-height: 1.5;">
                Smart ticketing for college and community events.
              </p>
              <p style="margin: 0 0 14px 0; font-size: 12px;">
                <a href="${emailBaseUrl}" target="_blank" style="color: #FE760B; text-decoration: none; font-weight: 700;">ticketlelo.in</a>
              </p>
              <p style="margin: 0; font-size: 11px; color: #6B7280; line-height: 1.5;">
                You received this email because you registered for ${safeEvent} on TicketLelo.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    await transporter.sendMail({
      from: `"TicketLelo" <${process.env.SMTP_EMAIL}>`,
      to: email,
      replyTo: `"TicketLelo Support" <${process.env.SMTP_EMAIL}>`,
      subject: `Your Ticket for ${eventTitle} — ${ticketId}`,
      messageId,
      headers: {
        "Message-ID": messageId,
        "Date": new Date().toUTCString(),
        "X-Entity-Ref-ID": messageId,
        "X-Mailer": "TicketLelo Mail Engine 2.0",
        "List-Unsubscribe": `<mailto:${process.env.SMTP_EMAIL}?subject=Unsubscribe>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        "X-Auto-Response-Suppress": "OOF, AutoReply",
        "Auto-Submitted": "auto-generated",
      },
      text: textBody,
      html: htmlBody,
      attachments,
    });

    console.log(`[Email] Ticket pass successfully sent to ${email} for ticket ${ticketId}`);
    return NextResponse.json({ success: true, message: "Ticket email sent" });
  } catch (error) {
    console.error("[send-ticket-email] Delivery failed:", error);
    return NextResponse.json(
      { error: "Could not send ticket email: " + (error?.message || "Delivery failed") },
      { status: 502 },
    );
  }
}
