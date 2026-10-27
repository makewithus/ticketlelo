import { db } from "./firebase.js";
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
  Timestamp,
  orderBy,
} from "firebase/firestore";

/**
 * Campus Ambassador Program & Application Service
 * Professional, un-gamified ambassador operations (P03, AMB-001–020).
 */

export const createAmbassadorProgram = async ({
  parentEventId,
  organizationId,
  title,
  commissionType = "percentage", // "percentage" | "fixed"
  commissionRate = 10, // 10% or ₹50 fixed per ticket
  holdingDays = 7,
  guidelines = "",
}) => {
  try {
    if (!parentEventId || !title) {
      throw new Error("parentEventId and program title are required.");
    }

    const programRef = doc(collection(db, "ambassadorPrograms"));
    const programData = {
      id: programRef.id,
      parentEventId,
      organizationId: organizationId || null,
      title: title.trim(),
      commissionType,
      commissionRate: Number(commissionRate) || 0,
      holdingDays: Number(holdingDays) || 7,
      guidelines,
      isActive: true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    await setDoc(programRef, programData);
    return programData;
  } catch (error) {
    console.error("[ambassadors] createAmbassadorProgram error:", error);
    throw error;
  }
};

export const getAmbassadorProgram = async (programId) => {
  try {
    if (!programId) return null;
    const docSnap = await getDoc(doc(db, "ambassadorPrograms", programId));
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
  } catch (error) {
    console.error("[ambassadors] getAmbassadorProgram error:", error);
    return null;
  }
};

export const getAmbassadorProgramsForEvent = async (parentEventId) => {
  try {
    if (!parentEventId) return [];
    const q = query(
      collection(db, "ambassadorPrograms"),
      where("parentEventId", "==", parentEventId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error("[ambassadors] getAmbassadorProgramsForEvent error:", error);
    return [];
  }
};

export const submitAmbassadorApplication = async ({
  userId,
  programId,
  parentEventId,
  fullName,
  email,
  whatsappPhone,
  college,
  answers = {},
}) => {
  try {
    if (!userId || !programId || !parentEventId) {
      throw new Error("Missing application identifiers");
    }

    // Generate unique referral code candidate
    const namePrefix = (fullName || "AMB")
      .replace(/[^a-zA-Z]/g, "")
      .toUpperCase()
      .substring(0, 5);
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const referralCode = `${namePrefix}${randomSuffix}`;

    const ambRef = doc(db, "ambassadors", userId);
    const applicationData = {
      id: userId,
      userId,
      programId,
      parentEventId,
      fullName: fullName.trim(),
      email: email.toLowerCase().trim(),
      whatsappPhone: (whatsappPhone || "").replace(/\D/g, ""),
      college: (college || "").trim(),
      referralCode,
      status: "pending", // "pending" | "approved" | "rejected"
      answers,
      metrics: {
        clicks: 0,
        registrations: 0,
        paidOrders: 0,
        attributedRevenue: 0,
        earnedCommissions: 0,
      },
      appliedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    await setDoc(ambRef, applicationData);
    return applicationData;
  } catch (error) {
    console.error("[ambassadors] submitAmbassadorApplication error:", error);
    throw error;
  }
};

export const approveAmbassador = async (ambassadorId) => {
  try {
    const ambRef = doc(db, "ambassadors", ambassadorId);
    await updateDoc(ambRef, {
      status: "approved",
      approvedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    // Also update user document role to ambassador if currently regular user
    try {
      const userRef = doc(db, "users", ambassadorId);
      const userDoc = await getDoc(userRef);
      if (userDoc.exists() && userDoc.data().role === "user") {
        await updateDoc(userRef, { role: "ambassador", updatedAt: Timestamp.now() });
      }
    } catch (uErr) {
      console.warn("[ambassadors] Could not update user role:", uErr.message);
    }

    return true;
  } catch (error) {
    console.error("[ambassadors] approveAmbassador error:", error);
    throw error;
  }
};

export const rejectAmbassador = async (ambassadorId, rejectionReason = "") => {
  try {
    const ambRef = doc(db, "ambassadors", ambassadorId);
    await updateDoc(ambRef, {
      status: "rejected",
      rejectionReason,
      updatedAt: Timestamp.now(),
    });
    return true;
  } catch (error) {
    console.error("[ambassadors] rejectAmbassador error:", error);
    throw error;
  }
};

export const getAmbassadorByUserId = async (userId) => {
  try {
    if (!userId) return null;
    const docSnap = await getDoc(doc(db, "ambassadors", userId));
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
  } catch (error) {
    console.error("[ambassadors] getAmbassadorByUserId error:", error);
    return null;
  }
};

export const getAmbassadorByReferralCode = async (referralCode) => {
  try {
    if (!referralCode) return null;
    const q = query(
      collection(db, "ambassadors"),
      where("referralCode", "==", referralCode.toUpperCase().trim())
    );
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const d = snapshot.docs[0];
      return { id: d.id, ...d.data() };
    }
    return null;
  } catch (error) {
    console.error("[ambassadors] getAmbassadorByReferralCode error:", error);
    return null;
  }
};

export const getAmbassadorsForProgram = async (programId) => {
  try {
    if (!programId) return [];
    const q = query(
      collection(db, "ambassadors"),
      where("programId", "==", programId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error("[ambassadors] getAmbassadorsForProgram error:", error);
    return [];
  }
};
