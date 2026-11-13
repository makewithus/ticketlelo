import { managesEvent, resolveUserRole } from "./access-policy.js";
import { adminAuth, adminDb, isFirebaseAdminReady } from "@/lib/firebase-admin";

/**
 * Server-side authentication and authorization helper for Next.js App Router API routes.
 * Authoritative: verifies Firebase ID token on trusted server.
 */

export async function getAuthenticatedUser(request) {
  try {
    if (!isFirebaseAdminReady() || !adminAuth) {
      console.warn("[auth-server] Firebase Admin SDK not ready for token verification");
      return null;
    }

    let token = null;
    let isSessionCookie = false;

    // 1. Check Authorization header: Bearer <token>
    const authHeader = request.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split("Bearer ")[1].trim();
    }

    // Browser sessions are server-issued, HttpOnly Firebase session cookies.
    if (!token) {
      const cookieHeader = request.headers.get("cookie");
      if (cookieHeader) {
        const cookies = Object.fromEntries(
          cookieHeader.split(";").map((c) => {
            const [k, ...v] = c.trim().split("=");
            return [k, v.join("=")];
          })
        );
        token = cookies["__session"] || null;
        isSessionCookie = Boolean(token);
      }
    }

    if (!token) {
      return null;
    }

    // Verify token with Firebase Admin
    const decodedToken = isSessionCookie
      ? await adminAuth.verifySessionCookie(token, true)
      : await adminAuth.verifyIdToken(token, true);
    if (!decodedToken || !decodedToken.uid) {
      return null;
    }

    // Fetch user profile from Firestore to verify role and organizationId
    let role = "user";
    let organizationId = decodedToken.organizationId || null;

    if (adminDb) {
      const userDoc = await adminDb.collection("users").doc(decodedToken.uid).get();
      if (userDoc.exists) {
        const data = userDoc.data();
        role = resolveUserRole(data);
        organizationId = data.organizationId || null;
      } else {
        // A missing profile cannot retain privileged custom claims indefinitely.
        role = "user";
        organizationId = null;
      }
    } else {
      role = resolveUserRole(null, decodedToken.role);
    }

    const emailLower = (decodedToken.email || "").toLowerCase().trim();
    const isSuper =
      role === "superAdmin" ||
      emailLower === "adil4ticketlelo@gmail.com" ||
      emailLower === "superadmin@ticketlelo.com" ||
      (process.env.SUPER_ADMIN_EMAIL && emailLower === process.env.SUPER_ADMIN_EMAIL.toLowerCase().trim());

    if (isSuper) {
      role = "superAdmin";
    } else if (role !== "organiser" && emailLower && adminDb) {
      try {
        const hrSnap = await adminDb
          .collection("hostingRequests")
          .where("email", "==", emailLower)
          .where("status", "==", "approved")
          .limit(1)
          .get();
        if (!hrSnap.empty) {
          role = "organiser";
          try {
            await adminDb.collection("users").doc(decodedToken.uid).set(
              {
                role: "organiser",
                isAdmin: true,
                updatedAt: new Date(),
              },
              { merge: true },
            );
          } catch (_) {}
        }
      } catch (hrErr) {
        console.warn("[auth-server] Check approved hosting request error:", hrErr.message);
      }
    }

    return {
      id: decodedToken.uid,
      uid: decodedToken.uid,
      email: decodedToken.email || "",
      role,
      isAdmin: role === "superAdmin" || role === "organiser",
      organizationId,
      decodedToken,
    };
  } catch (error) {
    console.error("[auth-server] Token verification failed:", error.message);
    return null;
  }
}

export async function requireAuth(request) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    throw new Error("Authentication required. Please log in.");
  }
  return user;
}

export async function requireRole(request, allowedRoles = []) {
  const user = await requireAuth(request);
  if (user.role === "superAdmin") {
    return user; // SuperAdmin has universal override
  }

  const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  if (!rolesArray.includes(user.role)) {
    throw new Error(`Forbidden: required role [${rolesArray.join(", ")}] not satisfied by current role [${user.role}].`);
  }
  return user;
}

export async function requireOrganizationAccess(request, targetOrgId) {
  const user = await requireAuth(request);
  if (user.role === "superAdmin") {
    return user; // SuperAdmin has universal organization access
  }

  if (!targetOrgId || user.organizationId !== targetOrgId) {
    throw new Error("Forbidden: cross-organization access denied.");
  }
  return user;
}

export async function canManageEventId(caller, eventId) {
  if (!caller || !eventId || !adminDb) return false;
  const event = await adminDb.collection("events").doc(eventId).get();
  return event.exists && managesEvent(caller, event.data());
}

/**
 * Checks whether an email address belongs to an Event Organiser or SuperAdmin.
 * Organisers and SuperAdmins manage events and cannot register as attendees with their organiser email.
 */
export async function checkRestrictedAttendeeEmail(email) {
  if (!email || typeof email !== "string") {
    return { isRestricted: false, role: "user" };
  }
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@")) {
    return { isRestricted: false, role: "user" };
  }

  // 1. Check SuperAdmin email shortcuts
  const isSuper =
    cleanEmail === "adil4ticketlelo@gmail.com" ||
    cleanEmail === "superadmin@ticketlelo.com" ||
    (process.env.SUPER_ADMIN_EMAIL && cleanEmail === process.env.SUPER_ADMIN_EMAIL.toLowerCase().trim());

  if (isSuper) {
    return {
      isRestricted: true,
      role: "superAdmin",
      message: "This email address is registered as an Administrator. Admin accounts cannot register for events as attendees. Please choose a different attendee email address.",
    };
  }

  if (!adminDb) {
    return { isRestricted: false, role: "user" };
  }

  // 2. Query users collection in Firestore by email
  try {
    const userQuery = await adminDb
      .collection("users")
      .where("email", "==", cleanEmail)
      .limit(1)
      .get();

    if (!userQuery.empty) {
      const uData = userQuery.docs[0].data() || {};
      const role = String(uData.role || "").toLowerCase().trim();
      const isAdmin = uData.isAdmin === true;
      if (role === "organiser" || role === "superadmin" || isAdmin) {
        const isOrg = role === "organiser" || (isAdmin && role !== "superadmin");
        return {
          isRestricted: true,
          role: isOrg ? "organiser" : "superAdmin",
          message: isOrg
            ? "This email address is registered as an Event Organiser. Organiser accounts cannot register for events as attendees. Please choose a different email address."
            : "This email address is registered as an Administrator. Admin accounts cannot register for events as attendees. Please choose a different email address.",
        };
      }
    }
  } catch (err) {
    console.warn("[checkRestrictedAttendeeEmail] users query warning:", err.message);
  }

  // 3. Check approved hostingRequests collection
  try {
    const hrSnap = await adminDb
      .collection("hostingRequests")
      .where("email", "==", cleanEmail)
      .where("status", "==", "approved")
      .limit(1)
      .get();

    if (!hrSnap.empty) {
      return {
        isRestricted: true,
        role: "organiser",
        message: "This email address is registered as an Event Organiser. Organiser accounts cannot register for events as attendees. Please choose a different email address.",
      };
    }
  } catch (err) {
    console.warn("[checkRestrictedAttendeeEmail] hostingRequests query warning:", err.message);
  }

  // 4. Check Firebase Auth if not found in Firestore
  if (adminAuth) {
    try {
      const authUser = await adminAuth.getUserByEmail(cleanEmail);
      if (authUser?.uid) {
        const claimsRole = String(authUser.customClaims?.role || "").toLowerCase().trim();
        const claimsIsOrg = claimsRole === "organiser" || authUser.customClaims?.organiser === true;
        const claimsIsSuper = claimsRole === "superadmin" || authUser.customClaims?.superadmin === true || authUser.customClaims?.isAdmin === true;
        if (claimsIsOrg || claimsIsSuper) {
          return {
            isRestricted: true,
            role: claimsIsOrg ? "organiser" : "superAdmin",
            message: claimsIsOrg
              ? "This email address is registered as an Event Organiser. Organiser accounts cannot register for events as attendees. Please choose a different email address."
              : "This email address is registered as an Administrator. Admin accounts cannot register for events as attendees. Please choose a different email address.",
          };
        }

        const uDoc = await adminDb.collection("users").doc(authUser.uid).get();
        if (uDoc.exists) {
          const uData = uDoc.data() || {};
          const role = String(uData.role || "").toLowerCase().trim();
          if (role === "organiser" || role === "superadmin" || uData.isAdmin === true) {
            const isOrg = role === "organiser" || (uData.isAdmin === true && role !== "superadmin");
            return {
              isRestricted: true,
              role: isOrg ? "organiser" : "superAdmin",
              message: isOrg
                ? "This email address is registered as an Event Organiser. Organiser accounts cannot register for events as attendees. Please choose a different email address."
                : "This email address is registered as an Administrator. Admin accounts cannot register for events as attendees. Please choose a different email address.",
            };
          }
        }
      }
    } catch (authErr) {
      if (authErr.code !== "auth/user-not-found") {
        console.warn("[checkRestrictedAttendeeEmail] adminAuth check warning:", authErr.message);
      }
    }
  }

  return { isRestricted: false, role: "user" };
}
