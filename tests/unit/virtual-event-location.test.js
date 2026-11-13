import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import {
  isVirtualLocation,
  getVirtualMeetingUrl,
  getVirtualPlatformName,
  parseVenueDisplay,
} from "../../lib/venues-catalog.js";

test("Virtual & Online Event Location Handling", async (t) => {
  await t.test("isVirtualLocation identifies Google Meet, Zoom, and video links", () => {
    // Exact URL from user screenshot
    assert.equal(isVirtualLocation("https://meet.google.com/meet/fwa-ijkb-vds"), true);
    assert.equal(isVirtualLocation("meet.google.com/abc-defg-hij"), true);
    assert.equal(isVirtualLocation("https://zoom.us/j/1234567890"), true);
    assert.equal(isVirtualLocation("https://teams.microsoft.com/l/meetup-join/xyz"), true);
    assert.equal(isVirtualLocation("https://youtube.com/live/12345"), true);
    assert.equal(isVirtualLocation("Virtual Event"), true);
    assert.equal(isVirtualLocation("online"), true);
    assert.equal(isVirtualLocation("Google Meet Session"), true);
  });

  await t.test("isVirtualLocation returns false for physical venues", () => {
    assert.equal(isVirtualLocation("School of Engineering, CUSAT"), false);
    assert.equal(isVirtualLocation("KIET Group of Institutions, Ghaziabad"), false);
    assert.equal(isVirtualLocation("Main Auditorium, Delhi"), false);
  });

  await t.test("isVirtualLocation identifies event objects correctly", () => {
    assert.equal(isVirtualLocation({ locationType: "virtual" }), true);
    assert.equal(isVirtualLocation({ isVirtual: true }), true);
    assert.equal(isVirtualLocation({ isOnline: true }), true);
    assert.equal(
      isVirtualLocation({
        location: "https://meet.google.com/meet/fwa-ijkb-vds",
        locationType: "in-person", // even if mislabeled in legacy data!
      }),
      true
    );
    assert.equal(
      isVirtualLocation({
        location: "School of Engineering",
        locationType: "in-person",
      }),
      false
    );
  });

  await t.test("getVirtualMeetingUrl extracts valid meeting URL", () => {
    assert.equal(
      getVirtualMeetingUrl("https://meet.google.com/meet/fwa-ijkb-vds"),
      "https://meet.google.com/meet/fwa-ijkb-vds"
    );
    assert.equal(
      getVirtualMeetingUrl({ location: "https://meet.google.com/meet/fwa-ijkb-vds" }),
      "https://meet.google.com/meet/fwa-ijkb-vds"
    );
    assert.equal(
      getVirtualMeetingUrl("meet.google.com/fwa-ijkb-vds"),
      "https://meet.google.com/fwa-ijkb-vds"
    );
  });

  await t.test("getVirtualPlatformName identifies correct platform", () => {
    assert.equal(
      getVirtualPlatformName("https://meet.google.com/meet/fwa-ijkb-vds"),
      "Google Meet"
    );
    assert.equal(
      getVirtualPlatformName("https://zoom.us/j/987654321"),
      "Zoom Meeting"
    );
    assert.equal(
      getVirtualPlatformName("https://teams.microsoft.com/l/meetup"),
      "Microsoft Teams"
    );
  });

  await t.test("parseVenueDisplay formats virtual events cleanly without physical address clutter", () => {
    const result = parseVenueDisplay({
      venueName: "https://meet.google.com/meet/fwa-ijkb-vds",
      address: "https://meet.google.com/meet/fwa-ijkb-vds",
    });
    assert.equal(result.broadVenue, "Google Meet");
    assert.equal(result.broadLocality, "Online Event");
    assert.equal(result.isVirtual, true);
    assert.equal(result.fullAddress, "https://meet.google.com/meet/fwa-ijkb-vds");
  });

  await t.test("Admin Overview page does not render Google Maps embed for online events", () => {
    const overviewContent = fs.readFileSync(
      path.join(process.cwd(), "src/app/(app)/admin/overview/page.jsx"),
      "utf8"
    );

    // Verify conditional rendering based on isOnlineEvent
    assert.ok(
      overviewContent.includes("isOnlineEvent ?"),
      "Overview page checks isOnlineEvent for map rendering"
    );
    assert.ok(
      overviewContent.includes("Live Virtual Access"),
      "Overview page includes dedicated Live Virtual Access card"
    );
    assert.ok(
      overviewContent.includes("isVirtualLocation"),
      "Overview page imports and uses isVirtualLocation"
    );
  });
});
