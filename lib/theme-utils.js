/**
 * TicketLelo Canonical Theme & Color Palette Definitions
 * Used across Event Creation, More Settings / Customization, and Public Event Pages
 */

export const MINIMAL_THEME = Object.freeze({
  id: "minimal",
  hex: "#FE760B",
  name: "Minimal",
  bg: "#131517",
  pageBg: "#131517",
  gradientCss: "linear-gradient(135deg, #131517 0%, #1A1C1F 100%)",
  sun: "#FE760B",
  textColor: "#FFFFFF",
  buttonTextColor: "#FFFFFF",
});

export const COLOR_SWATCHES = [
  {
    id: "orange",
    hex: "#FE760B",
    name: "TicketLelo Orange",
    bg: "#FE760B",
    pageBg: "#2B1605",
    gradientCss: "linear-gradient(135deg, #FE760B 0%, #EA580C 50%, #FDE003 100%)",
    sun: "#FDE003",
    textColor: "#131517",
    buttonTextColor: "#FFFFFF",
  },
  {
    id: "yellow",
    hex: "#FDE003",
    name: "Electric Yellow",
    bg: "#EAB308",
    gradientCss: "linear-gradient(135deg, #EAB308 0%, #FACC15 50%, #FDE003 100%)",
    sun: "#FEF08A",
    textColor: "#131517",
    buttonTextColor: "#000000",
  },
  {
    id: "blue",
    hex: "#3B82F6",
    name: "Electric Blue",
    bg: "#1D4ED8",
    gradientCss: "linear-gradient(135deg, #1E40AF 0%, #2563EB 50%, #3B82F6 100%)",
    sun: "#38BDF8",
    textColor: "#FFFFFF",
    buttonTextColor: "#FFFFFF",
  },
  {
    id: "pink",
    hex: "#EC4899",
    name: "Hot Pink",
    bg: "#BE185D",
    gradientCss: "linear-gradient(135deg, #9D174D 0%, #DB2777 50%, #EC4899 100%)",
    sun: "#F43F5E",
    textColor: "#FFFFFF",
    buttonTextColor: "#FFFFFF",
  },
  {
    id: "green",
    hex: "#10B981",
    name: "Emerald Green",
    bg: "#047857",
    gradientCss: "linear-gradient(135deg, #065F46 0%, #059669 50%, #10B981 100%)",
    sun: "#34D399",
    textColor: "#FFFFFF",
    buttonTextColor: "#FFFFFF",
  },
  {
    id: "white",
    hex: "#FFFFFF",
    name: "Pure White",
    bg: "#1F2937",
    gradientCss: "linear-gradient(135deg, #111827 0%, #374151 50%, #9CA3AF 100%)",
    sun: "#FFFFFF",
    textColor: "#FFFFFF",
    buttonTextColor: "#000000",
  },
];

/**
 * Word-aware banner headline text splitting - never cuts mid-word
 */
export function getPosterLines(name, mode = "auto", custom1 = "", custom2 = "") {
  if (mode === "custom" && (custom1?.trim() || custom2?.trim())) {
    return {
      line1: (custom1 || "").trim().toUpperCase(),
      line2: (custom2 || "").trim().toUpperCase(),
    };
  }

  const raw = (name || "").trim();
  if (!raw) {
    return { line1: "", line2: "" };
  }

  const words = raw.split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    return { line1: words[0].toUpperCase(), line2: "" };
  }
  if (words.length === 2) {
    return { line1: words[0].toUpperCase(), line2: words[1].toUpperCase() };
  }
  if (words.length === 3) {
    return {
      line1: words[0].toUpperCase(),
      line2: `${words[1]} ${words[2]}`.toUpperCase(),
    };
  }
  const mid = Math.ceil(words.length / 2);
  const line1 = words.slice(0, mid).join(" ").toUpperCase();
  const line2 = words.slice(mid).join(" ").toUpperCase();
  return { line1, line2 };
}

/**
 * Returns complete theme styling attributes for any hex color or theme identifier
 */
export function getThemeLook(colorOrId = "#FE760B") {
  if (!colorOrId) return COLOR_SWATCHES[0];

  const search = String(colorOrId).toLowerCase().trim();

  // Match by id or hex in presets
  const matched = COLOR_SWATCHES.find(
    (s) => s.id === search || s.hex.toLowerCase() === search
  );
  if (matched) return matched;

  // Match by common synonyms
  if (search.includes("minimal")) {
    return MINIMAL_THEME;
  }
  if (search.includes("blue") || search === "#2b59ff") {
    return COLOR_SWATCHES[2];
  }
  if (search.includes("pink") || search.includes("neon") || search === "#ff6b6b") {
    return COLOR_SWATCHES[3];
  }
  if (search.includes("green") || search.includes("mint") || search === "#3dd68c") {
    return COLOR_SWATCHES[4];
  }
  if (search.includes("yellow") || search.includes("sunny")) {
    return COLOR_SWATCHES[1];
  }
  if (search.includes("orange") || search.includes("sunset")) {
    return COLOR_SWATCHES[0];
  }
  if (search.includes("white") || search.includes("monolith")) {
    return COLOR_SWATCHES[5];
  }

  // Fallback for custom HEX
  const hex = colorOrId.startsWith("#") ? colorOrId : `#${colorOrId}`;
  return {
    id: "custom",
    hex,
    name: "Custom Theme",
    bg: hex,
    pageBg: hex,
    gradientCss: `linear-gradient(135deg, ${hex} 0%, ${hex}dd 100%)`,
    sun: hex,
    textColor: "#FFFFFF",
    buttonTextColor: "#FFFFFF",
  };
}

export const THEMES_MAP = {
  minimal: {
    id: "minimal",
    name: "Minimal",
    color: "#FE760B",
    hex: "#FE760B",
    pageBg: "#131517",
    bg: "#131517",
    sun: "#FE760B",
    textColor: "#FFFFFF",
    buttonTextColor: "#FFFFFF",
    cardBg: "#1A1C1F",
    cardBorder: "#2A2D31",
    inputBg: "#212327",
  },
  sunset: {
    id: "sunset",
    name: "Sunset",
    color: "#FE760B",
    hex: "#FE760B",
    pageBg: "#2B1605",
    bg: "#FE760B",
    sun: "#FB923C",
    textColor: "#FFFFFF",
    buttonTextColor: "#FFFFFF",
    cardBg: "rgba(255, 255, 255, 0.08)",
    cardBorder: "rgba(255, 255, 255, 0.12)",
    inputBg: "rgba(0, 0, 0, 0.25)",
  },
  sunny: {
    id: "sunny",
    name: "Sunny",
    color: "#FDE003",
    hex: "#FDE003",
    pageBg: "#261D02",
    bg: "#FE760B",
    sun: "#FDE003",
    textColor: "#FFFFFF",
    buttonTextColor: "#000000",
    cardBg: "rgba(255, 255, 255, 0.08)",
    cardBorder: "rgba(255, 255, 255, 0.12)",
    inputBg: "rgba(0, 0, 0, 0.25)",
  },
  electric: {
    id: "electric",
    name: "Electric",
    color: "#2B59FF",
    hex: "#2B59FF",
    pageBg: "#0B1536",
    bg: "#1D4ED8",
    sun: "#38BDF8",
    textColor: "#FFFFFF",
    buttonTextColor: "#FFFFFF",
    cardBg: "rgba(255, 255, 255, 0.08)",
    cardBorder: "rgba(255, 255, 255, 0.12)",
    inputBg: "rgba(0, 0, 0, 0.25)",
  },
  neon: {
    id: "neon",
    name: "Neon",
    color: "#EC4899",
    hex: "#EC4899",
    pageBg: "#290A1A",
    bg: "#BE185D",
    sun: "#F43F5E",
    textColor: "#FFFFFF",
    buttonTextColor: "#FFFFFF",
    cardBg: "rgba(255, 255, 255, 0.08)",
    cardBorder: "rgba(255, 255, 255, 0.12)",
    inputBg: "rgba(0, 0, 0, 0.25)",
  },
  mint: {
    id: "mint",
    name: "Mint",
    color: "#10B981",
    hex: "#10B981",
    pageBg: "#062319",
    bg: "#047857",
    sun: "#34D399",
    textColor: "#FFFFFF",
    buttonTextColor: "#FFFFFF",
    cardBg: "rgba(255, 255, 255, 0.08)",
    cardBorder: "rgba(255, 255, 255, 0.12)",
    inputBg: "rgba(0, 0, 0, 0.25)",
  },
};

/**
 * Resolves full theme definition for any event object.
 * Guarantee: If theme is "minimal" (selected in event creation/edit studio),
 * returns the canonical dark pageBg (#131517) with theme accent (#FE760B) and
 * dark minimal card styling (#1A1C1F card background, #2A2D31 card border).
 */
export function resolveEventTheme(event) {
  const minimalTheme = THEMES_MAP.minimal;

  if (!event) {
    return {
      ...minimalTheme,
      color: "#FE760B",
      hex: "#FE760B",
      cardBg: "#1A1C1F",
      cardBorder: "#2A2D31",
      inputBg: "#212327",
    };
  }

  const themeId = String(event.theme || "").toLowerCase().trim();
  const themeName = String(event.themeName || "").toLowerCase().trim();
  const rawCustomPageBg = event.pageBg || null;
  // Automatically sanitize legacy olive-brown #432E01 to canonical dark #131517
  const customPageBg = rawCustomPageBg === "#432E01" ? "#131517" : rawCustomPageBg;

  // 1. Match from THEMES_MAP
  const matchedTheme = THEMES_MAP[themeId] || THEMES_MAP[themeName];
  if (matchedTheme) {
    const accent = matchedTheme.color;
    const isMinimal = matchedTheme.id === "minimal";
    return {
      ...matchedTheme,
      color: accent,
      hex: accent,
      sun: accent,
      pageBg: isMinimal ? "#131517" : matchedTheme.pageBg,
      bg: isMinimal ? "#131517" : matchedTheme.bg,
      cardBg: isMinimal ? "#1A1C1F" : (matchedTheme.cardBg || "rgba(255, 255, 255, 0.08)"),
      cardBorder: isMinimal ? "#2A2D31" : (matchedTheme.cardBorder || "rgba(255, 255, 255, 0.12)"),
      inputBg: isMinimal ? "#212327" : (matchedTheme.inputBg || "rgba(0, 0, 0, 0.25)"),
    };
  }

  // 2. Named Swatches
  const matchedSwatch = COLOR_SWATCHES.find(
    (s) => s.id === themeId || s.name.toLowerCase() === themeName
  );
  if (matchedSwatch) {
    const accent = event.themeColor || event.themeHex || matchedSwatch.hex;
    return {
      ...matchedSwatch,
      color: accent,
      hex: accent,
      pageBg: customPageBg || matchedSwatch.pageBg || "#131517",
      bg: customPageBg || matchedSwatch.bg || "#131517",
      cardBg: "rgba(255, 255, 255, 0.08)",
      cardBorder: "rgba(255, 255, 255, 0.12)",
      inputBg: "rgba(0, 0, 0, 0.25)",
    };
  }

  // 3. Custom Hex or Color
  if (themeId === "custom" || (event.themeColor && event.themeColor.startsWith("#"))) {
    const safeHex = event.themeColor || event.themeHex || "#FE760B";
    const r = parseInt(safeHex.slice(1, 3), 16) || 0;
    const g = parseInt(safeHex.slice(3, 5), 16) || 0;
    const b = parseInt(safeHex.slice(5, 7), 16) || 0;
    const darkBg = customPageBg || `rgb(${Math.max(10, Math.round(r * 0.08))}, ${Math.max(10, Math.round(g * 0.08))}, ${Math.max(14, Math.round(b * 0.12))})`;

    return {
      id: "custom",
      name: `Custom (${safeHex.toUpperCase()})`,
      color: safeHex,
      hex: safeHex,
      pageBg: darkBg,
      bg: darkBg,
      sun: safeHex,
      textColor: "#FFFFFF",
      buttonTextColor: "#FFFFFF",
      gradientCss: `linear-gradient(135deg, ${darkBg} 0%, ${safeHex}40 100%)`,
      cardBg: "rgba(255, 255, 255, 0.08)",
      cardBorder: "rgba(255, 255, 255, 0.12)",
      inputBg: "rgba(0, 0, 0, 0.25)",
    };
  }

  // 4. Default fallback: Minimal Theme
  return {
    ...minimalTheme,
    color: "#FE760B",
    hex: "#FE760B",
    pageBg: customPageBg || minimalTheme.pageBg,
    bg: customPageBg || minimalTheme.bg,
    cardBg: "#1A1C1F",
    cardBorder: "#2A2D31",
    inputBg: "#212327",
  };
}

/**
 * Ensures accent color maintains WCAG AA contrast against dark backgrounds.
 * If the hex color is dark (e.g. deep purple #4C1D95 or dark navy #1E3A8A),
 * it returns a brightened, vibrant tint (e.g. #B899E6) preserving the hue
 * so icons, indicator dots, and accents are 100% visible on #131517 / #1A1C1F.
 */
export function getReadableAccentColor(hexColor = "#FE760B", isDark = true) {
  if (!hexColor || typeof hexColor !== "string") return "#FE760B";
  const clean = hexColor.trim();
  const hexMatch = clean.match(/^#?([0-9a-f]{6}|[0-9a-f]{3})$/i);
  if (!hexMatch) return hexColor;

  let hex = hexMatch[1];
  if (hex.length === 3) {
    hex = hex.split("").map((c) => c + c).join("");
  }

  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);

  // Perceptual relative luminance (standard ITU-R BT.709 / WCAG)
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

  if (isDark) {
    if (lum < 0.45) {
      const lift = Math.max(0.42, (0.55 - lum) / Math.max(0.1, 1 - lum));
      const newR = Math.min(255, Math.round(r + (255 - r) * lift));
      const newG = Math.min(255, Math.round(g + (255 - g) * lift));
      const newB = Math.min(255, Math.round(b + (255 - b) * lift));
      return `#${newR.toString(16).padStart(2, "0")}${newG.toString(16).padStart(2, "0")}${newB.toString(16).padStart(2, "0")}`;
    }
    return `#${hex}`;
  } else {
    if (lum > 0.65) {
      const drop = 0.55 / lum;
      const newR = Math.max(0, Math.round(r * drop));
      const newG = Math.max(0, Math.round(g * drop));
      const newB = Math.max(0, Math.round(b * drop));
      return `#${newR.toString(16).padStart(2, "0")}${newG.toString(16).padStart(2, "0")}${newB.toString(16).padStart(2, "0")}`;
    }
    return `#${hex}`;
  }
}

/**
 * Returns '#000000' or '#FFFFFF' for highest contrast on top of a solid background color
 */
export function getReadableButtonTextColor(bgColor = "#FE760B") {
  if (!bgColor || typeof bgColor !== "string") return "#FFFFFF";
  const clean = bgColor.trim();
  const hexMatch = clean.match(/^#?([0-9a-f]{6}|[0-9a-f]{3})$/i);
  if (!hexMatch) return "#FFFFFF";

  let hex = hexMatch[1];
  if (hex.length === 3) {
    hex = hex.split("").map((c) => c + c).join("");
  }

  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? "#000000" : "#FFFFFF";
}
