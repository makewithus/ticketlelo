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
    description:
      typeof data.description === "string"
        ? data.description
        : data.description?.text || "",
    location: data.location || data.venue || "Location to be announced",
    date: parseEventDate(data),
    totalTickets: Number(data.totalTickets ?? data.capacity ?? 150),
    coverImage: data.coverImage || data.image || "",
    themeColor: data.themeColor || "#FE760B",
    price: data.price || (data.isPaid ? "Paid" : "Free"),
    isPaid: Boolean(data.isPaid),
    slug: data.slug || id,
  };
}

export async function GET() {
  try {
    if (!isFirebaseAdminReady()) {
      return NextResponse.json({ error: "Event service unavailable" }, { status: 503 });
    }

    const snapshot = await adminDb.collection("events").get();

    const events = snapshot.docs
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

    return NextResponse.json(
      { events },
      { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" } },
    );
  } catch (error) {
    console.error("Load active events failed:", error.code || "unknown-error");
    return NextResponse.json({ error: "Unable to load events" }, { status: 500 });
  }
}

