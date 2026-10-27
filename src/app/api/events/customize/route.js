import { NextResponse } from "next/server";
import { adminDb, adminStorage } from "@/lib/firebase-admin";
import { getAuthenticatedUser, canManageEventId } from "@/lib/auth-server";

/**
 * POST /api/events/customize
 * Update event customization: banner, theme color, slug
 */
export async function POST(request) {
  try {
    const caller = await getAuthenticatedUser(request);
    if (!caller) return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
    if (!adminDb || !adminStorage) return NextResponse.json({ success: false, error: "Event customization unavailable" }, { status: 503 });
    const formData = await request.formData();
    const eventId = formData.get("eventId");
    const themeColor = formData.get("themeColor");
    const slug = formData.get("slug");
    const bannerFile = formData.get("banner");

    if (!eventId || typeof eventId !== "string") {
      return NextResponse.json(
        { success: false, error: "eventId is required" },
        { status: 400 },
      );
    }

    // Verify event exists and user owns it
    const eventDoc = await adminDb.collection("events").doc(eventId).get();
    if (!eventDoc.exists) {
      return NextResponse.json(
        { success: false, error: "Event not found" },
        { status: 404 },
      );
    }

    const event = eventDoc.data();
    if (!await canManageEventId(caller, eventId)) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 },
      );
    }

    const updates = { updatedAt: new Date() };

    // ======= Validate & Set Slug =======
    if (slug) {
      const slugRegex = /^[a-z0-9-]+$/;
      const cleanSlug = slug.toLowerCase().trim();

      if (!slugRegex.test(cleanSlug)) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Slug can only contain lowercase letters, numbers, and hyphens",
          },
          { status: 400 },
        );
      }

      if (cleanSlug.length < 3 || cleanSlug.length > 60) {
        return NextResponse.json(
          {
            success: false,
            error: "Slug must be between 3 and 60 characters",
          },
          { status: 400 },
        );
      }

      // Check slug uniqueness
      const existingSlugSnapshot = await adminDb
        .collection("events")
        .where("slug", "==", cleanSlug)
        .limit(1)
        .get();

      const existingSlug = existingSlugSnapshot.docs.find(
        (doc) => doc.id !== eventId,
      );

      if (existingSlug) {
        return NextResponse.json(
          {
            success: false,
            error: "This URL slug is already taken. Please choose another.",
          },
          { status: 409 },
        );
      }

      updates.slug = cleanSlug;
    }

    // ======= Validate & Set Theme Color =======
    if (themeColor) {
      const hexRegex = /^#[0-9A-Fa-f]{6}$/;
      if (!hexRegex.test(themeColor)) {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid theme color. Use hex format (e.g. #FF5733)",
          },
          { status: 400 },
        );
      }
      updates.themeColor = themeColor;
    }

    // ======= Handle Banner Upload =======
    if (bannerFile && bannerFile.size > 0) {
      // Validate file size (max 5MB)
      if (bannerFile.size > 5 * 1024 * 1024) {
        return NextResponse.json(
          { success: false, error: "Banner image must be under 5MB" },
          { status: 400 },
        );
      }

      // Validate file type
      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
      ];
      if (!allowedTypes.includes(bannerFile.type)) {
        return NextResponse.json(
          {
            success: false,
            error: "Banner must be a JPEG, PNG, WebP, or GIF image",
          },
          { status: 400 },
        );
      }

      try {
        // Convert to buffer
        const bytes = await bannerFile.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Upload to Firebase Storage
        const bucket = adminStorage.bucket();
        const fileName = `event-banners/${eventId}-${Date.now()}.${bannerFile.type.split("/")[1]}`;
        const file = bucket.file(fileName);

        await file.save(buffer, {
          metadata: {
            contentType: bannerFile.type,
            metadata: {
              eventId,
              uploadedBy: caller.uid,
            },
          },
        });

        // Make file publicly accessible
        await file.makePublic();
        const bannerUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
        updates.bannerUrl = bannerUrl;

        // Delete old banner if exists
        if (event.bannerUrl) {
          try {
            const oldFileName = event.bannerUrl.split("/").slice(-1)[0];
            await bucket.file(`event-banners/${oldFileName}`).delete();
          } catch {
            // Ignore error if old file doesn't exist
          }
        }
      } catch (uploadError) {
        console.error("Banner upload error:", uploadError);
        return NextResponse.json(
          { success: false, error: "Failed to upload banner image" },
          { status: 500 },
        );
      }
    }

    // Update event
    await adminDb.collection("events").doc(eventId).update(updates);

    return NextResponse.json({
      success: true,
      updates,
      eventUrl: updates.slug ? `https://ticketlelo.in/${updates.slug}` : null,
    });
  } catch (error) {
    console.error("Event customization error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update event" },
      { status: 500 },
    );
  }
}

/**
 * GET /api/events/customize?slug={slug}
 * Get event by slug (for public event page)
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug");

    if (!slug) {
      return NextResponse.json(
        { success: false, error: "slug is required" },
        { status: 400 },
      );
    }

    const eventSnapshot = await adminDb
      .collection("events")
      .where("slug", "==", slug)
      .where("isActive", "==", true)
      .limit(1)
      .get();

    if (eventSnapshot.empty) {
      return NextResponse.json(
        { success: false, error: "Event not found" },
        { status: 404 },
      );
    }

    const eventDoc = eventSnapshot.docs[0];
    const event = eventDoc.data();

    // Track view (increment page views)
    await adminDb
      .collection("events")
      .doc(eventDoc.id)
      .update({
        pageViews: (event.pageViews || 0) + 1,
      });

    return NextResponse.json({
      success: true,
      event: {
        id: eventDoc.id,
        name: event.name,
        description: event.description,
        location: event.location,
        date: event.date?.toDate?.()?.toISOString() || null,
        bannerUrl: event.bannerUrl,
        themeColor: event.themeColor || "#FF6A00",
        slug: event.slug,
        ticketPrice: event.ticketPrice || 0,
        isPaid: event.isPaid || false,
        formId: event.formId,
        socialLinks: event.socialLinks || {},
      },
    });
  } catch (error) {
    console.error("Get event by slug error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
