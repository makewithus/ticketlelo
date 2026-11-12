import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { resolveReferralCode, isSelfReferral } from "@/lib/creator-campus/referral-registry";
import { getAuthenticatedUser } from "@/lib/auth-server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const checkEvent = searchParams.get("checkEvent");
    if (checkEvent) {
      const { getEventReferralStatus } = await import("@/lib/creator-campus/programs-service");
      const status = await getEventReferralStatus(checkEvent);
      return NextResponse.json(status);
    }

    const code = searchParams.get("code");
    const eventId = searchParams.get("eventId");
    const buyerEmail = searchParams.get("email") || "";

    if (!code) {
      return NextResponse.json({ valid: false, reason: "No referral code provided" }, { status: 400 });
    }

    const resolved = await resolveReferralCode(code);
    if (!resolved) {
      return NextResponse.json({ valid: false, reason: "Referral code not found or inactive" });
    }

    const { ambassadorId, programId, userId } = resolved;

    // Check program status
    if (programId && programId !== "legacy") {
      const progDoc = await adminDb.collection("ambassadorPrograms").doc(programId).get();
      if (!progDoc.exists) {
        return NextResponse.json({ valid: false, reason: "Associated program does not exist" });
      }
      const prog = progDoc.data();
      if (prog.status !== "published" && prog.isActive !== true) {
        return NextResponse.json({ valid: false, reason: "Ambassador program is not currently active" });
      }

      // Check event connection if eventId supplied
      if (eventId) {
        const relSnap = await adminDb
          .collection("programEvents")
          .doc(`${programId}_${eventId}`)
          .get();

        if (!relSnap.exists || relSnap.data().status !== "connected" || relSnap.data().referralEnabled !== true) {
          return NextResponse.json({
            valid: false,
            reason: "This event is not participating in the referral program for this code",
          });
        }
      }
    }

    // Check self-referral if buyer email or session user is provided
    const caller = await getAuthenticatedUser(request).catch(() => null);
    const buyer = {
      email: buyerEmail || caller?.email || "",
      userId: caller?.uid || null,
    };
    const ambassador = {
      userId,
      email: resolved.email || "",
    };

    if (buyer.email && isSelfReferral(buyer, ambassador)) {
      return NextResponse.json({
        valid: false,
        reason: "Self-referral is not permitted. You cannot use your own referral code.",
      });
    }

    return NextResponse.json({
      valid: true,
      code: resolved.code,
      ambassadorId,
      programId,
      eventId: eventId || null,
    });
  } catch (err) {
    console.error("[api/referral/validate GET] Error:", err);
    return NextResponse.json({ valid: false, reason: "Referral validation failed" }, { status: 500 });
  }
}
