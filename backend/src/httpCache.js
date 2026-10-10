import crypto from "node:crypto";

/**
 * Cheap in-process caches and conditional JSON responses so hot poll paths
 * and upstream place lookups cost less bandwidth and CPU without changing UX.
 */

const placesSearchCache = new Map();
const placesReverseCache = new Map();
const PLACES_SEARCH_TTL_MS = 10 * 60 * 1000;
const PLACES_REVERSE_TTL_MS = 30 * 60 * 1000;
const PLACES_CACHE_MAX = 250;

function pruneMap(map, max) {
  while (map.size > max) {
    const oldest = map.keys().next().value;
    map.delete(oldest);
  }
}

export function cacheGet(map, key, ttlMs) {
  const hit = map.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > ttlMs) {
    map.delete(key);
    return undefined;
  }
  return hit.value;
}

export function cacheSet(map, key, value, max = PLACES_CACHE_MAX) {
  map.set(key, { at: Date.now(), value });
  pruneMap(map, max);
}

export function getCachedPlacesSearch(key) {
  return cacheGet(placesSearchCache, key, PLACES_SEARCH_TTL_MS);
}

export function setCachedPlacesSearch(key, value) {
  cacheSet(placesSearchCache, key, value);
}

export function getCachedPlacesReverse(key) {
  return cacheGet(placesReverseCache, key, PLACES_REVERSE_TTL_MS);
}

export function setCachedPlacesReverse(key, value) {
  cacheSet(placesReverseCache, key, value);
}

/** Round coords so nearby reverse lookups share a cache entry (~11 m). */
export function reverseCacheKey(lat, lon) {
  return `${Number(lat).toFixed(4)},${Number(lon).toFixed(4)}`;
}

/**
 * Send JSON with an ETag. Repeat polls that see no change get a 304 and an
 * empty body, which cuts egress on the busiest endpoints.
 */
export function sendJsonEtag(req, res, payload, { cacheControl = "private, no-cache" } = {}) {
  return sendSerialized(req, res, serialize(payload), cacheControl);
}

// Payloads served from in-process caches are the same object until they expire,
// so their JSON + hash only needs computing once per cache fill.
const serializedPayloads = new WeakMap();

export function sendCachedJsonEtag(req, res, payload, { cacheControl = "private, no-cache" } = {}) {
  let serialized = serializedPayloads.get(payload);
  if (!serialized) {
    serialized = serialize(payload);
    serializedPayloads.set(payload, serialized);
  }
  return sendSerialized(req, res, serialized, cacheControl);
}

function serialize(payload) {
  const body = JSON.stringify(payload);
  const etag = `"${crypto.createHash("sha1").update(body).digest("hex")}"`;
  return { body, etag };
}

function sendSerialized(req, res, { body, etag }, cacheControl) {
  res.setHeader("ETag", etag);
  res.setHeader("Cache-Control", cacheControl);
  if (req.headers["if-none-match"] === etag) {
    return res.status(304).end();
  }
  return res.type("json").send(body);
}
