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
      organiserPassword: null,
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

// Generate secure password (minimum 6 digits)
const generateSecurePassword = () => {
  const length = 8; // 8 characters for better security
  const charset =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "";

  // Ensure at least 6 digits
  for (let i = 0; i < 6; i++) {
    password += Math.floor(Math.random() * 10).toString();
  }

  // Add remaining random characters
  for (let i = 6; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }

  // Shuffle the password
  return password
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
};

// Generate organiser email from event name
const generateOrganiserEmail = (eventTitle) => {
  const sanitized = eventTitle
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .substring(0, 20);
  return `${sanitized}@ticketlelo.com`;
};

// Approve hosting request and create organiser account OR increase event limit
export const approveHostingRequest = async (requestId, requestData) => {
  try {
    // Import Firebase Auth functions
    const { createUserWithEmailAndPassword } = await import("firebase/auth");
    const { auth } = await import("./firebase");
    const { doc, setDoc, getDoc, updateDoc: updateDocImported, increment } = await import("firebase/firestore");

    // Check if organizer already exists by email
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("email", "==", requestData.email));
    const existingUsers = await getDocs(q);
    
    let organiserId;
    let organiserEmail;
    let organiserPassword;
    let isExisting = false;

    if (!existingUsers.empty) {
      // EXISTING ORGANIZER - Increase their event limit
      console.log("✅ Organizer already exists, increasing event limit");
      const existingUser = existingUsers.docs[0];
      organiserId = existingUser.id;
      const userData = existingUser.data();
      
      // Use existing email or generate new one
      organiserEmail = userData.email;
      organiserPassword = generateSecurePassword();
      isExisting = true;

      // Increase eventsAllowed by 1
      await updateDocImported(doc(db, "users", organiserId), {
        eventsAllowed: increment(1),
        lastEventRequestApproved: Timestamp.now(),
      });

      console.log("✅ Event limit increased for organizer:", organiserId);
    } else {
      // NEW ORGANIZER - Create account
      console.log("🆕 Creating new organizer account");
      organiserEmail = generateOrganiserEmail(requestData.eventTitle);
      organiserPassword = generateSecurePassword();

      // Create Firebase Auth user
      try {
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          organiserEmail,
          organiserPassword,
        );
        organiserId = userCredential.user.uid;
      } catch (authError) {
        // If email already exists, generate a unique one
        if (authError.code === "auth/email-already-in-use") {
          organiserEmail = `${requestData.eventTitle
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "")
            .substring(0, 15)}${Date.now()}@ticketlelo.com`;
          const userCredential = await createUserWithEmailAndPassword(
            auth,
            organiserEmail,
            organiserPassword,
          );
          organiserId = userCredential.user.uid;
        } else {
          throw authError;
        }
      }

    // Create organiser document in users collection
    const userDoc = {
      id: organiserId,
      email: organiserEmail,
      fullName: requestData.name,
      whatsappPhone: requestData.phone,
      college: requestData.college,
      role: "organiser", // superAdmin, organiser, user
      isAdmin: true, // Keep for backward compatibility
      eventsAllowed: 1, // Number of events they can create
      eventsCreated: 0, // Number of events they have created
      createdAt: Timestamp.now(),
    };

      await setDoc(doc(db, "users", organiserId), userDoc);
    }

    // Update hosting request
    await updateDoc(doc(db, "hostingRequests", requestId), {
      status: "approved",
      organiserId,
      organiserEmail,
      organiserPassword,
      approvedAt: Timestamp.now(),
      isExisting,
    });

    return {
      organiserId,
      organiserEmail,
      organiserPassword,
      isExisting,
    };
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
  organiserId,
  newEmail,
  newPassword,
) => {
  try {
    console.log("🔄 Updating credentials for organiser:", organiserId);

    // Update the user document in Firestore
    await updateDoc(doc(db, "users", organiserId), {
      email: newEmail,
      credentialsUpdatedAt: Timestamp.now(),
    });

    console.log("✅ Firestore user document updated");

    // Note: Firebase Auth email/password cannot be updated from another account
    // The organiser would need to update it themselves or super admin needs to
    // delete and recreate the account

    // Also update in hostingRequests if exists
    const hostingRequestsRef = collection(db, "hostingRequests");
    const q = query(
      hostingRequestsRef,
      where("organiserId", "==", organiserId),
    );
    const querySnapshot = await getDocs(q);

    for (const docSnap of querySnapshot.docs) {
      await updateDoc(doc(db, "hostingRequests", docSnap.id), {
        organiserEmail: newEmail,
        organiserPassword: newPassword,
        credentialsUpdatedAt: Timestamp.now(),
      });
    }

    console.log("✅ Hosting request credentials updated");
    return true;
  } catch (error) {
    console.error("Error updating credentials:", error);
    throw new Error("Failed to update credentials: " + error.message);
  }
};
