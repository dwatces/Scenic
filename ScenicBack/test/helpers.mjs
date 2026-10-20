// Shared test helpers. The app is CommonJS, so it is loaded with a real
// `require` (never through Vitest's module graph): the test and the app then
// share one mongoose instance.
import { createRequire } from "node:module";
import { once } from "node:events";

export const require = createRequire(import.meta.url);
export const mongoose = require("mongoose");

export const API_PORT = 7103; // the app under test
export const SPARE_PORT = 7109; // a second app in the same file, one at a time

export const STUB_COORDS = { lat: -36.8485, lng: 174.7633 };
export const stubGeocode = async () => ({ ...STUB_COORDS });

/** A database name of its own for each test file, on the shared replica set. */
export function dbUrl(name) {
  const url = new URL(process.env.TEST_DB_BASE);
  url.pathname = `/${name}`;
  return url.toString();
}

/**
 * An app with the stub geocoder and the sign-up/login rate limiter off:
 * every request in a run comes from 127.0.0.1, so one shared bucket of 10
 * would break the rest of the suite. Limiter tests switch it back on.
 */
export function buildApp(options = {}) {
  const { createApp } = require("../app.js");
  return createApp({ geocode: stubGeocode, rateLimit: false, ...options });
}

/** Every key path in a JSON value whose last segment is one of `names`. */
export function findKeys(value, names, path = "$") {
  if (Array.isArray(value)) return value.flatMap((item, i) => findKeys(item, names, `${path}[${i}]`));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) => [
      ...(names.includes(key) ? [`${path}.${key}`] : []),
      ...findKeys(child, names, `${path}.${key}`),
    ]);
  }
  return [];
}

export async function listen(app, port = API_PORT) {
  const server = app.listen(port, "127.0.0.1");
  await once(server, "listening");
  return server;
}

export async function close(server) {
  if (!server) return;
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}

/** Smallest valid PNG (1 x 1 px). */
export const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

/** An unsigned `alg: none` token, the shape an attacker would forge. */
export function algNoneToken(payload) {
  const enc = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  return `${enc({ alg: "none", typ: "JWT" })}.${enc({ ...payload, iat: Math.floor(Date.now() / 1000) })}.`;
}

/** Listening TCP ports owned by this process, read from `ss`. */
export async function ownListeningPorts() {
  const { execFileSync } = require("node:child_process");
  const out = execFileSync("ss", ["-ltnpH"], { encoding: "utf8" });
  return out
    .split("\n")
    .filter((line) => line.includes(`pid=${process.pid},`))
    .map((line) => Number(line.trim().split(/\s+/)[3].split(":").pop()))
    .sort();
}

/** Tiny real images (1 x 1 px), made with Pillow. */
export const JPEG_1PX = Buffer.from(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQgJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDh6KKKwPIP/9k=",
  "base64"
);
export const WEBP_1PX = Buffer.from(
  "UklGRjAAAABXRUJQVlA4ICQAAABwAQCdASoBAAEAAUAmJYgCdAF1AAD+9IhzSIQf8b/Vr5MhwAA=",
  "base64"
);
export const GIF_1PX = Buffer.from("R0lGODdhAQABAIEAAChaPAAAAAAAAAAAACwAAAAAAQABAAAIBAABBAQAOw==", "base64");

/** The set of key paths in a JSON value, with array items collapsed to "[]". */
export function deepKeys(value, path = "") {
  const keys = new Set();
  if (Array.isArray(value)) {
    for (const item of value) for (const key of deepKeys(item, `${path}[]`)) keys.add(key);
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${key}` : key;
      keys.add(childPath);
      for (const nested of deepKeys(child, childPath)) keys.add(nested);
    }
  }
  return keys;
}

export const sorted = (set) => [...set].sort();
