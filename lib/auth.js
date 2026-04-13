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

export const signup = async (email, password, fullName, whatsappPhone) => {
  try {
    // Normalize email to lowercase
    const normalizedEmail = email.toLowerCase().trim();

    console.log("🔐 AUTH.JS - Starting signup process:");
    console.log("   Email:", normalizedEmail);
    console.log("   Full Name:", fullName);
    console.log("   Phone:", whatsappPhone);

    const userCredential = await createUserWithEmailAndPassword(
      auth,
      normalizedEmail,
      password,
    );
    const firebaseUser = userCredential.user;

    console.log("✅ Firebase Auth account created:");
    console.log("   UID:", firebaseUser.uid);
    console.log("   Email:", firebaseUser.email);

    // Create user document in Firestore (including password for direct login)
    const userData = {
      id: firebaseUser.uid,
      email: normalizedEmail,
      fullName,
      whatsappPhone,
      password, // Store password for email+phone login
      createdAt: Timestamp.now(),
      isAdmin: false,
      role: "user", // Regular user role (not organiser or superAdmin)
    };

    await setDoc(doc(db, "users", firebaseUser.uid), userData);
    console.log("✅ Firestore user document created:");
    console.log("   Document ID:", firebaseUser.uid);
    console.log("   Email in doc:", normalizedEmail);
    console.log("   Role:", "user");
    console.log("✅ USER IS NOW LOGGED IN AS:", normalizedEmail);

    return userData;
  } catch (error) {
    console.error("❌ Signup error:", error.message);
    throw new Error(error.message || "Failed to create account");
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
    throw new Error(error.message || "Failed to login");
  }
};

export const logout = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Logout error:", error.message);
    throw new Error(error.message || "Failed to logout");
  }
};
// Passwordless authentication - Find user by email or phone
export const findUserByEmailOrPhone = async (emailOrPhone) => {
  try {
    const usersRef = collection(db, "users");

    // Check if it's an email (contains @) or phone
    const isEmail = emailOrPhone.includes("@");

    let q;
    if (isEmail) {
      q = query(usersRef, where("email", "==", emailOrPhone));
    } else {
      // Clean phone number (remove spaces, dashes, etc.)
      const cleanPhone = emailOrPhone.replace(/[\s\-\(\)]/g, "");
      q = query(usersRef, where("whatsappPhone", "==", cleanPhone));
    }

    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      // User doesn't exist, create a new user document
      const newUserRef = doc(collection(db, "users"));
      const userData = {
        id: newUserRef.id,
        email: isEmail ? emailOrPhone : "",
        whatsappPhone: isEmail ? "" : emailOrPhone.replace(/[\s\-\(\)]/g, ""),
        fullName: "",
        createdAt: Timestamp.now(),
        isAdmin: false,
        role: "user",
      };

      await setDoc(newUserRef, userData);
      return userData;
    }

    // Return existing user
    const userDoc = querySnapshot.docs[0];
    return { id: userDoc.id, ...userDoc.data() };
  } catch (error) {
    console.error("Find user error:", error);
    throw new Error("Failed to find or create user");
  }
};

// Send magic link or OTP (to be implemented)
export const sendMagicLinkOrOTP = async (emailOrPhone) => {
  try {
    // TODO: Implement actual magic link/OTP sending
    // For now, just find/create the user
    const user = await findUserByEmailOrPhone(emailOrPhone);

    console.log("Magic link/OTP would be sent to:", emailOrPhone);
    console.log("User found/created:", user);

    return {
      success: true,
      message: "Magic link sent! (Feature coming soon)",
      userId: user.id,
    };
  } catch (error) {
    console.error("Send magic link error:", error);
    throw new Error("Failed to send magic link");
  }
};
// Direct login with email and phone (no password needed from user)
export const loginWithEmailAndPhone = async (email, phone) => {
  try {
    // Clean phone number - extract only digits
    const cleanPhone = phone.replace(/\D/g, "");

    // Find user by email
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("email", "==", email));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      throw new Error(
        "No account found with this email. Please register for an event first.",
      );
    }

    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data();

    // For accounts without password, they need to register again
    if (!userData.password) {
      console.log("⚠️ Old account without stored password");
      throw new Error(
        "Your account needs to be updated. Please register for any event (even a free one) with this email to update your account, then you can login.",
      );
    }

    // Update phone number if it doesn't match
    const storedPhone = userData.whatsappPhone?.replace(/\D/g, "") || "";

    const phoneMatches =
      storedPhone === cleanPhone ||
      storedPhone.endsWith(cleanPhone) ||
      cleanPhone.endsWith(storedPhone) ||
      storedPhone.includes(cleanPhone) ||
      cleanPhone.includes(storedPhone);

    if (!phoneMatches && storedPhone && cleanPhone) {
      console.log(
        "⚠️ Phone mismatch - Stored:",
        storedPhone,
        "Entered:",
        cleanPhone,
      );
      console.log("🔧 Updating phone number to match current entry");

      // Update phone number in Firestore to match current entry
      const userDocRef = doc(db, "users", userDoc.id);
      await setDoc(
        userDocRef,
        {
          whatsappPhone: phone,
        },
        { merge: true },
      );

      console.log("✅ Phone number updated");
    }

    // Login with email and stored password
    console.log("🔐 Attempting login with email:", email);
    console.log("🔐 Password length:", userData.password?.length, "characters");

    try {
      const loggedInUser = await login(email, userData.password);
      console.log("✅ Login successful for user:", loggedInUser.email);
      return loggedInUser;
    } catch (loginError) {
      console.error("❌ Login failed:", loginError.message);

      // If invalid credential, the stored password doesn't match Firebase Auth
      if (
        loginError.message?.includes("invalid-credential") ||
        loginError.message?.includes("wrong-password")
      ) {
        console.log(
          "📧 Stored password doesn't match Firebase Auth - sending password reset email",
        );

        try {
          // Send password reset email
          await sendPasswordResetEmail(auth, email);
          throw new Error(
            "Password mismatch detected. We've sent a password reset email to " +
              email +
              ". Please reset your password and try again, or register for a new event to update your account.",
          );
        } catch (resetError) {
          if (resetError.message?.includes("Password mismatch detected")) {
            throw resetError; // Re-throw our custom message
          }
          // If sending reset email failed
          throw new Error(
            "Login credentials don't match. Please register for a new event with this email to refresh your credentials, or contact support.",
          );
        }
      }

      throw loginError;
    }
  } catch (error) {
    console.error("Login with email/phone error:", error.message);
    throw new Error(error.message || "Failed to login");
  }
};

export const loginWithEmailOrPhone = async (emailOrPhone, password) => {
  try {
    let email = emailOrPhone;

    // Check if input is a phone number (doesn't contain @)
    if (!emailOrPhone.includes("@")) {
      // Search for user by phone number
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("whatsappPhone", "==", emailOrPhone));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        throw new Error("No account found with this phone number");
      }

      // Get the email from the user document
      const userData = querySnapshot.docs[0].data();
      email = userData.email;
    }

    // Now login with email
    return await login(email, password);
  } catch (error) {
    console.error("Login with email/phone error:", error.message);
    throw new Error(error.message || "Failed to login");
  }
};

export const getCurrentUser = async (uid) => {
  try {
    const userDoc = await getDoc(doc(db, "users", uid));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      // Ensure id field is always present
      return {
        ...userData,
        id: uid,
      };
    }
    return null;
  } catch (error) {
    console.error("Get user error:", error.message);
    return null;
  }
};

export const getUserByEmail = async (email) => {
  try {
    // Normalize email to lowercase for case-insensitive search
    const normalizedEmail = email.toLowerCase().trim();
    console.log("[getUserByEmail] Searching for email:", normalizedEmail);

    const usersRef = collection(db, "users");
    const q = query(usersRef, where("email", "==", normalizedEmail));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const userDoc = querySnapshot.docs[0];
      console.log("[getUserByEmail] ✅ User found:", userDoc.id);
      return {
        id: userDoc.id,
        ...userDoc.data(),
      };
    }
    console.log("[getUserByEmail] ❌ No user found for email:", email);
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
