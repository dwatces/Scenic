// The scene feed (GET /api/scenes), the members list (GET /api/users) and
// public profiles (GET /api/users/:id): paging, filters, query checks, and
// no image bytes or private fields in any response.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import {
  require,
  mongoose,
  buildApp,
  listen,
  close,
  dbUrl,
  findKeys,
  PNG_1PX,
  SPARE_PORT,
} from "./helpers.mjs";

const { seed } = require("../util/seedAtlas.js");
const demo = require("../util/demoData.js");

const READ_CACHE = "s-maxage=1, stale-while-revalidate=599";
const EXTRA_SCENES = 30;

/** Every string value in a JSON value longer than `max` characters. */
function longStrings(value, max = 2048, path = "$") {
  if (typeof value === "string") return value.length > max ? [path] : [];
  if (Array.isArray(value))
    return value.flatMap((item, i) => longStrings(item, max, `${path}[${i}]`));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) =>
      longStrings(child, max, `${path}.${key}`),
    );
  }
  return [];
}

describe("feed and member API (database)", () => {
  let server;
  let User;
  let Scene;
  let member; // signed up through the API, with 30 scenes
  let seededDanielId;

  beforeAll(async () => {
    server = await listen(buildApp({ env: { ...process.env, DB_URL: dbUrl("feed") } }));
    await request(server).get("/");
    expect(mongoose.connection.readyState).toBe(1);
    User = require("../models/user.js");
    Scene = require("../models/scene.js");
    await seed({ password: process.env.SEED_PASSWORD });
    seededDanielId = String((await User.findOne({ email: "daniel@scenic.example" }))._id);

    member = (
      await request(server)
        .post("/api/users/signup")
        .field("name", "kiri")
        .field("email", "kiri@example.com")
        .field("password", "secret123")
        .attach("image", PNG_1PX, { filename: "a.png", contentType: "image/png" })
    ).body;
    // Big stored images (a PNG signature plus 300 KB), to prove the list
    // never carries them.
    const bigImage = {
      data: Buffer.concat([PNG_1PX, Buffer.alloc(300 * 1024, 7)]).toString("base64"),
      contentType: "image/png",
    };
    for (let i = 1; i <= EXTRA_SCENES; i++) {
      const scene = await Scene.create({
        title: `Test scene ${String(i).padStart(2, "0")}`,
        description: "A scene made by the feed test.",
        address: "Piha",
        location: { lat: -36.95, lng: 174.47 },
        creator: member.userId,
        image: i === 1 ? { data: PNG_1PX.toString("base64"), contentType: "image/png" } : bigImage,
      });
      await User.updateOne({ _id: member.userId }, { $addToSet: { scenes: scene._id } });
    }
  });

  afterAll(async () => {
    await close(server);
    await mongoose.disconnect();
  });

  const get = (path) => request(server).get(path);

  describe("GET /api/scenes", () => {
    it("returns 12 scenes newest first, with a cursor, and read caching", async () => {
      const res = await get("/api/scenes");
      expect(res.status).toBe(200);
      expect(res.headers["cache-control"]).toBe(READ_CACHE);
      expect(res.body.scenes).toHaveLength(12);
      const ids = res.body.scenes.map((scene) => scene.id);
      expect([...ids].sort().reverse()).toEqual(ids);
      expect(res.body.scenes[0].title).toBe("Test scene 30");
      expect(res.body.nextCursor).toBe(ids[11]);
    });

    it("pages with ?before= without overlap until nextCursor is null", async () => {
      const seen = [];
      let cursor = null;
      let pages = 0;
      do {
        const res = await get(`/api/scenes?limit=10${cursor ? `&before=${cursor}` : ""}`);
        expect(res.status).toBe(200);
        seen.push(...res.body.scenes.map((scene) => scene.id));
        cursor = res.body.nextCursor;
        pages++;
      } while (cursor && pages < 10);
      expect(pages).toBe(4); // 33 scenes in pages of 10
      expect(seen).toHaveLength(EXTRA_SCENES + 3);
      expect(new Set(seen).size).toBe(seen.length);
      expect([...seen].sort().reverse()).toEqual(seen);
    });

    it("answers the last page with nextCursor null", async () => {
      const res = await get("/api/scenes?limit=24");
      const last = await get(`/api/scenes?limit=24&before=${res.body.nextCursor}`);
      expect(last.body.scenes).toHaveLength(EXTRA_SCENES + 3 - 24);
      expect(last.body.nextCursor).toBeNull();
    });

    it("filters by creator", async () => {
      const res = await get(`/api/scenes?creator=${seededDanielId}`);
      expect(res.status).toBe(200);
      expect(res.body.scenes.map((scene) => scene.title)).toEqual(["Lake Tekapo", "Milford Sound"]);
      expect(res.body.scenes.every((scene) => scene.creator.id === seededDanielId)).toBe(true);
      expect(res.body.nextCursor).toBeNull();
      const unknown = await get("/api/scenes?creator=5f0000000000000000000000");
      expect(unknown.status).toBe(200);
      expect(unknown.body).toEqual({ scenes: [], nextCursor: null });
    });

    it("clamps the page size to 1-24 using the sanitised value", async () => {
      expect((await get("/api/scenes?limit=999")).body.scenes).toHaveLength(24);
      expect((await get("/api/scenes?limit=24.9")).body.scenes).toHaveLength(24);
      expect((await get("/api/scenes?limit=3")).body.scenes).toHaveLength(3);
      expect((await get("/api/scenes?limit=0")).body.scenes).toHaveLength(1);
    });

    it("refuses a malformed limit, cursor or creator with 422", async () => {
      const cases = {
        "limit=5abc": "The page size must be a number from 1 to 24.",
        "limit=-3": "The page size must be a number from 1 to 24.",
        "limit=1&limit=2": "The page size must be a number from 1 to 24.",
        "before=garbage": "That page link isn't valid.",
        "before=abcdefghijkl": "That page link isn't valid.",
        "creator=garbage": "That member link isn't valid.",
      };
      for (const [query, message] of Object.entries(cases)) {
        const res = await get(`/api/scenes?${query}`);
        expect(res.status, query).toBe(422);
        expect(res.body.message, query).toBe(message);
        expect(res.headers["cache-control"], query).toBe("no-store");
      }
    });

    it("ignores unknown parameters such as the client's fresh=", async () => {
      const res = await get("/api/scenes?fresh=123&utm_source=x");
      expect(res.status).toBe(200);
      expect(res.body.scenes).toHaveLength(12);
    });

    it("sends image URLs, never image bytes, and stays small", async () => {
      const res = await get("/api/scenes?limit=10");
      expect(longStrings(res.body)).toEqual([]);
      expect(Buffer.byteLength(res.text)).toBeLessThanOrEqual(20 * 1024);
      for (const scene of res.body.scenes) {
        expect(scene.imageUrl).toMatch(new RegExp(`^/api/scenes/${scene.id}/image\\?v=\\d+$`));
        expect(scene).not.toHaveProperty("image");
      }
      const first = res.body.scenes.at(-1);
      const image = await get(first.imageUrl);
      expect(image.status).toBe(200);
      expect(image.headers["content-type"]).toMatch(/^image\//);
    });

    it("summarises the creator without private fields, labelling demo content", async () => {
      const res = await get("/api/scenes?limit=24&before=" + "f".repeat(24));
      expect(findKeys(res.body, ["email", "password", "__v", "data"])).toEqual([]);
      expect(res.text).not.toMatch(/@(scenic\.)?example(\.com)?/);
      const scene = res.body.scenes[0];
      expect(Object.keys(scene.creator).sort()).toEqual(["avatarUrl", "id", "isDemo", "name"]);
      expect(scene.creator).toMatchObject({ id: member.userId, name: "kiri", isDemo: false });
      expect(scene.creator.avatarUrl).toMatch(
        new RegExp(`^/api/users/${member.userId}/image\\?v=\\d+$`),
      );
      expect((await get(scene.creator.avatarUrl)).status).toBe(200);
      const seeded = await get(`/api/scenes?creator=${seededDanielId}`);
      expect(seeded.body.scenes.every((s) => s.isDemo && s.creator.isDemo)).toBe(true);
    });
  });

  describe("GET /api/users", () => {
    it("lists every member by name (ignoring case) with scene counts, no bytes, no emails", async () => {
      await User.collection.insertOne({
        name: "Zed",
        email: "zed@example.com",
        password: "x",
        scenes: [],
      });
      const res = await get("/api/users");
      expect(res.status).toBe(200);
      expect(res.headers["cache-control"]).toBe(READ_CACHE);
      expect(res.body.users.map((user) => user.name)).toEqual(["Aroha", "Daniel", "kiri", "Zed"]);
      const byName = Object.fromEntries(res.body.users.map((user) => [user.name, user]));
      expect(byName.kiri.sceneCount).toBe(EXTRA_SCENES);
      expect(byName["Daniel"].sceneCount).toBe(2);
      expect(byName["Daniel"].isDemo).toBe(true);
      expect(byName.kiri.isDemo).toBe(false);
      expect(byName.Zed.avatarUrl).toBeNull();
      expect(findKeys(res.body, ["email", "password", "__v", "data", "image"])).toEqual([]);
      expect(longStrings(res.body)).toEqual([]);
    });
  });

  describe("GET /api/users/:userId", () => {
    it("returns one member's public profile", async () => {
      const res = await get(`/api/users/${member.userId}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        user: {
          id: member.userId,
          name: "kiri",
          avatarUrl: expect.stringMatching(/^\/api\/users\/[0-9a-f]{24}\/image\?v=\d+$/),
          sceneCount: EXTRA_SCENES,
          isDemo: false,
        },
      });
    });

    it("answers an unknown or malformed id with 404", async () => {
      for (const id of ["5f0000000000000000000000", "nope", "abcdefghijkl"]) {
        const res = await get(`/api/users/${id}`);
        expect(res.status, id).toBe(404);
        expect(res.body.message).toBe("We couldn't find that member.");
      }
    });

    it("leaves the legacy members route where it was", async () => {
      const res = await get("/api/users/users");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.users)).toBe(true);
    });
  });
});

describe("feed and member API (demo mode)", () => {
  let server;
  beforeAll(async () => {
    server = await listen(buildApp({ env: { JWT_KEY: "x" } }), SPARE_PORT);
  });
  afterAll(() => close(server));
  const get = (path) => request(server).get(path);

  it("serves the three demo scenes newest first, labelled demo", async () => {
    const res = await get("/api/scenes");
    expect(res.status).toBe(200);
    expect(res.body.scenes.map((scene) => scene.title)).toEqual([
      "Cathedral Cove",
      "Lake Tekapo",
      "Milford Sound",
    ]);
    expect(res.body.nextCursor).toBeNull();
    expect(res.body.scenes.every((scene) => scene.isDemo)).toBe(true);
    expect(longStrings(res.body)).toEqual([]);
  });

  it("pages and filters like the database", async () => {
    const first = await get("/api/scenes?limit=2");
    expect(first.body.scenes).toHaveLength(2);
    const second = await get(`/api/scenes?limit=2&before=${first.body.nextCursor}`);
    expect(second.body.scenes.map((scene) => scene.title)).toEqual(["Milford Sound"]);
    expect(second.body.nextCursor).toBeNull();
    const byAroha = await get(`/api/scenes?creator=${demo.IDS.aroha}`);
    expect(byAroha.body.scenes.map((scene) => scene.title)).toEqual(["Cathedral Cove"]);
    expect((await get("/api/scenes?before=garbage")).status).toBe(422);
    expect((await get("/api/scenes?limit=999")).status).toBe(200);
  });

  it("lists and profiles the demo members", async () => {
    const list = await get("/api/users");
    expect(list.body.users.map((user) => user.name)).toEqual(["Aroha", "Daniel"]);
    const one = await get(`/api/users/${demo.IDS.daniel}`);
    expect(one.body.user).toMatchObject({ name: "Daniel", sceneCount: 2, isDemo: true });
    expect((await get("/api/users/5f0000000000000000000000")).status).toBe(404);
    expect((await get("/api/users/users")).status).toBe(200);
  });
});
