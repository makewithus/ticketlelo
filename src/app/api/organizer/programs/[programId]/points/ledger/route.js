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

    let q = adminDb.collection("pointsLedger").where("programId", "==", programId);
    if (ambassadorId) {
      q = q.where("ambassadorId", "==", ambassadorId);
    }

    const snap = await q.get();
    let entries = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // Sort descending by timestamp
    entries.sort((a, b) => {
      const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
      const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
      return timeB - timeA;
    });

    return NextResponse.json({ success: true, entries });
  } catch (err) {
    console.error("[api/organizer/points/ledger GET] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch points ledger" }, { status: 500 });
  }
}

