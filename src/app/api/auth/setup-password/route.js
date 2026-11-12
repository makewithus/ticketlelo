import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { adminAuth, adminDb, isFirebaseAdminReady } from "@/lib/firebase-admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

/**
 * Safely compares two strings in constant time to prevent timing attacks.
 */
function safeCompare(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Computes SHA-256 hash of a string
 */
function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

/**
 * First-Time Account Password Setup Endpoint
 * POST /api/auth/setup-password
 * Body: { email, token, newPassword, confirmPassword }
 */
export async function POST(request) {
  try {
    const clientIp = getClientIp(request);

    // 0. Rate limiting enforcement (SEC-3, R82)
    const ipLimit = checkRateLimit({
      key: `setup_pwd_ip:${clientIp}`,
      limit: 15,
      windowMs: 15 * 60 * 1000, // 15 requests per 15 minutes per IP
    });
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { error: "Too many password setup attempts from this network. Please try again later." },
        {
          status: 429,
          headers: { "Retry-After": String(ipLimit.retryAfterSeconds) },
        }
      );
    }

    if (!isFirebaseAdminReady() || !adminAuth || !adminDb) {
      return NextResponse.json(
        { error: "Authentication service unavailable. Please try again shortly." },
        { status: 503 }
      );
    }

    const body = await request.json();
    const rawEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const setupToken = typeof body.token === "string" ? body.token.trim() : "";
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
    const confirmPassword = typeof body.confirmPassword === "string" ? body.confirmPassword : "";

    if (!rawEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
      return NextResponse.json({ error: "A valid email address is required." }, { status: 400 });
    }

    // Rate limiting per target email
    const emailLimit = checkRateLimit({
      key: `setup_pwd_email:${rawEmail}`,
      limit: 6,
      windowMs: 15 * 60 * 1000, // 6 attempts per 15 minutes per email
    });
    if (!emailLimit.allowed) {
      return NextResponse.json(
        { error: "Too many attempts for this account. Please wait a few minutes before trying again." },
        {
          status: 429,
          headers: { "Retry-After": String(emailLimit.retryAfterSeconds) },
        }
      );
    }

    if (!setupToken) {
      return NextResponse.json(
        { error: "A setup token is required to set up your password. Please check the confirmation link in your email." },
        { status: 403 }
      );
    }

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters long." },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
    }

    // 1. Mandatory Token Verification with Fail-Closed Guarantee (SEC-1)
    // The accountSetupTokens document for this email MUST exist and be valid.
    const tokenRef = adminDb.collection("accountSetupTokens").doc(rawEmail);
    const tokenDoc = await tokenRef.get();

    if (!tokenDoc.exists) {
      // Reject immediately without leaking whether account exists (SEC-4, R84)
      return NextResponse.json(
        { error: "Invalid or expired password setup link. Please request a new link or use 'Forgot Password'." },
        { status: 400 }
      );
    }

    const tData = tokenDoc.data() || {};

    if (tData.used === true) {
      return NextResponse.json(
        { error: "This password setup link has already been used. Please log in with your existing password." },
        { status: 400 }
      );
    }

    if (tData.expiresAt && Date.now() > Number(tData.expiresAt)) {
      return NextResponse.json(
        { error: "This password setup link has expired. You can use the forgot password option on the login page." },
        { status: 400 }
      );
    }

    // Verify token using constant-time comparison against hashed or plaintext token
    const tokenHash = tData.tokenHash;
    const plainToken = tData.token;
    const inputHash = sha256(setupToken);

    let isTokenMatch = false;
    if (tokenHash && typeof tokenHash === "string") {
      isTokenMatch = safeCompare(tokenHash, inputHash);
    } else if (plainToken && typeof plainToken === "string") {
      isTokenMatch = safeCompare(plainToken, setupToken);
    }

    if (!isTokenMatch) {
      return NextResponse.json(
        { error: "Invalid or expired password setup link. Please check the link in your email." },
        { status: 403 }
      );
    }

    // 2. Verify user exists in Firebase Auth and protect existing accounts (SEC-1, SEC-5)
    let userRecord;
    try {
      userRecord = await adminAuth.getUserByEmail(rawEmail);
    } catch (authErr) {
      if (authErr.code === "auth/user-not-found") {
        return NextResponse.json(
          { error: "Invalid or expired password setup link. Please check your email or register for an event." },
          { status: 400 }
        );
      }
      throw authErr;
    }

    // Check if user already set their password or is an existing Google/social sign-in
    const userDocRef = adminDb.collection("users").doc(userRecord.uid);
    const userDoc = await userDocRef.get();
    const userData = userDoc.exists ? userDoc.data() : null;

    if (userData?.hasSetPassword === true) {
      return NextResponse.json(
        { error: "An account password has already been set for this email. Please log in using your password, or use 'Forgot Password'." },
        { status: 400 }
      );
    }

    const isGoogleOnly =
      userRecord.providerData.length > 0 &&
      userRecord.providerData.every((p) => p.providerId === "google.com") &&
      userData &&
      userData.hasSetPassword !== false;

    if (isGoogleOnly) {
      return NextResponse.json(
        { error: "This email is registered with Google Sign-In. Please sign in with Google." },
        { status: 400 }
      );
    }

    // 3. Atomically mark token as used and update user status in Firestore (SEC-1 transaction)
    await adminDb.runTransaction(async (transaction) => {
      const freshTokenSnap = await transaction.get(tokenRef);
      if (!freshTokenSnap.exists) {
        throw new Error("Token record no longer exists");
      }
      const freshTokenData = freshTokenSnap.data() || {};
      if (freshTokenData.used === true) {
        throw new Error("Token has already been used");
      }

      transaction.update(tokenRef, {
        used: true,
        usedAt: Date.now(),
        updatedAt: new Date(),
      });

      transaction.set(
        userDocRef,
        {
          hasSetPassword: true,
          isFirstTimeUser: false,
          updatedAt: new Date(),
        },
        { merge: true }
      );
    });

    // 4. Update the password in Firebase Auth and mark email as verified (SEC-1, SEC-5)
    await adminAuth.updateUser(userRecord.uid, {
      password: newPassword,
      emailVerified: true,
    });

    // 5. Generate custom token for instant automatic sign-in (R54)
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
    if (error.message === "Token has already been used") {
      return NextResponse.json(
        { error: "This password setup link has already been used. Please log in with your existing password." },
        { status: 400 }
      );
    }
    console.error("[setup-password] Password setup error:", error);
    return NextResponse.json(
      { error: "Failed to set up password. Please try again." },
      { status: 500 }
    );
  }
}
