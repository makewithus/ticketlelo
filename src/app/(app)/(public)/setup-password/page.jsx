"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  Mail,
  Loader2,
  ArrowRight,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { login, establishServerSession } from "@/lib/auth";
import { BrandLoader } from "@/components/ui/brand-loader";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const LOGO_SRC = "/logo/ticketlelo-logo-nav.png";

function SetupPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const queryEmail = searchParams?.get("email") || "";
  const queryToken = searchParams?.get("token") || "";
  const queryTicketId = searchParams?.get("ticketId") || "";

  const [email, setEmail] = useState(queryEmail);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (queryEmail && !email) {
      setEmail(queryEmail);
    }
  }, [queryEmail, email]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const cleanEmail = String(email || "").trim().toLowerCase();
    if (!cleanEmail) {
      setError("Please provide your registered email address.");
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/setup-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: cleanEmail,
          token: queryToken,
          newPassword,
          confirmPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to set up password");
      }

      setIsSuccess(true);
      toast.success("Password set successfully! Logging you in...");

      // Automatically sign in with custom token or standard password credentials
      if (data.customToken) {
        try {
          const userCredential = await signInWithCustomToken(auth, data.customToken);
          if (userCredential?.user) {
            await establishServerSession(userCredential.user);
          }
        } catch (signInErr) {
          console.warn("[setup-password] Custom token sign-in fallback to password login:", signInErr);
          await login(cleanEmail, newPassword);
        }
      } else {
        await login(cleanEmail, newPassword);
      }

      // Smooth transition to general dashboard
      setTimeout(() => {
        router.replace("/dashboard");
      }, 1000);
    } catch (err) {
      console.error("[setup-password] Error:", err);
      setError(err.message || "Failed to set up password. Please try again.");
      toast.error(err.message || "Failed to set up password");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#131517] text-white flex flex-col justify-between p-4 sm:p-6 antialiased">
      {/* Top Navbar */}
      <header className="max-w-6xl mx-auto w-full flex items-center justify-between py-3">
        <Link href="/" className="flex items-center gap-2 group">
          <img src={LOGO_SRC} alt="TicketLelo" className="h-7 sm:h-8 w-auto object-contain" />
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            href={`/login${email ? `?email=${encodeURIComponent(email)}` : ""}`}
            className="text-xs sm:text-sm font-semibold text-[#D0D0D1] hover:text-[#FE760B] transition-colors"
          >
            Log In
          </Link>
        </div>
      </header>

      {/* Main Card */}
      <main className="max-w-md mx-auto w-full my-auto py-6">
        <div className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          {/* Subtle Accent Glow */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-[#FE760B]/10 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />

          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FE760B]/10 border border-[#FE760B]/20 text-[#FE760B] text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>First-Time Account Setup</span>
          </div>

          {/* Heading */}
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">
            Welcome to TicketLelo!
          </h1>
          <p className="text-sm text-[#D0D0D1] leading-relaxed mb-6">
            Your registration is confirmed. Set your password to access your ticket and manage all your event registrations from one dashboard.
          </p>

          {error && (
            <div className="mb-6 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs sm:text-sm flex items-start gap-2.5">
              <span className="font-bold">Error:</span>
              <span>{error}</span>
            </div>
          )}

          {!queryToken && !error && (
            <div className="mb-6 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs leading-relaxed">
              <span className="font-bold block mb-1">Notice:</span>
              For security, account setup requires clicking the link sent to your registration email. If you already have an account, please{" "}
              <Link href={`/login${email ? `?email=${encodeURIComponent(email)}` : ""}`} className="underline font-bold text-white hover:text-[#FE760B]">
                Log in here
              </Link>.
            </div>
          )}

          {isSuccess ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-white">Password Set Successfully!</h2>
              <p className="text-sm text-[#9B9EA4]">
                Taking you directly to your TicketLelo dashboard to view your ticket...
              </p>
              <div className="flex items-center justify-center pt-2 text-[#FE760B]">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Registered Email */}
              <div>
                <label className="block text-xs font-semibold text-[#D0D0D1] uppercase tracking-wider mb-1.5">
                  Registered Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#6C7075]">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    readOnly={Boolean(queryEmail)}
                    required
                    placeholder="you@example.com"
                    className={`w-full pl-10 pr-4 py-3 bg-[#131517] border border-[#2A2D31] rounded-xl text-sm text-white placeholder-[#6C7075] focus:outline-hidden focus:border-[#FE760B] transition-colors ${
                      queryEmail ? "opacity-80 cursor-not-allowed bg-[#181a1d]" : ""
                    }`}
                  />
                  {queryEmail && (
                    <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-emerald-400">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                  )}
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-xs font-semibold text-[#D0D0D1] uppercase tracking-wider mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#6C7075]">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="Create a secure password (min 6 chars)"
                    className="w-full pl-10 pr-11 py-3 bg-[#131517] border border-[#2A2D31] rounded-xl text-sm text-white placeholder-[#6C7075] focus:outline-hidden focus:border-[#FE760B] transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#9B9EA4] hover:text-white transition-colors cursor-pointer"
                    aria-label={showNewPassword ? "Hide password" : "Show password"}
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-[#9B9EA4] mt-1 pl-1">
                  Must be at least 6 characters long.
                </p>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-xs font-semibold text-[#D0D0D1] uppercase tracking-wider mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#6C7075]">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="Re-enter your new password"
                    className="w-full pl-10 pr-11 py-3 bg-[#131517] border border-[#2A2D31] rounded-xl text-sm text-white placeholder-[#6C7075] focus:outline-hidden focus:border-[#FE760B] transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#9B9EA4] hover:text-white transition-colors cursor-pointer"
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Primary Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 h-12 bg-[#FE760B] hover:bg-[#FF8A2B] disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-lg shadow-[#FE760B]/20 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Setting Password...</span>
                  </>
                ) : (
                  <>
                    <span>Set Password &amp; Continue</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* Supporting link */}
              <div className="pt-3 text-center">
                <p className="text-xs text-[#9B9EA4]">
                  Already have a TicketLelo password?{" "}
                  <Link
                    href={`/login${email ? `?email=${encodeURIComponent(email)}` : ""}`}
                    className="text-[#FE760B] hover:underline font-medium"
                  >
                    Log In
                  </Link>
                </p>
              </div>
            </form>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto w-full text-center py-4 text-xs text-[#6C7075]">
        &copy; {new Date().getFullYear()} TicketLelo. All rights reserved.
      </footer>
    </div>
  );
}

export default function SetupPasswordPage() {
  return (
    <Suspense fallback={<BrandLoader message="Loading TicketLelo Account Setup..." fullScreen />}>
      <SetupPasswordContent />
    </Suspense>
  );
}

