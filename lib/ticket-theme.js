/**
 * Universal Ticket Styling & Theme Resolver
 * Ensures 100% design consistency across Web, PDF, Print, Dashboard, and Organiser Studio
 */

export function hexToRgb(hex = "") {
  if (!hex) return null;
  const clean = hex.replace("#", "").trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return [r, g, b];
  }
  if (clean.length === 6) {
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    return [r, g, b];
  }
  return null;
}

export function rgbToHex([r, g, b]) {
  return (
    "#" +
    [r, g, b]
      .map((x) => {
        const h = Math.max(0, Math.min(255, Math.round(x))).toString(16);
        return h.length === 1 ? "0" + h : h;
      })
      .join("")
  );
}

/**
 * Calculates perceived brightness (0 to 1) based on standard ITU-R BT.601 formula
 */
export function getLuminance([r, g, b]) {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export function normalizeHex(hex = "") {
  if (!hex) return "#FE760B";
  const clean = String(hex).replace(/^#/, "").trim();
  if (clean.length === 3) {
    return `#${clean[0]}${clean[0]}${clean[1]}${clean[1]}${clean[2]}${clean[2]}`.toUpperCase();
  }
  if (clean.length === 6) {
    return `#${clean}`.toUpperCase();
  }
  return clean.startsWith("#") ? clean.toUpperCase() : `#${clean}`.toUpperCase();
}

export function isLightColor(hex = "") {
  if (!hex) return false;
  const rgb = hexToRgb(hex);
  if (!rgb) return false;
  return getLuminance(rgb) > 0.55;
}

/**
 * Resolves user-customized text color tokens (Theme contrast, Light, Dark, Gold, Orange, Teal, or any custom hex)
 */
export function resolveTextColor(textColor, defaultIsLight = false, bgHex = null) {
  if (!textColor || textColor === "auto") {
    if (bgHex) {
      const rgb = hexToRgb(bgHex);
      if (rgb) {
        const lum = getLuminance(rgb);
        return lum > 0.55
          ? { className: "text-[#131517] font-black", style: { color: "#131517" }, rgb: [19, 21, 23] }
          : { className: "text-white font-black", style: { color: "#FFFFFF" }, rgb: [255, 255, 255] };
      }
    }
    return defaultIsLight
      ? { className: "text-white font-black", style: { color: "#FFFFFF" }, rgb: [255, 255, 255] }
      : { className: "text-[#131517] font-black", style: { color: "#131517" }, rgb: [19, 21, 23] };
  }

  const s = String(textColor).trim();
  const lower = s.toLowerCase();

  if (lower === "light" || lower === "white" || lower === "#ffffff" || lower === "#fff") {
    return { className: "text-white font-black", style: { color: "#FFFFFF" }, rgb: [255, 255, 255] };
  }
  if (lower === "dark" || lower === "black" || lower === "#000000" || lower === "#131517") {
    return { className: "text-[#131517] font-black", style: { color: "#131517" }, rgb: [19, 21, 23] };
  }
  if (lower === "gold" || lower === "yellow" || lower === "#fde003") {
    return { className: "text-[#FDE003] font-black", style: { color: "#FDE003" }, rgb: [253, 224, 3] };
  }
  if (lower === "orange" || lower === "#fe760b") {
    return { className: "text-[#FE760B] font-black", style: { color: "#FE760B" }, rgb: [254, 118, 11] };
  }
  if (lower === "teal" || lower === "green" || lower === "#3dd68c") {
    return { className: "text-[#3DD68C] font-black", style: { color: "#3DD68C" }, rgb: [61, 214, 140] };
  }
  if (s.startsWith("#") || /^[0-9A-Fa-f]{3,6}$/.test(s)) {
    const fullHex = normalizeHex(s);
    const rgb = hexToRgb(fullHex);
    return {
      className: "font-black",
      style: { color: fullHex },
      rgb: rgb || [255, 255, 255],
    };
  }

  return { className: "text-white font-black", style: { color: "#FFFFFF" }, rgb: [255, 255, 255] };
}

/**
 * Cleanly splits event title into two impactful lines
 * Honors organiser custom poster lines (posterLine1 / posterLine2) if defined
 */
export function parseTicketTitle(fullName = "", event = null) {
  if (event?.posterTextMode === "custom") {
    return {
      line1: (event.posterLine1 !== undefined ? event.posterLine1 : "").trim().toUpperCase() || "EVENT",
      line2: (event.posterLine2 !== undefined ? event.posterLine2 : "").trim().toUpperCase(),
      isYear: false,
    };
  }

  if (event?.posterLine1 && (event?.posterLine1?.trim() || event?.posterLine2?.trim())) {
    return {
      line1: event.posterLine1.trim().toUpperCase(),
      line2: (event.posterLine2 || "").trim().toUpperCase(),
      isYear: false,
    };
  }

  const trimmed = (fullName || event?.name || event?.title || "").trim();
  if (!trimmed) {
    return { line1: "EVENT", line2: "PASS", isYear: false };
  }

  // Check 4-digit year at end (e.g. "TECH FEST 2026")
  const yearMatch = trimmed.match(/^(.*?)\s+((?:19|20)\d{2})$/i);
  if (yearMatch) {
    return {
      line1: yearMatch[1].toUpperCase(),
      line2: yearMatch[2],
      isYear: true,
    };
  }

  // Split multi-word titles (e.g. "HONEY SINGH CONCERT" -> "HONEY SINGH", "CONCERT")
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const lastWord = words[words.length - 1].toUpperCase();
    const rest = words.slice(0, words.length - 1).join(" ").toUpperCase();
    return { line1: rest, line2: lastWord, isYear: false };
  }

  return { line1: trimmed.toUpperCase(), line2: "", isYear: false };
}

/**
 * Resolves full styling tokens for an event based on organiser selections:
 * - event.themeColor (Hex)
 * - event.theme (Identifier)
 * - Default: TicketLelo Orange (#FE760B)
 */
export function resolveTicketTheme(event = {}, explicitTheme = null) {
  const rawColor =
    explicitTheme && explicitTheme.startsWith("#")
      ? explicitTheme
      : event?.ticketBgColor ||
        event?.themeColor ||
        event?.themeHex ||
        (event?.theme && event.theme.startsWith("#") ? event.theme : null);

  const themeId = String(
    explicitTheme ||
      event?.theme ||
      event?.themeName ||
      ""
  )
    .toLowerCase()
    .trim();

  const userTextColor = event?.ticketTextColor || event?.posterTextColor || null;

  // Known theme presets
  if (themeId === "gaming" || themeId === "purple") {
    const resolvedText = resolveTextColor(userTextColor, true, "#472F92");
    return {
      name: "gaming",
      primaryHex: "#472F92",
      bodyBg: "bg-[#472F92]",
      bodyBgStyle: { backgroundColor: "#472F92" },
      stubBg: "bg-[#150D29]",
      stubBgStyle: { backgroundColor: "#150D29" },
      bottomBarBg: "bg-[#0C0D10]",
      bottomBarStyle: { backgroundColor: "#0C0D10" },
      titleColor: resolvedText.className,
      titleStyle: resolvedText.style,
      titleRgb: resolvedText.rgb,
      scanColor: "text-[#3DD68C]",
      ticketIdColor: "text-[#A78BFA]",
      accentYellow: "#FDE003",
      perforationBorder: "border-white/20",
      artRgb: [71, 47, 146],
      stubRgb: [21, 13, 41],
      scanRgb: [61, 214, 140],
      accentRgb: [168, 85, 247],
    };
  }

  if (themeId === "electric" || themeId === "blue") {
    const resolvedText = resolveTextColor(userTextColor, true, "#1D4ED8");
    return {
      name: "electric",
      primaryHex: "#1D4ED8",
      bodyBg: "bg-[#1D4ED8]",
      bodyBgStyle: { backgroundColor: "#1D4ED8" },
      stubBg: "bg-[#0B132B]",
      stubBgStyle: { backgroundColor: "#0B132B" },
      bottomBarBg: "bg-[#0C0D10]",
      bottomBarStyle: { backgroundColor: "#0C0D10" },
      titleColor: resolvedText.className,
      titleStyle: resolvedText.style,
      titleRgb: resolvedText.rgb,
      scanColor: "text-[#38BDF8]",
      ticketIdColor: "text-[#7AA2FF]",
      accentYellow: "#FDE003",
      perforationBorder: "border-white/20",
      artRgb: [29, 78, 216],
      stubRgb: [11, 19, 43],
      scanRgb: [56, 189, 248],
      accentRgb: [122, 162, 255],
    };
  }

  if (themeId === "neon" || themeId === "pink" || themeId === "mic") {
    const resolvedText = resolveTextColor(userTextColor, true, "#BE185D");
    return {
      name: "neon",
      primaryHex: "#BE185D",
      bodyBg: "bg-[#BE185D]",
      bodyBgStyle: { backgroundColor: "#BE185D" },
      stubBg: "bg-[#1D060D]",
      stubBgStyle: { backgroundColor: "#1D060D" },
      bottomBarBg: "bg-[#0C0D10]",
      bottomBarStyle: { backgroundColor: "#0C0D10" },
      titleColor: resolvedText.className,
      titleStyle: resolvedText.style,
      titleRgb: resolvedText.rgb,
      scanColor: "text-[#FE760B]",
      ticketIdColor: "text-[#F43F5E]",
      accentYellow: "#FDE003",
      perforationBorder: "border-white/20",
      artRgb: [190, 24, 93],
      stubRgb: [29, 6, 13],
      scanRgb: [254, 118, 11],
      accentRgb: [244, 63, 94],
    };
  }

  if (themeId === "mint" || themeId === "green" || themeId === "robotics") {
    const resolvedText = resolveTextColor(userTextColor, true, "#047857");
    return {
      name: "mint",
      primaryHex: "#047857",
      bodyBg: "bg-[#047857]",
      bodyBgStyle: { backgroundColor: "#047857" },
      stubBg: "bg-[#051917]",
      stubBgStyle: { backgroundColor: "#051917" },
      bottomBarBg: "bg-[#0C0D10]",
      bottomBarStyle: { backgroundColor: "#0C0D10" },
      titleColor: resolvedText.className,
      titleStyle: resolvedText.style,
      titleRgb: resolvedText.rgb,
      scanColor: "text-[#FDE003]",
      ticketIdColor: "text-[#34D399]",
      accentYellow: "#FDE003",
      perforationBorder: "border-white/20",
      artRgb: [4, 120, 87],
      stubRgb: [5, 25, 23],
      scanRgb: [253, 224, 3],
      accentRgb: [52, 211, 153],
    };
  }

  if (themeId === "sunny" || themeId === "yellow") {
    const resolvedText = resolveTextColor(userTextColor, false, "#FDE003");
    return {
      name: "sunny",
      primaryHex: "#FDE003",
      bodyBg: "bg-[#FDE003]",
      bodyBgStyle: { backgroundColor: "#FDE003" },
      stubBg: "bg-[#201207]",
      stubBgStyle: { backgroundColor: "#201207" },
      bottomBarBg: "bg-[#0C0D10]",
      bottomBarStyle: { backgroundColor: "#0C0D10" },
      titleColor: resolvedText.className,
      titleStyle: resolvedText.style,
      titleRgb: resolvedText.rgb,
      scanColor: "text-[#FE760B]",
      ticketIdColor: "text-[#FE760B]",
      accentYellow: "#FDE003",
      perforationBorder: "border-black/20",
      artRgb: [253, 224, 3],
      stubRgb: [32, 18, 7],
      scanRgb: [254, 118, 11],
      accentRgb: [254, 118, 11],
    };
  }

  // Custom Hex color handling (if organiser picked a specific color)
  if (rawColor) {
    const rgb = hexToRgb(rawColor);
    if (rgb) {
      const lum = getLuminance(rgb);
      const isLight = lum > 0.55;
      const resolvedText = resolveTextColor(userTextColor, !isLight, rawColor);

      // Dark stub background matching the hue
      const stubRgb = [
        Math.max(16, Math.floor(rgb[0] * 0.12)),
        Math.max(16, Math.floor(rgb[1] * 0.12)),
        Math.max(18, Math.floor(rgb[2] * 0.12)),
      ];
      const stubHex = rgbToHex(stubRgb);

      return {
        name: "custom",
        primaryHex: rawColor,
        bodyBg: "",
        bodyBgStyle: { backgroundColor: rawColor },
        stubBg: "",
        stubBgStyle: { backgroundColor: stubHex },
        bottomBarBg: "bg-[#0C0D10]",
        bottomBarStyle: { backgroundColor: "#0C0D10" },
        titleColor: resolvedText.className,
        titleStyle: resolvedText.style,
        titleRgb: resolvedText.rgb,
        scanColor: "text-[#FDE003]",
        ticketIdColor: "text-[#FE760B]",
        accentYellow: "#FDE003",
        perforationBorder: isLight ? "border-black/20" : "border-white/20",
        artRgb: rgb,
        stubRgb,
        scanRgb: [253, 224, 3],
        accentRgb: [254, 118, 11],
      };
    }
  }

  // Standard Default: Official TicketLelo Orange (#FE760B) matching reference image
  const resolvedText = resolveTextColor(userTextColor, false, "#FE760B");
  return {
    name: "orange",
    primaryHex: "#FE760B",
    bodyBg: "bg-[#FE760B]",
    bodyBgStyle: { backgroundColor: "#FE760B" },
    stubBg: "bg-[#201207]",
    stubBgStyle: { backgroundColor: "#201207" },
    bottomBarBg: "bg-[#0C0D10]",
    bottomBarStyle: { backgroundColor: "#0C0D10" },
    titleColor: resolvedText.className,
    titleStyle: resolvedText.style,
    titleRgb: resolvedText.rgb,
    scanColor: "text-[#FDE003]",
    ticketIdColor: "text-[#FE760B]",
    accentYellow: "#FDE003",
    perforationBorder: "border-black/20",
    artRgb: [254, 118, 11],
    stubRgb: [32, 18, 7],
    scanRgb: [253, 224, 3],
    accentRgb: [253, 224, 3],
  };
}
