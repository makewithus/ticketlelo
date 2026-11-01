# TicketLelo Brand Style Guide & Design System

> **Official Brand & UI Specification**  
> *Version 2.5 — Design Systems Team*  
> *This document is the single source of truth for all product design, UI development, and feature implementation across the TicketLelo platform.*
>
> ⚠️ **Strict Scope Rule:** The landing page (`src/app/(site)/**`) uses an isolated, specialized presentation framework. **Never apply application UI changes to the landing page.** All application and dashboard interfaces must strictly follow this guide.

---

## 1. Brand Foundations

TicketLelo helps college and community organisers sell tickets, check guests in, and keep everyone informed. The interface must feel like a **calm control room with one bright, friendly signal: the orange ticket**.

### Three Core Pillars

| Pillar | Dot Color | Core Meaning & Experience |
| :--- | :--- | :--- |
| **Quick** | Orange (`#FE760B`) | Every common job — create, share, check in — is one or two clicks from the Events page. Minimize steps, eliminate unnecessary confirmation screens, and provide rapid keyboard and one-tap interactions. |
| **Clear** | Green (`#3DD68C`) | Plain words, one main action per view, and status you can read from across the room. Clear hierarchy with high contrast text. |
| **Lively** | Yellow (`#FDE003`) | Event covers and the orange accent bring energy. Everything else stays quiet and restrained so the user's content can shine. |

### Five Design Principles

1. **Dark, Calm Canvas**  
   Near-black background (`#131517`) and soft grey surfaces (`#1A1C1F`, `#212327`, `#2A2D31`). **No gradients** across the screen except for the faint top ambient glow. Depth is built with progressively lighter surfaces, not heavy drop shadows.
2. **One Bright Idea**  
   Orange marks what is live or most important. **If everything is orange, nothing is.** Brand orange (`#FE760B`) is strictly budgeted across the screen.
3. **Status at a Glance**  
   Every state is a **dot plus a word**, in the same place, with the same words, on every screen. Never use icon-only or color-only status indicators.
4. **Content First**  
   Covers, event names, and numbers lead. Chrome — borders, icons, labels, backgrounds — steps back into calm neutrals.
5. **Honest Data**  
   Show only real numbers. Empty states explain exactly what will appear and what action triggers it, never fake data or misleading placeholders.

---

## 2. Proportion & Screen Area Budget

To preserve the calm control-room feel, UI screens must strictly respect the established visual weight budget:

```
┌───────────────────────────────────────────────┬────────────┬───────┬────┬──┐
│ 70% Canvas                                    │ 18% Surface│ 7% Txt│ 4% │1%│
└───────────────────────────────────────────────┴────────────┴───────┴────┴──┘
                                                              Orange ▲  ▲ Yellow
```

* **70% Canvas (`#131517`):** The calm, dark foundation across all application views.
* **18% Surfaces (`#1A1C1F`, `#212327`, `#2A2D31`):** Content containers, cards, dialogs, drawers, and sidebars.
* **7% Text & White Buttons (`#FFFFFF`, `#D0D0D1`, `#9B9EA4`):** Readable copy, headlines, and clean white secondary action buttons.
* **4% Ticket Orange (`#FE760B`):** Reserved exclusively for live signals, primary CTAs, and active toggles.
* **1% Sunny Yellow (`#FDE003`):** Logo ticket perforation symbol, pending badges, and warning dots.

---

## 3. Logo System

Always use the supplied PNG files. **Never retype, redraw, trace, or rebuild the logo.**

```
Approved Assets in public directory:
├── /logo/ticketlelo-logo-full.png  (also at /ticketlelo-logo-full.png)
└── /logo/ticketlelo-logo-nav.png   (also at /ticketlelo-logo-nav.png)
```

### Approved Versions

#### 1. Full Lockup (`ticketlelo-logo-full.png`)
* **Components:** Perforated yellow ticket symbol + "Ticket" + Hindi "लेलो" on the orange banner + connected tagline badge *"Smart Ticketing. Total Control. One Click."*
* **When to use:** Sign-in / sign-up pages, welcome screens, the homepage hero, email headers, generated ticket PDFs, invoices, and printed collateral.
* **Size constraints:**
  * Minimum width on screen: **200px**
  * Minimum width on print: **40mm**

#### 2. Wordmark (`ticketlelo-logo-nav.png`)
* **Components:** Perforated yellow ticket symbol + "Ticket" + Hindi "लेलो" on the rounded orange banner (without tagline).
* **When to use:** Top navigation bars, mobile headers, sidebars, footers, ticket email footers, and anywhere height is constrained.
* **Size constraints:**
  * Standard height in navigation: **30px**
  * Minimum height on screen: **24px**

### Anatomy & Clear Space

```
       ┌───────────┐
       │   TICKET  │  <-- [A] Yellow Ticket with perforation (Brand Symbol)
       └─────┬─────┘
   ┌─────────┴─────────────┐ ┌───────────────────┐
   │      Ticket लेलो      │-│  Tagline Tag [C]  │
   └───────────────────────┘ └───────────────────┘
     ^-- [B] Wordmark on Orange Band
```

* **[A] Ticket Symbol:** Sunny yellow (`#FDE003`) folded ticket with die-cut notch and perforation dots.
* **[B] Wordmark:** "Ticket" (white bold sans) + "लेलो" (white Hindi Devanagari script) seated on the Ticket Orange band.
* **[C] Tagline Tag:** Rounded callout tag with white copy *"Smart Ticketing. Total Control. One Click."* (only on full lockup).
* **[X] Clear Space Rule:** Keep at least the height of the ticket notch (**~10% of total logo height**) completely clear on all 4 sides. No text, buttons, dividers, or graphic elements may intrude into this margin.

### Approved Backgrounds

* ✅ **Canvas (`#131517`):** Primary approved background for dark mode / default theme.
* ✅ **Surface (`#212327` / `#1A1C1F`):** Approved for cards, modals, drawers, and headers.
* ✅ **White / Light theme (`#FFFFFF` / `#FFFDFA`):** Approved for printed tickets, white emails, and paper exports.
* ❌ **Prohibited:** NEVER place the logo on an orange (`#FE760B`) or yellow (`#FDE003`) background.

### Strict Logo Misuse Rules

* 🚫 **Don't stretch or squash:** Always lock aspect ratio (`1:1` scaling).
* 🚫 **Don't recolour:** Never change the yellow ticket or orange banner to blue, pink, red, green, or monochrome.
* 🚫 **Don't rotate:** Logo must remain at its designed angle. Never tilt, flip, or spin.
* 🚫 **Don't add glows or shadows:** No outer glow, neon filters, drop-shadows, or heavy bevels.
* 🚫 **Don't crop:** Never cut off the ticket notch, perforation, or Hindi typography.
* 🚫 **Don't place on busy images:** Avoid placing the logo over detailed event photos without a darkened overlay.

---

## 4. Color System & Design Tokens

Orange and yellow come straight from the logo. Neutrals carry the interface. Status colours are only for status. All contrast ratios are measured against the calm canvas (`#131517`).

### 1. Brand Tokens

| Name | CSS Variable | Tailwind Token | HEX | RGB | Contrast | Usage |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Ticket Orange** | `--tl-orange` | `tl-orange` / `brand-primary` | `#FE760B` | `254, 118, 11` | **6.8:1** (Pass) | Primary live state, primary CTA button background, active toggles |
| **Orange Hover** | `--tl-orange-hover` | `tl-orange-hover` / `brand-hover` | `#FF8A2B` | `255, 138, 43` | **7.6:1** (Pass) | Hover state on orange buttons & active chips |
| **Orange Text** | `--tl-orange-text` | `tl-orange-text` / `brand-text` | `#FF9A4D` | `255, 154, 77` | **8.7:1** (Pass) | Text links ("View all →") and orange highlights on dark surfaces |
| **Sunny Yellow** | `--tl-yellow` | `tl-yellow` / `brand-accent` | `#FDE003` | `253, 224, 3` | **13.8:1** (Pass) | Logo ticket symbol, pending/warning badge dots, chart base |

### 2. Surface Tokens (Depth With Lighter Greys, Not Shadows)

| Name | CSS Variable | Tailwind Token | HEX | RGB | Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Canvas** | `--tl-bg` | `tl-bg` / `canvas` | `#131517` | `19, 21, 23` | Default page background |
| **Surface 1** | `--tl-s1` | `tl-s1` / `surface-1` | `#1A1C1F` | `26, 28, 31` | Cards, table containers, list containers, sidebars |
| **Surface 2** | `--tl-s2` | `tl-s2` / `surface-2` | `#212327` | `33, 35, 39` | Dropdowns, modals, floating panels, drawers, inputs |
| **Surface 3** | `--tl-s3` | `tl-s3` / `surface-3` | `#2A2D31` | `42, 45, 49` | Selected segments, active tab pills, avatar fallbacks, borders |
| **Plot** | `--tl-plot` | `tl-plot` | `#000000` | `0, 0, 0` | Analytics chart plot area background only |

### 3. Text & Typography Tokens

| Name | CSS Variable | Tailwind Token | HEX | RGB | Contrast | Usage |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Text (Primary)** | `--tl-t1` | `tl-t1` / `text-white` | `#FFFFFF` | `255, 255, 255` | **18.3:1** | Headings, titles, body text |
| **Text Secondary**| `--tl-t2` | `tl-t2` | `#D0D0D1` | `208, 208, 209` | **11.9:1** | Supporting copy, descriptions (`rgba(255,255,255,0.80)`) |
| **Muted** | `--tl-t3` | `tl-t3` / `muted-foreground` | `#9B9EA4` | `155, 158, 164` | **6.8:1** | Field labels, captions, metadata, inactive icons |
| **Off** | `--tl-off` | `tl-off` | `#5C6066` | `92, 96, 102` | **2.9:1** | Disabled indicators & off-state dots only — **never for readable text** |

### 4. Status Indicator Tokens (Dot + Word Pattern)

Status colors are **only for status**. Pair with a word. Badge background = colour at 12–14% opacity.

| Name | Token | HEX | RGB | Contrast | Use For |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Success** | `--tl-green` | `#3DD68C` | `61, 214, 140` | **9.8:1** (Pass) | Published, checked in, paid, approved, saved |
| **Warning** | `--tl-yellow` | `#FDE003` | `253, 224, 3` | **13.8:1** (Pass) | Pending, payment pending, unsaved, duplicate |
| **Error** | `--tl-red` | `#FF6B6B` | `255, 107, 107` | **6.6:1** (Pass) | Failed, rejected, invalid, over limit |
| **Error text** | `--tl-red-text` | `#FF9A9A` | `255, 154, 154` | **9.0:1** (Pass) | Error messages and destructive button text |
| **Info** | `--tl-blue` | `#7AA2FF` | `122, 162, 255` | **7.4:1** (Pass) | Scheduled, coupons, informational |

### 5. Tints for Badges

Badges use the status colour at **12–14% opacity as background**, with the full colour (or its lighter text version) for the dot and label.

| Status Badge | Background Tint | Dot Color | Label Text Color | Example Markup Pattern |
| :--- | :--- | :--- | :--- | :--- |
| **Live** | `rgba(254, 118, 11, 0.14)` | `#FE760B` | `#FE760B` / `#FF9A4D` | `<span class="bg-[#FE760B]/14 text-[#FE760B]">● Live</span>` |
| **Published** | `rgba(61, 214, 140, 0.12)` | `#3DD68C` | `#3DD68C` | `<span class="bg-[#3DD68C]/12 text-[#3DD68C]">● Published</span>` |
| **Pending** | `rgba(253, 224, 3, 0.10)` | `#FDE003` | `#FDE003` | `<span class="bg-[#FDE003]/10 text-[#FDE003]">● Pending</span>` |
| **Failed** | `rgba(255, 107, 107, 0.12)` | `#FF6B6B` | `#FF9A9A` | `<span class="bg-[#FF6B6B]/12 text-[#FF9A9A]">● Failed</span>` |
| **Scheduled** | `rgba(122, 162, 255, 0.12)` | `#7AA2FF` | `#7AA2FF` | `<span class="bg-[#7AA2FF]/12 text-[#7AA2FF]">● Scheduled</span>` |
| **Draft** | `rgba(255, 255, 255, 0.07)` | `#5C6066` | `#D0D0D1` | `<span class="bg-white/7 text-[#D0D0D1]">● Draft</span>` |

### 6. Chart Ramp

Stacked bars on the black plot (`#000000`), bottom to top:

| Name | Token | HEX | RGB | Contrast | Use For |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Chart 1** | `--tl-chart-1` | `#F9F669` | `249, 246, 105` | `• —` | Lowest / oldest layer |
| **Chart 2** | `--tl-chart-2` | `#F8AE39` | `248, 174, 57` | `• —` | Second layer |
| **Chart 3** | `--tl-chart-3` | `#FE6833` | `254, 104, 51` | `• —` | Third layer |
| **Chart 4** | `--tl-chart-4` | `#D31817` | `211, 24, 23` | `• —` | Highest / newest layer |

---

## 5. Pairing Rules & Accessibility Standards

### Strict Accessibility Pairing Rules

```
┌─────────────────────────────────┐   ┌─────────────────────────────────┐
│           [ Check In ]          │   │           [ Check In ]          │
│    Dark text on orange · 7.2:1  │   │    White on orange · 2.7:1 fails│
│            ✅ PASS              │   │            ❌ FAILS             │
└─────────────────────────────────┘   └─────────────────────────────────┘
┌─────────────────────────────────┐   ┌─────────────────────────────────┐
│           View all →            │   │           Muted label           │
│  Orange text #FF9A4D for links  │   │  #5C6066 is for dots only · 2.9:1│
│            ✅ PASS              │   │            ❌ FAILS             │
└─────────────────────────────────┘   └─────────────────────────────────┘
```

1. **Dark Text on Orange (`7.2:1` Contrast — PASSES):**
   * Primary buttons with Ticket Orange background (`#FE760B`) **must use dark text** (`#131517` or canvas dark) to meet WCAG AA/AAA standards (`7.2:1`).
2. **Never Use White Text on Orange (`2.7:1` Contrast — FAILS):**
   * White text (`#FFFFFF`) on `#FE760B` has an inaccessible contrast ratio of `2.7:1`. It fails WCAG standards and is strictly prohibited on orange button backgrounds.
3. **Orange Text (`#FF9A4D`) for Links:**
   * Text hyperlinks on dark surfaces use `--tl-orange-text` (`#FF9A4D`), giving `8.7:1` contrast against canvas.
4. **`#5C6066` is for Dots Only (`2.9:1` Contrast):**
   * `--tl-off` (`#5C6066`) fails contrast for readable body text and field labels. Use it **strictly for non-text indicator dots or disabled graphic states**. Use `--tl-t3` (`#9B9EA4`) for muted labels.

### Light Theme Mapping

Dark is the default. The light theme keeps TicketLelo's existing light tokens; brand and status colours stay the same.

| Role | Dark (Default) | Light | Description |
| :--- | :--- | :--- | :--- |
| **Background** | `#131517` | `#F7F5EE` | Page canvas background |
| **Surface** | `#1A1C1F` | `#FFFDFA` | Main card and panel surface |
| **Text** | `#FFFFFF` | `#061A3F` | Primary headings and body text |
| **Muted text** | `#9B9EA4` | `#4A566F` | Secondary copy, captions, and field labels |
| **Border** | `#2B2D31` | `#D9DBE0` | Container outlines and card dividers |
| **Accent** | `#FE760B` | `#FE760B` | Brand primary accent & live indicator (identical across themes) |

---

## 6. Typography & Type Scale

* **Inter:** For all interface text. Loaded from Google Fonts with weights `400, 500, 600, 700, 800`.
* **JetBrains Mono:** For ticket IDs, codes, URLs, and chart axes. Loaded from Google Fonts with weight `500`.

### Type Scale Specification

| Style | Size / Line | Weight | Tracking | Use | Sample / Example |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Display** | `60px / 1.02` | `800` | `-2px` | Homepage hero only | **Smart ticketing.** |
| **Title** | `46px / 1.05` | `700` | `-1.2px` | Public event title | **Tech Fest 2026** |
| **H1** | `32px / 1.2` | `700` | `-0.6px` | Page titles | **Events** |
| **H2** | `20px / 1.3` | `600` | `0` | Section titles | **Registration questions** |
| **Card title** | `20px / 1.25` | `600` | `0` | Event card names | **Praroha Gaming** |
| **H3** | `18px / 1.35` | `600` | `0` | Sub-sections | **At a glance** |
| **Body** | `15px / 1.45` | `400` | `0` | Default text | Guests can find it and register. |
| **Body small** | `14px / 1.45` | `500` | `0` | Buttons, list details | `Manage Event →` |
| **Caption** | `13px / 1.4` | `500` | `0` | Meta, help text | 64 of 150 seats left |
| **Label** | `12px / 1.3` | `600` | `0.6px` | Section labels (UPPERCASE) | `WHEN & WHERE` |
| **Mono** | `13px / 1.4` | `500` | `0` | IDs, URLs, axes (Orange) | `TKT-1793-AB12C` |

---

## 7. Editorial & Formatting Rules

* **Sentence Case Everywhere:**  
  Use sentence case for everything — titles, buttons, tabs, labels (e.g., *"Manage event"*, *"Hosting requests"*, *"Check in guest"*).  
  *The only exception is 12px section labels, which are uppercase (e.g., `WHEN & WHERE`).*
* **Line Length Limit:**  
  Keep body text under **~70 characters per line** for optimal reading comfort.
* **Tabular Figures for Numbers:**  
  Always use tabular figures (`font-variant-numeric: tabular-nums` or `tabular-nums` class) in tables, counters, percentages, and money columns to keep columns aligned.
* **Currency Formatting (Rupees):**  
  * Format: `"₹199"`, `"₹16,517"`  
  * Use **Indian digit grouping** (lakhs / crores, e.g. `₹1,00,000`).  
  * **No decimals for whole rupees** (never write `"₹199.00"`).
* **Date & Time Formatting:**  
  * In tables and compact lists: `"Thu, 29 Oct"`
  * On event pages and detail views: `"Thursday, 29 October"`
  * Times: `"12:00 PM"` (include `"GMT+5:30"` wherever time zones could be ambiguous).
* **Typography Constraints:**  
  * **No italics.**
  * **No underlines** except links on hover.
  * **No more than two font weights** in a single text block.

---

## 8. Component Implementation Guide

### 1. Buttons

* **Primary Accent Button:**
  * Background: `#FE760B` (`--tl-orange`)
  * Hover Background: `#FF8A2B` (`--tl-orange-hover`)
  * Active Background: `#FE760B`
  * Text Color: `#131517` (`--tl-bg`), font-medium or font-semibold (**Dark text on orange meets 7.2:1 contrast**)
  * Border: None
  * Border Radius: `8px` or `12px`
  * Shadow: None or subtle ambient `0 4px 14px rgba(254, 118, 11, 0.25)`
* **Secondary Surface Button:**
  * Background: `#1A1C1F` (`--tl-s1`) or `#212327` (`--tl-s2`)
  * Border: `1px solid #2A2D31` (`--tl-s3`)
  * Hover Background: `#2A2D31` (`--tl-s3`)
  * Text Color: `#FFFFFF`
* **White Secondary Button (Part of 7% Text & White Buttons budget):**
  * Background: `#FFFFFF`
  * Text: `#131517`
  * Hover: `#F3F4F6`
* **Ghost / Sub-action Button:**
  * Background: Transparent
  * Hover Background: `#1A1C1F`
  * Text Color: `#D0D0D1` (`--tl-t2`), hover `#FFFFFF`

### 2. Cards & Containers

* **Canvas to Card Layering:**
  * Page canvas is `#131517`.
  * Cards sit on Surface 1 (`#1A1C1F`).
  * Nested modules or input rows sit on Surface 2 (`#212327`).
* **Borders:** Subtle `1px solid #2A2D31` (`--tl-s3`). Never use thick or colored borders unless indicating focus.
* **Depth Without Shadows:** Visual hierarchy is built through progressive surface greys (`#131517` ➔ `#1A1C1F` ➔ `#212327` ➔ `#2A2D31`).

### 3. Inputs & Forms

* **Background:** Surface 2 (`#212327`) or Surface 1 (`#1A1C1F`).
* **Border:** `1px solid #2A2D31`.
* **Text:** `#FFFFFF` (`--tl-t1`).
* **Placeholder:** `#9B9EA4` (`--tl-t3`).
* **Focus State:** `border-color: #FE760B; outline: none; box-shadow: 0 0 0 2px rgba(254, 118, 11, 0.20);`
* **Labels:** Always `#9B9EA4` (`--tl-t3`) or `#D0D0D1` (`--tl-t2`). Section category tags use 12px uppercase (`0.6px` tracking).

### 4. Navigation & App Shell

* **Top Navigation:** Canvas `#131517` with subtle bottom border `#2A2D31`.
* **Logo:** Always use `ticketlelo-logo-nav.png` with height `30px` and appropriate clear space.
* **Navigation Links:** Neutral text `#D0D0D1` with hover to `#FFFFFF`. Active link highlighted with subtle surface or Ticket Orange indicator.
* **Main CTA:** Always use the Ticket Orange button with dark text.

### 5. Status Badges & Pills

Every status badge follows the strict pattern:
```html
<!-- Example: Published status -->
<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#3DD68C]/12 text-[#3DD68C]">
  <span class="w-1.5 h-1.5 rounded-full bg-[#3DD68C]"></span>
  Published
</span>
```
Always pair the solid dot with the exact word.

### 6. Empty States

* Never show fake data or generic illustration clutter.
* Use a quiet container on Surface 1 (`#1A1C1F`).
* Explain in plain words:
  1. What is currently empty (e.g., *"No tickets sold yet"*).
  2. Exactly what action is required to populate it (e.g., *"Publish your event link to start receiving attendee registrations"*).
  3. A single primary Ticket Orange action button (e.g., *"Copy event link"* or *"Create event"*).

---

## 9. Developer & PR Quality Checklist

Whenever adding a new feature or updating any page/component in the repository, you **MUST** verify against this checklist before merging:

- [ ] **Scope Protection:** Is the landing page (`src/app/(site)/**`) untouched and unchanged?
- [ ] **Canvas Color:** Is the root page background `#131517` (or `#F7F5EE` in light mode)?
- [ ] **Surface Progression:** Are cards using `#1A1C1F` (Surface 1) and dropdowns/modals using `#212327` (Surface 2)?
- [ ] **Screen Budget:** Does the view respect 70% canvas, 18% surfaces, 7% text & white buttons, 4% orange, 1% yellow?
- [ ] **Button Contrast Pairing:** Do orange primary buttons use **dark text** (`#131517`) to achieve 7.2:1 contrast? (No white text on orange buttons).
- [ ] **Link Color:** Do text hyperlinks use `--tl-orange-text` (`#FF9A4D`)?
- [ ] **No Muted Text Misuse:** Is `#5C6066` used only for dots and disabled non-text elements (never for readable text)?
- [ ] **Typography Scale:** Are font sizes, weights, and line heights aligned with the Inter type scale?
- [ ] **Monospace Usage:** Are ticket IDs, order codes, URLs, and chart axes rendered with JetBrains Mono (`--font-mono` / `500` weight)?
- [ ] **Status Rule:** Does every status indicator feature a **dot plus a word** (`dot + label`) with the exact 12–14% tint background?
- [ ] **Status Tokens:** Are status colors using `--tl-green` (`#3DD68C`), `--tl-yellow` (`#FDE003`), `--tl-red` (`#FF6B6B`), `--tl-red-text` (`#FF9A9A`), and `--tl-blue` (`#7AA2FF`)?
- [ ] **Chart Ramp:** Are stacked charts using the ramp from `--tl-chart-1` (`#F9F669`) up to `--tl-chart-4` (`#D31817`)?
- [ ] **Tabular Numbers:** Are tables, counters, and financial numbers styled with `tabular-nums`?
- [ ] **Currency & Dates:** Are currencies formatted as `"₹199"`, `"₹16,517"` without decimals, and dates following the standard?
- [ ] **Sentence Case:** Are all titles, buttons, tabs, and labels in sentence case (except 12px section labels)?
- [ ] **Official Logo File:** Does the view use `/logo/ticketlelo-logo-nav.png` (nav/mobile/footer) or `/logo/ticketlelo-logo-full.png` (auth/hero/PDF)?

---

*TicketLelo Engineering & Design — Keep it Quick, Clear, and Lively.*
