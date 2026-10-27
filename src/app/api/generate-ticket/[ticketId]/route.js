import { NextResponse } from "next/server";
import { generatePDFTicket } from "@/lib/tickets";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { adminDb } from "@/lib/firebase-admin";

/**
 * API Route: Generate PDF ticket on-demand
 * GET /api/generate-ticket/[ticketId]
 */
export async function GET(request, { params }) {
  try {
    const caller = await getAuthenticatedUser(request);
    if (!caller) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    // Await params in Next.js 15+
    const { ticketId } = await params;

    if (!ticketId) {
      return NextResponse.json(
        { error: "Ticket ID is required" },
        { status: 400 },
      );
    }

    if (!adminDb) return NextResponse.json({ error: "Ticket service unavailable" }, { status: 503 });
    const ticketSnap = await adminDb.collection("tickets").doc(ticketId).get();
    const registrations = await adminDb.collection("registrations").where("ticketId", "==", ticketId).limit(1).get();
    if (!ticketSnap.exists && registrations.empty) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }
    const ticket = ticketSnap.exists ? ticketSnap.data() : null;
    const registration = registrations.empty
      ? { ...ticket, ticketId }
      : { id: registrations.docs[0].id, ...registrations.docs[0].data() };
    const ownerUid = registration.userId || ticket?.userId;
    const ownerEmail = String(registration.email || registration.buyerEmail || ticket?.buyerEmail || "").toLowerCase();
    const callerEmail = String(caller.email || "").toLowerCase();
    const isOwner = (ownerUid && ownerUid === caller.uid) ||
      (caller.decodedToken?.email_verified === true && ownerEmail && callerEmail === ownerEmail);
    if (!isOwner && caller.role !== "superAdmin") {
      return NextResponse.json({ error: "Ticket access denied" }, { status: 403 });
    }

    const eventSnap = await adminDb.collection("events").doc(registration.eventId).get();
    const event = eventSnap.exists ? { id: eventSnap.id, ...eventSnap.data() } : null;
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Generate PDF blob
    const pdfBlob = await generatePDFTicket(
      registration,
      event,
      registration.qrCode || ticket?.qrCodeUrl || ticket?.qrPayload,
    );

    // Convert blob to buffer for Next.js response
    const buffer = await pdfBlob.arrayBuffer();

    // Return PDF as downloadable file
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="ticket-${ticketId}.pdf"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("Generate ticket API error:", error);
    return NextResponse.json(
      { error: "Failed to generate ticket" },
      { status: 500 },
    );
  }
}
