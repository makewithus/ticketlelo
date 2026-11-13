import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { adminDb } from "@/lib/firebase-admin";
import { submitAmbassadorApplication } from "@/lib/creator-campus/programs-service";
import {
  notifyApplicantSubmissionReceived,
  notifyOrganizerNewApplication,
} from "@/lib/creator-campus/notifications";

export async function POST(request, { params }) {
  try {
    const caller = await getAuthenticatedUser(request).catch(() => null);
    const { programId } = await params;
    const body = await request.json();

    const {
      fullName,
      email,
      whatsappPhone = "",
      college = "",
      answers = {},
    } = body;

    if (!fullName || !email) {
      return NextResponse.json({ error: "Full Name and Email are required." }, { status: 400 });
    }

    if (/\d/.test(fullName)) {
      return NextResponse.json({ error: "Full Name cannot contain numbers." }, { status: 400 });
    }

    const cleanPhone = String(whatsappPhone || "").replace(/\D/g, "");
    if (!cleanPhone || cleanPhone.length !== 10) {
      return NextResponse.json({ error: "WhatsApp phone number must be exactly 10 digits." }, { status: 400 });
    }

    const application = await submitAmbassadorApplication({
      programId,
      userId: caller?.uid || null,
      fullName: String(fullName).trim(),
      email: String(email).trim().toLowerCase(),
      whatsappPhone: cleanPhone,
      college: String(college || "").trim(),
      answers,
    });

    // Fire notifications asynchronously
    (async () => {
      try {
        const progSnap = await adminDb.collection("ambassadorPrograms").doc(programId).get();
        if (progSnap.exists) {
          const progData = progSnap.data();
          await notifyApplicantSubmissionReceived({
            applicantEmail: email,
            applicantName: fullName,
            programTitle: progData.title || "Campus Ambassador",
            programId,
          });

          // Fetch organizer email
          const orgUserSnap = await adminDb.collection("users").doc(progData.organizerId).get();
          if (orgUserSnap.exists) {
            const orgData = orgUserSnap.data();
            await notifyOrganizerNewApplication({
              organizerEmail: orgData.email,
              organizerUid: progData.organizerId,
              applicantName: fullName,
              applicantEmail: email,
              programTitle: progData.title || "Campus Ambassador",
              programId,
            });
          }
        }
      } catch (nErr) {
        console.warn("[apply] Notification warning:", nErr?.message);
      }
    })();

    return NextResponse.json({ success: true, application }, { status: 201 });
  } catch (err) {
    console.error("[api/programs/[programId]/apply POST] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to submit application" }, { status: 400 });
  }
}

