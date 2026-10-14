"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, getDoc, Timestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { AlertCircle, CheckCircle2, ClipboardList, Search, Wrench } from "lucide-react";

export default function SetupSuperAdminPage() {
  const [status, setStatus] = useState("checking");
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setStatus("not-logged-in");
        setMessage("Not logged in. Please login as super admin first.");
        return;
      }

      setUser(currentUser);
      setStatus("checking-doc");
      setMessage("Checking user document...");

      try {
        // Check if user document exists
        const userDocRef = doc(db, "users", currentUser.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.role === "superAdmin") {
            setStatus("success");
            setMessage("Super Admin document already exists! You're all set.");
          } else {
            setStatus("wrong-role");
            setMessage(
              `User document exists but role is "${userData.role}". Need to update to "superAdmin" manually in Firebase Console.`
            );
          }
        } else {
          // Create the super admin document
          setStatus("creating");
          setMessage("Creating super admin user document...");

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
            "Super Admin document created successfully! You can now approve hosting requests."
          );
        }
      } catch (error) {
        console.error("Error:", error);
        setStatus("error");
        setMessage(`Error: ${error.message}`);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="tl-system-theme flex items-center justify-center p-4">
      <div className="tl-auth-card max-w-2xl w-full p-8">
        <h1 className="text-3xl font-extrabold text-[#061a3f] mb-6 text-center">
          <span className="inline-flex items-center justify-center gap-2">
            <Wrench className="h-7 w-7" />
            Super Admin Setup
          </span>
        </h1>

        <div className="bg-white border border-[var(--tl-line)] rounded-lg p-6 mb-6">
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
                <CheckCircle2 className="h-5 w-5 text-[#008d46]" />
              </div>
            )}
            {(status === "error" || status === "not-logged-in" || status === "wrong-role") && (
              <div className="w-8 h-8 bg-red-500/20 rounded-full flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-red-400" />
              </div>
            )}
            <p className="text-[#061a3f] text-lg">{message}</p>
          </div>

          {user && (
            <div className="mt-4 pt-4 border-t border-emerald-500/10">
              <p className="text-sm text-[rgba(6,26,63,0.64)] mb-2">Current User:</p>
              <p className="text-[#3157ff] font-mono text-sm">{user.email}</p>
              <p className="text-[rgba(6,26,63,0.56)] text-xs mt-1">UID: {user.uid}</p>
            </div>
          )}
        </div>

        <div className="bg-[#3157ff]/10 border border-[#3157ff]/20 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-[#061a3f] mb-3 flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Setup Instructions
          </h2>
          <ol className="space-y-2 text-[rgba(6,26,63,0.72)] text-sm list-decimal list-inside">
            <li>Login as super admin (superadmin@ticketlelo.com)</li>
            <li>This page will automatically create your user document</li>
            <li>Once done, go back to /superadmin/hosting-requests</li>
            <li>Try approving a hosting request again</li>
          </ol>
        </div>

        <div className="bg-white border border-[var(--tl-line)] rounded-lg p-6">
          <h3 className="text-lg font-semibold text-[#061a3f] mb-3 flex items-center gap-2">
            <Search className="h-5 w-5" />
            Manual Verification
          </h3>
          <p className="text-sm text-[rgba(6,26,63,0.64)] mb-3">
            If automatic setup fails, manually create in Firebase Console:
          </p>
          <div className="bg-[#061a3f] border border-[#061a3f] rounded-lg p-4 font-mono text-xs text-white space-y-1">
            <p>Firestore Database → users → Add Document</p>
            <p className="text-[#ffe000]">Document ID: {user?.uid || "[your-uid]"}</p>
            <p>Fields:</p>
            <div className="ml-4 text-white/80">
              <p>- email: "{user?.email || "superadmin@ticketlelo.com"}"</p>
              <p>- fullName: "Super Administrator"</p>
              <p>- role: "superAdmin"</p>
              <p>- isAdmin: true</p>
              <p>- createdAt: [Timestamp]</p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-4">
          <a
            href="/superadmin"
            className="tl-primary-action flex-1 font-semibold py-3 px-6 text-center"
          >
            Go to Super Admin Panel
          </a>
          <button
            onClick={() => window.location.reload()}
            className="flex-1 bg-white hover:bg-[#3157ff]/10 text-[#061a3f] border border-[var(--tl-line)] font-semibold py-3 px-6 rounded-lg transition-all"
          >
            Refresh Page
          </button>
        </div>
      </div>
    </div>
  );
}
