import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth, db } from "./firebase";
import {
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  Timestamp,
} from "firebase/firestore";

export const getAuthErrorMessage = (error, fallback = "Something went wrong. Please try again.") => {
  const raw =
    typeof error === "string"
      ? error
      : error?.code || error?.message || fallback;
  const message = String(raw).toLowerCase();

  if (
    message.includes("invalid-credential") ||
    message.includes("wrong-password") ||
    message.includes("invalid-login-credentials")
  ) {
    return "Incorrect email or password. Please check your details and try again.";
  }

  if (message.includes("user-not-found")) {
    return "No account was found with this email address.";
  }

  if (message.includes("email-already-in-use")) {
    return "An account already exists with this email address.";
  }

  if (message.includes("invalid-email")) {
    return "Please enter a valid email address.";
  }

  if (message.includes("weak-password")) {
    return "Please use a stronger password with at least 6 characters.";
  }

  if (message.includes("too-many-requests")) {
    return "Too many attempts. Please wait a moment and try again.";
  }

  if (message.includes("network-request-failed")) {
    return "Network error. Please check your connection and try again.";
  }

  if (message.includes("firebase:") || message.includes("auth/")) {
    return fallback;
  }

  return raw || fallback;
};

const establishServerSession = async (firebaseUser) => {
  const idToken = await firebaseUser.getIdToken();
  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!response.ok) throw new Error("Could not establish a secure server session");
};

export const signup = async (email, password, fullName, whatsappPhone) => {
  try {
    // Normalize email to lowercase
    const normalizedEmail = email.toLowerCase().trim();

    console.log(" AUTH.JS - Starting signup process:");
    console.log("   Email:", normalizedEmail);
    console.log("   Full Name:", fullName);
    console.log("   Phone:", whatsappPhone);

    const userCredential = await createUserWithEmailAndPassword(
      auth,
      normalizedEmail,
      password,
    );
    const firebaseUser = userCredential.user;
    await establishServerSession(firebaseUser);

    console.log(" Firebase Auth account created:");
    console.log("   UID:", firebaseUser.uid);
    console.log("   Email:", firebaseUser.email);

    // Create user document in Firestore (never store password in database)
    const userData = {
      id: firebaseUser.uid,
      email: normalizedEmail,
      fullName,
      whatsappPhone: whatsappPhone || "",
      createdAt: Timestamp.now(),
      isAdmin: false,
      role: "user", // Default attendee role
    };

    await setDoc(doc(db, "users", firebaseUser.uid), userData);
    return userData;
  } catch (error) {
    console.error(" Signup error:", error.message);
    throw new Error(getAuthErrorMessage(error, "Failed to create account. Please try again."));
  }
};

export const login = async (email, password) => {
  try {
    // Normalize email to lowercase
    const normalizedEmail = email.toLowerCase().trim();

    const userCredential = await signInWithEmailAndPassword(
      auth,
      normalizedEmail,
      password,
    );
    const firebaseUser = userCredential.user;
    await establishServerSession(firebaseUser);

    // Fetch user data from Firestore with timeout fallback
    try {
      const userData = await Promise.race([
        getCurrentUser(firebaseUser.uid),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), 5000),
        ),
      ]);
      if (userData) return userData;
    } catch (firestoreErr) {
      console.warn(
        "Firestore fetch failed/timed out, using auth data:",
        firestoreErr.message,
      );
    }

    // Fallback: return basic user data from Firebase Auth
    return {
      id: firebaseUser.uid,
      email: firebaseUser.email,
      fullName:
        firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "User",
      isAdmin: false,
    };
  } catch (error) {
    console.error("Login error:", error.message);
    throw new Error(getAuthErrorMessage(error, "Login failed. Please try again."));
  }
};

export const logout = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Logout error:", error.message);
    throw new Error(getAuthErrorMessage(error, "Failed to logout. Please try again."));
  }
};
// No unauthenticated profile lookup or pseudo-success passwordless flow.
export const findUserByEmailOrPhone = async () => {
  throw new Error("Account lookup requires a verified authentication flow");
};

export const sendMagicLinkOrOTP = async (emailOrPhone) => {
  if (!String(emailOrPhone || "").includes("@")) {
    throw new Error("Password recovery currently requires an email address");
  }
  return sendPasswordReset(emailOrPhone);
};
// Secure login with email and phone lookup
export const loginWithEmailAndPhone = async (email, phone, password = null) => {
  try {
    const cleanEmail = email.toLowerCase().trim();

    // If password provided, use standard secure login
    if (password) {
      return await login(cleanEmail, password);
    }

    // Direct passwordless login via stored plaintext is removed for security (SEC-02).
    // Send password reset email instead to allow user to access their account safely.
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
    } catch (e) {
      // Ignore reset email error if user doesn't exist
    }
    throw new Error(
      "Password authentication is required. If you forgot your password, a reset link has been sent to " + cleanEmail
    );
  } catch (error) {
    console.error("Login with email/phone error:", error.message);
    throw new Error(error.message || "Failed to login");
  }
};

export const loginWithEmailOrPhone = async (emailOrPhone, password) => {
  try {
    let email = emailOrPhone.trim();

    // Check if input is a phone number (doesn't contain @)
    if (!emailOrPhone.includes("@")) {
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("whatsappPhone", "==", emailOrPhone.trim()));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        throw new Error("No account found with this phone number");
      }

      const userData = querySnapshot.docs[0].data();
      email = userData.email;
    }

    return await login(email, password);
  } catch (error) {
    console.error("Login with email/phone error:", error.message);
    throw new Error(error.message || "Failed to login");
  }
};

export const sendPasswordReset = async (email) => {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    await sendPasswordResetEmail(auth, normalizedEmail);
    return { success: true };
  } catch (error) {
    console.error("Password reset error:", error.message);
    throw new Error(getAuthErrorMessage(error, "Failed to send password reset email."));
  }
};

export const getCurrentUser = async (uid) => {
  try {
    const userDoc = await getDoc(doc(db, "users", uid));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const sanitized = {
        ...userData,
        id: uid,
      };
      // Never expose password field in application memory
      delete sanitized.password;
      return sanitized;
    }
    return null;
  } catch (error) {
    console.error("Get user error:", error.message);
    return null;
  }
};

export const getUserByEmail = async (email) => {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("email", "==", normalizedEmail));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();
      const sanitized = {
        id: userDoc.id,
        ...userData,
      };
      delete sanitized.password;
      return sanitized;
    }
    return null;
  } catch (error) {
    console.error("Get user by email error:", error.message);
    return null;
  }
};

export const checkEmailExists = async (email) => {
  try {
    // Try to sign in with an empty password to check if email exists
    // This is a workaround since Firebase doesn't have a direct email check
    // In production, use a Cloud Function for this
    return false;
  } catch (error) {
    return false;
  }
};
