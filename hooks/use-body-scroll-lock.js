"use client";

import { useEffect } from "react";

let activeModalCount = 0;
let previousOverflow = "";
let previousTouchAction = "";

export function lockBodyScroll() {
  if (typeof document === "undefined") return;
  if (activeModalCount === 0) {
    previousOverflow = document.body.style.overflow;
    previousTouchAction = document.body.style.touchAction;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    document.documentElement.style.overflow = "hidden";
    document.body.classList.add("modal-open");
  }
  activeModalCount++;
}

export function unlockBodyScroll() {
  if (typeof document === "undefined") return;
  activeModalCount = Math.max(0, activeModalCount - 1);
  if (activeModalCount === 0) {
    document.body.style.overflow = previousOverflow || "";
    document.body.style.touchAction = previousTouchAction || "";
    document.documentElement.style.overflow = "";
    document.body.classList.remove("modal-open");
  }
}

export function useBodyScrollLock(isLocked = true) {
  useEffect(() => {
    if (!isLocked) return;
    lockBodyScroll();
    return () => {
      unlockBodyScroll();
    };
  }, [isLocked]);
}
