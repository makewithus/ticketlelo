import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { getAuthenticatedUser } from "@/lib/auth-server";

export async function POST(request) {
  try {
    const caller = await getAuthenticatedUser(request);
    if (!caller) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (!adminDb) {
      return NextResponse.json({ error: "Database service unavailable" }, { status: 503 });
    }

    const { registrationId, action, customMessage = "", notifyGuest = true } = await request.json();

    if (!registrationId || !["approve", "decline"].includes(action)) {
      return NextResponse.json(
        { error: "Valid registrationId and action ('approve' or 'decline') are required" },
        { status: 400 }
      );
    }

    const regRef = adminDb.collection("registrations").doc(registrationId);
    const regSnap = await regRef.get();

    if (!regSnap.exists) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 });
    }

    const regData = regSnap.data();
    const eventId = regData.eventId;

    // Verify organizer permission on the event if eventId exists
    if (eventId) {
      const eventSnap = await adminDb.collection("events").doc(eventId).get();
      if (eventSnap.exists) {
        const evData = eventSnap.data();
        const isOrganizer =
          evData.createdBy === caller.uid ||
          evData.organizerId === caller.uid ||
          evData.organiserId === caller.uid ||
          caller.decodedToken?.role === "superAdmin" ||
          caller.email === "adil4ticketlelo@gmail.com";

        if (!isOrganizer) {
          return NextResponse.json(
            { error: "You do not have permission to manage guests for this event" },
            { status: 403 }
          );
        }
      }
    }

    const now = Timestamp.now();
    const isApprove = action === "approve";

    const regUpdates = {
      status: isApprove ? "Going" : "declined",
      approvalStatus: isApprove ? "approved" : "declined",
      notifyGuest: Boolean(notifyGuest),
      updatedAt: now,
    };

    if (isApprove) {
      regUpdates.approvedAt = now;
      if (customMessage) regUpdates.approvalMessage = customMessage.trim();
    } else {
      regUpdates.declinedAt = now;
      if (customMessage) regUpdates.declineMessage = customMessage.trim();
    }

    // Update registration doc
    await regRef.update(regUpdates);

    // If there is an associated ticketId, sync ticket status
    if (regData.ticketId) {
      const ticketRef = adminDb.collection("tickets").doc(regData.ticketId);
      const ticketSnap = await ticketRef.get();
      if (ticketSnap.exists) {
        await ticketRef.update({
          status: isApprove ? "Valid" : "Cancelled",
          approvalStatus: isApprove ? "approved" : "declined",
          updatedAt: now,
        });
      }
    }

    return NextResponse.json({
      success: true,
      action,
      status: regUpdates.status,
      approvalStatus: regUpdates.approvalStatus,
      registrationId,
    });
  } catch (error) {
    console.error("[api/registrations/approval] error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process approval request" },
      { status: 500 }
    );
  }
}
