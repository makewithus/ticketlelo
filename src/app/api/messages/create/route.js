import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getAuthenticatedUser, canManageEventId } from "@/lib/auth-server";

export async function POST(request) {
  try {
    const caller = await getAuthenticatedUser(request);
    if (!caller) return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
    const { eventId, title, content, scheduledAt } =
      await request.json();

    // Validation
    if (!eventId || !title || !content) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: eventId, title, content",
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

    if (!await canManageEventId(caller, eventId)) {
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
      createdBy: caller.uid,
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
