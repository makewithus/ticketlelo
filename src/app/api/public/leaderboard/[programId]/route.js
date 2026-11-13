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
    if (prog.status !== "published" && prog.isActive !== true && prog.status !== "active") {
      return NextResponse.json({ error: "Program leaderboard is not public" }, { status: 403 });
    }

    let leaderboard = [];

    if (eventId) {
      // Event-scoped points calculation from pointsLedger
      const ledgerSnap = await adminDb
        .collection("pointsLedger")
        .where("programId", "==", programId)
        .get();

      const totalsByAmbassador = {};
      for (const d of ledgerSnap.docs) {
        const item = d.data();
        if (item.eventId !== eventId || item.status !== "completed") continue;
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
              college: data.college || prog.college || "",
              referralCount: Number(data.referralCount || 0),
              totalPoints: Math.max(0, totalsByAmbassador[doc.id]),
            });
          }
        }
      }
    } else {
      // Overall program leaderboard: Single-field Firestore query to prevent composite index requirement
      const snap = await adminDb
        .collection("programAmbassadors")
        .where("programId", "==", programId)
        .get();

      for (const doc of snap.docs) {
        const data = doc.data();
        if (data.status && data.status !== "active") continue;
        const fullName = data.fullName || "Campus Ambassador";
        const parts = fullName.trim().split(" ");
        const displayName = parts.length > 1 ? `${parts[0]} ${parts[1][0]}.` : parts[0];

        leaderboard.push({
          ambassadorId: doc.id,
          displayName,
          college: data.college || prog.college || "",
          referralCount: Number(data.referralCount || 0),
          totalPoints: Number(data.totalPoints || 0),
        });
      }
    }

    // Sort descending by points with deterministic, documented tie-breaking:
    // 1. Highest totalPoints first
    // 2. Earliest achieved timestamp / registration date
    // 3. Alphabetical by displayName
    leaderboard.sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) {
        return b.totalPoints - a.totalPoints;
      }
      const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
      const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
      if (timeA && timeB && timeA !== timeB) {
        return timeA - timeB; // Earlier achievement takes precedence
      }
      return (a.displayName || "").localeCompare(b.displayName || "");
    });

    // Assign integer ranks (Privacy-compliant: no raw revenue, sales, conversion, or attendee details exposed)
    const ranked = leaderboard.slice(0, limit).map((entry, index) => ({
      rank: index + 1,
      displayName: entry.displayName,
      college: entry.college || "",
      totalPoints: entry.totalPoints,
      avatarInitial: entry.displayName ? entry.displayName.charAt(0).toUpperCase() : "A",
    }));

    const resolvedTitle = prog.title || prog.name || "Campus Ambassador Program";
    const totalPoints = leaderboard.reduce((acc, curr) => acc + (curr.totalPoints || 0), 0);
    const totalAmbassadors = leaderboard.length;

    return NextResponse.json({
      success: true,
      programId,
      programName: resolvedTitle,
      programTitle: resolvedTitle,
      description: prog.description || "",
      college: prog.college || "",
      stats: {
        totalAmbassadors,
        totalPoints,
      },
      leaderboard: ranked,
    });
  } catch (err) {
    console.error("[api/public/leaderboard GET] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to load leaderboard" }, { status: 500 });
  }
}

