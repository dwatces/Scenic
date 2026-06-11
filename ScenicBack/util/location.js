const axios = require("axios").default;

const HttpError = require("../models/http-error");

const API_KEY = process.env.GOOGLE_API_KEY;

async function googleGeocode(address) {
  const response = await axios.get(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      address
    )}&key=${API_KEY}`
  );

  const data = response.data;

  if (!data || data.status !== "OK" || !data.results.length) {
    throw new HttpError("Could not find the location for this address", 422);
  }

  return data.results[0].geometry.location;
}

/* Keyless geocoders. Nominatim rate-limits shared cloud egress IPs, so a miss
   there falls through to Photon (komoot) before giving up. Returns
   { lat, lng }, null for a genuine not-found, or throws on network failure. */
async function nominatim(address) {
  const response = await axios.get("https://nominatim.openstreetmap.org/search", {
    params: { q: address, format: "json", limit: 1 },
    headers: { "User-Agent": "scenic-app (https://scenic-app.vercel.app)" },
    timeout: 5000,
  });
  const results = response.data;
  if (!Array.isArray(results) || results.length === 0) return null;
  return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
}

async function photon(address) {
  const response = await axios.get("https://photon.komoot.io/api/", {
    params: { q: address, limit: 1 },
    timeout: 5000,
  });
  const feats = response.data && response.data.features;
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
    throw new HttpError(
      "The location service is temporarily unavailable, please try again",
      502
    );
  }
  throw new HttpError("Could not find the location for this address", 422);
}

async function getCoordinatesForAddress(address) {
  return API_KEY ? googleGeocode(address) : keylessGeocode(address);
}

module.exports = getCoordinatesForAddress;
