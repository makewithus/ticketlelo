import { NextResponse } from "next/server";
import { adminAuth, adminDb, isFirebaseAdminReady } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";

export async function POST(request) {
  try {
    // Check if Firebase Admin is properly initialized (call as function)
    if (!isFirebaseAdminReady() || !adminAuth || !adminDb) {
      console.error("❌ Firebase Admin SDK not initialized");
      return NextResponse.json(
        {
          success: false,
          error: "Firebase Admin SDK not configured",
          instructions: {
            message: "Service account key is required for this feature",
            step1:
              "Go to Firebase Console → Project Settings → Service Accounts",
            step2:
              "Click 'Generate New Private Key' and download the JSON file",
            step3:
              "Add to .env.local: FIREBASE_SERVICE_ACCOUNT_KEY='<paste-json-here>'",
            step4: "Restart the development server",
            documentation:
              "See FIREBASE_SERVICE_ACCOUNT_SETUP.md for detailed instructions",
          },
        },
        { status: 503 },
      );
    }

    const { email, password, name, phone, college, eventTitle } =
      await request.json();

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🔄 ORGANISER ACCOUNT CREATION REQUEST");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📧 Generated email (eventname@ticketlelo.com):", email);
    console.log("📱 Phone number (for duplicate detection):", phone);
    console.log("👤 Name:", name);
    console.log("🎉 Event:", eventTitle);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    // Check if organizer already exists (by email OR phone)
    let organiserId = null;
    let existingUser = null;
    let originalLoginEmail = null; // This will ALWAYS come from Firestore

    // STEP 1: Try to find by email from request
    try {
      existingUser = await adminAuth.getUserByEmail(email);
      organiserId = existingUser.uid;
      console.log("✅ Found existing organiser by email:", organiserId);
    } catch (error) {
      if (error.code === "auth/user-not-found") {
        console.log(
          "ℹ️ No user found with request email, checking by phone...",
        );

        // STEP 2: Try to find by phone number in Firestore
        if (phone) {
          const usersSnapshot = await adminDb
            .collection("users")
            .where("whatsappPhone", "==", phone)
            .where("role", "==", "organiser")
            .limit(1)
            .get();

          if (!usersSnapshot.empty) {
            organiserId = usersSnapshot.docs[0].id;
            console.log("✅ Found existing organiser by phone:", organiserId);

            // Get the Firebase Auth user
            existingUser = await adminAuth.getUser(organiserId);
          }
        }
      } else {
        throw error;
      }
    }

    // If we found an existing organizer (by email OR phone)
    if (existingUser && organiserId) {
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("✅ EXISTING ORGANISER FOUND!");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

      // ALWAYS get the ORIGINAL login email from Firestore database (NOT from request)
      const userDoc = await adminDb.collection("users").doc(organiserId).get();
      const userData = userDoc.data();
      originalLoginEmail = userData.email; // This is their ORIGINAL email they use to login

      console.log(
        "📧 ORIGINAL login email (from database):",
        originalLoginEmail,
      );
      console.log("📧 Generated email (will be IGNORED):", email);
      console.log("🔐 Action: Update password + Increase limit");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

      // Generate NEW password for existing user
      const newPassword = password;

      // Update Firebase Auth password ONLY (email stays the same)
      await adminAuth.updateUser(organiserId, {
        password: newPassword,
      });

      console.log("✅ Password updated successfully");

      // Increase event creation limit (eventsAllowed)
      const currentAllowed = userData?.eventsAllowed || 1;
      const currentCreated = userData?.eventsCreated || 0;

      await adminDb
        .collection("users")
        .doc(organiserId)
        .update({
          eventsAllowed: currentAllowed + 1,
          lastApprovalDate: Timestamp.now(),
        });

      console.log(
        `✅ Event limit increased: ${currentAllowed} → ${currentAllowed + 1}`,
      );
      console.log(`   Events created: ${currentCreated}`);
      console.log(
        `   Can create ${currentAllowed + 1 - currentCreated} more events`,
      );
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("📧 FINAL CREDENTIALS TO SEND:");
      console.log(
        "   Email:",
        originalLoginEmail,
        "(UNCHANGED - from database)",
      );
      console.log("   Password:", newPassword, "(NEW)");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

      // Return ORIGINAL email from database + NEW password
      return NextResponse.json({
        success: true,
        organiserId,
        organiserEmail: originalLoginEmail, // ALWAYS from database, NEVER from request!
        organiserPassword: newPassword, // NEW password
        isExisting: true,
        message:
          "Password updated and event limit increased for existing organiser",
      });
    }

    // No existing organizer found - create new account
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🆕 CREATING NEW ORGANISER ACCOUNT");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📧 Email:", email);
    console.log("🔑 Password:", password);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    // Create new user
    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: name,
    });

    organiserId = userRecord.uid;
    console.log("✅ Created Firebase Auth user:", organiserId);

    // Create Firestore document
    await adminDb
      .collection("users")
      .doc(organiserId)
      .set({
        id: organiserId,
        email,
        fullName: name,
        whatsappPhone: phone || "",
        college: college || "",
        role: "organiser",
        isAdmin: true,
        eventsAllowed: 1,
        eventsCreated: 0,
        createdAt: Timestamp.now(),
      });

    console.log("✅ Created Firestore user document");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📧 FINAL CREDENTIALS TO SEND:");
    console.log("   Email:", email, "(NEW)");
    console.log("   Password:", password, "(NEW)");
    console.log("   Events Allowed: 1");
    console.log("   Events Created: 0");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    return NextResponse.json({
      success: true,
      organiserId,
      organiserEmail: email,
      organiserPassword: password,
      isExisting: false,
      message: "New organiser account created",
    });
  } catch (error) {
    console.error("❌ Error creating organiser:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
