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

    // Get failed receipts
    const failedReceiptsSnapshot = await adminDb
      .collection("messageReceipts")
      .where("messageId", "==", messageId)
      .where("status", "==", "failed")
      .get();

    if (failedReceiptsSnapshot.empty) {
      return NextResponse.json({
        success: true,
        message: "No failed recipients to retry",
        retryCount: 0,
      });
    }

    const failedReceipts = [];
    failedReceiptsSnapshot.forEach((doc) => {
      failedReceipts.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    // Retry sending
    let successCount = 0;
    let stillFailed = [];

    for (const receipt of failedReceipts) {
      try {
        await sendEmail({
          to: receipt.recipientEmail,
          subject: message.title,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #FE760B 0%, #FEDF05 100%); padding: 30px; text-align: center;">
                <h1 style="color: #000; margin: 0; font-size: 28px;">Event Update</h1>
              </div>
              <div style="padding: 30px; background: #fff;">
                <p style="font-size: 16px; color: #333;">Hello ${receipt.recipientName},</p>
                <div style="background-color: #f5f5f5; padding: 25px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #FE760B;">
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

        // Update receipt
        await adminDb.collection("messageReceipts").doc(receipt.id).update({
          status: "sent",
          sentAt: new Date(),
          error: null,
        });

        successCount++;
      } catch (error) {
        console.error(`Retry failed for ${receipt.recipientEmail}:`, error);
        stillFailed.push(receipt.recipientEmail);
      }
    }

    // Update message stats
    await adminDb
      .collection("messages")
      .doc(messageId)
      .update({
        successCount: message.successCount + successCount,
        failureCount: stillFailed.length,
        failedRecipients: stillFailed,
        status: stillFailed.length === 0 ? "sent" : "failed",
        updatedAt: new Date(),
      });

    return NextResponse.json({
      success: true,
      retryCount: failedReceipts.length,
      successCount,
      failureCount: stillFailed.length,
    });
  } catch (error) {
    console.error("Retry message API error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to retry message" },
      { status: 500 },
    );
  }
}
