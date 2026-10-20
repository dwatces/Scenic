// The API against a real (in-memory) MongoDB replica set: accounts, scenes,
// ownership. Known bugs are listed at the end as todo/fails until fixed.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import {
  require,
  mongoose,
  buildApp,
  listen,
  close,
  dbUrl,
  PNG_1PX,
  STUB_COORDS,
} from "./helpers.mjs";

const PASSWORD = "secret123";

function signup(server, { name = "Test Member", email, password = PASSWORD, image = true } = {}) {
  const req = request(server)
    .post("/api/users/signup")
    .field("name", name)
    .field("email", email)
    .field("password", password);
  return image ? req.attach("image", PNG_1PX, { filename: "a.png", contentType: "image/png" }) : req;
}

function login(server, email, password = PASSWORD) {
  return request(server).post("/api/users/login").send({ email, password });
}

function createScene(server, token, fields = {}) {
  const body = { title: "Rangitoto", description: "The summit at sunrise.", address: "Rangitoto Island", ...fields };
  let req = request(server).post("/api/scenes");
  if (token) req = req.set("Authorization", `Bearer ${token}`);
  for (const [key, value] of Object.entries(body)) req = req.field(key, value);
  return req.attach("image", PNG_1PX, { filename: "a.png", contentType: "image/png" });
}

describe("API with a database", () => {
  let server;
  let owner; // { userId, token }
  let other;
  let sceneId;

  beforeAll(async () => {
    server = await listen(buildApp({ env: { ...process.env, DB_URL: dbUrl("api") } }));
    // The first request opens the connection (bounded wait in the gate).
    await request(server).get("/api/users/users");
    expect(mongoose.connection.readyState).toBe(1);
  });

  afterAll(async () => {
    await close(server);
    await mongoose.disconnect();
  });

  it("answers the health check", async () => {
    const res = await request(server).get("/");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "ok", api: "Scenic backend" });
  });

  describe("accounts", () => {
    it("signs up and returns userId and token at the top level", async () => {
      const res = await signup(server, { email: "owner@example.com" });
      expect(res.status).toBe(201);
      expect(res.body.userId).toMatch(/^[0-9a-f]{24}$/);
      expect(typeof res.body.token).toBe("string");
      owner = res.body;
    });

    it("refuses a second account with the same email", async () => {
      const res = await signup(server, { email: "owner@example.com" });
      expect(res.status).toBe(422);
      expect(res.body.message).toEqual(expect.any(String));
    });

    it("refuses invalid sign-up input with 422", async () => {
      const res = await signup(server, { email: "not-an-email" });
      expect(res.status).toBe(422);
    });

    it("logs in with the email and password", async () => {
      const res = await login(server, "owner@example.com");
      expect(res.status).toBe(200);
      expect(res.body.userId).toBe(owner.userId);
      expect(typeof res.body.token).toBe("string");
    });

    it("refuses a wrong password without a token", async () => {
      const res = await login(server, "owner@example.com", "wrong-password");
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
      expect(res.body.token).toBeUndefined();
    });

    it("refuses an unknown email without a token", async () => {
      const res = await login(server, "nobody@example.com");
      expect(res.status).toBe(401);
      expect(res.body.token).toBeUndefined();
    });

    it("lists members without password hashes", async () => {
      const res = await request(server).get("/api/users/users");
      expect(res.status).toBe(200);
      expect(res.body.users).toHaveLength(1);
      expect(res.body.users[0]).not.toHaveProperty("password");
      expect(res.body.users[0].name).toBe("Test Member");
    });
  });

  describe("scenes", () => {
    it("creates a scene and links it to its creator in one transaction", async () => {
      const res = await createScene(server, owner.token);
      expect(res.status).toBe(201);
      sceneId = res.body.scene._id || res.body.scene.id;
      expect(res.body.scene.location).toEqual(STUB_COORDS);
      const User = require("../models/user.js");
      const user = await User.findById(owner.userId);
      expect(user.scenes.map(String)).toEqual([sceneId]);
    });

    it("lists a member's scenes", async () => {
      const res = await request(server).get(`/api/scenes/user/${owner.userId}`);
      expect(res.status).toBe(200);
      expect(res.body.scenes).toHaveLength(1);
      expect(res.body.scenes[0].title).toBe("Rangitoto");
      expect(res.body.scenes[0].image.data).toBe(PNG_1PX.toString("base64"));
    });

    it("gets one scene by id", async () => {
      const res = await request(server).get(`/api/scenes/${sceneId}`);
      expect(res.status).toBe(200);
      expect(res.body.scene.id).toBe(sceneId);
      expect(res.body.scene.address).toBe("Rangitoto Island");
    });

    it("returns 404 for a well-formed id that doesn't exist", async () => {
      const res = await request(server).get("/api/scenes/5f0000000000000000000000");
      expect(res.status).toBe(404);
    });

    it("lets the owner edit the title and description", async () => {
      const res = await request(server)
        .patch(`/api/scenes/${sceneId}`)
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ title: "Rangitoto summit", description: "Looking back at the city." });
      expect(res.status).toBe(200);
      expect(res.body.scene.title).toBe("Rangitoto summit");
    });

    it("refuses invalid edits with 422", async () => {
      const res = await request(server)
        .patch(`/api/scenes/${sceneId}`)
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ title: "", description: "x" });
      expect(res.status).toBe(422);
    });

    it("never lets another member edit or delete the scene", async () => {
      other = (await signup(server, { name: "Other", email: "other@example.com" })).body;
      const patch = await request(server)
        .patch(`/api/scenes/${sceneId}`)
        .set("Authorization", `Bearer ${other.token}`)
        .send({ title: "Hijacked", description: "Not my scene at all." });
      expect(patch.status).toBeGreaterThanOrEqual(400);
      const del = await request(server)
        .delete(`/api/scenes/${sceneId}`)
        .set("Authorization", `Bearer ${other.token}`);
      expect(del.status).toBeGreaterThanOrEqual(400);
      const after = await request(server).get(`/api/scenes/${sceneId}`);
      expect(after.body.scene.title).toBe("Rangitoto summit");
    });

    it("refuses to create a scene without a token", async () => {
      const res = await createScene(server, null);
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
      const Scene = require("../models/scene.js");
      expect(await Scene.countDocuments()).toBe(1);
    });

    it("lets the owner delete the scene and unlinks it from the member", async () => {
      const res = await request(server)
        .delete(`/api/scenes/${sceneId}`)
        .set("Authorization", `Bearer ${owner.token}`);
      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Scene deleted successfully");
      const gone = await request(server).get(`/api/scenes/${sceneId}`);
      expect(gone.status).toBe(404);
      const User = require("../models/user.js");
      expect((await User.findById(owner.userId)).scenes).toHaveLength(0);
    });
  });

  describe("known bugs (fixed in later commits)", () => {
    // Each of these crashes the process on Express 4 (an unhandled rejection
    // inside an async handler), so they can't run until Express 5.
    it.todo("signup without an image returns 422, not a crash");
    it.todo("create scene without an image returns 422, not a crash");
    it.todo("PATCH on a well-formed id that doesn't exist returns 404, not a crash");

    it.fails("ownership failures return 403", async () => {
      const res = await request(server)
        .patch(`/api/scenes/${(await createScene(server, owner.token)).body.scene._id}`)
        .set("Authorization", `Bearer ${other.token}`)
        .send({ title: "Hijacked", description: "Not my scene at all." });
      expect(res.status).toBe(403);
    });

    it.fails("missing token returns 401", async () => {
      const res = await createScene(server, null);
      expect(res.status).toBe(401);
    });

    it.fails("GET with a malformed id returns 404", async () => {
      const res = await request(server).get("/api/scenes/not-an-id");
      expect(res.status).toBe(404);
    });

    it.fails("the members list does not expose email addresses", async () => {
      const res = await request(server).get("/api/users/users");
      for (const user of res.body.users) expect(user).not.toHaveProperty("email");
    });

    it.fails("a mixed-case Gmail address logs in exactly as typed at sign-up", async () => {
      const email = "Test.User+123@Gmail.com";
      expect((await signup(server, { email })).status).toBe(201);
      const res = await login(server, email);
      expect(res.status).toBe(200);
    });

    it.fails("an operator object as the login email is refused with 401 or 422", async () => {
      const res = await request(server)
        .post("/api/users/login")
        .send({ email: { $ne: null }, password: "x" });
      expect(res.body.token).toBeUndefined();
      expect([401, 422]).toContain(res.status);
    });
  });
});
