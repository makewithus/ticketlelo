import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { adminDb } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { DEFAULT_POINTS_RULES } from "@/lib/creator-campus/points-engine";

export async function GET(request, { params }) {
  try {
    const caller = await getAuthenticatedUser(request);
    if (!caller) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const { programId } = await params;

    const snap = await adminDb
      .collection("pointsRules")
      .where("programId", "==", programId)
      .limit(1)
      .get();

    if (snap.empty) {
      return NextResponse.json({ success: true, rules: DEFAULT_POINTS_RULES });
    }

    return NextResponse.json({ success: true, rules: { id: snap.docs[0].id, ...snap.docs[0].data() } });
  } catch (err) {
    console.error("[api/organizer/points/rules GET] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to get points rules" }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const caller = await getAuthenticatedUser(request);
    if (!caller) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const { programId } = await params;
    const body = await request.json();

    const rulesData = {
      programId,
      organizerId: caller.uid,
      paidRegistrationPoints: Number(body.paidRegistrationPoints ?? 10),
      freeRegistrationPoints: Number(body.freeRegistrationPoints ?? 2),
      milestones: Array.isArray(body.milestones) ? body.milestones : DEFAULT_POINTS_RULES.milestones,
      eventOverrides: body.eventOverrides && typeof body.eventOverrides === "object" ? body.eventOverrides : {},
      version: Number(body.version || 1) + 1,
      updatedAt: Timestamp.now(),
    };

    const snap = await adminDb
      .collection("pointsRules")
      .where("programId", "==", programId)
      .limit(1)
      .get();

    if (snap.empty) {
      const newRef = adminDb.collection("pointsRules").doc();
      await newRef.set({ id: newRef.id, createdAt: Timestamp.now(), ...rulesData });
      return NextResponse.json({ success: true, rules: { id: newRef.id, ...rulesData } });
    } else {
      const docRef = snap.docs[0].ref;
      await docRef.update(rulesData);
      return NextResponse.json({ success: true, rules: { id: docRef.id, ...rulesData } });
    }
  } catch (err) {
    console.error("[api/organizer/points/rules POST] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to save points rules" }, { status: 500 });
  }
}
