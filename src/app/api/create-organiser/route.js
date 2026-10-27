import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { adminAuth, adminDb, isFirebaseAdminReady } from "@/lib/firebase-admin";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { Timestamp } from "firebase-admin/firestore";

/** Provision organizer access only after an authenticated superadmin approval. */
export async function POST(request) {
  try {
    if (!isFirebaseAdminReady()) {
      return NextResponse.json({ error: "Identity service unavailable" }, { status: 503 });
    }

    const caller = await getAuthenticatedUser(request);
    if (!caller) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    if (caller.role !== "superAdmin") {
      return NextResponse.json({ error: "Superadmin approval required" }, { status: 403 });
    }

    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const college = typeof body.college === "string" ? body.college.trim() : "";
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name) {
      return NextResponse.json({ error: "A valid email and organizer name are required" }, { status: 400 });
    }

    let userRecord;
    let isExisting = false;
    try {
      userRecord = await adminAuth.getUserByEmail(email);
      isExisting = true;
    } catch (error) {
      if (error.code !== "auth/user-not-found") throw error;
      // The random credential is never returned, logged, emailed, or persisted in Firestore.
      userRecord = await adminAuth.createUser({
        email,
        displayName: name,
        password: crypto.randomBytes(48).toString("base64url"),
      });
    }

    const previousClaims = userRecord.customClaims || {};
    if (previousClaims.role !== "superAdmin") {
      await adminAuth.setCustomUserClaims(userRecord.uid, { ...previousClaims, role: "organiser" });
    }

    const userRef = adminDb.collection("users").doc(userRecord.uid);
    const userSnapshot = await userRef.get();
    const profile = {
      id: userRecord.uid,
      email: userRecord.email || email,
      fullName: name || userRecord.displayName || "Organizer",
      whatsappPhone: phone,
      college,
      role: previousClaims.role === "superAdmin" ? "superAdmin" : "organiser",
      isAdmin: true,
      updatedAt: Timestamp.now(),
    };
    if (userSnapshot.exists) {
      await userRef.update(profile);
    } else {
      await userRef.set({ ...profile, createdAt: Timestamp.now(), eventsAllowed: 1, eventsCreated: 0 });
    }

    return NextResponse.json({
      success: true,
      organiserId: userRecord.uid,
      organiserEmail: userRecord.email || email,
      isExisting,
      message: isExisting ? "Organizer access approved; existing password was not changed" : "Organizer access approved; use password recovery to set a password",
    });
  } catch (error) {
    console.error("[create-organiser] Provisioning failed:", error.code || "unexpected-error");
    return NextResponse.json({ error: "Could not provision organizer access" }, { status: 500 });
  }
}
