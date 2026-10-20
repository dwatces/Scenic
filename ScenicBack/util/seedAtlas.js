/* One-shot seeder: copies the demo users and scenes into a real database.
   Usage: DB_URL=<connection-string> [SEED_PASSWORD=<pw>] node util/seedAtlas.js
   Idempotent: skips any user whose email already exists, and any scene that
   user already has with the same title. */
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User = require("../models/user");
const Scene = require("../models/scene");
const { USERS, SCENES } = require("./demoData");

/**
 * Seed the demo content through the already-open default mongoose
 * connection, exactly as util/demoData.js has it: accounts are flagged
 * demo: true, and each scene keeps its photo and photo credit.
 * @param {{ password: string }} options the login password for seeded accounts
 * @returns {Promise<{ created: number, users: number, scenes: number }>}
 */
async function seed({ password }) {
  const hashed = await bcrypt.hash(password, 10);
  const userIds = new Map(); // demo id -> database id
  let created = 0;

  for (const u of USERS) {
    const existing = await User.findOne({ email: u.email });
    if (existing) {
      userIds.set(String(u._id), existing._id);
      continue;
    }
    const doc = await User.create({
      name: u.name,
      email: u.email,
      password: hashed,
      demo: true,
      image: { data: u.image.data, contentType: u.image.contentType },
      scenes: [],
    });
    userIds.set(String(u._id), doc._id);
    created++;
  }

  for (const s of SCENES) {
    const creator = userIds.get(String(s.creator));
    const existing = await Scene.findOne({ title: s.title, creator });
    if (existing) continue;
    const doc = await Scene.create({
      title: s.title,
      description: s.description,
      image: { data: s.image.data, contentType: s.image.contentType },
      address: s.address,
      location: s.location,
      creator,
      credit: s.credit,
    });
    await User.updateOne({ _id: creator }, { $addToSet: { scenes: doc._id } });
    created++;
  }

  return {
    created,
    users: await User.countDocuments(),
    scenes: await Scene.countDocuments(),
  };
}

async function main() {
  if (!process.env.DB_URL) throw new Error("DB_URL is required");
  await mongoose.connect(process.env.DB_URL);

  const password = process.env.SEED_PASSWORD || crypto.randomBytes(9).toString("base64url");
  const { created, users, scenes } = await seed({ password });
  console.log(
    `Seed done: ${created} documents created. DB now has ${users} users, ${scenes} scenes.`,
  );
  if (created > 0 && !process.env.SEED_PASSWORD) {
    console.log(`Generated login password for seeded users: ${password}`);
  }
  await mongoose.disconnect();
}

// Run only from the command line, so tests and scripts can import seed().
if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { seed };
