import { adminDb, isFirebaseAdminReady } from "@/lib/firebase-admin";
import { parseFirestoreDate, getEventDateRange, getEventLiveStatus, getAuthoritativeEventCapacity } from "@/lib/date-utils";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function parseEventDate(data) {
  if (!data) return new Date().toISOString();

  // 1. If explicit startDate is provided, prioritize it (with startTime if present)
  if (data.startDate) {
    const timeStr = data.startTime ? ` ${data.startTime}` : "";
    const combined = `${data.startDate}${timeStr}`;
    const parsedCombined = parseFirestoreDate(combined);
    if (parsedCombined) return parsedCombined.toISOString();
    const parsedStart = parseFirestoreDate(data.startDate);
    if (parsedStart) return parsedStart.toISOString();
  }

  // 2. Check date or eventDate
  const rawDate = data.date || data.eventDate;
  if (rawDate) {
    const parsed = parseFirestoreDate(rawDate);
    if (parsed) return parsed.toISOString();
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
    status: data.status || "published",
    isLive: Boolean(data.isLive),
    isCancelled: Boolean(data.isCancelled),
    ticketsSold: data.ticketsSold || data.registrationsCount || 0,
    registrationsCount: data.registrationsCount || data.ticketsSold || 0,
    totalTickets: (() => {
      const capInfo = getAuthoritativeEventCapacity(data);
      return capInfo.isUnlimited ? 0 : capInfo.capacity;
    })(),
    capacity: (() => {
      const capInfo = getAuthoritativeEventCapacity(data);
      return capInfo.isUnlimited ? "Unlimited" : capInfo.capacity;
    })(),
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

    // Strict priority ordering: Live events first -> Upcoming (nearest date first) -> Ended (newest ended first)
    const getStatusRank = (ev) => {
      const timing = getEventLiveStatus(ev);
      if (timing.isLive) return 0;
      if (timing.isUpcoming) return 1;
      return 2;
    };

    const getEventTimestamp = (ev, useEnd = false) => {
      const range = getEventDateRange(ev);
      if (useEnd && range.end) return range.end.getTime();
      if (range.start) return range.start.getTime();
      const parsed = parseFirestoreDate(ev.startDate || ev.date);
      if (parsed) return parsed.getTime();
      return useEnd ? 0 : Number.MAX_SAFE_INTEGER;
    };

    events.sort((a, b) => {
      const rankA = getStatusRank(a);
      const rankB = getStatusRank(b);

      if (rankA !== rankB) {
        return rankA - rankB;
      }

      if (rankA === 0) {
        // Live events: soonest ending or latest starting
        return getEventTimestamp(a) - getEventTimestamp(b);
      }

      if (rankA === 1) {
        // Upcoming events: nearest upcoming date first (today -> tomorrow -> next week...)
        return getEventTimestamp(a) - getEventTimestamp(b);
      }

      // Ended events: most recently ended first
      return getEventTimestamp(b, true) - getEventTimestamp(a, true);
    });

    return NextResponse.json(
      { success: true, events },
      { headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=60" } },
    );
  } catch (error) {
    console.error("Load active events failed:", error.code || "unknown-error");
    return NextResponse.json({ error: "Unable to load events" }, { status: 500 });
  }
}

