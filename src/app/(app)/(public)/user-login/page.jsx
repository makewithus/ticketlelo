"use client";

import { User, Mail, Lock, Loader2, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { getAuthErrorMessage, login } from "@/lib/auth";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function UserLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Validate input
      if (!email.trim()) {
        throw new Error("Please enter your email address");
      }

      if (!password.trim()) {
        throw new Error("Please enter your password");
      }

      // Login with email and password
      const user = await login(email, password);

      if (user) {
        toast.success("Login successful! Welcome back!");
        router.push("/dashboard");
      }
    } catch (err) {
      const errorMsg = getAuthErrorMessage(
        err,
        "Sign in failed. Please check your details and try again.",
      );
      setError(errorMsg);

      // More user-friendly error messages
      if (err.message?.includes("auth/user-not-found")) {
        toast.error("No account found. Please register for an event first.");
      } else if (
        err.message?.includes("auth/wrong-password") ||
        err.message?.includes("invalid-credential")
      ) {
        toast.error(errorMsg);
      } else {
        toast.error(errorMsg);
      }
    } finally {
      setLoading(false);
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
        url: `${window.location.origin}/user-login`,
        handleCodeInApp: false,
      };

      await sendPasswordResetEmail(
        auth,
        resetEmail.toLowerCase().trim(),
        actionCodeSettings,
      );
      toast.success("Password reset link sent! Check your email.");
      setShowForgotPassword(false);
      setResetEmail("");
    } catch (error) {
      console.error("Password reset error:", error);
      if (error.code === "auth/user-not-found") {
        toast.error("No account found with this email");
      } else {
        toast.error("Failed to send reset link. Please try again.");
      }
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="tl-system-theme tl-auth-page">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#FF6A00]/10 via-transparent to-[#FFD60A]/10 pointer-events-none" />
      <div
        className="absolute inset-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(254,118,11,0.6) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(254,118,11,0.6) 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }}
      />

      {/* Floating orbs */}

      {/* Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {/* Back to Home */}
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[rgba(6,26,63,0.64)] hover:text-[#061a3f] transition-colors mb-8 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>Back to Home</span>
          </Link>

          {showForgotPassword ? (
            /* Forgot Password Form */
            <div className="tl-auth-card p-8">
              <div className="text-center mb-8">
                <div className="tl-auth-icon inline-flex items-center justify-center w-16 h-16 mb-4">
                  <Mail className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-3xl font-extrabold text-[#061a3f] mb-2">
                  Reset Password
                </h1>
                <p className="text-[rgba(6,26,63,0.64)] text-sm">
                  Enter your email to receive a reset link
                </p>
              </div>

              <form onSubmit={handlePasswordReset} className="space-y-5">
                <div>
                  <label htmlFor="reset-email" className="block text-sm font-medium text-[#061a3f] mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[rgba(6,26,63,0.54)] dark:text-white" />
                    <input id="reset-email"
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-black/30 border border-[#FF6A00]/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#FF6A00]/50 focus:ring-2 focus:ring-[#FF6A00]/20 transition-all"
                      placeholder="your.email@example.com"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={resetLoading}
                  className="w-full bg-[#FF6A00] hover:bg-[#E65C00] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-[#FF6A00]/30 flex items-center justify-center gap-2"
                >
                  {resetLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <span>Send Reset Link</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setShowForgotPassword(false)}
                  className="w-full text-[rgba(6,26,63,0.64)] hover:text-[#061a3f] transition-colors text-sm"
                >
                  Back to Login
                </button>
              </form>
            </div>
          ) : (
            /* Login Form */
            <div className="tl-auth-card p-8">
              {/* Header */}
              <div className="text-center mb-8">
                <div className="tl-auth-icon inline-flex items-center justify-center w-16 h-16 mb-4">
                  <User className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-3xl font-extrabold text-[#061a3f] mb-2">
                  Welcome Back
                </h1>
                <p className="text-[rgba(6,26,63,0.64)] text-sm">
                  Sign in to access your tickets
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleLogin} className="space-y-5">
                {/* Email Field */}
                <div>
                  <label htmlFor="user-email" className="block text-sm font-medium text-[#061a3f] mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[rgba(6,26,63,0.54)] dark:text-white" />
                    <input id="user-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-black/30 border border-[#FF6A00]/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#FF6A00]/50 focus:ring-2 focus:ring-[#FF6A00]/20 transition-all"
                      placeholder="your.email@example.com"
                      required
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor="user-password" className="block text-sm font-medium text-[#061a3f]">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(true)}
                      className="text-xs text-[#3157ff] hover:text-[#173cf4] transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[rgba(6,26,63,0.54)] dark:text-white" />
                    <input id="user-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-black/30 border border-[#FF6A00]/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#FF6A00]/50 focus:ring-2 focus:ring-[#FF6A00]/20 transition-all"
                      placeholder="••••••••"
                      required
                    />
                  </div>
                </div>

                {/* Error Message */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-center"
                  >
                    {error}
                  </motion.div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#FF6A00] hover:bg-[#E65C00] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-[#FF6A00]/30 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Signing in...</span>
                    </>
                  ) : (
                    <>
                      <User className="w-5 h-5" />
                      <span>Sign In</span>
                    </>
                  )}
                </button>
              </form>

              {/* Footer Links */}
              <div className="mt-6 pt-6 border-t border-[var(--tl-line)] text-center">
                <p className="text-sm text-[rgba(6,26,63,0.64)]">
                  Don&apos;t have an account?{" "}
                  <Link
                    href="/"
                    className="text-[#3157ff] hover:text-[#173cf4] font-medium transition-colors"
                  >
                    Browse events
                  </Link>
                </p>
              </div>
            </div>
          )}

          {/* Additional Info */}
          <div className="mt-6 text-center text-sm text-[rgba(6,26,63,0.64)]">
            <p>
              Are you an organizer?{" "}
              <Link href="/organiser-login" className="text-[#3157ff] hover:underline">
                Login here
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
