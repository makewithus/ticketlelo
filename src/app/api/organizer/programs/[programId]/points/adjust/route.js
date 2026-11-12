import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { adjustPointsManually } from "@/lib/creator-campus/points-engine";

export async function POST(request, { params }) {
  try {
    const caller = await getAuthenticatedUser(request);
    if (!caller) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const { programId } = await params;
    const { ambassadorId, pointsAdjustment, reason } = await request.json();

    if (!ambassadorId || !pointsAdjustment || !reason) {
      return NextResponse.json({ error: "Ambassador ID, adjustment amount, and reason are required" }, { status: 400 });
    }

    const result = await adjustPointsManually({
      ambassadorId,
      programId,
      pointsAdjustment,
      reason,
      adjustedByUid: caller.uid,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("[api/organizer/points/adjust POST] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to adjust points" }, { status: 500 });
  }
}
