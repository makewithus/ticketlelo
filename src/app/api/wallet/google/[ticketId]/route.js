import { getAuthenticatedUser } from "@/lib/auth-server";
import { ownsResource } from "@/lib/access-policy";
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { generateGoogleWalletPass } from "@/lib/wallet";

export async function GET(request, { params }) {
  try {
    const caller = await getAuthenticatedUser(request);
    if (!caller) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    if (!adminDb) return NextResponse.json({ error: "Database service unavailable" }, { status: 503 });
    const { ticketId } = await params;
    if (!ticketId) {
      return NextResponse.json({ error: "ticketId is required" }, { status: 400 });
    }

    const ticketDoc = await adminDb.collection("tickets").doc(ticketId).get();
    if (!ticketDoc.exists) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const ticket = { id: ticketDoc.id, ...ticketDoc.data() };

    if (!ownsResource(caller, ticket)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    let event = {};
    if (ticket.eventId) {
      const eventDoc = await adminDb.collection("events").doc(ticket.eventId).get();
      if (eventDoc.exists) {
        event = eventDoc.data();
      }
    }

    const passResult = await generateGoogleWalletPass(ticket, event);

    if (!passResult.available) {
      return NextResponse.json({
        success: false,
        requiresCredentials: true,
        message: passResult.message,
        passStructure: passResult.passStructure,
      }, { status: 200 });
    }

    return NextResponse.json({
      success: true,
      passResult,
    });
  } catch (error) {
    console.error("[GOOGLE_WALLET_ERROR]", error?.message || error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
