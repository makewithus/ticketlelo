"use client";

import { Building2, Mail, Lock, Loader2, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { login } from "@/lib/auth";
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
      toast.success("✅ Login successful! Redirecting to dashboard...");
      
      // Wait a moment for auth context to load user data
      await new Promise((resolve) => setTimeout(resolve, 500));
      router.push("/admin/dashboard");
    } catch (err) {
      const errorMsg = err.message || "Login failed";
      setError(errorMsg);
      
      // More user-friendly error messages
      if (errorMsg.includes("auth/user-not-found")) {
        toast.error("No organizer account found with this email");
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

          {/* Login Card */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-[#FE760B]/20 rounded-2xl p-8 shadow-2xl">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-[#FE760B] to-[#FEDF05] rounded-2xl mb-4 shadow-lg shadow-[#FE760B]/30">
                <Building2 className="w-8 h-8 text-black" />
              </div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-[#FE760B] to-[#FEDF05] bg-clip-text text-transparent mb-2">
                Organiser Portal
              </h1>
              <p className="text-gray-400 text-sm">
                Access your event dashboard
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
                    placeholder="organiser@ticketlelo.com"
                    required
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Password
                </label>
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
            <div className="mt-6 pt-6 border-t border-white/10 text-center">
              <p className="text-sm text-gray-400">
                Want to host an event?{" "}
                <Link
                  href="/host-event"
                  className="text-[#FEDF05] hover:text-[#FE760B] font-medium transition-colors"
                >
                  Apply here
                </Link>
              </p>
            </div>
          </div>

          {/* Additional Info */}
          <div className="mt-6 text-center text-sm text-gray-500">
            <p>
              Looking for a different portal?{" "}
              <Link href="/" className="text-[#FEDF05] hover:underline">
                Go to homepage
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
