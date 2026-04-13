import { db } from "./firebase";
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  query,
  where,
  Timestamp,
  orderBy,
} from "firebase/firestore";

// Create a custom form for an event
export const createCustomForm = async (eventId, formData) => {
  try {
    const formsRef = collection(db, "customForms");
    const docRef = await addDoc(formsRef, {
      eventId,
      fields: formData.fields, // Array of field objects
      theme: formData.theme, // { logo, color, customTheme }
      isPaid: formData.isPaid,
      amount: formData.amount || 0,
      paymentCredentials: formData.paymentCredentials || null,
      enableCoupons: formData.enableCoupons || false,
      status: formData.status || "draft", // draft, published
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return { id: docRef.id, ...formData };
  } catch (error) {
    console.error("Error creating custom form:", error);
    throw new Error("Failed to create custom form");
  }
};

// Update custom form
export const updateCustomForm = async (formId, formData) => {
  try {
    await updateDoc(doc(db, "customForms", formId), {
      ...formData,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error("Error updating custom form:", error);
    throw new Error("Failed to update custom form");
  }
};

// Get custom form by event ID
export const getCustomFormByEvent = async (eventId) => {
  try {
    const formsRef = collection(db, "customForms");
    const q = query(formsRef, where("eventId", "==", eventId));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return { id: doc.id, ...doc.data() };
    }
    return null;
  } catch (error) {
    console.error("Error fetching custom form:", error);
    throw new Error("Failed to fetch custom form");
  }
};

// Get published forms
export const getPublishedForms = async () => {
  try {
    const formsRef = collection(db, "customForms");
    const q = query(
      formsRef,
      where("status", "==", "published"),
      orderBy("createdAt", "desc"),
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("Error fetching published forms:", error);
    throw new Error("Failed to fetch published forms");
  }
};

// Publish form
export const publishForm = async (formId) => {
  try {
    await updateDoc(doc(db, "customForms", formId), {
      status: "published",
      publishedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error("Error publishing form:", error);
    throw new Error("Failed to publish form");
  }
};

// Save as draft
export const saveDraft = async (formId, formData) => {
  try {
    await updateDoc(doc(db, "customForms", formId), {
      ...formData,
      status: "draft",
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error("Error saving draft:", error);
    throw new Error("Failed to save draft");
  }
};
