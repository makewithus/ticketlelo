import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import path from "path";

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
            <td align="center" style="padding: 40px 20px;">
              <table role="presentation" style="max-width: 600px; width: 100%; background: #ffffff; border-radius: 20px; box-shadow: 0 20px 60px rgba(254, 118, 11, 0.15); overflow: hidden;">
                
                <!-- Header -->
                <tr>
                  <td style="padding: 40px 40px 30px; text-align: center; background: #000000;">
                    <img src="cid:emailLogo" alt="Ticketलेलो" style="height: 50px; margin-bottom: 12px;" />
                    <p style="margin: 0; color: #FFD60A; font-size: 13px; letter-spacing: 2px; text-transform: uppercase; font-weight: 700;">
                      ORGANIZE EVENTS SEAMLESSLY
                    </p>
                  </td>
                </tr>
                
                <!-- Body -->
                <tr>
                  <td style="padding: 50px 40px 40px;">
                    
                    <h2 style="margin: 0 0 10px; color: #1a1a1a; font-size: 32px; font-weight: 900; text-align: center; text-transform: uppercase; letter-spacing: 0.5px;">
                      REQUEST UPDATE
                    </h2>
                    
                    <h3 style="margin: 0 0 35px; color: #FF6A00; font-size: 24px; font-weight: 800; text-align: center;">
                      ${name}
                    </h3>
                    
                    <p style="margin: 0 0 25px; color: #333333; font-size: 16px; line-height: 1.8; text-align: center;">
                      Thank you for your interest in hosting <strong style="color: #FF6A00;">"${eventTitle}"</strong> on Ticketलेलो. After careful review, we regret to inform you that your hosting request has been <strong style="color: #ef4444;">not approved</strong> at this time.
                    </p>
                    
                    <!-- Event Details Card -->
                    <table role="presentation" style="width: 100%; background: linear-gradient(135deg, rgba(254, 118, 11, 0.05) 0%, rgba(254, 223, 5, 0.05) 100%); border-radius: 15px; padding: 25px; margin: 30px 0; border-left: 5px solid #FF6A00;">
                      <tr>
                        <td>
                          <h3 style="margin: 0 0 20px; color: #FF6A00; font-size: 18px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">
                            📋 YOUR REQUEST DETAILS
                          </h3>
                          <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                              <td style="padding: 10px 0; color: #666666; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Event Title:</td>
                              <td style="padding: 10px 0; color: #1a1a1a; font-size: 15px; font-weight: 700; text-align: right;">${eventTitle}</td>
                            </tr>
                            ${
                              college
                                ? `
                            <tr>
                              <td style="padding: 10px 0; color: #666666; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Organization:</td>
                              <td style="padding: 10px 0; color: #1a1a1a; font-size: 15px; font-weight: 700; text-align: right;">${college}</td>
                            </tr>
                            `
                                : ""
                            }
                            <tr>
                              <td style="padding: 10px 0; color: #666666; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Expected Tickets:</td>
                              <td style="padding: 10px 0; color: #1a1a1a; font-size: 15px; font-weight: 700; text-align: right;">${numberOfTickets}</td>
                            </tr>
                            ${
                              eventDescription
                                ? `
                            <tr>
                              <td colspan="2" style="padding: 20px 0 8px; color: #666666; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Description:</td>
                            </tr>
                            <tr>
                              <td colspan="2" style="padding: 0; color: #333333; font-size: 14px; line-height: 1.7;">${eventDescription}</td>
                            </tr>
                            `
                                : ""
                            }
                          </table>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Rejection Reason - Dark Brown Box -->
                    <div style="background: #351E27; padding: 25px; margin: 30px 0; border-radius: 15px;">
                      <h3 style="margin: 0 0 15px; color: #FFD60A; font-family: 'Inter', Arial, sans-serif; font-size: 18px; font-weight: 500; line-height: 24px; text-transform: uppercase; letter-spacing: 0.5px;">
                        ⚠️ REASON FOR DECLINE
                      </h3>
                      <p style="margin: 0; color: #ffffff; font-family: 'Inter', Arial, sans-serif; font-size: 14px; font-weight: 400; line-height: 24px;">
                        ${rejectionReason}
                      </p>
                    </div>
                    
                    <!-- Next Steps -->
                    <table role="presentation" style="width: 100%; background: linear-gradient(135deg, rgba(53, 30, 39, 0.05) 0%, rgba(254, 118, 11, 0.05) 100%); border-radius: 15px; padding: 25px; margin: 30px 0; border-left: 5px solid #351E27;">
                      <tr>
                        <td>
                          <h3 style="margin: 0 0 15px; color: #351E27; font-size: 18px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">
                            💡 WHAT'S NEXT?
                          </h3>
                          <ul style="margin: 0; padding-left: 20px; color: #333333; font-size: 15px; line-height: 2;">
                            <li><strong>Review the feedback</strong> above and address any concerns</li>
                            <li><strong>Submit a new request</strong> with updated information</li>
                            <li><strong>Contact our support team</strong> if you have questions</li>
                          </ul>
                        </td>
                      </tr>
                    </table>
                    
                    <p style="margin: 25px 0 0; color: #666666; font-size: 15px; line-height: 1.8; text-align: center; font-style: italic;">
                      We appreciate your understanding and encourage you to reapply once you've addressed the feedback provided. Our team is here to help you succeed!
                    </p>
                  </td>
                </tr>
                
                <!-- CTA Button -->
                <tr>
                  <td style="padding: 0 40px 50px; text-align: center;">
                    <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/host-event" 
                       style="display: inline-block; background: #FFD60A; color: #000000; text-decoration: none; padding: 18px 50px; border-radius: 12px; font-weight: 900; font-size: 16px; text-transform: uppercase; letter-spacing: 1px; box-shadow: 0 6px 20px rgba(254, 223, 5, 0.4);">
                      SUBMIT NEW REQUEST →
                    </a>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="padding: 30px 40px; background: #000000; text-align: center;">
                    <img src="cid:emailLogo" alt="Ticketलेलो" style="height: 50px; margin-bottom: 8px;" />
                    <p style="margin: 0; color: #FFD60A; font-size: 11px; font-weight: 600;">
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
    `;

    // Send email
    await transporter.sendMail({
      from: `"Ticketलेलो" <${process.env.SMTP_EMAIL || "noreply@ticketlelo.com"}>`,
      to: email,
      subject: `Hosting Request Update - ${eventTitle}`,
      html: htmlContent,
      attachments: [
        {
          filename: "email_logo.png",
          path: path.join(process.cwd(), "public", "email_logo.png"),
          cid: "emailLogo",
        },
      ],
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
