"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getCurrentUser, logout as firebaseLogout } from "@/lib/auth";
import { migrateUserRegistrations } from "@/lib/firestore";

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          console.log(" AUTH CONTEXT - Auth state changed:");
          console.log("   Firebase User UID:", firebaseUser.uid);
          console.log("   Firebase User Email:", firebaseUser.email);

          // Exchange the short-lived Firebase ID token for a server-verified,
          // HttpOnly session cookie. The browser must not write auth cookies.
          try {
            const token = await firebaseUser.getIdToken();
            const response = await fetch("/api/auth/session", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ idToken: token }),
            });
            if (!response.ok) throw new Error("Session could not be established");
          } catch (cookieErr) {
            console.warn("Failed to set auth cookie:", cookieErr);
          }

          // Fetch user data from Firestore
          let userData = await getCurrentUser(firebaseUser.uid);

          console.log(" Firestore user data loaded:");
          console.log("   User Email:", userData?.email);
          console.log("   User Name:", userData?.fullName);
          console.log("   User Role:", userData?.role);
          console.log("   isAdmin:", userData?.isAdmin);

          // Ensure sanitized role resolution without email sniffing (SEC-04)
          if (userData) {
            // Default role is attendee "user" unless explicitly set in document
            userData.role = userData.role || "user";
            userData.isAdmin = userData.role === "superAdmin" || userData.role === "organiser";
          }

          // If no Firestore doc exists, create one from Firebase Auth data
          if (!userData) {
            console.warn(
              " No Firestore user doc found — creating one from Auth profile",
            );
            const { doc, setDoc, Timestamp } =
              await import("firebase/firestore");
            const { db } = await import("@/lib/firebase");

            userData = {
              id: firebaseUser.uid,
              email: firebaseUser.email || "",
              fullName: firebaseUser.displayName ||
                  firebaseUser.email?.split("@")[0] ||
                  "User",
              whatsappPhone: firebaseUser.phoneNumber || "",
              createdAt: Timestamp.now(),
              isAdmin: false,
              role: "user",
            };

            await setDoc(doc(db, "users", firebaseUser.uid), userData);
          }

          setUser(userData);
          setError(null);

          // Migrate any orphaned registrations for this user
          try {
            await migrateUserRegistrations(userData.id, userData.email);
          } catch (migrationError) {
            console.warn("Registration migration failed:", migrationError);
          }
        } else {
          setUser(null);
        }
      } catch (err) {
        setError(err.message || "Failed to load user");
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const logout = async () => {
    try {
      await firebaseLogout();
      await fetch("/api/auth/session", { method: "DELETE" });
      setUser(null);
      setError(null);
    } catch (err) {
      setError(err.message || "Failed to logout");
      throw err;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
