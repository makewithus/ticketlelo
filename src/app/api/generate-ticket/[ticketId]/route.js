import { NextResponse } from "next/server";
import { getRegistrationByTicketId, getEvent } from "@/lib/firestore";
import { generatePDFTicket } from "@/lib/tickets";

/**
 * API Route: Generate PDF ticket on-demand
 * GET /api/generate-ticket/[ticketId]
 */
export async function GET(request, { params }) {
  try {
    // Await params in Next.js 15+
    const { ticketId } = await params;

    if (!ticketId) {
      return NextResponse.json(
        { error: "Ticket ID is required" },
        { status: 400 },
      );
    }

    // Fetch registration from Firestore
    const registration = await getRegistrationByTicketId(ticketId);

    if (!registration) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    // Fetch event details
    const event = await getEvent(registration.eventId);

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Generate PDF blob
    const pdfBlob = await generatePDFTicket(
      registration,
      event,
      registration.qrCode,
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
