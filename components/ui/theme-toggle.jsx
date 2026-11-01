"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle({ className = "", inline = true, compact = false }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className={`h-8 px-3 rounded-full bg-[#1A1C1F] border border-[#2A2D31] opacity-60 inline-flex items-center gap-1.5 text-xs text-[#9B9EA4] ${className}`}>
        <Sun className="h-3.5 w-3.5 text-amber-400" />
        <span>Theme</span>
      </div>
    );
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
      className={`inline-flex items-center justify-center gap-1.5 rounded-full border border-[#2A2D31] bg-[#1A1C1F] px-2.5 xs:px-3 py-1.5 text-xs font-semibold text-[#061A3F] dark:text-[#D0D0D1] transition-colors hover:text-[#FE760B] hover:bg-[#212327] cursor-pointer ${compact ? "h-8 w-8 px-0" : "h-8"} ${className}`}
    >
      {isDark ? (
        <Sun className="h-3.5 w-3.5 text-amber-500 shrink-0" />
      ) : (
        <Moon className="h-3.5 w-3.5 text-blue-500 shrink-0" />
      )}
      {!compact && (
        <span className="hidden xs:inline">
          {isDark ? "Light Mode" : "Dark Mode"}
        </span>
      )}
    </button>
  );
}
