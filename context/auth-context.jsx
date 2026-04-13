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
          console.log("🔄 AUTH CONTEXT - Auth state changed:");
          console.log("   Firebase User UID:", firebaseUser.uid);
          console.log("   Firebase User Email:", firebaseUser.email);

          // Set auth cookie for middleware
          try {
            const token = await firebaseUser.getIdToken();
            document.cookie = `auth-token=${token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
          } catch (cookieErr) {
            console.warn("Failed to set auth cookie:", cookieErr);
          }

          // Fetch user data from Firestore
          let userData = await getCurrentUser(firebaseUser.uid);

          console.log("📄 Firestore user data loaded:");
          console.log("   User Email:", userData?.email);
          console.log("   User Name:", userData?.fullName);
          console.log("   User Role:", userData?.role);
          console.log("   isAdmin:", userData?.isAdmin);

          // Check if this email should be an organiser but has wrong/missing role
          const isOrganiserEmail =
            firebaseUser.email?.endsWith("@ticketlelo.com") &&
            firebaseUser.email !== "superadmin@ticketlelo.com";

          if (userData && isOrganiserEmail && userData.role !== "organiser") {
            console.warn(
              "⚠️ Organiser email detected with wrong/missing role.",
            );
            console.log("   Current role:", userData.role || "undefined");
            console.log("   Current isAdmin:", userData.isAdmin);
            console.log("   Fixing in Firestore via API...");

            // Fix in Firestore using server-side API
            try {
              const fixResponse = await fetch("/api/fix-organiser-role", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  uid: firebaseUser.uid,
                  email: firebaseUser.email,
                }),
              });

              if (fixResponse.ok) {
                const fixResult = await fixResponse.json();
                console.log("✅ Firestore role fixed successfully");

                // Re-fetch user data to get updated values
                userData = await getCurrentUser(firebaseUser.uid);
                console.log("✅ Re-fetched user data:");
                console.log("   New Role:", userData.role);
                console.log("   New isAdmin:", userData.isAdmin);
              } else {
                console.warn("⚠️ API fix failed, applying local fix");
                // Fallback: apply fix locally
                userData.role = "organiser";
                userData.isAdmin = true;
              }
            } catch (fixError) {
              console.error("❌ Failed to fix role via API:", fixError.message);
              // Fallback: apply fix locally
              userData.role = "organiser";
              userData.isAdmin = true;
            }
          }

          // If no Firestore doc exists, create one from Firebase Auth data
          if (!userData) {
            console.warn(
              "⚠️ No Firestore user doc found — creating one from Auth profile",
            );
            const { doc, setDoc, Timestamp } =
              await import("firebase/firestore");
            const { db } = await import("@/lib/firebase");

            // Check if this is the super admin email
            const isSuperAdminEmail =
              firebaseUser.email === "superadmin@ticketlelo.com";

            // Check if this is an organiser (emails ending with @ticketlelo.com except superadmin)
            const isOrganiserEmail =
              firebaseUser.email?.endsWith("@ticketlelo.com") &&
              !isSuperAdminEmail;

            userData = {
              id: firebaseUser.uid,
              email: firebaseUser.email || "",
              fullName: isSuperAdminEmail
                ? "Super Administrator"
                : firebaseUser.displayName ||
                  firebaseUser.email?.split("@")[0] ||
                  "User",
              whatsappPhone: firebaseUser.phoneNumber || "",
              createdAt: Timestamp.now(),
              isAdmin: isSuperAdminEmail || isOrganiserEmail ? true : false,
              role: isSuperAdminEmail
                ? "superAdmin"
                : isOrganiserEmail
                  ? "organiser"
                  : "user",
            };

            await setDoc(doc(db, "users", firebaseUser.uid), userData);
            console.log("✅ Created user document:");
            console.log("   Email:", userData.email);
            console.log("   Role:", userData.role);
            console.log("   isAdmin:", userData.isAdmin);
          }

          console.log("✅ AUTH CONTEXT - Setting user state:");
          console.log("   Email:", userData.email);
          console.log("   Role:", userData.role);
          console.log("   isAdmin:", userData.isAdmin);
          console.log("   Full Name:", userData.fullName);

          // Final safety check - ensure organiser emails have correct role
          if (
            firebaseUser.email?.endsWith("@ticketlelo.com") &&
            firebaseUser.email !== "superadmin@ticketlelo.com"
          ) {
            if (userData.role !== "organiser" || !userData.isAdmin) {
              console.warn("⚠️ Last-second role fix applied");
              userData.role = "organiser";
              userData.isAdmin = true;
            }
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
      // Clear auth cookie
      document.cookie = "auth-token=; path=/; max-age=0; SameSite=Lax";
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
