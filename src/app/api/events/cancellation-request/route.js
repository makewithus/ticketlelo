import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { getAuthenticatedUser } from "@/lib/auth-server";

/**
 * API route for Paid Event Cancellation Requests:
 * POST: Organiser submits a cancellation ticket with a required valid reason to Super Admin.
 * GET: Super Admin retrieves all pending / reviewed cancellation requests.
 * PATCH: Super Admin approves or rejects the cancellation request.
 */

export async function POST(request) {
  try {
    const caller = await getAuthenticatedUser(request);
    if (!caller) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (!adminDb) {
      return NextResponse.json({ error: "Database service unavailable" }, { status: 503 });
    }

    const body = await request.json();
    const { eventId, reason } = body || {};

    if (!eventId || typeof eventId !== "string") {
      return NextResponse.json({ error: "A valid event ID is required" }, { status: 400 });
    }

    const cleanReason = String(reason || "").trim();
    if (!cleanReason || cleanReason.length < 10) {
      return NextResponse.json(
        { error: "Please provide a detailed and valid reason for cancellation (minimum 10 characters)" },
        { status: 400 }
      );
    }

    const eventRef = adminDb.collection("events").doc(eventId);
    const eventSnap = await eventRef.get();
    if (!eventSnap.exists) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const eventData = eventSnap.data();

    // Verify caller is event owner or super admin
    const isOwner = eventData.organiserId === caller.uid || eventData.creatorId === caller.uid;
    const isSuperAdmin = caller.role === "superAdmin";
    if (!isOwner && !isSuperAdmin) {
      return NextResponse.json({ error: "You do not have permission to manage this event" }, { status: 403 });
    }

    const now = Timestamp.now();
    const isoDate = new Date().toISOString();

    const requestPayload = {
      eventId,
      eventTitle: eventData.name || eventData.title || "Event",
      eventSlug: eventData.slug || eventId,
      organizerId: caller.uid,
      organizerName: caller.decodedToken?.name || caller.email || "Organiser",
      organizerEmail: caller.email || "",
      reason: cleanReason,
      ticketPrice: eventData.price || eventData.ticketPrice || 0,
      ticketsSold: Number(eventData.ticketsSold || eventData.registrationsCount || 0),
      isPaid: Boolean(eventData.isPaid || Number(eventData.price || eventData.ticketPrice || 0) > 0),
      status: "pending",
      createdAt: now,
      requestedAt: isoDate,
    };

    const docRef = await adminDb.collection("cancellationRequests").add(requestPayload);

    // Update event doc with pending cancellation request
    await eventRef.update({
      cancellationRequest: {
        id: docRef.id,
        status: "pending",
        reason: cleanReason,
        requestedAt: isoDate,
        requestedBy: caller.email,
      },
      updatedAt: now,
    });

    return NextResponse.json({
      success: true,
      requestId: docRef.id,
      message: "Cancellation ticket submitted to Super Admin for approval",
    });
  } catch (error) {
    console.error("[cancellation-request] POST error:", error);
    return NextResponse.json({ error: error.message || "Failed to submit cancellation request" }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const caller = await getAuthenticatedUser(request);
    if (!caller) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (!adminDb) {
      return NextResponse.json({ error: "Database service unavailable" }, { status: 503 });
    }

    // Only super admins or organizers querying their own requests
    const isSuperAdmin = caller.role === "superAdmin";
    let queryRef = adminDb.collection("cancellationRequests");

    if (!isSuperAdmin) {
      queryRef = queryRef.where("organizerId", "==", caller.uid);
    }

    const snapshot = await queryRef.get();
    const requests = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate ? d.data().createdAt.toDate().toISOString() : d.data().requestedAt,
    }));

    // Sort newest first
    requests.sort((a, b) => new Date(b.requestedAt || b.createdAt || 0) - new Date(a.requestedAt || a.createdAt || 0));

    return NextResponse.json({ success: true, requests });
  } catch (error) {
    console.error("[cancellation-request] GET error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch cancellation requests" }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const caller = await getAuthenticatedUser(request);
    if (!caller || caller.role !== "superAdmin") {
      return NextResponse.json({ error: "Super Admin privileges required to review cancellation tickets" }, { status: 403 });
    }
    if (!adminDb) {
      return NextResponse.json({ error: "Database service unavailable" }, { status: 503 });
    }

    const { requestId, action, rejectionReason } = await request.json();
    if (!requestId || !["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "Valid requestId and action ('approve' or 'reject') required" }, { status: 400 });
    }

    const requestRef = adminDb.collection("cancellationRequests").doc(requestId);
    const requestSnap = await requestRef.get();
    if (!requestSnap.exists) {
      return NextResponse.json({ error: "Cancellation ticket not found" }, { status: 404 });
    }

    const reqData = requestSnap.data();
    const eventRef = adminDb.collection("events").doc(reqData.eventId);
    const now = Timestamp.now();
    const isoDate = new Date().toISOString();

    if (action === "approve") {
      // 1. Mark request approved
      await requestRef.update({
        status: "approved",
        reviewedBy: caller.email,
        reviewedAt: now,
      });

      // 2. Mark event cancelled in real time
      await eventRef.update({
        status: "cancelled",
        isCancelled: true,
        registrationClosed: true,
        closeRegistrationEnabled: true,
        closeRegistrationMode: "now",
        registrationStatus: "Closed",
        cancelledAt: isoDate,
        cancellationApprovedBy: caller.email,
        cancellationRequest: {
          id: requestId,
          status: "approved",
          approvedAt: isoDate,
          reviewedBy: caller.email,
        },
        updatedAt: now,
      });

      return NextResponse.json({
        success: true,
        message: "Paid event cancellation approved. Event status marked cancelled in real-time.",
      });
    } else {
      // Reject request
      const note = String(rejectionReason || "Cancellation request rejected by Super Admin").trim();
      await requestRef.update({
        status: "rejected",
        rejectionReason: note,
        reviewedBy: caller.email,
        reviewedAt: now,
      });

      await eventRef.update({
        cancellationRequest: {
          id: requestId,
          status: "rejected",
          rejectionReason: note,
          rejectedAt: isoDate,
          reviewedBy: caller.email,
        },
        updatedAt: now,
      });

      return NextResponse.json({
        success: true,
        message: "Cancellation ticket rejected.",
      });
    }
  } catch (error) {
    console.error("[cancellation-request] PATCH error:", error);
    return NextResponse.json({ error: error.message || "Failed to process cancellation request" }, { status: 500 });
  }
}
