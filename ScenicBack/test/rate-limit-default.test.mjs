// The app Vercel runs (module.exports of app.js) has the limiter on.
import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import { require, mongoose, listen, close, SPARE_PORT } from "./helpers.mjs";

describe("the exported app", () => {
  let server;
  afterAll(async () => {
    await close(server);
    await mongoose.disconnect();
  });

  it("rate-limits login by default", async () => {
    server = await listen(require("../app.js"), SPARE_PORT);
    let last;
    for (let i = 0; i < 11; i++) {
      last = await request(server).post("/api/users/login").send({ email: "nobody@example.com", password: "x" });
    }
    expect(last.status).toBe(429);
  });
});
