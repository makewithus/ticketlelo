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

    return {
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
