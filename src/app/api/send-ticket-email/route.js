import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import path from "path";
import { generatePDFTicket } from "@/lib/tickets";
import { getAppBaseUrl } from "@/lib/app-url";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { adminDb } from "@/lib/firebase-admin";

const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char]));

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
    if (!caller) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    if (!ticketId || !adminDb) {
      return NextResponse.json(
        { error: "ticketId is required" },
        { status: 400 },
      );
    }

    const ticketSnapshot = await adminDb.collection("tickets").doc(ticketId).get();
    const registrationSnapshot = await adminDb.collection("registrations")
      .where("ticketId", "==", ticketId).limit(1).get();
    if (!ticketSnapshot.exists && registrationSnapshot.empty) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }
    const persistedTicket = ticketSnapshot.exists ? ticketSnapshot.data() : null;
    const registration = registrationSnapshot.empty
      ? persistedTicket
      : { id: registrationSnapshot.docs[0].id, ...registrationSnapshot.docs[0].data() };
    const ownerUid = registration.userId || persistedTicket?.userId;
    const ownerEmail = String(registration.email || registration.buyerEmail || persistedTicket?.buyerEmail || "").toLowerCase();
    const callerEmail = String(caller.email || "").toLowerCase();
    const isOwner = (ownerUid && ownerUid === caller.uid) ||
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

    // Generate PDF ticket
    const pdfBlob = await generatePDFTicket(
      { ...registration, ticketId, qrCode: registration.qrCode || persistedTicket?.qrCodeUrl || "" },
      event,
      registration.qrCode || persistedTicket?.qrCodeUrl,
    );

    // Convert blob to Buffer
    const pdfArrayBuffer = await pdfBlob.arrayBuffer();
    const pdfBuffer = Buffer.from(pdfArrayBuffer);

    // Configure Nodemailer transporter
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    // Build the download link as a fallback
    const appUrl = getAppBaseUrl();
    const downloadUrl = `${appUrl}/api/generate-ticket/${ticketId}`;

    // Send email with PDF attachment
    const mailOptions = {
      from: `"Ticketलेलो" <${process.env.SMTP_EMAIL}>`,
      to: email,
      subject: `Your Entry Pass for ${event.name || event.title || "Event"} - Ticketलेलो`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            @media print {
              * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
              body { background-color: #f5f5f5 !important; margin: 0 !important; padding: 0 !important; }
              table { border-collapse: collapse !important; }
              img { max-width: 100% !important; }
            }
          </style>
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Arial', sans-serif; background-color: #f5f5f5;">
          <table role="presentation" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td align="center" style="padding: 20px;">
                <table role="presentation" style="max-width: 600px; width: 100%; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.15);">
                  
                  <!-- Black Header -->
                  <tr>
                    <td style="padding: 35px 30px; text-align: center; background: #000000;">
                      <img src="cid:emailLogo" alt="Ticketलेलो" style="height: 60px; margin-bottom: 15px;" />
                      <p style="margin: 0; color: #FFD60A; font-size: 13px; letter-spacing: 3px; font-weight: 800; text-transform: uppercase;">
                        EVENT ENTRY PASS
                      </p>
                    </td>
                  </tr>
          
                  <!-- Body -->
                  <tr>
                    <td style="background-color: #ffffff; padding: 35px 30px;">
                      <h2 style="color: #000000; margin-top: 0; font-size: 24px; font-weight: 800;">Hi ${escapeHtml(registration.fullName || registration.buyerName || "Attendee")}!</h2>
                      
                      <p style="color: #333333; line-height: 1.8; font-size: 15px; margin-bottom: 20px;">
                         Your registration for <strong style="color: #FF6A00; font-size: 16px;">${escapeHtml(event.name || event.title || "Event")}</strong> is confirmed! 
                        Your event entry pass with QR code is attached to this email.
                      </p>
                      
                      <div style="background: linear-gradient(135deg, #FFF5E6 0%, #FFF9F0 100%); border-left: 5px solid #FF6A00; border-radius: 12px; padding: 25px; margin: 25px 0; box-shadow: 0 4px 12px rgba(254, 118, 11, 0.1);">
                        <h3 style="color: #FF6A00; margin-top: 0; font-size: 16px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;"> IMPORTANT - Entry Instructions</h3>
                        <ol style="color: #333333; line-height: 2; margin: 10px 0; padding-left: 20px; font-size: 14px;">
                          <li style="margin-bottom: 8px;"><strong style="color: #000000;">Download the PDF ticket</strong> attached to this email</li>
                          <li style="margin-bottom: 8px;"><strong style="color: #000000;">Show the QR code</strong> at the entry gate</li>
                          <li style="margin-bottom: 8px;">The organizer will <strong style="color: #000000;">scan your QR code</strong> for entry</li>
                          <li><strong style="color: #000000;">QR code is valid for one-time entry only</strong></li>
                        </ol>
                      </div>
            
                    </td>
                  </tr>
                  
                  <!-- Black Footer -->
                  <tr>
                    <td style="padding: 30px; background: #000000; text-align: center;">
                      <img src="cid:emailLogo" alt="Ticketलेलो" style="height: 70px; margin-bottom: 10px;" />
                      <p style="margin: 0; color: #FFD60A; font-size: 12px; font-weight: 700; letter-spacing: 1px;">
                        ticketlelo.in
                      </p>
                    </td>
                  </tr>
                  
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
      attachments: [
        {
          filename: `${eventName || event.name}-EntryPass-${ticketId}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
        {
          filename: "email_logo.png",
          path: path.join(process.cwd(), "public", "email_logo.png"),
          cid: "emailLogo",
        },
      ],
    };

    await transporter.sendMail(mailOptions);

    console.log(
      `[Email]  Ticket PDF sent to ${email} for ticket ${ticketId}`,
    );
    return NextResponse.json({
      success: true,
      message: "Email sent successfully",
    });
  } catch (error) {
    console.error("Send ticket email error:", error);
    return NextResponse.json(
      { error: "Failed to send email", details: error.message },
      { status: 500 },
    );
  }
}
