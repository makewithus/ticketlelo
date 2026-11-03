import { adminDb, isFirebaseAdminReady } from "@/lib/firebase-admin";
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";

export async function POST(req) {
  try {
    if (!isFirebaseAdminReady() || !adminDb) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
    }

    const caller = await getAuthenticatedUser(req);
    const body = await req.json().catch(() => ({}));

    const creatorId = caller?.uid || body?.createdBy || body?.userId || body?.organiserId || body?.organizerId || null;
    if (!creatorId) {
      return NextResponse.json({ error: "Authentication required to create event" }, { status: 401 });
    }

    const eventRef = adminDb.collection("events").doc();
    const eventId = eventRef.id;

    // Clean undefined values
    const sanitized = {};
    for (const [key, value] of Object.entries(body)) {
      if (value !== undefined) {
        sanitized[key] = value;
      }
    }

    const now = new Date().toISOString();
    const generatedSlug = (sanitized.slug || sanitized.name || sanitized.title || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || eventId;

    const eventData = {
      ...sanitized,
      id: eventId,
      slug: sanitized.slug || generatedSlug,
      createdBy: creatorId,
      userId: creatorId,
      organiserId: creatorId,
      organizerId: creatorId,
      createdAt: now,
      updatedAt: now,
    };

    await eventRef.set(eventData);

    // Safely increment user's eventsCreated count via Admin SDK
    try {
      const userRef = adminDb.collection("users").doc(creatorId);
      const userSnap = await userRef.get();
      if (userSnap.exists) {
        const cur = userSnap.data()?.eventsCreated || 0;
        await userRef.update({ eventsCreated: cur + 1 });
      }
    } catch (countErr) {
      console.warn("Could not increment user eventsCreated count:", countErr?.message);
    }

    return NextResponse.json({ success: true, event: eventData }, { status: 201 });
  } catch (error) {
    console.error("API /api/events/create error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create event" },
      { status: 500 }
    );
  }
}
