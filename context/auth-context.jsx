"use client";

import React, { createContext, useContext, useEffect, useState, useRef, useCallback, useMemo } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { getCurrentUser, logout as firebaseLogout } from "@/lib/auth";
import { migrateUserRegistrations } from "@/lib/firestore";
import { doc, onSnapshot } from "firebase/firestore";
import { toast } from "sonner";

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const prevRoleRef = useRef(null);

  const refreshUser = useCallback(async () => {
    const fbUser = auth.currentUser;
    if (!fbUser) return null;
    try {
      const token = await fbUser.getIdToken(true);
      try {
        await fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken: token }),
        });
      } catch (sessErr) {
        console.warn("Session sync warning in refreshUser:", sessErr);
      }
      let freshUserData = await getCurrentUser(fbUser.uid);
      if (freshUserData) {
        const normalizedEmail = (fbUser.email || "").toLowerCase().trim();
        const isSuper =
          normalizedEmail === "adil4ticketlelo@gmail.com" ||
          normalizedEmail === "superadmin@ticketlelo.com" ||
          freshUserData.role === "superAdmin";

        if (isSuper) {
          freshUserData.role = "superAdmin";
          freshUserData.isAdmin = true;
        } else if (freshUserData.role !== "organiser") {
          try {
            const statusRes = await fetch(`/api/hosting-requests/status?email=${encodeURIComponent(normalizedEmail)}`);
            if (statusRes.ok) {
              const statusData = await statusRes.json();
              if (statusData.isApproved) {
                freshUserData.role = "organiser";
                freshUserData.isAdmin = true;
              }
            }
          } catch (_) {}
        }

        freshUserData.role = isSuper ? "superAdmin" : freshUserData.role || "user";
        freshUserData.isAdmin = isSuper || freshUserData.role === "organiser";
        setUser((prev) => {
          if (
            prev &&
            prev.id === fbUser.uid &&
            prev.role === freshUserData.role &&
            prev.isAdmin === freshUserData.isAdmin &&
            prev.fullName === freshUserData.fullName &&
            prev.email === freshUserData.email &&
            prev.whatsappPhone === freshUserData.whatsappPhone
          ) {
            return prev;
          }
          return freshUserData;
        });
        return freshUserData;
      }
    } catch (err) {
      console.warn("refreshUser error:", err);
    }
    return null;
  }, []);

  useEffect(() => {
    let unsubscribeDoc = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      // Clean up previous doc snapshot listener if switching users
      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = null;
      }

      try {
        if (firebaseUser) {
          // Exchange ID token for HttpOnly session cookie
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

          // Initial fetch from Firestore
          let userData = await getCurrentUser(firebaseUser.uid);

          const normalizedEmail = (firebaseUser.email || "").toLowerCase().trim();
          const isSuper =
            normalizedEmail === "adil4ticketlelo@gmail.com" ||
            normalizedEmail === "superadmin@ticketlelo.com";

          if (isSuper && userData) {
            userData.role = "superAdmin";
            userData.isAdmin = true;
          } else if (userData && userData.role !== "organiser") {
            try {
              const statusRes = await fetch(`/api/hosting-requests/status?email=${encodeURIComponent(normalizedEmail)}`);
              if (statusRes.ok) {
                const statusData = await statusRes.json();
                if (statusData.isApproved || statusData.isUserOrganiser) {
                  userData.role = "organiser";
                  userData.isAdmin = true;
                }
              }
            } catch (_) {}
          }

          if (userData) {
            userData.role = userData.role || "user";
            userData.isAdmin = isSuper || userData.role === "superAdmin" || userData.role === "organiser";
          }

          // If no doc exists, create fallback profile
          if (!userData) {
            const { doc: firestoreDoc, setDoc, Timestamp } = await import("firebase/firestore");
            userData = {
              id: firebaseUser.uid,
              email: firebaseUser.email || "",
              fullName:
                firebaseUser.displayName ||
                firebaseUser.email?.split("@")[0] ||
                "User",
              whatsappPhone: firebaseUser.phoneNumber || "",
              createdAt: Timestamp.now(),
              isAdmin: isSuper,
              role: isSuper ? "superAdmin" : "user",
            };
            await setDoc(firestoreDoc(db, "users", firebaseUser.uid), userData);
          }

          prevRoleRef.current = userData.role;
          setUser(userData);
          setError(null);

          // Real-time snapshot listener on user document:
          // Detects role elevation (e.g., when Super Admin approves hosting request)
          try {
            const userDocRef = doc(db, "users", firebaseUser.uid);
            unsubscribeDoc = onSnapshot(userDocRef, async (docSnap) => {
              if (!docSnap.exists()) return;
              const liveData = docSnap.data();
              const liveSuper =
                normalizedEmail === "adil4ticketlelo@gmail.com" ||
                normalizedEmail === "superadmin@ticketlelo.com" ||
                liveData.role === "superAdmin";
              const liveRole = liveSuper ? "superAdmin" : liveData.role || "user";
              const liveIsAdmin = liveSuper || liveRole === "organiser";

              const oldRole = prevRoleRef.current;
              prevRoleRef.current = liveRole;

              // If promoted to organiser in real-time while browsing:
              if (oldRole && oldRole !== "organiser" && oldRole !== "superAdmin" && liveRole === "organiser") {
                toast.success("Your hosting request has been approved! Organiser access unlocked.", {
                  duration: 6000,
                  action: {
                    label: "Open Dashboard",
                    onClick: () => {
                      window.location.href = "/admin/dashboard";
                    },
                  },
                });

                // Refresh token and session cookie to ensure backend and server components reflect new role
                try {
                  const refreshedToken = await firebaseUser.getIdToken(true);
                  await fetch("/api/auth/session", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ idToken: refreshedToken }),
                  });
                } catch (tokErr) {
                  console.warn("Failed to force refresh token on promotion:", tokErr);
                }
              }

              setUser((prev) => {
                if (
                  prev &&
                  prev.id === firebaseUser.uid &&
                  prev.role === liveRole &&
                  prev.isAdmin === liveIsAdmin &&
                  prev.fullName === liveData.fullName &&
                  prev.whatsappPhone === liveData.whatsappPhone
                ) {
                  return prev;
                }
                return {
                  ...(prev || {}),
                  ...liveData,
                  id: firebaseUser.uid,
                  role: liveRole,
                  isAdmin: liveIsAdmin,
                };
              });
            }, (snapshotErr) => {
              console.warn("User profile real-time snapshot warning:", snapshotErr.message);
            });
          } catch (listenerErr) {
            console.warn("Could not attach user snapshot listener:", listenerErr);
          }

          // Migrate any orphaned registrations
          try {
            await migrateUserRegistrations(userData.id, userData.email);
          } catch (migrationError) {}
        } else {
          setUser(null);
          prevRoleRef.current = null;
        }
      } catch (err) {
        setError(err.message || "Failed to load user");
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return () => {
      if (unsubscribeDoc) unsubscribeDoc();
      unsubscribeAuth();
    };
  }, []);

  const logout = useCallback(async () => {
    try {
      await firebaseLogout();
      await fetch("/api/auth/session", { method: "DELETE" });
      setUser(null);
      setError(null);
      prevRoleRef.current = null;
    } catch (err) {
      setError(err.message || "Failed to logout");
      throw err;
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, error, logout, refreshUser }),
    [user, loading, error, logout, refreshUser]
  );

  return (
    <AuthContext.Provider value={value}>
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

