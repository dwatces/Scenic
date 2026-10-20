// The seeding script as a CLI (`node util/seedAtlas.js`), only ever against
// the in-memory replica set. SEED_PASSWORD is set, so the generated-password
// line (a secret) is never printed.
import { describe, it, expect } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { dbUrl } from "./helpers.mjs";

const run = promisify(execFile);
const apiDir = fileURLToPath(new URL("..", import.meta.url));

/** Run the seeder CLI with exactly `env` (plus PATH); resolves { code, stdout, stderr }. */
async function seeder(env) {
  try {
    const { stdout, stderr } = await run(process.execPath, ["util/seedAtlas.js"], {
      cwd: apiDir,
      env: { PATH: process.env.PATH, ...env },
      timeout: 60000,
    });
    return { code: 0, stdout, stderr };
  } catch (err) {
    return { code: err.code, stdout: err.stdout, stderr: err.stderr };
  }
}

describe("node util/seedAtlas.js", () => {
  it("refuses to run without an explicit DB_URL, and touches nothing", async () => {
    const { code, stdout, stderr } = await seeder({ SEED_PASSWORD: "unused" });
    expect(code).toBe(1);
    expect(stderr).toMatch(/DB_URL is required/);
    expect(stdout).toBe("");
  });

  it("seeds the in-memory database once, then creates nothing, and never prints a password", async () => {
    const url = dbUrl("seed-cli");
    // Guard: this test may only ever point the seeder at the local replica set.
    expect(url).toMatch(/^mongodb:\/\/127\.0\.0\.1:7107\//);
    const env = { DB_URL: url, SEED_PASSWORD: "cli-test-password" };

    const first = await seeder(env);
    expect(first.code).toBe(0);
    expect(first.stdout.trim()).toBe(
      "Seed done: 5 documents created. DB now has 2 users, 3 scenes.",
    );

    const second = await seeder(env);
    expect(second.code).toBe(0);
    expect(second.stdout.trim()).toBe(
      "Seed done: 0 documents created. DB now has 2 users, 3 scenes.",
    );

    for (const out of [first, second]) {
      expect(out.stdout + out.stderr).not.toMatch(/Generated login password|cli-test-password/);
    }
  });
});
