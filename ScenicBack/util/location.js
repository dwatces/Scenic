const HttpError = require("../models/http-error");

// Shown to the member in the client when posting a scene fails.
const UNAVAILABLE = "We couldn't look up that place just now. Please try again in a minute.";
const NOT_FOUND =
  "We couldn't find that place. Try a town or place and its region, e.g. Hahei, Coromandel.";

// Every geocoder call gives up after 5 s, so a slow provider can't hold a
// serverless request open.
const TIMEOUT_MS = 5000;
const USER_AGENT = "scenic-app (https://scenic-app.vercel.app)";

async function getJson(url, headers = {}) {
  const response = await fetch(url, {
    headers: { Accept: "application/json", ...headers },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`${url.hostname} answered ${response.status}`);
  }
  return response.json();
}

async function googleGeocode(address, apiKey) {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", address);
  url.searchParams.set("key", apiKey);

  let data;
  try {
    data = await getJson(url);
  } catch (err) {
    console.error("Google geocoding unreachable:", err.message);
    throw new HttpError(UNAVAILABLE, 502);
  }

  if (!data || data.status !== "OK" || !data.results.length) {
    throw new HttpError(NOT_FOUND, 422);
  }

  return data.results[0].geometry.location;
}

/* Keyless geocoders. Nominatim rate-limits shared cloud egress IPs, so a miss
   there falls through to Photon (komoot) before giving up. Each returns
   { lat, lng }, null for a genuine not-found, or throws on network failure. */
async function nominatim(address) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", address);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  const results = await getJson(url, { "User-Agent": USER_AGENT });
  if (!Array.isArray(results) || results.length === 0) return null;
  return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
}

async function photon(address) {
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", address);
  url.searchParams.set("limit", "1");
  const data = await getJson(url, { "User-Agent": USER_AGENT });
  const feats = data && data.features;
  if (!Array.isArray(feats) || feats.length === 0) return null;
  const [lng, lat] = feats[0].geometry.coordinates;
  return { lat, lng };
}

async function keylessGeocode(address) {
  let lastNetworkError = null;
  for (const provider of [nominatim, photon]) {
    try {
      const coords = await provider(address);
      if (coords) return coords;
    } catch (err) {
      lastNetworkError = err;
    }
  }
  if (lastNetworkError) {
    console.error("Geocoding providers unreachable:", lastNetworkError.message);
    throw new HttpError(UNAVAILABLE, 502);
  }
  throw new HttpError(NOT_FOUND, 422);
}

/**
 * Turn an address into { lat, lng }: Google when a key is configured,
 * otherwise Nominatim, then Photon. The key is read per call, so the
 * caller (createApp's env) decides, not whatever was set at import time.
 */
async function getCoordinatesForAddress(address, { apiKey = process.env.GOOGLE_API_KEY } = {}) {
  return apiKey ? googleGeocode(address, apiKey) : keylessGeocode(address);
}

module.exports = getCoordinatesForAddress;
