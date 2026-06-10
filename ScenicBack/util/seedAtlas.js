/* One-shot seeder: copies the demo users/scenes into the real database.
   Usage: DB_URL=<atlas-uri> [SEED_PASSWORD=<pw>] node util/seedAtlas.js
   Idempotent: skips any user whose email already exists. */
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User = require("../models/user");
const Scene = require("../models/scene");
const { USERS, SCENES } = require("./demoData");

const EMAILS = { demouser1: "daniel@scenic.example", demouser2: "aroha@scenic.example" };

async function main() {
  if (!process.env.DB_URL) throw new Error("DB_URL is required");
  await mongoose.connect(process.env.DB_URL);

  const password = process.env.SEED_PASSWORD || crypto.randomBytes(9).toString("base64url");
  const hashed = bcrypt.hashSync(password, 8);
  const userIds = {};
  let created = 0;

  for (const u of USERS) {
    const email = EMAILS[u.id];
    const existing = await User.findOne({ email });
    if (existing) {
      userIds[u.id] = existing._id;
      continue;
    }
    const doc = await User.create({
      name: u.name.replace(" (demo)", ""),
      email,
      password: hashed,
      image: { data: u.image.data, contentType: u.contentType },
      scenes: [],
    });
    userIds[u.id] = doc._id;
    created++;
  }

  for (const s of SCENES) {
    const creator = userIds[s.creator];
    const existing = await Scene.findOne({ title: s.title, creator });
    if (existing) continue;
    const doc = await Scene.create({
      title: s.title,
      description: s.description.replace(/ - demo scene.*\.$/, "."),
      image: { data: s.image.data, contentType: s.contentType },
      address: s.address,
      location: s.location,
      creator,
    });
    await User.updateOne({ _id: creator }, { $push: { scenes: doc._id } });
    created++;
  }

  const users = await User.countDocuments();
  const scenes = await Scene.countDocuments();
  console.log(`Seed done: ${created} documents created. DB now has ${users} users, ${scenes} scenes.`);
  if (created > 0 && !process.env.SEED_PASSWORD) {
    console.log(`Generated login password for seeded users: ${password}`);
  }
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
