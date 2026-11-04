"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { Clock, Check, LogOut, Loader2, AlertTriangle } from "lucide-react";
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
 * Enforces strict security constraints:
 * 1. 10 minutes of idle inactivity -> triggers warning modal.
 * 2. 5 seconds countdown while warning modal is open -> live visual timer.
 * 3. If no confirmation response within 5 seconds -> automatically logs out,
 *    destroys session/tokens/storage, and redirects to /login?reason=session_expired.
 * 4. Never gets stuck on the modal: if user returns after the 5s window has elapsed,
 *    or if the tab was backgrounded/asleep, immediately terminates session without
 *    permitting session extension.
 */
export function SessionTimeoutManager() {
  const { user, logout, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_TOTAL_SECONDS);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const lastActiveRef = useRef(0);
  const warningStartTimeRef = useRef(0);
  const countdownIntervalRef = useRef(null);
  const isLoggingOutRef = useRef(false);

  // Determine effective timeout duration (allow testing override via window.__TICKETLELO_TIMEOUT_MS__)
  const getTimeoutDuration = useCallback(() => {
    if (typeof window !== "undefined" && window.__TICKETLELO_TIMEOUT_MS__) {
      return Number(window.__TICKETLELO_TIMEOUT_MS__);
    }
    return INACTIVITY_TIMEOUT_MS;
  }, []);

  // Determine effective countdown duration (allow testing override via window.__TICKETLELO_COUNTDOWN_SECONDS__)
  const getCountdownDuration = useCallback(() => {
    if (typeof window !== "undefined" && window.__TICKETLELO_COUNTDOWN_SECONDS__) {
      return Number(window.__TICKETLELO_COUNTDOWN_SECONDS__);
    }
    return COUNTDOWN_TOTAL_SECONDS;
  }, []);

  // Safe authoritative logout handler
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
      warningStartTimeRef.current = 0;

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
    if (isLoggingOutRef.current) return;

    // Security Verification: If the warning window has already expired (e.g. user delayed clicking or tab woke up),
    // strictly deny extension and log out immediately!
    const countdownLimitMs = getCountdownDuration() * 1000;
    const warningElapsed = warningStartTimeRef.current ? Date.now() - warningStartTimeRef.current : 0;
    if (warningElapsed >= countdownLimitMs) {
      performLogout("timeout");
      return;
    }

    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    const now = Date.now();
    lastActiveRef.current = now;
    warningStartTimeRef.current = 0;
    try {
      localStorage.setItem(STORAGE_KEY, String(now));
    } catch (_) {}

    setShowWarning(false);
    setCountdown(getCountdownDuration());
    toast.success("Session extended. You remain securely logged in.", {
      duration: 3000,
    });
  }, [performLogout, getCountdownDuration]);

  // Update last active timestamp on user interaction (throttled to 1s)
  const recordActivity = useCallback(() => {
    // When warning modal is currently shown or logging out, do not reset automatically on passive mouse movements
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
            warningStartTimeRef.current = 0;
            setCountdown(getCountdownDuration());
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
  }, [user, authLoading, recordActivity, showWarning, getCountdownDuration]);

  // Active countdown timer effect when warning modal is displayed
  useEffect(() => {
    if (!showWarning || !user || isLoggingOutRef.current) {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      return;
    }

    const totalSeconds = getCountdownDuration();
    const startTime = Date.now();
    warningStartTimeRef.current = startTime;
    setCountdown(totalSeconds);

    countdownIntervalRef.current = setInterval(() => {
      if (isLoggingOutRef.current) {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
        return;
      }

      const elapsedMs = Date.now() - warningStartTimeRef.current;
      const secondsLeft = Math.max(0, Math.ceil((totalSeconds * 1000 - elapsedMs) / 1000));

      setCountdown(secondsLeft);

      // Auto-logout triggered: 5 seconds of inactivity on warning modal elapsed with no response!
      if (secondsLeft <= 0 || elapsedMs >= totalSeconds * 1000) {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
        performLogout("timeout");
      }
    }, 250);

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [showWarning, user, performLogout, getCountdownDuration]);

  // Primary Inactivity check (runs every 500ms)
  useEffect(() => {
    if (!user || authLoading) {
      if (showWarning) {
        setShowWarning(false);
      }
      return;
    }

    const intervalId = setInterval(() => {
      if (isLoggingOutRef.current) return;

      const timeout = getTimeoutDuration();
      const countdownMs = getCountdownDuration() * 1000;
      const now = Date.now();
      const elapsed = now - lastActiveRef.current;

      // If user was away/asleep for longer than 10 mins + 5 seconds, do NOT leave modal open;
      // immediately execute auto-logout so nobody can bypass by later clicking continue!
      if (elapsed >= timeout + countdownMs) {
        performLogout("timeout");
        return;
      }

      // If elapsed has reached 10 minutes and warning modal is not yet active
      if (elapsed >= timeout && !showWarning) {
        setShowWarning(true);
      }
    }, 500);

    return () => clearInterval(intervalId);
  }, [user, authLoading, showWarning, getTimeoutDuration, getCountdownDuration, performLogout]);

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
      className="fixed inset-0 z-[99999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none touch-none animate-fade-in"
    >
      <div className="w-full max-w-sm sm:max-w-md bg-[#1A1C1F] border border-[#2A2D31] rounded-2xl p-6 sm:p-7 shadow-2xl space-y-5 text-center relative overflow-hidden animate-scale-in">
        {/* Subtle Ambient Glow */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-24 bg-red-500/20 blur-2xl pointer-events-none rounded-full" />

        {/* Timer Icon Badge */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 relative shadow-inner">
          <Clock className="w-8 h-8 text-red-400 relative z-10 animate-pulse" />
        </div>

        {/* Inactivity Pill */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold tracking-wide">
          <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
          <span>Session Inactivity Timeout</span>
        </div>

        {/* Modal Header & Message */}
        <div className="space-y-2">
          <h3
            id="session-warning-title"
            className="text-xl font-extrabold text-white tracking-tight"
          >
            Are you still working?
          </h3>
          <p
            id="session-warning-description"
            className="text-xs text-[#9B9EA4] leading-relaxed max-w-xs mx-auto"
          >
            You have been inactive for <span className="text-white font-semibold">10 minutes</span>. To protect your data, your session will automatically log out:
          </p>

          {/* ── 5-Second Live Countdown Display ── */}
          <div className="pt-2 pb-1">
            <div className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-red-500/15 border border-red-500/40 text-red-400 shadow-md shadow-red-950/40">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
              </span>
              <span className="text-sm font-black tracking-wider uppercase font-mono">
                Auto-logging out in {countdown}s
              </span>
            </div>
          </div>
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
            <span>Continue Session ({countdown}s)</span>
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
            <span>Log out now</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default SessionTimeoutManager;
