// A database is configured but JWT_KEY is not: the API must never accept an
// unsigned (alg: none) token.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { require, mongoose, buildApp, listen, close, dbUrl, PNG_1PX, algNoneToken } from "./helpers.mjs";

describe("JWT_KEY unset", () => {
  let server;
  let userId;

  beforeAll(async () => {
    // auth.js still reads process.env directly; this file runs in its own process.
    delete process.env.JWT_KEY;
    const env = { ...process.env, DB_URL: dbUrl("jwt-unset") };
    server = await listen(buildApp({ env }));
    await request(server).get("/api/users/users");
    expect(mongoose.connection.readyState).toBe(1);
    const User = require("../models/user.js");
    const user = await User.create({
      name: "Fixture",
      email: "fixture@example.com",
      password: "$2a$08$abcdefghijklmnopqrstuuJ1B3vQ5gLx5p1s2Wq3y8m5c4b2a1d0e",
      scenes: [],
    });
    userId = user.id;
  });

  afterAll(async () => {
    await close(server);
    await mongoose.disconnect();
  });

  it.fails("rejects an alg:none token on a write", async () => {
    const res = await request(server)
      .post("/api/scenes")
      .set("Authorization", `Bearer ${algNoneToken({ userId })}`)
      .field("title", "Forged")
      .field("description", "Posted with a forged token.")
      .field("address", "Anywhere")
      .attach("image", PNG_1PX, { filename: "a.png", contentType: "image/png" });
    expect(res.status).toBe(401);
  });
});
