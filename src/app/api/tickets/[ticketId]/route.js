import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getAuthenticatedUser, canManageEventId } from "@/lib/auth-server";

/**
 * Attendee Ticket Details Endpoint (Server-Side Ownership Enforced)
 * GET /api/tickets/[ticketId]
 *
 * Requirements:
 * - R65: Ticket ownership validated server-side.
 * - R66: Another user cannot see a ticket.
 * - SEC-2: Only the owning attendee, managing organizer, or SuperAdmin may view details and QR code.
 */
export async function GET(request, { params }) {
  try {
    const { ticketId } = await params;

    if (!ticketId || typeof ticketId !== "string") {
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

    // 1. Authenticate caller (SEC-2, R65)
    const caller = await getAuthenticatedUser(request);
    if (!caller) {
      return NextResponse.json(
        { error: "Authentication required to view ticket details." },
        { status: 401 }
      );
    }

    // 2. Fetch ticket from tickets collection
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
      } else {
        const cleanCandidate = ticketId.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
        if (cleanCandidate.length >= 8) {
          const prefix = `TKT-${cleanCandidate.slice(0, 8)}`;
          const legacySnap = await adminDb
            .collection("tickets")
            .where("ticketId", ">=", prefix)
            .where("ticketId", "<=", prefix + "\uf8ff")
            .limit(1)
            .get();
          if (!legacySnap.empty) {
            ticket = { id: legacySnap.docs[0].id, ...legacySnap.docs[0].data() };
          }
        }
      }
    }

    // 3. Fetch registration from registrations collection
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
    } else {
      const cleanCandidate = ticketId.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
      if (cleanCandidate.length >= 8) {
        const prefix = `TKT-${cleanCandidate.slice(0, 8)}`;
        const legacyRegSnap = await adminDb
          .collection("registrations")
          .where("ticketId", ">=", prefix)
          .where("ticketId", "<=", prefix + "\uf8ff")
          .limit(1)
          .get();
        if (!legacyRegSnap.empty) {
          registration = { id: legacyRegSnap.docs[0].id, ...legacyRegSnap.docs[0].data() };
        }
      }
    }

    if (!ticket && !registration) {
      return NextResponse.json(
        { error: "Ticket not found" },
        { status: 404 }
      );
    }

    const regData = registration || ticket;
    const eventId = regData.eventId;

    // 4. Authorize caller (R65, R66, SEC-2)
    const ticketOwnerUid = regData.userId || ticket?.userId;
    const ticketBuyerEmail = String(
      regData.email || regData.buyerEmail || ticket?.buyerEmail || ""
    ).toLowerCase().trim();
    const callerEmail = String(caller.email || "").toLowerCase().trim();
    const callerEmailVerified = caller.decodedToken?.email_verified === true;

    const isOwner =
      Boolean(ticketOwnerUid && ticketOwnerUid === caller.uid) ||
      Boolean(callerEmailVerified && ticketBuyerEmail && ticketBuyerEmail === callerEmail);

    let isOrganiser = false;
    if (!isOwner && caller.role !== "superAdmin" && eventId) {
      isOrganiser = await canManageEventId(caller, eventId);
    }

    const isSuperAdmin = caller.role === "superAdmin";

    if (!isOwner && !isOrganiser && !isSuperAdmin) {
      return NextResponse.json(
        { error: "Access denied: you do not have permission to view this ticket." },
        { status: 403 }
      );
    }

    // 5. Fetch associated event
    let event = null;
    if (eventId) {
      const eventDoc = await adminDb.collection("events").doc(eventId).get();
      if (eventDoc.exists) {
        event = { id: eventDoc.id, ...eventDoc.data() };
      }
    }

    // 6. Serialize Timestamps cleanly
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
          location: regData.venue || regData.location || "Venue details to be announced",
          ticketDesign: regData.ticketDesign || "stub",
        };

    return NextResponse.json({
      success: true,
      ticket: serializedReg,
      event: serializedEvent,
    });
  } catch (error) {
    console.error("Fetch ticket API error:", error);
    return NextResponse.json(
      { error: "Could not retrieve ticket details. Please try again." },
      { status: 500 }
    );
  }
}
