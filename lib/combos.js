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
  deleteDoc,
  Timestamp,
  runTransaction,
} from "firebase/firestore";
import { calculateRemainingSubEventCapacity } from "./sub-events.js";

/**
 * Combo Tickets, Fest Passes, and Dynamic Bottleneck Capacity Engine
 * Implements the authoritative capacity formula:
 * AvailableCombos = MIN(ComboDedicatedQuota, MIN(RemainingCapacityOfEachIncludedSubEvent))
 * (P05, P06, COMBO-001–015, CAPACITY-001–010).
 */

export const calculateAvailableCombos = (combo, subEventsMap = {}) => {
  if (!combo || !combo.isPublished) return 0;

  const dedicatedQuota = Number(combo.dedicatedQuota || 0);
  const allocated = Number(combo.allocatedCount || 0);
  const remainingDedicated = Math.max(0, dedicatedQuota - allocated);

  const includedIds = Array.isArray(combo.includedSubEventIds)
    ? combo.includedSubEventIds
    : [];

  if (includedIds.length === 0) {
    return remainingDedicated;
  }

  // Calculate remaining capacity of each included sub-event
  let minSubEventRemaining = Infinity;

  for (const subId of includedIds) {
    const sub = subEventsMap[subId];
    if (!sub) {
      // If an included sub-event doesn't exist, combo cannot be purchased
      return 0;
    }
    const rem = calculateRemainingSubEventCapacity(sub);
    if (rem < minSubEventRemaining) {
      minSubEventRemaining = rem;
    }
  }

  if (minSubEventRemaining === Infinity) {
    minSubEventRemaining = 0;
  }

  // Authoritative CTO bottleneck formula
  return Math.min(remainingDedicated, minSubEventRemaining);
};

export const createComboTicket = async ({
  parentEventId,
  organizationId,
  title,
  description = "",
  price = 0,
  dedicatedQuota = 100,
  includedSubEventIds = [],
  perks = [],
  salesStart = null,
  salesEnd = null,
  tierType = "combo", // "combo" | "fest_pass" | "single"
  isPublished = true,
}) => {
  try {
    if (!parentEventId || !title) {
      throw new Error("parentEventId and combo title are required.");
    }
    if (!Array.isArray(includedSubEventIds) || includedSubEventIds.length === 0) {
      throw new Error("Combos and fest passes must include at least one sub-event track.");
    }

    const comboRef = doc(collection(db, "combos"));
    const comboData = {
      id: comboRef.id,
      parentEventId,
      organizationId: organizationId || null,
      title: title.trim(),
      description,
      price: Number(price) || 0,
      dedicatedQuota: Number(dedicatedQuota) || 0,
      allocatedCount: 0,
      includedSubEventIds,
      perks: Array.isArray(perks) ? perks : [],
      tierType,
      salesStart,
      salesEnd,
      isPublished: Boolean(isPublished),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    await setDoc(comboRef, comboData);
    return comboData;
  } catch (error) {
    console.error("[combos] createComboTicket error:", error);
    throw error;
  }
};

export const getComboTicket = async (comboId) => {
  try {
    if (!comboId) return null;
    const docSnap = await getDoc(doc(db, "combos", comboId));
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
  } catch (error) {
    console.error("[combos] getComboTicket error:", error);
    return null;
  }
};

export const getCombosForEvent = async (parentEventId) => {
  try {
    if (!parentEventId) return [];
    const q = query(
      collection(db, "combos"),
      where("parentEventId", "==", parentEventId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error("[combos] getCombosForEvent error:", error);
    return [];
  }
};

export const updateComboTicket = async (comboId, updates) => {
  try {
    if (!comboId) throw new Error("Combo ID required");
    await updateDoc(doc(db, "combos", comboId), {
      ...updates,
      updatedAt: Timestamp.now(),
    });
    return true;
  } catch (error) {
    console.error("[combos] updateComboTicket error:", error);
    throw error;
  }
};

export const deleteComboTicket = async (comboId) => {
  try {
    if (!comboId) throw new Error("Combo ID required");
    await deleteDoc(doc(db, "combos", comboId));
    return true;
  } catch (error) {
    console.error("[combos] deleteComboTicket error:", error);
    throw error;
  }
};

/**
 * Resolves immutable entitlement snapshot for ticket issuance.
 */
export const resolveTicketEntitlements = (ticketConfig, subEventsMap = {}) => {
  if (!ticketConfig) {
    return { entitledSubEventIds: [], entitledTrackNames: [] };
  }

  const ids = Array.isArray(ticketConfig.includedSubEventIds)
    ? ticketConfig.includedSubEventIds
    : ticketConfig.subEventId
    ? [ticketConfig.subEventId]
    : [];

  const names = ids
    .map((id) => (subEventsMap[id] ? subEventsMap[id].title : null))
    .filter(Boolean);

  return {
    entitledSubEventIds: ids,
    entitledTrackNames: names.length > 0 ? names : [ticketConfig.title || "Standard Ticket"],
  };
};
