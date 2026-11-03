"use client";

import { useEffect } from "react";
import { lockBodyScroll, unlockBodyScroll } from "@/hooks/use-body-scroll-lock";

/**
 * Global observer that detects any modal overlays mounted in the DOM
 * (e.g., role="dialog", .fixed.inset-0.z-50, [data-modal], etc.)
 * and locks the background scroll so mobile & desktop cannot scroll behind the modal.
 */
export function ModalScrollLockProvider() {
  useEffect(() => {
    if (typeof window === "undefined" || !window.MutationObserver) return;

    let isCurrentlyLocked = false;

    function isModalOverlay(el) {
      if (!el || el.nodeType !== 1) return false;
      const role = el.getAttribute?.("role");
      if (role === "dialog" || role === "alertdialog") return true;
      if (el.hasAttribute?.("data-modal")) return true;

      const className = String(el.className || "");
      // Check for fixed inset-0 with high z-index (modal backdrop)
      if (
        className.includes("fixed") &&
        className.includes("inset-0") &&
        (className.includes("z-50") ||
          className.includes("z-[50") ||
          className.includes("z-[100") ||
          className.includes("z-[150") ||
          className.includes("z-[200") ||
          className.includes("backdrop-blur"))
      ) {
        // Exclude passive non-interactive backgrounds like particle canvas
        if (className.includes("pointer-events-none")) return false;
        return true;
      }

      return false;
    }

    function checkModals() {
      const candidates = document.querySelectorAll(
        '[role="dialog"], [role="alertdialog"], [data-modal], .fixed.inset-0'
      );
      let foundActive = false;
      for (const el of candidates) {
        if (isModalOverlay(el)) {
          // Verify it's actually visible in DOM
          const style = window.getComputedStyle(el);
          if (style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0") {
            foundActive = true;
            break;
          }
        }
      }

      if (foundActive && !isCurrentlyLocked) {
        lockBodyScroll();
        isCurrentlyLocked = true;
      } else if (!foundActive && isCurrentlyLocked) {
        unlockBodyScroll();
        isCurrentlyLocked = false;
      }
    }

    const observer = new MutationObserver(() => {
      checkModals();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class", "hidden"],
    });

    // Initial check
    checkModals();

    return () => {
      observer.disconnect();
      if (isCurrentlyLocked) {
        unlockBodyScroll();
      }
    };
  }, []);

  return null;
}
