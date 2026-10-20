// Transport hardening: headers, CORS and the sign-up/login rate limiter.
// Each app here is its own instance (own limiter store) on port 7109.
import { describe, it, expect, afterEach } from "vitest";
import request from "supertest";
import { buildApp, listen, close, SPARE_PORT } from "./helpers.mjs";

let server;
afterEach(async () => {
  await close(server);
  server = null;
});

const DEMO_ENV = { JWT_KEY: "test-only-jwt-key" };

describe("headers", () => {
  it("hides x-powered-by and lets the client load responses cross-origin", async () => {
    server = await listen(buildApp({ env: DEMO_ENV }), SPARE_PORT);
    const res = await request(server).get("/api/users/users");
    expect(res.headers["x-powered-by"]).toBeUndefined();
    expect(res.headers["cross-origin-resource-policy"]).toBe("cross-origin");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["content-security-policy"]).toBe(
      "default-src 'none';frame-ancestors 'none'",
    );
  });
});

describe("CORS", () => {
  it("allows any origin when CORS_ORIGIN is unset, as before", async () => {
    server = await listen(buildApp({ env: DEMO_ENV }), SPARE_PORT);
    const res = await request(server)
      .get("/api/users/users")
      .set("Origin", "https://scenic-app.vercel.app");
    expect(res.headers["access-control-allow-origin"]).toBe("*");
  });

  it("answers a write preflight with 204 before the database gate (demo mode)", async () => {
    server = await listen(buildApp({ env: DEMO_ENV }), SPARE_PORT);
    const res = await request(server)
      .options("/api/scenes")
      .set("Origin", "https://scenic-app.vercel.app")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "authorization,content-type");
    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe("*");
    expect(res.headers["access-control-allow-methods"]).toBe("GET,POST,PATCH,DELETE,OPTIONS");
    expect(res.headers["access-control-allow-headers"]).toBe("Content-Type,Authorization");
    expect(res.headers["access-control-max-age"]).toBe("600");
  });

  it("allows only the listed origins when CORS_ORIGIN is set", async () => {
    server = await listen(
      buildApp({
        env: { ...DEMO_ENV, CORS_ORIGIN: "http://127.0.0.1:7104, http://localhost:7104" },
      }),
      SPARE_PORT,
    );
    const allowed = await request(server)
      .get("/api/users/users")
      .set("Origin", "http://127.0.0.1:7104");
    expect(allowed.headers["access-control-allow-origin"]).toBe("http://127.0.0.1:7104");
    const other = await request(server)
      .get("/api/users/users")
      .set("Origin", "https://evil.example");
    expect(other.headers["access-control-allow-origin"]).toBeUndefined();
  });
});

describe("sign-up and login rate limit", () => {
  it("answers the 11th attempt in 15 minutes with a JSON 429 that is never cached", async () => {
    server = await listen(buildApp({ env: DEMO_ENV, rateLimit: true }), SPARE_PORT);
    for (let i = 0; i < 10; i++) {
      const res = await request(server)
        .post("/api/users/login")
        .send({ email: "a@b.co", password: "x" });
      expect(res.status).not.toBe(429);
    }
    const limited = await request(server)
      .post("/api/users/login")
      .send({ email: "a@b.co", password: "x" });
    expect(limited.status).toBe(429);
    expect(limited.headers["content-type"]).toMatch(/application\/json/);
    expect(limited.body).toEqual({ message: "Too many attempts. Wait 15 minutes and try again." });
    expect(limited.headers["cache-control"]).toBe("no-store");
    expect(limited.headers["ratelimit-policy"]).toBeDefined();
    expect(limited.headers["x-ratelimit-limit"]).toBeUndefined();
    // Reads are never limited.
    expect((await request(server).get("/api/users/users")).status).toBe(200);
  });

  it("counts sign-up and login together, and only POSTs", async () => {
    server = await listen(buildApp({ env: DEMO_ENV, rateLimit: { limit: 2 } }), SPARE_PORT);
    await request(server)
      .options("/api/users/login")
      .set("Origin", "http://x")
      .set("Access-Control-Request-Method", "POST");
    await request(server).post("/api/users/signup").field("name", "a");
    await request(server).post("/api/users/login").send({});
    const third = await request(server).post("/api/users/login").send({});
    expect(third.status).toBe(429);
  });
});
