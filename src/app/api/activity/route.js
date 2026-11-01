import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { managesEvent } from "@/lib/access-policy";

export const dynamic = "force-dynamic";

/**
 * GET /api/activity
 * Aggregates real backend activities:
 * - Registrations
 * - Check-ins
 * - Broadcast messages (Blasts)
 * - Hosting requests
 *
 * Scoped strictly to the authenticated organiser's events and hosting requests.
 * SuperAdmin callers can view platform-wide activity logs.
 */
export async function GET(request) {
  try {
    const caller = await getAuthenticatedUser(request);
    if (!caller) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    if (!adminDb) {
      return NextResponse.json({ error: "Database service unavailable", activities: [] }, { status: 503 });
    }

    const emailLower = String(caller.email || "").toLowerCase().trim();
    const isSuperAdmin =
      caller.role === "superAdmin" ||
      emailLower === "adil4ticketlelo@gmail.com" ||
      emailLower === "superadmin@ticketlelo.com";

    const { searchParams } = new URL(request.url);
    const requestedEventId = searchParams.get("eventId");

    // 1. Fetch Events to identify ownership and map titles
    const eventsSnap = await adminDb.collection("events").get();
    const eventMap = {};
    const myEventIds = new Set();

    eventsSnap.docs.forEach((d) => {
      const data = d.data();
      const belongs = isSuperAdmin || managesEvent(caller, data);
      if (belongs) {
        myEventIds.add(d.id);
        eventMap[d.id] = data.name || data.title || "Event";
      }
    });

    const targetEventId =
      requestedEventId && (isSuperAdmin || myEventIds.has(requestedEventId))
        ? requestedEventId
        : null;

    // 2. Fetch Hosting Requests strictly for this user (or all if superAdmin)
    const hrQuery = adminDb.collection("hostingRequests").orderBy("createdAt", "desc").limit(50);
    const hrSnap = await hrQuery.get().catch(() => ({ docs: [] }));

    const filteredHrDocs = isSuperAdmin
      ? hrSnap.docs
      : hrSnap.docs.filter((doc) => {
          const data = doc.data();
          const reqEmail = String(data.email || data.userAccountEmail || "").toLowerCase().trim();
          return Boolean(
            (caller.uid && (data.userId === caller.uid || data.organiserId === caller.uid || data.createdBy === caller.uid)) ||
            (emailLower && reqEmail === emailLower)
          );
        });

    const hostingRequests = filteredHrDocs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        eventName: data.eventTitle || data.eventName || "Untitled Event",
        ticketsType: data.isPaid ? "Paid" : "Free",
        ticketsCount: `${data.capacity || data.ticketsCount || 100} tickets`,
        status: data.status || "pending",
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        approvedAt: data.approvedAt?.toDate?.()?.toISOString() || null,
      };
    });

    // If caller is NOT superadmin and has NO events, return 0 activities immediately
    if (!isSuperAdmin && myEventIds.size === 0) {
      return NextResponse.json({
        activities: [],
        hostingRequests,
      });
    }

    // 3. Fetch Registrations
    let regDocs = [];
    if (targetEventId) {
      const targetRegSnap = await adminDb
        .collection("registrations")
        .where("eventId", "==", targetEventId)
        .limit(100)
        .get()
        .catch(() => ({ docs: [] }));
      regDocs = targetRegSnap.docs;
    } else if (isSuperAdmin) {
      const regSnap = await adminDb
        .collection("registrations")
        .orderBy("createdAt", "desc")
        .limit(100)
        .get()
        .catch(() => ({ docs: [] }));
      regDocs = regSnap.docs;
    } else {
      // Organiser has specific events: fetch recent registrations and filter by myEventIds
      if (myEventIds.size <= 30) {
        const inSnap = await adminDb
          .collection("registrations")
          .where("eventId", "in", Array.from(myEventIds))
          .limit(100)
          .get()
          .catch(() => null);
        if (inSnap && inSnap.docs) {
          regDocs = inSnap.docs;
        }
      }
      if (regDocs.length === 0) {
        const fallbackRegSnap = await adminDb
          .collection("registrations")
          .orderBy("createdAt", "desc")
          .limit(200)
          .get()
          .catch(() => ({ docs: [] }));
        regDocs = fallbackRegSnap.docs.filter((d) => myEventIds.has(d.data().eventId));
      }
    }

    // 4. Fetch Messages (Blasts)
    let msgDocs = [];
    if (targetEventId) {
      const targetMsgSnap = await adminDb
        .collection("messages")
        .where("eventId", "==", targetEventId)
        .limit(50)
        .get()
        .catch(() => ({ docs: [] }));
      msgDocs = targetMsgSnap.docs;
    } else if (isSuperAdmin) {
      const msgSnap = await adminDb
        .collection("messages")
        .orderBy("createdAt", "desc")
        .limit(50)
        .get()
        .catch(() => ({ docs: [] }));
      msgDocs = msgSnap.docs;
    } else {
      const msgSnap = await adminDb
        .collection("messages")
        .orderBy("createdAt", "desc")
        .limit(100)
        .get()
        .catch(() => ({ docs: [] }));
      msgDocs = msgSnap.docs.filter((d) => {
        const data = d.data();
        return (
          myEventIds.has(data.eventId) ||
          (caller.uid && (data.senderId === caller.uid || data.createdBy === caller.uid))
        );
      });
    }

    const activities = [];

    regDocs.forEach((doc) => {
      const data = doc.data();
      if (!isSuperAdmin && !myEventIds.has(data.eventId)) return;

      const eventName = data.eventName || eventMap[data.eventId] || "Event";
      const attendeeName = data.fullName || data.name || data.email?.split("@")[0] || "Guest";
      const createdAt = data.createdAt?.toDate?.()?.toISOString() || data.createdAt || null;

      activities.push({
        id: `reg_${doc.id}`,
        eventId: data.eventId,
        type: "Registrations",
        title: `${attendeeName} registered${data.paymentStatus === "pending" ? " · payment pending" : ""}`,
        subtitle: eventName,
        timestamp: createdAt,
        rawTimestamp: data.createdAt?.toDate?.()?.getTime() || (createdAt ? new Date(createdAt).getTime() : 0),
      });

      if (data.checkedIn || data.status === "Used" || data.status === "Checked In" || data.usedAt || data.checkIns) {
        const usedAt = data.usedAt?.toDate?.()?.toISOString() || createdAt;
        activities.push({
          id: `checkin_${doc.id}`,
          eventId: data.eventId,
          type: "Check-ins",
          title: `${attendeeName} checked in`,
          subtitle: eventName,
          timestamp: usedAt,
          rawTimestamp: data.usedAt?.toDate?.()?.getTime() || (usedAt ? new Date(usedAt).getTime() : 0),
        });
      }
    });

    msgDocs.forEach((doc) => {
      const data = doc.data();
      if (!isSuperAdmin && !myEventIds.has(data.eventId) && data.senderId !== caller.uid && data.createdBy !== caller.uid) {
        return;
      }

      const eventName = data.eventName || eventMap[data.eventId] || "Event";
      const isFailed = data.status === "failed";
      const count = data.recipientCount || data.successCount || 0;
      const createdAt = data.sentAt?.toDate?.()?.toISOString() || data.createdAt?.toDate?.()?.toISOString() || null;

      activities.push({
        id: `blast_${doc.id}`,
        eventId: data.eventId,
        type: "Blasts",
        title: isFailed
          ? `Blast "${data.subject || "Announcement"}" failed to send`
          : `Blast "${data.subject || "Your ticket is ready"}" sent to ${count} guests`,
        subtitle: eventName,
        timestamp: createdAt,
        rawTimestamp:
          data.sentAt?.toDate?.()?.getTime() ||
          data.createdAt?.toDate?.()?.getTime() ||
          (createdAt ? new Date(createdAt).getTime() : 0),
      });
    });

    activities.sort((a, b) => b.rawTimestamp - a.rawTimestamp);

    return NextResponse.json({
      activities,
      hostingRequests,
    });
  } catch (error) {
    console.error("[api/activity] Error:", error);
    return NextResponse.json(
      { error: "Failed to load live activity", activities: [], hostingRequests: [] },
      { status: 500 }
    );
  }
}
