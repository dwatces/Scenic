// The error handler on its own, with routes that throw what the real app
// might: driver errors with numeric codes, library errors, plain bugs.
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import { require, listen, close } from "./helpers.mjs";

const express = require("express");
const HttpError = require("../models/http-error.js");
const { errorHandler, notFound, noStoreOnErrors, GENERIC_MESSAGE } = require("../middleware/errors.js");

describe("error handler", () => {
  let server;
  let logged;

  beforeAll(async () => {
    logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const app = express();
    app.use(noStoreOnErrors);
    app.get("/http-error", () => {
      throw new HttpError("Teapot here.", 418);
    });
    app.get("/mongo-code", () => {
      throw Object.assign(new Error("NoSuchTransaction"), { code: 251 });
    });
    app.get("/write-conflict", async () => {
      throw Object.assign(new Error("WriteConflict"), { code: 112, name: "MongoServerError" });
    });
    app.get("/bug", (req) => req.nothing.here);
    app.get("/duplicate", () => {
      throw Object.assign(new Error("E11000 duplicate key error"), { code: 11000 });
    });
    app.use(notFound);
    app.use(errorHandler);
    server = await listen(app);
  });

  afterAll(async () => {
    logged.mockRestore();
    await close(server);
  });

  it("uses an HttpError's status and message", async () => {
    const res = await request(server).get("/http-error");
    expect(res.status).toBe(418);
    expect(res.body).toEqual({ message: "Teapot here." });
  });

  it.each(["/mongo-code", "/write-conflict", "/bug"])(
    "never turns a numeric driver code or a bug into a status or message (%s)",
    async (path) => {
      const res = await request(server).get(path);
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: GENERIC_MESSAGE });
      expect(res.headers["cache-control"]).toBe("no-store");
    }
  );

  it("logs what it hides", async () => {
    logged.mockClear();
    await request(server).get("/bug");
    expect(logged).toHaveBeenCalledTimes(1);
    expect(String(logged.mock.calls[0][0])).toMatch(/Cannot read properties/);
  });

  it("maps a duplicate key to the duplicate-email 422", async () => {
    const res = await request(server).get("/duplicate");
    expect(res.status).toBe(422);
    expect(res.body.message).toBe("An account with this email already exists.");
  });
});
