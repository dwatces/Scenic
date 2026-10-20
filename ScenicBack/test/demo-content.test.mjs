// Demo content is honest: every image is a small WebP placeholder that says
// "Demo image" on it, every account is labelled, and no description claims
// anything about a database or a photo that isn't there.
import { describe, it, expect } from "vitest";
import { require } from "./helpers.mjs";

const images = require("../util/demoImages.js");
const demo = require("../util/demoData.js");

const isWebp = (bytes) =>
  bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";

describe("demo content", () => {
  it("loads five WebP placeholders, each 30 KB or less", () => {
    expect(Object.keys(images).sort()).toEqual([
      "avatarAroha",
      "avatarDaniel",
      "cathedralCove",
      "lakeTekapo",
      "milfordSound",
    ]);
    for (const [name, bytes] of Object.entries(images)) {
      expect(Buffer.isBuffer(bytes), name).toBe(true);
      expect(isWebp(bytes), name).toBe(true);
      expect(bytes.length, name).toBeLessThanOrEqual(30 * 1024);
    }
  });

  it("gives every demo member and scene one of those images, typed image/webp", () => {
    const placeholders = Object.values(images).map((bytes) => bytes.toString("base64"));
    for (const doc of [...demo.USERS, ...demo.SCENES]) {
      expect(doc.image.contentType).toBe("image/webp");
      expect(placeholders).toContain(doc.image.data);
    }
  });

  it("labels every demo account by flag, domain and name", () => {
    for (const user of demo.USERS) {
      expect(user.demo).toBe(true);
      expect(user.email).toMatch(/@scenic\.example$/);
      expect(user.name).toMatch(/ \(demo\)$/);
    }
  });

  it("describes places plainly, without database or demo wording", () => {
    for (const scene of demo.SCENES) {
      expect(scene.description).not.toMatch(/demo|provision|database/i);
      expect(scene.description.length).toBeGreaterThanOrEqual(5);
    }
  });
});
