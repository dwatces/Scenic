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

// Keyless fallback: OpenStreetMap Nominatim (identify the app per usage policy).
async function nominatimGeocode(address) {
  const response = await axios.get("https://nominatim.openstreetmap.org/search", {
    params: { q: address, format: "json", limit: 1 },
    headers: { "User-Agent": "scenic-app (https://scenic-app.vercel.app)" },
  });

  const results = response.data;
  if (!Array.isArray(results) || results.length === 0) {
    throw new HttpError("Could not find the location for this address", 422);
  }

  return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
}

async function getCoordinatesForAddress(address) {
  return API_KEY ? googleGeocode(address) : nominatimGeocode(address);
}

module.exports = getCoordinatesForAddress;
