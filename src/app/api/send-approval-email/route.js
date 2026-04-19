import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import path from "path";
import fs from "fs";

export async function POST(request) {
  try {
    const {
      name,
      email,
      eventTitle,
      organiserEmail,
      organiserPassword,
      isExisting,
    } = await request.json();

    // Check if SMTP credentials are configured
    if (!process.env.SMTP_EMAIL || !process.env.SMTP_PASSWORD) {
      console.log(
        "📧 SMTP not configured. Approval email would be sent to:",
        email,
      );
      console.log("Event:", eventTitle);
      console.log(
        "Credentials - Email:",
        organiserEmail,
        "Password:",
        organiserPassword,
      );
      console.log("Is Existing:", isExisting);

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
        <title>Hosting Request Approved!</title>
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
              <table role="presentation" style="max-width: 600px; width: 100%; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.1);">
                
                <!-- Header with Black Background -->
                <tr>
                  <td style="padding: 40px 30px; text-align: center; background: #000000;">
                    <img src="cid:emailLogo" alt="Ticketलेलो" style="height: 80px; margin-bottom: 12px;" />
                    <p style="margin: 8px 0 0; color: #FFFFFF; font-size: 12px; letter-spacing: 2px; font-weight: 600; text-transform: uppercase;">
                      ORGANIZE EVENTS SEAMLESSLY
                    </p>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding: 50px 40px;">
                    
                    <!-- Main Heading -->
                    <h2 style="margin: 0 0 10px 0; color: #000000; font-size: 26px; font-weight: 900; text-align: center;">
                      CONGRATULATIONS
                    </h2>
                    <h3 style="margin: 0 0 10px 0; color: #FE760B; font-size: 22px; font-weight: 800; text-align: center; text-transform: uppercase;">
                      ${name}!
                    </h3>
                    
                    <!-- Message -->
                    <p style="margin: 0 0 40px 0; color: #666666; font-size: 15px; line-height: 1.8; text-align: center;">
                      YOUR HOSTING REQUEST FOR
                      <br/>
                      <strong style="color: #000000; font-size: 17px;">${eventTitle}</strong>
                      <br/>
                      HAS BEEN <strong style="color: #FE760B;">APPROVED</strong>
                    </p>

                    <!-- Credentials Box - Orange -->
                    <table role="presentation" style="width: 100%; background: #FE760B; border-radius: 15px; padding: 25px; margin-bottom: 25px;">
                      <tr>
                        <td>
                          <p style="margin: 0 0 20px 0; color: #ffffff; font-size: 16px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">
                            🔐 LOGIN CREDENTIALS
                          </p>
                          
                          <div style="margin-bottom: 15px;">
                            <p style="margin: 0 0 8px 0; color: #ffffff; font-size: 13px; font-weight: 700; opacity: 0.9;">
                              Email
                            </p>
                            <div style="background: rgba(255, 255, 255, 0.15); padding: 12px 15px; border-radius: 8px; border: 2px solid rgba(255, 255, 255, 0.3);">
                              <p style="margin: 0; color: #ffffff; font-size: 15px; font-weight: 700; font-family: 'Courier New', monospace;">
                                ${organiserEmail}
                              </p>
                            </div>
                          </div>
                          
                          <div>
                            <p style="margin: 0 0 8px 0; color: #ffffff; font-size: 13px; font-weight: 700; opacity: 0.9;">
                              Password
                            </p>
                            <div style="background: rgba(255, 255, 255, 0.15); padding: 12px 15px; border-radius: 8px; border: 2px solid rgba(255, 255, 255, 0.3);">
                              <p style="margin: 0; color: #ffffff; font-size: 15px; font-weight: 700; font-family: 'Courier New', monospace;">
                                ${organiserPassword}
                              </p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    </table>

                    <!-- Security Notice - Dark Brown/Black -->
                    <div style="background: #351E27; padding: 25px; border-radius: 15px; margin-bottom: 30px;">
                      <p style="margin: 0 0 15px 0; color: #FEDF05; font-family: 'Inter', Arial, sans-serif; font-size: 18px; font-weight: 500; line-height: 24px; text-transform: uppercase; letter-spacing: 0.5px;">
                        ⚠️ SECURITY NOTICE
                      </p>
                      <ul style="margin: 0; padding-left: 20px; color: #ffffff; font-family: 'Inter', Arial, sans-serif; font-size: 14px; font-weight: 400; line-height: 24px;">
                        ${
                          isExisting
                            ? `
                          <li style="margin-bottom: 8px;">Your password has been <strong>UPDATED</strong> to the one shown above</li>
                          <li style="margin-bottom: 8px;">Your old password will <strong>no longer work</strong></li>
                          <li style="margin-bottom: 8px;">Please use the new credentials for all future logins</li>
                          <li style="margin-bottom: 8px;">Do not share these credentials with anyone</li>
                        `
                            : `
                          <li style="margin-bottom: 8px;">Save these credentials securely - you'll need them to access the <strong>Organiser Admin Panel</strong></li>
                          <li style="margin-bottom: 8px;">Your password can only be changed by the Super Admin</li>
                          <li style="margin-bottom: 8px;">Do not share these credentials with anyone</li>
                          <li style="margin-bottom: 8px;">Keep your password safe and secure</li>
                        `
                        }
                      </ul>
                    </div>

                    <!-- CTA Button - Yellow -->
                    <table role="presentation" style="width: 100%; margin-bottom: 20px;">
                      <tr>
                        <td align="center">
                          <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/organiser-login" 
                             style="display: inline-block; background: #FEDF05; color: #000000; text-decoration: none; padding: 18px 40px; border-radius: 12px; font-weight: 900; font-size: 15px; text-transform: uppercase; letter-spacing: 1.5px; box-shadow: 0 4px 15px rgba(254, 223, 5, 0.4);">
                            LOGIN TO ADMIN PANEL →
                          </a>
                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>

                <!-- Footer with Branding -->
                <tr>
                  <td style="padding: 30px 40px; background: #000000; text-align: center;">
                    <img src="cid:emailLogo" alt="Ticketलेलो" style="height: 80px; margin-bottom: 8px;" />
                    <p style="margin: 0; color: #FFFFFF; font-size: 11px; font-weight: 600;">
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
      subject: `🎉 Your Event Hosting Request is Approved! - ${eventTitle}`,
      html: htmlContent,
      attachments: [
        {
          filename: "email_logo.png",
          path: path.join(process.cwd(), "public", "email_logo.png"),
          cid: "emailLogo",
        },
      ],
    });

    console.log("Approval email sent successfully to:", email);
    return NextResponse.json({
      success: true,
      message: "Email sent successfully",
    });
  } catch (error) {
    console.error("Error sending approval email:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
