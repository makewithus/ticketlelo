import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Google Maps API Key & Real-Time Places Search Verification", () => {
  const rootDir = process.cwd();

  it("Places search route contains real-time geocoding fallback with circuit breaker", () => {
    const routePath = path.join(rootDir, "src/app/api/places/search/route.js");
    const content = fs.readFileSync(routePath, "utf-8");

    assert.ok(content.includes("googlePlacesCircuit"), "Includes circuit breaker for Google Places API");
    assert.ok(content.includes("nominatim.openstreetmap.org"), "Includes real-time OSM geocoding fallback");
    assert.ok(content.includes("countrycodes=in"), "Constrains geocoding to India for high precision");
    assert.ok(content.includes("parseFloat(item.lat)"), "Parses real latitude coordinates");
    assert.ok(content.includes("parseFloat(item.lon)"), "Parses real longitude coordinates");
  });

  it("Event Create Studio does not hardcode fake 28.6139/77.2090 coordinates for custom venues", () => {
    const studioPath = path.join(rootDir, "components/admin/event-create-studio.jsx");
    const content = fs.readFileSync(studioPath, "utf-8");

    // Make sure custom entries do not default to central Delhi
    assert.ok(!content.includes("lat: 28.6139"), "No hardcoded Delhi latitude in custom venue selection");
    assert.ok(!content.includes("lng: 77.2090"), "No hardcoded Delhi longitude in custom venue selection");
    assert.ok(content.includes("Real-Time Location Mapped"), "Shows Real-Time Location Mapped status badge");
  });

  it("VenueMap component uses safe universal embed and avoids forcing default Delhi coordinates", () => {
    const venueMapPath = path.join(rootDir, "components/common/venue-map.jsx");
    const content = fs.readFileSync(venueMapPath, "utf-8");

    assert.ok(content.includes("isDefaultDelhi"), "Checks and prevents default Delhi coordinate override");
    assert.ok(content.includes("output=embed"), "Uses standard universal embed URL");
  });
});

