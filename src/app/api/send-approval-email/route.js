import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

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
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                      
                      <!-- Success Icon -->
                      <tr>
                        <td align="center" style="padding-bottom: 30px;">
                          <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #10b981, #059669); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;">
                            <span style="font-size: 48px;">✓</span>
                          </div>
                        </td>
                      </tr>

                      <!-- Greeting -->
                      <tr>
                        <td style="padding-bottom: 20px;">
                          <h2 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold; text-align: center;">
                            ${isExisting ? "🔄 Account Updated!" : "🎉 Congratulations, " + name + "! 🎉"}
                          </h2>
                        </td>
                      </tr>

                      <!-- Message -->
                      <tr>
                        <td style="padding-bottom: 30px;">
                          <p style="margin: 0; color: #cbd5e1; font-size: 17px; line-height: 1.8; text-align: center;">
                            Your hosting request for <strong style="color: #10b981; font-size: 19px;">${eventTitle}</strong> has been <strong style="color: #10b981;">approved</strong>!<br>
                            <span style="color: #94a3b8; font-size: 15px; margin-top: 10px; display: block;">
                              ${
                                isExisting
                                  ? "Your password has been updated and event creation limit increased. Use the credentials below to login."
                                  : "You can now host your event and manage everything from the Organiser Admin Panel"
                              }
                            </span>
                          </p>
                        </td>
                      </tr>

                      <!-- Credentials Box -->
                      <tr>
                        <td style="padding-bottom: 30px;">
                          <table role="presentation" style="width: 100%; background: rgba(16, 185, 129, 0.1); border: 1px solid #10b981; border-radius: 12px; padding: 20px;">
                            <tr>
                              <td>
                                <h3 style="margin: 0 0 15px 0; color: #10b981; font-size: 18px; font-weight: bold;">
                                  📧 Your Login Credentials
                                </h3>
                                <div style="background: rgba(0, 0, 0, 0.3); padding: 15px; border-radius: 8px; margin-bottom: 10px;">
                                  <p style="margin: 0 0 5px 0; color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
                                    Email
                                  </p>
                                  <p style="margin: 0; color: #ffffff; font-size: 16px; font-weight: bold; font-family: 'Courier New', monospace;">
                                    ${organiserEmail}
                                  </p>
                                </div>
                                <div style="background: rgba(0, 0, 0, 0.3); padding: 15px; border-radius: 8px;">
                                  <p style="margin: 0 0 5px 0; color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
                                    Password
                                  </p>
                                  <p style="margin: 0; color: #ffffff; font-size: 16px; font-weight: bold; font-family: 'Courier New', monospace;">
                                    ${organiserPassword}
                                  </p>
                                </div>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>

                      <!-- Important Note -->
                      <tr>
                        <td style="padding-bottom: 30px;">
                          <div style="background: rgba(239, 68, 68, 0.15); border: 2px solid #ef4444; padding: 20px; border-radius: 10px; box-shadow: 0 4px 15px rgba(239, 68, 68, 0.2);">
                            <p style="margin: 0; color: #fca5a5; font-size: 15px; line-height: 1.7;">
                              <strong style="color: #ef4444; font-size: 16px;">🔐 Security Notice:</strong><br>
                              ${
                                isExisting
                                  ? `
                                • Your account already existed - Your <strong style="color: #ffffff;">password has been UPDATED</strong> to the new one shown above<br>
                                • Your <strong style="color: #ffffff;">old password will no longer work</strong><br>
                                • Your email remains the same: <strong style="color: #ffffff;">${organiserEmail}</strong><br>
                                • Event creation limit has been increased<br>
                              `
                                  : `
                                • Save these credentials securely - you'll need them to access the <strong style="color: #ffffff;">Organiser Admin Panel</strong><br>
                                • Your password <strong style="color: #ffffff;">cannot be changed by you</strong> - only the Super Admin can modify it<br>
                              `
                              }
                              • Do not share these credentials with anyone<br>
                              • This email redirects you to the <strong style="color: #ffffff;">Admin Panel</strong> (not user panel)
                            </p>
                          </div>
                        </td>
                      </tr>

                      <!-- Next Steps -->
                      <tr>
                        <td style="padding-bottom: 20px;">
                          <h3 style="margin: 0 0 20px 0; color: #10b981; font-size: 20px; font-weight: bold; text-align: center;">
                            🚀 Your Organiser Admin Panel Features
                          </h3>
                          <table style="width: 100%; background: rgba(16, 185, 129, 0.05); border-radius: 10px; padding: 10px;">
                            <tr>
                              <td style="padding: 12px; border-bottom: 1px solid rgba(100, 116, 139, 0.2);">
                                <span style="color: #10b981; font-weight: bold; font-size: 18px;">✓</span>
                                <span style="color: #e2e8f0; margin-left: 12px; font-size: 15px;"><strong style="color: #ffffff;">Create Events</strong> - Set up your event with all details and go live</span>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding: 12px; border-bottom: 1px solid rgba(100, 116, 139, 0.2);">
                                <span style="color: #10b981; font-weight: bold; font-size: 18px;">✓</span>
                                <span style="color: #e2e8f0; margin-left: 12px; font-size: 15px;"><strong style="color: #ffffff;">Form Generator</strong> - Design custom registration forms with payment integration</span>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding: 12px; border-bottom: 1px solid rgba(100, 116, 139, 0.2);">
                                <span style="color: #10b981; font-weight: bold; font-size: 18px;">✓</span>
                                <span style="color: #e2e8f0; margin-left: 12px; font-size: 15px;"><strong style="color: #ffffff;">Manage Registrations</strong> - Track all attendees in real-time</span>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding: 12px;">
                                <span style="color: #10b981; font-weight: bold; font-size: 18px;">✓</span>
                                <span style="color: #e2e8f0; margin-left: 12px; font-size: 15px;"><strong style="color: #ffffff;">QR Code Scanner</strong> - Verify tickets at event entry seamlessly</span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>

                      <!-- CTA Button -->
                      <tr>
                        <td align="center" style="padding: 30px 0;">
                          <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/admin/dashboard" 
                             style="display: inline-block; background: linear-gradient(135deg, #10b981, #059669); color: #ffffff; text-decoration: none; padding: 18px 50px; border-radius: 12px; font-weight: bold; font-size: 18px; box-shadow: 0 8px 25px rgba(16, 185, 129, 0.4); text-transform: uppercase; letter-spacing: 1px;">
                            🎯 Access Admin Panel →
                          </a>
                          <p style="margin: 15px 0 0 0; color: #94a3b8; font-size: 13px;">
                            Click above or login as "Organiser" on the homepage
                          </p>
                        </td>
                      </tr>

                      <!-- Footer Note -->
                      <tr>
                        <td style="padding-top: 20px; border-top: 1px solid rgba(100, 116, 139, 0.2);">
                          <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.6; text-align: center;">
                            Need help? Contact us at 
                            <a href="mailto:support@ticketlelo.com" style="color: #10b981; text-decoration: none;">support@ticketlelo.com</a>
                          </p>
                        </td>
                      </tr>

                    </table>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="padding: 30px 40px; background: rgba(0, 0, 0, 0.2); border-radius: 0 0 14px 14px;">
                    <table role="presentation" style="width: 100%;">
                      <tr>
                        <td align="center">
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
      subject: `🎉 Your Event Hosting Request is Approved! - ${eventTitle}`,
      html: htmlContent,
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
