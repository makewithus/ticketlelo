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
  orderBy,
} from "firebase/firestore";
import { db } from "./firebase.js";
import { getMajorEvent } from "./events-engine.js";

/**
 * Child Sub-Event Engine
 * Manages individual rooms, tracks, workshops, webinars, and independent capacity (P04, SUBEVENT-001–015).
 */

export const createSubEvent = async (subEventPayload, organizationId = null) => {
  try {
    const {
      parentEventId,
      title,
      slug,
      trackType = "workshop",
      date,
      startTime = "10:00 AM",
      endTime = "01:00 PM",
      timezone = "Asia/Kolkata",
      venue = "",
      isVirtual = false,
      virtualMeetingUrl = "",
      virtualMeetingPasscode = "",
      capacity = 100,
      standalonePrice = 0,
      pricingMode = "paid", // "free" | "paid" | "combo_only" | "pass_only"
      customQuestions = [],
      isPublished = true,
    } = subEventPayload;

    if (!parentEventId) {
      throw new Error("parentEventId is required to create a sub-event.");
    }
    if (!title) {
      throw new Error("Sub-event title is required.");
    }

    // Verify parent event exists
    const parent = await getMajorEvent(parentEventId);
    if (!parent) {
      throw new Error(`Parent event with ID ${parentEventId} not found.`);
    }

    const cleanSlug = (slug || title)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const subEventRef = doc(collection(db, "subEvents"));

    const subEventData = {
      id: subEventRef.id,
      parentEventId,
      organizationId: organizationId || parent.organizationId || null,
      title: title.trim(),
      slug: cleanSlug,
      description: subEventPayload.description || "",
      trackType,
      date: date || parent.startDate || "",
      startTime,
      endTime,
      timezone,
      venue: venue.trim() || parent.venue || "",
      isVirtual: Boolean(isVirtual),
      ...(Boolean(isVirtual) && virtualMeetingUrl.trim()
        ? {
            virtualMeetingUrl: virtualMeetingUrl.trim(),
            ...(virtualMeetingPasscode.trim() ? { virtualMeetingPasscode: virtualMeetingPasscode.trim() } : {}),
          }
        : {}),
      capacity: Number(capacity) || 0,
      standalonePrice: Number(standalonePrice) || 0,
      pricingMode,
      allocatedSeats: 0,
      customQuestions: Array.isArray(customQuestions) ? customQuestions : [],
      isPublished: Boolean(isPublished),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    await setDoc(subEventRef, subEventData);
    return subEventData;
  } catch (error) {
    console.error("[sub-events] createSubEvent error:", error.message);
    throw error;
  }
};

export const getSubEvent = async (subEventId) => {
  try {
    if (!subEventId) return null;
    const docSnap = await getDoc(doc(db, "subEvents", subEventId));
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() };
  } catch (error) {
    console.error("[sub-events] getSubEvent error:", error.message);
    return null;
  }
};

export const getSubEventsForEvent = async (parentEventId) => {
  try {
    if (!parentEventId) return [];
    const q = query(
      collection(db, "subEvents"),
      where("parentEventId", "==", parentEventId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));
  } catch (error) {
    console.error("[sub-events] getSubEventsForEvent error:", error.message);
    return [];
  }
};

export const updateSubEvent = async (subEventId, updates) => {
  try {
    if (!subEventId) throw new Error("Sub-event ID required");
    const subEventRef = doc(db, "subEvents", subEventId);

    await updateDoc(subEventRef, {
      ...updates,
      updatedAt: Timestamp.now(),
    });
    return true;
  } catch (error) {
    console.error("[sub-events] updateSubEvent error:", error.message);
    throw error;
  }
};

export const deleteSubEvent = async (subEventId) => {
  try {
    if (!subEventId) throw new Error("Sub-event ID required");
    const linkedCombos = await getDocs(query(
      collection(db, "combos"),
      where("includedSubEventIds", "array-contains", subEventId)
    ));
    if (linkedCombos.docs.some((combo) => combo.data().isPublished)) {
      throw new Error("Cannot delete a sub-event included in a published combo. Unpublish or edit the combo first.");
    }
    await deleteDoc(doc(db, "subEvents", subEventId));
    return true;
  } catch (error) {
    console.error("[sub-events] deleteSubEvent error:", error.message);
    throw error;
  }
};

export const calculateRemainingSubEventCapacity = (subEvent) => {
  if (!subEvent) return 0;
  const capacity = Number(subEvent.capacity || 0);
  const allocated = Number(subEvent.allocatedSeats || 0);
  return Math.max(0, capacity - allocated);
};
