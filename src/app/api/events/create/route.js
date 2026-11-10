import admin, { adminAuth, adminDb, isFirebaseAdminReady } from "@/lib/firebase-admin";
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { sanitizeAndOffloadImages } from "@/lib/server-image-storage";

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

    // Clean undefined values
    const sanitized = {};
    for (const [key, value] of Object.entries(body)) {
      if (value !== undefined) {
        sanitized[key] = value;
      }
    }

    // Reject event creation for dates that have already passed
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    const todayStr = `${y}-${m}-${d}`;

    const startStr =
      sanitized.startDate ||
      (sanitized.date ? new Date(sanitized.date).toISOString().split("T")[0] : null);

    if (startStr && startStr < todayStr) {
      return NextResponse.json(
        { error: "Event date cannot be in the past. Please select today or an upcoming date." },
        { status: 400 }
      );
    }

    const eventRef = sanitized.id
      ? adminDb.collection("events").doc(sanitized.id)
      : adminDb.collection("events").doc();
    const eventId = eventRef.id;

    const now = new Date().toISOString();
    const generatedSlug = (sanitized.slug || sanitized.name || sanitized.title || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || eventId;

    let hostName = sanitized.organizerName || sanitized.hostName || "";
    let hostEmail = sanitized.organizerEmail || sanitized.hostEmail || "";
    let hostPhotoUrl = sanitized.organizerPhotoUrl || sanitized.hostPhotoUrl || "";

    if (creatorId && adminDb) {
      try {
        const uDoc = await adminDb.collection("users").doc(creatorId).get();
        if (uDoc.exists) {
          const uData = uDoc.data();
          if (!hostName) hostName = uData.fullName || uData.displayName || "";
          if (!hostEmail) hostEmail = uData.email || "";
          if (!hostPhotoUrl) hostPhotoUrl = uData.photoURL || "";
        }
      } catch (_) {}
    }

    if (creatorId && adminAuth) {
      try {
        const authUser = await adminAuth.getUser(creatorId);
        if (!hostName) hostName = authUser.displayName || "";
        if (!hostEmail) hostEmail = authUser.email || "";
        if (!hostPhotoUrl) hostPhotoUrl = authUser.photoURL || "";
      } catch (_) {}
    }

    if (!hostEmail && caller?.email) hostEmail = caller.email;
    if (!hostName && caller?.decodedToken?.name) hostName = caller.decodedToken.name;
    if (!hostPhotoUrl && caller?.decodedToken?.picture) hostPhotoUrl = caller.decodedToken.picture;

    const canonicalName = (sanitized.name || sanitized.title || "").trim();
    const eventData = {
      ...sanitized,
      name: canonicalName,
      title: canonicalName,
      id: eventId,
      slug: sanitized.slug || generatedSlug,
      createdBy: creatorId,
      userId: creatorId,
      organiserId: creatorId,
      organizerId: creatorId,
      organizerName: hostName || sanitized.organizerName || "Host",
      organizerEmail: hostEmail || sanitized.organizerEmail || "",
      organizerPhotoUrl: hostPhotoUrl || sanitized.organizerPhotoUrl || "",
      hostName: hostName || sanitized.hostName || "Host",
      hostEmail: hostEmail || sanitized.hostEmail || "",
      hostPhotoUrl: hostPhotoUrl || sanitized.hostPhotoUrl || "",
      createdAt: sanitized.createdAt || now,
      updatedAt: now,
    };

    // Offload base64 images and guarantee document strictly respects Firestore 1MB limit
    const safeEventData = await sanitizeAndOffloadImages(eventData, eventId);

    const writes = [eventRef.set(safeEventData)];

    // Atomically and concurrently increment user's eventsCreated count via Admin SDK
    if (creatorId) {
      try {
        const userRef = adminDb.collection("users").doc(creatorId);
        writes.push(
          userRef.set(
            {
              eventsCreated: admin.firestore.FieldValue.increment(1),
            },
            { merge: true }
          ).catch((countErr) => {
            console.warn("Could not increment user eventsCreated count:", countErr?.message);
          })
        );
      } catch (err) {
        console.warn("Could not setup user eventsCreated write:", err?.message);
      }
    }

    await Promise.all(writes);

    return NextResponse.json({ success: true, event: safeEventData }, { status: 201 });
  } catch (error) {
    console.error("API /api/events/create error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create event" },
      { status: 500 }
    );
  }
}
