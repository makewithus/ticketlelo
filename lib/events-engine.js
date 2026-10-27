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
import { getOrganization } from "./organizations.js";

/**
 * Major Event (Parent Container) Engine
 * Manages parent events, multi-track festivals, and global capacity (P04, EVENT-001–EVENT-015).
 */

export const createMajorEvent = async (eventPayload, userId, organizationId = null) => {
  try {
    if (!eventPayload.title && !eventPayload.name) {
      throw new Error("Event title is required.");
    }

    const title = (eventPayload.title || eventPayload.name).trim();
    const cleanSlug = (eventPayload.slug || title)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const eventRef = doc(collection(db, "events"));

    const majorEvent = {
      id: eventRef.id,
      title,
      name: title, // Backward compatibility with existing UI
      slug: cleanSlug,
      description: eventPayload.description || "",
      bannerUrl: eventPayload.bannerUrl || eventPayload.coverImage || "",
      logoUrl: eventPayload.logoUrl || "",
      startDate: eventPayload.startDate || null,
      endDate: eventPayload.endDate || null,
      venue: eventPayload.venue || "",
      city: eventPayload.city || "",
      address: eventPayload.address || "",
      locationUrl: eventPayload.locationUrl || "",
      organizationId: organizationId || eventPayload.organizationId || null,
      createdBy: userId || null,
      globalCapacity: Number(eventPayload.globalCapacity || eventPayload.capacity || 0),
      capacity: Number(eventPayload.globalCapacity || eventPayload.capacity || 0),
      hasSubEvents: eventPayload.hasSubEvents !== false,
      isPublished: eventPayload.isPublished === true,
      isActive: eventPayload.isActive !== false,
      visibility: eventPayload.visibility || "public",
      currency: eventPayload.currency || "INR",
      registrationSettings: {
        allowWaitlist: false,
        requireApproval: false,
        refundPolicy: "No refunds within 24 hours of event start.",
        ...(eventPayload.registrationSettings || {}),
      },
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    await setDoc(eventRef, majorEvent);
    return majorEvent;
  } catch (error) {
    console.error("[events-engine] createMajorEvent error:", error.message);
    throw error;
  }
};

export const getMajorEvent = async (eventId) => {
  try {
    if (!eventId) return null;
    const docSnap = await getDoc(doc(db, "events", eventId));
    if (!docSnap.exists()) return null;
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      title: data.title || data.name || "Untitled Event",
      globalCapacity: data.globalCapacity || data.capacity || 0,
    };
  } catch (error) {
    console.error("[events-engine] getMajorEvent error:", error.message);
    return null;
  }
};

export const getMajorEventBySlug = async (slug) => {
  try {
    if (!slug) return null;
    const cleanSlug = slug.toLowerCase().trim();
    const q = query(
      collection(db, "events"),
      where("slug", "==", cleanSlug)
    );
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const docSnap = snapshot.docs[0];
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        title: data.title || data.name || "Untitled Event",
        globalCapacity: data.globalCapacity || data.capacity || 0,
      };
    }
    return null;
  } catch (error) {
    console.error("[events-engine] getMajorEventBySlug error:", error.message);
    return null;
  }
};

export const updateMajorEvent = async (eventId, updates) => {
  try {
    if (!eventId) throw new Error("Event ID required");
    const eventRef = doc(db, "events", eventId);

    const safeUpdates = {
      ...updates,
      updatedAt: Timestamp.now(),
    };
    if (updates.title) safeUpdates.name = updates.title;

    await updateDoc(eventRef, safeUpdates);
    return true;
  } catch (error) {
    console.error("[events-engine] updateMajorEvent error:", error.message);
    throw error;
  }
};

export const publishMajorEvent = async (eventId, isPublished = true) => {
  try {
    return await updateMajorEvent(eventId, {
      isPublished,
      isActive: isPublished,
    });
  } catch (error) {
    console.error("[events-engine] publishMajorEvent error:", error.message);
    throw error;
  }
};

export const getEventsByOrganization = async (orgId) => {
  try {
    if (!orgId) return [];
    const q = query(
      collection(db, "events"),
      where("organizationId", "==", orgId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      title: d.data().title || d.data().name || "Untitled Event",
    }));
  } catch (error) {
    console.error("[events-engine] getEventsByOrganization error:", error.message);
    return [];
  }
};

export const deleteMajorEvent = async (eventId) => {
  try {
    if (!eventId) throw new Error("Event ID required");
    await deleteDoc(doc(db, "events", eventId));
    return true;
  } catch (error) {
    console.error("[events-engine] deleteMajorEvent error:", error.message);
    throw error;
  }
};
