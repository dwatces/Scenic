// Images are served as images: GET /api/scenes/:id/image (?size=card for a
// scene card's small copy) and GET /api/users/:id/image, in database mode and
// demo mode.
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
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
  SPARE_PORT,
} from "./helpers.mjs";

const { seed } = require("../util/seedAtlas.js");
const demo = require("../util/demoData.js");

const BROWSER_CACHE = "public, max-age=31536000, immutable";

/** GET as raw bytes (res.body is a Buffer whatever the type). */
const getBytes = (server, path) => request(server).get(path).responseType("blob");

function expectImageHeaders(res, type) {
  expect(res.headers["content-type"]).toBe(type);
  expect(res.headers["cache-control"]).toBe(BROWSER_CACHE);
  expect(res.headers["cdn-cache-control"]).toBe("max-age=86400");
  expect(res.headers["cross-origin-resource-policy"]).toBe("cross-origin");
  expect(res.headers["x-content-type-options"]).toBe("nosniff");
  expect(res.headers["content-security-policy"]).toBe("default-src 'none'; sandbox");
  expect(res.headers.etag).toMatch(/^"[A-Za-z0-9_-]+"$/); // strong, not W/
}

describe("image endpoints (database)", () => {
  let server;
  let Scene;
  let User;
  let member;
  let sceneId;

  beforeAll(async () => {
    server = await listen(buildApp({ env: { ...process.env, DB_URL: dbUrl("images") } }));
    await request(server).get("/");
    expect(mongoose.connection.readyState).toBe(1);
    Scene = require("../models/scene.js");
    User = require("../models/user.js");
    await seed({ password: process.env.SEED_PASSWORD });

    member = (
      await request(server)
        .post("/api/users/signup")
        .field("name", "Kiri")
        .field("email", "kiri@example.com")
        .field("password", "secret123")
        .attach("image", PNG_1PX, { filename: "a.png", contentType: "image/png" })
    ).body;
    const created = await request(server)
      .post("/api/scenes")
      .set("Authorization", `Bearer ${member.token}`)
      .field("title", "Piha")
      .field("description", "Lion Rock at low tide.")
      .field("address", "Piha")
      .attach("image", JPEG_1PX, { filename: "a.jpg", contentType: "image/jpeg" });
    expect(created.status).toBe(201);
    sceneId = created.body.scene.id;
  });

  afterAll(async () => {
    await close(server);
    await mongoose.disconnect();
  });

  it("serves a scene's photo: the stored bytes, decoded, with the sniffed type", async () => {
    const res = await getBytes(server, `/api/scenes/${sceneId}/image`);
    expect(res.status).toBe(200);
    expectImageHeaders(res, "image/jpeg");
    const stored = await Scene.findById(sceneId, "image").lean();
    expect(res.body.equals(Buffer.from(stored.image.data, "base64"))).toBe(true);
    expect(res.body.equals(JPEG_1PX)).toBe(true);
    expect(Number(res.headers["content-length"])).toBe(JPEG_1PX.length);
  });

  it("serves a member's avatar", async () => {
    const res = await getBytes(server, `/api/users/${member.userId}/image`);
    expect(res.status).toBe(200);
    expectImageHeaders(res, "image/png");
    expect(res.body.equals(PNG_1PX)).toBe(true);
  });

  it("serves WebP as image/webp", async () => {
    const created = await request(server)
      .post("/api/scenes")
      .set("Authorization", `Bearer ${member.token}`)
      .field("title", "Karekare")
      .field("description", "Black sand and surf.")
      .field("address", "Karekare")
      .attach("image", WEBP_1PX, { filename: "a.webp", contentType: "image/webp" });
    const res = await getBytes(server, `/api/scenes/${created.body.scene.id}/image`);
    expect(res.status).toBe(200);
    expectImageHeaders(res, "image/webp");
    expect(res.body.equals(WEBP_1PX)).toBe(true);
  });

  describe("?size=card", () => {
    let withCard;

    beforeAll(async () => {
      const created = await request(server)
        .post("/api/scenes")
        .set("Authorization", `Bearer ${member.token}`)
        .field("title", "Muriwai")
        .field("description", "The gannet colony on the cliffs.")
        .field("address", "Muriwai")
        .attach("image", JPEG_1PX, { filename: "a.jpg", contentType: "image/jpeg" })
        .attach("thumb", WEBP_1PX, { filename: "a-card.webp", contentType: "image/webp" });
      expect(created.status).toBe(201);
      withCard = created.body.scene;
    });

    it("serves the card image, with the same caching as the photo", async () => {
      expect(withCard.cardImageUrl).toBe(`${withCard.imageUrl}&size=card`);
      const card = await getBytes(server, withCard.cardImageUrl);
      expect(card.status).toBe(200);
      expectImageHeaders(card, "image/webp");
      expect(card.body.equals(WEBP_1PX)).toBe(true);
      const photo = await getBytes(server, withCard.imageUrl);
      expect(photo.body.equals(JPEG_1PX)).toBe(true);
      expect(card.headers.etag).not.toBe(photo.headers.etag);
    });

    it("answers If-None-Match for the card image with 304", async () => {
      const first = await getBytes(server, withCard.cardImageUrl);
      const again = await request(server)
        .get(withCard.cardImageUrl)
        .set("If-None-Match", first.headers.etag);
      expect(again.status).toBe(304);
      expect(again.headers["cache-control"]).toBe(BROWSER_CACHE);
    });

    it("falls back to the full photo for a scene without a card image", async () => {
      const res = await getBytes(server, `/api/scenes/${sceneId}/image?size=card`);
      expect(res.status).toBe(200);
      expectImageHeaders(res, "image/jpeg");
      expect(res.body.equals(JPEG_1PX)).toBe(true);
    });

    it("serves the seeded demo scenes' card images", async () => {
      const seeded = await Scene.findOne({ title: "Milford Sound" }, "thumb").lean();
      const res = await getBytes(server, `/api/scenes/${seeded._id}/image?size=card`);
      expect(res.status).toBe(200);
      expectImageHeaders(res, "image/webp");
      expect(res.body.equals(Buffer.from(seeded.thumb.data, "base64"))).toBe(true);
    });

    it("ignores any other size and serves the full photo", async () => {
      for (const query of ["size=large", "size=", "size=CARD", "size=card&size=card"]) {
        const res = await getBytes(server, `/api/scenes/${withCard.id}/image?${query}`);
        expect(res.status, query).toBe(200);
        expect(res.body.equals(JPEG_1PX), query).toBe(true);
      }
    });

    it("answers a missing scene with a JSON 404", async () => {
      const res = await request(server).get("/api/scenes/5f0000000000000000000000/image?size=card");
      expect(res.status).toBe(404);
      expect(res.body.message).toBe("We couldn't find that scene.");
      expect(res.headers["cache-control"]).toBe("no-store");
    });
  });

  it("types a seeded image by its bytes, whatever its stored label says", async () => {
    const seeded = await Scene.findOne({ title: "Milford Sound" }, "image").lean();
    const res = await getBytes(server, `/api/scenes/${seeded._id}/image`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/^image\/(jpeg|png|webp)$/);
    expect(res.body.equals(Buffer.from(seeded.image.data, "base64"))).toBe(true);
  });

  it("ignores the version parameter (it only busts caches)", async () => {
    const res = await getBytes(server, `/api/scenes/${sceneId}/image?v=12345`);
    expect(res.status).toBe(200);
    expect(res.body.equals(JPEG_1PX)).toBe(true);
  });

  it("answers If-None-Match with 304, no body, and the same caching as the 200", async () => {
    const first = await getBytes(server, `/api/scenes/${sceneId}/image`);
    const again = await request(server)
      .get(`/api/scenes/${sceneId}/image`)
      .set("If-None-Match", first.headers.etag);
    expect(again.status).toBe(304);
    expect(again.headers["cache-control"]).toBe(first.headers["cache-control"]);
    expect(again.headers["cdn-cache-control"]).toBe("max-age=86400");
    expect(again.headers.etag).toBe(first.headers.etag);
    expect(again.text || "").toBe("");
  });

  it("answers HEAD with the headers and no body", async () => {
    const res = await request(server).head(`/api/scenes/${sceneId}/image`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("image/jpeg");
    expect(Number(res.headers["content-length"])).toBe(JPEG_1PX.length);
  });

  it("answers a missing scene, member or malformed id with a JSON 404 that isn't cached", async () => {
    const paths = [
      "/api/scenes/5f0000000000000000000000/image",
      "/api/users/5f0000000000000000000000/image",
      "/api/scenes/not-an-id/image",
      "/api/users/abcdefghijkl/image",
    ];
    for (const path of paths) {
      const res = await request(server).get(path);
      expect(res.status, path).toBe(404);
      expect(res.headers["content-type"], path).toMatch(/application\/json/);
      expect(res.headers["cache-control"], path).toBe("no-store");
      expect(res.body.message, path).toMatch(/^We couldn't find that/);
    }
  });

  it("answers a member without an avatar with a JSON 404", async () => {
    const { insertedId } = await User.collection.insertOne({
      name: "No avatar",
      email: "no-avatar@example.com",
      password: "x",
      scenes: [],
    });
    const res = await request(server).get(`/api/users/${insertedId}/image`);
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("We couldn't find that image.");
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("refuses to serve stored bytes that aren't an image (HTML labelled image/png)", async () => {
    const html = Buffer.from("<html><script>alert(1)</script></html>");
    const { insertedId } = await Scene.collection.insertOne({
      title: "Bad row",
      description: "Stored before uploads were checked.",
      address: "Nowhere",
      location: { lat: 0, lng: 0 },
      creator: new mongoose.Types.ObjectId(member.userId),
      image: { data: html.toString("base64"), contentType: "image/png" },
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await request(server).get(`/api/scenes/${insertedId}/image`);
    expect(res.status).toBe(404);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.text).not.toContain("script");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(String(insertedId)));
    warn.mockRestore();
  });
});

describe("image endpoints (demo mode)", () => {
  let server;
  beforeAll(async () => {
    server = await listen(buildApp({ env: { JWT_KEY: "x" } }), SPARE_PORT);
  });
  afterAll(() => close(server));

  it("serves every demo scene's photo and every demo avatar through the same routes", async () => {
    const items = [
      ...demo.SCENES.map((scene) => [`/api/scenes/${scene._id}/image`, scene]),
      ...demo.USERS.map((user) => [`/api/users/${user._id}/image`, user]),
    ];
    for (const [path, doc] of items) {
      const res = await getBytes(server, path);
      expect(res.status, path).toBe(200);
      expectImageHeaders(res, res.headers["content-type"]);
      expect(res.headers["content-type"], path).toMatch(/^image\/(jpeg|png|webp)$/);
      expect(res.body.equals(Buffer.from(doc.image.data, "base64")), path).toBe(true);
    }
  });

  it("serves every demo scene's card image for ?size=card", async () => {
    for (const scene of demo.SCENES) {
      const path = `/api/scenes/${scene._id}/image?size=card`;
      const res = await getBytes(server, path);
      expect(res.status, path).toBe(200);
      expectImageHeaders(res, "image/webp");
      expect(res.body.equals(Buffer.from(scene.thumb.data, "base64")), path).toBe(true);
      expect(res.body.length, path).toBeLessThan(Buffer.from(scene.image.data, "base64").length);
    }
  });

  it("answers an unknown demo id with a JSON 404", async () => {
    const res = await request(server).get("/api/scenes/5f0000000000000000000000/image");
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("We couldn't find that scene.");
    expect(res.headers["cache-control"]).toBe("no-store");
  });
});
