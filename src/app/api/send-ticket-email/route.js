import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
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
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #111827; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">🎫 Ticketलेलो</h1>
            <p style="margin: 5px 0 0; opacity: 0.9; font-size: 16px;">Event Entry Pass</p>
          </div>
          
          <div style="background-color: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none;">
            <h2 style="color: #111827; margin-top: 0;">Hi ${fullName || registration.fullName}!</h2>
            
            <p style="color: #374151; line-height: 1.6;">
              🎉 Your registration for <strong style="color: #10b981;">${eventName || event.name}</strong> is confirmed! 
              Your event entry pass with QR code is attached to this email.
            </p>
            
            <div style="background-color: #fef3c7; border: 2px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 20px 0;">
              <h3 style="color: #92400e; margin-top: 0; font-size: 16px;">⚠️ IMPORTANT - Entry Instructions</h3>
              <ol style="color: #78350f; line-height: 1.8; margin: 8px 0; padding-left: 20px;">
                <li><strong>Download the PDF ticket</strong> attached to this email</li>
                <li><strong>Show the QR code</strong> at the entry gate</li>
                <li>The organizer will <strong>scan your QR code</strong> for entry</li>
                <li>QR code is <strong>valid for one-time entry only</strong></li>
              </ol>
            </div>
            
            <div style="background-color: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 20px 0;">
              <h3 style="color: #111827; margin-top: 0;">📋 Event Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Event Name:</td>
                  <td style="padding: 8px 0; color: #111827;">${eventName || event.name}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Ticket ID:</td>
                  <td style="padding: 8px 0; color: #111827; font-family: monospace;">${ticketId}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Attendee:</td>
                  <td style="padding: 8px 0; color: #111827;">${fullName || registration.fullName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Email:</td>
                  <td style="padding: 8px 0; color: #111827;">${email}</td>
                </tr>
              </table>
            </div>
            
            <div style="background-color: #dbeafe; border: 2px solid #3b82f6; border-radius: 8px; padding: 16px; margin: 20px 0;">
              <h3 style="color: #1e40af; margin-top: 0; font-size: 16px;">📎 Your Entry Pass (PDF)</h3>
              <p style="color: #1e3a8a; margin: 8px 0;">
                <strong>✅ Your PDF ticket with QR code is attached to this email.</strong>
              </p>
              <ul style="color: #1e40af; line-height: 1.8; margin: 8px 0; padding-left: 20px;">
                <li>Download and save the PDF on your phone</li>
                <li>The QR code inside will be scanned at entry</li>
                <li>Show this at the event entrance for quick entry</li>
              </ul>
              <p style="color: #6b7280; font-size: 14px; margin: 12px 0 0;">
                Backup download link: 
                <a href="${downloadUrl}" style="color: #2563eb; font-weight: bold;">Click here to download</a>
              </p>
            </div>
            
            ${
              password
                ? `
            <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 12px; padding: 30px; margin: 24px 0; box-shadow: 0 10px 40px rgba(16, 185, 129, 0.3);">
              <h2 style="color: white; margin: 0 0 20px 0; font-size: 24px; text-align: center;">
                🔐 YOUR LOGIN CREDENTIALS
              </h2>
              
              <div style="background: rgba(0, 0, 0, 0.3); border-radius: 8px; padding: 20px; margin-bottom: 16px;">
                <p style="color: rgba(255, 255, 255, 0.8); font-size: 12px; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 1px;">
                  Email / Username
                </p>
                <p style="color: white; font-size: 18px; font-family: 'Courier New', monospace; margin: 0; font-weight: bold; letter-spacing: 1px; word-break: break-all;">
                  ${email}
                </p>
              </div>
              
              <div style="background: rgba(0, 0, 0, 0.3); border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                <p style="color: rgba(255, 255, 255, 0.8); font-size: 12px; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 1px;">
                  Password
                </p>
                <p style="color: white; font-size: 18px; font-family: 'Courier New', monospace; margin: 0; font-weight: bold; letter-spacing: 3px; word-break: break-all;">
                  ${password}
                </p>
              </div>
              
              <div style="background: rgba(251, 191, 36, 0.2); border: 2px solid rgba(251, 191, 36, 0.5); border-radius: 8px; padding: 16px; margin-bottom: 20px;">
                <p style="color: #fef3c7; font-size: 14px; margin: 0; text-align: center; font-weight: bold;">
                  ⚠️ IMPORTANT: Save these credentials! You'll need them to login.
                </p>
              </div>
              
              <div style="text-align: center;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}" 
                   style="display: inline-block; background: white; color: #059669; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);">
                  🔓 Login to Your Dashboard
                </a>
              </div>
              
              <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid rgba(255, 255, 255, 0.2);">
                <p style="color: rgba(255, 255, 255, 0.9); font-size: 14px; margin: 0 0 12px 0; font-weight: bold;">
                  What you can do on your dashboard:
                </p>
                <ul style="color: rgba(255, 255, 255, 0.8); font-size: 13px; line-height: 1.8; margin: 0; padding-left: 20px;">
                  <li>✅ View all your tickets in one place</li>
                  <li>📥 Download your PDF tickets anytime</li>
                  <li>📊 Track your event registrations</li>
                  <li>👤 Update your profile information</li>
                  <li>🔑 Change your password anytime</li>
                </ul>
              </div>
            </div>
            `
                : ""
            }
          </div>
          
          <div style="background-color: #111827; color: #9ca3af; padding: 16px; border-radius: 0 0 8px 8px; text-align: center; font-size: 12px;">
            <p style="margin: 0;">© ${new Date().getFullYear()} Ticketलेलो. All rights reserved.</p>
            <p style="margin: 5px 0 0;">This is an automated email. Please do not reply.</p>
          </div>
        </div>
      `,
      attachments: [
        {
          filename: `${eventName || event.name}-EntryPass-${ticketId}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
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
