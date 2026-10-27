import admin from "firebase-admin";

// Use global to persist initialization state across hot reloads in development
const globalForFirebase = global;

// Initialize Firebase Admin SDK (server-side only)
if (!admin.apps.length) {
  try {
    if (process.env.FIRESTORE_EMULATOR_HOST) {
      admin.initializeApp({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || "demo-ticketlelo-qa",
      });
      globalForFirebase.firebaseAdminInitialized = true;
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const serviceAccount = JSON.parse(
        process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
      );

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      });

      globalForFirebase.firebaseAdminInitialized = true;
    } else {
      console.log("  Firebase Admin SDK: No service account key found");
    }
  } catch (error) {
    console.error(" Firebase Admin initialization error:", error.message);
  }
}

// Helper function to check if admin is ready (always checks current state)
export function isFirebaseAdminReady() {
  return admin.apps.length > 0;
}

export function getAdminDb() {
  if (!admin.apps.length && process.env.FIRESTORE_EMULATOR_HOST) {
    try {
      admin.initializeApp({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || "demo-ticketlelo-qa",
      });
    } catch {}
  }
  return admin.apps.length > 0 ? admin.firestore() : null;
}

export function getAdminAuth() {
  getAdminDb();
  return admin.apps.length > 0 ? admin.auth() : null;
}

export function getAdminStorage() {
  getAdminDb();
  return admin.apps.length > 0 ? admin.storage() : null;
}

export const adminDb = new Proxy({}, {
  get(target, prop) {
    const db = getAdminDb();
    if (!db) return undefined;
    const val = db[prop];
    return typeof val === "function" ? val.bind(db) : val;
  }
});

export const adminAuth = new Proxy({}, {
  get(target, prop) {
    const auth = getAdminAuth();
    if (!auth) return undefined;
    const val = auth[prop];
    return typeof val === "function" ? val.bind(auth) : val;
  }
});

export const adminStorage = new Proxy({}, {
  get(target, prop) {
    const storage = getAdminStorage();
    if (!storage) return undefined;
    const val = storage[prop];
    return typeof val === "function" ? val.bind(storage) : val;
  }
});

export default admin;
