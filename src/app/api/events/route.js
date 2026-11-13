import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

function formatTimestampToString(raw) {
  if (!raw) return null;
  if (typeof raw === "string") return raw;
  if (typeof raw?.toDate === "function") {
    try {
      const d = raw.toDate();
      if (!isNaN(d.getTime())) return d.toISOString();
    } catch {}
  }
  if (typeof raw?.seconds === "number") return new Date(raw.seconds * 1000).toISOString();
  if (typeof raw?._seconds === "number") return new Date(raw._seconds * 1000).toISOString();
  if (raw instanceof Date) return raw.toISOString();
  return null;
}

export async function GET(request) {
  try {
    const caller = await getAuthenticatedUser(request);
    if (!caller) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (!adminDb) {
      return NextResponse.json({ error: "Database service unavailable" }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const limitParam = Math.min(parseInt(searchParams.get("limit") || "100", 10), 500);

    const emailLower = (caller.email || "").toLowerCase().trim();
    const isSuper =
      caller.role === "superAdmin" ||
      emailLower === "adil4ticketlelo@gmail.com" ||
      emailLower === "superadmin@ticketlelo.com";

    const eventsMap = new Map();

    const addEventDoc = (doc) => {
      const data = doc.data();
      if (data.isDeleted === true || data.deleted === true || data.status === "deleted") {
        return;
      }
      if (!eventsMap.has(doc.id)) {
        eventsMap.set(doc.id, {
          id: doc.id,
          _id: doc.id,
          name: data.name || data.title || data.eventName || "Untitled Event",
          title: data.name || data.title || data.eventName || "Untitled Event",
          description: typeof data.description === "string" ? data.description : data.description?.text || "",
          slug: data.customSlug || data.slug || doc.id,
          customSlug: data.customSlug || data.slug || doc.id,
          date: formatTimestampToString(data.date || data.startDate),
          startDate: formatTimestampToString(data.startDate || data.date),
          venue: data.venue || data.location || "",
          location: data.location || data.venue || "",
          status: data.status || "active",
          isActive: data.isActive ?? true,
          isPaid: Boolean(data.isPaid),
          price: data.price || (data.isPaid ? "Paid" : "Free"),
          ticketPrice: data.ticketPrice || data.price || 0,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || null,
        });
      }
    };

    if (isSuper) {
      // Super Admin sees all events
      try {
        const snap = await adminDb.collection("events").limit(limitParam).get();
        snap.docs.forEach(addEventDoc);
      } catch (err) {
        console.warn("[api/events GET] superAdmin error:", err.message);
      }
    } else {
      // Organizer: fetch by createdBy, userId, organizerId, organiserId
      const queries = [
        adminDb.collection("events").where("createdBy", "==", caller.uid).limit(limitParam),
        adminDb.collection("events").where("userId", "==", caller.uid).limit(limitParam),
        adminDb.collection("events").where("organizerId", "==", caller.uid).limit(limitParam),
        adminDb.collection("events").where("organiserId", "==", caller.uid).limit(limitParam),
      ];

      if (caller.email) {
        queries.push(
          adminDb.collection("events").where("organiserEmail", "==", caller.email.toLowerCase().trim()).limit(limitParam)
        );
      }

      const snapshots = await Promise.allSettled(queries.map((q) => q.get()));
      for (const res of snapshots) {
        if (res.status === "fulfilled" && res.value && res.value.docs) {
          res.value.docs.forEach(addEventDoc);
        }
      }
    }

    const events = Array.from(eventsMap.values());

    // Sort by createdAt or date descending
    events.sort((a, b) => {
      const tA = new Date(a.createdAt || a.date || 0).getTime();
      const tB = new Date(b.createdAt || b.date || 0).getTime();
      return tB - tA;
    });

    return NextResponse.json({
      success: true,
      events,
      total: events.length,
    });
  } catch (err) {
    console.error("[api/events GET] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to list events" }, { status: 500 });
  }
}

