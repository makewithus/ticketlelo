"use client";

import { Shield, User, X, Building2, Mail, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { login } from "@/lib/auth";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function Header() {
  const router = useRouter();
  const [showSuperAdminModal, setShowSuperAdminModal] = useState(false);
  const [showOrganiserModal, setShowOrganiserModal] = useState(false);
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  // Form states
  const [superAdminEmail, setSuperAdminEmail] = useState("");
  const [superAdminPassword, setSuperAdminPassword] = useState("");
  const [organiserEmail, setOrganiserEmail] = useState("");
  const [organiserPassword, setOrganiserPassword] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [resetEmail, setResetEmail] = useState("");

  // Loading and error states
  const [loading, setLoading] = useState({
    superAdmin: false,
    organiser: false,
    user: false,
    reset: false,
  });
  const [error, setError] = useState({
    superAdmin: "",
    organiser: "",
    user: "",
  });

  const handleSuperAdminLogin = async (e) => {
    e.preventDefault();
    setLoading({ ...loading, superAdmin: true });
    setError({ ...error, superAdmin: "" });

    try {
      await login(superAdminEmail, superAdminPassword);

      // Login successful - let auth context determine role and redirect
      setShowSuperAdminModal(false);
      setSuperAdminEmail("");
      setSuperAdminPassword("");

      // Wait a moment for auth context to load user data
      await new Promise((resolve) => setTimeout(resolve, 500));
      router.push("/superadmin");
    } catch (err) {
      setError({ ...error, superAdmin: err.message || "Login failed" });
    } finally {
      setLoading({ ...loading, superAdmin: false });
    }
  };

  const handleOrganiserLogin = async (e) => {
    e.preventDefault();
    setLoading({ ...loading, organiser: true });
    setError({ ...error, organiser: "" });

    try {
      await login(organiserEmail, organiserPassword);

      // Login successful - let auth context determine role and redirect
      setShowOrganiserModal(false);
      setOrganiserEmail("");
      setOrganiserPassword("");

      // Wait a moment for auth context to load user data
      await new Promise((resolve) => setTimeout(resolve, 500));
      router.push("/admin/dashboard");
    } catch (err) {
      setError({ ...error, organiser: err.message || "Login failed" });
    } finally {
      setLoading({ ...loading, organiser: false });
    }
  };

  const handleUserSignIn = async (e) => {
    e.preventDefault();
    setLoading({ ...loading, user: true });
    setError({ ...error, user: "" });

    try {
      // Validate input
      if (!userEmail.trim()) {
        throw new Error("Please enter your email address");
      }

      if (!userPassword.trim()) {
        throw new Error("Please enter your password");
      }

      // Login with email and password
      const user = await login(userEmail, userPassword);

      if (user) {
        toast.success("✅ Login successful! Welcome back!");
        setShowSignInModal(false);
        setUserEmail("");
        setUserPassword("");
        router.push("/dashboard");
      }
    } catch (err) {
      const errorMsg = err.message || "Sign in failed";
      setError({ ...error, user: errorMsg });

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
      setLoading({ ...loading, user: false });
    }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();

    if (!resetEmail || !resetEmail.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }

    setLoading({ ...loading, reset: true });
    try {
      const actionCodeSettings = {
        url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}`,
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
      setLoading({ ...loading, reset: false });
    }
  };

  const closeAllModals = () => {
    setShowSuperAdminModal(false);
    setShowOrganiserModal(false);
    setShowSignInModal(false);
    setShowForgotPassword(false);
    setUserEmail("");
    setUserPassword("");
    setResetEmail("");
    setError({ superAdmin: "", organiser: "", user: "" });
  };

  return (
    <>
      {/* ── Floating Pill Header ── */}
      <motion.header
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="fixed top-0 left-0 right-0 z-[100] mx-auto w-full max-w-full
          bg-black/80 backdrop-blur-xl
          border-b border-emerald-500/20
          text-white py-3 px-4 sm:px-6
          flex items-center justify-between gap-4
          shadow-[0_0_40px_rgba(16,185,129,0.08)]"
      >
        {/* Ambient glow */}
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-transparent to-emerald-500/5 pointer-events-none" />
        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.02] pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(rgba(52,211,153,0.6) 1px, transparent 1px),
                             linear-gradient(90deg, rgba(52,211,153,0.6) 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
          }}
        />

        {/* ── Logo Text ── */}
        <Link href="/" className="relative z-10 shrink-0">
          <span className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
            Ticketलेलो
          </span>
        </Link>

        {/* ── Right Auth Buttons ── */}
        <div className="flex items-center gap-1.5 relative z-10 shrink-0">
          <button
            onClick={() => setShowSuperAdminModal(true)}
            className="bg-white/5 hover:bg-white/10 text-white font-medium px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all border border-white/10 text-sm whitespace-nowrap"
          >
            <Shield className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Super Admin</span>
          </button>
          <button
            onClick={() => setShowOrganiserModal(true)}
            className="bg-white/5 hover:bg-white/10 text-white font-medium px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all border border-white/10 text-sm whitespace-nowrap"
          >
            <Building2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Organiser</span>
          </button>
          <button
            onClick={() => setShowSignInModal(true)}
            className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all text-sm shadow-lg shadow-emerald-500/20 whitespace-nowrap"
          >
            <User className="w-3.5 h-3.5" />
            Sign In
          </button>
        </div>
      </motion.header>

      {/* ── Super Admin Modal ── */}
      <AnimatePresence>
        {showSuperAdminModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeAllModals}
              className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed inset-0 flex items-center justify-center z-[201] p-4"
            >
              <div className="w-full max-w-md bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-emerald-500/20 rounded-2xl p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-emerald-400" />
                    <h2 className="text-xl font-bold text-white">
                      Super Admin Portal
                    </h2>
                  </div>
                  <button
                    onClick={closeAllModals}
                    className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>

                <form onSubmit={handleSuperAdminLogin} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">
                      Email
                    </label>
                    <input
                      type="email"
                      value={superAdminEmail}
                      onChange={(e) => setSuperAdminEmail(e.target.value)}
                      className="w-full px-4 py-2.5 bg-black/30 border border-emerald-500/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
                      placeholder="superadmin@ticketlelo.com"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">
                      Password
                    </label>
                    <input
                      type="password"
                      value={superAdminPassword}
                      onChange={(e) => setSuperAdminPassword(e.target.value)}
                      className="w-full px-4 py-2.5 bg-black/30 border border-emerald-500/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
                      placeholder="••••••••"
                      required
                    />
                  </div>

                  {error.superAdmin && (
                    <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                      {error.superAdmin}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading.superAdmin}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/50 text-black font-semibold py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-500/20"
                  >
                    {loading.superAdmin ? "Logging in..." : "Login"}
                  </button>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Organiser Modal ── */}
      <AnimatePresence>
        {showOrganiserModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeAllModals}
              className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed inset-0 flex items-center justify-center z-[201] p-4"
            >
              <div className="w-full max-w-md bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-emerald-500/20 rounded-2xl p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-emerald-400" />
                    <h2 className="text-xl font-bold text-white">
                      Organiser Portal
                    </h2>
                  </div>
                  <button
                    onClick={closeAllModals}
                    className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>

                <form onSubmit={handleOrganiserLogin} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">
                      Email
                    </label>
                    <input
                      type="email"
                      value={organiserEmail}
                      onChange={(e) => setOrganiserEmail(e.target.value)}
                      className="w-full px-4 py-2.5 bg-black/30 border border-emerald-500/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
                      placeholder="organiser@ticketlelo.com"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">
                      Password
                    </label>
                    <input
                      type="password"
                      value={organiserPassword}
                      onChange={(e) => setOrganiserPassword(e.target.value)}
                      className="w-full px-4 py-2.5 bg-black/30 border border-emerald-500/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
                      placeholder="••••••••"
                      required
                    />
                  </div>

                  {error.organiser && (
                    <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                      {error.organiser}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading.organiser}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/50 text-black font-semibold py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-500/20"
                  >
                    {loading.organiser ? "Logging in..." : "Login"}
                  </button>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── User Sign In Modal ── */}
      <AnimatePresence>
        {showSignInModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeAllModals}
              className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed inset-0 flex items-center justify-center z-[201] p-4"
            >
              <div className="w-full max-w-md bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-emerald-500/20 rounded-2xl p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <User className="w-5 h-5 text-emerald-400" />
                    <h2 className="text-xl font-bold text-white">
                      {showForgotPassword ? "Reset Password" : "Sign In"}
                    </h2>
                  </div>
                  <button
                    onClick={closeAllModals}
                    className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>

                {!showForgotPassword ? (
                  <>
                    {/* Sign In Form */}
                    <form onSubmit={handleUserSignIn} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">
                          Email
                        </label>
                        <input
                          type="email"
                          value={userEmail}
                          onChange={(e) => setUserEmail(e.target.value)}
                          className="w-full px-4 py-2.5 bg-black/30 border border-emerald-500/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
                          placeholder="email@example.com"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">
                          Password
                        </label>
                        <input
                          type="password"
                          value={userPassword}
                          onChange={(e) => setUserPassword(e.target.value)}
                          className="w-full px-4 py-2.5 bg-black/30 border border-emerald-500/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
                          placeholder="Enter your password"
                          required
                        />
                        <p className="text-xs text-gray-400 mt-2">
                          You can only access after registering for an event.
                        </p>
                      </div>

                      {error.user && (
                        <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                          {error.user}
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={loading.user}
                        className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/50 text-black font-semibold py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-500/20"
                      >
                        {loading.user ? "Signing in..." : "Sign In"}
                      </button>

                      <div className="text-center space-y-2">
                        <p className="text-xs text-gray-400">
                          💡 Use the email and password you set during
                          registration.
                        </p>
                        <button
                          type="button"
                          onClick={() => setShowForgotPassword(true)}
                          className="text-sm text-emerald-400 hover:text-emerald-300 hover:underline transition-colors"
                        >
                          Forgot password? Reset it here
                        </button>
                      </div>
                    </form>
                  </>
                ) : (
                  <>
                    {/* Password Reset Form */}
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-4">
                      <p className="text-sm text-blue-400">
                        📧 Enter your email address and we'll send you a
                        password reset link.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">
                          Email Address
                        </label>
                        <input
                          type="email"
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                          className="w-full px-4 py-2.5 bg-black/30 border border-emerald-500/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
                          placeholder="your.email@example.com"
                          required
                        />
                      </div>

                      <button
                        onClick={handlePasswordReset}
                        disabled={loading.reset}
                        className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/50 text-black font-semibold py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                      >
                        {loading.reset ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Mail className="w-4 h-4" />
                            Send Reset Link
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => {
                          setShowForgotPassword(false);
                          setResetEmail("");
                        }}
                        className="w-full border border-slate-700 hover:bg-slate-800 text-slate-300 py-2.5 rounded-xl transition-colors"
                      >
                        Back to Sign In
                      </button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
