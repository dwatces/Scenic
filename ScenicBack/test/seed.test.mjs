// The seeder copies exactly the demo content, labelled as demo, once.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { require, mongoose, dbUrl, buildApp, listen, close, findKeys } from "./helpers.mjs";

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

  it("copies the demo content as it is: names, descriptions, credits, WebP photos and card images", async () => {
    const users = await User.find({}, "name image").lean();
    expect(users.map((u) => u.name).sort()).toEqual(["Aroha", "Daniel"]);
    const scenes = await Scene.find({}, "title description image thumb credit").lean();
    for (const scene of scenes) {
      const source = demo.SCENES.find((s) => s.title === scene.title);
      expect(scene.description).toBe(source.description);
      expect(scene.credit).toEqual(source.credit);
      expect(scene.thumb).toEqual(source.thumb);
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

  it("never lets a seeded email or password out through any GET route", async () => {
    const server = await listen(buildApp({ env: { ...process.env, DB_URL: dbUrl("seed") } }));
    try {
      const users = (await request(server).get("/api/users")).body.users;
      const scenes = (await request(server).get("/api/scenes")).body.scenes;
      expect(users).toHaveLength(2);
      expect(scenes).toHaveLength(3);
      const paths = [
        "/api/users",
        "/api/users/users",
        "/api/scenes",
        ...users.flatMap((u) => [`/api/users/${u.id}`, `/api/scenes/user/${u.id}`]),
        ...scenes.map((s) => `/api/scenes/${s.id}`),
      ];
      for (const path of paths) {
        const res = await request(server).get(path);
        expect(res.status, path).toBe(200);
        expect(findKeys(res.body, ["email", "password", "__v"]), path).toEqual([]);
        expect(JSON.stringify(res.body), path).not.toMatch(/@scenic\.example|\$2[aby]\$/);
      }
    } finally {
      await close(server);
    }
  });
});
