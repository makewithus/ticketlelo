import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { adminDb } from "@/lib/firebase-admin";
import {
  connectEventsToProgram,
  disconnectEventFromProgram,
  toggleEventReferral,
} from "@/lib/creator-campus/programs-service";

function formatTimestampToString(raw) {
  if (!raw) return null;
  if (typeof raw === "string") return raw;
  if (typeof raw?.toDate === "function") {
    try {
      const d = raw.toDate();
      if (!isNaN(d.getTime())) return d.toISOString();
    } catch {}
  }
  if (typeof raw?.seconds === "number") return new Date(raw.seconds * 1000).toISOString();
  if (typeof raw?._seconds === "number") return new Date(raw._seconds * 1000).toISOString();
  if (raw instanceof Date) return raw.toISOString();
  return null;
}

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

    // Fetch program details to check title / organizer
    let programData = null;
    try {
      const progDoc = await adminDb.collection("ambassadorPrograms").doc(programId).get();
      if (progDoc.exists) {
        programData = progDoc.data();
      }
    } catch (pErr) {
      console.warn("Could not load program info:", pErr?.message);
    }

    const availableEventsMap = new Map();

    // 1. Fetch organizer's events
    let eventsSnap = await adminDb
      .collection("events")
      .where("createdBy", "==", caller.uid)
      .get();

    if (eventsSnap.empty) {
      eventsSnap = await adminDb
        .collection("events")
        .where("organizerId", "==", caller.uid)
        .get();
    }

    eventsSnap.docs.forEach((d) => {
      const ed = d.data();
      if (ed.status !== "deleted") {
        availableEventsMap.set(d.id, {
          id: d.id,
          name: ed.name || ed.title || "Untitled Event",
          title: ed.name || ed.title || "Untitled Event",
          slug: ed.customSlug || ed.slug || d.id,
          date: formatTimestampToString(ed.date || ed.startDate),
          isActive: ed.isActive ?? true,
        });
      }
    });

    // 2. Also search for events matching the program title (e.g. "Praroha" matches "Praroha Gaming")
    if (programData) {
      const progTitle = (programData.title || programData.name || "").trim().toLowerCase();
      if (progTitle) {
        try {
          const allEvtsSnap = await adminDb.collection("events").get();
          allEvtsSnap.docs.forEach((d) => {
            const ed = d.data();
            const eName = (ed.name || ed.title || "").trim().toLowerCase();
            if (
              ed.status !== "deleted" &&
              (eName.includes(progTitle) || progTitle.includes(eName))
            ) {
              if (!availableEventsMap.has(d.id)) {
                availableEventsMap.set(d.id, {
                  id: d.id,
                  name: ed.name || ed.title || "Untitled Event",
                  title: ed.name || ed.title || "Untitled Event",
                  slug: ed.customSlug || ed.slug || d.id,
                  date: formatTimestampToString(ed.date || ed.startDate),
                  isActive: ed.isActive ?? true,
                });
              }
            }
          });
        } catch (matchErr) {
          console.warn("Could not match title events:", matchErr?.message);
        }
      }
    }

    const availableEvents = Array.from(availableEventsMap.values());

    return NextResponse.json({
      success: true,
      connections,
      connectedEvents: connections,
      availableEvents,
    });
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
    let { action } = body;

    // Auto-infer action if not explicitly supplied
    if (!action) {
      if (body.eventId && (body.enableReferral !== undefined || body.referralEnabled !== undefined)) {
        action = "toggle";
      } else if (body.eventId || (Array.isArray(body.eventIds) && body.eventIds.length > 0)) {
        action = "connect";
      }
    }

    if (action === "connect") {
      const eventIds = Array.isArray(body.eventIds)
        ? body.eventIds
        : body.eventId
        ? [body.eventId]
        : [];

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
      const { eventId } = body;
      const referralEnabled = body.referralEnabled !== undefined ? body.referralEnabled : body.enableReferral;
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

