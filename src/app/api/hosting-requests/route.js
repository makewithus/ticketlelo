import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { Timestamp } from "firebase-admin/firestore";
import { enqueueEmail } from "@/lib/email/queue";
import { buildHostingConfirmEmail } from "@/lib/email/templates/hosting-confirm";
import { EmailPriority, EmailType } from "@/lib/email/types";
import path from "path";
import fs from "fs";

export const dynamic = "force-dynamic";

/**
 * GET /api/hosting-requests
 * Fetch all hosting requests using Admin SDK (bypasses Firestore rules).
 * Used by the admin dashboard.
 */
export async function GET(request) {
  try {
    const caller = await getAuthenticatedUser(request);
    if (!caller) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    if (!adminDb) {
      // Fallback when Admin SDK is not initialized
      return NextResponse.json({ error: "Hosting request service unavailable", requests: [] }, { status: 503 });
    }

    let snapshot;
    if (caller.role === "superAdmin") {
      snapshot = await adminDb
        .collection("hostingRequests")
        .orderBy("createdAt", "desc")
        .get();
    } else {
      // Organisers and attendees only see hosting requests matching their email
      const callerEmail = (caller.email || "").toLowerCase().trim();
      snapshot = await adminDb
        .collection("hostingRequests")
        .where("email", "==", callerEmail)
        .get();
    }

    const requests = snapshot.docs.map((doc) => {
      const data = doc.data();
      // Serialize Firestore Timestamps to ISO strings so they are JSON-safe
      return {
        id: doc.id,
        ...data,
        createdAt:
          data.createdAt?.toDate?.()?.toISOString() ?? data.createdAt ?? null,
        updatedAt:
          data.updatedAt?.toDate?.()?.toISOString() ?? data.updatedAt ?? null,
      };
    });

    return NextResponse.json({ requests });
  } catch (error) {
    console.error("Error fetching hosting requests via Admin SDK:", error);
    return NextResponse.json(
      { error: "Failed to fetch hosting requests", requests: [] },
      { status: 500 },
    );
  }
}

/**
 * POST /api/hosting-requests
 * Submit a hosting request with strict validation:
 * - 10-digit phone number, digits only (no letters/text)
 * - Full name without numbers
 * - Email validated with RFC @ regex
 * - All details required
 */
export async function POST(request) {
  try {
    const body = await request.json();
    let {
      name,
      email,
      phone,
      college,
      eventTitle,
      description,
      isPaid,
      numberOfTickets,
    } = body;

    name = typeof name === "string" ? name.trim() : "";
    email = typeof email === "string" ? email.trim().toLowerCase() : "";
    phone = typeof phone === "string" || typeof phone === "number" ? String(phone).replace(/\D/g, "") : "";
    college = typeof college === "string" ? college.trim() : "";
    eventTitle = typeof eventTitle === "string" ? eventTitle.trim() : "";
    description = typeof description === "string" ? description.trim() : "";
    const parsedTickets = parseInt(numberOfTickets, 10);

    // 1. All details are required
    if (!name) {
      return NextResponse.json({ error: "Full name is required." }, { status: 400 });
    }
    if (!email) {
      return NextResponse.json({ error: "Email address is required." }, { status: 400 });
    }
    if (!phone) {
      return NextResponse.json({ error: "Phone number is required." }, { status: 400 });
    }
    if (!college) {
      return NextResponse.json({ error: "College / organisation is required." }, { status: 400 });
    }
    if (!eventTitle) {
      return NextResponse.json({ error: "Event title is required." }, { status: 400 });
    }
    if (!description) {
      return NextResponse.json({ error: "Event description is required." }, { status: 400 });
    }
    if (isNaN(parsedTickets) || parsedTickets <= 0) {
      return NextResponse.json({ error: "Expected tickets must be a valid number of at least 1." }, { status: 400 });
    }

    // 2. Name validation: no numbers allowed
    if (/\d/.test(name)) {
      return NextResponse.json({ error: "Full name cannot contain numbers." }, { status: 400 });
    }
    if (name.length < 2) {
      return NextResponse.json({ error: "Full name must be at least 2 characters." }, { status: 400 });
    }

    // 3. Email validation: valid email with @ regex
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    // 4. Phone validation: exactly 10 digits, no text
    if (phone.length === 12 && phone.startsWith("91")) {
      phone = phone.slice(2);
    }
    if (!/^\d{10}$/.test(phone)) {
      return NextResponse.json({ error: "Phone number must be exactly 10 digits." }, { status: 400 });
    }

    const caller = await getAuthenticatedUser(request);
    const finalUserId = caller?.id || (typeof body.userId === "string" ? body.userId : null);
    const finalUserEmail = caller?.email || (typeof body.userEmail === "string" ? body.userEmail : (typeof body.userAccountEmail === "string" ? body.userAccountEmail : null));

    // Authenticated email must match request email if caller is signed in
    if (caller?.email && caller.email.trim().toLowerCase() !== email) {
      return NextResponse.json(
        { error: `The request email (${email}) must match your signed-in account email (${caller.email}).` },
        { status: 403 }
      );
    }

    // 5. Uniqueness validation: One email and phone number can only request/host once in the system
    if (adminDb) {
      // Check if an organiser account already exists with this email
      const userEmailSnap = await adminDb.collection("users")
        .where("email", "==", email)
        .limit(1)
        .get();
      if (!userEmailSnap.empty) {
        const u = userEmailSnap.docs[0].data();
        if (u.role === "organiser" || u.isAdmin) {
          return NextResponse.json(
            { error: "An organiser account already exists with this email address. Please log in directly to your organiser dashboard." },
            { status: 409 }
          );
        }
      }

      // Check if an organiser account already exists with this phone number
      const userPhoneSnap = await adminDb.collection("users")
        .where("whatsappPhone", "==", phone)
        .limit(1)
        .get();
      if (!userPhoneSnap.empty) {
        const u = userPhoneSnap.docs[0].data();
        if (u.role === "organiser" || u.isAdmin) {
          return NextResponse.json(
            { error: "An organiser account already exists with this phone number. Please log in directly to your organiser dashboard." },
            { status: 409 }
          );
        }
      }

      // Check if an active hosting request already exists with this email
      const reqEmailSnap = await adminDb.collection("hostingRequests")
        .where("email", "==", email)
        .get();
      const hasActiveReqEmail = reqEmailSnap.docs.some((d) => {
        const s = d.data().status;
        return s === "pending" || s === "approved";
      });
      if (hasActiveReqEmail) {
        return NextResponse.json(
          { error: "A hosting request with this email address has already been submitted and is in review. Each email can only be used once." },
          { status: 409 }
        );
      }

      // Check if an active hosting request already exists with this phone number
      const reqPhoneSnap = await adminDb.collection("hostingRequests")
        .where("phone", "==", phone)
        .get();
      const hasActiveReqPhone = reqPhoneSnap.docs.some((d) => {
        const s = d.data().status;
        return s === "pending" || s === "approved";
      });
      if (hasActiveReqPhone) {
        return NextResponse.json(
          { error: "A hosting request with this phone number has already been submitted and is in review. Each phone number can only be used once." },
          { status: 409 }
        );
      }
    }

    const newRequestDoc = {
      name,
      email,
      phone,
      college,
      eventTitle,
      description,
      isPaid: Boolean(isPaid),
      numberOfTickets: parsedTickets,
      status: "pending",
      createdAt: Timestamp.now(),
      organiserId: null,
      organiserEmail: null,
      userId: finalUserId,
      userAccountEmail: finalUserEmail,
      userRegistered: Boolean(finalUserId || finalUserEmail),
    };

    const docRef = await adminDb.collection("hostingRequests").add(newRequestDoc);

    return NextResponse.json({
      success: true,
      id: docRef.id,
      request: {
        id: docRef.id,
        ...newRequestDoc,
        createdAt: new Date().toISOString(),
      },
      message: "Hosting request submitted successfully and waiting for approval.",
    });
  } catch (error) {
    console.error("Error creating hosting request via API:", error);
    return NextResponse.json(
      { error: error.message || "Failed to submit hosting request" },
      { status: 500 },
    );
  }
}

