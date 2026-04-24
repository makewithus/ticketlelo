import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { sendEmail } from "@/lib/mailer";

/**
 * Email Reminders Cron Job
 *
 * This endpoint is designed to be called by a cron service (e.g., Vercel Cron Jobs)
 * every 30 minutes to process:
 * 1. 1-day before event reminders
 * 2. 2-hour before event reminders
 * 3. Scheduled broadcast messages
 *
 * Add this to vercel.json:
 * {
 *   "crons": [{ "path": "/api/cron/process-reminders", "schedule": "0,30 * * * *" }]
 * }
 */

const REMINDER_TYPES = {
  ONE_DAY: "oneDay",
  TWO_HOUR: "twoHour",
};

export async function GET(request) {
  try {
    // Verify this is called by a cron service (security)
    const authHeader = request.headers.get("authorization");
    if (
      process.env.CRON_SECRET &&
      authHeader !== `Bearer ${process.env.CRON_SECRET}`
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    let processed = 0;
    let errors = 0;
    const log = [];

    // ======= 1. Process 1-day reminders =======
    const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const oneDayWindowStart = new Date(
      oneDayFromNow.getTime() - 30 * 60 * 1000,
    );
    const oneDayWindowEnd = new Date(oneDayFromNow.getTime() + 30 * 60 * 1000);

    const oneDayEventsSnapshot = await adminDb
      .collection("events")
      .where("isActive", "==", true)
      .where("date", ">=", oneDayWindowStart)
      .where("date", "<=", oneDayWindowEnd)
      .get();

    for (const eventDoc of oneDayEventsSnapshot.docs) {
      const event = eventDoc.data();
      const result = await processEventReminder(event, REMINDER_TYPES.ONE_DAY);
      if (result.success) {
        processed += result.count;
        log.push(`[1-DAY] Event "${event.name}": ${result.count} emails sent`);
      } else {
        errors++;
        log.push(`[1-DAY] Event "${event.name}": FAILED - ${result.error}`);
      }
    }

    // ======= 2. Process 2-hour reminders =======
    const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const twoHourWindowStart = new Date(
      twoHoursFromNow.getTime() - 30 * 60 * 1000,
    );
    const twoHourWindowEnd = new Date(
      twoHoursFromNow.getTime() + 30 * 60 * 1000,
    );

    const twoHourEventsSnapshot = await adminDb
      .collection("events")
      .where("isActive", "==", true)
      .where("date", ">=", twoHourWindowStart)
      .where("date", "<=", twoHourWindowEnd)
      .get();

    for (const eventDoc of twoHourEventsSnapshot.docs) {
      const event = eventDoc.data();
      const result = await processEventReminder(event, REMINDER_TYPES.TWO_HOUR);
      if (result.success) {
        processed += result.count;
        log.push(`[2-HOUR] Event "${event.name}": ${result.count} emails sent`);
      } else {
        errors++;
        log.push(`[2-HOUR] Event "${event.name}": FAILED - ${result.error}`);
      }
    }

    // ======= 3. Process scheduled broadcast messages =======
    const scheduledMessagesSnapshot = await adminDb
      .collection("messages")
      .where("status", "==", "scheduled")
      .where("scheduledAt", "<=", now)
      .limit(50)
      .get();

    for (const msgDoc of scheduledMessagesSnapshot.docs) {
      const message = msgDoc.data();
      try {
        // Trigger send via the send API
        await processScheduledMessage(msgDoc.id, message);
        log.push(`[MSG] Sent scheduled message "${message.title}"`);
        processed++;
      } catch (error) {
        errors++;
        log.push(`[MSG] Failed: "${message.title}" - ${error.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      processed,
      errors,
      log,
    });
  } catch (error) {
    console.error("Cron job error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

/**
 * Process event reminders for all participants
 */
async function processEventReminder(event, reminderType) {
  const dedupeKey = `${event.id}_${reminderType}`;

  try {
    // Check if reminder already sent (deduplication)
    const existingJobSnapshot = await adminDb
      .collection("scheduledJobs")
      .where(
        "type",
        "==",
        reminderType === REMINDER_TYPES.ONE_DAY
          ? "eventReminder1Day"
          : "eventReminder2Hour",
      )
      .where("eventId", "==", event.id)
      .where("status", "in", ["completed", "processing"])
      .limit(1)
      .get();

    if (!existingJobSnapshot.empty) {
      return { success: true, count: 0, skipped: true };
    }

    // Create job record to prevent duplicates
    const jobRef = adminDb.collection("scheduledJobs").doc();
    await jobRef.set({
      id: jobRef.id,
      type:
        reminderType === REMINDER_TYPES.ONE_DAY
          ? "eventReminder1Day"
          : "eventReminder2Hour",
      eventId: event.id,
      status: "processing",
      recipientCount: 0,
      createdAt: new Date(),
      scheduledFor: new Date(),
    });

    // Get all registrations for this event
    const registrationsSnapshot = await adminDb
      .collection("registrations")
      .where("eventId", "==", event.id)
      .get();

    if (registrationsSnapshot.empty) {
      await jobRef.update({ status: "completed", recipientCount: 0 });
      return { success: true, count: 0 };
    }

    const recipients = [];
    const seenEmails = new Set();

    registrationsSnapshot.forEach((doc) => {
      const reg = doc.data();
      const email = reg.formData?.email || reg.email;
      const name = reg.formData?.fullName || reg.fullName || "Participant";

      if (email && !seenEmails.has(email)) {
        seenEmails.add(email);
        recipients.push({
          email,
          name,
          ticketId: reg.ticketId,
          registrationId: doc.id,
        });
      }
    });

    // Format event date
    const eventDate = event.date?.toDate
      ? event.date.toDate()
      : new Date(event.date);
    const formattedDate = eventDate.toLocaleDateString("en-IN", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const formattedTime = eventDate.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const reminderLabel =
      reminderType === REMINDER_TYPES.ONE_DAY ? "Tomorrow" : "In 2 Hours";
    const urgencyColor =
      reminderType === REMINDER_TYPES.ONE_DAY ? "#FF6A00" : "#e53e3e";

    let successCount = 0;
    const batchSize = 10;

    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(async (recipient) => {
          return sendEmail({
            to: recipient.email,
            subject: `🎟 Reminder: ${event.name} is ${reminderLabel}!`,
            html: buildReminderEmailHtml({
              recipientName: recipient.name,
              eventName: event.name,
              eventDate: formattedDate,
              eventTime: formattedTime,
              eventLocation: event.location || "TBA",
              ticketId: recipient.ticketId,
              reminderLabel,
              urgencyColor,
            }),
          });
        }),
      );

      results.forEach((result) => {
        if (result.status === "fulfilled") successCount++;
      });

      if (i + batchSize < recipients.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Mark job as completed
    await jobRef.update({
      status: "completed",
      recipientCount: successCount,
      processedAt: new Date(),
    });

    return { success: true, count: successCount };
  } catch (error) {
    console.error(`Event reminder error for ${event.id}:`, error);
    return { success: false, error: error.message, count: 0 };
  }
}

/**
 * Process a scheduled broadcast message
 */
async function processScheduledMessage(messageId, message) {
  // Mark as sending
  await adminDb.collection("messages").doc(messageId).update({
    status: "sending",
    updatedAt: new Date(),
  });

  const registrationsSnapshot = await adminDb
    .collection("registrations")
    .where("eventId", "==", message.eventId)
    .get();

  const recipients = [];
  const seenEmails = new Set();

  registrationsSnapshot.forEach((doc) => {
    const reg = doc.data();
    const email = reg.formData?.email || reg.email;
    const name = reg.formData?.fullName || reg.fullName || "Participant";

    if (email && !seenEmails.has(email)) {
      seenEmails.add(email);
      recipients.push({ email, name });
    }
  });

  let successCount = 0;
  let failureCount = 0;
  const failedRecipients = [];

  for (const recipient of recipients) {
    try {
      await sendEmail({
        to: recipient.email,
        subject: message.title,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #FF6A00 0%, #FFD60A 100%); padding: 30px; text-align: center;">
              <h1 style="color: #000; margin: 0; font-size: 28px;">Event Update</h1>
            </div>
            <div style="padding: 30px; background: #fff;">
              <p style="font-size: 16px; color: #333;">Hello ${recipient.name},</p>
              <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; border-left: 4px solid #FF6A00;">
                <div style="font-size: 15px; line-height: 1.6; color: #333; white-space: pre-wrap;">${message.content}</div>
              </div>
            </div>
            <div style="background: #f9f9f9; padding: 15px; text-align: center;">
              <p style="color: #999; font-size: 12px; margin: 0;">Powered by TicketLelo</p>
            </div>
          </div>
        `,
      });
      successCount++;
    } catch {
      failureCount++;
      failedRecipients.push(recipient.email);
    }
  }

  await adminDb
    .collection("messages")
    .doc(messageId)
    .update({
      status:
        failureCount === recipients.length && recipients.length > 0
          ? "failed"
          : "sent",
      recipientCount: recipients.length,
      successCount,
      failureCount,
      failedRecipients,
      sentAt: new Date(),
      updatedAt: new Date(),
    });
}

/**
 * Build HTML for reminder email
 */
function buildReminderEmailHtml({
  recipientName,
  eventName,
  eventDate,
  eventTime,
  eventLocation,
  ticketId,
  reminderLabel,
  urgencyColor,
}) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: Arial, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #FF6A00 0%, #FFD60A 100%); padding: 30px; text-align: center;">
          <h1 style="color: #000; margin: 0; font-size: 28px; font-weight: bold;">TicketLelo</h1>
          <p style="color: #000; margin: 5px 0 0; font-size: 14px; opacity: 0.8;">Smart Ticketing Platform</p>
        </div>
        
        <!-- Urgency Banner -->
        <div style="background-color: ${urgencyColor}; padding: 12px; text-align: center;">
          <p style="color: white; margin: 0; font-size: 16px; font-weight: bold;">
            ⏰ Your event is ${reminderLabel}!
          </p>
        </div>
        
        <!-- Content -->
        <div style="padding: 35px 30px;">
          <p style="font-size: 18px; color: #333; margin-top: 0;">
            Hello <strong>${recipientName}</strong>,
          </p>
          <p style="font-size: 15px; color: #555; line-height: 1.6;">
            This is a friendly reminder that you have a ticket for:
          </p>
          
          <!-- Event Card -->
          <div style="background: #f8f9fa; border-radius: 12px; padding: 25px; margin: 25px 0; border-left: 5px solid ${urgencyColor};">
            <h2 style="color: #1a1a1a; margin: 0 0 15px; font-size: 22px;">${eventName}</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; vertical-align: top;">
                  <span style="color: #888; font-size: 13px;">📅 Date</span>
                  <br>
                  <strong style="color: #333; font-size: 14px;">${eventDate}</strong>
                </td>
                <td style="padding: 6px 0; vertical-align: top;">
                  <span style="color: #888; font-size: 13px;">🕐 Time</span>
                  <br>
                  <strong style="color: #333; font-size: 14px;">${eventTime}</strong>
                </td>
              </tr>
              <tr>
                <td colspan="2" style="padding: 10px 0 0;">
                  <span style="color: #888; font-size: 13px;">📍 Location</span>
                  <br>
                  <strong style="color: #333; font-size: 14px;">${eventLocation}</strong>
                </td>
              </tr>
            </table>
          </div>
          
          <!-- Ticket Info -->
          ${
            ticketId
              ? `
          <div style="background: #fff3e0; border: 1px solid #ffb74d; border-radius: 8px; padding: 15px; text-align: center;">
            <p style="margin: 0 0 5px; color: #888; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Your Ticket ID</p>
            <p style="margin: 0; font-size: 18px; font-weight: bold; color: #e65100; letter-spacing: 2px; font-family: monospace;">
              ${ticketId.slice(-10).toUpperCase()}
            </p>
          </div>
          `
              : ""
          }
          
          <p style="font-size: 14px; color: #555; margin-top: 25px; line-height: 1.6;">
            Please ensure you have your QR code ticket ready for entry. Your ticket was sent to you via email when you registered.
          </p>
        </div>
        
        <!-- Footer -->
        <div style="background: #f9f9f9; padding: 20px 30px; border-top: 1px solid #eee; text-align: center;">
          <p style="color: #999; font-size: 12px; margin: 0;">
            Powered by <strong>TicketLelo</strong> · Smart Ticketing for India
          </p>
          <p style="color: #bbb; font-size: 11px; margin: 5px 0 0;">
            www.ticketlelo.in
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}
