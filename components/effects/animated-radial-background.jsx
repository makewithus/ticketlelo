"use client";

import React, { useEffect, useRef, useState } from "react";

/**
 * AnimatedRadialBackground
 * Recreates the dark futuristic RGB radial light-streak background seen in the reference screenshot.
 *
 * Characteristics:
 * - Deep black / charcoal textured backdrop (#08090b)
 * - Subtle film noise/grain texture overlay
 * - Radial outward perspective motion originating from a configurable focal point
 * - RGB chromatic aberration: separate Red, Cyan/Blue, Green, and Orange channels with optical offset
 * - Varying streak speeds, lengths, thicknesses, and brightness levels
 * - Infinitely smooth delta-time loop without visible restarts or jarring jumps
 * - Respects prefers-reduced-motion (renders a crisp static perspective frame)
 * - Pauses on visibilitychange to preserve battery/CPU
 * - Zero pointer-events interference (pure visual background layer)
 */

const STREAK_TYPES = {
  CHROMATIC_TRIPLET: "CHROMATIC_TRIPLET", // Red, Green/White, Cyan/Blue split strands
  CYAN_ELECTRIC: "CYAN_ELECTRIC",         // Electric cyan / ice blue
  CRIMSON_RED: "CRIMSON_RED",             // Hot neon red / scarlet
  NEON_EMERALD: "NEON_EMERALD",           // Vivid emerald / mint green
  AMBER_ORANGE: "AMBER_ORANGE",           // TicketLelo signature flame orange / gold
};

function createStreak(maxRadius, rMin, isInitial = false) {
  // Distribute initial streaks along entire radius so there is NO blank start or loop seam
  const r = isInitial
    ? rMin + Math.random() * (maxRadius - rMin)
    : rMin + Math.random() * 25;

  // 360 degree radial angles with slight clustering for organic natural flare bursts
  const baseAngle = Math.random() * Math.PI * 2;

  // Determine streak visual type
  const typeRoll = Math.random();
  let type = STREAK_TYPES.CHROMATIC_TRIPLET;
  if (typeRoll < 0.35) {
    type = STREAK_TYPES.CHROMATIC_TRIPLET;
  } else if (typeRoll < 0.58) {
    type = STREAK_TYPES.CYAN_ELECTRIC;
  } else if (typeRoll < 0.76) {
    type = STREAK_TYPES.CRIMSON_RED;
  } else if (typeRoll < 0.88) {
    type = STREAK_TYPES.AMBER_ORANGE;
  } else {
    type = STREAK_TYPES.NEON_EMERALD;
  }

  // Base lengths: mostly medium-long streaks (60px - 220px) with occasional prominent beams
  const isHeroStreak = Math.random() < 0.12;
  const baseLen = isHeroStreak
    ? 180 + Math.random() * 200
    : 50 + Math.random() * 110;

  // Speed: outward travel speed (pixels per second at 60fps scale)
  const baseSpeed = isHeroStreak
    ? 90 + Math.random() * 80
    : 45 + Math.random() * 65;

  // Thickness: fine sharp filaments (0.75px - 2.2px)
  const width = isHeroStreak
    ? 1.8 + Math.random() * 0.9
    : 0.75 + Math.random() * 0.9;

  // Base opacity
  const baseAlpha = isHeroStreak
    ? 0.75 + Math.random() * 0.25
    : 0.35 + Math.random() * 0.45;

  // Chromatic dispersion offset (distance in pixels between RGB channel strands)
  const chromaticOffset = 1.2 + Math.random() * 1.8;

  // Twinkle / subtle brightness pulsing
  const twinkleSpeed = 1.5 + Math.random() * 2.5;
  const twinkleOffset = Math.random() * Math.PI * 2;

  return {
    angle: baseAngle,
    r,
    baseLen,
    baseSpeed,
    width,
    baseAlpha,
    type,
    chromaticOffset,
    twinkleSpeed,
    twinkleOffset,
    isHero: isHeroStreak,
  };
}

export function AnimatedRadialBackground({
  focalPoint,
  streakCount,
  speed = 1.0,
  showNoise = true,
  className = "",
  children,
}) {
  const canvasRef = useRef(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    // Check user preference for reduced motion
    const motionMediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(motionMediaQuery.matches);

    const onMotionChange = (e) => setReducedMotion(e.matches);
    if (motionMediaQuery.addEventListener) {
      motionMediaQuery.addEventListener("change", onMotionChange);
    } else {
      motionMediaQuery.addListener(onMotionChange);
    }

    return () => {
      if (motionMediaQuery.removeEventListener) {
        motionMediaQuery.removeEventListener("change", onMotionChange);
      } else {
        motionMediaQuery.removeListener(onMotionChange);
      }
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    let animFrameId = null;
    let lastTime = performance.now();
    let isVisible = true;

    // Track canvas sizing
    let width = 0;
    let height = 0;
    let dpr = 1;
    let maxRadius = 1000;
    let rMin = 35; // Minimum focal dead-zone so the center doesn't look like a solid dot
    let streaks = [];

    const handleResize = () => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2); // Cap at 2x for high performance

      width = rect.width || window.innerWidth;
      height = rect.height || window.innerHeight;

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);

      // Calculate focal point coordinates (default responsive: slightly offset left on desktop, center on mobile)
      const isMobile = width < 768;
      const defaultFocalX = isMobile ? 0.50 : 0.40;
      const defaultFocalY = isMobile ? 0.36 : 0.38;

      const fx = (focalPoint?.x ?? defaultFocalX) * width;
      const fy = (focalPoint?.y ?? defaultFocalY) * height;

      // Max radius to furthest corner
      const cornerDists = [
        Math.hypot(0 - fx, 0 - fy),
        Math.hypot(width - fx, 0 - fy),
        Math.hypot(0 - fx, height - fy),
        Math.hypot(width - fx, height - fy),
      ];
      maxRadius = Math.max(...cornerDists) + 100;
      rMin = Math.max(25, Math.min(width, height) * 0.04);

      // Adaptive streak count: ~110-140 on desktop, 60-75 on mobile
      const targetCount = streakCount || (isMobile ? 65 : 125);

      // Initialize streaks if empty or adjust count
      if (streaks.length === 0) {
        streaks = [];
        for (let i = 0; i < targetCount; i++) {
          streaks.push(createStreak(maxRadius, rMin, true));
        }
      } else if (streaks.length < targetCount) {
        while (streaks.length < targetCount) {
          streaks.push(createStreak(maxRadius, rMin, true));
        }
      } else if (streaks.length > targetCount) {
        streaks = streaks.slice(0, targetCount);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize, { passive: true });

    // Handle tab visibility to save power/cycles
    const handleVisibilityChange = () => {
      isVisible = !document.hidden;
      if (isVisible) {
        lastTime = performance.now();
        if (!animFrameId && !reducedMotion) {
          animFrameId = requestAnimationFrame(render);
        }
      } else {
        if (animFrameId) {
          cancelAnimationFrame(animFrameId);
          animFrameId = null;
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Main Draw Function for a single streak with RGB Chromatic Aberration
    const drawStreak = (streak, fx, fy, timeSec) => {
      const cosA = Math.cos(streak.angle);
      const sinA = Math.sin(streak.angle);

      // Normal unit vector perpendicular to the ray direction
      const nx = -sinA;
      const ny = cosA;

      // Perspective distance scaling: streaks lengthen slightly as they fly outward
      const perspectiveScale = 0.65 + (streak.r / maxRadius) * 0.85;
      const curLen = streak.baseLen * perspectiveScale;

      // Inner and outer radial positions
      const rInner = streak.r;
      const rOuter = streak.r + curLen;

      // Fade envelope
      const fadeDistIn = 70;
      const fadeDistOut = 140;
      let alphaFade = 1.0;

      if (streak.r < rMin + fadeDistIn) {
        alphaFade = Math.max(0, (streak.r - rMin) / fadeDistIn);
      } else if (streak.r > maxRadius - fadeDistOut) {
        alphaFade = Math.max(0, (maxRadius - streak.r) / fadeDistOut);
      }

      // Subtle twinkling modulation
      const twinkle =
        0.88 + 0.12 * Math.sin(timeSec * streak.twinkleSpeed + streak.twinkleOffset);
      const finalAlpha = Math.min(1.0, streak.baseAlpha * alphaFade * twinkle);

      if (finalAlpha <= 0.01) return;

      // Start and end coordinates of the ray
      const x1 = fx + cosA * rInner;
      const y1 = fy + sinA * rInner;
      const x2 = fx + cosA * rOuter;
      const y2 = fy + sinA * rOuter;

      // Draw helper: draws a line segment with a gradient fading in at tail and glowing at head
      const drawSegment = (startX, startY, endX, endY, strokeStyle, lineWidth) => {
        const grad = ctx.createLinearGradient(startX, startY, endX, endY);
        grad.addColorStop(0, "rgba(0,0,0,0)");
        grad.addColorStop(0.3, strokeStyle);
        grad.addColorStop(1, strokeStyle);

        ctx.strokeStyle = grad;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
      };

      if (streak.type === STREAK_TYPES.CHROMATIC_TRIPLET) {
        // ── SIGNATURE CHROMATIC ABERRATION ──
        // Red channel offset slightly in positive normal direction
        const cOffset = streak.chromaticOffset * (0.8 + (streak.r / maxRadius) * 0.5);

        // 1. Red / Scarlet strand
        const rColor = `rgba(255, 45, 85, ${(finalAlpha * 0.85).toFixed(3)})`;
        drawSegment(
          x1 + nx * cOffset,
          y1 + ny * cOffset,
          x2 + nx * cOffset,
          y2 + ny * cOffset,
          rColor,
          streak.width * 0.95
        );

        // 2. Cyan / Electric Blue strand offset in negative normal direction
        const bColor = `rgba(0, 235, 255, ${(finalAlpha * 0.9).toFixed(3)})`;
        drawSegment(
          x1 - nx * cOffset,
          y1 - ny * cOffset,
          x2 - nx * cOffset,
          y2 - ny * cOffset,
          bColor,
          streak.width * 0.95
        );

        // 3. Crisp white/gold core in center
        const coreColor = `rgba(255, 255, 255, ${(finalAlpha * 0.95).toFixed(3)})`;
        drawSegment(x1, y1, x2, y2, coreColor, streak.width * 0.7);

        // 4. Subtle ambient green/cyan halo for hero beams
        if (streak.isHero) {
          const gColor = `rgba(0, 255, 136, ${(finalAlpha * 0.4).toFixed(3)})`;
          drawSegment(
            x1 + nx * (cOffset * 0.4),
            y1 + ny * (cOffset * 0.4),
            x2 + nx * (cOffset * 0.4),
            y2 + ny * (cOffset * 0.4),
            gColor,
            streak.width * 1.6
          );
        }
      } else if (streak.type === STREAK_TYPES.CYAN_ELECTRIC) {
        // Cyan beam with subtle red fringing
        const cOffset = streak.chromaticOffset * 0.8;
        const fringeColor = `rgba(255, 30, 80, ${(finalAlpha * 0.35).toFixed(3)})`;
        drawSegment(
          x1 + nx * cOffset,
          y1 + ny * cOffset,
          x2 + nx * cOffset,
          y2 + ny * cOffset,
          fringeColor,
          streak.width * 0.8
        );

        const mainColor = `rgba(0, 240, 255, ${(finalAlpha * 0.9).toFixed(3)})`;
        drawSegment(x1, y1, x2, y2, mainColor, streak.width);

        const core = `rgba(220, 255, 255, ${(finalAlpha * 0.8).toFixed(3)})`;
        drawSegment(x1, y1, x2, y2, core, streak.width * 0.5);
      } else if (streak.type === STREAK_TYPES.CRIMSON_RED) {
        // Hot crimson beam with subtle blue fringing
        const cOffset = streak.chromaticOffset * 0.8;
        const fringeColor = `rgba(0, 180, 255, ${(finalAlpha * 0.3).toFixed(3)})`;
        drawSegment(
          x1 - nx * cOffset,
          y1 - ny * cOffset,
          x2 - nx * cOffset,
          y2 - ny * cOffset,
          fringeColor,
          streak.width * 0.8
        );

        const mainColor = `rgba(255, 45, 60, ${(finalAlpha * 0.9).toFixed(3)})`;
        drawSegment(x1, y1, x2, y2, mainColor, streak.width);

        const core = `rgba(255, 180, 190, ${(finalAlpha * 0.75).toFixed(3)})`;
        drawSegment(x1, y1, x2, y2, core, streak.width * 0.5);
      } else if (streak.type === STREAK_TYPES.AMBER_ORANGE) {
        // Flame orange / gold beam (signature TicketLelo accent)
        const mainColor = `rgba(254, 118, 11, ${(finalAlpha * 0.9).toFixed(3)})`;
        drawSegment(x1, y1, x2, y2, mainColor, streak.width);

        const core = `rgba(253, 224, 71, ${(finalAlpha * 0.8).toFixed(3)})`;
        drawSegment(x1, y1, x2, y2, core, streak.width * 0.55);
      } else {
        // Neon emerald / mint green
        const mainColor = `rgba(16, 185, 129, ${(finalAlpha * 0.85).toFixed(3)})`;
        drawSegment(x1, y1, x2, y2, mainColor, streak.width);

        const core = `rgba(200, 255, 230, ${(finalAlpha * 0.7).toFixed(3)})`;
        drawSegment(x1, y1, x2, y2, core, streak.width * 0.5);
      }
    };

    // Render loop
    const render = (now) => {
      if (!isVisible) return;

      const dt = Math.min((now - lastTime) / 1000, 0.08); // Max clamp to prevent large jumps on tab wake
      lastTime = now;

      const isMobile = width < 768;
      const defaultFocalX = isMobile ? 0.50 : 0.40;
      const defaultFocalY = isMobile ? 0.36 : 0.38;

      const fx = (focalPoint?.x ?? defaultFocalX) * width;
      const fy = (focalPoint?.y ?? defaultFocalY) * height;

      // Fill base background: deep cinematic black / dark charcoal
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#08090B";
      ctx.fillRect(0, 0, width, height);

      // Subtle atmospheric focal backlight (matches the central depth in reference)
      const focalGlow = ctx.createRadialGradient(fx, fy, 10, fx, fy, Math.max(width, height) * 0.45);
      focalGlow.addColorStop(0, "rgba(254, 118, 11, 0.05)");
      focalGlow.addColorStop(0.25, "rgba(0, 180, 255, 0.025)");
      focalGlow.addColorStop(0.65, "rgba(8, 9, 11, 0.6)");
      focalGlow.addColorStop(1, "rgba(8, 9, 11, 1)");
      ctx.fillStyle = focalGlow;
      ctx.fillRect(0, 0, width, height);

      // Switch to screen blending so overlapping RGB rays naturally produce optical chromatic brilliance
      ctx.globalCompositeOperation = "screen";
      ctx.lineCap = "round";

      const timeSec = now / 1000;

      // Update & Draw streaks
      for (let i = 0; i < streaks.length; i++) {
        const streak = streaks[i];

        if (!reducedMotion) {
          // Perspective radial acceleration: streaks accelerate as they travel farther from center
          const accel = 1 + (streak.r / maxRadius) * 1.6;
          streak.r += streak.baseSpeed * accel * speed * (dt / 0.016);

          // Reset streak seamlessly once it fully leaves the outer edge
          const curLen = streak.baseLen * (0.65 + (streak.r / maxRadius) * 0.85);
          if (streak.r - curLen > maxRadius) {
            // Respawn with randomized angle and fresh properties at the center zone
            streaks[i] = createStreak(maxRadius, rMin, false);
          }
        }

        drawStreak(streak, fx, fy, timeSec);
      }

      // If user requested reduced motion, draw once and stop loop
      if (reducedMotion) {
        return;
      }

      animFrameId = requestAnimationFrame(render);
    };

    // Kick off animation
    animFrameId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (animFrameId) {
        cancelAnimationFrame(animFrameId);
      }
    };
  }, [focalPoint, streakCount, speed, reducedMotion]);

  return (
    <div
      className={`fixed inset-0 pointer-events-none overflow-hidden select-none z-0 ${className}`}
      aria-hidden="true"
    >
      {/* Layer 1: Animated Radial Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block pointer-events-none"
      />

      {/* Layer 2: Ultra-fine Analog Grain/Noise Texture Overlay */}
      {showNoise && (
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.045] mix-blend-overlay"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            backgroundRepeat: "repeat",
            backgroundSize: "180px 180px",
          }}
        />
      )}

      {/* Layer 3: Subtle Vignette to keep edges dark and cinematic */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 50% 40%, transparent 40%, rgba(8, 9, 11, 0.35) 75%, rgba(8, 9, 11, 0.75) 100%)",
        }}
      />

      {children}
    </div>
  );
}

export default AnimatedRadialBackground;
