import { NextResponse } from "next/server";
import { searchIndianVenues } from "@/lib/venues-catalog";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = (searchParams.get("q") || "").trim();

    if (!query || query.length < 2) {
      return NextResponse.json({ places: [] });
    }

    // 1. Instant Curated Indian Campus & Venue Catalog Search
    // Matches exact acronyms (e.g. AKGEC, KIET, DTU, NSUT, IITD, BITS)
    // with 100% verified accuracy and zero latency without any API key.
    const curatedMatches = searchIndianVenues(query, 6);

    const apiKey =
      process.env.GOOGLE_MAPS_API_KEY ||
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    // 2. Try Google Places API if a valid non-placeholder key is provided
    if (apiKey && !apiKey.includes("placeholder") && !apiKey.includes("your_")) {
      try {
        const googleUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
          query
        )}&components=country:in&key=${apiKey}&language=en`;
        const gRes = await fetch(googleUrl, { cache: "no-store" });
        if (gRes.ok) {
          const gData = await gRes.json();
          if (gData.status === "OK" && Array.isArray(gData.predictions)) {
            const places = await Promise.all(
              gData.predictions.slice(0, 6).map(async (p) => {
                let lat = 28.6139;
                let lng = 77.209;
                try {
                  const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${p.place_id}&fields=geometry&key=${apiKey}`;
                  const dRes = await fetch(detailUrl);
                  const dData = await dRes.json();
                  if (dData.result?.geometry?.location) {
                    lat = dData.result.geometry.location.lat;
                    lng = dData.result.geometry.location.lng;
                  }
                } catch {
                  // Fallback coords
                }
                return {
                  id: p.place_id,
                  name: p.structured_formatting?.main_text || p.description.split(",")[0],
                  address: p.description,
                  lat,
                  lng,
                  source: "google",
                  isVerified: true,
                };
              })
            );

            // Merge curated top matches with Google Places
            const combined = [...curatedMatches];
            for (const p of places) {
              const alreadyExists = combined.some(
                (c) =>
                  c.name.toLowerCase() === p.name.toLowerCase() ||
                  (Math.abs(c.lat - p.lat) < 0.002 && Math.abs(c.lng - p.lng) < 0.002)
              );
              if (!alreadyExists) {
                combined.push(p);
              }
            }
            return NextResponse.json({ places: combined.slice(0, 8) });
          }
        }
      } catch (err) {
        console.warn("Google Places Autocomplete error, falling back to OSM:", err);
      }
    }

    // 3. High-Accuracy India-Constrained Geocoding (OpenStreetMap / Nominatim)
    // NOTE: countrycodes=in and bounding box prevent foreign results (e.g. French 'L\'AKge')
    const osmIndiaUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      query
    )}&addressdetails=1&countrycodes=in&viewbox=68.1,37.1,97.4,6.7&bounded=0&limit=10`;

    let osmPlaces = [];
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const osmRes = await fetch(osmIndiaUrl, {
        headers: {
          "User-Agent": "TicketLelo-Platform/2.0 (contact@ticketlelo.com)",
          Accept: "application/json",
        },
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(timeoutId);

      if (osmRes.ok) {
        const osmData = await osmRes.json();
        if (Array.isArray(osmData)) {
          // Sort items so amenities, universities, buildings, and tourism rank ABOVE raw roads
          const sorted = [...osmData].sort((a, b) => {
            const highRankTypes = ["university", "college", "school", "amenity", "building", "stadium", "theatre", "place", "suburb"];
            const aIsHigh = highRankTypes.includes(a.type) || highRankTypes.includes(a.class);
            const bIsHigh = highRankTypes.includes(b.type) || highRankTypes.includes(b.class);
            if (aIsHigh && !bIsHigh) return -1;
            if (!aIsHigh && bIsHigh) return 1;
            return (b.importance || 0) - (a.importance || 0);
          });

          osmPlaces = sorted.map((item) => {
            const parts = (item.display_name || "").split(",").map((s) => s.trim());
            const mainName = item.name || parts[0] || query;
            const subAddress = parts.slice(1).join(", ") || item.display_name;

            return {
              id: `osm-${item.place_id}`,
              name: mainName,
              address: subAddress || item.display_name,
              lat: parseFloat(item.lat),
              lng: parseFloat(item.lon),
              type: item.type || "place",
              category: item.class === "amenity" || item.class === "building" ? "Venue" : "Location",
              isVerified: true,
              source: "osm",
            };
          });
        }
      }
    } catch (err) {
      console.warn("OSM India search request error or timeout:", err.message);
    }

    // 4. Fallback for unconstrained global query ONLY if India search returned 0 results
    // and no curated matches were found
    if (curatedMatches.length === 0 && osmPlaces.length === 0) {
      try {
        const globalOsmUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          query
        )}&addressdetails=1&limit=6`;
        const gRes = await fetch(globalOsmUrl, {
          headers: {
            "User-Agent": "TicketLelo-Platform/2.0 (contact@ticketlelo.com)",
            Accept: "application/json",
          },
          cache: "no-store",
        });
        if (gRes.ok) {
          const gData = await gRes.json();
          if (Array.isArray(gData)) {
            osmPlaces = gData.map((item) => {
              const parts = (item.display_name || "").split(",").map((s) => s.trim());
              return {
                id: `osm-global-${item.place_id}`,
                name: item.name || parts[0] || query,
                address: parts.slice(1).join(", ") || item.display_name,
                lat: parseFloat(item.lat),
                lng: parseFloat(item.lon),
                type: item.type || "place",
                category: "Location",
                isVerified: false,
                source: "osm_global",
              };
            });
          }
        }
      } catch (err) {
        console.warn("OSM global fallback error:", err.message);
      }
    }

    // 5. Deduplicate and merge results (Curated Verified Venues ALWAYS take priority)
    const combinedResults = [...curatedMatches];

    for (const place of osmPlaces) {
      const isDuplicate = combinedResults.some((c) => {
        const nameSimilarity =
          c.name.toLowerCase().includes(place.name.toLowerCase()) ||
          place.name.toLowerCase().includes(c.shortName ? c.shortName.toLowerCase() : "");
        const coordsClose =
          Math.abs(c.lat - place.lat) < 0.003 && Math.abs(c.lng - place.lng) < 0.003;
        return nameSimilarity || coordsClose;
      });

      if (!isDuplicate) {
        combinedResults.push(place);
      }
    }

    return NextResponse.json({ places: combinedResults.slice(0, 8) });
  } catch (error) {
    console.error("Places search route error:", error);
    return NextResponse.json(
      { error: "Failed to fetch location suggestions", places: [] },
      { status: 500 }
    );
  }
}
