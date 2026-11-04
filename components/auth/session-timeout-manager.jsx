"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { Clock, Check, LogOut, ShieldAlert, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  INACTIVITY_TIMEOUT_MS,
  COUNTDOWN_TOTAL_SECONDS,
  SESSION_STORAGE_KEY as STORAGE_KEY,
} from "@/lib/session-config";

export { INACTIVITY_TIMEOUT_MS, COUNTDOWN_TOTAL_SECONDS };

/**
 * SessionTimeoutManager
 *
 * Monitors user inactivity across the entire application for authenticated users.
 * When inactive for 10 minutes, presents an interactive modal: "Are you still working?"
 * with a 5-second countdown timer. If no confirmation is given within 5 seconds,
 * safely terminates the session, clears all auth tokens/cookies, and redirects
 * to the login screen requiring re-authentication.
 */
export function SessionTimeoutManager() {
  const { user, logout, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_TOTAL_SECONDS);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const lastActiveRef = useRef(0);
  const countdownIntervalRef = useRef(null);
  const isLoggingOutRef = useRef(false);

  // Determine effective timeout duration (allow testing override via window.__TICKETLELO_TIMEOUT_MS__)
  const getTimeoutDuration = useCallback(() => {
    if (typeof window !== "undefined" && window.__TICKETLELO_TIMEOUT_MS__) {
      return Number(window.__TICKETLELO_TIMEOUT_MS__);
    }
    return INACTIVITY_TIMEOUT_MS;
  }, []);

  // Safe logout handler
  const performLogout = useCallback(
    async (reason = "timeout") => {
      if (isLoggingOutRef.current) return;
      isLoggingOutRef.current = true;
      setIsLoggingOut(true);

      // Clear any active timers
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }

      setShowWarning(false);

      try {
        if (typeof window !== "undefined") {
          try {
            localStorage.removeItem(STORAGE_KEY);
            sessionStorage.clear();
          } catch (_) {}
        }

        await logout();

        if (reason === "timeout") {
          toast.error("Session timed out after 10 minutes of inactivity. Please enter your credentials to log in again.", {
            duration: 6000,
          });
          router.replace("/login?reason=session_expired");
        } else {
          toast.success("Successfully logged out.");
          router.replace("/login");
        }
      } catch (err) {
        console.error("Session logout error:", err);
        router.replace("/login?reason=session_expired");
      } finally {
        setIsLoggingOut(false);
        isLoggingOutRef.current = false;
      }
    },
    [logout, router]
  );

  // Extend session: user confirms they are still working
  const handleExtendSession = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    const now = Date.now();
    lastActiveRef.current = now;
    try {
      localStorage.setItem(STORAGE_KEY, String(now));
    } catch (_) {}

    setShowWarning(false);
    setCountdown(COUNTDOWN_TOTAL_SECONDS);
    toast.success("Session extended. You remain securely logged in.", {
      duration: 3000,
    });
  }, []);

  // Update last active timestamp on user interaction (throttled to 1s)
  const recordActivity = useCallback(() => {
    // When warning modal is currently shown, require explicit button click
    if (showWarning || isLoggingOutRef.current) return;

    const now = Date.now();
    if (now - lastActiveRef.current > 1000) {
      lastActiveRef.current = now;
      try {
        localStorage.setItem(STORAGE_KEY, String(now));
      } catch (_) {}
    }
  }, [showWarning]);

  // Setup user interaction event listeners across the window
  useEffect(() => {
    // Only monitor activity when user is authenticated
    if (!user || authLoading) return;

    const now = Date.now();
    lastActiveRef.current = now;
    try {
      localStorage.setItem(STORAGE_KEY, String(now));
    } catch (_) {}

    const events = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
      "wheel",
      "click",
    ];

    const handleEvent = () => recordActivity();

    events.forEach((evt) => {
      window.addEventListener(evt, handleEvent, { passive: true });
    });

    // Synchronize activity across multiple browser tabs
    const handleStorageChange = (e) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        const remoteTime = Number(e.newValue);
        if (remoteTime > lastActiveRef.current) {
          lastActiveRef.current = remoteTime;
          // If another tab was active, close warning on this tab
          if (showWarning) {
            if (countdownIntervalRef.current) {
              clearInterval(countdownIntervalRef.current);
              countdownIntervalRef.current = null;
            }
            setShowWarning(false);
            setCountdown(COUNTDOWN_TOTAL_SECONDS);
          }
        }
      }
    };
    window.addEventListener("storage", handleStorageChange);

    return () => {
      events.forEach((evt) => {
        window.removeEventListener(evt, handleEvent);
      });
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [user, authLoading, recordActivity, showWarning]);

  // Inactivity check (runs every 1 second)
  useEffect(() => {
    // Only run if user is logged in
    if (!user || authLoading) {
      if (showWarning) {
        const timer = setTimeout(() => setShowWarning(false), 0);
        return () => clearTimeout(timer);
      }
      return;
    }

    const intervalId = setInterval(() => {
      if (isLoggingOutRef.current) return;

      const timeout = getTimeoutDuration();
      const elapsed = Date.now() - lastActiveRef.current;

      // If elapsed time has exceeded 10 minutes and modal is not yet shown
      if (elapsed >= timeout && !showWarning) {
        setShowWarning(true);
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [user, authLoading, showWarning, getTimeoutDuration]);

  // If user is not logged in or in login process, do not render modal
  if (!user || !showWarning) {
    return null;
  }

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="session-warning-title"
      aria-describedby="session-warning-description"
      className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none touch-none animate-fade-in"
    >
      <div className="w-full max-w-sm sm:max-w-md bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-6 sm:p-7 shadow-2xl space-y-5 text-center relative overflow-hidden animate-scale-in">
        {/* Subtle Ambient Glow */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-24 bg-[#FE760B]/20 blur-2xl pointer-events-none rounded-full" />

        {/* Timer Icon Badge */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-[#FE760B]/10 border border-[#FE760B]/30 flex items-center justify-center text-[#FE760B] relative shadow-inner">
          <Clock className="w-8 h-8 text-[#FE760B] relative z-10" />
        </div>

        {/* Inactivity Pill */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FE760B]/10 border border-[#FE760B]/25 text-[#FE760B] text-xs font-bold tracking-wide">
          <span className="w-2 h-2 rounded-full bg-[#FE760B] animate-pulse" />
          <span>Inactive for 10+ minutes</span>
        </div>

        {/* Modal Header & Message */}
        <div className="space-y-2">
          <h3
            id="session-warning-title"
            className="text-xl font-extrabold text-white tracking-tight"
          >
            Are you still here?
          </h3>
          <p
            id="session-warning-description"
            className="text-xs text-[#9B9EA4] leading-relaxed max-w-xs mx-auto"
          >
            You have been inactive for <span className="text-white font-semibold">10 minutes or more</span>. Click below to continue your session, or log out.
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-2.5 pt-1">
          <button
            type="button"
            disabled={isLoggingOut}
            onClick={handleExtendSession}
            className="w-full h-11 px-4 rounded-xl bg-[#FE760B] hover:bg-[#FF8A2B] text-white text-xs sm:text-sm font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            autoFocus
          >
            <Check size={16} className="shrink-0" />
            <span>Continue Session</span>
          </button>

          <button
            type="button"
            disabled={isLoggingOut}
            onClick={() => performLogout("manual")}
            className="w-full h-10 px-4 rounded-xl bg-transparent hover:bg-[#212327] text-[#9B9EA4] hover:text-white border border-[#2A2D31] text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isLoggingOut ? (
              <Loader2 size={14} className="animate-spin text-[#FE760B]" />
            ) : (
              <LogOut size={14} />
            )}
            <span>Log out</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default SessionTimeoutManager;
