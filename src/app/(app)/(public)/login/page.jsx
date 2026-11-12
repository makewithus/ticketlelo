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
  Phone,
  KeyRound,
} from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useState, useEffect, useRef, Suspense } from "react";
import {
  getAuthErrorMessage,
  login,
  signup,
  loginWithGoogle,
  getRedirectPathForRole,
} from "@/lib/auth";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { BrandLoader } from "@/components/ui/brand-loader";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ui/theme-toggle";

function UnifiedLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user: currentUser, loading: authLoading, refreshUser } = useAuth();

  const redirectParam = searchParams.get("redirect") || "";
  const initialEmail = searchParams.get("email") || "";
  const initialName = searchParams.get("name") || "";
  const reasonParam = searchParams.get("reason") || "";
  const isSessionExpired = reasonParam === "session_expired";
  const initialMode = "signin"; // Manual registration disabled on login page

  const roleParam = searchParams.get("role") || "";
  const isOrganiserLogin = roleParam === "organiser" || redirectParam.includes("/admin");

  const [authMode, setAuthMode] = useState("signin"); // strictly "signin"
  const [fullName, setFullName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [redirectingRole, setRedirectingRole] = useState(null);
  const isNavigatingRef = useRef(false);

  // Forgot password OTP states
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotStep, setForgotStep] = useState("email"); // "email" | "code" | "password" | "success"
  const [forgotEmail, setForgotEmail] = useState(initialEmail);
  const [forgotCode, setForgotCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetToken, setResetToken] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  // Timer for resend cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // If already logged in, redirect automatically to the requested redirect path or role dashboard
  useEffect(() => {
    let isMounted = true;
    const activeUser = currentUser || (typeof window !== "undefined" ? auth.currentUser : null);
    if (!authLoading && activeUser && !isNavigatingRef.current) {
      const checkAndRedirect = async () => {
        isNavigatingRef.current = true;
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("ticketlelo_last_active", String(Date.now()));
          } catch (_) {}
        }
        let activeRole = currentUser?.role;

        // If role not yet resolved from claims, check email directly for instant redirection
        if (!activeRole) {
          const emailLower = (activeUser.email || "").toLowerCase().trim();
          if (emailLower === "adil4ticketlelo@gmail.com" || emailLower === "superadmin@ticketlelo.com") {
            activeRole = "superAdmin";
          } else {
            activeRole = "user";
          }
        }

        const requiresAdmin =
          redirectParam &&
          (redirectParam.startsWith("/admin") || redirectParam.startsWith("/superadmin"));
        const hasAccess = requiresAdmin
          ? activeRole === "organiser" || activeRole === "superAdmin"
          : true;

        let targetPath = getRedirectPathForRole(activeRole);
        if (
          hasAccess &&
          redirectParam &&
          redirectParam.startsWith("/") &&
          !redirectParam.startsWith("/login")
        ) {
          if (activeRole === "superAdmin") {
            targetPath = redirectParam.startsWith("/superadmin") ? redirectParam : "/superadmin";
          } else if (activeRole === "organiser") {
            if (
              redirectParam === "/dashboard" ||
              redirectParam === "/account" ||
              redirectParam === "/host-event" ||
              redirectParam === "/" ||
              redirectParam.startsWith("/(user)")
            ) {
              targetPath = "/admin/dashboard";
            } else {
              targetPath = redirectParam;
            }
          } else {
            targetPath = redirectParam;
          }
        }

        if (isMounted) {
          router.replace(targetPath);
        }
      };

      checkAndRedirect();
    }
    return () => {
      isMounted = false;
    };
  }, [currentUser, authLoading, router, redirectParam]);

  const handleAuthSuccess = (role, displayName) => {
    if (isNavigatingRef.current) return;
    isNavigatingRef.current = true;

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("ticketlelo_last_active", String(Date.now()));
      } catch (_) {}
    }

    setRedirectingRole(role);
    const requiresAdmin =
      redirectParam &&
      (redirectParam.startsWith("/admin") || redirectParam.startsWith("/superadmin"));
    const hasAccess = requiresAdmin
      ? role === "organiser" || role === "superAdmin"
      : true;

    let targetPath = getRedirectPathForRole(role);
    if (
      hasAccess &&
      redirectParam &&
      redirectParam.startsWith("/") &&
      !redirectParam.startsWith("/login")
    ) {
      if (role === "superAdmin") {
        targetPath = redirectParam.startsWith("/superadmin") ? redirectParam : "/superadmin";
      } else if (role === "organiser") {
        if (
          redirectParam === "/dashboard" ||
          redirectParam === "/account" ||
          redirectParam === "/host-event" ||
          redirectParam === "/" ||
          redirectParam.startsWith("/(user)")
        ) {
          targetPath = "/admin/dashboard";
        } else {
          targetPath = redirectParam;
        }
      } else {
        targetPath = redirectParam;
      }
    }

    if (redirectParam && redirectParam.startsWith("/") && targetPath === redirectParam) {
      toast.success(
        `Welcome${displayName ? `, ${displayName}` : ""}! Returning to your event request...`
      );
    } else if (role === "superAdmin") {
      toast.success(`Welcome Super Admin${displayName ? `, ${displayName}` : ""}! Accessing portal...`);
    } else if (role === "organiser") {
      toast.success(`Welcome back Organiser${displayName ? `, ${displayName}` : ""}! Opening dashboard...`);
    } else {
      toast.success(`Welcome${displayName ? `, ${displayName}` : ""}! Opening your tickets...`);
    }

    router.replace(targetPath);
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
      const freshUser = (await refreshUser?.()) || userData;
      const role = freshUser?.role || userData?.role || "user";
      handleAuthSuccess(role, freshUser?.fullName || userData?.fullName);
    } catch (err) {
      const errorMsg = getAuthErrorMessage(
        err,
        "Sign in failed. Please check your credentials."
      );
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (!fullName.trim()) {
        throw new Error("Please enter your full name");
      }
      if (!email.trim()) {
        throw new Error("Please enter your email address");
      }
      if (!password.trim()) {
        throw new Error("Please enter a password");
      }
      if (password.length < 6) {
        throw new Error("Password must be at least 6 characters");
      }

      const digitsPhone = phone.replace(/\D/g, "").slice(0, 10);
      const userData = await signup(email, password, fullName.trim(), digitsPhone, {
        hasSetPassword: true,
        isFirstTimeUser: false,
      });
      const role = userData?.role || "user";
      handleAuthSuccess(role, userData?.fullName || fullName);
    } catch (err) {
      const errorMsg = getAuthErrorMessage(
        err,
        "Sign up failed. Please check your details."
      );
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (googleLoading) return;

    // Check if user is ALREADY authenticated!
    const activeUser = currentUser || (typeof window !== "undefined" ? auth.currentUser : null);
    if (activeUser) {
      const emailLower = (activeUser.email || "").toLowerCase().trim();
      const isSuper =
        emailLower === "adil4ticketlelo@gmail.com" ||
        emailLower === "superadmin@ticketlelo.com";
      const role = isSuper ? "superAdmin" : currentUser?.role || "user";
      const fullName = currentUser?.fullName || activeUser.displayName;
      handleAuthSuccess(role, fullName);
      return;
    }

    setGoogleLoading(true);
    setError("");

    try {
      const userData = await loginWithGoogle();
      if (!userData) return;
      let role = userData?.role || "user";
      let fullName = userData?.fullName;
      try {
        const freshUser = await refreshUser?.();
        if (freshUser?.role) {
          role = freshUser.role;
          fullName = freshUser.fullName || fullName;
        }
      } catch (_) {}
      handleAuthSuccess(role, fullName);
    } catch (err) {
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
        "Google sign in failed. Please try again."
      );
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleOpenForgotPassword = () => {
    setForgotEmail(email || initialEmail);
    setForgotCode("");
    setNewPassword("");
    setConfirmPassword("");
    setResetToken("");
    setForgotError("");
    setForgotStep("email");
    setShowForgotPassword(true);
  };

  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    setForgotError("");

    const targetEmail = forgotEmail.trim().toLowerCase();
    if (!targetEmail || !targetEmail.includes("@")) {
      const err = "Please enter a valid email address";
      setForgotError(err);
      toast.error(err);
      return;
    }

    setForgotLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to send verification code");
      }

      toast.success(data.message || "Verification code sent to your email!");
      setForgotStep("code");
      setResendCooldown(60);
    } catch (err) {
      const msg = err?.message || "Failed to send verification code";
      setForgotError(msg);
      toast.error(msg);
    } finally {
      setForgotLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault();
    setForgotError("");

    const code = forgotCode.trim();
    if (!code || code.length !== 6) {
      const err = "Please enter the 6-digit verification code";
      setForgotError(err);
      toast.error(err);
      return;
    }

    setForgotLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: forgotEmail.trim().toLowerCase(),
          code,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Invalid verification code");
      }

      setResetToken(data.resetToken);
      setForgotStep("password");
      toast.success(data.message || "Code verified successfully!");
    } catch (err) {
      const msg = err?.message || "Invalid verification code";
      setForgotError(msg);
      toast.error(msg);
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e) => {
    if (e) e.preventDefault();
    setForgotError("");

    if (!newPassword || newPassword.length < 6) {
      const err = "Password must be at least 6 characters";
      setForgotError(err);
      toast.error(err);
      return;
    }
    if (newPassword !== confirmPassword) {
      const err = "Passwords do not match";
      setForgotError(err);
      toast.error(err);
      return;
    }

    setForgotLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: forgotEmail.trim().toLowerCase(),
          resetToken,
          newPassword,
          confirmPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update password");
      }

      setForgotStep("success");
      toast.success(data.message || "Password updated successfully!");
      setEmail(forgotEmail.trim().toLowerCase());
    } catch (err) {
      const msg = err?.message || "Failed to update password";
      setForgotError(msg);
      toast.error(msg);
    } finally {
      setForgotLoading(false);
    }
  };

  const handleFinishReset = () => {
    setShowForgotPassword(false);
    setAuthMode("signin");
    setEmail(forgotEmail.trim().toLowerCase());
    setPassword("");
    setForgotStep("email");
    setForgotCode("");
    setNewPassword("");
    setConfirmPassword("");
    setResetToken("");
    setForgotError("");
  };

  const isFromHostingPage = redirectParam.includes("/host-event");

  // Gate: If session is loading, user is already authenticated, or redirecting, show BrandLoader and do NOT render login form
  if (authLoading || currentUser || redirectingRole) {
    const loadingMessage =
      redirectingRole === "superAdmin"
        ? "Opening Super Admin Suite..."
        : redirectingRole === "organiser"
        ? "Opening Organiser Dashboard..."
        : redirectingRole === "user"
        ? "Opening your tickets..."
        : "Loading...";
    return <BrandLoader message={loadingMessage} fullScreen />;
  }

  return (
    <div className="min-h-screen relative flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-[#131517] text-[#FFFFFF] selection:bg-[#FE760B] selection:text-white">
      {/* Background Ambience: faint top glow per brand guidelines */}
      <div className="absolute top-0 inset-x-0 h-80 bg-gradient-to-b from-[#FE760B]/10 via-[#FE760B]/5 to-transparent pointer-events-none" />

      {/* Top Controls: Back Link & Theme Toggle */}
      <div className="absolute top-4 inset-x-4 sm:inset-x-8 flex items-center justify-between z-20">
        <Link
          href={isFromHostingPage ? "/host-event" : "/"}
          className="inline-flex items-center gap-2 text-[#9B9EA4] hover:text-[#FFFFFF] transition-colors group text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>{isFromHostingPage ? "Back to Event Form" : "Back to Home"}</span>
        </Link>
        <ThemeToggle inline />
      </div>

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-md mx-auto pt-8">
        {showForgotPassword ? (
          /* Multi-Step Password Reset Card with OTP Verification */
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-5 xs:p-6 sm:p-8 shadow-xl"
          >
            {/* Step progress pills */}
            <div className="flex items-center justify-center gap-1.5 xs:gap-2 mb-6">
              {[
                { key: "email", label: "1. Email" },
                { key: "code", label: "2. Verify Code" },
                { key: "password", label: "3. New Password" },
              ].map((step, idx) => {
                const isActive =
                  forgotStep === step.key ||
                  (forgotStep === "success" && idx === 2);
                const isPassed =
                  (forgotStep === "code" && idx === 0) ||
                  (forgotStep === "password" && idx <= 1) ||
                  forgotStep === "success";

                return (
                  <div
                    key={step.key}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                      isActive
                        ? "bg-[#FE760B]/15 text-[#FE760B] border border-[#FE760B]/30"
                        : isPassed
                        ? "bg-[#212327] text-white border border-[#2A2D31]"
                        : "bg-[#131517] text-[#9B9EA4] border border-[#2A2D31]"
                    }`}
                  >
                    <span>{step.label}</span>
                  </div>
                );
              })}
            </div>

            {/* Step 1: Request Verification Code */}
            {forgotStep === "email" && (
              <div>
                <div className="text-center mb-6">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#212327] border border-[#2A2D31] mb-3 text-[#FE760B]">
                    <Mail className="w-6 h-6" />
                  </div>
                  <h1 className="text-xl font-bold text-[#FFFFFF] tracking-tight">
                    Reset Password
                  </h1>
                  <p className="text-[#9B9EA4] text-xs mt-1">
                    Enter your account email to receive a 6-digit verification code.
                  </p>
                </div>

                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div>
                    <label
                      htmlFor="forgot-email"
                      className="block text-xs font-semibold text-[#D0D0D1] mb-1.5"
                    >
                      Account email
                    </label>
                    <input
                      id="forgot-email"
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="w-full px-4 py-2.5 bg-[#212327] border border-[#2A2D31] rounded-xl text-white placeholder-[#9B9EA4] focus:outline-none focus:border-[#FE760B] focus:ring-1 focus:ring-[#FE760B] transition-colors text-sm"
                      placeholder="Enter your email address"
                      autoFocus
                      required
                    />
                  </div>

                  {forgotError && (
                    <div className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-xl p-2.5 text-center">
                      {forgotError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="w-full bg-[#FE760B] hover:bg-[#FF8A2B] active:bg-[#FE760B] text-[#131517] font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm mt-2 shadow-none border-none disabled:opacity-60"
                  >
                    {forgotLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-[#131517]" />
                        <span>Sending Code...</span>
                      </>
                    ) : (
                      <span>Send Verification Code</span>
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
              </div>
            )}

            {/* Step 2: Enter 6-digit Code */}
            {forgotStep === "code" && (
              <div>
                <div className="text-center mb-6">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#212327] border border-[#2A2D31] mb-3 text-[#FE760B]">
                    <KeyRound className="w-6 h-6" />
                  </div>
                  <h1 className="text-xl font-bold text-[#FFFFFF] tracking-tight">
                    Enter Verification Code
                  </h1>
                  <p className="text-[#9B9EA4] text-xs mt-1">
                    We sent a 6-digit code to{" "}
                    <span className="text-white font-medium">{forgotEmail}</span>
                  </p>
                </div>

                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div>
                    <label
                      htmlFor="forgot-code"
                      className="block text-xs font-semibold text-[#D0D0D1] mb-1.5 text-center"
                    >
                      6-Digit Code
                    </label>
                    <input
                      id="forgot-code"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={forgotCode}
                      onChange={(e) =>
                        setForgotCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                      }
                      className="w-full text-center font-mono text-2xl tracking-[0.4em] py-3 bg-[#212327] border border-[#2A2D31] rounded-xl text-white placeholder-[#9B9EA4] focus:outline-none focus:border-[#FE760B] focus:ring-1 focus:ring-[#FE760B] transition-colors"
                      placeholder="••••••"
                      autoFocus
                      required
                    />
                  </div>

                  {forgotError && (
                    <div className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-xl p-2.5 text-center">
                      {forgotError}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-[#9B9EA4] px-1">
                    {resendCooldown > 0 ? (
                      <span>Resend code in {resendCooldown}s</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSendOtp()}
                        disabled={forgotLoading}
                        className="text-[#FE760B] hover:underline font-medium"
                      >
                        Resend code
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setForgotStep("email");
                        setForgotError("");
                      }}
                      className="hover:text-white transition-colors"
                    >
                      Change email
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={forgotLoading || forgotCode.trim().length !== 6}
                    className="w-full bg-[#FE760B] hover:bg-[#FF8A2B] active:bg-[#FE760B] text-[#131517] font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm mt-2 shadow-none border-none disabled:opacity-60"
                  >
                    {forgotLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-[#131517]" />
                        <span>Verifying Code...</span>
                      </>
                    ) : (
                      <span>Verify Code</span>
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
              </div>
            )}

            {/* Step 3: Enter New Password */}
            {forgotStep === "password" && (
              <div>
                <div className="text-center mb-6">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#212327] border border-[#2A2D31] mb-3 text-[#FE760B]">
                    <Lock className="w-6 h-6" />
                  </div>
                  <h1 className="text-xl font-bold text-[#FFFFFF] tracking-tight">
                    Set New Password
                  </h1>
                  <p className="text-[#9B9EA4] text-xs mt-1">
                    Verification successful. Choose a strong new password.
                  </p>
                </div>

                <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                  {/* New Password */}
                  <div>
                    <label
                      htmlFor="new-password"
                      className="block text-xs font-semibold text-[#D0D0D1] mb-1.5"
                    >
                      New password
                    </label>
                    <div className="relative">
                      <input
                        id="new-password"
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full pl-4 pr-11 py-2.5 bg-[#212327] border border-[#2A2D31] rounded-xl text-white placeholder-[#9B9EA4] focus:outline-none focus:border-[#FE760B] focus:ring-1 focus:ring-[#FE760B] transition-colors text-sm"
                        placeholder="••••••••"
                        autoFocus
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9B9EA4] hover:text-white transition-colors"
                        tabIndex={-1}
                      >
                        {showNewPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    <p className="text-[11px] text-[#9B9EA4] mt-1">
                      Must be at least 6 characters
                    </p>
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label
                      htmlFor="confirm-password"
                      className="block text-xs font-semibold text-[#D0D0D1] mb-1.5"
                    >
                      Confirm new password
                    </label>
                    <div className="relative">
                      <input
                        id="confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full pl-4 pr-11 py-2.5 bg-[#212327] border border-[#2A2D31] rounded-xl text-white placeholder-[#9B9EA4] focus:outline-none focus:border-[#FE760B] focus:ring-1 focus:ring-[#FE760B] transition-colors text-sm"
                        placeholder="••••••••"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9B9EA4] hover:text-white transition-colors"
                        tabIndex={-1}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {forgotError && (
                    <div className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-xl p-2.5 text-center">
                      {forgotError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="w-full bg-[#FE760B] hover:bg-[#FF8A2B] active:bg-[#FE760B] text-[#131517] font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm mt-2 shadow-none border-none disabled:opacity-60"
                  >
                    {forgotLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-[#131517]" />
                        <span>Updating Password...</span>
                      </>
                    ) : (
                      <span>Update Password</span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(false)}
                    className="w-full text-[#9B9EA4] hover:text-[#FFFFFF] transition-colors text-xs text-center py-2"
                  >
                    Cancel
                  </button>
                </form>
              </div>
            )}

            {/* Step 4: Success confirmation */}
            {forgotStep === "success" && (
              <div className="text-center py-2">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#3DD68C]/15 border border-[#3DD68C]/30 mb-4 text-[#3DD68C]">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h1 className="text-xl font-bold text-[#FFFFFF] tracking-tight mb-2">
                  Password Updated!
                </h1>
                <p className="text-[#9B9EA4] text-xs leading-relaxed mb-6">
                  Your password has been successfully updated. You can now sign in to TicketLelo with your new password.
                </p>

                <button
                  type="button"
                  onClick={handleFinishReset}
                  className="w-full bg-[#FE760B] hover:bg-[#FF8A2B] active:bg-[#FE760B] text-[#131517] font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm shadow-none border-none"
                >
                  Sign In Now
                </button>
              </div>
            )}
          </motion.div>
        ) : (
          /* Main Unified Login / Signup Card */
          <div className="flex flex-col items-center">
            {/* Logo at top */}
            <div className="flex justify-center mb-6">
              <img
                src="/logo/ticketlelo-logo-full.png"
                alt="TicketLelo"
                className="h-16 w-auto max-w-[260px] object-contain"
              />
            </div>

            {/* Header text outside card */}
            <div className="text-center mb-5">
              {isOrganiserLogin ? (
                <>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FE760B]/10 border border-[#FE760B]/25 text-[#FE760B] text-xs font-semibold mb-2.5">
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Organiser Portal</span>
                  </div>
                  <h1 className="text-3xl font-extrabold text-[#FFFFFF] tracking-tight">
                    Organiser Sign In
                  </h1>
                  <p className="text-[#9B9EA4] text-sm mt-1.5">
                    Sign in with your approved organiser account to manage and create events.
                  </p>
                </>
              ) : (
                <>
                  <h1 className="text-3xl font-extrabold text-[#FFFFFF] tracking-tight">
                    {isFromHostingPage
                      ? "Sign in to submit request"
                      : "Welcome back"}
                  </h1>
                  <p className="text-[#9B9EA4] text-sm mt-1.5">
                    {isFromHostingPage
                      ? "Sign in below. Your form details are safely saved."
                      : "Sign in to see your tickets and host events."}
                  </p>
                </>
              )}
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
                  {googleLoading
                    ? "Connecting to Google..."
                    : authMode === "signup"
                    ? "Sign up with Google"
                    : "Continue with Google"}
                </span>
              </button>

              {/* Divider */}
              <div className="relative mb-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#2A2D31]" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-[#1A1C1F] px-3 text-[#9B9EA4] font-medium">
                    or with email
                  </span>
                </div>
              </div>

              {/* FORM: Sign in or Sign up */}
              <form
                onSubmit={authMode === "signup" ? handleSignup : handleLogin}
                className="space-y-4"
              >
                {/* Full Name for Sign Up */}
                {authMode === "signup" && (
                  <div>
                    <label
                      htmlFor="signup-name"
                      className="block text-xs font-semibold text-[#D0D0D1] mb-1.5"
                    >
                      Full name
                    </label>
                    <input
                      id="signup-name"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full px-4 py-2.5 bg-[#131517] border border-[#2A2D31] rounded-xl text-white placeholder-[#5E626B] focus:outline-none focus:border-[#FE760B] focus:ring-1 focus:ring-[#FE760B] transition-colors text-sm"
                      placeholder="John Doe"
                      autoComplete="name"
                      required
                    />
                  </div>
                )}

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
                    className="w-full px-4 py-2.5 bg-[#131517] border border-[#2A2D31] rounded-xl text-white placeholder-[#5E626B] focus:outline-none focus:border-[#FE760B] focus:ring-1 focus:ring-[#FE760B] transition-colors text-sm"
                    placeholder="Enter your email address"
                    autoComplete="email"
                    required
                  />
                </div>

                {/* Optional Phone for Sign Up */}
                {authMode === "signup" && (
                  <div>
                    <label
                      htmlFor="signup-phone"
                      className="block text-xs font-semibold text-[#D0D0D1] mb-1.5"
                    >
                      Phone number (optional)
                    </label>
                    <div className="flex rounded-xl bg-[#131517] border border-[#2A2D31] overflow-hidden focus-within:border-[#FE760B] focus-within:ring-1 focus-within:ring-[#FE760B]">
                      <span className="inline-flex items-center px-3 text-xs font-semibold text-[#9B9EA4] bg-[#1A1C1F] border-r border-[#2A2D31] select-none">
                        +91
                      </span>
                      <input
                        id="signup-phone"
                        type="tel"
                        inputMode="numeric"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                        className="w-full px-3.5 py-2.5 bg-transparent text-sm text-white placeholder-[#5E626B] focus:outline-none"
                        placeholder="Enter 10-digit mobile number"
                        maxLength={10}
                      />
                    </div>
                  </div>
                )}

                {/* Password */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="login-password"
                      className="block text-xs font-semibold text-[#D0D0D1]"
                    >
                      Password
                    </label>
                    {authMode === "signin" && (
                      <button
                        type="button"
                        onClick={handleOpenForgotPassword}
                        className="text-xs text-[#9B9EA4] hover:text-[#FE760B] hover:underline transition-colors cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-4 pr-11 py-2.5 bg-[#131517] border border-[#2A2D31] rounded-xl text-white placeholder-[#5E626B] focus:outline-none focus:border-[#FE760B] focus:ring-1 focus:ring-[#FE760B] transition-colors text-sm"
                      placeholder="••••••••"
                      autoComplete={authMode === "signup" ? "new-password" : "current-password"}
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
                  {authMode === "signup" && (
                    <p className="text-[11px] text-[#9B9EA4] mt-1">
                      Must be at least 6 characters
                    </p>
                  )}
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
                    <span>
                      {redirectParam
                        ? "Authentication successful. Returning to your form..."
                        : `Authenticated as ${redirectingRole}. Redirecting...`}
                    </span>
                  </motion.div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading || googleLoading || !!redirectingRole}
                  className="w-full bg-white hover:bg-slate-100 disabled:opacity-50 text-black font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm mt-3 shadow-sm"
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

            {/* Footer Links */}
            <div className="mt-8 text-center space-y-2">
              <p className="text-xs text-[#9B9EA4]">
                Attending an event? Access your tickets using the link sent to your registered email.
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

export default function UnifiedLoginPage() {
  return (
    <Suspense fallback={<BrandLoader message="Loading..." fullScreen />}>
      <UnifiedLoginContent />
    </Suspense>
  );
}
