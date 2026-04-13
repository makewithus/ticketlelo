import { NextResponse } from "next/server";
import { adminAuth, adminDb, isFirebaseAdminReady } from "@/lib/firebase-admin";

export async function POST(request) {
  try {
    // Check if Firebase Admin is properly initialized
    if (!isFirebaseAdminReady() || !adminAuth || !adminDb) {
      return NextResponse.json(
        { success: false, error: "Firebase Admin SDK not configured" },
        { status: 503 },
      );
    }

    const { uid, email } = await request.json();

    console.log("🔧 Fixing organiser role for:", email || uid);

    // Get the user document
    const userDoc = await adminDb.collection("users").doc(uid).get();

    if (!userDoc.exists) {
      console.log("❌ User document not found");
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 },
      );
    }

    const userData = userDoc.data();
    console.log("📄 Current data:", {
      email: userData.email,
      role: userData.role,
      isAdmin: userData.isAdmin,
    });

    // Check if this is an organiser email
    const isOrganiserEmail =
      userData.email?.endsWith("@ticketlelo.com") &&
      userData.email !== "superadmin@ticketlelo.com";

    if (!isOrganiserEmail) {
      return NextResponse.json(
        { success: false, error: "Not an organiser email" },
        { status: 400 },
      );
    }

    // Update the document
    await adminDb.collection("users").doc(uid).update({
      role: "organiser",
      isAdmin: true,
    });

    console.log("✅ Fixed organiser role successfully");

    return NextResponse.json({
      success: true,
      message: "Organiser role fixed successfully",
      updatedData: {
        role: "organiser",
        isAdmin: true,
      },
    });
  } catch (error) {
    console.error("❌ Error fixing organiser role:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
