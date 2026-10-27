import { db } from "./firebase.js";
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  setDoc,
  updateDoc,
  query,
  where,
  Timestamp,
  orderBy,
} from "firebase/firestore";
import { PRESET_FIELD_DEFINITIONS } from "./form-validator.js";

/**
 * Unified Registration Form Builder Engine
 * Manages reusable, versioned form schemas for Events and Ambassador Programs (P02, FORM-001–015).
 */

// Create or save custom form schema
export const createCustomForm = async (targetId, formData, targetType = "event") => {
  try {
    const formsRef = collection(db, "customForms");
    const docRef = doc(formsRef);
    const formRecord = {
      id: docRef.id,
      targetId, // eventId or ambassadorProgramId
      eventId: targetId, // backward-compatibility
      targetType, // "event" | "ambassador"
      title: formData.title || "Registration Form",
      version: Number(formData.version || 1),
      fields: Array.isArray(formData.fields) ? formData.fields : [],
      theme: {
        logo: formData.theme?.logo || "",
        primaryColor: formData.theme?.primaryColor || "#2563EB",
        backgroundColor: formData.theme?.backgroundColor || "#FFFFFF",
        customTheme: formData.theme?.customTheme || null,
      },
      isPaid: Boolean(formData.isPaid),
      amount: Number(formData.amount || 0),
      enableCoupons: Boolean(formData.enableCoupons),
      status: formData.status || "published", // "draft" | "published"
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    await setDoc(docRef, formRecord);
    return formRecord;
  } catch (error) {
    console.error("[form-generator] Error creating custom form:", error);
    throw new Error("Failed to create custom form");
  }
};

// Update custom form
export const updateCustomForm = async (formId, formData) => {
  try {
    if (!formId) throw new Error("Form ID required");
    await updateDoc(doc(db, "customForms", formId), {
      ...formData,
      updatedAt: Timestamp.now(),
    });
    return true;
  } catch (error) {
    console.error("[form-generator] Error updating custom form:", error);
    throw new Error("Failed to update custom form");
  }
};

// Get custom form by event or target ID
export const getCustomFormByEvent = async (targetId) => {
  try {
    if (!targetId) return null;
    const formsRef = collection(db, "customForms");
    const q = query(formsRef, where("eventId", "==", targetId));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const formDoc = querySnapshot.docs[0];
      return { id: formDoc.id, ...formDoc.data() };
    }
    return null;
  } catch (error) {
    console.error("[form-generator] Error fetching custom form:", error);
    return null;
  }
};

// Get form by ambassador program
export const getCustomFormByProgram = async (programId) => {
  try {
    if (!programId) return null;
    const formsRef = collection(db, "customForms");
    const q = query(
      formsRef,
      where("targetId", "==", programId),
      where("targetType", "==", "ambassador")
    );
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const formDoc = querySnapshot.docs[0];
      return { id: formDoc.id, ...formDoc.data() };
    }
    return null;
  } catch (error) {
    console.error("[form-generator] Error fetching program form:", error);
    return null;
  }
};

// Helper to construct a standard preset field
export const getPresetField = (presetKey) => {
  const preset = PRESET_FIELD_DEFINITIONS[presetKey];
  if (!preset) return null;
  return {
    ...preset,
    id: `${preset.id}_${Date.now().toString(36)}`,
  };
};

// Publish form helper
export const publishForm = async (formId) => {
  return updateCustomForm(formId, { status: "published" });
};

export { PRESET_FIELD_DEFINITIONS };

