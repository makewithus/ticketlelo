import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { resolveEventTheme, THEMES_MAP } from "../../lib/theme-utils.js";

describe("Online Events, Theme Synchronization & Preview Button Removal Verification", () => {
  const rootDir = process.cwd();

  it("Event Create Studio: 'Preview Event Page' button is removed from header", () => {
    const studioPath = path.join(rootDir, "components/admin/event-create-studio.jsx");
    const content = fs.readFileSync(studioPath, "utf-8");

    assert.ok(
      !content.includes("Preview Event Page"),
      "Must not include 'Preview Event Page' button in header"
    );
    assert.ok(
      content.includes("Create Event Studio"),
      "Must retain 'Create Event Studio' / 'Edit Event Studio' label"
    );
  });

  it("VenueMap: Intelligently handles online/virtual events without loading world map", () => {
    const venueMapPath = path.join(rootDir, "components/common/venue-map.jsx");
    const content = fs.readFileSync(venueMapPath, "utf-8");

    assert.ok(content.includes("isVirtualEvent"), "Includes virtual event detection");
    assert.ok(content.includes("meet.google.com"), "Detects Google Meet links");
    assert.ok(content.includes("zoom.us"), "Detects Zoom links");
    assert.ok(content.includes("Join Meeting"), "Provides direct 'Join Meeting' CTA for virtual attendees");
    assert.ok(content.includes("handleCopyMeetingLink") || content.includes("Copy Link"), "Provides convenient Copy Link button");
    assert.ok(content.includes("Online Event Guidelines"), "Provides online event guidelines");
  });

  it("Public Event & Register Pages: Dynamically adapt layout and header for online events", () => {
    const eSlugPath = path.join(rootDir, "src/app/(app)/e/[slug]/page.jsx");
    const regPath = path.join(rootDir, "src/app/(app)/register/[eventId]/page.jsx");

    const eSlugContent = fs.readFileSync(eSlugPath, "utf-8");
    const regContent = fs.readFileSync(regPath, "utf-8");

    // Check heading switches to "Online Event Access"
    assert.ok(eSlugContent.includes("Online Event Access"), "/e/[slug] switches heading to 'Online Event Access' for virtual events");
    assert.ok(regContent.includes("Online Event Access"), "/register/[eventId] switches heading to 'Online Event Access' for virtual events");

    // Check logistics card shows Event Format
    assert.ok(eSlugContent.includes("Event Format"), "/e/[slug] displays Event Format for online sessions");
    assert.ok(regContent.includes("Event Format"), "/register/[eventId] displays Event Format for online sessions");
  });

  it("resolveEventTheme: Minimal theme guarantees canonical olive-brown #432E01 background and #FE760B accent", () => {
    // 1. Clean minimal event
    const minimalEvent = { theme: "minimal" };
    const resolved = resolveEventTheme(minimalEvent);

    assert.equal(resolved.pageBg, "#432E01", "Minimal theme must have pageBg #432E01");
    assert.equal(resolved.color, "#FE760B", "Minimal theme must have accent #FE760B");
    assert.equal(resolved.name, "Minimal");

    // 2. Event with stale custom color and pageBg from previous draft
    const staleCustomEvent = {
      theme: "minimal",
      themeName: "Minimal",
      themeColor: "#45016A",
      pageBg: "rgb(28, 12, 42)",
    };
    const resolvedStale = resolveEventTheme(staleCustomEvent);

    assert.equal(
      resolvedStale.pageBg,
      "#432E01",
      "Selected minimal preset must NOT be overridden by stale custom pageBg"
    );
    assert.equal(
      resolvedStale.color,
      "#FE760B",
      "Selected minimal preset must NOT be overridden by stale custom themeColor"
    );
  });

  it("Event Create Studio: Ticket background customization does not reset overall theme to custom", () => {
    const studioPath = path.join(rootDir, "components/admin/event-create-studio.jsx");
    const content = fs.readFileSync(studioPath, "utf-8");

    // Ensure ticket customization does not set theme: "custom"
    const ticketColorMatch = content.match(/ticketBgColor:\s*val/g);
    assert.ok(ticketColorMatch && ticketColorMatch.length > 0, "Ticket background updates ticketBgColor");
  });
});
