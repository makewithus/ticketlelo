import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { adminDb } from "@/lib/firebase-admin";
import { claimReward } from "@/lib/creator-campus/rewards-service";
import { notifyRewardClaimed } from "@/lib/creator-campus/notifications";

export async function POST(request, { params }) {
  try {
    const caller = await getAuthenticatedUser(request);
    if (!caller) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const { rewardId } = await params;
    const { ambassadorId } = await request.json();

    if (!rewardId || !ambassadorId) {
      return NextResponse.json({ error: "Reward ID and ambassador profile ID required" }, { status: 400 });
    }

    const result = await claimReward({
      rewardId,
      ambassadorId,
      userId: caller.uid,
    });

    // Notify ambassador
    (async () => {
      try {
        const ambSnap = await adminDb.collection("programAmbassadors").doc(ambassadorId).get();
        if (ambSnap.exists) {
          const amb = ambSnap.data();
          await notifyRewardClaimed({
            email: amb.email || caller.email,
            name: amb.fullName || "Ambassador",
            rewardTitle: result.rewardTitle,
            claimInstructions: result.claimInstructions,
            programId: amb.programId,
          });
        }
      } catch (nErr) {
        console.warn("[claimReward] Notification dispatch warning:", nErr?.message);
      }
    })();

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("[api/ambassador/rewards/claim POST] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to claim reward" }, { status: 400 });
  }
}

