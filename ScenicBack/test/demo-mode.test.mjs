// Demo mode: no DB_URL, so reads come from util/demoData.js and writes get a
// clear 503.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { buildApp, listen, close, PNG_1PX } from "./helpers.mjs";

describe("demo mode (no database configured)", () => {
  let server;
  beforeAll(async () => {
    server = await listen(buildApp({ env: { JWT_KEY: "test-only-jwt-key" } }));
  });
  afterAll(() => close(server));

  it("answers the health check", async () => {
    const res = await request(server).get("/");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", api: "Scenic backend", mode: "demo" });
  });

  it("lists the two demo members", async () => {
    const res = await request(server).get("/api/users/users");
    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(2);
    expect(res.headers["cache-control"]).toBe("s-maxage=1, stale-while-revalidate=599");
  });

  it("lists a demo member's scenes and serves one scene", async () => {
    const users = (await request(server).get("/api/users/users")).body.users;
    const scenes = await request(server).get(`/api/scenes/user/${users[0].id}`);
    expect(scenes.status).toBe(200);
    expect(scenes.body.scenes.length).toBeGreaterThan(0);
    const one = await request(server).get(`/api/scenes/${scenes.body.scenes[0].id}`);
    expect(one.status).toBe(200);
    expect(one.body.scene.title).toBe(scenes.body.scenes[0].title);
  });

  it("refuses writes with a 503 that explains why", async () => {
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
  });
});
