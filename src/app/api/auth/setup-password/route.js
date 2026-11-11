import { NextResponse } from "next/server";
import { adminAuth, adminDb, isFirebaseAdminReady } from "@/lib/firebase-admin";

/**
 * First-Time Account Password Setup Endpoint
 * POST /api/auth/setup-password
 * Body: { email, token, newPassword, confirmPassword }
 */
export async function POST(request) {
  try {
    if (!isFirebaseAdminReady() || !adminAuth) {
      return NextResponse.json({ error: "Authentication service unavailable" }, { status: 503 });
    }

    const body = await request.json();
    const rawEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const setupToken = typeof body.token === "string" ? body.token.trim() : "";
    const newPassword = typeof body.newPassword === "string" ? body.newPassword.trim() : "";
    const confirmPassword = typeof body.confirmPassword === "string" ? body.confirmPassword.trim() : "";

    if (!rawEmail) {
      return NextResponse.json({ error: "Email address is required." }, { status: 400 });
    }

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters long." }, { status: 400 });
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
    }

    // 1. Verify user exists in Firebase Auth
    let userRecord;
    try {
      userRecord = await adminAuth.getUserByEmail(rawEmail);
    } catch (authErr) {
      if (authErr.code === "auth/user-not-found") {
        return NextResponse.json({ error: "No account found for this email address. Please register for an event first." }, { status: 404 });
      }
      throw authErr;
    }

    // 2. Check if user already set their password
    if (adminDb) {
      try {
        const userDoc = await adminDb.collection("users").doc(userRecord.uid).get();
        if (userDoc.exists && userDoc.data()?.hasSetPassword === true) {
          return NextResponse.json(
            { error: "An account password has already been set for this email. Please log in using your password, or use 'Forgot Password'." },
            { status: 400 }
          );
        }
      } catch (uDocErr) {
        console.warn("[setup-password] User profile status check warning:", uDocErr.message);
      }
    }

    // 3. Validate setup token strictly against accountSetupTokens
    if (adminDb) {
      try {
        const tokenDoc = await adminDb.collection("accountSetupTokens").doc(rawEmail).get();
        if (tokenDoc.exists) {
          const tData = tokenDoc.data();
          if (tData.used === true) {
            return NextResponse.json(
              { error: "This password setup link has already been used. Please log in with your existing password." },
              { status: 400 }
            );
          }
          if (!setupToken || tData.token !== setupToken) {
            return NextResponse.json(
              { error: "Invalid or missing password setup token. Please use the exact link sent to your email." },
              { status: 403 }
            );
          }
          if (tData.expiresAt && Date.now() > Number(tData.expiresAt)) {
            return NextResponse.json(
              { error: "This password setup link has expired. You can use the forgot password option on the login page." },
              { status: 400 }
            );
          }
        } else if (!setupToken) {
          return NextResponse.json(
            { error: "A setup token is required to set up your password. Please check the confirmation link in your email." },
            { status: 403 }
          );
        }
      } catch (tokCheckErr) {
        console.warn("[setup-password] Token verification warning:", tokCheckErr.message);
      }
    }

    // 3. Update the password in Firebase Auth and mark email as verified
    await adminAuth.updateUser(userRecord.uid, {
      password: newPassword,
      emailVerified: true,
    });

    // 4. Update Firestore user document & mark setup token as used
    if (adminDb) {
      try {
        await Promise.all([
          adminDb.collection("users").doc(userRecord.uid).set(
            {
              hasSetPassword: true,
              isFirstTimeUser: false,
              updatedAt: new Date(),
            },
            { merge: true }
          ),
          adminDb.collection("accountSetupTokens").doc(rawEmail).set(
            {
              used: true,
              usedAt: Date.now(),
            },
            { merge: true }
          ),
        ]);
      } catch (dbErr) {
        console.warn("[setup-password] Firestore user status update warning:", dbErr.message);
      }
    }

    // 5. Generate custom token for instant automatic sign-in
    let customToken = null;
    try {
      customToken = await adminAuth.createCustomToken(userRecord.uid);
    } catch (cTokErr) {
      console.warn("[setup-password] Custom token generation warning:", cTokErr.message);
    }

    return NextResponse.json({
      success: true,
      customToken,
      message: "Password set successfully! Redirecting to your dashboard...",
    });
  } catch (error) {
    console.error("[setup-password] Password setup error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to set up password. Please try again." },
      { status: 500 }
    );
  }
}

