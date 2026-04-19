import { adminDb } from "@/lib/firebase-admin";
import { NextResponse } from "next/server";

// POST /api/events/publish  — publish event and generate shareable link
export async function POST(req) {
  try {
    const { eventId, userId } = await req.json();
    if (!eventId || !userId) {
      return NextResponse.json(
        { error: "eventId and userId required" },
        { status: 400 },
      );
    }

    const eventRef = adminDb.collection("events").doc(eventId);
    const eventSnap = await eventRef.get();

    if (!eventSnap.exists) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const event = eventSnap.data();

    // Only event owner or superAdmin can publish
    const userSnap = await adminDb.collection("users").doc(userId).get();
    const user = userSnap.data();
    const isSuperAdmin = user?.role === "superAdmin" || user?.isSuperAdmin;

    if (!isSuperAdmin && event.createdBy !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Build slug: use existing or derive from event name
    let slug = event.slug;
    if (!slug) {
      const base = (event.name || `event-${eventId}`)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .substring(0, 40);

      // Ensure uniqueness by appending short id suffix
      const suffix = eventId.substring(0, 6);
      slug = `${base}-${suffix}`;
    }

    const publishedAt = new Date().toISOString();
    const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://ticketlelo.in"}/e/${slug}`;

    await eventRef.update({
      status: "published",
      published: true,
      publishedAt,
      slug,
      shareUrl,
    });

    // Keep a record in eventPublications collection
    await adminDb.collection("eventPublications").doc(eventId).set({
      eventId,
      slug,
      shareUrl,
      publishedAt,
      publishedBy: userId,
    });

    return NextResponse.json({ success: true, slug, shareUrl, publishedAt });
  } catch (err) {
    console.error("Publish event error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// DELETE /api/events/publish  — unpublish (archive)
export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get("eventId");
    const userId = searchParams.get("userId");

    if (!eventId || !userId) {
      return NextResponse.json(
        { error: "eventId and userId required" },
        { status: 400 },
      );
    }

    const eventRef = adminDb.collection("events").doc(eventId);
    const eventSnap = await eventRef.get();
    if (!eventSnap.exists) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const event = eventSnap.data();
    const userSnap = await adminDb.collection("users").doc(userId).get();
    const user = userSnap.data();
    const isSuperAdmin = user?.role === "superAdmin" || user?.isSuperAdmin;

    if (!isSuperAdmin && event.createdBy !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await eventRef.update({
      published: false,
      status: "draft",
      shareUrl: null,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Unpublish event error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
