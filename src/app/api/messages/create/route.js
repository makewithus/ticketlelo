import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { createMessage } from "@/lib/messages";

export async function POST(request) {
  try {
    const { eventId, title, content, scheduledAt, userId } =
      await request.json();

    // Validation
    if (!eventId || !title || !content || !userId) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: eventId, title, content, userId",
        },
        { status: 400 },
      );
    }

    // Verify event exists
    const eventDoc = await adminDb.collection("events").doc(eventId).get();
    if (!eventDoc.exists) {
      return NextResponse.json(
        { success: false, error: "Event not found" },
        { status: 404 },
      );
    }

    // Verify user is the event creator or admin
    const event = eventDoc.data();
    const userDoc = await adminDb.collection("users").doc(userId).get();
    const user = userDoc.data();

    if (
      event.createdBy !== userId &&
      user?.role !== "superAdmin" &&
      !user?.isAdmin
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized: You can only send messages for your own events",
        },
        { status: 403 },
      );
    }

    // Create message using client SDK (in actual implementation)
    // For now, create using admin SDK
    const messageData = {
      eventId,
      title,
      content,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      status: scheduledAt ? "scheduled" : "draft",
      recipientCount: 0,
      successCount: 0,
      failureCount: 0,
      failedRecipients: [],
      createdBy: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const messageRef = adminDb.collection("messages").doc();
    await messageRef.set({
      ...messageData,
      id: messageRef.id,
    });

    const message = {
      id: messageRef.id,
      ...messageData,
    };

    return NextResponse.json({
      success: true,
      message,
    });
  } catch (error) {
    console.error("Create message API error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create message" },
      { status: 500 },
    );
  }
}
