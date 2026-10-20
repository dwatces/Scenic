// A database is configured but JWT_KEY is not: reads work, sign-in and
// writes answer 503, and an unsigned (alg: none) token is never accepted.
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import { require, mongoose, buildApp, listen, close, dbUrl, PNG_1PX, algNoneToken } from "./helpers.mjs";

describe("JWT_KEY unset", () => {
  let server;
  let userId;
  let errors;

  beforeAll(async () => {
    errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const env = { ...process.env, DB_URL: dbUrl("jwt-unset") };
    delete env.JWT_KEY;
    server = await listen(buildApp({ env }));
    await request(server).get("/api/users/users");
    expect(mongoose.connection.readyState).toBe(1);
    const User = require("../models/user.js");
    const user = await User.create({
      name: "Fixture",
      email: "fixture@example.com",
      password: "$2a$08$A.wDIL.KTkuMO/dTZ5JSBupy4PenJbHdTGzKQPhlwZ70gUHCtmyvy",
      scenes: [],
    });
    userId = user.id;
  });

  afterAll(async () => {
    errors.mockRestore();
    await close(server);
    await mongoose.disconnect();
  });

  function post(token) {
    return request(server)
      .post("/api/scenes")
      .set("Authorization", `Bearer ${token}`)
      .field("title", "Forged")
      .field("description", "Posted with a forged token.")
      .field("address", "Anywhere")
      .attach("image", PNG_1PX, { filename: "a.png", contentType: "image/png" });
  }

  it("logs the missing key once at start-up", () => {
    const messages = errors.mock.calls.map((args) => args.join(" "));
    expect(messages.filter((m) => m.includes("JWT_KEY is not set"))).toHaveLength(1);
  });

  it("keeps reads working", async () => {
    const res = await request(server).get("/api/users/users");
    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(1);
  });

  it("answers sign-up, login and writes with 503", async () => {
    const login = await request(server).post("/api/users/login").send({ email: "fixture@example.com", password: "secret123" });
    expect(login.status).toBe(503);
    expect(login.body.message).toBe("Sign-in isn't set up on this server yet.");
    const signup = await request(server).post("/api/users/signup").field("name", "x");
    expect(signup.status).toBe(503);
    const jwt = require("jsonwebtoken");
    const write = await post(jwt.sign({ userId }, "whatever-key"));
    expect(write.status).toBe(503);
  });

  it("refuses an alg:none token with 401 and creates nothing", async () => {
    const res = await post(algNoneToken({ userId }));
    expect(res.status).toBe(401);
    const Scene = require("../models/scene.js");
    expect(await Scene.countDocuments()).toBe(0);
  });
});
