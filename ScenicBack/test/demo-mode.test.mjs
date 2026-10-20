// Demo mode: no DB_URL, so reads come from util/demoData.js (through the same
// id checks and serialisers as the database) and writes get a clear 503.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { buildApp, listen, close, PNG_1PX } from "./helpers.mjs";

describe("demo mode (no database configured)", () => {
  let server;
  beforeAll(async () => {
    server = await listen(buildApp({ env: { JWT_KEY: "test-only-jwt-key" } }));
  });
  afterAll(() => close(server));

  it("answers the health check with mode demo", async () => {
    const res = await request(server).get("/");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", api: "Scenic backend", mode: "demo" });
  });

  it("lists the two demo members, labelled as demo, with 24-hex ids", async () => {
    const res = await request(server).get("/api/users/users");
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("s-maxage=1, stale-while-revalidate=599");
    expect(res.body.users.map((u) => u.name)).toEqual(["Daniel (demo)", "Aroha (demo)"]);
    for (const user of res.body.users) {
      expect(user.id).toMatch(/^[0-9a-f]{24}$/);
      expect(user.isDemo).toBe(true);
      expect(user).not.toHaveProperty("email");
    }
  });

  it("lists a demo member's scenes and serves one scene", async () => {
    const users = (await request(server).get("/api/users/users")).body.users;
    const scenes = await request(server).get(`/api/scenes/user/${users[0].id}`);
    expect(scenes.status).toBe(200);
    expect(scenes.body.scenes.map((s) => s.title)).toEqual(["Milford Sound", "Lake Tekapo"]);
    const one = await request(server).get(`/api/scenes/${scenes.body.scenes[0].id}`);
    expect(one.status).toBe(200);
    expect(one.body.scene.title).toBe("Milford Sound");
    expect(one.body.scene.creator).toMatchObject({ id: users[0].id, isDemo: true });
  });

  it("applies the same id checks as the database", async () => {
    const bad = await request(server).get("/api/scenes/demoscene1");
    expect(bad.status).toBe(404);
    expect(bad.body.message).toBe("We couldn't find that scene.");
    const missing = await request(server).get("/api/scenes/user/5f0000000000000000000000");
    expect(missing.status).toBe(404);
    expect(missing.body.message).toBe("We couldn't find that member.");
    expect(missing.headers["cache-control"]).toBe("no-store");
  });

  it("answers an unknown read with a JSON 404", async () => {
    const res = await request(server).get("/api/nothing-here");
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("That API route doesn't exist.");
  });

  it("refuses writes with a 503 that explains why, never cached", async () => {
    const login = await request(server)
      .post("/api/users/login")
      .send({ email: "a@b.co", password: "secret1" });
    expect(login.status).toBe(503);
    expect(login.body.message).toMatch(/Demo mode/);
    expect(login.headers["cache-control"]).toBe("no-store");

    const create = await request(server)
      .post("/api/scenes")
      .field("title", "x")
      .attach("image", PNG_1PX, { filename: "a.png", contentType: "image/png" });
    expect(create.status).toBe(503);

    const del = await request(server).delete("/api/scenes/6ad72233e7b2b3491f9be98d");
    expect(del.status).toBe(503);
  });
});
