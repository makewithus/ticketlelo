import { NextResponse } from "next/server";
import { adminDb, adminAuth, isFirebaseAdminReady } from "@/lib/firebase-admin";
import { getAuthenticatedUser } from "@/lib/auth-server";

function isAuthorizedSuperAdmin(caller) {
  if (!caller) return false;
  const emailLower = (caller.email || "").toLowerCase().trim();
  const superAdminEnv = (process.env.SUPER_ADMIN_EMAIL || "").toLowerCase().trim();
  return Boolean(
    caller?.role === "superAdmin" ||
    caller?.isAdmin === true ||
    emailLower === "adil4ticketlelo@gmail.com" ||
    emailLower === "superadmin@ticketlelo.com" ||
    (superAdminEnv && emailLower === superAdminEnv)
  );
}

/**
 * GET /api/superadmin/users
 * Returns list of all system users.
 */
export async function GET(request) {
  try {
    if (!isFirebaseAdminReady() || !adminDb) {
      return NextResponse.json({ error: "Database service unavailable" }, { status: 503 });
    }

    const caller = await getAuthenticatedUser(request);
    if (!caller || !isAuthorizedSuperAdmin(caller)) {
      return NextResponse.json({ error: "Super administrator access required" }, { status: 403 });
    }

    const snapshot = await adminDb.collection("users").get();
    const users = snapshot.docs.map((doc) => {
      const data = doc.data() || {};
      const createdAtRaw = data.createdAt;
      let createdAtStr = null;
      if (createdAtRaw) {
        if (typeof createdAtRaw.toDate === "function") {
          createdAtStr = createdAtRaw.toDate().toISOString();
        } else if (typeof createdAtRaw === "string" || typeof createdAtRaw === "number") {
          createdAtStr = new Date(createdAtRaw).toISOString();
        }
      }

      return {
        id: doc.id,
        uid: doc.id,
        email: data.email || "",
        fullName: data.fullName || data.displayName || data.name || "User",
        displayName: data.displayName || data.fullName || "",
        whatsappPhone: data.whatsappPhone || data.phone || "",
        phone: data.phone || data.whatsappPhone || "",
        role: data.role || "user",
        isAdmin: Boolean(data.isAdmin),
        createdAt: createdAtStr,
        hasSetPassword: data.hasSetPassword !== false,
      };
    });

    // Sort by createdAt descending
    users.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });

    return NextResponse.json({ success: true, users, total: users.length });
  } catch (error) {
    console.error("[superadmin/users] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch users: " + (error?.message || "Internal error") },
      { status: 500 }
    );
  }
}

/**
 * POST /api/superadmin/users
 * Super Admin creates a new user (user, organiser, or superAdmin) directly with credentials and role.
 */
export async function POST(request) {
  try {
    if (!isFirebaseAdminReady() || !adminAuth || !adminDb) {
      return NextResponse.json({ error: "Auth service unavailable" }, { status: 503 });
    }

    const caller = await getAuthenticatedUser(request);
    if (!caller || !isAuthorizedSuperAdmin(caller)) {
      return NextResponse.json({ error: "Super administrator access required" }, { status: 403 });
    }

    const body = await request.json();
    const cleanEmail = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "").trim();
    const fullName = String(body.fullName || body.name || "").trim();
    const phone = String(body.phone || body.whatsappPhone || "").trim();
    const role = String(body.role || "user").trim();

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return NextResponse.json({ error: "A valid email address is required." }, { status: 400 });
    }

    if (!password || password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters long." }, { status: 400 });
    }

    const validRoles = ["user", "organiser", "superAdmin"];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: "Invalid role specified. Must be user, organiser, or superAdmin." }, { status: 400 });
    }

    // Check if user already exists
    let userRecord;
    try {
      userRecord = await adminAuth.getUserByEmail(cleanEmail);
      return NextResponse.json(
        { error: "A user with this email already exists in Firebase Auth." },
        { status: 409 }
      );
    } catch (err) {
      if (err.code !== "auth/user-not-found") {
        throw err;
      }
    }

    // Create Firebase Auth user
    userRecord = await adminAuth.createUser({
      email: cleanEmail,
      password,
      displayName: fullName || (role === "organiser" ? "Organiser" : "User"),
      emailVerified: true,
    });

    const isAdmin = role === "superAdmin" || role === "organiser";

    // Set custom claims
    await adminAuth.setCustomUserClaims(userRecord.uid, {
      role,
      isAdmin,
    });

    // Write to Firestore users collection
    const nowIso = new Date().toISOString();
    await adminDb.collection("users").doc(userRecord.uid).set({
      id: userRecord.uid,
      uid: userRecord.uid,
      email: cleanEmail,
      fullName: fullName || userRecord.displayName,
      displayName: fullName || userRecord.displayName,
      whatsappPhone: phone,
      phone,
      role,
      isAdmin,
      hasSetPassword: true,
      isFirstTimeUser: false,
      createdAt: nowIso,
      updatedAt: nowIso,
      createdSource: "superadmin_manual",
    });

    return NextResponse.json({
      success: true,
      message: `User created successfully with role '${role}'.`,
      user: {
        id: userRecord.uid,
        uid: userRecord.uid,
        email: cleanEmail,
        fullName: fullName || userRecord.displayName,
        role,
        isAdmin,
      },
    });
  } catch (error) {
    console.error("[superadmin/users] POST error:", error);
    return NextResponse.json(
      { error: "Failed to create user: " + (error?.message || "Internal error") },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/superadmin/users
 * Super Admin updates any user's role (user <-> organiser <-> superAdmin).
 */
export async function PATCH(request) {
  try {
    if (!isFirebaseAdminReady() || !adminAuth || !adminDb) {
      return NextResponse.json({ error: "Auth service unavailable" }, { status: 503 });
    }

    const caller = await getAuthenticatedUser(request);
    if (!caller || !isAuthorizedSuperAdmin(caller)) {
      return NextResponse.json({ error: "Super administrator access required" }, { status: 403 });
    }

    const body = await request.json();
    const userId = String(body.userId || body.id || "").trim();
    const targetRole = String(body.role || "").trim();

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const validRoles = ["user", "organiser", "superAdmin"];
    if (!validRoles.includes(targetRole)) {
      return NextResponse.json({ error: "Invalid role specified. Must be user, organiser, or superAdmin." }, { status: 400 });
    }

    const isAdmin = targetRole === "superAdmin" || targetRole === "organiser";

    // Update Firebase Auth custom claims
    try {
      await adminAuth.setCustomUserClaims(userId, {
        role: targetRole,
        isAdmin,
      });
    } catch (claimErr) {
      console.warn("[superadmin/users] Warning updating custom claims:", claimErr.message);
    }

    // Update Firestore users collection
    const nowIso = new Date().toISOString();
    await adminDb.collection("users").doc(userId).set(
      {
        role: targetRole,
        isAdmin,
        updatedAt: nowIso,
      },
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      message: `User role updated to '${targetRole}' successfully.`,
      userId,
      role: targetRole,
      isAdmin,
    });
  } catch (error) {
    console.error("[superadmin/users] PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update user role: " + (error?.message || "Internal error") },
      { status: 500 }
    );
  }
}

