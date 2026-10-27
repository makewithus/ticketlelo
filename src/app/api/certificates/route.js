import { adminDb } from "@/lib/firebase-admin";
import { ownsResource, managesEvent } from "@/lib/access-policy";
import { NextResponse } from "next/server";
import { issueCertificate } from "@/lib/certificates";
import { getAuthenticatedUser } from "@/lib/auth-server";

/**
 * Certificate Issuance Endpoint
 * POST /api/certificates
 * Body: { ticketId, subEventId, subEventTitle }
 */
export async function POST(request) {
  try {
    const caller = await getAuthenticatedUser(request);
    if (!caller) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const body = await request.json();
    const { ticketId, subEventId, subEventTitle } = body;

    if (!ticketId) {
      return NextResponse.json({ error: "ticketId is required" }, { status: 400 });
    }

    if (!adminDb) return NextResponse.json({ error: "Database service unavailable" }, { status: 503 });
    const ticketDoc = await adminDb.collection("tickets").doc(ticketId).get();
    if (!ticketDoc.exists) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    const ticket = ticketDoc.data();
    let permitted = ownsResource(caller, ticket);
    if (!permitted && ticket.eventId) {
      const eventDoc = await adminDb.collection("events").doc(ticket.eventId).get();
      permitted = eventDoc.exists && managesEvent(caller, eventDoc.data());
    }
    if (!permitted) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const certificate = await issueCertificate({
      ticketId,
      subEventId,
      subEventTitle,
    });

    return NextResponse.json({
      success: true,
      certificate,
    });
  } catch (error) {
    console.error("[api/certificates] Error:", error.message);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to issue certificate" },
      { status: 400 }
    );
  }
}
