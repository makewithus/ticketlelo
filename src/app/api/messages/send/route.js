import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getAuthenticatedUser, canManageEventId } from "@/lib/auth-server";
import { sendEmail } from "@/lib/mailer";
import { sendWhatsAppCloudMessage } from "@/lib/communications";

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char]));

export async function POST(request) {
  let messageId;
  try {
    const caller = await getAuthenticatedUser(request);
    if (!caller) return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
    if (!adminDb) return NextResponse.json({ success: false, error: "Messaging service unavailable" }, { status: 503 });
    ({ messageId } = await request.json());

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
    if (!message.eventId || !await canManageEventId(caller, message.eventId)) {
      return NextResponse.json({ success: false, error: "Event access denied" }, { status: 403 });
    }
    if (["sending", "sent", "delivery_uncertain"].includes(message.status)) {
      return NextResponse.json({ success: false, error: "Message has already been dispatched or is being dispatched" }, { status: 409 });
    }

    // Claim dispatch atomically so simultaneous requests cannot send twice.
    const claimed = await adminDb.runTransaction(async (tx) => {
      const fresh = await tx.get(messageDoc.ref);
      if (!fresh.exists || ["sending", "sent", "delivery_uncertain"].includes(fresh.data().status)) return false;
      tx.update(messageDoc.ref, { status: "sending", dispatchStartedAt: new Date(), updatedAt: new Date() });
      return true;
    });
    if (!claimed) return NextResponse.json({ success: false, error: "Message has already been dispatched or is being dispatched" }, { status: 409 });

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

    // Extract unique recipients filtered by target audience
    const recipients = [];
    const seenEmails = new Set();
    const targetAudience = message.targetAudience || "all";
    const targetSubEventId = message.subEventId || null;

    registrationsSnapshot.forEach((doc) => {
      const reg = doc.data();
      const email = reg.formData?.email || reg.email;
      const name = reg.formData?.fullName || reg.fullName || "Participant";
      const phone = reg.formData?.whatsappPhone || reg.whatsappPhone || "";

      if (!email || seenEmails.has(email)) return;

      // Filter by audience
      if (targetAudience === "sub_event" && targetSubEventId) {
        const entitled = Array.isArray(reg.entitledSubEventIds) && reg.entitledSubEventIds.includes(targetSubEventId);
        if (!entitled) return;
      } else if (targetAudience === "checked_in") {
        const isCheckedIn = (reg.status || "").toLowerCase() === "used" || (reg.checkIns && Object.keys(reg.checkIns).length > 0);
        if (!isCheckedIn) return;
      } else if (targetAudience === "not_checked_in") {
        const isCheckedIn = (reg.status || "").toLowerCase() === "used" || (reg.checkIns && Object.keys(reg.checkIns).length > 0);
        if (isCheckedIn) return;
      }

      seenEmails.add(email);
      recipients.push({ email, name, phone, registrationId: doc.id });
    });

    // Send messages in batches
    const batchSize = 10;
    let successCount = 0;
    let failureCount = 0;
    const failedRecipients = [];

    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);

      const results = await Promise.allSettled(
        batch.map(async (recipient) => {
          try {
            if (message.channel === "whatsapp") {
              const waRes = await sendWhatsAppCloudMessage({
                recipientPhone: recipient.phone,
                messageText: `${message.title}\n\n${message.content}`,
              });
              const status = waRes.sent ? "sent" : (waRes.requiresCredentials ? "unconfigured_provider" : "failed");
              await adminDb.collection("messageReceipts").add({
                messageId,
                recipientEmail: recipient.email,
                recipientPhone: recipient.phone,
                recipientName: recipient.name,
                status,
                sentAt: waRes.sent ? new Date() : null,
                createdAt: new Date(),
                note: waRes.message || null,
              });
              return { success: waRes.sent, email: recipient.email, requiresCredentials: waRes.requiresCredentials };
            }

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
                  <div style="font-size: 15px; line-height: 1.6; color: #333; white-space: pre-wrap;">${escapeHtml(message.content)}</div>
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
    console.error("Send message API error:", error.code || "unexpected-error");

    // Update message status to failed
    if (messageId && adminDb) {
      await adminDb.collection("messages").doc(messageId).update({
        status: "delivery_uncertain",
        errorCode: error.code || "dispatch-error",
        updatedAt: new Date(),
      });
    }

    return NextResponse.json(
      { success: false, error: error.message || "Failed to send message" },
      { status: 500 },
    );
  }
}
