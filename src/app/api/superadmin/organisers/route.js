import { NextResponse } from "next/server";
import { adminDb, adminAuth, isFirebaseAdminReady } from "@/lib/firebase-admin";
import { getAuthenticatedUser } from "@/lib/auth-server";

function isAuthorizedSuperAdmin(caller) {
  if (!caller) return false;
  const emailLower = (caller.email || "").toLowerCase().trim();
  const superAdminEnv = (process.env.SUPER_ADMIN_EMAIL || "").toLowerCase().trim();
  const isSuperAdmin =
    caller?.role === "superAdmin" ||
    caller?.isAdmin === true ||
    emailLower === "adil4ticketlelo@gmail.com" ||
    emailLower === "superadmin@ticketlelo.com" ||
    (superAdminEnv && emailLower === superAdminEnv);
  return Boolean(isSuperAdmin);
}

export async function GET(request) {
  try {
    if (!isFirebaseAdminReady() || !adminDb) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
    }

    const caller = await getAuthenticatedUser(request);
    if (!caller || !isAuthorizedSuperAdmin(caller)) {
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
        hostingRequestId: doc.id,
        organiserId: d.organiserId || null,
        userId: d.organiserId || d.userId || null,
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
        eventId: matchingEvent?.id || null,
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
        hostingRequestId: null,
        organiserId: u.id,
        userId: u.id,
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

export async function DELETE(request) {
  try {
    if (!isFirebaseAdminReady() || !adminDb) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
    }

    const caller = await getAuthenticatedUser(request);
    if (!caller || !isAuthorizedSuperAdmin(caller)) {
      return NextResponse.json({ error: "Super administrator access required" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { id, email, hostingRequestId, userId, organiserId, deleteEvents } = body;

    const targetEmail = (email || "").toLowerCase().trim();
    const targetUserId = userId || organiserId || null;
    const targetHostingRequestId = hostingRequestId || id || null;

    if (!targetEmail && !targetUserId && !targetHostingRequestId) {
      return NextResponse.json(
        { error: "Organiser email, userId, or id is required" },
        { status: 400 },
      );
    }

    // Protection against deleting Super Admins
    const superAdminEnv = (process.env.SUPER_ADMIN_EMAIL || "").toLowerCase().trim();
    if (
      targetEmail === "adil4ticketlelo@gmail.com" ||
      targetEmail === "superadmin@ticketlelo.com" ||
      (superAdminEnv && targetEmail === superAdminEnv)
    ) {
      return NextResponse.json(
        { error: "Cannot delete a super administrator account" },
        { status: 400 },
      );
    }

    // Check if target user doc is a superAdmin
    if (targetUserId) {
      try {
        const uDoc = await adminDb.collection("users").doc(targetUserId).get();
        if (uDoc.exists && uDoc.data()?.role === "superAdmin") {
          return NextResponse.json(
            { error: "Cannot delete a super administrator account" },
            { status: 400 },
          );
        }
      } catch (_) {}
    }

    // 1. Delete user from Firebase Auth
    let resolvedUid = targetUserId || null;
    try {
      if (adminAuth) {
        let authUser = null;
        if (resolvedUid) {
          try {
            authUser = await adminAuth.getUser(resolvedUid);
          } catch (err) {
            if (err.code !== "auth/user-not-found") throw err;
          }
        }
        if (!authUser && targetEmail && targetEmail !== "—") {
          try {
            authUser = await adminAuth.getUserByEmail(targetEmail);
            resolvedUid = authUser.uid;
          } catch (err) {
            if (err.code !== "auth/user-not-found") throw err;
          }
        }

        if (authUser) {
          if (authUser.customClaims?.role === "superAdmin") {
            return NextResponse.json(
              { error: "Cannot delete a super administrator account" },
              { status: 400 },
            );
          }
          await adminAuth.deleteUser(authUser.uid);
        }
      }
    } catch (authErr) {
      console.warn("[superadmin/organisers] Auth user deletion warning:", authErr.message);
    }

    // 2. Delete Firestore User Document(s)
    let deletedUserDocsCount = 0;
    if (resolvedUid) {
      try {
        await adminDb.collection("users").doc(resolvedUid).delete();
        deletedUserDocsCount++;
      } catch (err) {
        console.warn("[superadmin/organisers] User doc deletion error:", err.message);
      }
    }

    if (targetEmail && targetEmail !== "—") {
      try {
        const userQuerySnap = await adminDb
          .collection("users")
          .where("email", "==", targetEmail)
          .get();
        for (const doc of userQuerySnap.docs) {
          if (doc.data().role !== "superAdmin") {
            await doc.ref.delete();
            deletedUserDocsCount++;
          }
        }
      } catch (err) {
        console.warn("[superadmin/organisers] User email query deletion error:", err.message);
      }
    }

    // 3. Delete Hosting Request Document(s)
    let deletedHostingRequestsCount = 0;
    const deletedHrDocIds = new Set();

    if (targetHostingRequestId) {
      try {
        const hrDoc = await adminDb.collection("hostingRequests").doc(targetHostingRequestId).get();
        if (hrDoc.exists) {
          await hrDoc.ref.delete();
          deletedHrDocIds.add(targetHostingRequestId);
          deletedHostingRequestsCount++;
        }
      } catch (err) {
        console.warn("[superadmin/organisers] Hosting request doc deletion error:", err.message);
      }
    }

    if (targetEmail && targetEmail !== "—") {
      try {
        const hrEmailSnap = await adminDb
          .collection("hostingRequests")
          .where("email", "==", targetEmail)
          .get();
        for (const doc of hrEmailSnap.docs) {
          if (!deletedHrDocIds.has(doc.id)) {
            await doc.ref.delete();
            deletedHrDocIds.add(doc.id);
            deletedHostingRequestsCount++;
          }
        }
      } catch (_) {}

      try {
        const hrOrganiserEmailSnap = await adminDb
          .collection("hostingRequests")
          .where("organiserEmail", "==", targetEmail)
          .get();
        for (const doc of hrOrganiserEmailSnap.docs) {
          if (!deletedHrDocIds.has(doc.id)) {
            await doc.ref.delete();
            deletedHrDocIds.add(doc.id);
            deletedHostingRequestsCount++;
          }
        }
      } catch (_) {}
    }

    if (resolvedUid) {
      try {
        const hrUidSnap = await adminDb
          .collection("hostingRequests")
          .where("organiserId", "==", resolvedUid)
          .get();
        for (const doc of hrUidSnap.docs) {
          if (!deletedHrDocIds.has(doc.id)) {
            await doc.ref.delete();
            deletedHrDocIds.add(doc.id);
            deletedHostingRequestsCount++;
          }
        }
      } catch (_) {}
    }

    // 4. Handle Associated Events & Custom Forms
    let eventsHandledCount = 0;
    try {
      const eventsSnap = await adminDb.collection("events").get();
      const matchingEvents = eventsSnap.docs.filter((doc) => {
        const e = doc.data();
        const matchesUid =
          resolvedUid &&
          (e.createdBy === resolvedUid || e.userId === resolvedUid || e.organiserId === resolvedUid);
        const matchesEmail =
          targetEmail &&
          targetEmail !== "—" &&
          e.createdByEmail &&
          e.createdByEmail.toLowerCase() === targetEmail;
        return matchesUid || matchesEmail;
      });

      for (const eventDoc of matchingEvents) {
        const eventId = eventDoc.id;
        if (deleteEvents === true) {
          // Delete customForms
          try {
            const formsSnap = await adminDb
              .collection("customForms")
              .where("eventId", "==", eventId)
              .get();
            for (const f of formsSnap.docs) {
              await f.ref.delete();
            }
          } catch (_) {}

          // Delete event
          await eventDoc.ref.delete();
          eventsHandledCount++;
        } else {
          // Unpublish and mark as draft
          await eventDoc.ref.update({
            published: false,
            status: "draft",
            isActive: false,
            unpublishReason: "Organiser account deleted by super administrator",
            updatedAt: new Date(),
          });
          eventsHandledCount++;
        }
      }
    } catch (eventsErr) {
      console.warn("[superadmin/organisers] Event handling error:", eventsErr.message);
    }

    // 5. Audit Log
    try {
      await adminDb.collection("adminAuditLogs").add({
        action: "ORGANISER_DELETED",
        targetUserEmail: targetEmail || "",
        targetUserId: resolvedUid || null,
        targetHostingRequestId: targetHostingRequestId || null,
        deletedUserDocsCount,
        deletedHostingRequestsCount,
        eventsHandledCount,
        deleteEvents: Boolean(deleteEvents),
        performedByEmail: caller.email,
        performedByUid: caller.uid,
        timestamp: new Date(),
      });
    } catch (_) {}

    return NextResponse.json({
      success: true,
      message: "Organiser deleted successfully",
      deletedHostingRequestsCount,
      eventsHandledCount,
    });
  } catch (error) {
    console.error("Failed to delete superadmin organiser:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete organiser" },
      { status: 500 },
    );
  }
}
