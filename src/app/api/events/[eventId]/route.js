import { adminDb, isFirebaseAdminReady } from "@/lib/firebase-admin";
import { NextResponse } from "next/server";

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

    const doc = await adminDb.collection("events").doc(eventId).get();
    if (!doc.exists) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
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
