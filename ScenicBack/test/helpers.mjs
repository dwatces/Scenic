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

export function buildApp(options = {}) {
  const { createApp } = require("../app.js");
  return createApp({ geocode: stubGeocode, ...options });
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
