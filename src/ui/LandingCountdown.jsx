"use client";

import { useEffect } from "react";

export default function LandingCountdown() {
  useEffect(() => {
    let intervalId = null;
    let active = true;

    const setVisibility = (visible) => {
      const saleElements = document.querySelectorAll(".sale-style");
      saleElements.forEach((el) => {
        if (visible) {
          el.style.display = "block";
          el.style.visibility = "visible";
          el.style.opacity = "1";
        } else {
          el.style.display = "none";
        }
      });
    };

    const update = (targetTime) => {
      const timer = document.querySelector(".sale-style .timer");
      if (!timer) return;
      timer.style.gap = "0";
      timer.style.width = "max-content";
      timer.style.flex = "0 0 auto";

      const diff = Math.max(0, targetTime - Date.now());
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

      if (diff === 0) {
        if (intervalId) window.clearInterval(intervalId);
      }
    };

    (async () => {
      try {
        const response = await fetch("/api/site-settings/countdown", { cache: "no-store" });
        if (!response.ok) {
          setVisibility(false);
          return;
        }

        const settings = await response.json();
        if (!settings.countdownEnabled || !settings.countdownAt) {
          setVisibility(false);
          return;
        }

        const targetTime = Date.parse(settings.countdownAt);
        if (Number.isNaN(targetTime) || targetTime <= Date.now()) {
          // Expired or invalid
          setVisibility(false);
          return;
        }

        if (!active) return;
        setVisibility(true);
        update(targetTime);
        intervalId = window.setInterval(() => update(targetTime), 1000);
      } catch (error) {
        console.warn("Could not load homepage countdown:", error);
        setVisibility(false);
      }
    })();

    return () => {
      active = false;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, []);

  return null;
}
