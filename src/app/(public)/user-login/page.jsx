"use client";

import { User, Mail, Lock, Loader2, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { login } from "@/lib/auth";
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
        toast.success("✅ Login successful! Welcome back!");
        router.push("/dashboard");
      }
    } catch (err) {
      const errorMsg = err.message || "Sign in failed";
      setError(errorMsg);

      // More user-friendly error messages
      if (errorMsg.includes("auth/user-not-found")) {
        toast.error("No account found. Please register for an event first.");
      } else if (
        errorMsg.includes("auth/wrong-password") ||
        errorMsg.includes("invalid-credential")
      ) {
        toast.error("🔒 Incorrect password. Please try again.");
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
        url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/user-login`,
        handleCodeInApp: false,
      };

      await sendPasswordResetEmail(
        auth,
        resetEmail.toLowerCase().trim(),
        actionCodeSettings,
      );
      toast.success("✅ Password reset link sent! Check your email.");
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
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#FE760B]/10 via-transparent to-[#FEDF05]/10 pointer-events-none" />
      <div
        className="absolute inset-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(254,118,11,0.6) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(254,118,11,0.6) 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }}
      />

      {/* Floating orbs */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-[#FE760B]/20 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-[#FEDF05]/20 rounded-full blur-3xl" />

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
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>Back to Home</span>
          </Link>

          {showForgotPassword ? (
            /* Forgot Password Form */
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-[#FE760B]/20 rounded-2xl p-8 shadow-2xl">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-[#FE760B] to-[#FEDF05] rounded-2xl mb-4 shadow-lg shadow-[#FE760B]/30">
                  <Mail className="w-8 h-8 text-black" />
                </div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-[#FE760B] to-[#FEDF05] bg-clip-text text-transparent mb-2">
                  Reset Password
                </h1>
                <p className="text-gray-400 text-sm">
                  Enter your email to receive a reset link
                </p>
              </div>

              <form onSubmit={handlePasswordReset} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-black/30 border border-[#FE760B]/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#FE760B]/50 focus:ring-2 focus:ring-[#FE760B]/20 transition-all"
                      placeholder="your.email@example.com"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={resetLoading}
                  className="w-full bg-gradient-to-r from-[#FE760B] to-[#FEDF05] hover:from-[#FE760B]/90 hover:to-[#FEDF05]/90 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-[#FE760B]/30 flex items-center justify-center gap-2"
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
                  className="w-full text-gray-400 hover:text-white transition-colors text-sm"
                >
                  Back to Login
                </button>
              </form>
            </div>
          ) : (
            /* Login Form */
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-[#FE760B]/20 rounded-2xl p-8 shadow-2xl">
              {/* Header */}
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-[#FE760B] to-[#FEDF05] rounded-2xl mb-4 shadow-lg shadow-[#FE760B]/30">
                  <User className="w-8 h-8 text-black" />
                </div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-[#FE760B] to-[#FEDF05] bg-clip-text text-transparent mb-2">
                  Welcome Back
                </h1>
                <p className="text-gray-400 text-sm">
                  Sign in to access your tickets
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleLogin} className="space-y-5">
                {/* Email Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-black/30 border border-[#FE760B]/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#FE760B]/50 focus:ring-2 focus:ring-[#FE760B]/20 transition-all"
                      placeholder="your.email@example.com"
                      required
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-300">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(true)}
                      className="text-xs text-[#FEDF05] hover:text-[#FE760B] transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-black/30 border border-[#FE760B]/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#FE760B]/50 focus:ring-2 focus:ring-[#FE760B]/20 transition-all"
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
                  className="w-full bg-gradient-to-r from-[#FE760B] to-[#FEDF05] hover:from-[#FE760B]/90 hover:to-[#FEDF05]/90 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-[#FE760B]/30 flex items-center justify-center gap-2"
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
              <div className="mt-6 pt-6 border-t border-white/10 text-center">
                <p className="text-sm text-gray-400">
                  Don't have an account?{" "}
                  <Link
                    href="/"
                    className="text-[#FEDF05] hover:text-[#FE760B] font-medium transition-colors"
                  >
                    Browse events
                  </Link>
                </p>
              </div>
            </div>
          )}

          {/* Additional Info */}
          <div className="mt-6 text-center text-sm text-gray-500">
            <p>
              Are you an organizer?{" "}
              <Link href="/organiser-login" className="text-[#FEDF05] hover:underline">
                Login here
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
