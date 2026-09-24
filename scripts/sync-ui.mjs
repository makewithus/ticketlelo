#!/usr/bin/env node
/**
 * Sync the UI-dev's static Webflow export (../ticketlelo-ui) into this Next.js app.
 *
 *   node scripts/sync-ui.mjs [path/to/ticketlelo-ui]
 *
 * What it does (no manual editing of the UI markup is ever needed):
 *   1. Copies the static assets (css, js, images, fonts, ...) into /public.
 *   2. Converts index.htm / privacy.htm / terms.htm into
 *      src/ui/generated/<page>.js  (head styles, body HTML, ordered script list).
 *
 * The only changes made to the UI markup are the "wiring" rules in WIRING below
 * (pointing dead "#" buttons / template links at real app routes).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const uiDir = path.resolve(root, process.argv[2] || "../ticketlelo-ui");
const publicDir = path.join(root, "public");
const outDir = path.join(root, "src/ui/generated");

if (!fs.existsSync(path.join(uiDir, "index.htm"))) {
  console.error(`UI folder not found: ${uiDir}`);
  process.exit(1);
}

// ───────────────────────── 1. assets ─────────────────────────
const ASSET_DIRS = [
  "65c9009e540efb0e283997c5",
  "65c930324b6cb77326f580e0",
  "ajax",
  "css",
  "favicon",
  "image",
  "js",
  "logo",
  "npm",
  "static",
];
for (const d of ASSET_DIRS) {
  fs.cpSync(path.join(uiDir, d), path.join(publicDir, d), { recursive: true });
}

// ticketlelo.css references the Object Sans fonts and a few images as
// "../<file>" (site root) while the export keeps them inside 65c9009e.../.
// Mirror them to the site root so those URLs resolve.
{
  const css = fs.readFileSync(path.join(uiDir, "css/ticketlelo.css"), "utf8");
  for (const m of css.matchAll(/url\(\.\.\/([^)/]+)\)/g)) {
    const src = path.join(uiDir, "65c9009e540efb0e283997c5", m[1]);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(publicDir, m[1]));
  }
}

// The HTML references some files with a different Unicode normalization (NFD)
// than the name on disk (NFC), which 404s on Linux. Provide both spellings.
for (const d of ASSET_DIRS) {
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { walk(full); continue; }
      for (const form of ["NFC", "NFD"]) {
        const alt = e.name.normalize(form);
        if (alt !== e.name && !fs.existsSync(path.join(dir, alt))) {
          fs.copyFileSync(full, path.join(dir, alt));
        }
      }
    }
  };
  walk(path.join(publicDir, d));
}

// ───────────────────────── 2. pages ─────────────────────────
const PAGES = {
  index: { file: "index.htm", route: "/" },
  privacy: { file: "privacy.htm", route: "/privacy" },
  terms: { file: "terms.htm", route: "/terms" },
};

// Page-to-route link rewrites
const LINKS = {
  "index.htm": "/",
  "privacy.htm": "/privacy",
  "terms.htm": "/terms",
};

// Buttons in the design that had no real destination ("#") or pointed at the
// template's original owner. Matched on the button's visible text.
const WIRING = [
  { text: /^Get Started$/, near: "go_bot", href: "/host-event" },
  { text: /^Create Your Event/, href: "/host-event" },
  { text: /^Get Started$/, near: "Free Plan", href: "/host-event" },
  { text: /^Choose Pro$/, href: "/pricing" },
  { text: /^Choose Premium$/, href: "/pricing" },
  { text: /^Choose Enterprise$/, href: "mailto:sales@ticketlelo.com" },
  { text: /^Scan$/, href: "mailto:sales@ticketlelo.com" },
  { text: /^Fast Ticket Booking$/, href: "/host-event" },
  { text: /^Event Analytics$/, href: "/host-event" },
  { text: /^Start Creating$/, href: "/host-event" },
  { text: /^Clutter-free scan$/, href: "/host-event" },
];

const stripComments = (s) => s.replace(/<!--[\s\S]*?-->/g, "");
const isTracking = (code) => /mc\.yandex\.ru|\bym\(|_ym_uid|paywall\.pw/.test(code);

function extract(html) {
  html = stripComments(html);
  const htmlTag = html.match(/<html\b([^>]*)>/i)[1];
  const attr = (n) => (htmlTag.match(new RegExp(`${n}="([^"]*)"`)) || [])[1];
  const headSrc = html.slice(html.indexOf("<head>") + 6, html.indexOf("</head>"));
  const bodyOpen = html.match(/<body\b([^>]*)>/i);
  let body = html.slice(
    bodyOpen.index + bodyOpen[0].length,
    html.lastIndexOf("</body>"),
  );

  const scripts = [];
  const styles = [];
  const stylesheets = [];

  const takeScripts = (src) =>
    src.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (_, a, code) => {
      const s = a.match(/\bsrc="([^"]*)"/);
      if (s) {
        scripts.push({ src: s[1] });
      } else if (code.trim() && !isTracking(code)) {
        scripts.push({ code: code.trim() });
      }
      return "";
    });

  // head
  let head = takeScripts(headSrc);
  head = head.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (_, c) => {
    styles.push(c.trim());
    return "";
  });
  const meta = {};
  meta.title = (head.match(/<title>([\s\S]*?)<\/title>/i) || [])[1]?.trim();
  for (const m of head.matchAll(/<meta\b([^>]*)>/gi)) {
    const a = m[1];
    const content = (a.match(/content="([^"]*)"/) || [])[1];
    const key =
      (a.match(/\bname="([^"]*)"/) || [])[1] ||
      (a.match(/\bproperty="([^"]*)"/) || [])[1];
    if (key && content !== undefined) meta[key] = content;
  }
  for (const m of head.matchAll(/<link\b([^>]*)>/gi)) {
    if (/rel="stylesheet"/.test(m[1])) {
      stylesheets.push(m[1].match(/href="([^"]*)"/)[1]);
    }
  }

  // body
  body = takeScripts(body);
  body = body.replace(/<link\b([^>]*rel="stylesheet"[^>]*)>/gi, (_, a) => {
    stylesheets.push(a.match(/href="([^"]*)"/)[1]);
    return "";
  });
  body = body.replace(/<noscript>[\s\S]*?<\/noscript>/gi, (m) =>
    /watch\/\d+/.test(m) ? "" : m,
  );

  return {
    htmlAttrs: {
      "data-wf-domain": attr("data-wf-domain"),
      "data-wf-page": attr("data-wf-page"),
      "data-wf-site": attr("data-wf-site"),
    },
    bodyClass: (bodyOpen[1].match(/class="([^"]*)"/) || [])[1] || "",
    meta,
    styles,
    stylesheets,
    scripts,
    body,
  };
}

/** Make relative asset URLs root-relative so they work from any route. */
function absolutize(body) {
  const dirs = ASSET_DIRS.map((d) => d.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const re = new RegExp(`((?:src|href|data-src|srcset)=["'])(?=(?:${dirs})/)`, "g");
  let out = body.replace(re, "$1/");
  // srcset lists: "a.png 500w, b.png 800w"
  out = out.replace(/srcset="([^"]*)"/g, (_, v) =>
    `srcset="${v
      .split(",")
      .map((p) => p.trim())
      .map((p) => (new RegExp(`^(?:${dirs})/`).test(p) ? "/" + p : p))
      .join(", ")}"`,
  );
  // inline style url(...)
  out = out.replace(new RegExp(`url\\((["']?)(?=(?:${dirs})/)`, "g"), "url($1/");
  return out;
}

function rewriteLinks(body) {
  let out = body;
  for (const [from, to] of Object.entries(LINKS)) {
    out = out.replace(new RegExp(`href="${from}"`, "g"), `href="${to}"`);
  }
  return out;
}

/** Point CTA buttons at real routes (see WIRING). */
function wireButtons(body) {
  const wired = [];
  const out = body.replace(
    /<a\b([^>]*)>([\s\S]*?)<\/a>/g,
    (full, attrs, inner) => {
      if (!/href="(#|https?:\/\/(t\.me|platform\.easyon\.ist)[^"]*)"/.test(attrs)) return full;
      const text = inner
        .replace(/<svg[\s\S]*?<\/svg>/g, "")
        .replace(/<[^>]+>/g, "\n")
        .split("\n")
        .map((t) => t.trim())
        .filter(Boolean);
      if (!text.length) return full;
      for (const rule of WIRING) {
        if (!rule.text.test(text[0])) continue;
        if (rule.near === "go_bot" && !/\bgo_bot\b/.test(attrs)) continue;
        if (rule.near === "Free Plan" && !text.includes("Free Plan")) continue;
        const newAttrs = attrs
          .replace(/href="[^"]*"/, `href="${rule.href}"`)
          .replace(/\s*target="_blank"/, "");
        wired.push(`${text[0]} -> ${rule.href}`);
        return `<a${newAttrs}>${inner}</a>`;
      }
      return full;
    },
  );
  return { out, wired };
}

// Mount point for the live (Firestore) events list, placed right where the UI dev
// had the (commented-out) events section: after the "Organizer Tools" block.
// The design has no entry points for the app's login / hosting flows, so they are
// appended to the footer "Navigation" list using the design's own footer-link class.
const FOOTER_LINKS = [
  ["/#events", "Upcoming Events"],
  ["/host-event", "Host Your Event"],
  ["/user-login", "Sign In"],
  ["/organiser-login", "Organiser Login"],
  ["/super-admin-login", "Super Admin"],
];
function addFooterLinks(body) {
  const anchor = 'class="footer-link">Contact Us</a>';
  const at = body.indexOf(anchor);
  if (at < 0) throw new Error("footer anchor not found");
  const end = at + anchor.length;
  const extra = FOOTER_LINKS.map(
    ([href, label]) => `\n<a href="${href}" class="footer-link">${label}</a>`,
  ).join("");
  return body.slice(0, end) + extra + body.slice(end);
}

const EVENTS_MARKER = '<div id="tl-events-root"></div>';
function insertEventsRoot(body) {
  const anchor = body.indexOf("Complete control over your event registration platform");
  const end = body.indexOf("</section>", anchor);
  if (anchor < 0 || end < 0) throw new Error("events anchor not found in index.htm");
  return body.slice(0, end + 10) + EVENTS_MARKER + body.slice(end + 10);
}

fs.mkdirSync(outDir, { recursive: true });
for (const [name, { file }] of Object.entries(PAGES)) {
  const data = extract(fs.readFileSync(path.join(uiDir, file), "utf8"));
  let body = rewriteLinks(absolutize(data.body));
  if (name === "index") {
    body = insertEventsRoot(body);
    body = addFooterLinks(body);
    const w = wireButtons(body);
    body = w.out;
    console.log(`[${name}] wired ${w.wired.length} buttons:`, w.wired);
  }
  const page = { ...data, body };
  page.stylesheets = page.stylesheets.map((s) => (/^(https?:|\/)/.test(s) ? s : "/" + s));
  page.scripts = page.scripts.map((s) =>
    s.src && !/^(https?:|\/)/.test(s.src) ? { src: "/" + s.src } : s,
  );
  fs.writeFileSync(
    path.join(outDir, `${name}.js`),
    `// AUTO-GENERATED by scripts/sync-ui.mjs from ticketlelo-ui/${file} - do not edit by hand.\n` +
      `const page = ${JSON.stringify(page, null, 1)};\nexport default page;\n`,
  );
  console.log(
    `[${name}] body ${(body.length / 1024).toFixed(0)}KB, ${page.scripts.length} scripts, ${page.styles.length} styles`,
  );
}
