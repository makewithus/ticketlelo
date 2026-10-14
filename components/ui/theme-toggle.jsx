"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { usePathname } from "next/navigation";

export function ThemeToggle({ className = "" }) {
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;
  const isDark = theme === "dark";
  const belowHeader = pathname === "/dashboard" || pathname === "/host-event";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[var(--tl-line)] bg-[var(--tl-paper)] px-3 text-sm font-semibold text-[#061a3f] transition hover:bg-[#3157ff]/10 dark:text-slate-100 ${belowHeader ? "top-20" : "top-4"} ${className}`}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      <span>{isDark ? "Light Mode" : "Dark Mode"}</span>
    </button>
  );
}
