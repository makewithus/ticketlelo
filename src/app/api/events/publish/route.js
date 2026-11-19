import { adminDb } from "@/lib/firebase-admin";
import { NextResponse } from "next/server";
import { getAppBaseUrl } from "@/lib/app-url";
import { getAuthenticatedUser, canManageEventId } from "@/lib/auth-server";
import { checkOrganizerEligibilityForPaidEvents } from "@/lib/payments/connected-accounts";
import { assertCanPublishEvent } from "@/lib/plan-enforcement";

// POST /api/events/publish  — publish event and generate shareable link
export async function POST(req) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const { eventId } = await req.json();
    if (!eventId) {
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

    if (!await canManageEventId(caller, eventId)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Backend plan usage enforcement: Verify organizer has quota to publish this event
    const publishCheck = await assertCanPublishEvent(adminDb, caller, eventId);
    if (!publishCheck.allowed) {
      return NextResponse.json(
        {
          error: publishCheck.reason || "Event limit reached for your subscription plan",
          code: publishCheck.code || "EVENT_LIMIT_EXCEEDED",
          limit: publishCheck.limit,
          current: publishCheck.current,
          upgradeRequired: true,
        },
        { status: 403 }
      );
    }

    // Independent Settlement Architecture: Paid events are collected through TicketLelo's master gateway
    // and do not require organizers to connect a separate Razorpay linked account.

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
    const shareUrl = `${getAppBaseUrl()}/e/${slug}`;

    await eventRef.update({
      status: "published",
      published: true,
      isPublished: true,
      isActive: true,
      registrationStatus: "Open",
      registrationClosed: false,
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
      publishedBy: caller.uid,
    });

    return NextResponse.json({
      success: true,
      slug,
      shareUrl,
      publishedAt,
      published: true,
      isPublished: true,
      status: "published",
    });
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
    const caller = await getAuthenticatedUser(req);
    if (!caller) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get("eventId");

    if (!eventId) {
      return NextResponse.json(
        { error: "eventId required" },
        { status: 400 },
      );
    }

    const eventRef = adminDb.collection("events").doc(eventId);
    const eventSnap = await eventRef.get();
    if (!eventSnap.exists) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    if (!await canManageEventId(caller, eventId)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await eventRef.update({
      published: false,
      isPublished: false,
      status: "draft",
      isActive: false,
      registrationClosed: true,
      registrationStatus: "Closed",
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
