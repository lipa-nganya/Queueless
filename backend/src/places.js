import { query } from "./db.js";
import {
  getCachedPlacesReverse,
  getCachedPlacesSearch,
  reverseCacheKey,
  setCachedPlacesReverse,
  setCachedPlacesSearch,
} from "./httpCache.js";

/**
 * Kenya place search and reverse geocoding. Saved places (the `places` table)
 * are checked first; Google Maps is only asked when nothing saved matches, and
 * every Google result is saved so the next request for it costs nothing.
 * Without GOOGLE_MAPS_API_KEY, for searches under 4 characters, or when Google
 * fails, Photon (OSM) answers instead and its results are not saved.
 */

// Kenya bounding box used to bias Photon results toward the country.
const KENYA_BBOX = "33.909,-4.678,41.899,5.507";
const KENYA_RECT = {
  low: { latitude: -4.678, longitude: 33.909 },
  high: { latitude: 5.507, longitude: 41.899 },
};
const NAIROBI = { lat: -1.286389, lon: 36.817223 };
const GOOGLE_TIMEOUT_MS = 5000;
// Each Google search is billed, and autocomplete asks on every pause while
// typing. Shorter prefixes ("Sa", "Sar") go to free Photon instead.
const GOOGLE_MIN_SEARCH_LENGTH = 4;
// A saved place this close (in degrees, about 55 m) answers a reverse lookup.
const REVERSE_RADIUS_DEG = 0.0005;
const PLUS_CODE_RE = /^[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]*/i;

function googleKey() {
  return String(process.env.GOOGLE_MAPS_API_KEY || "").trim() || null;
}

function words(text) {
  return String(text || "")
    .toLowerCase()
    .split(/[\s,]+/)
    .filter(Boolean)
    .slice(0, 6);
}

function escapeLike(term) {
  return term.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

function toPlace(row) {
  return { label: row.label, latitude: Number(row.latitude), longitude: Number(row.longitude) };
}

// Counts a use of saved places that answered a request, so the most used come first.
function touchSavedPlaces(ids) {
  if (ids.length === 0) return;
  query(
    "UPDATE places SET use_count = use_count + 1, last_used_at = NOW() WHERE id = ANY($1::int[])",
    [ids]
  ).catch((error) => console.error("Updating saved places failed:", error.message));
}

// Saved places whose label contains every word typed, most used first.
async function searchSavedPlaces(text, limit) {
  const terms = words(text);
  if (terms.length === 0) return [];
  const conditions = terms.map((_, i) => `search_text LIKE $${i + 1}`).join(" AND ");
  const result = await query(
    `
      SELECT id, label, latitude, longitude
      FROM places
      WHERE ${conditions}
      ORDER BY use_count DESC, last_used_at DESC
      LIMIT $${terms.length + 1}
    `,
    [...terms.map((term) => `%${escapeLike(term)}%`), limit]
  );
  touchSavedPlaces(result.rows.map((row) => row.id));
  return result.rows.map(toPlace);
}

// The saved place nearest to a point, matching either where the place is or a
// point that was reverse-geocoded to it before.
async function nearestSavedPlace(latitude, longitude) {
  const result = await query(
    `
      SELECT id, label, latitude, longitude, distance
      FROM (
        SELECT id, label, latitude, longitude,
          (latitude - $1::float8) ^ 2 + (longitude - $2::float8) ^ 2 AS distance
        FROM places
        WHERE latitude BETWEEN $1::float8 - $3::float8 AND $1::float8 + $3::float8
          AND longitude BETWEEN $2::float8 - $3::float8 AND $2::float8 + $3::float8
        UNION ALL
        SELECT id, label, latitude, longitude,
          (lookup_latitude - $1::float8) ^ 2 + (lookup_longitude - $2::float8) ^ 2
        FROM places
        WHERE lookup_latitude BETWEEN $1::float8 - $3::float8 AND $1::float8 + $3::float8
          AND lookup_longitude BETWEEN $2::float8 - $3::float8 AND $2::float8 + $3::float8
      ) AS nearby
      ORDER BY distance
      LIMIT 1
    `,
    [latitude, longitude, REVERSE_RADIUS_DEG]
  );
  const row = result.rows[0];
  if (!row) return null;
  touchSavedPlaces([row.id]);
  return toPlace(row);
}

// Saves Google results; a reverse lookup also passes the point it was asked about.
async function savePlaces(places, lookup = null) {
  for (const place of places) {
    await query(
      `
        INSERT INTO places (
          google_place_id, label, latitude, longitude, search_text,
          lookup_latitude, lookup_longitude, use_count
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 1)
        ON CONFLICT (google_place_id) DO UPDATE SET
          label = EXCLUDED.label,
          latitude = EXCLUDED.latitude,
          longitude = EXCLUDED.longitude,
          search_text = EXCLUDED.search_text,
          lookup_latitude = COALESCE(EXCLUDED.lookup_latitude, places.lookup_latitude),
          lookup_longitude = COALESCE(EXCLUDED.lookup_longitude, places.lookup_longitude),
          use_count = places.use_count + 1,
          last_used_at = NOW()
      `,
      [
        place.googlePlaceId,
        place.label,
        place.latitude,
        place.longitude,
        place.label.toLowerCase(),
        lookup?.latitude ?? null,
        lookup?.longitude ?? null,
      ]
    );
  }
}

async function google(url, init = {}) {
  try {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS) });
    if (!response.ok) {
      console.error("Google Maps failed:", response.status, (await response.text()).slice(0, 300));
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error("Google Maps failed:", error.message);
    return null;
  }
}

// "Yaya Centre, Argwings Kodhek Rd, Nairobi, Kenya", without repeating the name.
function googleLabel(name, address) {
  const cleanName = String(name || "").trim();
  const cleanAddress = String(address || "").trim();
  if (!cleanName) return cleanAddress;
  if (!cleanAddress || cleanAddress.toLowerCase().startsWith(cleanName.toLowerCase())) {
    return cleanAddress || cleanName;
  }
  return `${cleanName}, ${cleanAddress}`;
}

// Google Places Text Search (New), restricted to Kenya. Returns null when Google is unavailable.
async function searchGoogle(text, limit, key) {
  const payload = await google("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location",
    },
    body: JSON.stringify({
      textQuery: text,
      regionCode: "ke",
      languageCode: "en",
      pageSize: limit,
      locationRestriction: { rectangle: KENYA_RECT },
    }),
  });
  if (!payload) return null;
  return (Array.isArray(payload.places) ? payload.places : [])
    .map((place) => ({
      googlePlaceId: place.id,
      label: googleLabel(place.displayName?.text, place.formattedAddress),
      latitude: Number(place.location?.latitude),
      longitude: Number(place.location?.longitude),
    }))
    .filter(
      (place) =>
        place.googlePlaceId &&
        place.label &&
        Number.isFinite(place.latitude) &&
        Number.isFinite(place.longitude)
    );
}

// Google Geocoding reverse lookup. Returns null when Google is unavailable.
async function reverseGoogle(latitude, longitude, key) {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("latlng", `${latitude},${longitude}`);
  url.searchParams.set("language", "en");
  url.searchParams.set("key", key);
  const payload = await google(url);
  if (!payload) return null;
  if (payload.status !== "OK" && payload.status !== "ZERO_RESULTS") {
    console.error("Google reverse geocode failed:", payload.status, payload.error_message || "");
    return null;
  }
  const results = Array.isArray(payload.results) ? payload.results : [];
  // Plus codes ("PQ26+HQ8, Nairobi") mean nothing to people; prefer a real address.
  const readable = (r) =>
    !r.types?.includes("plus_code") && !PLUS_CODE_RE.test(String(r.formatted_address || ""));
  const result = results.find(readable) || results[0];
  const location = result?.geometry?.location;
  if (!result?.place_id || !result.formatted_address || !location) return undefined;
  return {
    googlePlaceId: result.place_id,
    label: result.formatted_address,
    latitude: Number(location.lat),
    longitude: Number(location.lng),
  };
}

function photonLabel(props = {}) {
  const parts = [
    props.name,
    props.street,
    props.locality || props.city || props.county,
    props.district || props.state,
  ].filter(Boolean);
  // Drop consecutive duplicates (Photon often repeats the city).
  const unique = parts.filter((part, i) => part !== parts[i - 1]);
  return unique.join(", ") || "Unknown place";
}

async function searchPhoton(text, limit) {
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", text);
  url.searchParams.set("limit", String(Math.min(12, Math.max(1, limit))));
  url.searchParams.set("lang", "en");
  url.searchParams.set("lat", String(NAIROBI.lat));
  url.searchParams.set("lon", String(NAIROBI.lon));
  url.searchParams.set("bbox", KENYA_BBOX);

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "QueuelessKenya/1.0 (Kenya place search)",
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    throw new Error("Place search is temporarily unavailable.");
  }

  const payload = await response.json().catch(() => ({}));
  const features = Array.isArray(payload.features) ? payload.features : [];
  return features
    .filter((feature) => {
      const code = String(feature?.properties?.countrycode || "").toLowerCase();
      return !code || code === "ke";
    })
    .slice(0, limit)
    .map((feature) => {
      const [longitude, latitude] = feature.geometry?.coordinates || [];
      return {
        label: photonLabel(feature.properties),
        latitude: Number(latitude),
        longitude: Number(longitude),
      };
    })
    .filter(
      (place) =>
        place.label &&
        Number.isFinite(place.latitude) &&
        Number.isFinite(place.longitude)
    );
}

async function reversePhoton(latitude, longitude) {
  const url = new URL("https://photon.komoot.io/reverse");
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  url.searchParams.set("lang", "en");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "QueuelessKenya/1.0 (Kenya reverse geocode)",
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    throw new Error("Reverse geocode is temporarily unavailable.");
  }

  const payload = await response.json().catch(() => ({}));
  const feature = Array.isArray(payload.features) ? payload.features[0] : null;
  if (!feature) return null;
  const [featureLon, featureLat] = feature.geometry?.coordinates || [];
  return {
    label: photonLabel(feature.properties),
    latitude: Number.isFinite(Number(featureLat)) ? Number(featureLat) : latitude,
    longitude: Number.isFinite(Number(featureLon)) ? Number(featureLon) : longitude,
  };
}

export async function searchPlacesKenya(q, { limit = 8 } = {}) {
  const text = String(q || "").trim();
  if (text.length < 2) return [];

  const cacheKey = `${text.toLowerCase()}|${limit}`;
  const cached = getCachedPlacesSearch(cacheKey);
  if (cached) return cached;

  let places = await searchSavedPlaces(text, limit);
  if (places.length === 0) {
    const key = text.length >= GOOGLE_MIN_SEARCH_LENGTH ? googleKey() : null;
    const found = key ? await searchGoogle(text, limit, key) : null;
    if (found) {
      await savePlaces(found);
      places = found.map(toPlace);
    } else {
      places = await searchPhoton(text, limit);
    }
  }

  setCachedPlacesSearch(cacheKey, places);
  return places;
}

export async function reverseGeocodeKenya(latitude, longitude) {
  const cacheKey = reverseCacheKey(latitude, longitude);
  const cached = getCachedPlacesReverse(cacheKey);
  if (cached) return cached;

  let place = await nearestSavedPlace(latitude, longitude);
  if (!place) {
    const key = googleKey();
    const found = key ? await reverseGoogle(latitude, longitude, key) : null;
    if (found) {
      await savePlaces([found], { latitude, longitude });
      place = toPlace(found);
    } else if (found === null) {
      place = await reversePhoton(latitude, longitude);
    }
  }
  place ||= {
    label: `Near ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
    latitude,
    longitude,
  };

  setCachedPlacesReverse(cacheKey, place);
  return place;
}
