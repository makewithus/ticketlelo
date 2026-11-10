import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { validateFormSubmission } from "@/lib/form-validator";
import { generateQRCode, generateSignedQRPayload } from "@/lib/qr";

export async function POST(request) {
  try {
    const caller = await getAuthenticatedUser(request);
    if (!caller) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    if (!adminDb) return NextResponse.json({ error: "Registration service unavailable" }, { status: 503 });

    const { eventId, formData = {} } = await request.json();
    if (typeof eventId !== "string" || !eventId || !formData || typeof formData !== "object" || Array.isArray(formData)) {
      return NextResponse.json({ error: "A valid event and form response are required" }, { status: 400 });
    }
    const email = String(caller.email || "").trim().toLowerCase();
    const submittedEmail = String(formData.email || Object.values(formData).find((value) => typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) || "").trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "Sign in with a valid email to register" }, { status: 401 });
    }
    if (submittedEmail && submittedEmail !== email) {
      return NextResponse.json({ error: "Sign in with the email address used for registration" }, { status: 403 });
    }

    let eventRef = adminDb.collection("events").doc(eventId);
    let [eventSnap, formSnap] = await Promise.all([
      eventRef.get(),
      adminDb.collection("customForms").where("eventId", "==", eventId).limit(1).get(),
    ]);
    let actualEventId = eventId;
    if (!eventSnap.exists) {
      // Handle case where eventId passed is actually the event slug
      const slugQuery = await adminDb.collection("events").where("slug", "==", eventId).limit(1).get();
      if (!slugQuery.empty) {
        eventSnap = slugQuery.docs[0];
        actualEventId = eventSnap.id;
        eventRef = adminDb.collection("events").doc(actualEventId);
        if (formSnap.empty) {
          formSnap = await adminDb.collection("customForms").where("eventId", "==", actualEventId).limit(1).get();
        }
      }
    }
    if (!eventSnap.exists) return NextResponse.json({ error: "Event not found" }, { status: 404 });
    const event = eventSnap.data();
    if (event.status === "cancelled" || event.isCancelled) {
      return NextResponse.json({ error: "This event has been cancelled. Registrations are closed." }, { status: 409 });
    }
    if (event.closeRegistrationEnabled && event.closeRegistrationMode === "now") {
      return NextResponse.json({ error: "Registration is closed for this event." }, { status: 409 });
    }
    if (event.closeRegistrationEnabled && event.closeRegistrationMode === "capacity" && typeof event.closeRegistrationCapacity === "number") {
      const curAllocated = Number(event.allocatedSeats || 0);
      if (curAllocated >= Number(event.closeRegistrationCapacity)) {
        return NextResponse.json({ error: "Registration capacity reached. This event is closed for registration." }, { status: 409 });
      }
    }
    const isEventOpen =
      event.isPublished === true ||
      event.published === true ||
      event.status === "published" ||
      event.status === "live" ||
      event.status === "active" ||
      event.isActive === true;
    if (!isEventOpen) {
      return NextResponse.json({ error: "Event registration is not open" }, { status: 409 });
    }
    const form = formSnap.empty ? null : formSnap.docs[0].data();
    if (event.isPaid === true || form?.isPaid === true || Number(event.ticketPrice || event.price || event.amount || form?.amount || 0) > 0) {
      return NextResponse.json({ error: "This event requires paid checkout" }, { status: 409 });
    }
    if (form?.fields && Array.isArray(form.fields)) {
      const validation = validateFormSubmission(form.fields, formData, []);
      if (!validation.isValid) return NextResponse.json({ error: "Form validation failed", fields: validation.errors }, { status: 400 });
    }

    const identity = crypto.createHash("sha256").update(`${caller.uid}:${actualEventId}`).digest("hex");
    const registrationRef = adminDb.collection("registrations").doc(identity);
    const ticketId = `TKT-${identity.slice(0, 28).toUpperCase()}`;
    const ticketRef = adminDb.collection("tickets").doc(ticketId);
    const eventSlug = event.slug || actualEventId;

    let qrPayload;
    try {
      qrPayload = generateSignedQRPayload({ eventSlug, ticketId, entitledSubEventIds: [] });
    } catch (qrErr) {
      console.warn("[register-free] QR payload signing fallback:", qrErr?.message);
      qrPayload = ticketId;
    }

    let qrCodeUrl;
    try {
      qrCodeUrl = await generateQRCode(qrPayload);
    } catch (qrCodeErr) {
      console.warn("[register-free] QR code data URL generation fallback:", qrCodeErr?.message);
      try {
        qrCodeUrl = await generateQRCode(ticketId);
      } catch {
        qrCodeUrl = "";
      }
    }

    const fullName = String(formData.fullName || formData.name || caller.decodedToken?.name || "Attendee").trim().slice(0, 120);
    const phone = String(formData.whatsappPhone || formData.phone || "").trim().slice(0, 32);
    const now = Timestamp.now();

    const result = await adminDb.runTransaction(async (transaction) => {
      const [existingRegistration, currentEvent] = await Promise.all([
        transaction.get(registrationRef),
        transaction.get(eventRef),
      ]);
      if (existingRegistration.exists) {
        return { alreadyRegistered: true, ticketId: existingRegistration.data().ticketId };
      }
      const current = currentEvent.data() || {};
      const capacity = Number(current.globalCapacity || 0);
      const allocated = Number(current.allocatedSeats || 0);
      if (capacity > 0 && allocated >= capacity) throw new Error("Event capacity has been reached");

      const requiresApproval = Boolean(event.requireApproval || current.requireApproval);
      const initialStatus = requiresApproval ? "pending" : "Unused";
      const initialApprovalStatus = requiresApproval ? "pending" : "approved";
      const initialTicketStatus = requiresApproval ? "Pending Approval" : "Valid";

      transaction.set(ticketRef, {
        id: ticketId,
        ticketId,
        userId: caller.uid,
        eventId: actualEventId,
        eventTitle: event.title || event.name || "Event",
        eventSlug,
        ticketTitle: "Free Admission",
        quantity: 1,
        entitledSubEventIds: [],
        buyerName: fullName,
        buyerEmail: email,
        buyerPhone: phone,
        amountPaid: 0,
        ticketDesign: event.ticketDesign || current.ticketDesign || "stub",
        qrPayload,
        qrCodeUrl,
        status: initialTicketStatus,
        requireApproval: requiresApproval,
        checkIns: {},
        issuedAt: now,
        updatedAt: now,
      }, { merge: true });

      transaction.set(registrationRef, {
        id: identity,
        ticketId,
        userId: caller.uid,
        eventId: actualEventId,
        fullName,
        email,
        whatsappPhone: phone,
        formData: formData || {},
        customFieldResponses: formData || {},
        status: initialStatus,
        approvalStatus: initialApprovalStatus,
        requireApproval: requiresApproval,
        paymentStatus: "free",
        ticketDesign: event.ticketDesign || current.ticketDesign || "stub",
        entitledSubEventIds: [],
        qrCode: qrCodeUrl,
        qrPayload,
        createdAt: now,
        updatedAt: now,
      }, { merge: true });

      const updateData = {
        registrationsCount: (current.registrationsCount || 0) + 1,
        ticketsSold: (current.ticketsSold || 0) + 1,
        updatedAt: now,
      };
      if (capacity > 0) {
        updateData.allocatedSeats = allocated + 1;
      }
      transaction.update(eventRef, updateData);
      return { alreadyRegistered: false, ticketId, requiresApproval };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error.message === "Event capacity has been reached") {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("[register-free] Registration failed:", error?.message || error, error?.stack);
    return NextResponse.json({ error: error?.message || "Could not complete free registration" }, { status: 500 });
  }
}
