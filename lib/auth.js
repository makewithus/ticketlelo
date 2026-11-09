import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { auth, db } from "./firebase.js";
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

export const getRedirectPathForRole = (role) => {
  if (role === "superAdmin") return "/superadmin";
  if (role === "organiser") return "/admin/dashboard";
  return "/dashboard";
};

const establishServerSession = async (firebaseUser) => {
  try {
    const idToken = await firebaseUser.getIdToken();
    const response = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    if (!response.ok) {
      console.warn("Server session establishment returned status", response.status);
    }
  } catch (err) {
    console.warn("establishServerSession warning:", err);
  }
};

const stampActiveSession = () => {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("ticketlelo_last_active", String(Date.now()));
    } catch (_) {}
  }
};

export const signup = async (email, password, fullName, whatsappPhone) => {
  try {
    // Normalize email to lowercase
    const normalizedEmail = email.toLowerCase().trim();

    const userCredential = await createUserWithEmailAndPassword(
      auth,
      normalizedEmail,
      password,
    );
    const firebaseUser = userCredential.user;
    await establishServerSession(firebaseUser);
    stampActiveSession();

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
    stampActiveSession();

    // Fetch user data from Firestore with timeout fallback
    try {
      const userData = await Promise.race([
        getCurrentUser(firebaseUser.uid),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), 5000),
        ),
      ]);
      if (userData) {
        const emailLower = (userData.email || normalizedEmail).toLowerCase().trim();
        const isSuper =
          emailLower === "adil4ticketlelo@gmail.com" ||
          emailLower === "superadmin@ticketlelo.com" ||
          userData.role === "superAdmin";

        if (isSuper) {
          userData.role = "superAdmin";
          userData.isAdmin = true;
        } else {
          userData.role = userData.role || "user";
          if (userData.role !== "organiser") {
            try {
              const tokenResult = await firebaseUser.getIdTokenResult();
              if (tokenResult.claims?.role === "organiser" || tokenResult.claims?.admin) {
                userData.role = "organiser";
              } else {
                const statusRes = await fetch(`/api/hosting-requests/status?email=${encodeURIComponent(emailLower)}`);
                if (statusRes.ok) {
                  const statusData = await statusRes.json();
                  if (statusData.isApproved || statusData.isUserOrganiser) {
                    userData.role = "organiser";
                  }
                }
              }
            } catch (_) {}
          }
          userData.isAdmin = userData.role === "superAdmin" || userData.role === "organiser";
        }
        return userData;
      }
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
      role: "user",
    };
  } catch (error) {
    console.error("Login error:", error.message);
    throw new Error(getAuthErrorMessage(error, "Login failed. Please try again."));
  }
};

let googleSignInPromise = null;

export const loginWithGoogle = async () => {
  // If user is ALREADY authenticated with Firebase, return user immediately without opening popup!
  if (auth.currentUser) {
    const firebaseUser = auth.currentUser;
    try {
      await establishServerSession(firebaseUser);
    } catch (sessionErr) {
      console.warn("Session establishment warning:", sessionErr);
    }
    stampActiveSession();
    let userData = null;
    try {
      userData = await getCurrentUser(firebaseUser.uid);
    } catch (e) {
      console.warn("Could not fetch user document:", e);
    }
    if (userData) {
      const emailLower = (userData.email || firebaseUser.email || "").toLowerCase().trim();
      const isSuper =
        emailLower === "adil4ticketlelo@gmail.com" ||
        emailLower === "superadmin@ticketlelo.com";
      if (isSuper) {
        userData.role = "superAdmin";
        userData.isAdmin = true;
      } else {
        userData.role = userData.role || "user";
        userData.isAdmin =
          userData.role === "superAdmin" || userData.role === "organiser";
      }
      return userData;
    }
  }

  // If a popup is already active or in flight, return the existing promise
  if (googleSignInPromise) {
    return googleSignInPromise;
  }

  googleSignInPromise = (async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const userCredential = await signInWithPopup(auth, provider);
      const firebaseUser = userCredential.user;

      // Establish server session
      try {
        await establishServerSession(firebaseUser);
      } catch (sessionErr) {
        console.warn("Session establishment warning:", sessionErr);
      }
      stampActiveSession();

      // Check if user document exists in Firestore
      let userData = null;
      try {
        userData = await getCurrentUser(firebaseUser.uid);
      } catch (e) {
        console.warn("Could not fetch user document:", e);
      }

      if (!userData) {
        const emailLower = (firebaseUser.email || "").toLowerCase().trim();
        const isSuper =
          emailLower === "adil4ticketlelo@gmail.com" ||
          emailLower === "superadmin@ticketlelo.com";
        userData = {
          id: firebaseUser.uid,
          email: emailLower,
          fullName:
            firebaseUser.displayName ||
            firebaseUser.email?.split("@")[0] ||
            "User",
          whatsappPhone: firebaseUser.phoneNumber || "",
          createdAt: Timestamp.now(),
          isAdmin: isSuper,
          role: isSuper ? "superAdmin" : "user",
          photoURL: firebaseUser.photoURL || "",
        };
        try {
          await setDoc(doc(db, "users", firebaseUser.uid), userData, {
            merge: true,
          });
        } catch (err) {
          console.warn("Error saving new user doc for Google sign in:", err);
        }
      } else {
        if (firebaseUser.photoURL && (!userData.photoURL || userData.photoURL !== firebaseUser.photoURL)) {
          userData.photoURL = firebaseUser.photoURL;
          try {
            await setDoc(doc(db, "users", firebaseUser.uid), { photoURL: firebaseUser.photoURL }, { merge: true });
          } catch (_) {}
        }
        const emailLower = (
          userData.email ||
          firebaseUser.email ||
          ""
        )
          .toLowerCase()
          .trim();
        if (
          emailLower === "adil4ticketlelo@gmail.com" ||
          emailLower === "superadmin@ticketlelo.com"
        ) {
          userData.role = "superAdmin";
          userData.isAdmin = true;
        } else {
          userData.role = userData.role || "user";
          if (userData.role !== "organiser") {
            try {
              const tokenResult = await firebaseUser.getIdTokenResult();
              if (tokenResult.claims?.role === "organiser" || tokenResult.claims?.admin) {
                userData.role = "organiser";
              } else {
                const statusRes = await fetch(`/api/hosting-requests/status?email=${encodeURIComponent(emailLower)}`);
                if (statusRes.ok) {
                  const statusData = await statusRes.json();
                  if (statusData.isApproved || statusData.isUserOrganiser) {
                    userData.role = "organiser";
                  }
                }
              }
            } catch (_) {}
          }
          userData.isAdmin =
            userData.role === "superAdmin" || userData.role === "organiser";
        }
      }

      return userData;
    } catch (error) {
      if (
        error?.code === "auth/popup-closed-by-user" ||
        error?.code === "auth/cancelled-popup-request"
      ) {
        console.log("Google sign-in popup was closed or superseded.");
        const cancelledErr = new Error("Sign in was cancelled.");
        cancelledErr.code = error.code;
        cancelledErr.isCancelled = true;
        throw cancelledErr;
      }

      console.error("Google sign-in error:", error);
      if (error?.code === "auth/popup-blocked") {
        throw new Error(
          "Sign-in popup was blocked by your browser. Please allow popups for TicketLelo and try again.",
        );
      }
      throw new Error(
        getAuthErrorMessage(
          error,
          "Failed to sign in with Google. Please try again.",
        ),
      );
    } finally {
      googleSignInPromise = null;
    }
  })();

  return googleSignInPromise;
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
