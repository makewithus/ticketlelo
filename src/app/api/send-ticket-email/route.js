import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import path from "path";
import { getRegistrationByTicketId, getEvent } from "@/lib/firestore";
import { generatePDFTicket } from "@/lib/tickets";

/**
 * API Route: Generate PDF ticket and send it via email
 * POST /api/send-ticket-email
 * Body: { ticketId, email, fullName, eventName, password }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { ticketId, email, fullName, eventName, password } = body;

    console.log("[Ticket Email API] Request received:");
    console.log("   Email:", email);
    console.log("   Ticket ID:", ticketId);
    console.log(
      "   Password:",
      password
        ? "✅ Provided (will show credentials)"
        : "❌ Not provided (no credentials)",
    );

    if (!ticketId || !email) {
      return NextResponse.json(
        { error: "ticketId and email are required" },
        { status: 400 },
      );
    }

    // Fetch registration from Firestore
    const registration = await getRegistrationByTicketId(ticketId);
    if (!registration) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    // Fetch event details
    const event = await getEvent(registration.eventId);
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Generate PDF ticket
    const pdfBlob = await generatePDFTicket(
      registration,
      event,
      registration.qrCode,
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
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const downloadUrl = `${appUrl}/api/generate-ticket/${ticketId}`;

    // Send email with PDF attachment
    const mailOptions = {
      from: `"Ticketलेलो" <${process.env.SMTP_EMAIL}>`,
      to: email,
      subject: password
        ? `🎫 Your Entry Pass + Login Credentials - ${eventName || event.name}`
        : `🎫 Your Entry Pass for ${eventName || event.name} - Ticketलेलो`,
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
                      <h2 style="color: #000000; margin-top: 0; font-size: 24px; font-weight: 800;">Hi ${fullName || registration.fullName}!</h2>
                      
                      <p style="color: #333333; line-height: 1.8; font-size: 15px; margin-bottom: 20px;">
                        🎉 Your registration for <strong style="color: #FF6A00; font-size: 16px;">${eventName || event.name}</strong> is confirmed! 
                        Your event entry pass with QR code is attached to this email.
                      </p>
                      
                      <div style="background: linear-gradient(135deg, #FFF5E6 0%, #FFF9F0 100%); border-left: 5px solid #FF6A00; border-radius: 12px; padding: 25px; margin: 25px 0; box-shadow: 0 4px 12px rgba(254, 118, 11, 0.1);">
                        <h3 style="color: #FF6A00; margin-top: 0; font-size: 16px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">⚠️ IMPORTANT - Entry Instructions</h3>
                        <ol style="color: #333333; line-height: 2; margin: 10px 0; padding-left: 20px; font-size: 14px;">
                          <li style="margin-bottom: 8px;"><strong style="color: #000000;">Download the PDF ticket</strong> attached to this email</li>
                          <li style="margin-bottom: 8px;"><strong style="color: #000000;">Show the QR code</strong> at the entry gate</li>
                          <li style="margin-bottom: 8px;">The organizer will <strong style="color: #000000;">scan your QR code</strong> for entry</li>
                          <li><strong style="color: #000000;">QR code is valid for one-time entry only</strong></li>
                        </ol>
                      </div>
            
            ${
              password
                ? `
            <!-- Login Credentials Box - Orange to Yellow Gradient -->
            <table role="presentation" style="width: 100%; background: linear-gradient(135deg, #FF6A00 0%, #FFD60A 100%); border-radius: 15px; padding: 30px; margin: 25px 0; box-shadow: 0 8px 20px rgba(254, 118, 11, 0.3);">
              <tr>
                <td>
                  <p style="margin: 0 0 20px 0; color: #000000; font-family: 'Inter', Arial, sans-serif; font-size: 18px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    🔐 LOGIN CREDENTIALS
                  </p>
                  
                  <div style="margin-bottom: 18px;">
                    <p style="margin: 0 0 10px 0; color: #000000; font-size: 13px; font-weight: 800; opacity: 0.85; text-transform: uppercase; letter-spacing: 1px;">
                      Email
                    </p>
                    <div style="background: #000000; padding: 15px 18px; border-radius: 10px; border: 2px solid rgba(0, 0, 0, 0.2);">
                      <p style="margin: 0; color: #FFD60A; font-size: 15px; font-weight: 700; font-family: 'Courier New', monospace; word-break: break-all;">
                        ${email}
                      </p>
                    </div>
                  </div>
                  
                  <div>
                    <p style="margin: 0 0 10px 0; color: #000000; font-size: 13px; font-weight: 800; opacity: 0.85; text-transform: uppercase; letter-spacing: 1px;">
                      Password
                    </p>
                    <div style="background: #000000; padding: 15px 18px; border-radius: 10px; border: 2px solid rgba(0, 0, 0, 0.2);">
                      <p style="margin: 0; color: #FFD60A; font-size: 15px; font-weight: 700; font-family: 'Courier New', monospace;">
                        ${password}
                      </p>
                    </div>
                  </div>
                </td>
              </tr>
            </table>

            <!-- Security Notice - Black with Yellow Accents -->
            <div style="background: #000000; padding: 28px; border-radius: 15px; margin-bottom: 25px; border: 2px solid #FFD60A; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
              <p style="margin: 0 0 18px 0; color: #FFD60A; font-family: 'Inter', Arial, sans-serif; font-size: 18px; font-weight: 800; line-height: 24px; text-transform: uppercase; letter-spacing: 1px;">
                ⚠️ SECURITY NOTICE
              </p>
              <ul style="margin: 0; padding-left: 20px; color: #ffffff; font-family: 'Inter', Arial, sans-serif; font-size: 14px; font-weight: 400; line-height: 26px;">
                <li style="margin-bottom: 10px;">Save these credentials securely - you'll need them to access your dashboard</li>
                <li style="margin-bottom: 10px;">Your password can be changed anytime from your dashboard settings</li>
                <li style="margin-bottom: 10px;">Do not share these credentials with anyone</li>
                <li>Keep your password safe and secure</li>
              </ul>
            </div>
            
            <!-- CTA Button - Black with Yellow Accent -->
            <table role="presentation" style="width: 100%; margin-bottom: 20px;">
              <tr>
                <td align="center">
                  <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/user-login" 
                     style="display: inline-block; background: #000000; color: #FFD60A; text-decoration: none; padding: 20px 50px; border-radius: 12px; font-weight: 900; font-size: 15px; text-transform: uppercase; letter-spacing: 2px; box-shadow: 0 6px 20px rgba(0,0,0,0.3); border: 3px solid #FFD60A;">
                    LOGIN TO DASHBOARD →
                  </a>
                </td>
              </tr>
            </table>
            `
                : ""
            }
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
      `[Email] ✅ Ticket PDF sent to ${email} for ticket ${ticketId}`,
    );
    console.log(`[Email] Credentials included: ${password ? "YES" : "NO"}`);

    return NextResponse.json({
      success: true,
      message: "Email sent successfully",
      includesCredentials: !!password,
    });
  } catch (error) {
    console.error("Send ticket email error:", error);
    return NextResponse.json(
      { error: "Failed to send email", details: error.message },
      { status: 500 },
    );
  }
}
