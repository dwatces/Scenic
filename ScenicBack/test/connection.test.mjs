// How the API boots: no dotenv banner, and a database that can't be reached
// is reported loudly instead of silently becoming demo mode.
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildApp, listen, close, mongoose } from "./helpers.mjs";

const apiDir = fileURLToPath(new URL("..", import.meta.url));

describe("boot", () => {
  it("loads the Vercel entry point with nothing on stdout and no connection", () => {
    const env = { ...process.env };
    delete env.DB_URL;
    const out = execFileSync(
      process.execPath,
      ["-e", "require('./api/index.js'); setTimeout(() => process.exit(0), 50)"],
      { cwd: apiDir, env, encoding: "utf8" },
    );
    expect(out).toBe("");
  });
});

describe("DB_URL set but the database is unreachable", () => {
  let server;
  let errors;
  beforeAll(async () => {
    errors = vi.spyOn(console, "error").mockImplementation(() => {});
    // Nothing listens on 7106 (a spare port in this workspace's range).
    const env = { JWT_KEY: "x", DB_URL: "mongodb://127.0.0.1:7106/scenic?directConnection=true" };
    server = await listen(buildApp({ env }));
  });
  afterAll(async () => {
    errors.mockRestore();
    await close(server);
    await mongoose.disconnect();
  });

  it("reports demo mode on the health check and logs why", async () => {
    const res = await request(server).get("/");
    expect(res.status).toBe(200);
    expect(res.body.mode).toBe("demo");
    const logged = errors.mock.calls.map((args) => args.join(" ")).join("\n");
    expect(logged).toMatch(
      /MongoDB connection failed, serving demo content until it connects: .*ECONNREFUSED|MongoDB connection failed, serving demo content until it connects: .+/,
    );
  }, 20000);
});
