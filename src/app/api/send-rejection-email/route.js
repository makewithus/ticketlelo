import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(request) {
  try {
    const {
      name,
      email,
      eventTitle,
      eventDescription,
      rejectionReason,
      numberOfTickets,
      college,
    } = await request.json();

    // Check if SMTP credentials are configured
    if (!process.env.SMTP_EMAIL || !process.env.SMTP_PASSWORD) {
      console.log("📧 SMTP not configured. Email would be sent to:", email);
      console.log("Event:", eventTitle);
      console.log("Reason:", rejectionReason);

      return NextResponse.json({
        success: true,
        message: "Email logged (SMTP not configured)",
      });
    }

    // Create nodemailer transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    // Create styled HTML email
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Hosting Request Update</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Arial', sans-serif; background-color: #0a0c1c;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td align="center" style="padding: 40px 20px;">
              <table role="presentation" style="max-width: 600px; width: 100%; background: linear-gradient(135deg, #1a1d2e 0%, #0f1117 100%); border-radius: 16px; border: 2px solid #10b981; box-shadow: 0 20px 60px rgba(16, 185, 129, 0.2);">
                
                <!-- Header -->
                <tr>
                  <td style="padding: 40px 40px 30px; text-align: center; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 14px 14px 0 0;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: bold; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                      Ticketलेलो
                    </h1>
                    <p style="margin: 8px 0 0; color: #d1fae5; font-size: 14px; letter-spacing: 1px;">
                      Event Hosting Platform
                    </p>
                  </td>
                </tr>
                
                <!-- Body -->
                <tr>
                  <td style="padding: 40px;">
                    
                    <!-- Icon Section -->
                    <div style="text-align: center; padding-bottom: 25px;">
                      <div style="width: 80px; height: 80px; background: rgba(248, 113, 113, 0.2); border: 3px solid #f87171; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin: 0 auto;">
                        <span style="font-size: 40px;">📋</span>
                      </div>
                    </div>
                    
                    <h2 style="margin: 0 0 25px; color: #ffffff; font-size: 26px; font-weight: bold; text-align: center;">
                      Request Update Notification
                    </h2>
                    
                    <p style="margin: 0 0 20px; color: #e2e8f0; font-size: 16px; line-height: 1.6;">
                      Dear <strong style="color: #10b981;">${name}</strong>,
                    </p>
                    
                    <p style="margin: 0 0 25px; color: #cbd5e1; font-size: 16px; line-height: 1.8;">
                      Thank you for your interest in hosting <strong style="color: #ffffff;">"${eventTitle}"</strong> on Ticketलेलो. After careful review, we regret to inform you that your hosting request has been <strong style="color: #f87171;">not approved</strong> at this time.
                    </p>
                    
                    <p style="margin: 0 0 30px; color: #94a3b8; font-size: 15px; line-height: 1.7; font-style: italic; text-align: center; padding: 15px; background: rgba(16, 185, 129, 0.05); border-radius: 8px;">
                      💡 Don't worry! We encourage you to review the feedback and reapply. We're here to help you succeed!
                    </p>
                    
                    <!-- Event Details Card -->
                    <div style="background: rgba(16, 185, 129, 0.1); border-left: 4px solid #10b981; padding: 20px; margin: 25px 0; border-radius: 8px;">
                      <h3 style="margin: 0 0 15px; color: #10b981; font-size: 18px; font-weight: bold;">
                        📋 Your Request Details
                      </h3>
                      <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                          <td style="padding: 6px 0; color: #94a3b8; font-size: 14px;">Event Title:</td>
                          <td style="padding: 6px 0; color: #ffffff; font-size: 14px; font-weight: bold; text-align: right;">${eventTitle}</td>
                        </tr>
                        ${
                          college
                            ? `
                        <tr>
                          <td style="padding: 6px 0; color: #94a3b8; font-size: 14px;">Organization:</td>
                          <td style="padding: 6px 0; color: #ffffff; font-size: 14px; text-align: right;">${college}</td>
                        </tr>
                        `
                            : ""
                        }
                        <tr>
                          <td style="padding: 6px 0; color: #94a3b8; font-size: 14px;">Expected Tickets:</td>
                          <td style="padding: 6px 0; color: #ffffff; font-size: 14px; text-align: right;">${numberOfTickets}</td>
                        </tr>
                        ${
                          eventDescription
                            ? `
                        <tr>
                          <td colspan="2" style="padding: 12px 0 0; color: #94a3b8; font-size: 14px;">Description:</td>
                        </tr>
                        <tr>
                          <td colspan="2" style="padding: 6px 0; color: #e2e8f0; font-size: 14px; line-height: 1.5;">${eventDescription}</td>
                        </tr>
                        `
                            : ""
                        }
                      </table>
                    </div>
                    
                    <!-- Rejection Reason -->
                    <div style="background: rgba(248, 113, 113, 0.1); border-left: 4px solid #f87171; padding: 20px; margin: 25px 0; border-radius: 8px;">
                      <h3 style="margin: 0 0 12px; color: #f87171; font-size: 16px; font-weight: bold;">
                        ⚠️ Reason for Decline
                      </h3>
                      <p style="margin: 0; color: #e2e8f0; font-size: 15px; line-height: 1.6;">
                        ${rejectionReason}
                      </p>
                    </div>
                    
                    <!-- Next Steps -->
                    <div style="background: rgba(59, 130, 246, 0.1); border-left: 4px solid #3b82f6; padding: 20px; margin: 25px 0; border-radius: 8px;">
                      <h3 style="margin: 0 0 12px; color: #60a5fa; font-size: 16px; font-weight: bold;">
                        💡 What's Next?
                      </h3>
                      <ul style="margin: 0; padding-left: 20px; color: #e2e8f0; font-size: 14px; line-height: 1.8;">
                        <li>Review the feedback above and address any concerns</li>
                        <li>Submit a new hosting request with updated information</li>
                        <li>Contact our support team if you have questions</li>
                      </ul>
                    </div>
                    
                    <p style="margin: 20px 0 0; color: #e2e8f0; font-size: 16px; line-height: 1.6;">
                      We appreciate your understanding and encourage you to reapply once you've addressed the feedback provided. Our team is here to help you succeed!
                    </p>
                  </td>
                </tr>
                
                <!-- CTA Button -->
                <tr>
                  <td style="padding: 0 40px 40px; text-align: center;">
                    <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}" 
                       style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 10px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4);">
                      Submit New Request
                    </a>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="padding: 30px 40px; background: #0a0c1c; border-radius: 0 0 14px 14px; border-top: 1px solid rgba(16, 185, 129, 0.2);">
                    <table style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="text-align: center; padding-bottom: 15px;">
                          <p style="margin: 0; color: #10b981; font-size: 20px; font-weight: bold;">
                            Ticketलेलो
                          </p>
                          <p style="margin: 5px 0 0; color: #64748b; font-size: 12px;">
                            Seamless Event Management & Ticketing
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="text-align: center; padding-top: 15px; border-top: 1px solid rgba(100, 116, 139, 0.2);">
                          <p style="margin: 0; color: #64748b; font-size: 12px; line-height: 1.6;">
                            © ${new Date().getFullYear()} Ticketलेलो. All rights reserved.<br>
                            <a href="mailto:support@ticketlelo.com" style="color: #10b981; text-decoration: none;">support@ticketlelo.com</a>
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    // Send email
    await transporter.sendMail({
      from: `"Ticketलेलो" <${process.env.SMTP_EMAIL || "noreply@ticketlelo.com"}>`,
      to: email,
      subject: `Hosting Request Update - ${eventTitle}`,
      html: htmlContent,
    });

    console.log("Rejection email sent successfully to:", email);
    return NextResponse.json({
      success: true,
      message: "Email sent successfully",
    });
  } catch (error) {
    console.error("Error sending rejection email:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
