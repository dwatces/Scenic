// The seeder copies exactly the demo content, labelled as demo, once.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { require, mongoose, dbUrl } from "./helpers.mjs";

const { seed } = require("../util/seedAtlas.js");
const User = require("../models/user.js");
const Scene = require("../models/scene.js");

describe("seed()", () => {
  beforeAll(async () => {
    await mongoose.connect(dbUrl("seed"));
  });
  afterAll(async () => {
    await mongoose.disconnect();
  });

  it("creates exactly 2 demo users and 3 scenes, flagged and linked", async () => {
    const result = await seed({ password: process.env.SEED_PASSWORD });
    expect(result).toEqual({ created: 5, users: 2, scenes: 3 });
    const users = await User.find({}, "email demo scenes").lean();
    expect(users.map((u) => u.email).sort()).toEqual(["aroha@scenic.example", "daniel@scenic.example"]);
    expect(users.every((u) => u.demo === true)).toBe(true);
    const scenes = await Scene.find({}, "creator image").lean();
    for (const scene of scenes) {
      const owner = users.find((u) => String(u._id) === String(scene.creator));
      expect(owner.scenes.map(String)).toContain(String(scene._id));
      const bytes = Buffer.from(scene.image.data, "base64");
      expect(bytes.subarray(0, 3).toString("hex")).toBe("ffd8ff");
    }
  });

  it("is idempotent", async () => {
    expect(await seed({ password: process.env.SEED_PASSWORD })).toEqual({ created: 0, users: 2, scenes: 3 });
  });
});
