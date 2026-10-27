import { ownsResource } from "@/lib/access-policy";
import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { verifyWebinarAccess } from "@/lib/webinars";
import { getAuthenticatedUser } from "@/lib/auth-server";

/**
 * Protected Webinar Access Endpoint
 * POST /api/webinars/access
 * Body: { ticketId, subEventId }
 */
export async function POST(request) {
  try {
    const caller = await getAuthenticatedUser(request);
    if (!caller) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const { ticketId, subEventId } = await request.json();

    if (!ticketId || !subEventId) {
      return NextResponse.json(
        { error: "Both ticketId and subEventId are required." },
        { status: 400 }
      );
    }

    // 1. Fetch Ticket
    const ticketSnap = await getDoc(doc(db, "tickets", ticketId));
    if (!ticketSnap.exists()) {
      return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
    }
    const ticket = { id: ticketSnap.id, ...ticketSnap.data() };

    if (!ownsResource(caller, ticket)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // 2. Fetch Sub-Event
    const subEventSnap = await getDoc(doc(db, "subEvents", subEventId));
    if (!subEventSnap.exists()) {
      return NextResponse.json({ error: "Sub-event not found." }, { status: 404 });
    }
    const subEvent = { id: subEventSnap.id, ...subEventSnap.data() };

    // 3. Verify Entitlement & 15-Minute Rule
    const result = verifyWebinarAccess({
      ticket,
      subEvent,
      currentTime: new Date(),
    });

    if (!result.authorized) {
      return NextResponse.json(
        {
          authorized: false,
          reason: result.reason,
          isScheduled: result.isScheduled || false,
          minutesUntilOpen: result.minutesUntilOpen || null,
          startsAt: result.startsAt || null,
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      authorized: true,
      provider: result.provider,
      meetingUrl: result.meetingUrl,
      meetingPasscode: result.meetingPasscode,
      sessionTitle: result.sessionTitle,
      instructions: result.instructions,
    });
  } catch (error) {
    console.error("[webinars/access] Error:", error.message);
    return NextResponse.json(
      { error: error.message || "Failed to verify webinar access" },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  try {
    const caller = await getAuthenticatedUser(request);
    if (!caller) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const ticketId = searchParams.get("ticketId");
    const subEventId = searchParams.get("subEventId");

    if (!ticketId || !subEventId) {
      return NextResponse.json(
        { error: "Both ticketId and subEventId are required." },
        { status: 400 }
      );
    }

    const ticketSnap = await getDoc(doc(db, "tickets", ticketId));
    if (!ticketSnap.exists()) {
      return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
    }
    const ticket = { id: ticketSnap.id, ...ticketSnap.data() };

    if (!ownsResource(caller, ticket)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const subEventSnap = await getDoc(doc(db, "subEvents", subEventId));
    if (!subEventSnap.exists()) {
      return NextResponse.json({ error: "Sub-event not found." }, { status: 404 });
    }
    const subEvent = { id: subEventSnap.id, ...subEventSnap.data() };

    const result = verifyWebinarAccess({
      ticket,
      subEvent,
      currentTime: new Date(),
    });

    if (!result.authorized) {
      return NextResponse.json(
        {
          authorized: false,
          reason: result.reason,
          isScheduled: result.isScheduled || false,
          minutesUntilOpen: result.minutesUntilOpen || null,
          startsAt: result.startsAt || null,
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      authorized: true,
      provider: result.provider,
      meetingUrl: result.meetingUrl,
      meetingPasscode: result.meetingPasscode,
      sessionTitle: result.sessionTitle,
      instructions: result.instructions,
    });
  } catch (error) {
    console.error("[webinars/access] GET Error:", error.message);
    return NextResponse.json(
      { error: error.message || "Failed to verify webinar access" },
      { status: 500 }
    );
  }
}

