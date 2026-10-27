"use client";

import { Building2, Mail, Lock, Loader2, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { getAuthErrorMessage, login } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function OrganiserLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await login(email, password);

      // Login successful - let auth context determine role and redirect
      toast.success("Login successful! Redirecting to dashboard...");
      
      // Wait a moment for auth context to load user data
      await new Promise((resolve) => setTimeout(resolve, 500));
      router.push("/admin/dashboard");
    } catch (err) {
      const errorMsg = getAuthErrorMessage(
        err,
        "Login failed. Please check your details and try again.",
      );
      setError(errorMsg);
      
      // More user-friendly error messages
      if (err.message?.includes("auth/user-not-found")) {
        toast.error("No organizer account found with this email");
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

          {/* Login Card */}
          <div className="tl-auth-card p-8">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="tl-auth-icon inline-flex items-center justify-center w-16 h-16 mb-4">
                <Building2 className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl font-extrabold text-[#061a3f] mb-2">
                Organiser Portal
              </h1>
              <p className="text-[rgba(6,26,63,0.64)] text-sm">
                Access your event dashboard
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-5">
              {/* Email Field */}
              <div>
                <label htmlFor="organiser-email" className="block text-sm font-medium text-[#061a3f] mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[rgba(6,26,63,0.54)] dark:text-white" />
                  <input id="organiser-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-black/30 border border-[#FF6A00]/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#FF6A00]/50 focus:ring-2 focus:ring-[#FF6A00]/20 transition-all"
                    placeholder="organiser@ticketlelo.com"
                    required
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <label htmlFor="organiser-password" className="block text-sm font-medium text-[#061a3f] mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[rgba(6,26,63,0.54)] dark:text-white" />
                  <input id="organiser-password"
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
                    <span>Logging in...</span>
                  </>
                ) : (
                  <>
                    <Building2 className="w-5 h-5" />
                    <span>Login to Dashboard</span>
                  </>
                )}
              </button>
            </form>

            {/* Footer Links */}
              <div className="mt-6 pt-6 border-t border-[var(--tl-line)] text-center">
                <p className="text-sm text-[rgba(6,26,63,0.64)]">
                Want to host an event?{" "}
                <Link
                  href="/host-event"
                  className="text-[#3157ff] hover:text-[#173cf4] font-medium transition-colors"
                >
                  Apply here
                </Link>
              </p>
            </div>
          </div>

          {/* Additional Info */}
          <div className="mt-6 text-center text-sm text-[rgba(6,26,63,0.64)]">
            <p>
              Looking for a different portal?{" "}
              <Link href="/" className="text-[#3157ff] hover:underline">
                Go to homepage
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
