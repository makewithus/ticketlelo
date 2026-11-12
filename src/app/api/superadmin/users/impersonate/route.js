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
 * POST /api/superadmin/users/impersonate
 * Super Admin generates a custom authentication token to seamlessly log in as any user
 * and access their respective dashboard.
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
    const targetUid = String(body.targetUid || body.userId || "").trim();

    if (!targetUid) {
      return NextResponse.json({ error: "targetUid is required" }, { status: 400 });
    }

    // Verify target user exists
    let targetUserRecord = null;
    try {
      targetUserRecord = await adminAuth.getUser(targetUid);
    } catch (authErr) {
      // If not in Auth directly by UID, check Firestore
      const userDoc = await adminDb.collection("users").doc(targetUid).get();
      if (!userDoc.exists) {
        return NextResponse.json({ error: "Target user not found" }, { status: 404 });
      }
      const uData = userDoc.data();
      if (uData.email) {
        try {
          targetUserRecord = await adminAuth.getUserByEmail(uData.email);
        } catch (_) {}
      }
    }

    const effectiveUid = targetUserRecord ? targetUserRecord.uid : targetUid;

    // Fetch user profile from Firestore to determine their role and redirect destination
    const userDoc = await adminDb.collection("users").doc(effectiveUid).get();
    const userData = userDoc.exists ? userDoc.data() : {};
    const role = userData.role || targetUserRecord?.customClaims?.role || "user";

    // Generate custom authentication token for instant sign-in
    const customToken = await adminAuth.createCustomToken(effectiveUid, {
      impersonatedBy: caller.email,
      impersonatedAt: Date.now(),
    });

    let redirectUrl = "/dashboard";
    if (role === "organiser") {
      redirectUrl = "/admin/dashboard";
    } else if (role === "superAdmin") {
      redirectUrl = "/superadmin/hosting-requests";
    }

    return NextResponse.json({
      success: true,
      customToken,
      redirectUrl,
      targetUser: {
        uid: effectiveUid,
        email: userData.email || targetUserRecord?.email,
        fullName: userData.fullName || userData.displayName || targetUserRecord?.displayName || "User",
        role,
      },
      message: `Impersonation session ready for ${userData.email || effectiveUid}`,
    });
  } catch (error) {
    console.error("[superadmin/users/impersonate] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate impersonation token: " + (error?.message || "Internal error") },
      { status: 500 }
    );
  }
}

