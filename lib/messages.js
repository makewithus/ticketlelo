import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  updateDoc,
  limit,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { sendEmail } from "./email";
import { getRegistrationsByEvent } from "./firestore";

// ===== Message Operations =====

/**
 * Create a new broadcast message for an event
 */
export const createMessage = async (messageData, userId) => {
  try {
    const messageRef = doc(collection(db, "messages"));
    const message = {
      ...messageData,
      id: messageRef.id,
      status: messageData.scheduledAt ? "scheduled" : "draft",
      recipientCount: 0,
      successCount: 0,
      failureCount: 0,
      failedRecipients: [],
      createdBy: userId,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    await setDoc(messageRef, message);
    return message;
  } catch (error) {
    console.error("Create message error:", error);
    throw new Error("Failed to create message");
  }
};

/**
 * Get all messages for a specific event
 */
export const getMessagesByEvent = async (eventId) => {
  try {
    const q = query(
      collection(db, "messages"),
      where("eventId", "==", eventId),
      orderBy("createdAt", "desc"),
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("Get messages error:", error);
    return [];
  }
};

/**
 * Get a single message by ID
 */
export const getMessage = async (messageId) => {
  try {
    const docSnap = await getDoc(doc(db, "messages", messageId));
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
  } catch (error) {
    console.error("Get message error:", error);
    return null;
  }
};

/**
 * Update message status
 */
export const updateMessageStatus = async (
  messageId,
  status,
  additionalData = {},
) => {
  try {
    await updateDoc(doc(db, "messages", messageId), {
      status,
      ...additionalData,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error("Update message status error:", error);
    throw new Error("Failed to update message status");
  }
};

/**
 * Get scheduled messages that need to be sent
 */
export const getScheduledMessages = async () => {
  try {
    const now = Timestamp.now();
    const q = query(
      collection(db, "messages"),
      where("status", "==", "scheduled"),
      where("scheduledAt", "<=", now),
      limit(50),
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("Get scheduled messages error:", error);
    return [];
  }
};

/**
 * Send broadcast message to all event participants
 * This is the core function that sends emails to all registered users
 */
export const sendBroadcastMessage = async (messageId) => {
  try {
    // Get message data
    const message = await getMessage(messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    // Update status to sending
    await updateMessageStatus(messageId, "sending");

    // Get all registrations for the event
    const registrations = await getRegistrationsByEvent(message.eventId);

    if (registrations.length === 0) {
      await updateMessageStatus(messageId, "sent", {
        recipientCount: 0,
        successCount: 0,
        failureCount: 0,
        sentAt: Timestamp.now(),
      });
      return {
        success: true,
        recipientCount: 0,
        successCount: 0,
        failureCount: 0,
      };
    }

    // Extract unique email addresses
    const recipients = [];
    const seenEmails = new Set();

    for (const reg of registrations) {
      const email = reg.formData?.email || reg.email;
      const name = reg.formData?.fullName || reg.fullName || "Participant";

      if (email && !seenEmails.has(email)) {
        seenEmails.add(email);
        recipients.push({ email, name, registrationId: reg.id });
      }
    }

    // Send emails in batches to avoid rate limiting
    const batchSize = 10;
    let successCount = 0;
    let failureCount = 0;
    const failedRecipients = [];

    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);

      await Promise.allSettled(
        batch.map(async (recipient) => {
          try {
            await sendEmail({
              to: recipient.email,
              subject: message.title,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #FE760B;">Event Update</h2>
                  <p>Hello ${recipient.name},</p>
                  <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    ${message.content.replace(/\n/g, "<br>")}
                  </div>
                  <p style="color: #666; font-size: 14px;">
                    This is an automated message from the event organizers.
                  </p>
                  <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;" />
                  <p style="color: #999; font-size: 12px; text-align: center;">
                    Powered by TicketLelo
                  </p>
                </div>
              `,
            });

            // Create receipt record
            await createMessageReceipt({
              messageId,
              recipientEmail: recipient.email,
              recipientName: recipient.name,
              status: "sent",
              sentAt: Timestamp.now(),
            });

            successCount++;
          } catch (error) {
            console.error(`Failed to send to ${recipient.email}:`, error);
            failedRecipients.push(recipient.email);

            // Create failed receipt record
            await createMessageReceipt({
              messageId,
              recipientEmail: recipient.email,
              recipientName: recipient.name,
              status: "failed",
              error: error.message,
            });

            failureCount++;
          }
        }),
      );

      // Small delay between batches
      if (i + batchSize < recipients.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Update message with final status
    await updateMessageStatus(
      messageId,
      failureCount === recipients.length ? "failed" : "sent",
      {
        recipientCount: recipients.length,
        successCount,
        failureCount,
        failedRecipients,
        sentAt: Timestamp.now(),
      },
    );

    return {
      success: true,
      recipientCount: recipients.length,
      successCount,
      failureCount,
      failedRecipients,
    };
  } catch (error) {
    console.error("Send broadcast message error:", error);

    // Update message status to failed
    await updateMessageStatus(messageId, "failed", {
      error: error.message,
      updatedAt: Timestamp.now(),
    });

    throw error;
  }
};

/**
 * Create a message receipt for tracking
 */
const createMessageReceipt = async (receiptData) => {
  try {
    const receiptRef = doc(collection(db, "messageReceipts"));
    await setDoc(receiptRef, {
      ...receiptData,
      id: receiptRef.id,
      createdAt: Timestamp.now(),
    });
  } catch (error) {
    console.error("Create receipt error:", error);
    // Don't throw - receipt creation shouldn't block email sending
  }
};

/**
 * Get all receipts for a message
 */
export const getMessageReceipts = async (messageId) => {
  try {
    const q = query(
      collection(db, "messageReceipts"),
      where("messageId", "==", messageId),
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("Get receipts error:", error);
    return [];
  }
};

/**
 * Retry sending failed messages
 */
export const retryFailedMessage = async (messageId) => {
  try {
    const message = await getMessage(messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    if (message.status !== "failed" && message.failedRecipients.length === 0) {
      throw new Error("No failed recipients to retry");
    }

    // Get failed recipients from receipts
    const receipts = await getMessageReceipts(messageId);
    const failedReceipts = receipts.filter((r) => r.status === "failed");

    if (failedReceipts.length === 0) {
      return { success: true, retryCount: 0 };
    }

    // Retry sending to failed recipients
    let successCount = 0;
    let stillFailed = [];

    for (const receipt of failedReceipts) {
      try {
        await sendEmail({
          to: receipt.recipientEmail,
          subject: message.title,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #FE760B;">Event Update</h2>
              <p>Hello ${receipt.recipientName},</p>
              <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                ${message.content.replace(/\n/g, "<br>")}
              </div>
              <p style="color: #666; font-size: 14px;">
                This is an automated message from the event organizers.
              </p>
              <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;" />
              <p style="color: #999; font-size: 12px; text-align: center;">
                Powered by TicketLelo
              </p>
            </div>
          `,
        });

        // Update receipt to sent
        await updateDoc(doc(db, "messageReceipts", receipt.id), {
          status: "sent",
          sentAt: Timestamp.now(),
          error: null,
        });

        successCount++;
      } catch (error) {
        console.error(`Retry failed for ${receipt.recipientEmail}:`, error);
        stillFailed.push(receipt.recipientEmail);
      }
    }

    // Update message stats
    await updateDoc(doc(db, "messages", messageId), {
      successCount: message.successCount + successCount,
      failureCount: stillFailed.length,
      failedRecipients: stillFailed,
      status: stillFailed.length === 0 ? "sent" : "failed",
      updatedAt: Timestamp.now(),
    });

    return {
      success: true,
      retryCount: failedReceipts.length,
      successCount,
      failureCount: stillFailed.length,
    };
  } catch (error) {
    console.error("Retry failed message error:", error);
    throw error;
  }
};

/**
 * Delete a message (and its receipts)
 */
export const deleteMessage = async (messageId) => {
  try {
    // Delete all receipts first
    const receipts = await getMessageReceipts(messageId);
    const batch = writeBatch(db);

    receipts.forEach((receipt) => {
      batch.delete(doc(db, "messageReceipts", receipt.id));
    });

    // Delete the message
    batch.delete(doc(db, "messages", messageId));

    await batch.commit();
    return { success: true };
  } catch (error) {
    console.error("Delete message error:", error);
    throw error;
  }
};

/**
 * Get message statistics for an event
 */
export const getMessageStats = async (eventId) => {
  try {
    const messages = await getMessagesByEvent(eventId);

    const stats = {
      totalMessages: messages.length,
      sent: messages.filter((m) => m.status === "sent").length,
      scheduled: messages.filter((m) => m.status === "scheduled").length,
      failed: messages.filter((m) => m.status === "failed").length,
      draft: messages.filter((m) => m.status === "draft").length,
      totalRecipients: messages.reduce(
        (sum, m) => sum + (m.recipientCount || 0),
        0,
      ),
      totalSuccess: messages.reduce((sum, m) => sum + (m.successCount || 0), 0),
      totalFailures: messages.reduce(
        (sum, m) => sum + (m.failureCount || 0),
        0,
      ),
    };

    return stats;
  } catch (error) {
    console.error("Get message stats error:", error);
    return null;
  }
};
