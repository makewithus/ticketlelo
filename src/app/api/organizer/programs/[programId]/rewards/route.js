import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { adminDb } from "@/lib/firebase-admin";
import { createReward, listRewardsForProgram } from "@/lib/creator-campus/rewards-service";

export async function GET(request, { params }) {
  try {
    const caller = await getAuthenticatedUser(request);
    if (!caller) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const { programId } = await params;
    const rewards = await listRewardsForProgram(programId);
    return NextResponse.json({ success: true, rewards });
  } catch (err) {
    console.error("[api/organizer/rewards GET] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to list rewards" }, { status: 500 });
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

    const reward = await createReward({
      programId,
      organizerId: caller.uid,
      title: body.title,
      description: body.description || "",
      rewardType: body.rewardType,
      thresholdPoints: body.thresholdPoints,
      inventory: body.inventory ?? -1,
      claimInstructions: body.claimInstructions || "",
      value: body.value || 0,
    });

    return NextResponse.json({ success: true, reward }, { status: 201 });
  } catch (err) {
    console.error("[api/organizer/rewards POST] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to create reward" }, { status: 500 });
  }
}

