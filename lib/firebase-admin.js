import admin from "firebase-admin";

// Use global to persist initialization state across hot reloads in development
const globalForFirebase = global;

// Initialize Firebase Admin SDK (server-side only)
if (!admin.apps.length) {
  try {
    // For production: Use service account key (JSON string)
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const serviceAccount = JSON.parse(
        process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
      );

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      });

      globalForFirebase.firebaseAdminInitialized = true;
      console.log("✅ Firebase Admin initialized with service account");
    }
    // For local development WITHOUT credentials - limited functionality
    else {
      console.log("⚠️  Firebase Admin SDK: No service account key found");
      console.log("⚠️  Some features (like creating users) will not work");
      console.log(
        "📝 See FIREBASE_SERVICE_ACCOUNT_SETUP.md for setup instructions",
      );
    }
  } catch (error) {
    console.error("❌ Firebase Admin initialization error:", error.message);
  }
}

// Helper function to check if admin is ready (always checks current state)
function isAdminReady() {
  return admin.apps.length > 0;
}

// Export Firestore and Auth instances - these will be null if not initialized
// Using admin.apps.length check ensures we always check the current state
export const adminDb = isAdminReady() ? admin.firestore() : null;
export const adminAuth = isAdminReady() ? admin.auth() : null;

// Export ready state as a getter function to always return current state
export const isFirebaseAdminReady = () => admin.apps.length > 0;

export default admin;
