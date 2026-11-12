import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { parseVenueDisplay } from "../../lib/venues-catalog.js";

describe("Broad Address & Host Google Profile Suite", () => {
  it("parseVenueDisplay extracts broad venue and preserves full postal address without repetition", () => {
    const rawAddress =
      "Cochin University of Science and Technology, ADM ROAD, Pottachal Nagar, Pathadipalem, Kalamassery, Kanayannur, Ernakulam, Kerala, 682033, India";

    const result = parseVenueDisplay({
      venueName: rawAddress,
      address: rawAddress,
      city: "",
    });

    assert.equal(
      result.broadVenue,
      "Cochin University of Science and Technology",
      "Broad venue must only be the primary venue name, not the whole postal address"
    );
    assert.equal(
      result.fullAddress,
      rawAddress,
      "Full address must preserve the complete postal address for the expandable link"
    );
    assert.notEqual(
      result.broadVenue,
      result.fullAddress,
      "Broad venue must be strictly distinct from full address"
    );
  });

  it("VenueMap component includes 'See full address' toggle and does not repeat full address in markup", () => {
    const venueMapPath = path.resolve(process.cwd(), "components/common/venue-map.jsx");
    const content = fs.readFileSync(venueMapPath, "utf-8");

    assert.match(content, /See full address/, "VenueMap must include 'See full address' toggle link");
    assert.match(content, /showFullAddress/, "VenueMap must manage expandable state for full address");
    assert.doesNotMatch(
      content,
      /Full Postal Address:\s*<\/[^>]+>\s*<p[^>]*>\{fullAddress/i,
      "VenueMap must NOT unconditionally print Full Postal Address repeating the venue"
    );
    assert.doesNotMatch(
      content,
      /Geographic Coordinates/i,
      "VenueMap must NOT display Geographic Coordinates to the user"
    );
  });

  it("Public event page e/[slug] removes 'School of Engineering' and 'support@ticketlelo.com' fallbacks", () => {
    const slugPagePath = path.resolve(process.cwd(), "src/app/(app)/e/[slug]/page.jsx");
    const content = fs.readFileSync(slugPagePath, "utf-8");

    assert.doesNotMatch(
      content,
      /organizerName\s*\|\|\s*"School of Engineering"/,
      "Must NOT fallback to 'School of Engineering' as default host name"
    );
    assert.doesNotMatch(
      content,
      /organizerEmail\s*\|\|\s*"support@ticketlelo\.com"/,
      "Must NOT fallback to 'support@ticketlelo.com' as default host email"
    );
    assert.match(
      content,
      /\/api\/events\/host-info/,
      "e/[slug] page must fetch authoritative host info via /api/events/host-info route"
    );
    assert.match(
      content,
      /HOSTED BY/,
      "e/[slug] must contain HOSTED BY section"
    );
  });

  it("API /api/events/host-info route exists and queries Firebase Admin user profile & Auth", () => {
    const hostInfoPath = path.resolve(process.cwd(), "src/app/api/events/host-info/route.js");
    assert.ok(fs.existsSync(hostInfoPath), "Route /api/events/host-info/route.js must exist");

    const content = fs.readFileSync(hostInfoPath, "utf-8");
    assert.match(content, /adminAuth\.getUser/, "Host-info route must inspect Firebase Auth for Google profile details");
    assert.match(content, /photoURL/, "Host-info route must extract and return photoURL");
    assert.match(content, /email/, "Host-info route must extract and return host email");
  });
});
