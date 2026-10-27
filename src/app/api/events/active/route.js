import { adminDb, isFirebaseAdminReady } from "@/lib/firebase-admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const PUBLIC_EVENT_FIELDS = [
  "name",
  "description",
  "location",
  "date",
  "totalTickets",
  "slug",
];

function serializePublicEvent(id, data) {
  const event = { id };

  for (const field of PUBLIC_EVENT_FIELDS) {
    const value = data[field];
    if (value === undefined || value === null) continue;
    event[field] = field === "date" && typeof value?.toDate === "function"
      ? value.toDate().toISOString()
      : value;
  }

  return event;
}

export async function GET() {
  try {
    if (!isFirebaseAdminReady()) {
      return NextResponse.json({ error: "Event service unavailable" }, { status: 503 });
    }

    const snapshot = await adminDb
      .collection("events")
      .where("isActive", "==", true)
      .get();

    const events = snapshot.docs.map((doc) =>
      serializePublicEvent(doc.id, doc.data()),
    );

    return NextResponse.json(
      { events },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
    );
  } catch (error) {
    console.error("Load active events failed:", error.code || "unknown-error");
    return NextResponse.json({ error: "Unable to load events" }, { status: 500 });
  }
}
