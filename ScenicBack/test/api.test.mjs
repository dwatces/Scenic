// The API against a real (in-memory) MongoDB replica set: accounts, scenes,
// ownership, ids, uploads and error responses.
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
  JPEG_1PX,
  WEBP_1PX,
  GIF_1PX,
  STUB_COORDS,
  findKeys,
  algNoneToken,
} from "./helpers.mjs";

const PASSWORD = "secret123";
const MISSING_ID = "5f0000000000000000000000";

function signup(
  server,
  { name = "Test Member", email, password = PASSWORD, image = PNG_1PX } = {},
) {
  const req = request(server)
    .post("/api/users/signup")
    .field("name", name)
    .field("email", email)
    .field("password", password);
  return image ? req.attach("image", image, { filename: "a.png", contentType: "image/png" }) : req;
}

function login(server, email, password = PASSWORD) {
  return request(server).post("/api/users/login").send({ email, password });
}

function createScene(
  server,
  token,
  { fields = {}, image = PNG_1PX, filename = "a.png", contentType = "image/png" } = {},
) {
  const body = {
    title: "Rangitoto",
    description: "The summit at sunrise.",
    address: "Rangitoto Island",
    ...fields,
  };
  let req = request(server).post("/api/scenes");
  if (token) req = req.set("Authorization", `Bearer ${token}`);
  for (const [key, value] of Object.entries(body)) req = req.field(key, value);
  return image ? req.attach("image", image, { filename, contentType }) : req;
}

function expectNoInternals(res) {
  expect(JSON.stringify(res.body)).not.toMatch(
    /Cannot read properties|at .+\.js:\d+|Cast to ObjectId/,
  );
}

describe("API with a database", () => {
  let server;
  let owner; // { userId, token }
  let other;
  let sceneId;

  async function expectAlive() {
    const res = await request(server).get("/");
    expect(res.status).toBe(200);
  }

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
    // "db" proves the connection really opened: a rejected connect option
    // would silently drop the API into demo mode, where GETs still pass.
    expect(res.body).toEqual({ status: "ok", api: "Scenic backend", mode: "db" });
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
      expect(res.body.message).toBe("An account with this email already exists.");
    });

    it("maps a duplicate-key race to the same 422 (unique index, no plugin)", async () => {
      const User = require("../models/user.js");
      await User.init(); // index builds are asynchronous on a fresh database
      const email = "race@example.com";
      const results = await Promise.all(Array.from({ length: 4 }, () => signup(server, { email })));
      expect(results.map((r) => r.status).sort()).toEqual([201, 422, 422, 422]);
      for (const r of results.filter((r) => r.status === 422)) {
        expect(r.body.message).toBe("An account with this email already exists.");
      }
      expect(await User.countDocuments({ email })).toBe(1);
    });

    it("has a unique index on email that rejects a direct double insert", async () => {
      const User = require("../models/user.js");
      await User.init();
      const doc = {
        name: "Twice",
        email: "twice@example.com",
        password: "x".repeat(60),
        scenes: [],
      };
      await User.create(doc);
      await expect(User.create(doc)).rejects.toMatchObject({ code: 11000 });
    });

    it("refuses invalid sign-up input with a 422 that names the problem", async () => {
      const res = await signup(server, { email: "not-an-email" });
      expect(res.status).toBe(422);
      expect(res.body.message).toBe("Enter a valid email address.");
      const short = await signup(server, { email: "short@example.com", password: "12345" });
      expect(short.status).toBe(422);
      expect(short.body.message).toBe("Your password needs at least 6 characters.");
    });

    it("refuses sign-up without an image with 422 (the avatar becomes optional later)", async () => {
      const res = await signup(server, { email: "noimage@example.com", image: null });
      expect(res.status).toBe(422);
      expect(res.body.message).toBe("Add a JPEG, PNG or WebP image.");
      await expectAlive();
    });

    it("logs in with the email and password", async () => {
      const res = await login(server, "owner@example.com");
      expect(res.status).toBe(200);
      expect(res.body.userId).toBe(owner.userId);
      expect(typeof res.body.token).toBe("string");
    });

    it("refuses a wrong password with 401 and no token", async () => {
      const res = await login(server, "owner@example.com", "wrong-password");
      expect(res.status).toBe(401);
      expect(res.body.token).toBeUndefined();
    });

    it("refuses an unknown email with 401 and no token", async () => {
      const res = await login(server, "nobody@example.com");
      expect(res.status).toBe(401);
      expect(res.body.token).toBeUndefined();
    });

    it("lists members without password hashes", async () => {
      const res = await request(server).get("/api/users/users");
      expect(res.status).toBe(200);
      expect(res.body.users.length).toBeGreaterThan(0);
      for (const user of res.body.users) expect(user).not.toHaveProperty("password");
      expect(res.body.users.map((u) => u.name)).toContain("Test Member");
    });
  });

  describe("scenes", () => {
    it("creates a scene and links it to its creator in one transaction", async () => {
      const res = await createScene(server, owner.token);
      expect(res.status).toBe(201);
      sceneId = res.body.scene.id;
      expect(res.body.scene._id).toBe(sceneId);
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

    it("lets the owner edit the title and description", async () => {
      const res = await request(server)
        .patch(`/api/scenes/${sceneId}`)
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ title: "Rangitoto summit", description: "Looking back at the city." });
      expect(res.status).toBe(200);
      expect(res.body.scene.title).toBe("Rangitoto summit");
    });

    it("refuses invalid edits with a 422 that names the problem", async () => {
      const res = await request(server)
        .patch(`/api/scenes/${sceneId}`)
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ title: "", description: "Long enough." });
      expect(res.status).toBe(422);
      expect(res.body.message).toBe("Add a title.");
    });

    it("refuses an edit with no JSON body with 422", async () => {
      const res = await request(server)
        .patch(`/api/scenes/${sceneId}`)
        .set("Authorization", `Bearer ${owner.token}`)
        .set("Content-Type", "text/plain")
        .send("title=x");
      expect(res.status).toBe(422);
    });
  });

  describe("authentication and ownership", () => {
    beforeAll(async () => {
      other = (await signup(server, { name: "Other", email: "other@example.com" })).body;
    });

    it("answers 403 when another member edits or deletes the scene, and changes nothing", async () => {
      const patch = await request(server)
        .patch(`/api/scenes/${sceneId}`)
        .set("Authorization", `Bearer ${other.token}`)
        .send({ title: "Hijacked", description: "Not my scene at all." });
      expect(patch.status).toBe(403);
      expect(patch.body.message).toBe("You can only change your own scenes.");
      const del = await request(server)
        .delete(`/api/scenes/${sceneId}`)
        .set("Authorization", `Bearer ${other.token}`);
      expect(del.status).toBe(403);
      const after = await request(server).get(`/api/scenes/${sceneId}`);
      expect(after.body.scene.title).toBe("Rangitoto summit");
    });

    it("answers 401 for a write without a token, and creates nothing", async () => {
      const res = await createScene(server, null);
      expect(res.status).toBe(401);
      expect(res.body.message).toBe("Sign in to do that.");
      const Scene = require("../models/scene.js");
      expect(await Scene.countDocuments()).toBe(1);
    });

    it("answers 401 for a garbage or wrongly signed token", async () => {
      const garbage = await createScene(server, "not-a-jwt");
      expect(garbage.status).toBe(401);
      const jwt = require("jsonwebtoken");
      const forged = jwt.sign({ userId: owner.userId }, "some-other-key");
      const res = await request(server)
        .delete(`/api/scenes/${sceneId}`)
        .set("Authorization", `Bearer ${forged}`);
      expect(res.status).toBe(401);
    });

    it("answers 401 with a clear message for an expired token", async () => {
      const jwt = require("jsonwebtoken");
      const expired = jwt.sign(
        { userId: owner.userId, exp: Math.floor(Date.now() / 1000) - 60 },
        process.env.JWT_KEY,
      );
      const res = await request(server)
        .delete(`/api/scenes/${sceneId}`)
        .set("Authorization", `Bearer ${expired}`);
      expect(res.status).toBe(401);
      expect(res.body.message).toBe("Your session has expired. Sign in again.");
    });
  });

  describe("ids", () => {
    it.each([
      ["a malformed scene id", "/api/scenes/not-an-id", "We couldn't find that scene."],
      ["a 12-character scene id", "/api/scenes/abcdefghijkl", "We couldn't find that scene."],
      [
        "a well-formed scene id that doesn't exist",
        `/api/scenes/${MISSING_ID}`,
        "We couldn't find that scene.",
      ],
      ["a malformed member id", "/api/scenes/user/notanid", "We couldn't find that member."],
      [
        "a well-formed member id that doesn't exist",
        `/api/scenes/user/${MISSING_ID}`,
        "We couldn't find that member.",
      ],
    ])("GET with %s → 404", async (_label, path, message) => {
      const res = await request(server).get(path);
      expect(res.status).toBe(404);
      expect(res.body.message).toBe(message);
      expectNoInternals(res);
    });

    it("PATCH and DELETE on a well-formed id that doesn't exist → 404, process alive", async () => {
      const patch = await request(server)
        .patch(`/api/scenes/${MISSING_ID}`)
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ title: "Ghost", description: "This scene does not exist." });
      expect(patch.status).toBe(404);
      const del = await request(server)
        .delete(`/api/scenes/${MISSING_ID}`)
        .set("Authorization", `Bearer ${owner.token}`);
      expect(del.status).toBe(404);
      await expectAlive();
    });

    it("PATCH on a malformed id → 404", async () => {
      const res = await request(server)
        .patch("/api/scenes/not-an-id")
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ title: "Ghost", description: "This scene does not exist." });
      expect(res.status).toBe(404);
    });
  });

  describe("uploads", () => {
    it("refuses a scene without an image with 422, process alive", async () => {
      const res = await createScene(server, owner.token, { image: null });
      expect(res.status).toBe(422);
      expect(res.body.message).toBe("Add a JPEG, PNG or WebP image.");
      await expectAlive();
    });

    it("refuses an image over 3 MB with 413, process alive", async () => {
      const big = Buffer.concat([JPEG_1PX, Buffer.alloc(3.5 * 1024 * 1024)]);
      const res = await createScene(server, owner.token, {
        image: big,
        filename: "big.jpg",
        contentType: "image/jpeg",
      });
      expect(res.status).toBe(413);
      expect(res.body.message).toBe("Images must be 3 MB or smaller.");
      await expectAlive();
    });

    it("refuses a GIF with 422, process alive", async () => {
      const res = await createScene(server, owner.token, {
        image: GIF_1PX,
        filename: "a.gif",
        contentType: "image/gif",
      });
      expect(res.status).toBe(422);
      await expectAlive();
    });

    it("refuses HTML labelled image/png with 422 (bytes are checked)", async () => {
      const html = Buffer.from("<!doctype html><script>alert(1)</script>");
      const res = await createScene(server, owner.token, { image: html });
      expect(res.status).toBe(422);
      expect(res.body.message).toBe("That file isn't a JPEG, PNG or WebP image.");
      await expectAlive();
    });

    it("refuses a second file in the request with 422", async () => {
      const res = await createScene(server, owner.token).attach("image", PNG_1PX, {
        filename: "b.png",
        contentType: "image/png",
      });
      expect(res.status).toBe(422);
    });

    it("stores the type found in the bytes, not the one the client claims", async () => {
      const res = await createScene(server, owner.token, {
        fields: { title: "Labelled JPEG, really PNG" },
        image: PNG_1PX,
        filename: "a.jpg",
        contentType: "image/jpeg",
      });
      expect(res.status).toBe(201);
      expect(res.body.scene.contentType).toBe("png");
      const Scene = require("../models/scene.js");
      const stored = await Scene.collection.findOne({ title: "Labelled JPEG, really PNG" });
      expect(stored.image.contentType).toBe("image/png");
    });

    it("accepts WebP and JPEG", async () => {
      const webp = await createScene(server, owner.token, {
        fields: { title: "WebP scene" },
        image: WEBP_1PX,
        filename: "a.webp",
        contentType: "image/webp",
      });
      expect(webp.status).toBe(201);
      expect(webp.body.scene.image.contentType).toBe("webp");
      const jpeg = await createScene(server, owner.token, {
        fields: { title: "JPEG scene" },
        image: JPEG_1PX,
        filename: "a.jpg",
        contentType: "image/jpeg",
      });
      expect(jpeg.status).toBe(201);
      expect(jpeg.body.scene.image.contentType).toBe("jpeg");
    });
  });

  describe("error responses", () => {
    it("answers malformed JSON with 400 and a JSON message", async () => {
      const res = await request(server)
        .post("/api/users/login")
        .set("Content-Type", "application/json")
        .send('{"email": "owner@example.com", ');
      expect(res.status).toBe(400);
      expect(res.body.message).toBe("We couldn't read that request.");
    });

    it("answers a JSON body over 100 KB with 413", async () => {
      const res = await request(server)
        .patch(`/api/scenes/${sceneId}`)
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ title: "Big", description: "x".repeat(120 * 1024) });
      expect(res.status).toBe(413);
    });

    it("answers an unknown route with a JSON 404", async () => {
      const res = await request(server).get("/api/nothing-here");
      expect(res.status).toBe(404);
      expect(res.body.message).toBe("That API route doesn't exist.");
    });

    it("sends Cache-Control: no-store on every 4xx, and read caching on 200", async () => {
      const ok = await request(server).get(`/api/scenes/${sceneId}`);
      expect(ok.headers["cache-control"]).toBe("s-maxage=1, stale-while-revalidate=599");

      const failures = await Promise.all([
        request(server).post("/api/users/login").set("Content-Type", "application/json").send("{"), // 400
        createScene(server, null), // 401
        request(server)
          .delete(`/api/scenes/${sceneId}`)
          .set("Authorization", `Bearer ${other.token}`), // 403
        request(server).get(`/api/scenes/${MISSING_ID}`), // 404
        request(server).get("/api/nothing-here"), // 404 route
        createScene(server, owner.token, {
          image: Buffer.concat([JPEG_1PX, Buffer.alloc(3.2 * 1024 * 1024)]),
        }), // 413
        createScene(server, owner.token, { image: null }), // 422
      ]);
      expect(failures.map((r) => r.status)).toEqual([400, 401, 403, 404, 404, 413, 422]);
      for (const res of failures) {
        expect(res.headers["cache-control"]).toBe("no-store");
        expect(res.body.message).toEqual(expect.any(String));
        expectNoInternals(res);
      }
    });

    it("answers a conditional GET with 304 and the same caching as the 200", async () => {
      const first = await request(server).get(`/api/scenes/${sceneId}`);
      const etag = first.headers.etag;
      expect(etag).toBeTruthy();
      const again = await request(server).get(`/api/scenes/${sceneId}`).set("If-None-Match", etag);
      expect(again.status).toBe(304);
      expect(again.headers["cache-control"]).toBe(first.headers["cache-control"]);
    });
  });

  describe("delete", () => {
    it("lets the owner delete the scene and unlinks it from the member", async () => {
      const res = await request(server)
        .delete(`/api/scenes/${sceneId}`)
        .set("Authorization", `Bearer ${owner.token}`);
      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Scene deleted successfully");
      const gone = await request(server).get(`/api/scenes/${sceneId}`);
      expect(gone.status).toBe(404);
      const User = require("../models/user.js");
      const user = await User.findById(owner.userId);
      expect(user.scenes.map(String)).not.toContain(sceneId);
    });
  });

  describe("privacy and login hardening", () => {
    it("never sends an email, password hash or __v in the members list", async () => {
      const res = await request(server).get("/api/users/users");
      expect(res.status).toBe(200);
      expect(findKeys(res.body, ["email", "password", "__v"])).toEqual([]);
      // The fields the deployed client reads are still there.
      for (const user of res.body.users) {
        expect(user).toHaveProperty("id");
        expect(user).toHaveProperty("_id");
        expect(user).toHaveProperty("name");
        expect(Array.isArray(user.scenes)).toBe(true);
      }
    });

    it("keeps private fields out of a user document's JSON (defence in depth)", async () => {
      const User = require("../models/user.js");
      const user = await User.findById(owner.userId);
      expect(user.toJSON()).not.toHaveProperty("password");
      expect(user.toObject({ getters: true })).not.toHaveProperty("email");
    });

    it("logs in with a mixed-case Gmail address exactly as typed at sign-up", async () => {
      const email = "Test.User+123@Gmail.com";
      expect((await signup(server, { email })).status).toBe(201);
      const res = await login(server, email);
      expect(res.status).toBe(200);
      expect((await login(server, "testuser@gmail.com")).status).toBe(200);
    });

    it("still logs in an account stored by the old API (normalised address, cost-8 hash)", async () => {
      // Inserted directly, exactly as express-validator 6 and bcryptjs 2.4
      // stored it: no API code involved.
      const User = require("../models/user.js");
      await User.collection.insertOne({
        name: "Old Account",
        email: "first.last@outlook.com",
        password: "$2a$08$A.wDIL.KTkuMO/dTZ5JSBupy4PenJbHdTGzKQPhlwZ70gUHCtmyvy", // "secret123"
        image: { data: PNG_1PX.toString("base64"), contentType: "image/png" },
        scenes: [],
      });
      expect((await login(server, "First.Last+news@Outlook.com")).status).toBe(200);
      expect((await login(server, "first.last@outlook.com")).status).toBe(200);
    });

    it("never logs anyone in with an operator object as the email", async () => {
      // With a real member's password, { $ne: null } would match the first
      // account and hand out its token.
      const res = await request(server)
        .post("/api/users/login")
        .send({ email: { $ne: null }, password: PASSWORD });
      expect(res.status).toBe(422);
      expect(res.body.token).toBeUndefined();
    });

    it("matches an operator literally even when it reaches the query (sanitizeFilter on the login query only)", async () => {
      const User = require("../models/user.js");
      // Wrapped in $eq, the object is a value to compare, not an operator:
      // it can't be cast to the string email, so nothing can match.
      await expect(
        User.findOne({ email: { $ne: null } }).setOptions({ sanitizeFilter: true }),
      ).rejects.toThrow(/Cast to string failed/);
      expect(await User.findOne({ email: { $ne: null } })).not.toBeNull(); // the hazard without it
      // Not global: it would rewrite app-built operator filters (feed cursors).
      expect(mongoose.get("sanitizeFilter")).toBeFalsy();
    });

    it("gives an unknown email and a wrong password the identical answer", async () => {
      const unknown = await login(server, "nobody@example.com");
      const wrong = await login(server, "owner@example.com", "wrong-password");
      expect(unknown.status).toBe(401);
      expect(wrong.status).toBe(401);
      expect(unknown.text).toBe(wrong.text);
      expect(unknown.body.message).toBe("That email and password don't match an account.");
    });

    it.each([
      ["no body", (r) => r],
      [
        "a text/plain body",
        (r) => r.set("Content-Type", "text/plain").send("email=a@b.co&password=x"),
      ],
      ["a missing password", (r) => r.send({ email: "owner@example.com" })],
    ])("answers a login with %s with a JSON 422", async (_label, shape) => {
      const res = await shape(request(server).post("/api/users/login"));
      expect(res.status).toBe(422);
      expect(res.body.message).toEqual(expect.any(String));
    });

    it("issues HS256 tokens that carry only the user id", async () => {
      const jwt = require("jsonwebtoken");
      const res = await login(server, "owner@example.com");
      const { header, payload } = jwt.decode(res.body.token, { complete: true });
      expect(header.alg).toBe("HS256");
      expect(Object.keys(payload).sort()).toEqual(["exp", "iat", "userId"]);
      expect(() =>
        jwt.verify(res.body.token, process.env.JWT_KEY, { algorithms: ["HS256"] }),
      ).not.toThrow();
    });

    it("still accepts an unexpired token that carries the email (issued before this change)", async () => {
      const jwt = require("jsonwebtoken");
      const legacy = jwt.sign(
        { userId: owner.userId, email: "owner@example.com" },
        process.env.JWT_KEY,
        {
          expiresIn: "1h",
        },
      );
      const res = await createScene(server, legacy, { fields: { title: "Legacy token" } });
      expect(res.status).toBe(201);
    });

    it("refuses an alg:none token with 401", async () => {
      const res = await createScene(server, algNoneToken({ userId: owner.userId }));
      expect(res.status).toBe(401);
    });

    it("stores new passwords with bcrypt cost 10", async () => {
      const User = require("../models/user.js");
      const doc = await User.collection.findOne({ email: "owner@example.com" });
      expect(doc.password).toMatch(/^\$2[aby]\$10\$/);
    });
  });
});
