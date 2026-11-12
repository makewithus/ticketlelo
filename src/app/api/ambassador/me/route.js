import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { verifySessionFromRequest } from "@/lib/access-policy";

export async function GET(request) {
  try {
    const auth = await verifySessionFromRequest(request);
    if (!auth || !auth.uid) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const userId = auth.uid;

    // 1. Check programAmbassadors
    const ambSnap = await adminDb
      .collection("programAmbassadors")
      .where("userId", "==", userId)
      .limit(10)
      .get();

    let enrollments = [];

    for (const doc of ambSnap.docs) {
      const data = doc.data();
      const programId = data.programId;

      let program = null;
      if (programId) {
        const progDoc = await adminDb.collection("ambassadorPrograms").doc(programId).get();
        if (progDoc.exists) {
          program = { id: progDoc.id, ...progDoc.data() };
        }
      }

      // Ledger history
      const ledgerSnap = await adminDb
        .collection("pointsLedger")
        .where("ambassadorId", "==", doc.id)
        .limit(50)
        .get();

      const ledger = ledgerSnap.docs
        .map((l) => ({ id: l.id, ...l.data() }))
        .sort((a, b) => {
          const tA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
          const tB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
          return tB - tA;
        });

      // Program rewards
      let rewards = [];
      if (programId) {
        const rewSnap = await adminDb
          .collection("ambassadorRewards")
          .where("programId", "==", programId)
          .where("isActive", "==", true)
          .get();
        rewards = rewSnap.docs.map((r) => ({ id: r.id, ...r.data() }));
      }

      // Program rank
      let rank = 1;
      if (programId) {
        const higherPtsSnap = await adminDb
          .collection("programAmbassadors")
          .where("programId", "==", programId)
          .where("totalPoints", ">", data.totalPoints || 0)
          .get();
        rank = higherPtsSnap.size + 1;
      }

      enrollments.push({
        id: doc.id,
        ambassadorId: doc.id,
        userId: data.userId,
        programId: data.programId,
        program,
        referralCode: data.referralCode,
        totalPoints: data.totalPoints || 0,
        enrolledAt: data.enrolledAt,
        status: data.status || "active",
        ledger,
        rewards,
        rank,
      });
    }

    // 2. Backward compatibility: check legacy `ambassadors` collection if enrollments is empty
    if (enrollments.length === 0) {
      const legacySnap = await adminDb
        .collection("ambassadors")
        .where("userId", "==", userId)
        .limit(1)
        .get();

      if (!legacySnap.empty) {
        const legDoc = legacySnap.docs[0];
        const legData = legDoc.data();
        enrollments.push({
          id: legDoc.id,
          ambassadorId: legDoc.id,
          userId: legData.userId,
          programId: legData.programId || "legacy_program",
          program: {
            id: legData.programId || "legacy_program",
            name: "Campus Ambassador Network",
            college: legData.college || "",
          },
          referralCode: legData.referralCode,
          totalPoints: legData.metrics?.points || 0,
          status: legData.status || "active",
          ledger: [],
          rewards: [],
          rank: 1,
        });
      }
    }

    // 3. User's submitted applications
    const appsSnap = await adminDb
      .collection("ambassadorApplications")
      .where("userId", "==", userId)
      .limit(10)
      .get();

    const myApplications = appsSnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    // 4. Available published programs
    const pubProgSnap = await adminDb
      .collection("ambassadorPrograms")
      .where("status", "==", "published")
      .limit(10)
      .get();

    const availablePrograms = pubProgSnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    return NextResponse.json({
      enrollments,
      myApplications,
      availablePrograms,
    });
  } catch (error) {
    console.error("Ambassador me API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
