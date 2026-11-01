import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    "AIzaSyCtT0m8pqwr0voThpfAKS_X3S0plZ9p05U",
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    "ticketlelo-e967a.firebaseapp.com",
  projectId:
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    "ticketlelo-e967a",
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    "ticketlelo-e967a.firebasestorage.app",
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ||
    "699414628141",
  appId:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID ||
    "1:699414628141:web:dafd3e6af63aab4cf935a4",
};

// Initialize Firebase with singleton pattern
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firebase services safely (prevents crashing during Next.js static build analysis)
function getSafeService(initFn) {
  try {
    return initFn();
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[Firebase] Service initialization deferred:", err?.message);
    }
    return null;
  }
}

export const auth = getSafeService(() => getAuth(app));
export const db = getSafeService(() => getFirestore(app));
export const storage = getSafeService(() => getStorage(app));

export default app;
