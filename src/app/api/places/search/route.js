import { NextResponse } from "next/server";
import { searchIndianVenues } from "@/lib/venues-catalog";

// In-memory circuit breaker for Google Places API to avoid recurring 1000ms timeouts when billing or permissions are inactive
let googlePlacesCircuit = {
  isAvailable: true,
  lastChecked: 0,
  failureReason: null,
};

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = (searchParams.get("q") || "").trim();

    if (!query || query.length < 2) {
      return NextResponse.json({ places: [] });
    }

    // 1. Instant Curated Indian Campus & Venue Catalog Search
    // Matches exact acronyms (e.g. AKGEC, KIET, DTU, NSUT, IITD, BITS) with 100% verified accuracy
    const curatedMatches = searchIndianVenues(query, 6);

    const apiKey =
      process.env.GOOGLE_MAPS_API_KEY ||
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    let places = null;
    const shouldTryGoogle =
      Boolean(apiKey) &&
      !apiKey.includes("placeholder") &&
      !apiKey.includes("your_") &&
      (googlePlacesCircuit.isAvailable || Date.now() - googlePlacesCircuit.lastChecked > 180000);

    // 2. Try Google Places API (Supports modern Places API (New) & Legacy API)
    if (shouldTryGoogle) {
      try {
        // 2A. Modern Places API (New) - v1/places:autocomplete
        const newApiRes = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
            "X-Goog-Maps-Solution-ID": "gmp_git_agentskills_v1",
          },
          body: JSON.stringify({
            input: query,
            includedRegionCodes: ["in"],
          }),
          cache: "no-store",
        });

        if (newApiRes.ok) {
          const newData = await newApiRes.json();
          googlePlacesCircuit.isAvailable = true;

          if (Array.isArray(newData.suggestions) && newData.suggestions.length > 0) {
            places = await Promise.all(
              newData.suggestions.slice(0, 6).map(async (s) => {
                const pred = s.placePrediction;
                if (!pred) return null;
                const placeId = pred.placeId || (pred.place || "").replace("places/", "");
                let lat = null;
                let lng = null;
                try {
                  const detailRes = await fetch(
                    `https://places.googleapis.com/v1/places/${placeId}`,
                    {
                      headers: {
                        "X-Goog-Api-Key": apiKey,
                        "X-Goog-FieldMask": "location,formattedAddress",
                        "X-Goog-Maps-Solution-ID": "gmp_git_agentskills_v1",
                      },
                    }
                  );
                  if (detailRes.ok) {
                    const detailData = await detailRes.json();
                    if (detailData.location) {
                      lat = detailData.location.latitude;
                      lng = detailData.location.longitude;
                    }
                  }
                } catch {}
                return {
                  id: placeId,
                  name: pred.structuredFormat?.mainText?.text || pred.text?.text?.split(",")[0] || query,
                  address: pred.text?.text || "India",
                  lat,
                  lng,
                  source: "google",
                  isVerified: true,
                };
              })
            );
            places = places.filter(Boolean);
          }
        } else {
          // If Google API returns 403 / Permission Denied, trip the circuit breaker for 3 minutes
          const errData = await newApiRes.json().catch(() => ({}));
          console.warn("[Places API New] Unavailable:", newApiRes.status, errData?.error?.message);
          if (newApiRes.status === 403 || newApiRes.status === 400) {
            googlePlacesCircuit.isAvailable = false;
            googlePlacesCircuit.lastChecked = Date.now();
            googlePlacesCircuit.failureReason = errData?.error?.message || "PERMISSION_DENIED";
          }
        }
      } catch (newErr) {
        console.warn("[Places API New] Attempt failed, falling back to OSM:", newErr?.message);
      }
    }

    if (Array.isArray(places) && places.length > 0) {
      // Merge curated top matches with Google Places
      const combined = [...curatedMatches];
      for (const p of places) {
        const alreadyExists = combined.some(
          (c) =>
            c.name.toLowerCase() === p.name.toLowerCase() ||
            (c.lat && p.lat && Math.abs(c.lat - p.lat) < 0.002 && Math.abs(c.lng - p.lng) < 0.002)
        );
        if (!alreadyExists) {
          combined.push(p);
        }
      }
      return NextResponse.json({ places: combined.slice(0, 8), source: "google" });
    }

    // 3. High-Accuracy Real-Time India-Constrained Geocoding (OpenStreetMap / Nominatim)
    // Instant, real coordinates, zero fake pins, works for any hotel, hall, cafe, or campus
    const osmIndiaUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      query
    )}&addressdetails=1&countrycodes=in&viewbox=68.1,37.1,97.4,6.7&bounded=0&limit=8`;

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
          // Sort items so amenities, venues, stadiums rank high
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
              source: "realtime_geocoding",
            };
          });
        }
      }
    } catch (err) {
      console.warn("OSM India search request error or timeout:", err?.message);
    }

    // 4. Global fallback if India-constrained returned 0 results
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
                isVerified: true,
                source: "realtime_geocoding",
              };
            });
          }
        }
      } catch (err) {
        console.warn("OSM global fallback error:", err?.message);
      }
    }

    // 5. Merge curated matches with real-time geocoded places
    const combinedResults = [...curatedMatches];

    for (const place of osmPlaces) {
      const isDuplicate = combinedResults.some((c) => {
        const nameSimilarity =
          c.name.toLowerCase().includes(place.name.toLowerCase()) ||
          place.name.toLowerCase().includes(c.shortName ? c.shortName.toLowerCase() : "");
        const coordsClose =
          c.lat && place.lat && Math.abs(c.lat - place.lat) < 0.003 && Math.abs(c.lng - place.lng) < 0.003;
        return nameSimilarity || coordsClose;
      });

      if (!isDuplicate) {
        combinedResults.push(place);
      }
    }

    return NextResponse.json({
      places: combinedResults.slice(0, 8),
      googleMapsConfigured: Boolean(apiKey),
      googleMapsActive: googlePlacesCircuit.isAvailable,
    });
  } catch (error) {
    console.error("Places search route error:", error);
    return NextResponse.json(
      { error: "Failed to fetch location suggestions", places: [] },
      { status: 500 }
    );
  }
}
