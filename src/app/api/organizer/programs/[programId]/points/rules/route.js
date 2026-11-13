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

    const data = snap.docs[0].data();
    const rules = {
      id: snap.docs[0].id,
      ...DEFAULT_POINTS_RULES,
      ...data,
      global: {
        ...DEFAULT_POINTS_RULES.global,
        ...(data.global || {}),
        freeRegistrationPoints: Number(data.global?.freeRegistrationPoints ?? data.freeRegistrationPoints ?? 10),
        paidMultiplier: Number(data.global?.paidMultiplier ?? data.paidMultiplier ?? 2),
        paidRegistrationPoints: Number(data.global?.paidRegistrationPoints ?? data.paidRegistrationPoints ?? 20),
      },
      eventOverrides: data.eventOverrides || {},
      ticketOverrides: data.ticketOverrides || {},
      bonusRules: Array.isArray(data.bonusRules) ? data.bonusRules : [],
    };

    return NextResponse.json({ success: true, rules });
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

    const globalConfig = {
      freeRegistrationPoints: Number(
        body.global?.freeRegistrationPoints ?? body.basePointsPerTicket ?? body.freeRegistrationPoints ?? 10
      ),
      freeEligible: body.global?.freeEligible ?? true,
      paidType: body.global?.paidType || "multiplier",
      paidMultiplier: Number(body.global?.paidMultiplier ?? body.paidMultiplier ?? 2),
      paidRegistrationPoints: Number(
        body.global?.paidRegistrationPoints ?? body.paidRegistrationPoints ?? 20
      ),
      paidEligible: body.global?.paidEligible ?? true,
      ineligibleCategories: Array.isArray(body.global?.ineligibleCategories) ? body.global.ineligibleCategories : [],
    };

    const rulesData = {
      programId,
      organizerId: caller.uid,
      global: globalConfig,
      eventOverrides: body.eventOverrides && typeof body.eventOverrides === "object" ? body.eventOverrides : {},
      ticketOverrides: body.ticketOverrides && typeof body.ticketOverrides === "object" ? body.ticketOverrides : {},
      bonusRules: Array.isArray(body.bonusRules) ? body.bonusRules : [],
      // Backward compatibility fields
      paidRegistrationPoints: globalConfig.paidRegistrationPoints,
      freeRegistrationPoints: globalConfig.freeRegistrationPoints,
      paidMultiplier: globalConfig.paidMultiplier,
      basePointsPerTicket: globalConfig.freeRegistrationPoints,
      milestones: Array.isArray(body.milestones) ? body.milestones : DEFAULT_POINTS_RULES.milestones,
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

