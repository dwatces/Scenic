// Network guard, loaded into every test worker before any test file: a test
// may only talk to this machine. Any HTTP(S) request or fetch to another
// host throws, so a test can never reach Nominatim, Photon, Google or a live
// deployment. MongoDB uses raw sockets to 127.0.0.1 and is not affected.
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const http = require("node:http");
const https = require("node:https");

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
const blocked = [];
globalThis.__blockedRequests = blocked;

function hostFrom(input) {
  if (!input) return undefined;
  if (typeof input === "string") return new URL(input).hostname;
  if (input instanceof URL) return input.hostname;
  if (typeof input.url === "string") return new URL(input.url).hostname; // Request
  if (input.hostname) return input.hostname;
  if (input.host) return String(input.host).replace(/:\d+$/, "");
  return "localhost"; // Node defaults to localhost when no host is given
}

function check(host) {
  if (!LOCAL_HOSTS.has(host)) {
    blocked.push(host);
    throw new Error(`Network guard: blocked a request to ${host}`);
  }
}

for (const mod of [http, https]) {
  for (const method of ["request", "get"]) {
    const original = mod[method];
    mod[method] = function guarded(...args) {
      const [input, options] = args;
      const host =
        typeof input === "string" || input instanceof URL
          ? hostFrom(input)
          : hostFrom(input || options);
      check(host);
      return original.apply(this, args);
    };
  }
}

const originalFetch = globalThis.fetch;
globalThis.fetch = async function guardedFetch(input, init) {
  check(hostFrom(input));
  return originalFetch(input, init);
};
