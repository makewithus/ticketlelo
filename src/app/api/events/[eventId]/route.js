import { adminDb, isFirebaseAdminReady } from "@/lib/firebase-admin";
import { NextResponse } from "next/server";
import { sanitizeAndOffloadImages } from "@/lib/server-image-storage";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  try {
    const { eventId } = await params;
    if (!eventId) {
      return NextResponse.json({ error: "Event ID is required" }, { status: 400 });
    }

    if (!isFirebaseAdminReady()) {
      return NextResponse.json({ error: "Database service unavailable" }, { status: 503 });
    }

    const doc = await adminDb.collection("events").doc(eventId).get();
    if (!doc.exists) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const data = doc.data();
    const event = {
      id: doc.id,
      ...data,
      date: data.date?.toDate ? data.date.toDate().toISOString() : data.date,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
      updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt,
    };

    return NextResponse.json({ event });
  } catch (error) {
    console.error("Get event API error:", error?.message || error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const { eventId } = await params;
    if (!eventId) {
      return NextResponse.json({ error: "Event ID is required" }, { status: 400 });
    }

    if (!isFirebaseAdminReady()) {
      return NextResponse.json({ error: "Database service unavailable" }, { status: 503 });
    }

    const updates = await request.json();
    if (!updates || typeof updates !== "object") {
      return NextResponse.json({ error: "Invalid updates payload" }, { status: 400 });
    }

    const eventRef = adminDb.collection("events").doc(eventId);
    const docSnap = await eventRef.get();
    if (!docSnap.exists) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Clean payload and offload base64 images to prevent Firestore 1MB document limit errors
    const cleaned = {
      ...updates,
      updatedAt: new Date(),
    };
    if (cleaned.name && !cleaned.title) {
      cleaned.title = cleaned.name;
    } else if (cleaned.title && !cleaned.name) {
      cleaned.name = cleaned.title;
    }
    delete cleaned.id;

    const safeUpdates = await sanitizeAndOffloadImages(cleaned, eventId);

    await eventRef.update(safeUpdates);

    return NextResponse.json({
      success: true,
      message: "Event updated successfully",
      eventId,
      updates: safeUpdates,
    });
  } catch (error) {
    console.error("Patch event API error:", error?.message || error);
    return NextResponse.json({ error: error.message || "Failed to update event" }, { status: 500 });
  }
}

