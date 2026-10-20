// The API for end-to-end tests, from ../ScenicBack (run `npm ci` there
// first): an in-memory MongoDB replica set, the real seeder plus an optional
// 30-scene fixture, a stub geocoder and no rate limit. Never touches a real
// database or the network.
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

// E2E_FIXTURE=1: 30 more scenes ("Test scene 01" to "Test scene 30") by a
// test member flagged demo, so paging ("Load more") and the six-scene
// landing feed have something to page through. They exist only in this
// in-memory database: never in the seeder or any committed demo content.
if (process.env.E2E_FIXTURE === "1") {
  const User = require(backDir + "models/user.js");
  const Scene = require(backDir + "models/scene.js");
  const images = require(backDir + "util/demoImages.js");
  const image = { data: images.milfordSound.toString("base64"), contentType: "image/webp" };
  // With a card image, as the client posts them, so cards load what they would live.
  const thumb = { data: images.milfordSoundCard.toString("base64"), contentType: "image/webp" };
  const member = await User.create({
    name: "Test member (demo)",
    email: "e2e-fixture@scenic.example",
    password: "not-a-login",
    demo: true,
    scenes: [],
  });
  for (let i = 1; i <= 30; i++) {
    const scene = await Scene.create({
      title: `Test scene ${String(i).padStart(2, "0")}`,
      description: "A fixture scene for the end-to-end tests.",
      address: "Auckland",
      location: { lat: -36.8485, lng: 174.7633 },
      creator: member._id,
      image,
      thumb,
    });
    await User.updateOne({ _id: member._id }, { $addToSet: { scenes: scene._id } });
  }
}

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
