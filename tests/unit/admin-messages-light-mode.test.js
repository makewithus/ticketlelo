import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

describe("Admin Messages & Light Mode UI Verification", () => {
  test("globals.css excludes .tl-bare-input from forced system background and focus borders", () => {
    const cssPath = path.join(projectRoot, "src/app/(app)/globals.css");
    const cssContent = fs.readFileSync(cssPath, "utf-8");

    assert.ok(
      cssContent.includes("input:not(.tl-bare-input)"),
      "globals.css must use :not(.tl-bare-input) to avoid overriding inline/bare inputs"
    );
    assert.ok(
      cssContent.includes(".tl-system-theme input.tl-bare-input"),
      "globals.css must explicitly style .tl-bare-input as transparent with no border"
    );
    assert.ok(
      cssContent.includes("background-color: transparent !important;"),
      ".tl-bare-input must have transparent background"
    );
  });

  test("admin/messages/page.jsx uses tl-bare-input on quick compose input bar", () => {
    const pagePath = path.join(
      projectRoot,
      "src/app/(app)/admin/messages/page.jsx"
    );
    const pageContent = fs.readFileSync(pagePath, "utf-8");

    assert.ok(
      pageContent.includes("tl-bare-input"),
      "Quick compose input must have tl-bare-input class"
    );
    assert.ok(
      pageContent.includes("bg-white dark:bg-[#1A1C1F]"),
      "Quick compose bar must have clean white background in light mode"
    );
    assert.ok(
      pageContent.includes("border-[#D9DBE0] dark:border-[#2A2D31]"),
      "Quick compose bar must have proper contrast border in light mode"
    );
    assert.ok(
      pageContent.includes("focus-within:border-[#FE760B]"),
      "Quick compose bar must have focus-within highlighting"
    );
  });

  test("admin/messages/page.jsx status badges provide high-contrast light and dark mode styles", () => {
    const pagePath = path.join(
      projectRoot,
      "src/app/(app)/admin/messages/page.jsx"
    );
    const pageContent = fs.readFileSync(pagePath, "utf-8");

    // Scheduled: light blue pill in light mode, dark blue in dark mode
    assert.ok(
      pageContent.includes("bg-[#EFF6FF] dark:bg-[#192738]"),
      "Scheduled badge must support light mode tint"
    );
    // Sent: light green pill in light mode, dark green in dark mode
    assert.ok(
      pageContent.includes("bg-[#ECFDF5] dark:bg-[#183124]"),
      "Sent badge must support light mode tint"
    );
    // Failed: light red pill in light mode, dark red in dark mode
    assert.ok(
      pageContent.includes("bg-[#FEF2F2] dark:bg-[#2A1717]"),
      "Failed badge must support light mode tint"
    );
    // Draft: light slate pill in light mode, dark surface in dark mode
    assert.ok(
      pageContent.includes("bg-[#F8FAFC] dark:bg-[#212327]"),
      "Draft badge must support light mode tint"
    );
  });

  test("EventControlHeader supports light mode and resolves event title dynamically", () => {
    const headerPath = path.join(
      projectRoot,
      "components/admin/event-control-header.jsx"
    );
    const headerContent = fs.readFileSync(headerPath, "utf-8");

    assert.ok(
      headerContent.includes("text-[#061A3F] dark:text-white"),
      "Header must use #061A3F dark navy text in light mode"
    );
    assert.ok(
      headerContent.includes("border-[#D9DBE0] dark:border-[#2A2D31]"),
      "Subtabs border must adapt to light mode"
    );
    assert.ok(
      headerContent.includes("getEvent(currentEventId)"),
      "Header should dynamically resolve title if eventId is provided"
    );
  });

  test("Firestore event loaders deduplicate by true document id", async () => {
    const firestorePath = path.join(projectRoot, "lib/firestore.js");
    const content = fs.readFileSync(firestorePath, "utf-8");

    assert.ok(
      content.includes("if (!seen.has(trueId))"),
      "getAllEvents and getEventsByOrganiser must deduplicate by doc.id"
    );
    assert.ok(
      content.includes("list.push({ ...data, id: trueId })"),
      "id must never be overridden by arbitrary doc data"
    );
  });
});
