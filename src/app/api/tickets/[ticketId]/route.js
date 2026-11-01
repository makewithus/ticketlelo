import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

/**
 * Public/attendee ticket details lookup
 * GET /api/tickets/[ticketId]
 */
export async function GET(request, { params }) {
  try {
    const { ticketId } = await params;

    if (!ticketId) {
      return NextResponse.json(
        { error: "Ticket ID is required" },
        { status: 400 }
      );
    }

    if (!adminDb) {
      return NextResponse.json(
        { error: "Ticket database service unavailable" },
        { status: 503 }
      );
    }

    // 1. Check tickets collection
    let ticket = null;
    const ticketDoc = await adminDb.collection("tickets").doc(ticketId).get();
    if (ticketDoc.exists) {
      ticket = { id: ticketDoc.id, ...ticketDoc.data() };
    } else {
      const qSnap = await adminDb
        .collection("tickets")
        .where("ticketId", "==", ticketId)
        .limit(1)
        .get();
      if (!qSnap.empty) {
        ticket = { id: qSnap.docs[0].id, ...qSnap.docs[0].data() };
      }
    }

    // 2. Check registrations collection
    let registration = null;
    const regSnap = await adminDb
      .collection("registrations")
      .where("ticketId", "==", ticketId)
      .limit(1)
      .get();
    if (!regSnap.empty) {
      registration = { id: regSnap.docs[0].id, ...regSnap.docs[0].data() };
    } else if (ticket) {
      registration = ticket;
    }

    if (!ticket && !registration) {
      return NextResponse.json(
        { error: "Ticket not found" },
        { status: 404 }
      );
    }

    const regData = registration || ticket;
    const eventId = regData.eventId;
    let event = null;

    if (eventId) {
      const eventDoc = await adminDb.collection("events").doc(eventId).get();
      if (eventDoc.exists) {
        event = { id: eventDoc.id, ...eventDoc.data() };
      }
    }

    // Serialize any Firestore Timestamps to ISO strings
    const serializedReg = {
      ...regData,
      date: regData.date?.toDate ? regData.date.toDate().toISOString() : regData.date,
      createdAt: regData.createdAt?.toDate ? regData.createdAt.toDate().toISOString() : regData.createdAt,
    };

    const serializedEvent = event
      ? {
          ...event,
          date: event.date?.toDate ? event.date.toDate().toISOString() : event.date,
          startDate: event.startDate?.toDate ? event.startDate.toDate().toISOString() : event.startDate,
          endDate: event.endDate?.toDate ? event.endDate.toDate().toISOString() : event.endDate,
        }
      : {
          name: regData.eventName || "Event Pass",
          location: "Main Auditorium",
          ticketDesign: "stub",
        };

    return NextResponse.json({
      success: true,
      ticket: serializedReg,
      event: serializedEvent,
    });
  } catch (error) {
    console.error("Fetch ticket API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch ticket", details: error.message },
      { status: 500 }
    );
  }
}
