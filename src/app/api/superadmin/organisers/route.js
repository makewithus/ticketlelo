import { NextResponse } from "next/server";
import { adminDb, isFirebaseAdminReady } from "@/lib/firebase-admin";
import { getAuthenticatedUser } from "@/lib/auth-server";

export async function GET(request) {
  try {
    if (!isFirebaseAdminReady() || !adminDb) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
    }

    const caller = await getAuthenticatedUser(request);
    const emailLower = (caller?.email || "").toLowerCase().trim();
    const superAdminEnv = (process.env.SUPER_ADMIN_EMAIL || "").toLowerCase().trim();
    const isSuperAdmin =
      caller?.role === "superAdmin" ||
      caller?.isAdmin === true ||
      emailLower === "adil4ticketlelo@gmail.com" ||
      emailLower === "superadmin@ticketlelo.com" ||
      (superAdminEnv && emailLower === superAdminEnv);

    if (!caller || !isSuperAdmin) {
      return NextResponse.json({ error: "Super administrator access required" }, { status: 403 });
    }

    // 1. Fetch approved hosting requests
    let hrDocs = [];
    try {
      const hrSnap = await adminDb
        .collection("hostingRequests")
        .where("status", "==", "approved")
        .get();
      hrDocs = hrSnap.docs;
    } catch (hrErr) {
      console.warn("Failed querying approved hostingRequests:", hrErr.message);
    }

    // 2. Fetch users with organiser role
    let organiserUsers = [];
    try {
      const usersSnap = await adminDb
        .collection("users")
        .where("role", "in", ["organiser", "organizer"])
        .get();
      organiserUsers = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (_) {
      try {
        const usersSnap = await adminDb.collection("users").get();
        organiserUsers = usersSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((u) => u.role === "organiser" || u.role === "organizer");
      } catch (uErr) {
        console.warn("Failed querying organiser users:", uErr.message);
      }
    }

    // 3. Fetch events to link live/ended/published status & capacities
    let eventsList = [];
    try {
      const eventsSnap = await adminDb.collection("events").get();
      eventsList = eventsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (eErr) {
      console.warn("Failed querying events:", eErr.message);
    }

    // Count email occurrences to detect duplicates across all requests
    const emailCounts = {};
    hrDocs.forEach((doc) => {
      const data = doc.data();
      const loginEmail = (data.organiserEmail || data.email || "").toLowerCase().trim();
      if (loginEmail) {
        emailCounts[loginEmail] = (emailCounts[loginEmail] || 0) + 1;
      }
    });

    const now = Date.now();
    const seenEmails = new Set();
    const organisers = [];

    // Process hosting requests
    for (const doc of hrDocs) {
      const d = doc.data();
      const loginEmail = (d.organiserEmail || d.email || "").trim();
      const emailKey = loginEmail.toLowerCase();
      if (emailKey) seenEmails.add(emailKey);
      const isDuplicate = (emailCounts[emailKey] || 0) > 1;

      // Find matching event
      const matchingEvent = eventsList.find(
        (e) =>
          e.id === d.eventId ||
          (d.organiserId && (e.createdBy === d.organiserId || e.userId === d.organiserId || e.organiserId === d.organiserId)) ||
          (e.name && d.eventTitle && e.name.toLowerCase() === d.eventTitle.toLowerCase()) ||
          (e.createdByEmail && emailKey && e.createdByEmail.toLowerCase() === emailKey),
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
        eventStatus = d.isDraft ? "Draft" : "Published";
      }

      const ticketsCount =
        matchingEvent?.totalTickets ||
        matchingEvent?.capacity ||
        d.numberOfTickets ||
        d.expectedAttendees ||
        150;

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

      organisers.push({
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
      });
    }

    // Include registered organiser users who might not have an approved hosting request doc
    for (const u of organiserUsers) {
      const email = (u.email || "").trim();
      const emailKey = email.toLowerCase();
      if (!emailKey || seenEmails.has(emailKey)) continue;
      seenEmails.add(emailKey);

      const matchingEvent = eventsList.find(
        (e) =>
          e.createdBy === u.id ||
          e.userId === u.id ||
          e.organiserId === u.id ||
          (e.createdByEmail && e.createdByEmail.toLowerCase() === emailKey),
      );

      let eventStatus = "Published";
      if (matchingEvent) {
        let eventDate = null;
        if (matchingEvent.date?.toDate) eventDate = matchingEvent.date.toDate();
        else if (matchingEvent.date) eventDate = new Date(matchingEvent.date);

        if (matchingEvent.status === "live") eventStatus = "Live";
        else if (matchingEvent.status === "draft" || matchingEvent.isActive === false) eventStatus = "Draft";
        else if (matchingEvent.status === "ended" || (eventDate && eventDate.getTime() < now - 24 * 60 * 60 * 1000)) eventStatus = "Ended";
        else if (matchingEvent.status === "published" || matchingEvent.isActive === true) eventStatus = "Published";
      } else {
        eventStatus = "Draft";
      }

      let createdAtDate = null;
      if (u.createdAt?.toDate) createdAtDate = u.createdAt.toDate().toISOString();
      else if (u.createdAt) createdAtDate = new Date(u.createdAt).toISOString();
      else if (u.updatedAt?.toDate) createdAtDate = u.updatedAt.toDate().toISOString();
      else if (u.updatedAt) createdAtDate = new Date(u.updatedAt).toISOString();

      organisers.push({
        id: u.id,
        name: u.fullName || u.displayName || u.name || "Organiser",
        college: u.college || "college",
        eventTitle: matchingEvent?.name || "No events created yet",
        isPaid: Boolean(matchingEvent?.isPaid),
        eventStatus,
        tickets: matchingEvent?.totalTickets || matchingEvent?.capacity || 0,
        loginEmail: email || "—",
        phone: u.whatsappPhone || u.phone || "",
        isDuplicate: (emailCounts[emailKey] || 0) > 1,
        approvedAt: createdAtDate,
        eventId: matchingEvent?.id || null,
        eventSlug: matchingEvent?.slug || null,
      });
    }

    // Sort by approval/creation date descending
    organisers.sort((a, b) => {
      const ta = a.approvedAt ? new Date(a.approvedAt).getTime() : 0;
      const tb = b.approvedAt ? new Date(b.approvedAt).getTime() : 0;
      return tb - ta;
    });

    return NextResponse.json(
      { success: true, organisers, total: organisers.length },
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
