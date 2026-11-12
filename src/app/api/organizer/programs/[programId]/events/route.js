import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { adminDb } from "@/lib/firebase-admin";
import {
  connectEventsToProgram,
  disconnectEventFromProgram,
  toggleEventReferral,
} from "@/lib/creator-campus/programs-service";

export async function GET(request, { params }) {
  try {
    const caller = await getAuthenticatedUser(request);
    if (!caller) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const { programId } = await params;
    if (!adminDb || !programId) {
      return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
    }

    const relSnap = await adminDb
      .collection("programEvents")
      .where("programId", "==", programId)
      .get();

    const connections = relSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // Fetch organizer's all available events for connection picker
    const eventsSnap = await adminDb
      .collection("events")
      .where("createdBy", "==", caller.uid)
      .get();

    const availableEvents = eventsSnap.docs.map((d) => ({
      id: d.id,
      name: d.data().name || d.data().title || "Untitled Event",
      slug: d.data().slug || d.id,
      date: d.data().date || d.data().startDate || null,
      isActive: d.data().isActive ?? true,
    }));

    return NextResponse.json({ success: true, connections, availableEvents });
  } catch (err) {
    console.error("[api/organizer/programs/[programId]/events GET] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to list connected events" }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const caller = await getAuthenticatedUser(request);
    if (!caller) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const { programId } = await params;
    const body = await request.json();
    const { action } = body;

    if (action === "connect") {
      const { eventIds = [] } = body;
      const connected = await connectEventsToProgram({
        programId,
        eventIds,
        organizerId: caller.uid,
      });
      return NextResponse.json({ success: true, connected });
    } else if (action === "disconnect") {
      const { eventId } = body;
      await disconnectEventFromProgram({
        programId,
        eventId,
        organizerId: caller.uid,
      });
      return NextResponse.json({ success: true, disconnected: eventId });
    } else if (action === "toggle") {
      const { eventId, referralEnabled } = body;
      await toggleEventReferral({
        programId,
        eventId,
        referralEnabled,
        organizerId: caller.uid,
      });
      return NextResponse.json({ success: true, eventId, referralEnabled });
    }

    return NextResponse.json({ error: "Invalid action. Supported: connect, disconnect, toggle" }, { status: 400 });
  } catch (err) {
    console.error("[api/organizer/programs/[programId]/events POST] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to update event connections" }, { status: 500 });
  }
}
