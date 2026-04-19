import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(request, { params }) {
  try {
    const { eventId } = await params;

    if (!eventId) {
      return NextResponse.json(
        { success: false, error: "eventId is required" },
        { status: 400 },
      );
    }

    // Get all messages for the event (no orderBy to avoid composite index requirement)
    const messagesSnapshot = await adminDb
      .collection("messages")
      .where("eventId", "==", eventId)
      .get();

    const messages = [];
    messagesSnapshot.forEach((doc) => {
      messages.push({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || null,
        scheduledAt: doc.data().scheduledAt?.toDate?.()?.toISOString() || null,
        sentAt: doc.data().sentAt?.toDate?.()?.toISOString() || null,
      });
    });

    // Sort by createdAt descending in-memory
    messages.sort((a, b) => {
      if (!a.createdAt) return 1;
      if (!b.createdAt) return -1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    // Calculate stats
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

    return NextResponse.json({
      success: true,
      messages,
      stats,
    });
  } catch (error) {
    console.error("Get messages API error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch messages" },
      { status: 500 },
    );
  }
}
