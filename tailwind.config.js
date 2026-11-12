/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
    "./app/**/*.{js,jsx}",
    "./src/**/*.{js,jsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      screens: {
        xs: "380px",
      },
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: [
          "var(--font-mono)",
          "JetBrains Mono",
          "ui-monospace",
          "monospace",
        ],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // ─── Ticketlelo Official Brand Design System ───────────────────────────────
        tl: {
          orange:       "#FE760B", // --tl-orange (Live state, accent button, active switch)
          "orange-hover": "#FF8A2B", // --tl-orange-hover (Hover on orange buttons)
          "orange-text":  "#FF9A4D", // --tl-orange-text (Links and text on dark)
          yellow:       "#FDE003", // --tl-yellow (Logo ticket, pending/warning, chart base)
          green:        "#3DD68C", // --tl-green (Published, checked in, paid, approved, saved)
          red:          "#FF6B6B", // --tl-red (Failed, rejected, invalid, over limit)
          "red-text":   "#FF9A9A", // --tl-red-text (Error messages & destructive button text)
          blue:         "#7AA2FF", // --tl-blue (Scheduled, coupons, informational)
          "chart-1":    "#F9F669", // --tl-chart-1 (Lowest / oldest layer)
          "chart-2":    "#F8AE39", // --tl-chart-2 (Second layer)
          "chart-3":    "#FE6833", // --tl-chart-3 (Third layer)
          "chart-4":    "#D31817", // --tl-chart-4 (Highest / newest layer)
          bg:           "#131517", // --tl-bg (Canvas page background)
          s1:           "#1A1C1F", // --tl-s1 (Surface 1: cards, list containers)
          s2:           "#212327", // --tl-s2 (Surface 2: dropdowns, modals, drawers)
          s3:           "#2A2D31", // --tl-s3 (Surface 3: selected segment, avatar fallback, borders)
          plot:         "#000000", // --tl-plot (Chart plot area only)
          t1:           "#FFFFFF", // --tl-t1 (Headings, body, primary button text)
          t2:           "#D0D0D1", // --tl-t2 (Supporting copy)
          t3:           "#9B9EA4", // --tl-t3 (Labels, meta, icons)
          off:          "#5C6066", // --tl-off (Dots and disabled states only)
        },
        brand: {
          primary:      "#FE760B", // Ticket Orange
          hover:        "#FF8A2B", // Orange Hover
          text:         "#FF9A4D", // Orange text
          accent:       "#FDE003", // Sunny Yellow
          gradient:     "#FF8A2B",
        },
        // Surfaces & Neutrals
        canvas:         "#131517",
        surface: {
          1:            "#1A1C1F",
          2:            "#212327",
          3:            "#2A2D31",
        },
        // Light theme mapping
        light: {
          bg:           "#F7F5EE",
          surface:      "#FFFDFA",
          secondary:    "#F7F5EE",
          text:         "#061A3F",
          textSecondary:"#4A566F",
          muted:        "#4A566F",
          border:       "#D9DBE0",
          accent:       "#FE760B",
        },
        // Dark theme (Canvas & Surfaces)
        dark: {
          bg:           "#131517",
          surface:      "#1A1C1F",
          elevated:     "#212327",
          text:         "#FFFFFF",
          textSecondary:"#D0D0D1",
          muted:        "#9B9EA4",
          border:       "#2A2D31",
        },
        // Functional Status Colors
        success:  { DEFAULT: "#3DD68C", dark: "#3DD68C" },
        warning:  { DEFAULT: "#FDE003", dark: "#FDE003" },
        error:    { DEFAULT: "#FF6B6B", dark: "#FF6B6B" },
        info:     { DEFAULT: "#7AA2FF", dark: "#7AA2FF" },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(24px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-left": {
          from: { opacity: "0", transform: "translateX(-24px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "slide-in-right": {
          from: { opacity: "0", transform: "translateX(24px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.95)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        shimmer: {
          from: { backgroundPosition: "200% 0" },
          to: { backgroundPosition: "-200% 0" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(99, 102, 241, 0.2)" },
          "50%": { boxShadow: "0 0 0 12px rgba(99, 102, 241, 0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.5s ease-out forwards",
        "fade-in-up": "fade-in-up 0.6s ease-out forwards",
        "slide-in-left": "slide-in-left 0.5s ease-out forwards",
        "slide-in-right": "slide-in-right 0.5s ease-out forwards",
        "scale-in": "scale-in 0.4s ease-out forwards",
        float: "float 3s ease-in-out infinite",
        shimmer: "shimmer 3s ease-in-out infinite",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
