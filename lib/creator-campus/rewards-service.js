import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "../firebase-admin.js";

/**
 * TICKETLELO CREATOR CAMPUS AMBASSADOR PROGRAM
 * Rewards Management & Atomic Redemption Service
 */

export const REWARD_TYPES = [
  "fixed_discount",
  "percentage_discount",
  "merchandise",
  "goodies",
  "voucher",
  "special_access",
  "fixed_commission",
  "percentage_commission",
];

export async function createReward({
  programId,
  organizerId,
  title,
  description = "",
  rewardType,
  thresholdPoints,
  inventory = -1, // -1 is unlimited
  claimInstructions = "",
  value = 0,
}) {
  if (!adminDb || !programId || !organizerId || !title || !rewardType) {
    throw new Error("Missing required reward properties");
  }
  if (!REWARD_TYPES.includes(rewardType)) {
    throw new Error(`Invalid reward type: ${rewardType}`);
  }

  const rewardRef = adminDb.collection("ambassadorRewards").doc();
  const rewardData = {
    id: rewardRef.id,
    programId,
    organizerId,
    title: String(title).trim(),
    description: String(description || "").trim(),
    rewardType,
    thresholdPoints: Math.max(1, Math.round(Number(thresholdPoints) || 10)),
    inventory: Number(inventory) ?? -1,
    claimInstructions: String(claimInstructions || "").trim(),
    value: Number(value) || 0,
    isActive: true,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  await rewardRef.set(rewardData);
  return rewardData;
}

export async function listRewardsForProgram(programId) {
  if (!adminDb || !programId) return [];

  const snap = await adminDb
    .collection("ambassadorRewards")
    .where("programId", "==", programId)
    .where("isActive", "==", true)
    .get();

  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Atomic Reward Claim by an Ambassador
 */
export async function claimReward({ rewardId, ambassadorId, userId }) {
  if (!adminDb || !rewardId || !ambassadorId) {
    throw new Error("Reward ID and ambassador ID are required");
  }

  const rewardRef = adminDb.collection("ambassadorRewards").doc(rewardId);
  const ambRef = adminDb.collection("programAmbassadors").doc(ambassadorId);

  const redemptionRef = adminDb.collection("rewardRedemptions").doc();
  const ledgerRef = adminDb.collection("pointsLedger").doc();

  const result = await adminDb.runTransaction(async (t) => {
    const rSnap = await t.get(rewardRef);
    if (!rSnap.exists) throw new Error("Reward not found");
    const reward = rSnap.data();

    if (!reward.isActive) throw new Error("Reward is currently unavailable");
    if (reward.inventory !== -1 && reward.inventory <= 0) {
      throw new Error("This reward is out of stock");
    }

    const aSnap = await t.get(ambRef);
    if (!aSnap.exists) throw new Error("Ambassador profile not found");
    const ambassador = aSnap.data();

    const pointsCost = Number(reward.thresholdPoints || 0);
    const curBalance = Number(ambassador.totalPoints || 0);

    if (curBalance < pointsCost) {
      throw new Error(`Insufficient points: Required ${pointsCost}, you currently have ${curBalance}`);
    }

    // 1. Deduct points
    const newBalance = curBalance - pointsCost;
    t.update(ambRef, {
      totalPoints: newBalance,
      updatedAt: Timestamp.now(),
    });

    // 2. Decrement inventory if limited
    if (reward.inventory > 0) {
      t.update(rewardRef, {
        inventory: reward.inventory - 1,
        updatedAt: Timestamp.now(),
      });
    }

    // 3. Write redemption entry
    const redemptionData = {
      id: redemptionRef.id,
      rewardId,
      programId: reward.programId,
      organizerId: reward.organizerId,
      ambassadorId,
      userId: userId || ambassador.userId,
      rewardTitle: reward.title,
      rewardType: reward.rewardType,
      pointsSpent: pointsCost,
      claimInstructions: reward.claimInstructions || "",
      status: "claimed",
      claimedAt: Timestamp.now(),
      fulfilledAt: null,
    };
    t.set(redemptionRef, redemptionData);

    // 4. Write points ledger debit
    const ledgerData = {
      id: ledgerRef.id,
      idempotencyKey: `claim_${redemptionRef.id}`,
      ambassadorId,
      userId: userId || ambassador.userId,
      programId: reward.programId,
      eventId: null,
      basePoints: -pointsCost,
      bonusPoints: 0,
      totalPoints: -pointsCost,
      entryType: "redeem_reward",
      reason: `Claimed reward: ${reward.title}`,
      status: "completed",
      reversalRef: null,
      createdAt: Timestamp.now(),
    };
    t.set(ledgerRef, ledgerData);

    return {
      redemptionId: redemptionRef.id,
      rewardTitle: reward.title,
      pointsSpent: pointsCost,
      remainingPoints: newBalance,
      claimInstructions: reward.claimInstructions || "",
    };
  });

  return result;
}

