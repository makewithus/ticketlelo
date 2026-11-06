"use client";

import { useEffect } from "react";
import { toast, useSonner } from "sonner";

/**
 * isValidContent: Checks whether a candidate message or option provides
 * meaningful, readable content. Returns false for null, undefined,
 * empty strings, whitespace-only strings, or empty/meaningless objects.
 */
function isValidContent(val) {
  if (val === null || val === undefined) return false;
  if (typeof val === "string") return val.trim().length > 0;
  if (typeof val === "number" || typeof val === "boolean") return true;
  if (typeof val === "function") return true;
  if (typeof val === "object") {
    if (val instanceof Error) return Boolean(val.message && val.message.trim());
    if (typeof val.title === "string" && val.title.trim()) return true;
    if (typeof val.message === "string" && val.message.trim()) return true;
    if (typeof val.description === "string" && val.description.trim()) return true;
    if (typeof val.error === "string" && val.error.trim()) return true;
    // React element (JSX)
    if (val.$$typeof || val._owner || val.type) return true;
  }
  return false;
}

function sanitize(msg, defaultFallback = null) {
  if (msg instanceof Error) {
    return msg.message && msg.message.trim() ? msg.message.trim() : defaultFallback;
  }
  if (typeof msg === "object" && msg !== null && !msg.$$typeof) {
    if (typeof msg.title === "string" && msg.title.trim()) return msg.title.trim();
    if (typeof msg.message === "string" && msg.message.trim()) return msg.message.trim();
    if (typeof msg.description === "string" && msg.description.trim()) return msg.description.trim();
    if (typeof msg.error === "string" && msg.error.trim()) return msg.error.trim();
    return defaultFallback;
  }
  if (typeof msg === "string") {
    const trimmed = msg.trim();
    return trimmed.length > 0 ? trimmed : defaultFallback;
  }
  return isValidContent(msg) ? msg : defaultFallback;
}

/**
 * Global patching logic executed at module load time on client
 */
function patchSonner() {
  if (typeof window === "undefined" || !toast) return;
  if (window.__TL_TOAST_GUARD_ACTIVE__) return;
  window.__TL_TOAST_GUARD_ACTIVE__ = true;

  // Intercept toast.error
  const origError = toast.error?.bind(toast);
  if (origError) {
    toast.error = (message, options) => {
      const clean = sanitize(message, "An unexpected error occurred. Please try again.");
      if (!clean) return null;
      return origError(clean, options);
    };
  }

  // Intercept toast.success, toast.info, toast.warning, toast.loading, toast.message
  const wrapSilent = (origFn) => {
    if (!origFn) return () => null;
    return (message, options) => {
      const clean = sanitize(message, null);
      if (!clean) return null;
      return origFn(clean, options);
    };
  };

  if (toast.success) toast.success = wrapSilent(toast.success?.bind(toast));
  if (toast.info) toast.info = wrapSilent(toast.info?.bind(toast));
  if (toast.warning) toast.warning = wrapSilent(toast.warning?.bind(toast));
  if (toast.loading) toast.loading = wrapSilent(toast.loading?.bind(toast));
  if (toast.message) toast.message = wrapSilent(toast.message?.bind(toast));

  // Intercept toast.custom
  const origCustom = toast.custom?.bind(toast);
  if (origCustom) {
    toast.custom = (jsxFn, options) => {
      if (typeof jsxFn !== "function" && !jsxFn) return null;
      return origCustom(jsxFn, options);
    };
  }
}

// Execute immediately when imported on client
if (typeof window !== "undefined") {
  patchSonner();
}

/**
 * ToastGuard: Global safety component preventing empty, null, or undefined
 * toast messages from displaying across TicketLelo.
 */
export function ToastGuard() {
  const { toasts } = useSonner();

  // Ensure patch is active upon mount
  useEffect(() => {
    patchSonner();
  }, []);

  // Watch for any active toast created by any means and dismiss empty ones
  useEffect(() => {
    if (!toasts || !Array.isArray(toasts)) return;
    toasts.forEach((t) => {
      const hasJsx = Boolean(t.jsx);
      const title = typeof t.title === "string" ? t.title.trim() : t.title;
      const desc = typeof t.description === "string" ? t.description.trim() : t.description;
      const hasTitle = isValidContent(title);
      const hasDesc = isValidContent(desc);

      if (!hasJsx && !hasTitle && !hasDesc) {
        toast.dismiss(t.id);
      }
    });
  }, [toasts]);

  // DOM MutationObserver to instantly strip empty toast nodes from layout
  useEffect(() => {
    if (typeof window === "undefined" || !window.MutationObserver) return;

    const cleanupEmptyNode = (node) => {
      if (!node || node.nodeType !== 1) return;
      const toastEl = node.matches?.("[data-sonner-toast]")
        ? node
        : node.querySelector?.("[data-sonner-toast]");
      if (!toastEl) return;

      const isNonFrontCollapsed =
        toastEl.getAttribute("data-front") === "false" &&
        toastEl.getAttribute("data-expanded") === "false";

      const hasCustom =
        toastEl.hasAttribute("data-custom") ||
        Boolean(toastEl.querySelector("[data-custom]"));
      const titleEl = toastEl.querySelector("[data-title]");
      const descEl = toastEl.querySelector("[data-description]");
      const text = (
        (titleEl?.textContent || "") +
        (descEl?.textContent || "") +
        (toastEl.querySelector("[data-content]")?.textContent || "")
      ).trim();

      if (isNonFrontCollapsed || (!hasCustom && !text)) {
        toastEl.setAttribute("data-empty-toast", "true");
        toastEl.style.setProperty("display", "none", "important");
        toastEl.style.setProperty("visibility", "hidden", "important");
        toastEl.style.setProperty("opacity", "0", "important");
        toastEl.style.setProperty("height", "0", "important");
        toastEl.style.setProperty("min-height", "0", "important");
        toastEl.style.setProperty("max-height", "0", "important");
        toastEl.style.setProperty("padding", "0", "important");
        toastEl.style.setProperty("margin", "0", "important");
        toastEl.style.setProperty("border", "none", "important");
        toastEl.style.setProperty("pointer-events", "none", "important");
      }
    };

    const cleanupAll = () => {
      try {
        const list = document.querySelectorAll("[data-sonner-toast]");
        list.forEach((el) => cleanupEmptyNode(el));
      } catch {
        // Safe no-op
      }
    };

    cleanupAll();

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "attributes") {
          cleanupEmptyNode(mutation.target);
        } else if (mutation.addedNodes) {
          for (const node of mutation.addedNodes) {
            cleanupEmptyNode(node);
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-front", "data-expanded"],
    });

    return () => {
      observer.disconnect();
    };
  }, [toasts]);

  return null;
}

