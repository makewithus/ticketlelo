import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

/**
 * API Route: Send login credentials to user after successful registration
 * POST /api/send-credentials-email
 * Body: { email, fullName, password, eventName }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { email, fullName, password, eventName } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "email and password are required" },
        { status: 400 },
      );
    }

    // Configure Nodemailer transporter
    const transporter = nodemailer.createTransporter({
      service: "gmail",
      auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const loginUrl = `${appUrl}/login`;
    const dashboardUrl = `${appUrl}/dashboard`;

    // Send email with login credentials
    const mailOptions = {
      from: `"Ticketलेलो" <${process.env.SMTP_EMAIL}>`,
      to: email,
      subject: `🔐 Your Ticketलेलो Login Credentials${eventName ? ` - ${eventName}` : ""}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: Arial, sans-serif;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px 20px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: bold;">🎫 Ticketलेलो</h1>
              <p style="margin: 10px 0 0; font-size: 16px; opacity: 0.95;">Your Login Credentials</p>
            </div>
            
            <!-- Main Content -->
            <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
              
              <h2 style="color: #111827; margin-top: 0; font-size: 22px;">Welcome, ${fullName}!</h2>
              
              <p style="color: #374151; line-height: 1.6; font-size: 15px;">
                ${eventName ? `🎉 Thank you for registering for <strong style="color: #10b981;">${eventName}</strong>!<br><br>` : ""}
                Your Ticketलेलो account has been created successfully. Below are your login credentials to access your dashboard.
              </p>
              
              <!-- CREDENTIALS BOX - MOST PROMINENT -->
              <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 12px; padding: 30px; margin: 30px 0; box-shadow: 0 10px 25px rgba(16, 185, 129, 0.3);">
                <h3 style="color: white; margin: 0 0 20px 0; font-size: 20px; text-align: center; font-weight: bold;">
                  🔐 YOUR LOGIN CREDENTIALS
                </h3>
                
                <div style="background-color: rgba(255,255,255,0.25); backdrop-filter: blur(10px); border-radius: 10px; padding: 25px; margin-bottom: 15px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td>
                        <p style="color: rgba(255,255,255,0.9); margin: 0 0 8px 0; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Email / Username</p>
                        <p style="color: white; margin: 0; font-family: 'Courier New', monospace; font-size: 18px; font-weight: bold; background-color: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px; word-break: break-all;">${email}</p>
                      </td>
                    </tr>
                  </table>
                </div>
                
                <div style="background-color: rgba(255,255,255,0.25); backdrop-filter: blur(10px); border-radius: 10px; padding: 25px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td>
                        <p style="color: rgba(255,255,255,0.9); margin: 0 0 8px 0; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Password</p>
                        <p style="color: white; margin: 0; font-family: 'Courier New', monospace; font-size: 18px; font-weight: bold; background-color: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px; letter-spacing: 3px; word-break: break-all;">${password}</p>
                      </td>
                    </tr>
                  </table>
                </div>
              </div>
              
              <!-- Warning -->
              <div style="background-color: #fef3c7; border-left: 5px solid #f59e0b; padding: 20px; margin: 25px 0; border-radius: 8px;">
                <p style="color: #92400e; margin: 0; font-size: 14px; line-height: 1.6;">
                  <strong style="font-size: 16px;">⚠️ IMPORTANT:</strong><br>
                  Save these credentials in a safe place! You will need them to login to your dashboard.<br>
                  You can change your password anytime after logging in.
                </p>
              </div>
              
              <!-- Login Button -->
              <div style="text-align: center; margin: 35px 0;">
                <a href="${loginUrl}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; text-decoration: none; padding: 16px 40px; border-radius: 10px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);">
                  🔓 Login to Your Dashboard
                </a>
              </div>
              
              <!-- Features -->
              <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 20px; margin: 25px 0;">
                <h3 style="color: #111827; margin-top: 0; font-size: 16px; font-weight: bold;">📱 What You Can Do:</h3>
                <ul style="color: #374151; line-height: 1.8; margin: 10px 0; padding-left: 25px;">
                  <li><strong>View all your event tickets</strong> in one place</li>
                  <li><strong>Download tickets as PDF</strong> with QR codes</li>
                  <li><strong>Track ticket usage</strong> and status</li>
                  <li><strong>Update your profile</strong> information</li>
                  <li><strong>Change your password</strong> anytime</li>
                </ul>
              </div>
              
              <!-- Quick Links -->
              <div style="background-color: #eff6ff; border: 1px solid #dbeafe; border-radius: 10px; padding: 20px; margin: 25px 0;">
                <h3 style="color: #1e40af; margin-top: 0; font-size: 16px; font-weight: bold;">🎫 Quick Links</h3>
                <p style="margin: 10px 0;">
                  <a href="${loginUrl}" style="color: #10b981; text-decoration: none; font-weight: bold; font-size: 15px;">🔐 Sign In</a>
                </p>
                <p style="margin: 10px 0;">
                  <a href="${dashboardUrl}" style="color: #10b981; text-decoration: none; font-weight: bold; font-size: 15px;">📊 My Dashboard</a>
                </p>
                <p style="margin: 10px 0;">
                  <a href="${appUrl}" style="color: #10b981; text-decoration: none; font-weight: bold; font-size: 15px;">🎉 Browse Events</a>
                </p>
              </div>
              
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
              
              <p style="color: #6b7280; font-size: 13px; line-height: 1.6;">
                If you didn't create this account, please ignore this email or contact our support team.
              </p>
              
              <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
                Best regards,<br />
                <strong style="color: #111827;">Team Ticketलेलो</strong>
              </p>
            </div>
            
            <!-- Footer -->
            <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
              <p style="margin: 5px 0;">© 2026 Ticketलेलो. All rights reserved.</p>
              <p style="margin: 5px 0;">This is an automated email. Please do not reply.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    await transporter.sendMail(mailOptions);

    console.log("✅ Credentials email sent successfully to:", email);

    return NextResponse.json({
      success: true,
      message: "Credentials email sent successfully",
    });
  } catch (error) {
    console.error("❌ Error sending credentials email:", error);
    return NextResponse.json(
      { error: "Failed to send credentials email", details: error.message },
      { status: 500 },
    );
  }
}
