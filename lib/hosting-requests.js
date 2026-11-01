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
  onSnapshot,
} from "firebase/firestore";

// Create a hosting request (POST API with client Firestore fallback)
export const createHostingRequest = async (requestData) => {
  try {
    const res = await fetch("/api/hosting-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestData),
    });

    const result = await res.json();
    if (!res.ok) {
      throw new Error(result.error || "Failed to submit hosting request");
    }

    return result.request || { id: result.id, ...requestData };
  } catch (apiError) {
    // If it's a validation error returned from the server, do not swallow it
    if (
      apiError.message &&
      (apiError.message.includes("required") ||
        apiError.message.includes("number") ||
        apiError.message.includes("Phone") ||
        apiError.message.includes("email") ||
        apiError.message.includes("valid"))
    ) {
      throw apiError;
    }

    console.warn(
      "API submission fallback triggered, attempting client Firestore write:",
      apiError.message,
    );

    try {
      const hostingRequestsRef = collection(db, "hostingRequests");
      const cleanPhone = String(requestData.phone || "").replace(/\D/g, "");
      const finalPhone = cleanPhone.length === 12 && cleanPhone.startsWith("91") ? cleanPhone.slice(2) : cleanPhone;

      const docRef = await addDoc(hostingRequestsRef, {
        name: (requestData.name || "").trim(),
        email: (requestData.email || "").trim().toLowerCase(),
        phone: finalPhone,
        college: (requestData.college || "").trim(),
        eventTitle: (requestData.eventTitle || "").trim(),
        description: (requestData.description || "").trim(),
        isPaid: Boolean(requestData.isPaid),
        numberOfTickets: parseInt(requestData.numberOfTickets, 10) || 0,
        status: "pending", // pending, approved, rejected
        createdAt: Timestamp.now(),
        organiserId: null,
        organiserEmail: null,
        userId: requestData.userId || null,
        userAccountEmail: requestData.userAccountEmail || null,
        userRegistered: Boolean(requestData.userId || requestData.userAccountEmail),
      });

      return { id: docRef.id, ...requestData };
    } catch (clientError) {
      console.error("Error creating hosting request via fallback:", clientError);
      throw new Error(apiError.message || "Failed to submit hosting request");
    }
  }
};

/**
 * Real-time subscription to all hosting requests (Super Admin)
 * Calls callback(requests) on initial load and whenever data changes in Firestore.
 */
export const subscribeToHostingRequests = (callback, onError) => {
  try {
    const hostingRequestsRef = collection(db, "hostingRequests");
    const q = query(hostingRequestsRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const requests = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        callback(requests);
      },
      (error) => {
        console.error("Hosting requests real-time subscription error:", error);
        if (onError) onError(error);
      },
    );

    return unsubscribe;
  } catch (error) {
    console.error("Error setting up hosting requests real-time listener:", error);
    if (onError) onError(error);
    return () => {};
  }
};

/**
 * Real-time subscription to pending hosting requests count
 */
export const subscribeToPendingHostingRequestsCount = (callback, onError) => {
  try {
    const hostingRequestsRef = collection(db, "hostingRequests");
    const q = query(hostingRequestsRef, where("status", "==", "pending"));

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        callback(querySnapshot.size);
      },
      (error) => {
        console.error("Pending hosting requests count subscription error:", error);
        if (onError) onError(error);
      },
    );

    return unsubscribe;
  } catch (error) {
    console.error("Error setting up pending requests count listener:", error);
    if (onError) onError(error);
    return () => {};
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
    console.warn("Client getAllHostingRequests error, attempting API route fallback:", error.message);
    try {
      const res = await fetch("/api/hosting-requests");
      if (res.ok) {
        const json = await res.json();
        return json.requests || [];
      }
    } catch (apiErr) {
      console.error("API fallback failed:", apiErr);
    }
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
