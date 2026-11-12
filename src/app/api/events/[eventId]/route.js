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

    let doc = await adminDb.collection("events").doc(eventId).get();
    if (!doc.exists) {
      // 1. Try querying by slug
      const slugSnap = await adminDb.collection("events").where("slug", "==", eventId).limit(1).get();
      if (!slugSnap.empty) {
        doc = slugSnap.docs[0];
      } else {
        // 2. Try checking if eventId is a hosting request id with a linked eventId
        try {
          const hrDoc = await adminDb.collection("hostingRequests").doc(eventId).get();
          if (hrDoc.exists) {
            const hrData = hrDoc.data();
            const linkedId = hrData.eventId || hrData.eventDocId;
            if (linkedId) {
              const linkedDoc = await adminDb.collection("events").doc(linkedId).get();
              if (linkedDoc.exists) {
                doc = linkedDoc;
              }
            }
          }
        } catch (_) {}
      }
    }

    if (!doc || !doc.exists) {
      return NextResponse.json({ error: "Event not found", event: null }, { status: 404 });
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

export async function DELETE(request, { params }) {
  try {
    const { eventId } = await params;
    if (!eventId) {
      return NextResponse.json({ error: "Event ID is required" }, { status: 400 });
    }

    if (!isFirebaseAdminReady()) {
      return NextResponse.json({ error: "Database service unavailable" }, { status: 503 });
    }

    const eventRef = adminDb.collection("events").doc(eventId);
    const docSnap = await eventRef.get();
    if (!docSnap.exists) {
      return NextResponse.json({ success: true, message: "Event already deleted" });
    }

    const eventData = docSnap.data();
    const organizerId = eventData?.createdBy || eventData?.userId;

    // Hard delete document and mark soft deletion safety flags
    await eventRef.update({
      isDeleted: true,
      deleted: true,
      status: "deleted",
      deletedAt: new Date(),
    }).catch(() => {});
    await eventRef.delete().catch(() => {});

    // Decrease eventsCreated count for organizer
    if (organizerId) {
      try {
        const userRef = adminDb.collection("users").doc(organizerId);
        const userDoc = await userRef.get();
        if (userDoc.exists) {
          const currentCount = userDoc.data().eventsCreated || 0;
          await userRef.update({
            eventsCreated: Math.max(0, currentCount - 1),
          });
        }
      } catch (err) {
        console.warn("Could not decrement eventsCreated:", err);
      }
    }

    // Delete associated customForms
    try {
      const formsSnap = await adminDb.collection("customForms").where("eventId", "==", eventId).get();
      if (!formsSnap.empty) {
        const batch = adminDb.batch();
        formsSnap.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
      }
    } catch (err) {
      console.warn("Could not clean customForms:", err);
    }

    return NextResponse.json({ success: true, message: "Event deleted successfully" });
  } catch (error) {
    console.error("Delete event API error:", error?.message || error);
    return NextResponse.json({ error: error.message || "Failed to delete event" }, { status: 500 });
  }
}


