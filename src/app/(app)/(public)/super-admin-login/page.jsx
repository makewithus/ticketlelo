"use client";

import { Shield, Mail, Lock, Loader2, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { login, logout } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function SuperAdminLoginPage() {
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
      const userData = await login(email, password);

      // Verify the logged-in user is actually a superAdmin
      if (!userData || userData.role !== "superAdmin") {
        // Sign out immediately - not authorised
        try { await logout(); } catch (_) {}
        const msg = "Access denied. This portal is for Super Admins only.";
        setError(msg);
        toast.error("🔒 " + msg);
        setLoading(false);
        return;
      }

      toast.success("✅ Super Admin access granted!");
      await new Promise((resolve) => setTimeout(resolve, 300));
      router.push("/superadmin");
    } catch (err) {
      const errorMsg = err.message || "Login failed";
      setError(errorMsg);

      if (errorMsg.includes("auth/user-not-found")) {
        toast.error("Invalid super admin credentials");
      } else if (
        errorMsg.includes("auth/wrong-password") ||
        errorMsg.includes("invalid-credential")
      ) {
        toast.error("🔒 Incorrect password. Access denied.");
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
      <div className="absolute inset-0 bg-gradient-to-br from-red-900/10 via-transparent to-orange-900/10 pointer-events-none" />
      <div
        className="absolute inset-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(254,118,11,0.6) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(254,118,11,0.6) 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }}
      />

      {/* Floating orbs - Red theme */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-red-600/20 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-orange-600/20 rounded-full blur-3xl" />

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
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-red-500/20 rounded-2xl p-8 shadow-2xl">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-red-600 to-orange-600 rounded-2xl mb-4 shadow-lg shadow-red-600/30">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent mb-2">
                Super Admin Portal
              </h1>
              <p className="text-gray-400 text-sm">
                Restricted Access Only
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
                    className="w-full pl-11 pr-4 py-3 bg-black/30 border border-red-500/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20 transition-all"
                    placeholder="superadmin@ticketlelo.com"
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
                    className="w-full pl-11 pr-4 py-3 bg-black/30 border border-red-500/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20 transition-all"
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
                className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-600/90 hover:to-orange-600/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-red-600/30 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <Shield className="w-5 h-5" />
                    <span>Secure Login</span>
                  </>
                )}
              </button>
            </form>

            {/* Footer Warning */}
            <div className="mt-6 pt-6 border-t border-white/10">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Shield className="w-4 h-4" />
                <p>This portal is for authorized super administrators only</p>
              </div>
            </div>
          </div>

          {/* Additional Info */}
          <div className="mt-6 text-center text-sm text-gray-500">
            <p>
              Not a super admin?{" "}
              <Link href="/" className="text-orange-500 hover:underline">
                Go to homepage
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
