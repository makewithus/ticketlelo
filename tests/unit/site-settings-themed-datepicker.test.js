import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

test("Site Settings — Themed Date & Time Picker matches Event Calendar styling", async (t) => {
  const compPath = path.join(projectRoot, "components/admin/site-settings-manager.jsx");
  assert.ok(fs.existsSync(compPath), "site-settings-manager.jsx must exist");
  const content = fs.readFileSync(compPath, "utf-8");

  await t.test("Replaces native datetime-local picker with custom ThemedDateTimePickerPopover", () => {
    // Check that ThemedDateTimePickerPopover is implemented
    assert.match(
      content,
      /function ThemedDateTimePickerPopover/,
      "Must define ThemedDateTimePickerPopover component"
    );

    // Verify it doesn't use the raw type='datetime-local' which shows the unstyled Chromium popup
    assert.doesNotMatch(
      content,
      /type="datetime-local"/,
      "Must not expose native unstyled type='datetime-local' input"
    );

    // Verify it maintains underlying input for form serialization & programmatic access
    assert.match(
      content,
      /type="hidden"\s+name="countdownAt"/,
      "Must maintain hidden input with countdownAt for programmatic access"
    );
  });

  await t.test("ThemedDateTimePickerPopover matches Event Calendar styling tokens", () => {
    // Check brand color #FE760B
    assert.match(
      content,
      /#FE760B/,
      "Must use TicketLelo brand orange #FE760B for selected states and accents"
    );

    // Check dark canvas styling matching Image 1 & Event Create Studio
    assert.match(
      content,
      /bg-\[#181512\]/,
      "Must use #181512 dark canvas background matching Event Calendar"
    );
    assert.match(
      content,
      /border-white\/20/,
      "Must use subtle translucent border border-white/20"
    );
    assert.match(
      content,
      /rounded-2xl/,
      "Must use rounded-2xl corners"
    );
    assert.match(
      content,
      /shadow-2xl/,
      "Must use deep shadow-2xl elevation"
    );
  });

  await t.test("Implements complete Calendar and Time controls with real-time sync", () => {
    // Month navigation with ChevronLeft / ChevronRight
    assert.match(content, /ChevronLeft/, "Must import and use ChevronLeft for month navigation");
    assert.match(content, /ChevronRight/, "Must import and use ChevronRight for month navigation");

    // Hours (00-23) and Minutes (00-59)
    assert.match(content, /HOURS/, "Must define 24-hour options");
    assert.match(content, /MINUTES/, "Must define 60-minute options");

    // Action buttons
    assert.match(content, /Clear/, "Must provide Clear button");
    assert.match(content, /Today/, "Must provide Today quick-select button");
    assert.match(content, /Done/, "Must provide Done button");
  });

  await t.test("Provides formatDisplayDateTime and parseCountdownDate helpers", () => {
    assert.match(
      content,
      /function formatDisplayDateTime/,
      "Must define formatDisplayDateTime"
    );
    assert.match(
      content,
      /function parseCountdownDate/,
      "Must define parseCountdownDate"
    );
  });
});

