import { NextResponse } from "next/server";
import admin, { adminAuth, adminDb, isFirebaseAdminReady } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId");
    const slug = searchParams.get("slug");
    let uid = searchParams.get("uid");

    if (!isFirebaseAdminReady() || !adminDb) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
    }

    let eventData = null;
    let foundEventId = eventId;

    if (eventId) {
      const snap = await adminDb.collection("events").doc(eventId).get();
      if (snap.exists) {
        eventData = snap.data();
      }
    }

    if (!eventData && slug) {
      const cleanSlug = slug.toLowerCase().trim();
      const qSnap = await adminDb
        .collection("events")
        .where("slug", "==", cleanSlug)
        .limit(1)
        .get();
      if (!qSnap.empty) {
        const docSnap = qSnap.docs[0];
        eventData = docSnap.data();
        foundEventId = docSnap.id;
      }
    }

    if (!uid && eventData) {
      uid = eventData.createdBy || eventData.organizerId || eventData.userId || null;
    }

    let hostName = "";
    let hostEmail = "";
    let hostPhotoUrl = "";

    // 1. Check user record from Firestore users collection
    if (uid) {
      try {
        const uSnap = await adminDb.collection("users").doc(uid).get();
        if (uSnap.exists) {
          const uData = uSnap.data();
          hostName = uData.fullName || uData.displayName || uData.name || "";
          hostEmail = uData.email || "";
          hostPhotoUrl = uData.photoURL || uData.avatar || uData.image || "";
        }
      } catch (err) {
        console.warn("[host-info] Error reading user doc:", err.message);
      }
    }

    // 2. Authoritative Google profile check from Firebase Auth
    if (uid && adminAuth) {
      try {
        const authUser = await adminAuth.getUser(uid);
        if (!hostName) {
          hostName = authUser.displayName || "";
        }
        if (!hostEmail) {
          hostEmail = authUser.email || "";
        }
        if (!hostPhotoUrl) {
          hostPhotoUrl = authUser.photoURL || "";
        }

        // Check Google providerData specifically
        if (authUser.providerData && Array.isArray(authUser.providerData)) {
          const googleProvider = authUser.providerData.find(
            (p) => p.providerId === "google.com" || p.providerId === "google"
          );
          if (googleProvider) {
            if (!hostPhotoUrl && googleProvider.photoURL) {
              hostPhotoUrl = googleProvider.photoURL;
            }
            if (!hostEmail && googleProvider.email) {
              hostEmail = googleProvider.email;
            }
            if (!hostName && googleProvider.displayName) {
              hostName = googleProvider.displayName;
            }
          }
        }
      } catch (authErr) {
        console.warn("[host-info] Error fetching auth user:", authErr.message);
      }
    }

    // 3. Fallbacks from event data (ignoring stale generic defaults like "School of Engineering")
    if (eventData) {
      if (!hostName && eventData.organizerName && eventData.organizerName !== "School of Engineering") {
        hostName = eventData.organizerName;
      }
      if (!hostName && eventData.hostName && eventData.hostName !== "School of Engineering") {
        hostName = eventData.hostName;
      }
      if (!hostEmail && eventData.organizerEmail && eventData.organizerEmail !== "support@ticketlelo.com") {
        hostEmail = eventData.organizerEmail;
      }
      if (!hostEmail && eventData.hostEmail && eventData.hostEmail !== "support@ticketlelo.com") {
        hostEmail = eventData.hostEmail;
      }
      if (!hostPhotoUrl && eventData.organizerPhotoUrl) {
        hostPhotoUrl = eventData.organizerPhotoUrl;
      }
      if (!hostPhotoUrl && eventData.hostPhotoUrl) {
        hostPhotoUrl = eventData.hostPhotoUrl;
      }
    }

    // Derive name from email if needed
    if (!hostName && hostEmail) {
      const prefix = hostEmail.split("@")[0];
      hostName = prefix.charAt(0).toUpperCase() + prefix.slice(1);
    }

    if (!hostName) {
      hostName = "Host";
    }

    // 4. Opportunistically repair / backfill the event document in Firestore
    if (foundEventId && (hostPhotoUrl || hostEmail || hostName)) {
      try {
        const updates = {};
        if (hostName && eventData?.organizerName !== hostName) updates.organizerName = hostName;
        if (hostName && eventData?.hostName !== hostName) updates.hostName = hostName;
        if (hostEmail && eventData?.organizerEmail !== hostEmail) updates.organizerEmail = hostEmail;
        if (hostEmail && eventData?.hostEmail !== hostEmail) updates.hostEmail = hostEmail;
        if (hostPhotoUrl && eventData?.organizerPhotoUrl !== hostPhotoUrl) updates.organizerPhotoUrl = hostPhotoUrl;
        if (hostPhotoUrl && eventData?.hostPhotoUrl !== hostPhotoUrl) updates.hostPhotoUrl = hostPhotoUrl;

        if (Object.keys(updates).length > 0) {
          adminDb.collection("events").doc(foundEventId).update(updates).catch(() => {});
        }
      } catch (_) {}
    }

    return NextResponse.json({
      success: true,
      host: {
        name: hostName,
        email: hostEmail,
        photoURL: hostPhotoUrl,
      },
    });
  } catch (error) {
    console.error("[host-info] Route error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch host info" }, { status: 500 });
  }
}
