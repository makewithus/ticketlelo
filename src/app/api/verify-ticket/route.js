import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { verifySignedQRPayload } from "@/lib/qr";
import { getAuthenticatedUser, canManageEventId } from "@/lib/auth-server";

/**
 * Gate Check-In & Sub-Event Entitlement Scanner Endpoint
 * Cryptographic signature verification, track entitlement gating, duplicate scan detection (P08, CHECKIN-001–015).
 */
export async function POST(req) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    if (!["organiser", "superAdmin"].includes(caller.role)) return NextResponse.json({ error: "Gate operator permission required" }, { status: 403 });
    if (!adminDb) return NextResponse.json({ error: "Ticket service unavailable" }, { status: 503 });
    // Note: If gate staff runs scanner in offline-sync or dev mode, caller can be authenticated or checked
    const { rawQRData, ticketId: inputTicketId, gateStationSubEventId = "main_gate", eventId } = await req.json();

    if (!rawQRData && !inputTicketId) {
      return NextResponse.json({ status: "invalid", message: "No QR data or ticket ID provided" }, { status: 400 });
    }

    let ticketId = null;

    // 1. Verify Cryptographic Signature if rawQRData provided
    if (rawQRData) {
      if (typeof rawQRData === "string" && rawQRData.startsWith("TLSEC:")) {
        const qrResult = verifySignedQRPayload(rawQRData);
        if (!qrResult.isValid) {
          return NextResponse.json({
            status: "invalid_signature",
            message: qrResult.error || "Cryptographic verification failed: Tampered QR code.",
          });
        }
        ticketId = qrResult.ticketId;
      } else {
        ticketId = typeof rawQRData === "string" ? rawQRData.trim() : String(rawQRData);
      }
    } else if (inputTicketId) {
      ticketId = String(inputTicketId).trim();
    }

    // 2. Fetch Ticket Document
    let ticket = null;
    let ticketRef = null;

    const directTicketSnap = await adminDb.collection("tickets").doc(ticketId).get();
    if (directTicketSnap.exists()) {
      ticket = { id: directTicketSnap.id, ...directTicketSnap.data() };
      ticketRef = directTicketSnap.ref;
    } else {
      // Fallback query by ticketId field
      const qSnap = await adminDb.collection("tickets").where("ticketId", "==", ticketId).limit(1).get();
      if (!qSnap.empty) {
        ticket = { id: qSnap.docs[0].id, ...qSnap.docs[0].data() };
        ticketRef = qSnap.docs[0].ref;
      }
    }

    if (!ticket) {
      // Also check registrations collection for backward compatibility
      const regSnap = await adminDb.collection("registrations").where("ticketId", "==", ticketId).limit(1).get();
      if (!regSnap.empty) {
        const regDoc = regSnap.docs[0];
        const regData = regDoc.data();
        ticket = {
          id: ticketId,
          eventId: regData.eventId,
          buyerName: regData.fullName,
          buyerEmail: regData.email,
          entitledSubEventIds: regData.entitledSubEventIds || [],
          status: regData.status,
          usedAt: regData.usedAt,
        };
        ticketRef = regDoc.ref;
      }
    }

    if (!ticket) {
      return NextResponse.json({
        status: "not_found",
        message: "Ticket not found in system database.",
      });
    }

    if (!await canManageEventId(caller, ticket.eventId)) return NextResponse.json({ error: "Forbidden: event access required" }, { status: 403 });
    if (eventId && ticket.eventId !== eventId) return NextResponse.json({ error: "Ticket belongs to another event" }, { status: 403 });

    if (gateStationSubEventId !== "main_gate") {
      const subEvent = await adminDb.collection("subEvents").doc(gateStationSubEventId).get();
      if (!subEvent.exists || subEvent.data().parentEventId !== ticket.eventId) {
        return NextResponse.json({ status: "unauthorized_track", message: "Gate station does not belong to this event." }, { status: 403 });
      }
    }

    // 3. Verify Revocation
    if (ticket.status === "Revoked") {
      return NextResponse.json({
        status: "revoked",
        message: "This ticket has been revoked by the event organizer.",
      });
    }

    // 4. Sub-Event Entitlement Gating Check
    const entitledSubEvents = Array.isArray(ticket.entitledSubEventIds)
      ? ticket.entitledSubEventIds
      : [];

    if (gateStationSubEventId !== "main_gate") {
      if (!entitledSubEvents.includes(gateStationSubEventId)) {
        return NextResponse.json({
          status: "unauthorized_track",
          attendee: ticket.buyerName,
          ticketTitle: ticket.ticketTitle || "Ticket",
          message: `Denied: Ticket does not include access to this sub-event track.`,
        });
      }
    }

    // 5. Duplicate Check-In Detection for Gate
    const now = Timestamp.now();
    const admission = await adminDb.runTransaction(async (transaction) => {
      const fresh = await transaction.get(ticketRef);
      if (!fresh.exists) return { status: "not_found" };
      const latest = fresh.data();
      if (latest.status === "Revoked") return { status: "revoked" };
      const checkIns = latest.checkIns || {};
      if (checkIns[gateStationSubEventId]) return { status: "already_used", prior: checkIns[gateStationSubEventId] };
      const checkin = { time: now, station: gateStationSubEventId, scannedBy: caller.uid };
      transaction.update(ticketRef, {
        checkIns: { ...checkIns, [gateStationSubEventId]: checkin },
        status: "Used",
        usedAt: now,
        updatedAt: now,
      });
      return { status: "admitted" };
    });
    if (admission.status !== "admitted") {
      const priorTime = admission.prior?.time?.toDate?.();
      const usedTime = priorTime ? priorTime.toLocaleTimeString("en-IN") : "Earlier";
      return NextResponse.json({ status: admission.status, attendee: ticket.buyerName, ticketTitle: ticket.ticketTitle || "Ticket", message: admission.status === "already_used" ? `Duplicate Scan: Already admitted at ${usedTime}.` : "Ticket is no longer valid." });
    }

    return NextResponse.json({
      status: "admitted",
      attendee: ticket.buyerName,
      email: ticket.buyerEmail,
      ticketTitle: ticket.ticketTitle || "Ticket",
      ticketId,
      gateStation: gateStationSubEventId,
      time: now.toDate().toLocaleTimeString("en-IN"),
      message: "Valid Ticket — Admission Granted",
    });
  } catch (error) {
    console.error("[verify-ticket] Error:", error.message);
    return NextResponse.json(
      { status: "error", message: error.message || "Failed to process scan" },
      { status: 500 }
    );
  }
}
