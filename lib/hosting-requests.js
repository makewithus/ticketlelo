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

// Create a hosting request
export const createHostingRequest = async (requestData) => {
  try {
    const hostingRequestsRef = collection(db, "hostingRequests");
    const docRef = await addDoc(hostingRequestsRef, {
      ...requestData,
      status: "pending", // pending, approved, rejected
      createdAt: Timestamp.now(),
      organiserId: null,
      organiserEmail: null,
    });
    return { id: docRef.id, ...requestData };
  } catch (error) {
    console.error("Error creating hosting request:", error);
    throw new Error("Failed to submit hosting request");
  }
};

// Get all hosting requests (Super Admin only)
export const getAllHostingRequests = async () => {
  try {
    const hostingRequestsRef = collection(db, "hostingRequests");
    const q = query(hostingRequestsRef, orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("Error fetching hosting requests:", error);
    throw new Error("Failed to fetch hosting requests");
  }
};

// Get pending hosting requests
export const getPendingHostingRequests = async () => {
  try {
    const hostingRequestsRef = collection(db, "hostingRequests");
    const q = query(
      hostingRequestsRef,
      where("status", "==", "pending"),
      orderBy("createdAt", "desc"),
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("Error fetching pending requests:", error);
    throw new Error("Failed to fetch pending requests");
  }
};

// Provision through the authenticated server route; never create credentials in the browser.
export const approveHostingRequest = async (requestId, requestData) => {
  try {
    const response = await fetch("/api/create-organiser", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...requestData, email: requestData.email }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Organizer provisioning failed");
    await updateDoc(doc(db, "hostingRequests", requestId), {
      status: "approved",
      organiserId: result.organiserId,
      organiserEmail: result.organiserEmail,
      approvedAt: Timestamp.now(),
      isExisting: result.isExisting,
    });
    return result;
  } catch (error) {
    console.error("Error approving hosting request:", error);
    throw new Error("Failed to approve hosting request");
  }
};

// Reject hosting request
export const rejectHostingRequest = async (requestId, reason = "") => {
  try {
    await updateDoc(doc(db, "hostingRequests", requestId), {
      status: "rejected",
      rejectionReason: reason,
      rejectedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error("Error rejecting hosting request:", error);
    throw new Error("Failed to reject hosting request");
  }
};

// Update organiser credentials (Super Admin only)
export const updateOrganiserCredentials = async (
  _organiserId,
  _newEmail,
  _newPassword,
) => {
  throw new Error("Credential changes are not supported here. Use Firebase Authentication account settings or password recovery.");
};
