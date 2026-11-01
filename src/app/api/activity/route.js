import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getAuthenticatedUser } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

/**
 * GET /api/activity
 * Aggregates real backend activities:
 * - Registrations
 * - Check-ins
 * - Broadcast messages (Blasts)
 * - Hosting requests
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

    // 1. Fetch Events to map event titles
    const eventsSnap = await adminDb.collection("events").get();
    const eventMap = {};
    eventsSnap.docs.forEach((d) => {
      const data = d.data();
      eventMap[d.id] = data.name || data.title || "Event";
    });

    // 2. Fetch Registrations
    const regQuery = adminDb.collection("registrations").orderBy("createdAt", "desc").limit(100);
    const regSnap = await regQuery.get().catch(() => ({ docs: [] }));

    // 3. Fetch Messages (Blasts)
    const msgQuery = adminDb.collection("messages").orderBy("createdAt", "desc").limit(50);
    const msgSnap = await msgQuery.get().catch(() => ({ docs: [] }));

    // 4. Fetch Hosting Requests
    const hrQuery = adminDb.collection("hostingRequests").orderBy("createdAt", "desc").limit(50);
    const hrSnap = await hrQuery.get().catch(() => ({ docs: [] }));

    const activities = [];

    regSnap.docs.forEach((doc) => {
      const data = doc.data();
      const eventName = data.eventName || eventMap[data.eventId] || "Event";
      const attendeeName = data.fullName || data.name || data.email?.split("@")[0] || "Guest";
      const createdAt = data.createdAt?.toDate?.()?.toISOString() || data.createdAt || null;

      activities.push({
        id: `reg_${doc.id}`,
        type: "Registrations",
        title: `${attendeeName} registered${data.paymentStatus === "pending" ? " · payment pending" : ""}`,
        subtitle: eventName,
        timestamp: createdAt,
        rawTimestamp: data.createdAt?.toDate?.()?.getTime() || 0,
      });

      if (data.checkedIn || data.status === "Used" || data.status === "Checked In" || data.usedAt || data.checkIns) {
        const usedAt = data.usedAt?.toDate?.()?.toISOString() || createdAt;
        activities.push({
          id: `checkin_${doc.id}`,
          type: "Check-ins",
          title: `${attendeeName} checked in`,
          subtitle: eventName,
          timestamp: usedAt,
          rawTimestamp: data.usedAt?.toDate?.()?.getTime() || data.createdAt?.toDate?.()?.getTime() || 0,
        });
      }
    });

    msgSnap.docs.forEach((doc) => {
      const data = doc.data();
      const eventName = data.eventName || eventMap[data.eventId] || "Event";
      const isFailed = data.status === "failed";
      const count = data.recipientCount || data.successCount || 0;
      const createdAt = data.sentAt?.toDate?.()?.toISOString() || data.createdAt?.toDate?.()?.toISOString() || null;

      activities.push({
        id: `blast_${doc.id}`,
        type: "Blasts",
        title: isFailed
          ? `Blast "${data.subject || "Announcement"}" failed to send`
          : `Blast "${data.subject || "Your ticket is ready"}" sent to ${count} guests`,
        subtitle: eventName,
        timestamp: createdAt,
        rawTimestamp: data.sentAt?.toDate?.()?.getTime() || data.createdAt?.toDate?.()?.getTime() || 0,
      });
    });

    activities.sort((a, b) => b.rawTimestamp - a.rawTimestamp);

    const hostingRequests = hrSnap.docs.map((doc) => {
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
