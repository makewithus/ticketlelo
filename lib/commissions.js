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
import { getAmbassadorProgram } from "./ambassadors.js";

/**
 * Ambassador Commission Ledger & Settlement Engine
 * Immutable accounting, 7-day holding period, and self-referral prevention (P03, AMB-008–018).
 */

export const calculateCommissionAmount = (program, eligibleAmount, ticketCount = 1) => {
  if (!program || !program.isActive) return 0;
  const rate = Number(program.commissionRate || 0);

  if (program.commissionType === "fixed") {
    return Math.max(0, rate * Number(ticketCount || 1));
  } else {
    // Percentage-based commission
    return Math.max(0, Math.round(Number(eligibleAmount || 0) * (rate / 100) * 100) / 100);
  }
};

export const isSelfReferral = (buyerData, ambassadorData) => {
  if (!buyerData || !ambassadorData) return false;

  const buyerEmail = (buyerData.email || "").toLowerCase().trim();
  const ambEmail = (ambassadorData.email || "").toLowerCase().trim();
  if (buyerEmail && ambEmail && buyerEmail === ambEmail) {
    return true;
  }

  const buyerPhone = (buyerData.whatsappPhone || buyerData.phone || "").replace(/\D/g, "");
  const ambPhone = (ambassadorData.whatsappPhone || ambassadorData.phone || "").replace(/\D/g, "");
  if (buyerPhone && ambPhone && (buyerPhone === ambPhone || buyerPhone.endsWith(ambPhone) || ambPhone.endsWith(buyerPhone))) {
    return true;
  }

  return false;
};

export const recordCommission = async ({
  ambassador,
  program,
  orderId,
  parentEventId,
  buyerData,
  ticketCount = 1,
  orderAmount,
  eligibleAmount,
}) => {
  try {
    if (!ambassador || !program || !orderId) {
      throw new Error("Missing parameters to record commission.");
    }

    // Check for self-referral violation
    const selfReferral = isSelfReferral(buyerData, ambassador);
    const commissionAmt = selfReferral
      ? 0
      : calculateCommissionAmount(program, eligibleAmount, ticketCount);

    const holdingDays = Number(program.holdingDays || 7);
    const matureDate = new Date();
    matureDate.setDate(matureDate.getDate() + holdingDays);

    const commissionRef = doc(collection(db, "commissions"));
    const ledgerEntry = {
      id: commissionRef.id,
      ambassadorId: ambassador.id,
      programId: program.id,
      parentEventId: parentEventId || program.parentEventId,
      orderId,
      buyerEmail: buyerData?.email || "",
      buyerName: buyerData?.fullName || "",
      ticketCount: Number(ticketCount),
      orderAmount: Number(orderAmount),
      eligibleAmount: Number(eligibleAmount),
      commissionAmount: commissionAmt,
      isSelfReferral: Boolean(selfReferral),
      status: selfReferral ? "rejected_self_referral" : "held", // "held" | "approved" | "reversed" | "paid"
      matureAt: Timestamp.fromDate(matureDate),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    await setDoc(commissionRef, ledgerEntry);

    // Update ambassador running aggregate metrics if valid
    if (!selfReferral && commissionAmt > 0) {
      try {
        const ambRef = doc(db, "ambassadors", ambassador.id);
        const ambSnap = await getDoc(ambRef);
        if (ambSnap.exists()) {
          const currentMetrics = ambSnap.data().metrics || {};
          await updateDoc(ambRef, {
            "metrics.paidOrders": (currentMetrics.paidOrders || 0) + 1,
            "metrics.attributedRevenue": (currentMetrics.attributedRevenue || 0) + Number(orderAmount),
            "metrics.earnedCommissions": (currentMetrics.earnedCommissions || 0) + commissionAmt,
            updatedAt: Timestamp.now(),
          });
        }
      } catch (updErr) {
        console.warn("[commissions] Aggregate update warning:", updErr.message);
      }
    }

    return ledgerEntry;
  } catch (error) {
    console.error("[commissions] recordCommission error:", error);
    throw error;
  }
};

export const reverseCommissionForOrder = async (orderId, reason = "Order Refunded") => {
  try {
    const q = query(
      collection(db, "commissions"),
      where("orderId", "==", orderId),
      where("status", "in", ["held", "approved"])
    );
    const snapshot = await getDocs(q);

    for (const d of snapshot.docs) {
      const entry = d.data();
      await updateDoc(d.ref, {
        status: "reversed",
        reversalReason: reason,
        reversedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      // Adjust ambassador aggregate
      try {
        const ambRef = doc(db, "ambassadors", entry.ambassadorId);
        const ambSnap = await getDoc(ambRef);
        if (ambSnap.exists()) {
          const current = ambSnap.data().metrics || {};
          await updateDoc(ambRef, {
            "metrics.earnedCommissions": Math.max(0, (current.earnedCommissions || 0) - entry.commissionAmount),
            updatedAt: Timestamp.now(),
          });
        }
      } catch (err) {
        console.warn("[commissions] Reversal aggregate adjustment warning:", err.message);
      }
    }
    return true;
  } catch (error) {
    console.error("[commissions] reverseCommissionForOrder error:", error);
    throw error;
  }
};

export const getAmbassadorCommissions = async (ambassadorId) => {
  try {
    if (!ambassadorId) return [];
    const q = query(
      collection(db, "commissions"),
      where("ambassadorId", "==", ambassadorId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error("[commissions] getAmbassadorCommissions error:", error);
    return [];
  }
};

export const generatePayoutCSV = (commissions = [], profilesMap = {}) => {
  const headers = [
    "Commission ID",
    "Ambassador ID",
    "Ambassador Name",
    "UPI ID",
    "Bank Account Number",
    "IFSC Code",
    "Order ID",
    "Tickets",
    "Order Amount (INR)",
    "Commission Amount (INR)",
    "Status",
    "Date",
  ];

  const escapeCell = (val) => {
    if (val === null || val === undefined) return '""';
    let str = String(val);
    if (/^[=+\-@\t\r]/.test(str)) {
      str = `'${str}`;
    }
    return `"${str.replace(/"/g, '""')}"`;
  };

  const rows = commissions.map((c) => {
    const profile = (profilesMap && profilesMap[c.ambassadorId]) || c.payoutProfile || c.ambassadorDetails || {};
    return [
      escapeCell(c.id || ""),
      escapeCell(c.ambassadorId || ""),
      escapeCell(profile.fullName || c.ambassadorName || ""),
      escapeCell(profile.upiId || c.upiId || ""),
      escapeCell(profile.bankAccountNumber || profile.accountNumber || c.bankAccountNumber || ""),
      escapeCell(profile.ifscCode || c.ifscCode || ""),
      escapeCell(c.orderId || ""),
      escapeCell(c.ticketCount !== undefined ? c.ticketCount : 1),
      escapeCell(c.orderAmount !== undefined ? c.orderAmount : 0),
      escapeCell(c.commissionAmount !== undefined ? c.commissionAmount : 0),
      escapeCell(c.status || "held"),
      escapeCell(c.createdAt?.toDate ? c.createdAt.toDate().toISOString() : (c.createdAt || "")),
    ].join(",");
  });

  return [headers.map(escapeCell).join(","), ...rows].join("\r\n");
};
