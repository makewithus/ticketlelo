import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { validateFormSubmission } from "@/lib/form-validator";
import { generateQRCode, generateSignedQRPayload } from "@/lib/qr";
import { sendTicketDeliveryEmail } from "@/src/app/api/send-ticket-email/route";

export async function POST(request) {
  try {
    const caller = await getAuthenticatedUser(request);
    if (!adminDb) return NextResponse.json({ error: "Registration service unavailable" }, { status: 503 });

    const { eventId, formData = {} } = await request.json();
    if (typeof eventId !== "string" || !eventId || !formData || typeof formData !== "object" || Array.isArray(formData)) {
      return NextResponse.json({ error: "A valid event and form response are required" }, { status: 400 });
    }

    const callerEmail = String(caller?.email || "").trim().toLowerCase();
    const submittedEmail = String(
      formData.email ||
      Object.values(formData).find((value) => typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) ||
      ""
    ).trim().toLowerCase();

    let email = callerEmail;
    if (!email) {
      if (!submittedEmail) {
        return NextResponse.json({ error: "A valid email address is required to register" }, { status: 400 });
      }
      email = submittedEmail;
    } else if (submittedEmail && submittedEmail !== email) {
      return NextResponse.json({ error: "Sign in with the email address used for registration" }, { status: 403 });
    }

    const fullName = String(
      formData.fullName || formData.name || caller?.decodedToken?.name || "Attendee"
    ).trim().slice(0, 120);
    const phone = String(formData.whatsappPhone || formData.phone || "").trim().slice(0, 32);

    // Resolve user UID and first-time status
    let userUid = caller?.uid;
    let isFirstTimeUser = false;
    let setupToken = "";

    if (userUid) {
      // Authenticated user
      try {
        const userDoc = await adminDb.collection("users").doc(userUid).get();
        if (userDoc.exists) {
          const uData = userDoc.data();
          if (uData.hasSetPassword === false || uData.isFirstTimeUser === true) {
            isFirstTimeUser = true;
          }
        }
      } catch (checkErr) {
        console.warn("[register-free] User doc check error:", checkErr?.message);
      }
    } else {
      // Guest visitor: check if an account exists in Firebase Auth
      try {
        const existingUser = await adminAuth.getUserByEmail(email);
        userUid = existingUser.uid;
        try {
          const userDoc = await adminDb.collection("users").doc(userUid).get();
          if (userDoc.exists) {
            const uData = userDoc.data();
            if (uData.hasSetPassword === false) {
              isFirstTimeUser = true;
            }
          }
        } catch {}
      } catch (authErr) {
        if (authErr.code === "auth/user-not-found") {
          // New guest user: create account in Firebase Auth
          isFirstTimeUser = true;
          const initialSecret = crypto.randomBytes(32).toString("base64url");
          const newUser = await adminAuth.createUser({
            email,
            displayName: fullName,
            password: initialSecret,
          });
          userUid = newUser.uid;

          // Create initial user doc in Firestore
          await adminDb.collection("users").doc(userUid).set({
            id: userUid,
            email,
            fullName,
            whatsappPhone: phone,
            createdAt: Timestamp.now(),
            isAdmin: false,
            role: "user",
            hasSetPassword: false,
            isFirstTimeUser: true,
          }, { merge: true });
        } else {
          throw authErr;
        }
      }
    }

    // Generate setup token if first-time user
    if (isFirstTimeUser) {
      setupToken = crypto.randomBytes(24).toString("hex");
      const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days validity
      await adminDb.collection("accountSetupTokens").doc(email).set({
        token: setupToken,
        email,
        userId: userUid,
        createdAt: Date.now(),
        expiresAt,
        used: false,
      }, { merge: true });
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
    const parseSafePrice = (val) => {
      if (typeof val === "number") return isNaN(val) ? 0 : Math.max(0, val);
      if (!val) return 0;
      const cleaned = String(val).replace(/[^0-9.]/g, "");
      const num = parseFloat(cleaned);
      return isNaN(num) ? 0 : Math.max(0, num);
    };
    const eventNumericPrice = parseSafePrice(event.ticketPrice ?? event.price ?? event.amount ?? form?.amount ?? 0);
    if (event.isPaid === true || form?.isPaid === true || eventNumericPrice > 0) {
      return NextResponse.json({ error: "This event requires paid checkout" }, { status: 409 });
    }
    if (form?.fields && Array.isArray(form.fields)) {
      const validation = validateFormSubmission(form.fields, formData, []);
      if (!validation.isValid) return NextResponse.json({ error: "Form validation failed", fields: validation.errors }, { status: 400 });
    }

    const identity = crypto.createHash("sha256").update(`${userUid}:${actualEventId}`).digest("hex");
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
        userId: userUid,
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
        userId: userUid,
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

    // Enqueue branded confirmation email directly from the server
    if (!result.requiresApproval) {
      try {
        await sendTicketDeliveryEmail({
          ticketId: result.ticketId,
          isFirstTimeUser,
          setupToken,
        });
      } catch (emailErr) {
        console.warn("[register-free] Background email delivery enqueue warning:", emailErr?.message);
      }
    }

    return NextResponse.json({ success: true, ...result, isFirstTimeUser });
  } catch (error) {
    if (error.message === "Event capacity has been reached") {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("[register-free] Registration failed:", error?.message || error, error?.stack);
    return NextResponse.json({ error: error?.message || "Could not complete free registration" }, { status: 500 });
  }
}
