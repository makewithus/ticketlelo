"use client";

import {
  User,
  Shield,
  Building2,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  ArrowLeft,
  CheckCircle2,
} from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useState, useEffect } from "react";
import {
  getAuthErrorMessage,
  login,
  loginWithGoogle,
  getRedirectPathForRole,
} from "@/lib/auth";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function UnifiedLoginPage() {
  const router = useRouter();
  const { user: currentUser, loading: authLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [redirectingRole, setRedirectingRole] = useState(null);

  // If already logged in, redirect automatically to their dashboard
  useEffect(() => {
    if (!authLoading && currentUser) {
      const targetPath = getRedirectPathForRole(currentUser.role);
      router.replace(targetPath);
    }
  }, [currentUser, authLoading, router]);

  const handleRoleRedirect = (role, displayName) => {
    setRedirectingRole(role);
    const targetPath = getRedirectPathForRole(role);

    if (role === "superAdmin") {
      toast.success(`Welcome Super Admin${displayName ? `, ${displayName}` : ""}! Accessing portal...`);
    } else if (role === "organiser") {
      toast.success(`Welcome back Organiser${displayName ? `, ${displayName}` : ""}! Opening dashboard...`);
    } else {
      toast.success(`Welcome${displayName ? `, ${displayName}` : ""}! Opening your tickets...`);
    }

    setTimeout(() => {
      router.push(targetPath);
    }, 400);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (!email.trim()) {
        throw new Error("Please enter your email address");
      }
      if (!password.trim()) {
        throw new Error("Please enter your password");
      }

      const userData = await login(email, password);
      const role = userData?.role || "user";
      handleRoleRedirect(role, userData?.fullName);
    } catch (err) {
      const errorMsg = getAuthErrorMessage(
        err,
        "Sign in failed. Please check your credentials.",
      );
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (googleLoading) return;
    setGoogleLoading(true);
    setError("");

    try {
      const userData = await loginWithGoogle();
      if (!userData) return;
      const role = userData?.role || "user";
      handleRoleRedirect(role, userData?.fullName);
    } catch (err) {
      // Do not display an error if the user intentionally closed the popup or a superseded request was cancelled
      if (
        err?.isCancelled ||
        err?.code === "auth/popup-closed-by-user" ||
        err?.code === "auth/cancelled-popup-request" ||
        err?.message?.includes("cancelled")
      ) {
        return;
      }
      const errorMsg = getAuthErrorMessage(
        err,
        "Google sign in failed. Please try again.",
      );
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();

    if (!resetEmail || !resetEmail.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }

    setResetLoading(true);
    try {
      const actionCodeSettings = {
        url: `${window.location.origin}/login`,
        handleCodeInApp: false,
      };

      await sendPasswordResetEmail(
        auth,
        resetEmail.toLowerCase().trim(),
        actionCodeSettings,
      );
      toast.success("Password reset link sent! Check your inbox.");
      setShowForgotPassword(false);
      setResetEmail("");
    } catch (err) {
      console.error("Password reset error:", err);
      if (err.code === "auth/user-not-found") {
        toast.error("No account found with this email address");
      } else {
        toast.error("Failed to send reset link. Please try again.");
      }
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-[#131517] text-[#FFFFFF] selection:bg-[#FE760B] selection:text-white">
      {/* Background Ambience: faint top glow per brand guidelines */}
      <div className="absolute top-0 inset-x-0 h-80 bg-gradient-to-b from-[#FE760B]/10 via-[#FE760B]/5 to-transparent pointer-events-none" />

      {/* Top Controls: Back Link & Theme Toggle */}
      <div className="absolute top-4 inset-x-4 sm:inset-x-8 flex items-center justify-between z-20">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-[#9B9EA4] hover:text-[#FFFFFF] transition-colors group text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Back to Home</span>
        </Link>
        <ThemeToggle inline />
      </div>

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-md mx-auto pt-8">

        {showForgotPassword ? (
          /* Password Reset Card */
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-5 xs:p-6 sm:p-8 shadow-xl"
          >
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#212327] border border-[#2A2D31] mb-3 text-[#FE760B]">
                <Mail className="w-6 h-6" />
              </div>
              <h1 className="text-xl font-bold text-[#FFFFFF] tracking-tight">
                Reset Password
              </h1>
              <p className="text-[#9B9EA4] text-xs mt-1">
                Enter your account email to receive a secure recovery link
              </p>
            </div>

            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div>
                <label
                  htmlFor="reset-email"
                  className="block text-xs font-semibold text-[#D0D0D1] mb-1.5"
                >
                  Email
                </label>
                <input
                  id="reset-email"
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#212327] border border-[#2A2D31] rounded-xl text-white placeholder-[#9B9EA4] focus:outline-none focus:border-[#FE760B] focus:ring-1 focus:ring-[#FE760B] transition-colors text-sm"
                  placeholder="your.email@example.com"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={resetLoading}
                className="w-full bg-white hover:bg-slate-100 text-black font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm mt-2"
              >
                {resetLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Sending Link...</span>
                  </>
                ) : (
                  <span>Send Recovery Link</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowForgotPassword(false)}
                className="w-full text-[#9B9EA4] hover:text-[#FFFFFF] transition-colors text-xs text-center py-2"
              >
                Back to Sign In
              </button>
            </form>
          </motion.div>
        ) : (
          /* Main Unified Login Card strictly matching Image 4 */
          <div className="flex flex-col items-center">
            {/* Logo at top */}
            <div className="flex justify-center mb-6">
              <img
                src="/logo/ticketlelo-logo-full.png"
                alt="TicketLelo"
                className="h-16 w-auto max-w-[260px] object-contain"
              />
            </div>

            {/* Header text outside card like Image 4 */}
            <div className="text-center mb-6">
              <h1 className="text-3xl font-extrabold text-[#FFFFFF] tracking-tight">
                Welcome back
              </h1>
              <p className="text-[#9B9EA4] text-sm mt-1.5">
                Sign in to see your tickets.
              </p>
            </div>

            {/* Form Card */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-5 xs:p-6 sm:p-8 shadow-xl w-full"
            >
              {/* ONE-TAP GOOGLE SIGN-IN BUTTON */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={googleLoading || loading}
                className="w-full relative flex items-center justify-center gap-3 py-3 px-4 bg-[#212327] hover:bg-[#2A2D31] text-[#FFFFFF] border border-[#2A2D31] font-medium rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed group text-sm mb-5"
                id="google-signin-btn"
              >
                {googleLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[#FFFFFF]" />
                ) : (
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.16 0 9.97 0 12s.45 3.84 1.25 5.42l4.03-3.15z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                    />
                  </svg>
                )}
                <span className="tracking-tight">
                  {googleLoading ? "Signing in with Google..." : "Continue with Google"}
                </span>
              </button>

              {/* Divider */}
              <div className="relative mb-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#2A2D31]" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-[#1A1C1F] px-3 text-[#9B9EA4] font-medium">
                    or
                  </span>
                </div>
              </div>

              {/* Credentials Form */}
              <form onSubmit={handleLogin} className="space-y-4">
                {/* Email */}
                <div>
                  <label
                    htmlFor="login-email"
                    className="block text-xs font-semibold text-[#D0D0D1] mb-1.5"
                  >
                    Email
                  </label>
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[#212327] border border-[#2A2D31] rounded-xl text-white placeholder-[#9B9EA4] focus:outline-none focus:border-[#FE760B] focus:ring-1 focus:ring-[#FE760B] transition-colors text-sm"
                    placeholder="your.email@example.com"
                    autoComplete="email"
                    required
                  />
                </div>

                {/* Password */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="login-password"
                      className="block text-xs font-semibold text-[#D0D0D1]"
                    >
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(true)}
                      className="text-xs text-[#9B9EA4] hover:text-white hover:underline transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-4 pr-11 py-2.5 bg-[#212327] border border-[#2A2D31] rounded-xl text-white placeholder-[#9B9EA4] focus:outline-none focus:border-[#FE760B] focus:ring-1 focus:ring-[#FE760B] transition-colors text-sm"
                      placeholder="••••••••"
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9B9EA4] hover:text-white transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Error Notice */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center"
                  >
                    {error}
                  </motion.div>
                )}

                {/* Redirecting Banner */}
                {redirectingRole && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center justify-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2.5"
                  >
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Authenticated as {redirectingRole}. Redirecting...</span>
                  </motion.div>
                )}

                {/* Submit Button (White button matching Image 4) */}
                <button
                  type="submit"
                  disabled={loading || googleLoading || !!redirectingRole}
                  className="w-full bg-white hover:bg-slate-100 disabled:opacity-50 text-black font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm mt-3"
                  id="credential-login-btn"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-black" />
                      <span>Signing in...</span>
                    </>
                  ) : (
                    <span>Sign in</span>
                  )}
                </button>
              </form>
            </motion.div>

            {/* Footer Links matching Image 4 */}
            <div className="mt-8 text-center space-y-2">
              <p className="text-sm text-[#9B9EA4]">
                Don&apos;t have an account?{" "}
                <Link
                  href="/"
                  className="text-white hover:underline font-medium"
                >
                  Browse events
                </Link>
              </p>
              <p className="text-sm text-[#9B9EA4]">
                Want to host an event?{" "}
                <Link
                  href="/host-event"
                  className="text-white hover:underline font-medium"
                >
                  Apply to host
                </Link>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
