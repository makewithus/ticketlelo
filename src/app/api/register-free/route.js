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
    if (!email || submittedEmail !== email) {
      return NextResponse.json({ error: "Sign in with the email address used for registration" }, { status: 403 });
    }

    const eventRef = adminDb.collection("events").doc(eventId);
    const [eventSnap, formSnap] = await Promise.all([
      eventRef.get(),
      adminDb.collection("customForms").where("eventId", "==", eventId).limit(1).get(),
    ]);
    if (!eventSnap.exists) return NextResponse.json({ error: "Event not found" }, { status: 404 });
    const event = eventSnap.data();
    if (!(event.isPublished === true || event.published === true || event.status === "published")) {
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

    const identity = crypto.createHash("sha256").update(`${caller.uid}:${eventId}`).digest("hex");
    const registrationRef = adminDb.collection("registrations").doc(identity);
    const ticketId = `TKT-${identity.slice(0, 28).toUpperCase()}`;
    const ticketRef = adminDb.collection("tickets").doc(ticketId);
    const eventSlug = event.slug || eventId;
    const qrPayload = generateSignedQRPayload({ eventSlug, ticketId, entitledSubEventIds: [] });
    const qrCodeUrl = await generateQRCode(qrPayload);
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
      const current = currentEvent.data();
      const capacity = Number(current.globalCapacity || 0);
      const allocated = Number(current.allocatedSeats || 0);
      if (capacity > 0 && allocated >= capacity) throw new Error("Event capacity has been reached");

      transaction.create(ticketRef, {
        id: ticketId,
        ticketId,
        userId: caller.uid,
        eventId,
        eventTitle: event.title || event.name || "Event",
        eventSlug,
        ticketTitle: "Free Admission",
        quantity: 1,
        entitledSubEventIds: [],
        buyerName: fullName,
        buyerEmail: email,
        buyerPhone: phone,
        amountPaid: 0,
        qrPayload,
        qrCodeUrl,
        status: "Valid",
        checkIns: {},
        issuedAt: now,
        updatedAt: now,
      });
      transaction.create(registrationRef, {
        id: identity,
        ticketId,
        userId: caller.uid,
        eventId,
        fullName,
        email,
        whatsappPhone: phone,
        formData,
        status: "Unused",
        paymentStatus: "free",
        entitledSubEventIds: [],
        createdAt: now,
        updatedAt: now,
      });
      if (capacity > 0) transaction.update(eventRef, { allocatedSeats: allocated + 1, updatedAt: now });
      return { alreadyRegistered: false, ticketId };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error.message === "Event capacity has been reached") {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("[register-free] Registration failed:", error.code || "unexpected-error");
    return NextResponse.json({ error: "Could not complete free registration" }, { status: 500 });
  }
}
