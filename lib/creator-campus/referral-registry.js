import crypto from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "../firebase-admin.js";

/**
 * TICKETLELO CREATOR CAMPUS AMBASSADOR PROGRAM
 * Cryptographically Secure Referral Code Generator & Transactional Registry
 */

export const REFERRAL_CODE_REGEX = /^[A-Z0-9]{4}-\d{4}$/;

/**
 * Normalize and format username to 4 uppercase alphanumeric characters
 * Deterministic fallback if username is shorter than 4 chars
 */
export function normalizeUsernamePrefix(rawNameOrUsername, emailFallback = "") {
  const sanitized = String(rawNameOrUsername || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();

  if (sanitized.length >= 4) {
    return sanitized.slice(0, 4);
  }

  // Fallback using email prefix
  const emailSanitized = String(emailFallback || "")
    .split("@")[0]
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();

  const combined = (sanitized + emailSanitized + "CAMP").slice(0, 4);
  return combined.padEnd(4, "X");
}

/**
 * Generate a referral candidate in the canonical XXXX-NNNN format
 */
export function generateCandidateCode(prefix) {
  const normPrefix = (prefix || "CAMP").toUpperCase().slice(0, 4).padEnd(4, "X");
  const randomSuffix = crypto.randomInt(1000, 10000); // 1000 to 9999
  return `${normPrefix}-${randomSuffix}`;
}

/**
 * Transactionally reserve a globally unique referral code in the referralCodes collection
 */
export async function reserveReferralCode({
  preferredCode = null,
  rawNameOrUsername,
  email,
  ambassadorId,
  userId,
  programId,
  organizerId,
}) {
  if (!adminDb) {
    throw new Error("Database service unavailable");
  }

  const prefix = normalizeUsernamePrefix(rawNameOrUsername, email);
  let attempts = 0;
  const maxAttempts = 15;

  while (attempts < maxAttempts) {
    attempts++;
    const codeCandidate = (preferredCode && attempts === 1)
      ? preferredCode.toUpperCase().trim()
      : generateCandidateCode(prefix);

    const codeRef = adminDb.collection("referralCodes").doc(codeCandidate);

    try {
      const reserved = await adminDb.runTransaction(async (t) => {
        const snap = await t.get(codeRef);
        if (snap.exists) {
          return false; // Collision, retry
        }

        t.set(codeRef, {
          code: codeCandidate,
          ambassadorId: ambassadorId || null,
          userId: userId || null,
          programId: programId || null,
          organizerId: organizerId || null,
          status: "active",
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
        return true;
      });

      if (reserved) {
        return codeCandidate;
      }
    } catch (err) {
      console.warn(`[referral-registry] Collision or lock on ${codeCandidate}:`, err?.message);
    }
  }

  throw new Error("Failed to reserve a unique referral code after multiple attempts.");
}

/**
 * Server-side lookup of an active referral code
 */
export async function resolveReferralCode(rawCode) {
  if (!rawCode || typeof rawCode !== "string" || !adminDb) return null;
  const normalized = rawCode.trim().toUpperCase();

  try {
    const docSnap = await adminDb.collection("referralCodes").doc(normalized).get();
    if (!docSnap.exists) {
      // Check legacy ambassadors collection for older format codes
      const legacyQuery = await adminDb
        .collection("ambassadors")
        .where("referralCode", "==", normalized)
        .limit(1)
        .get();

      if (!legacyQuery.empty) {
        const legDoc = legacyQuery.docs[0];
        const data = legDoc.data();
        if (data.status === "approved") {
          return {
            code: normalized,
            ambassadorId: legDoc.id,
            userId: data.userId || legDoc.id,
            programId: data.programId || "legacy",
            organizerId: data.organizerId || null,
            status: "active",
            isLegacy: true,
          };
        }
      }
      return null;
    }

    const data = docSnap.data();
    if (data.status !== "active") return null;

    return {
      id: docSnap.id,
      ...data,
    };
  } catch (err) {
    console.error("[referral-registry] Error resolving code:", err);
    return null;
  }
}

/**
 * Self-referral protection check
 */
export function isSelfReferral(buyer, ambassador) {
  if (!buyer || !ambassador) return false;

  const buyerEmail = (buyer.email || "").toLowerCase().trim();
  const ambEmail = (ambassador.email || "").toLowerCase().trim();
  if (buyerEmail && ambEmail && buyerEmail === ambEmail) {
    return true;
  }

  const buyerUid = buyer.userId || buyer.uid || null;
  const ambUid = ambassador.userId || ambassador.uid || null;
  if (buyerUid && ambUid && buyerUid === ambUid) {
    return true;
  }

  const buyerPhone = (buyer.phone || buyer.whatsappPhone || "").replace(/\D/g, "");
  const ambPhone = (ambassador.phone || ambassador.whatsappPhone || "").replace(/\D/g, "");
  if (buyerPhone && ambPhone) {
    if (buyerPhone === ambPhone || buyerPhone.endsWith(ambPhone) || ambPhone.endsWith(buyerPhone)) {
      return true;
    }
  }

  return false;
}
