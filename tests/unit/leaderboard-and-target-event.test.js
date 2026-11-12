import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Leaderboard Styling, WhatsApp Share & Target Event Selection", () => {
  const rootDir = process.cwd();

  it("Public Leaderboard Page includes rich navigation, hero banner, podium and complete rankings", () => {
    const pagePath = path.join(rootDir, "src/app/(app)/leaderboard/[programId]/page.jsx");
    const content = fs.readFileSync(pagePath, "utf-8");

    // Branded header & navigation
    assert.ok(content.includes("ticketlelo-logo-nav.png"), "Includes TicketLelo navigation logo");
    assert.ok(content.includes("ThemeToggle"), "Includes theme toggle for light/dark consistency");
    assert.ok(content.includes("Discover Events"), "Includes navigation to events discovery");
    assert.ok(content.includes("Ambassador Portal"), "Includes navigation to ambassador portal");

    // Official rankings hero section & stats
    assert.ok(content.includes("Official Campus Rankings"), "Includes Official Campus Rankings badge");
    assert.ok(content.includes("totalPoints"), "Renders total points metric");
    assert.ok(content.includes("totalAmbassadors"), "Renders total ambassadors metric");
    assert.ok(content.includes("Live in IST"), "Includes live IST status badge");

    // Podium view for top ambassadors
    assert.ok(content.includes("Top Campus Leaders"), "Includes top campus leaders podium section");
    assert.ok(content.includes("👑"), "Includes crown badge for Rank 1");
    assert.ok(content.includes("Top Creator"), "Includes Top Creator badge");

    // Complete standings table & search
    assert.ok(content.includes("Complete Standings"), "Includes Complete Standings section");
    assert.ok(content.includes("searchQuery"), "Includes ambassador search filter");
    assert.ok(content.includes("PTS"), "Includes points unit label");

    // How Points Work explainer card
    assert.ok(content.includes("How Points & Standings Work"), "Includes How Points Work section");
    assert.ok(content.includes("Free Event Registration"), "Explains free event registration points");
    assert.ok(content.includes("Paid Ticket Pass"), "Explains paid ticket pass points");
  });

  it("Ambassador Dashboard WhatsApp button uses refined dark theme styling and official SVG glyph", () => {
    const dashPath = path.join(rootDir, "src/app/(app)/(user)/ambassador/dashboard/page.jsx");
    const content = fs.readFileSync(dashPath, "utf-8");

    // Clean emerald translucent styling instead of raw solid green block
    assert.ok(
      content.includes("bg-[#25D366]/15") && content.includes("text-[#25D366]"),
      "WhatsApp button uses polished translucent emerald styling"
    );
    assert.ok(
      content.includes("border-[#25D366]/35"),
      "WhatsApp button uses subtle matching border"
    );
    assert.ok(
      content.includes("viewBox=\"0 0 24 24\"") && content.includes("M17.472"),
      "Includes crisp official WhatsApp SVG glyph"
    );
  });

  it("Ambassador Dashboard displays connected events and permits event selection", () => {
    const dashPath = path.join(rootDir, "src/app/(app)/(user)/ambassador/dashboard/page.jsx");
    const content = fs.readFileSync(dashPath, "utf-8");

    assert.ok(content.includes("Target Event:"), "Displays Target Event section");
    assert.ok(content.includes("connectedEvents.map"), "Maps over connected events for selection");
    assert.ok(content.includes("All Events Catalog (/discover)"), "Provides catalog fallback option");
    assert.ok(content.includes("selectedEventId === evt.id"), "Allows selecting connected event");
  });

  it("Admin Program Studio includes Target Event selector during program creation and fixes connect API", () => {
    const adminProgPath = path.join(rootDir, "src/app/(app)/admin/programs/page.jsx");
    const adminProgContent = fs.readFileSync(adminProgPath, "utf-8");

    assert.ok(
      adminProgContent.includes("Associated Event"),
      "Create Program modal includes Associated Event select dropdown"
    );
    assert.ok(
      adminProgContent.includes("eventId: formData.eventId"),
      "Passes eventId to program creation API"
    );

    const progEventsApi = path.join(rootDir, "src/app/api/organizer/programs/[programId]/events/route.js");
    const apiContent = fs.readFileSync(progEventsApi, "utf-8");

    assert.ok(
      apiContent.includes("action = \"toggle\"") || apiContent.includes("action = \"connect\""),
      "API auto-infers toggle and connect actions when action string is omitted"
    );
  });
});
