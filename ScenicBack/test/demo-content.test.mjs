// Demo content is honest and light: every account is labelled, every scene
// photo is credited, and the images are small enough to live in a document.
import { describe, it, expect } from "vitest";
import { require } from "./helpers.mjs";

const images = require("../util/demoImages.js");
const demo = require("../util/demoData.js");

const isWebp = (bytes) =>
  bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";

describe("demo content", () => {
  it("loads three scene photos of 150 KB or less and two avatars of 5 KB or less, all WebP", () => {
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
      const limit = name.startsWith("avatar") ? 5 : 150;
      expect(bytes.length, name).toBeLessThanOrEqual(limit * 1024);
    }
  });

  it("gives every demo member and scene one of those images, typed image/webp", () => {
    const files = Object.values(images).map((bytes) => bytes.toString("base64"));
    for (const doc of [...demo.USERS, ...demo.SCENES]) {
      expect(doc.image.contentType).toBe("image/webp");
      expect(files).toContain(doc.image.data);
    }
  });

  it("labels every demo account by flag and domain", () => {
    for (const user of demo.USERS) {
      expect(user.demo).toBe(true);
      expect(user.email).toMatch(/@scenic\.example$/);
    }
  });

  it("credits every scene photo to its photographer, linking to the photo's Pexels page", () => {
    for (const scene of demo.SCENES) {
      expect(scene.credit.text).toMatch(/^\S.* on Pexels$/);
      expect(scene.credit.url).toMatch(/^https:\/\/www\.pexels\.com\/photo\/[a-z0-9-]+-\d+\/$/);
    }
  });

  it("describes places plainly, without database or demo wording", () => {
    for (const scene of demo.SCENES) {
      expect(scene.description).not.toMatch(/demo|provision|database/i);
      expect(scene.description.length).toBeGreaterThanOrEqual(5);
    }
  });
});
