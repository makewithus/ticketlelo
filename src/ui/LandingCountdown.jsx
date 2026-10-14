"use client";

import { useEffect } from "react";

const DEFAULT_COUNTDOWN_AT = "2026-11-04T18:30:00+05:30";

export default function LandingCountdown() {
  useEffect(() => {
    let intervalId;
    let active = true;

    const update = (targetTime) => {
      const timer = document.querySelector(".sale-style .timer");
      if (!timer) return;
      timer.style.gap = "0";
      timer.style.width = "max-content";
      timer.style.flex = "0 0 auto";

      const diff = Math.max(targetTime - Date.now(), 0);
      const values = {
        ".timer__days": Math.floor(diff / 86_400_000),
        ".timer__hours": String(Math.floor((diff % 86_400_000) / 3_600_000)).padStart(2, "0"),
        ".timer__minutes": String(Math.floor((diff % 3_600_000) / 60_000)).padStart(2, "0"),
        ".timer__seconds": String(Math.floor((diff % 60_000) / 1000)).padStart(2, "0"),
      };

      Object.entries(values).forEach(([selector, value]) => {
        const node = timer.querySelector(selector);
        if (node) node.textContent = String(value);
      });
      const label = timer.querySelector(".days");
      if (label) label.textContent = "Days";
      if (diff === 0 && intervalId) window.clearInterval(intervalId);
    };

    (async () => {
      let targetTime = new Date(DEFAULT_COUNTDOWN_AT).getTime();
      try {
        const response = await fetch("/api/site-settings/countdown", { cache: "no-store" });
        if (response.ok) {
          const settings = await response.json();
          const parsed = Date.parse(settings.countdownAt);
          if (!Number.isNaN(parsed)) targetTime = parsed;
        }
      } catch (error) {
        console.warn("Using the default homepage countdown:", error);
      }
      if (!active) return;
      update(targetTime);
      intervalId = window.setInterval(() => update(targetTime), 1000);
    })();

    return () => {
      active = false;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, []);

  return null;
}
