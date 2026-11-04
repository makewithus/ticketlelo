import { adminDb, isFirebaseAdminReady } from "@/lib/firebase-admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function parseEventDate(data) {
  if (data.date) {
    if (typeof data.date?.toDate === "function") {
      return data.date.toDate().toISOString();
    }
    const d = new Date(data.date);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  if (data.startDate) {
    const timeStr = data.startTime ? ` ${data.startTime}` : "";
    const d = new Date(`${data.startDate}${timeStr}`);
    if (!isNaN(d.getTime())) return d.toISOString();
    return String(data.startDate);
  }
  return new Date().toISOString();
}

function serializePublicEvent(id, data) {
  return {
    id,
    name: data.name || data.title || data.eventName || "Live Event",
    title: data.name || data.title || data.eventName || "Live Event",
    description:
      typeof data.description === "string"
        ? data.description
        : data.description?.text || "",
    location: data.location || data.venue || "Location to be announced",
    locationVenue: data.locationVenue || data.location || "",
    locationAddress: data.locationAddress || "",
    locationType: data.locationType || "in-person",
    date: parseEventDate(data),
    startDate: data.startDate || null,
    startTime: data.startTime || null,
    endDate: data.endDate || null,
    endTime: data.endTime || null,
    totalTickets: Number(data.totalTickets ?? data.capacity ?? 150),
    capacity: data.capacity || data.maxCapacity || 150,
    coverImage: data.coverImage || data.bannerUrl || data.posterUrl || data.image || data.imageUrl || "",
    bannerUrl: data.bannerUrl || data.coverImage || data.posterUrl || data.image || data.imageUrl || "",
    posterUrl: data.posterUrl || data.bannerUrl || data.coverImage || "",
    ticketBgUrl: data.ticketBgUrl || "",
    theme: data.theme || "minimal",
    themeColor: data.themeColor || data.themeHex || "#FE760B",
    price: data.price || (data.isPaid ? "Paid" : "Free"),
    isPaid: Boolean(data.isPaid),
    slug: data.slug || id,
    category: data.category || (data.isPaid ? "Featured" : "Popular"),
    tags: Array.isArray(data.tags) ? data.tags : [],
    ticketDesign: data.ticketDesign || "stub",
  };
}

export async function GET() {
  try {
    if (!isFirebaseAdminReady()) {
      return NextResponse.json({ error: "Event service unavailable" }, { status: 503 });
    }

    const snapshot = await adminDb.collection("events").get();

    const serializedEvents = snapshot.docs
      .map((doc) => ({ id: doc.id, data: doc.data() }))
      .filter(({ data }) => {
        // Exclude drafts and explicitly deactivated events
        if (
          data.isActive === false ||
          data.visibility === "draft" ||
          data.status === "draft"
        ) {
          return false;
        }

        // Include explicitly active, published, or standard public events
        return (
          data.isActive === true ||
          data.published === true ||
          data.status === "published" ||
          data.visibility === "public" ||
          (!("isActive" in data) && !("status" in data))
        );
      })
      .map(({ id, data }) => serializePublicEvent(id, data));

    const seen = new Set();
    const events = [];
    for (const ev of serializedEvents) {
      const evId = ev.id;
      const evSlug = ev.slug ? String(ev.slug).toLowerCase().trim() : null;
      const normTitle = (ev.name || ev.title || "").trim().toLowerCase();
      const dateVal = ev.date ? String(ev.date).slice(0, 10) : "";
      const compKey = normTitle && dateVal ? `${normTitle}__${dateVal}` : null;

      const isDuplicate =
        (evId && seen.has(`id:${evId}`)) ||
        (evSlug && seen.has(`slug:${evSlug}`)) ||
        (compKey && seen.has(`comp:${compKey}`));

      if (!isDuplicate) {
        if (evId) seen.add(`id:${evId}`);
        if (evSlug) seen.add(`slug:${evSlug}`);
        if (compKey) seen.add(`comp:${compKey}`);
        events.push(ev);
      }
    }

    return NextResponse.json(
      { success: true, events },
      { headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=60" } },
    );
  } catch (error) {
    console.error("Load active events failed:", error.code || "unknown-error");
    return NextResponse.json({ error: "Unable to load events" }, { status: 500 });
  }
}

