// Where the API lives. REACT_APP_BACKEND_URL keeps its Create React App era
// name, so the existing Vercel setting still works (vite.config.js lets the
// REACT_APP_ prefix through). Without it, production builds use the live API
// and dev uses a local one.
const FALLBACK = import.meta.env.PROD
  ? "https://scenic-api.vercel.app/api"
  : "http://localhost:5000/api";

export const API_URL = (import.meta.env.REACT_APP_BACKEND_URL || FALLBACK).replace(/\/+$/, "");

/**
 * A path from an API response (an imageUrl or avatarUrl such as
 * "/api/scenes/<id>/image?v=1") as an absolute URL on the API's origin.
 * @returns {string | null}
 */
export const apiAsset = (path) => (path ? new URL(path, API_URL).href : null);
