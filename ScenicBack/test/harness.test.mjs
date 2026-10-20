// The harness itself: environment, the network guard and the port rules.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { require, buildApp, listen, close, ownListeningPorts, API_PORT } from "./helpers.mjs";

const https = require("node:https");

describe("test harness", () => {
  it("points the worker at the in-memory replica set, never a real database", () => {
    expect(process.env.TEST_DB_BASE).toMatch(/^mongodb:\/\/127\.0\.0\.1:7107\//);
    expect(process.env.DB_URL).toMatch(/^mongodb:\/\/127\.0\.0\.1:7107\/scenic-test/);
    expect(process.env.JWT_KEY).toBe("test-only-jwt-key");
  });

  it("blocks http(s) requests and fetch to other hosts", async () => {
    expect(() => https.request("https://nominatim.openstreetmap.org/search?q=x")).toThrow(
      /Network guard: blocked a request to nominatim\.openstreetmap\.org/,
    );
    await expect(fetch("https://nominatim.openstreetmap.org/search?q=x")).rejects.toThrow(
      /Network guard/,
    );
  });

  it("keeps the real geocoder from leaving the machine", async () => {
    const getCoordinatesForAddress = require("../util/location.js");
    const before = globalThis.__blockedRequests.length;
    await expect(getCoordinatesForAddress("Milford Sound")).rejects.toMatchObject({ code: 502 });
    const attempted = globalThis.__blockedRequests.slice(before);
    expect(attempted).toContain("nominatim.openstreetmap.org");
    expect(attempted).toContain("photon.komoot.io");
  });

  describe("ports", () => {
    let server;
    beforeAll(async () => {
      server = await listen(buildApp({ env: { JWT_KEY: "x" } }));
    });
    afterAll(() => close(server));

    it("binds only the agreed port, even after supertest requests", async () => {
      await request(server).get("/");
      await request(server).get("/api/users/users");
      const ports = await ownListeningPorts();
      expect(ports).toEqual([API_PORT]);
    });
  });
});
