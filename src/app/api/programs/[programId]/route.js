import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

/**
 * Public Program Information Endpoint
 * Returns public-facing program details for student application portal & landing pages
 */
export async function GET(request, { params }) {
  try {
    const { programId } = await params;
    if (!adminDb || !programId) {
      return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
    }

    const docSnap = await adminDb.collection("ambassadorPrograms").doc(programId).get();
    if (!docSnap.exists) {
      return NextResponse.json({ error: "Program not found" }, { status: 404 });
    }

    const data = docSnap.data();
    if (data.status === "archived") {
      return NextResponse.json({ error: "This program has ended and is archived." }, { status: 410 });
    }

    const parseIso = (ts) => (typeof ts?.toDate === "function" ? ts.toDate().toISOString() : null);

    return NextResponse.json({
      success: true,
      program: {
        id: docSnap.id,
        title: data.title || data.name || "Campus Ambassador Program",
        name: data.name || data.title || "Campus Ambassador Program",
        description: data.description || "",
        college: data.college || "",
        logo: data.logo || "",
        status: data.status || "draft",
        isActive: Boolean(data.isActive),
        startDate: parseIso(data.startDate),
        endDate: parseIso(data.endDate),
        applicationStartDate: parseIso(data.applicationStartDate),
        applicationEndDate: parseIso(data.applicationEndDate),
        pointsRules: data.pointsRules || {
          basePointsPerTicket: 10,
          paidMultiplier: 2,
        },
      },
    });
  } catch (err) {
    console.error("[api/programs/[id] GET] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to load program" }, { status: 500 });
  }
}
