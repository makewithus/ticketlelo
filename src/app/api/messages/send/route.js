import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { sendEmail } from "@/lib/mailer";

export async function POST(request) {
  try {
    const { messageId } = await request.json();

    if (!messageId) {
      return NextResponse.json(
        { success: false, error: "messageId is required" },
        { status: 400 },
      );
    }

    // Get message
    const messageDoc = await adminDb
      .collection("messages")
      .doc(messageId)
      .get();
    if (!messageDoc.exists) {
      return NextResponse.json(
        { success: false, error: "Message not found" },
        { status: 404 },
      );
    }

    const message = messageDoc.data();

    // Update status to sending
    await adminDb.collection("messages").doc(messageId).update({
      status: "sending",
      updatedAt: new Date(),
    });

    // Get all registrations for the event
    const registrationsSnapshot = await adminDb
      .collection("registrations")
      .where("eventId", "==", message.eventId)
      .get();

    if (registrationsSnapshot.empty) {
      await adminDb.collection("messages").doc(messageId).update({
        status: "sent",
        recipientCount: 0,
        successCount: 0,
        failureCount: 0,
        sentAt: new Date(),
        updatedAt: new Date(),
      });

      return NextResponse.json({
        success: true,
        recipientCount: 0,
        successCount: 0,
        failureCount: 0,
        message: "No recipients found for this event",
      });
    }

    // Extract unique recipients
    const recipients = [];
    const seenEmails = new Set();

    registrationsSnapshot.forEach((doc) => {
      const reg = doc.data();
      const email = reg.formData?.email || reg.email;
      const name = reg.formData?.fullName || reg.fullName || "Participant";

      if (email && !seenEmails.has(email)) {
        seenEmails.add(email);
        recipients.push({ email, name, registrationId: doc.id });
      }
    });

    // Send emails in batches
    const batchSize = 10;
    let successCount = 0;
    let failureCount = 0;
    const failedRecipients = [];

    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);

      const results = await Promise.allSettled(
        batch.map(async (recipient) => {
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
                    <div style="background-color: #f5f5f5; padding: 25px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #FF6A00;">
                      <div style="font-size: 15px; line-height: 1.6; color: #333; white-space: pre-wrap;">${message.content}</div>
                    </div>
                    <p style="color: #666; font-size: 14px; margin-top: 30px;">
                      This is an important message from the event organizers.
                    </p>
                  </div>
                  <div style="background: #f9f9f9; padding: 20px; text-align: center; border-top: 1px solid #ddd;">
                    <p style="color: #999; font-size: 12px; margin: 0;">
                      Powered by <strong>TicketLelo</strong> - Smart Ticketing Platform
                    </p>
                  </div>
                </div>
              `,
            });

            // Create receipt
            await adminDb.collection("messageReceipts").add({
              messageId,
              recipientEmail: recipient.email,
              recipientName: recipient.name,
              status: "sent",
              sentAt: new Date(),
              createdAt: new Date(),
            });

            return { success: true, email: recipient.email };
          } catch (error) {
            console.error(`Failed to send to ${recipient.email}:`, error);

            // Create failed receipt
            await adminDb.collection("messageReceipts").add({
              messageId,
              recipientEmail: recipient.email,
              recipientName: recipient.name,
              status: "failed",
              error: error.message,
              createdAt: new Date(),
            });

            throw error;
          }
        }),
      );

      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          successCount++;
        } else {
          failureCount++;
          failedRecipients.push(batch[index].email);
        }
      });

      // Small delay between batches to avoid rate limiting
      if (i + batchSize < recipients.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Update message with results
    const finalStatus = failureCount === recipients.length ? "failed" : "sent";
    await adminDb.collection("messages").doc(messageId).update({
      status: finalStatus,
      recipientCount: recipients.length,
      successCount,
      failureCount,
      failedRecipients,
      sentAt: new Date(),
      updatedAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      recipientCount: recipients.length,
      successCount,
      failureCount,
      failedRecipients,
    });
  } catch (error) {
    console.error("Send message API error:", error);

    // Update message status to failed
    if (request.messageId) {
      await adminDb.collection("messages").doc(request.messageId).update({
        status: "failed",
        error: error.message,
        updatedAt: new Date(),
      });
    }

    return NextResponse.json(
      { success: false, error: error.message || "Failed to send message" },
      { status: 500 },
    );
  }
}
