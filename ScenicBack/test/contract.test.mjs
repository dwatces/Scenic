// Database mode and demo mode answer every GET route with the same shape:
// identical deep key sets. Both apps run in this process; the demo one has
// no DB_URL, which always means demo mode.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import {
  require,
  mongoose,
  buildApp,
  listen,
  close,
  dbUrl,
  deepKeys,
  sorted,
  findKeys,
  PNG_1PX,
  SPARE_PORT,
} from "./helpers.mjs";

const { seed } = require("../util/seedAtlas.js");
const demo = require("../util/demoData.js");

describe("DB and demo responses have the same shape", () => {
  let db;
  let demoServer;
  let member; // signed up through the API
  let memberSceneId;
  let seededUserId;

  beforeAll(async () => {
    db = await listen(buildApp({ env: { ...process.env, DB_URL: dbUrl("contract") } }));
    demoServer = await listen(buildApp({ env: { JWT_KEY: "x" } }), SPARE_PORT);
    await request(db).get("/");
    expect(mongoose.connection.readyState).toBe(1);

    await seed({ password: process.env.SEED_PASSWORD });
    const User = require("../models/user.js");
    seededUserId = String((await User.findOne({ email: "daniel@scenic.example" }))._id);

    member = (
      await request(db)
        .post("/api/users/signup")
        .field("name", "Kiri")
        .field("email", "kiri@example.com")
        .field("password", "secret123")
        .attach("image", PNG_1PX, { filename: "a.png", contentType: "image/png" })
    ).body;
    const created = await request(db)
      .post("/api/scenes")
      .set("Authorization", `Bearer ${member.token}`)
      .field("title", "Piha")
      .field("description", "Lion Rock at low tide.")
      .field("address", "Piha")
      .attach("image", PNG_1PX, { filename: "a.png", contentType: "image/png" });
    memberSceneId = created.body.scene.id;
  });

  afterAll(async () => {
    await close(db);
    await close(demoServer);
    await mongoose.disconnect();
  });

  async function both(dbPath, demoPath) {
    const [a, b] = await Promise.all([request(db).get(dbPath), request(demoServer).get(demoPath)]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    return [a.body, b.body];
  }

  it("GET /api/users/users", async () => {
    const [fromDb, fromDemo] = await both("/api/users/users", "/api/users/users");
    expect(fromDb.users.length).toBe(3);
    expect(sorted(deepKeys(fromDb))).toEqual(sorted(deepKeys(fromDemo)));
  });

  it("GET /api/scenes/user/:userId (seeded member and a member who signed up)", async () => {
    const demoUserId = String(demo.IDS.daniel);
    const [seeded, fromDemo] = await both(
      `/api/scenes/user/${seededUserId}`,
      `/api/scenes/user/${demoUserId}`,
    );
    expect(sorted(deepKeys(seeded))).toEqual(sorted(deepKeys(fromDemo)));
    const [signedUp] = await both(
      `/api/scenes/user/${member.userId}`,
      `/api/scenes/user/${demoUserId}`,
    );
    expect(sorted(deepKeys(signedUp))).toEqual(sorted(deepKeys(fromDemo)));
  });

  it("GET /api/scenes/:sceneId", async () => {
    const [fromDb, fromDemo] = await both(
      `/api/scenes/${memberSceneId}`,
      `/api/scenes/${demo.IDS.milford}`,
    );
    expect(sorted(deepKeys(fromDb))).toEqual(sorted(deepKeys(fromDemo)));
  });

  it("GET /api/scenes (the feed)", async () => {
    const [fromDb, fromDemo] = await both("/api/scenes", "/api/scenes");
    expect(fromDb.scenes.length).toBe(4);
    expect(sorted(deepKeys(fromDb))).toEqual(sorted(deepKeys(fromDemo)));
    const [filtered] = await both(
      `/api/scenes?creator=${member.userId}`,
      `/api/scenes?creator=${demo.IDS.daniel}`,
    );
    expect(sorted(deepKeys(filtered))).toEqual(sorted(deepKeys(fromDemo)));
  });

  it("GET /api/users and GET /api/users/:userId", async () => {
    const [list, demoList] = await both("/api/users", "/api/users");
    expect(sorted(deepKeys(list))).toEqual(sorted(deepKeys(demoList)));
    const [one, demoOne] = await both(
      `/api/users/${member.userId}`,
      `/api/users/${demo.IDS.aroha}`,
    );
    expect(sorted(deepKeys(one))).toEqual(sorted(deepKeys(demoOne)));
  });

  it("labels demo accounts and their scenes, and nothing else", async () => {
    const users = (await request(db).get("/api/users/users")).body.users;
    const byName = Object.fromEntries(users.map((u) => [u.name, u.isDemo]));
    expect(byName).toEqual({ "Daniel (demo)": true, "Aroha (demo)": true, Kiri: false });
    const seededScenes = (await request(db).get(`/api/scenes/user/${seededUserId}`)).body.scenes;
    expect(seededScenes.every((s) => s.isDemo === true)).toBe(true);
    const memberScene = (await request(db).get(`/api/scenes/${memberSceneId}`)).body.scene;
    expect(memberScene.isDemo).toBe(false);
  });

  it("labels an account on the demo domain even without the flag", async () => {
    const User = require("../models/user.js");
    await User.collection.insertOne({
      name: "Legacy demo",
      email: "old@scenic.example",
      password: "x",
      scenes: [],
    });
    const users = (await request(db).get("/api/users/users")).body.users;
    expect(users.find((u) => u.name === "Legacy demo").isDemo).toBe(true);
  });

  it("never sends an email, password or __v from any GET route", async () => {
    const paths = [
      "/api/scenes",
      "/api/users",
      `/api/users/${member.userId}`,
      `/api/users/${seededUserId}`,
      "/api/users/users",
      `/api/scenes/user/${seededUserId}`,
      `/api/scenes/user/${member.userId}`,
      `/api/scenes/${memberSceneId}`,
    ];
    for (const path of paths) {
      const res = await request(db).get(path);
      expect(findKeys(res.body, ["email", "password", "__v"])).toEqual([]);
      expect(res.text).not.toMatch(/@(scenic\.)?example(\.com)?/);
    }
  });
});
