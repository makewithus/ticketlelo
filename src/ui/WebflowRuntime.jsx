"use client";

import { useEffect } from "react";

/**
 * Boots the UI dev's Webflow runtime (jQuery, Webflow IX2, GSAP, Lottie, Swiper,
 * Finsweet ...) on a page whose markup was rendered from the static export.
 *
 * The scripts were authored for a normal document load, so they are executed
 * strictly in their original order and, once done, the `DOMContentLoaded` and
 * `load` events they listen for are re-dispatched (they already fired before
 * React hydrated).
 */

const loadScript = (item) =>
  new Promise((resolve) => {
    const el = document.createElement("script");
    el.type = "text/javascript";
    if (item.src) {
      el.src = item.src;
      el.async = false;
      el.onload = resolve;
      el.onerror = () => {
        console.warn("[ui] failed to load", item.src);
        resolve();
      };
      document.body.appendChild(el);
    } else {
      el.text = item.code;
      document.body.appendChild(el);
      resolve();
    }
  });

export default function WebflowRuntime({ scripts, rootId }) {
  useEffect(() => {
    const root = document.getElementById(rootId);
    // React StrictMode runs effects twice on the same DOM; only boot once.
    if (window.__tlWebflowRoot === root) return;
    // The scripts were already booted against a previous copy of the DOM
    // (client-side navigation back to this page): a fresh load is the only
    // way to get the animations bound to the new markup.
    if (window.__tlWebflowRoot) {
      window.location.reload();
      return;
    }
    window.__tlWebflowRoot = root;

    (async () => {
      for (const item of scripts) await loadScript(item);
      document.dispatchEvent(
        new Event("DOMContentLoaded", { bubbles: true, cancelable: true }),
      );
      window.dispatchEvent(new Event("load"));
    })();
  }, [scripts, rootId]);

  return null;
}
