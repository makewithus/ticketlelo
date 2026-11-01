import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getAuthenticatedUser } from "@/lib/auth-server";

export async function GET(request) {
  try {
    if (!adminDb) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
    }

    const caller = await getAuthenticatedUser(request);
    const emailLower = (caller?.email || "").toLowerCase().trim();
    const isSuperAdmin =
      caller?.role === "superAdmin" ||
      emailLower === "adil4ticketlelo@gmail.com" ||
      emailLower === "superadmin@ticketlelo.com";

    if (!caller || !isSuperAdmin) {
      return NextResponse.json({ error: "Super administrator access required" }, { status: 403 });
    }

    // 1. Fetch approved hosting requests
    const hrSnap = await adminDb
      .collection("hostingRequests")
      .where("status", "==", "approved")
      .get();

    // 2. Fetch events to link live/ended/published status & capacities
    const eventsSnap = await adminDb.collection("events").get();
    const eventsList = eventsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // Count email occurrences to detect duplicates across all requests
    const emailCounts = {};
    hrSnap.docs.forEach((doc) => {
      const data = doc.data();
      const loginEmail = (data.organiserEmail || data.email || "").toLowerCase().trim();
      if (loginEmail) {
        emailCounts[loginEmail] = (emailCounts[loginEmail] || 0) + 1;
      }
    });

    const now = Date.now();

    const organisers = hrSnap.docs.map((doc) => {
      const d = doc.data();
      const loginEmail = (d.organiserEmail || d.email || "").trim();
      const emailKey = loginEmail.toLowerCase();
      const isDuplicate = (emailCounts[emailKey] || 0) > 1;

      // Find matching event
      const matchingEvent = eventsList.find(
        (e) =>
          e.id === d.eventId ||
          (d.organiserId && e.createdBy === d.organiserId) ||
          (e.name && d.eventTitle && e.name.toLowerCase() === d.eventTitle.toLowerCase()),
      );

      // Determine Event Status
      let eventStatus = "Published";
      if (matchingEvent) {
        let eventDate = null;
        if (matchingEvent.date?.toDate) {
          eventDate = matchingEvent.date.toDate();
        } else if (matchingEvent.date) {
          eventDate = new Date(matchingEvent.date);
        }

        if (matchingEvent.status === "live") {
          eventStatus = "Live";
        } else if (matchingEvent.status === "draft" || matchingEvent.isActive === false) {
          eventStatus = "Draft";
        } else if (matchingEvent.status === "ended" || (eventDate && eventDate.getTime() < now - 24 * 60 * 60 * 1000)) {
          eventStatus = "Ended";
        } else if (matchingEvent.status === "published" || matchingEvent.isActive === true) {
          eventStatus = "Published";
        }
      } else {
        // Fallback status if no direct event yet
        eventStatus = d.isDraft ? "Draft" : "Published";
      }

      // Tickets count
      const ticketsCount =
        matchingEvent?.totalTickets ||
        matchingEvent?.capacity ||
        d.numberOfTickets ||
        d.expectedAttendees ||
        150;

      // Approval date timestamp
      let approvedAtDate = null;
      if (d.approvedAt?.toDate) {
        approvedAtDate = d.approvedAt.toDate().toISOString();
      } else if (d.approvedAt) {
        approvedAtDate = new Date(d.approvedAt).toISOString();
      } else if (d.createdAt?.toDate) {
        approvedAtDate = d.createdAt.toDate().toISOString();
      } else if (d.createdAt) {
        approvedAtDate = new Date(d.createdAt).toISOString();
      }

      return {
        id: doc.id,
        name: d.name || d.organizerName || "Organiser",
        college: d.college || "college",
        eventTitle: d.eventTitle || matchingEvent?.name || "Event",
        isPaid: Boolean(d.isPaid || matchingEvent?.isPaid),
        eventStatus,
        tickets: ticketsCount,
        loginEmail: loginEmail || d.email || "—",
        phone: d.phone || "",
        isDuplicate,
        approvedAt: approvedAtDate,
        eventId: matchingEvent?.id || d.eventId || null,
        eventSlug: matchingEvent?.slug || null,
      };
    });

    // Sort by approval date descending
    organisers.sort((a, b) => {
      const ta = a.approvedAt ? new Date(a.approvedAt).getTime() : 0;
      const tb = b.approvedAt ? new Date(b.approvedAt).getTime() : 0;
      return tb - ta;
    });

    return NextResponse.json(
      { organisers, total: organisers.length },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Failed to fetch superadmin organisers:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load organisers" },
      { status: 500 },
    );
  }
}
