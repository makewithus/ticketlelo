"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, getDoc, Timestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

export default function SetupSuperAdminPage() {
  const [status, setStatus] = useState("checking");
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setStatus("not-logged-in");
        setMessage("❌ Not logged in. Please login as super admin first.");
        return;
      }

      setUser(currentUser);
      setStatus("checking-doc");
      setMessage("🔍 Checking user document...");

      try {
        // Check if user document exists
        const userDocRef = doc(db, "users", currentUser.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.role === "superAdmin") {
            setStatus("success");
            setMessage("✅ Super Admin document already exists! You're all set.");
          } else {
            setStatus("wrong-role");
            setMessage(
              `⚠️ User document exists but role is "${userData.role}". Need to update to "superAdmin" manually in Firebase Console.`
            );
          }
        } else {
          // Create the super admin document
          setStatus("creating");
          setMessage("📝 Creating super admin user document...");

          await setDoc(userDocRef, {
            id: currentUser.uid,
            email: currentUser.email,
            fullName: "Super Administrator",
            role: "superAdmin",
            isAdmin: true,
            createdAt: Timestamp.now(),
          });

          setStatus("created");
          setMessage(
            "✅ Super Admin document created successfully! You can now approve hosting requests."
          );
        }
      } catch (error) {
        console.error("Error:", error);
        setStatus("error");
        setMessage(`❌ Error: ${error.message}`);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-slate-900 to-black flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-slate-800/50 border border-emerald-500/30 rounded-2xl p-8">
        <h1 className="text-3xl font-bold text-emerald-400 mb-6 text-center">
          🔧 Super Admin Setup
        </h1>

        <div className="bg-black/50 border border-emerald-500/20 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            {status === "checking" && (
              <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
            )}
            {status === "checking-doc" && (
              <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
            )}
            {status === "creating" && (
              <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
            )}
            {(status === "success" || status === "created") && (
              <div className="w-8 h-8 bg-emerald-500/20 rounded-full flex items-center justify-center">
                <span className="text-2xl">✅</span>
              </div>
            )}
            {(status === "error" || status === "not-logged-in" || status === "wrong-role") && (
              <div className="w-8 h-8 bg-red-500/20 rounded-full flex items-center justify-center">
                <span className="text-2xl">❌</span>
              </div>
            )}
            <p className="text-white text-lg">{message}</p>
          </div>

          {user && (
            <div className="mt-4 pt-4 border-t border-emerald-500/10">
              <p className="text-sm text-gray-400 mb-2">Current User:</p>
              <p className="text-emerald-400 font-mono text-sm">{user.email}</p>
              <p className="text-gray-500 text-xs mt-1">UID: {user.uid}</p>
            </div>
          )}
        </div>

        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-6 mb-6">
          <h2 className="text-xl font-semibold text-emerald-400 mb-3">
            📋 Setup Instructions
          </h2>
          <ol className="space-y-2 text-gray-300 text-sm list-decimal list-inside">
            <li>Login as super admin (superadmin@ticketlelo.com)</li>
            <li>This page will automatically create your user document</li>
            <li>Once done, go back to /superadmin/hosting-requests</li>
            <li>Try approving a hosting request again</li>
          </ol>
        </div>

        <div className="bg-black/50 border border-slate-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-3">
            🔍 Manual Verification
          </h3>
          <p className="text-sm text-gray-400 mb-3">
            If automatic setup fails, manually create in Firebase Console:
          </p>
          <div className="bg-black border border-slate-600 rounded-lg p-4 font-mono text-xs text-gray-300 space-y-1">
            <p>Firestore Database → users → Add Document</p>
            <p className="text-emerald-400">Document ID: {user?.uid || "[your-uid]"}</p>
            <p>Fields:</p>
            <div className="ml-4 text-gray-400">
              <p>• email: "{user?.email || "superadmin@ticketlelo.com"}"</p>
              <p>• fullName: "Super Administrator"</p>
              <p>• role: "superAdmin"</p>
              <p>• isAdmin: true</p>
              <p>• createdAt: [Timestamp]</p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-4">
          <a
            href="/superadmin"
            className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold py-3 px-6 rounded-xl transition-all text-center"
          >
            Go to Super Admin Panel
          </a>
          <button
            onClick={() => window.location.reload()}
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 px-6 rounded-xl transition-all"
          >
            Refresh Page
          </button>
        </div>
      </div>
    </div>
  );
}
