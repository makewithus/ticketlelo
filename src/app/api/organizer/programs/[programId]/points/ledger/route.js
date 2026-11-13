import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(request, { params }) {
  try {
    const caller = await getAuthenticatedUser(request);
    if (!caller) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const { programId } = await params;
    const { searchParams } = new URL(request.url);
    const ambassadorId = searchParams.get("ambassadorId");
    const eventId = searchParams.get("eventId");
    const status = searchParams.get("status");
    const entryType = searchParams.get("entryType");
    const search = searchParams.get("search")?.toLowerCase().trim();
    const limitParam = parseInt(searchParams.get("limit") || "200", 10);

    let q = adminDb.collection("pointsLedger").where("programId", "==", programId);
    if (ambassadorId) {
      q = q.where("ambassadorId", "==", ambassadorId);
    }
    if (eventId) {
      q = q.where("eventId", "==", eventId);
    }
    if (status) {
      q = q.where("status", "==", status);
    }

    const snap = await q.get();
    let entries = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // In-memory filtering for entryType and search (to support flexible full-text query)
    if (entryType) {
      if (entryType === "earn") {
        entries = entries.filter((e) => e.entryType === "earn" || e.entryType === "earn_with_bonus");
      } else {
        entries = entries.filter((e) => e.entryType === entryType);
      }
    }

    if (search) {
      entries = entries.filter((e) => {
        const text = [
          e.ambassadorName,
          e.referralCode,
          e.orderId,
          e.registrationId,
          e.eventTitle,
          e.ticketType,
          e.reason,
          e.appliedRule?.name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return text.includes(search);
      });
    }

    // Sort descending by timestamp
    entries.sort((a, b) => {
      const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
      const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
      return timeB - timeA;
    });

    if (limitParam && limitParam > 0) {
      entries = entries.slice(0, limitParam);
    }

    return NextResponse.json({ success: true, entries, count: entries.length });
  } catch (err) {
    console.error("[api/organizer/points/ledger GET] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch points ledger" }, { status: 500 });
  }
}

