import { NextResponse } from "next/server";
import { adminDb, adminAuth, isFirebaseAdminReady } from "@/lib/firebase-admin";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { validatePhoneNumber, formatPhoneDisplay } from "@/lib/phone-validation";

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
 * Returns list of system users with server-side pagination, search, and role filtering.
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

    const { searchParams } = new URL(request.url);
    const returnAll = searchParams.get("all") === "true";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "10", 10)));
    const roleFilter = (searchParams.get("role") || "all").trim();
    const searchQuery = (searchParams.get("search") || "").toLowerCase().trim();
    const sortBy = (searchParams.get("sortBy") || "createdAt").trim();
    const sortOrder = (searchParams.get("sortOrder") || "desc").trim();

    const snapshot = await adminDb.collection("users").get();
    const allUsers = [];
    let attendees = 0;
    let organisers = 0;
    let superAdmins = 0;

    snapshot.docs.forEach((doc) => {
      const data = doc.data() || {};
      if (data.deleted === true || data.isDeleted === true || data.status === "deleted") {
        return;
      }

      const createdAtRaw = data.createdAt;
      let createdAtStr = null;
      if (createdAtRaw) {
        if (typeof createdAtRaw.toDate === "function") {
          createdAtStr = createdAtRaw.toDate().toISOString();
        } else if (typeof createdAtRaw === "string" || typeof createdAtRaw === "number") {
          createdAtStr = new Date(createdAtRaw).toISOString();
        }
      }

      const rawRole = data.role ? String(data.role).trim() : null;
      const role = rawRole || (data.isAdmin ? "organiser" : "user");
      const isAdmin = role === "superAdmin" || role === "organiser";

      if (role === "superAdmin") superAdmins++;
      else if (role === "organiser" || role === "organizer") organisers++;
      else attendees++;

      const rawPhone = data.whatsappPhone || data.phone || "";
      const displayPhone = formatPhoneDisplay(rawPhone);

      allUsers.push({
        id: doc.id,
        uid: doc.id,
        email: data.email || "",
        fullName: data.fullName || data.displayName || data.name || "User",
        displayName: data.displayName || data.fullName || "",
        whatsappPhone: rawPhone,
        phone: rawPhone,
        displayPhone,
        role,
        isAdmin,
        createdAt: createdAtStr,
        hasSetPassword: data.hasSetPassword !== false,
      });
    });

    const stats = {
      total: allUsers.length,
      attendees,
      organisers,
      superAdmins,
    };

    // Filter matching role and search query
    let filtered = allUsers.filter((u) => {
      const matchesRole =
        roleFilter === "all" ||
        (roleFilter === "user" && (u.role === "user" || !u.role)) ||
        (roleFilter === "organiser" && (u.role === "organiser" || u.role === "organizer")) ||
        (roleFilter === "superAdmin" && u.role === "superAdmin");

      if (!matchesRole) return false;

      if (!searchQuery) return true;

      const nameMatch = (u.fullName || "").toLowerCase().includes(searchQuery);
      const emailMatch = (u.email || "").toLowerCase().includes(searchQuery);
      const phoneMatch = (u.phone || "").toLowerCase().includes(searchQuery);
      const displayPhoneMatch = (u.displayPhone || "").toLowerCase().includes(searchQuery);

      return nameMatch || emailMatch || phoneMatch || displayPhoneMatch;
    });

    // Sort deterministically
    filtered.sort((a, b) => {
      let comparison = 0;
      if (sortBy === "name") {
        comparison = (a.fullName || "").localeCompare(b.fullName || "");
      } else if (sortBy === "email") {
        comparison = (a.email || "").localeCompare(b.email || "");
      } else if (sortBy === "role") {
        comparison = (a.role || "").localeCompare(b.role || "");
      } else {
        // Default: createdAt
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        comparison = timeA - timeB;
      }

      if (sortOrder === "desc") {
        comparison = -comparison;
      }

      // Secondary deterministic tie-breaker
      return comparison || (a.id || "").localeCompare(b.id || "");
    });

    if (returnAll) {
      return NextResponse.json({
        success: true,
        users: filtered,
        total: filtered.length,
        totalAllUsers: allUsers.length,
        stats,
      });
    }

    const totalMatching = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalMatching / pageSize));
    const validPage = Math.min(page, totalPages);
    const startIndex = (validPage - 1) * pageSize;
    const paginatedUsers = filtered.slice(startIndex, startIndex + pageSize);

    return NextResponse.json({
      success: true,
      users: paginatedUsers,
      total: totalMatching,
      totalAllUsers: allUsers.length,
      page: validPage,
      pageSize,
      totalPages,
      stats,
    });
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
 * Enforces strict phone validation, E.164 normalization, and phone uniqueness.
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
    const rawPhone = body.phone !== undefined ? body.phone : body.whatsappPhone;
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

    // Phone validation & normalization
    let normalizedPhone = "";
    if (rawPhone !== undefined && rawPhone !== null && String(rawPhone).trim() !== "") {
      const phoneCheck = validatePhoneNumber(rawPhone, { required: false });
      if (!phoneCheck.isValid) {
        return NextResponse.json({ error: phoneCheck.error || "Invalid phone number." }, { status: 400 });
      }
      normalizedPhone = phoneCheck.e164 || "";

      // Phone uniqueness check: Ensure no other user already uses this phone number
      if (normalizedPhone) {
        const cleanDigits = normalizedPhone.replace(/\D/g, "");
        const national10 = cleanDigits.length >= 10 ? cleanDigits.slice(-10) : cleanDigits;

        const usersSnap = await adminDb.collection("users").get();
        for (const doc of usersSnap.docs) {
          const u = doc.data() || {};
          if (u.deleted === true || u.isDeleted === true) continue;
          const existingPhone = String(u.whatsappPhone || u.phone || "").replace(/\D/g, "");
          if (!existingPhone) continue;

          if (
            existingPhone === cleanDigits ||
            (existingPhone.length >= 10 && existingPhone.slice(-10) === national10)
          ) {
            return NextResponse.json(
              {
                error: `This phone number is already registered to another account (${u.email || "existing user"}). Each user must have a unique phone number.`,
              },
              { status: 409 }
            );
          }
        }
      }
    }

    // Check if user already exists in Firebase Auth
    try {
      await adminAuth.getUserByEmail(cleanEmail);
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
    const userRecord = await adminAuth.createUser({
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
      whatsappPhone: normalizedPhone,
      phone: normalizedPhone,
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
        phone: normalizedPhone,
        whatsappPhone: normalizedPhone,
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

    // If changing role to "user", revoke any active approved hostingRequests for this user's email
    if (targetRole === "user") {
      try {
        const uDoc = await adminDb.collection("users").doc(userId).get();
        const userEmail = (uDoc.data()?.email || "").toLowerCase().trim();
        if (userEmail) {
          const hrSnap = await adminDb
            .collection("hostingRequests")
            .where("email", "==", userEmail)
            .get();
          const batch = adminDb.batch();
          let count = 0;
          hrSnap.forEach((doc) => {
            if (doc.data()?.status === "approved") {
              // Deletes / revoked hosting requests removed when user role is changed to attendee
              batch.delete(doc.ref);
              count++;
            }
          });
          if (count > 0) {
            await batch.commit();
          }
        }
      } catch (hrErr) {
        console.warn("[superadmin/users] Error revoking hostingRequests:", hrErr.message);
      }
    }

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
