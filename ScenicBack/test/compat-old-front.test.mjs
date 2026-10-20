// Everything the deployed (older) client relies on, in one place. The API
// is deployed before the new client, so these must hold at every commit.
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
  SPARE_PORT,
} from "./helpers.mjs";

const { seed } = require("../util/seedAtlas.js");
const demo = require("../util/demoData.js");

const MAGIC = {
  jpeg: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  png: (b) =>
    b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  webp: (b) => b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP",
};

/** The old client's exact image source: `data:image/${contentType};base64,${data}`. */
function expectOldClientImage(contentType, data) {
  expect(contentType).toMatch(/^(jpeg|png|webp)$/);
  const src = `data:image/${contentType};base64,${data}`;
  expect(src).toMatch(/^data:image\/(jpeg|png|webp);base64,/);
  expect(MAGIC[contentType](Buffer.from(data, "base64"))).toBe(true);
}

function expectOldClientUser(user) {
  expect(user.id).toMatch(/^[0-9a-f]{24}$/);
  expect(user._id).toBe(user.id);
  expect(typeof user.name).toBe("string");
  expect(Array.isArray(user.scenes)).toBe(true);
  expectOldClientImage(user.contentType, user.image.data); // Avatar
}

function expectOldClientScene(scene, creatorId) {
  expect(scene.id).toMatch(/^[0-9a-f]{24}$/);
  for (const key of ["title", "description", "address"]) expect(typeof scene[key]).toBe("string");
  expect(scene.location).toEqual({ lat: expect.any(Number), lng: expect.any(Number) });
  expect(scene.creator).toBe(creatorId); // Edit and Delete show when it equals the signed-in id
  expectOldClientImage(scene.contentType, scene.image.data); // SceneItem
  expectOldClientImage(scene.image.contentType, scene.image.data); // UpdateScene preview
}

describe("deployed client compatibility", () => {
  let db;
  let member;
  let sceneId;

  beforeAll(async () => {
    db = await listen(buildApp({ env: { ...process.env, DB_URL: dbUrl("compat") } }));
    await request(db).get("/");
    expect(mongoose.connection.readyState).toBe(1);
    await seed({ password: process.env.SEED_PASSWORD });
  });

  afterAll(async () => {
    await close(db);
    await mongoose.disconnect();
  });

  describe("sign-up and login keep { userId, token } at the top level", () => {
    it("sign-up → 201", async () => {
      const res = await request(db)
        .post("/api/users/signup")
        .field("name", "Kiri")
        .field("email", "kiri@example.com")
        .field("password", "secret123")
        .attach("image", JPEG_1PX, { filename: "a.jpg", contentType: "image/jpeg" });
      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        userId: expect.stringMatching(/^[0-9a-f]{24}$/),
        token: expect.any(String),
      });
      member = res.body;
    });

    it("login → 200", async () => {
      const res = await request(db)
        .post("/api/users/login")
        .send({ email: "kiri@example.com", password: "secret123" });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ userId: member.userId, token: expect.any(String) });
    });
  });

  describe("reads", () => {
    beforeAll(async () => {
      const res = await request(db)
        .post("/api/scenes")
        .set("Authorization", `Bearer ${member.token}`)
        .field("title", "Piha")
        .field("description", "Lion Rock at low tide.")
        .field("address", "Piha")
        .attach("image", PNG_1PX, { filename: "a.png", contentType: "image/png" });
      expect(res.status).toBe(201);
      sceneId = res.body.scene.id;
    });

    it("GET /api/users/users: every avatar builds a valid data URI (seeded 'jpeg' and uploaded 'image/jpeg')", async () => {
      const res = await request(db).get("/api/users/users");
      expect(res.body.users).toHaveLength(3);
      res.body.users.forEach(expectOldClientUser);
      expect(res.body.users.find((u) => u.id === member.userId).scenes).toEqual([sceneId]);
    });

    it("GET /api/scenes/user/:userId: every scene builds a valid data URI", async () => {
      const users = (await request(db).get("/api/users/users")).body.users;
      for (const user of users) {
        const res = await request(db).get(`/api/scenes/user/${user.id}`);
        expect(res.status).toBe(200);
        expect(res.body.scenes).toHaveLength(user.scenes.length);
        res.body.scenes.forEach((scene) => expectOldClientScene(scene, user.id));
      }
    });

    it("GET /api/scenes/:id (edit page): title, description and image fields, no bytes", async () => {
      // The old edit page reads image.contentType and image.data before it
      // fills its form; without `image` it throws and Save stays disabled. An
      // empty data string keeps the form working; only its preview breaks.
      const res = await request(db).get(`/api/scenes/${sceneId}`);
      expect(res.status).toBe(200);
      expect(res.body.scene.id).toBe(sceneId);
      expect(res.body.scene.title).toBe("Piha");
      expect(res.body.scene.description).toBe("Lion Rock at low tide.");
      expect(res.body.scene.image.contentType).toMatch(/^(jpeg|png|webp)$/);
      expect(res.body.scene.image.data).toBe("");
    });

    it("demo mode serves the same old-client shapes", async () => {
      const demoServer = await listen(buildApp({ env: { JWT_KEY: "x" } }), SPARE_PORT);
      try {
        const users = (await request(demoServer).get("/api/users/users")).body.users;
        users.forEach(expectOldClientUser);
        const scenes = (await request(demoServer).get(`/api/scenes/user/${demo.IDS.daniel}`)).body
          .scenes;
        scenes.forEach((scene) => expectOldClientScene(scene, String(demo.IDS.daniel)));
        const one = (await request(demoServer).get(`/api/scenes/${demo.IDS.milford}`)).body.scene;
        expect(one.title).toBe("Milford Sound");
        expect(one.image).toEqual({
          contentType: expect.stringMatching(/^(jpeg|png|webp)$/),
          data: "",
        });
      } finally {
        await close(demoServer);
      }
    });
  });

  describe("every error is JSON with a message (the old client calls response.json() on everything)", () => {
    async function expectJsonError(res, status) {
      expect(res.status).toBe(status);
      expect(res.headers["content-type"]).toMatch(/application\/json/);
      expect(res.body.message).toEqual(expect.any(String));
    }

    it("401, 403, 404, 413, 422", async () => {
      const other = (
        await request(db)
          .post("/api/users/signup")
          .field("name", "Other")
          .field("email", "other@example.com")
          .field("password", "secret123")
          .attach("image", PNG_1PX, { filename: "a.png", contentType: "image/png" })
      ).body;
      await expectJsonError(await request(db).delete(`/api/scenes/${sceneId}`), 401);
      await expectJsonError(
        await request(db)
          .delete(`/api/scenes/${sceneId}`)
          .set("Authorization", `Bearer ${other.token}`),
        403,
      );
      await expectJsonError(await request(db).get("/api/scenes/5f0000000000000000000000"), 404);
      await expectJsonError(
        await request(db)
          .post("/api/scenes")
          .set("Authorization", `Bearer ${member.token}`)
          .field("title", "Big")
          .field("description", "Too big to upload.")
          .field("address", "Piha")
          .attach("image", Buffer.concat([JPEG_1PX, Buffer.alloc(3.5 * 1024 * 1024)]), {
            filename: "big.jpg",
            contentType: "image/jpeg",
          }),
        413,
      );
      await expectJsonError(await request(db).post("/api/users/login").send({ email: "x" }), 422);
    });

    it("429 from the rate limiter", async () => {
      const limited = await listen(
        buildApp({ env: { JWT_KEY: "x" }, rateLimit: { limit: 1 } }),
        SPARE_PORT,
      );
      try {
        await request(limited).post("/api/users/login").send({});
        await expectJsonError(await request(limited).post("/api/users/login").send({}), 429);
      } finally {
        await close(limited);
      }
    });

    it("503 in demo mode", async () => {
      const demoServer = await listen(buildApp({ env: { JWT_KEY: "x" } }), SPARE_PORT);
      try {
        await expectJsonError(await request(demoServer).post("/api/users/login").send({}), 503);
      } finally {
        await close(demoServer);
      }
    });
  });
});
