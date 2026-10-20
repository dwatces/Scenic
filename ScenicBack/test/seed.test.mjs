// The seeder copies exactly the demo content, labelled as demo, once.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { require, mongoose, dbUrl } from "./helpers.mjs";

const { seed } = require("../util/seedAtlas.js");
const demo = require("../util/demoData.js");
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
    expect(users.map((u) => u.email).sort()).toEqual([
      "aroha@scenic.example",
      "daniel@scenic.example",
    ]);
    expect(users.every((u) => u.demo === true)).toBe(true);
    const scenes = await Scene.find({}, "creator image").lean();
    for (const scene of scenes) {
      const owner = users.find((u) => String(u._id) === String(scene.creator));
      expect(owner.scenes.map(String)).toContain(String(scene._id));
    }
  });

  it("copies the demo content as it is: names, descriptions, labelled WebP placeholders", async () => {
    const users = await User.find({}, "name image").lean();
    expect(users.map((u) => u.name).sort()).toEqual(["Aroha (demo)", "Daniel (demo)"]);
    const scenes = await Scene.find({}, "title description image").lean();
    for (const scene of scenes) {
      const source = demo.SCENES.find((s) => s.title === scene.title);
      expect(scene.description).toBe(source.description);
    }
    for (const doc of [...users, ...scenes]) {
      const bytes = Buffer.from(doc.image.data, "base64");
      expect(bytes.toString("ascii", 0, 4)).toBe("RIFF");
      expect(bytes.toString("ascii", 8, 12)).toBe("WEBP");
      expect(doc.image.contentType).toBe("image/webp");
    }
  });

  it("is idempotent", async () => {
    expect(await seed({ password: process.env.SEED_PASSWORD })).toEqual({
      created: 0,
      users: 2,
      scenes: 3,
    });
  });
});
