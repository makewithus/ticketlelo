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

    let targetEvent = null;
    let targetUrl = null;

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

        const isExplicitlyConnected =
          relSnap.exists &&
          relSnap.data().status === "connected" &&
          relSnap.data().referralEnabled === true;

        if (!isExplicitlyConnected) {
          // Fallback: Verify if event belongs to program organizer
          const evtDoc = await adminDb.collection("events").doc(eventId).get();
          const evtData = evtDoc.exists ? evtDoc.data() : null;
          const progOrganizer = prog.organizerId || resolved.organizerId;
          const isOrganizerMatch =
            evtData &&
            progOrganizer &&
            (evtData.organizerId === progOrganizer ||
              evtData.createdBy === progOrganizer ||
              evtData.userId === progOrganizer);

          if (!isOrganizerMatch) {
            return NextResponse.json({
              valid: false,
              reason: "This event is not participating in the referral program for this code",
            });
          }
        }
      } else {
        // Resolve target event for ambassador referral links
        try {
          // 1. Try explicit connected event in programEvents
          const peSnap = await adminDb
            .collection("programEvents")
            .where("programId", "==", programId)
            .where("status", "==", "connected")
            .where("referralEnabled", "==", true)
            .limit(1)
            .get();

          if (!peSnap.empty) {
            const peData = peSnap.docs[0].data();
            const evtDoc = await adminDb.collection("events").doc(peData.eventId).get();
            if (evtDoc.exists) {
              const ed = evtDoc.data();
              targetEvent = {
                id: evtDoc.id,
                title: ed.name || ed.title || peData.eventName || "Event",
                slug: ed.customSlug || ed.slug || evtDoc.id,
              };
            }
          }

          // 2. Fallback: Lookup program organizer's active event
          if (!targetEvent) {
            const orgId = prog.organizerId || resolved.organizerId;
            if (orgId) {
              let orgEvtSnap = await adminDb
                .collection("events")
                .where("organizerId", "==", orgId)
                .get();

              if (orgEvtSnap.empty) {
                orgEvtSnap = await adminDb
                  .collection("events")
                  .where("createdBy", "==", orgId)
                  .get();
              }

              if (!orgEvtSnap.empty) {
                const activeEvents = orgEvtSnap.docs
                  .map((d) => ({ id: d.id, ...d.data() }))
                  .filter((e) => e.status !== "deleted" && e.isActive !== false)
                  .sort((a, b) => {
                    const tA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
                    const tB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
                    return tB - tA;
                  });

                // Prioritize event whose title or name matches the program title if applicable
                const progTitleNorm = (prog.title || prog.name || "").toLowerCase().trim();
                const matchingEvent = progTitleNorm
                  ? activeEvents.find((e) => (e.title || e.name || "").toLowerCase().includes(progTitleNorm))
                  : null;

                const chosen = matchingEvent || activeEvents[0] || orgEvtSnap.docs[0].data();
                const chosenId = chosen.id || orgEvtSnap.docs[0].id;
                targetEvent = {
                  id: chosenId,
                  title: chosen.name || chosen.title || "Event",
                  slug: chosen.customSlug || chosen.slug || chosenId,
                };
              }
            }
          }

          if (targetEvent) {
            targetUrl = `/e/${targetEvent.slug || targetEvent.id}?ref=${encodeURIComponent(resolved.code)}#register`;
          }
        } catch (targetErr) {
          console.warn("[api/referral/validate] Could not resolve target event:", targetErr?.message);
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
      eventId: eventId || targetEvent?.id || null,
      targetEvent,
      targetUrl,
    });
  } catch (err) {
    console.error("[api/referral/validate GET] Error:", err);
    return NextResponse.json({ valid: false, reason: "Referral validation failed" }, { status: 500 });
  }
}
