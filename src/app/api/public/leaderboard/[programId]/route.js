import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(request, { params }) {
  try {
    const { programId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
    const eventId = searchParams.get("eventId");

    if (!adminDb || !programId) {
      return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
    }

    // 1. Verify program exists and is published
    const progSnap = await adminDb.collection("ambassadorPrograms").doc(programId).get();
    if (!progSnap.exists) {
      return NextResponse.json({ error: "Program not found" }, { status: 404 });
    }
    const prog = progSnap.data();
    if (prog.status !== "published" && prog.isActive !== true) {
      return NextResponse.json({ error: "Program leaderboard is not public" }, { status: 403 });
    }

    let leaderboard = [];

    if (eventId) {
      // Event-scoped points calculation from pointsLedger
      const ledgerSnap = await adminDb
        .collection("pointsLedger")
        .where("programId", "==", programId)
        .where("eventId", "==", eventId)
        .where("status", "==", "completed")
        .get();

      const totalsByAmbassador = {};
      for (const d of ledgerSnap.docs) {
        const item = d.data();
        const ambId = item.ambassadorId;
        totalsByAmbassador[ambId] = (totalsByAmbassador[ambId] || 0) + Number(item.totalPoints || 0);
      }

      // Fetch ambassador profiles for display names
      const ambIds = Object.keys(totalsByAmbassador);
      if (ambIds.length > 0) {
        const profilesSnap = await adminDb
          .collection("programAmbassadors")
          .where("programId", "==", programId)
          .get();

        for (const doc of profilesSnap.docs) {
          if (totalsByAmbassador[doc.id] !== undefined) {
            const data = doc.data();
            const fullName = data.fullName || "Campus Ambassador";
            // Privacy mode: Use First Name + Initial or sanitized display name
            const parts = fullName.trim().split(" ");
            const displayName = parts.length > 1 ? `${parts[0]} ${parts[1][0]}.` : parts[0];

            leaderboard.push({
              ambassadorId: doc.id,
              displayName,
              totalPoints: Math.max(0, totalsByAmbassador[doc.id]),
            });
          }
        }
      }
    } else {
      // Overall program leaderboard
      const snap = await adminDb
        .collection("programAmbassadors")
        .where("programId", "==", programId)
        .where("status", "==", "active")
        .orderBy("totalPoints", "desc")
        .limit(limit)
        .get();

      for (const doc of snap.docs) {
        const data = doc.data();
        const fullName = data.fullName || "Campus Ambassador";
        const parts = fullName.trim().split(" ");
        const displayName = parts.length > 1 ? `${parts[0]} ${parts[1][0]}.` : parts[0];

        leaderboard.push({
          ambassadorId: doc.id,
          displayName,
          totalPoints: Number(data.totalPoints || 0),
        });
      }
    }

    // Sort descending by points with stable tie-breaking
    leaderboard.sort((a, b) => b.totalPoints - a.totalPoints);

    // Assign integer ranks
    const ranked = leaderboard.slice(0, limit).map((entry, index) => ({
      rank: index + 1,
      displayName: entry.displayName,
      totalPoints: entry.totalPoints,
    }));

    return NextResponse.json({
      success: true,
      programTitle: prog.title || "Campus Ambassador Program",
      leaderboard: ranked,
    });
  } catch (err) {
    console.error("[api/public/leaderboard GET] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to load leaderboard" }, { status: 500 });
  }
}
