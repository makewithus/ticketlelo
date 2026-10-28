"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { usePathname } from "next/navigation";

export function ThemeToggle({ className = "", inline = false, compact = false }) {
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  if (!mounted) return null;
  const normalizedPath = pathname.replace(/\/+$/, "") || "/";
  if (normalizedPath === "/" && !inline) return null;
  if (normalizedPath === "/host-event" && !inline) return null;
  if (/^\/(organiser-login|user-login|super-admin-login)$/.test(normalizedPath)) {
    return null;
  }
  if (!inline && (normalizedPath.startsWith("/register") || normalizedPath.startsWith("/embed"))) {
    return null;
  }
  const isDark = theme === "dark";
  const belowHeader = pathname === "/dashboard" || pathname === "/host-event";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
      className={`${inline ? "relative z-10" : `fixed right-4 z-[90] ${belowHeader ? "top-20" : "top-4"} shadow-xl`} inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700/60 bg-slate-900/90 backdrop-blur-md px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 hover:text-white dark:border-slate-700/60 dark:bg-slate-900/90 dark:text-slate-200 ${compact ? "h-9 w-9 min-h-9 px-0 [&>span]:sr-only" : ""} ${className}`}
    >
      {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-blue-400" />}
      <span>{isDark ? "Light Mode" : "Dark Mode"}</span>
    </button>
  );
}
