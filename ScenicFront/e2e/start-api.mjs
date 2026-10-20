// The API for end-to-end tests, from ../ScenicBack (run `npm ci` there
// first): an in-memory MongoDB replica set, the real seeder (2 demo members,
// 3 scenes), a stub geocoder, no rate limit. Never touches a real database
// or the network.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const backDir = fileURLToPath(new URL("../../ScenicBack/", import.meta.url));
const require = createRequire(backDir + "package.json");

const API_PORT = Number(process.env.PW_API_PORT || 7105);
const DB_PORT = Number(process.env.PW_DB_PORT || 7108);
process.env.MONGOMS_VERSION ||= "8.2.6";
process.env.MONGOMS_RUNTIME_DOWNLOAD ||= process.env.CI ? "true" : "false";
// Seeded demo accounts log in with this password (local test data only).
export const SEED_PASSWORD = process.env.E2E_SEED_PASSWORD || "e2e-demo-password";

const { MongoMemoryReplSet } = require("mongodb-memory-server-core");
const mongoose = require("mongoose");

const replSet = await MongoMemoryReplSet.create({
  replSet: { count: 1, storageEngine: "wiredTiger" },
  instanceOpts: [{ port: DB_PORT, launchTimeout: 60000 }],
});
if (new URL(replSet.getUri()).port !== String(DB_PORT)) {
  await replSet.stop();
  throw new Error(`Port ${DB_PORT} is busy`);
}
const dbUrl = replSet.getUri("scenic-e2e");
await mongoose.connect(dbUrl);

const { seed } = require(backDir + "util/seedAtlas.js");
await seed({ password: SEED_PASSWORD });

const { createApp } = require(backDir + "app.js");
const app = createApp({
  env: { DB_URL: dbUrl, JWT_KEY: "e2e-only-jwt-key" },
  geocode: async () => ({ lat: -36.8485, lng: 174.7633 }),
  rateLimit: false,
});
const server = app.listen(API_PORT, "127.0.0.1", () =>
  console.log(
    `e2e API on http://127.0.0.1:${API_PORT} (MongoDB on ${DB_PORT}), pid ${process.pid}`,
  ),
);

async function stop() {
  server.close();
  await mongoose.disconnect();
  await replSet.stop();
  process.exit(0);
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
