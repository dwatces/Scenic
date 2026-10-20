// Demo content is honest and light: every account is labelled, every scene
// photo is credited, and the images are small enough to live in a document.
// Their URLs change whenever their bytes do.
import { describe, it, expect } from "vitest";
import { require } from "./helpers.mjs";

const images = require("../util/demoImages.js");
const demo = require("../util/demoData.js");
const { serializeScene, serializeUser } = require("../util/serialize.js");

const isWebp = (bytes) =>
  bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";

describe("demo content", () => {
  it("loads three scene photos of 150 KB or less, their card images of 60 KB or less and two avatars of 5 KB or less, all WebP", () => {
    expect(Object.keys(images).sort()).toEqual([
      "avatarAroha",
      "avatarDaniel",
      "cathedralCove",
      "cathedralCoveCard",
      "lakeTekapo",
      "lakeTekapoCard",
      "milfordSound",
      "milfordSoundCard",
    ]);
    for (const [name, bytes] of Object.entries(images)) {
      expect(Buffer.isBuffer(bytes), name).toBe(true);
      expect(isWebp(bytes), name).toBe(true);
      const limit = name.startsWith("avatar") ? 5 : name.endsWith("Card") ? 60 : 150;
      expect(bytes.length, name).toBeLessThanOrEqual(limit * 1024);
    }
  });

  it("makes each card image 640 x 427, a copy of its photo's 3:2 crop", () => {
    // VP8 (lossy) WebP: 14-bit width and height at bytes 26 to 29.
    const size = (bytes) => [bytes.readUInt16LE(26) & 0x3fff, bytes.readUInt16LE(28) & 0x3fff];
    for (const name of ["milfordSound", "lakeTekapo", "cathedralCove"]) {
      expect(images[name].toString("ascii", 12, 16), name).toBe("VP8 ");
      expect(size(images[name]), name).toEqual([1200, 800]);
      expect(size(images[`${name}Card`]), name).toEqual([640, 427]);
    }
  });

  it("gives every demo member and scene one of those images, typed image/webp", () => {
    const files = Object.values(images).map((bytes) => bytes.toString("base64"));
    for (const doc of [...demo.USERS, ...demo.SCENES]) {
      expect(doc.image.contentType).toBe("image/webp");
      expect(files).toContain(doc.image.data);
    }
  });

  it("gives every demo scene its own photo's card image", () => {
    const byPhoto = new Map(
      ["milfordSound", "lakeTekapo", "cathedralCove"].map((name) => [
        images[name].toString("base64"),
        images[`${name}Card`].toString("base64"),
      ]),
    );
    for (const scene of demo.SCENES) {
      expect(scene.thumb.contentType, scene.title).toBe("image/webp");
      expect(scene.thumb.data, scene.title).toBe(byPhoto.get(scene.image.data));
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

describe("demo image URLs", () => {
  const { contentVersion } = demo;
  const urls = (data) =>
    data.SCENES.map((scene) => {
      const out = serializeScene(scene, { creator: data.findUser(scene.creator) });
      return [out.imageUrl, out.cardImageUrl, out.creator.avatarUrl];
    });

  it("are versioned by a hash of the image bytes, card image included", () => {
    for (const scene of demo.SCENES) {
      const out = serializeScene(scene, { creator: demo.findUser(scene.creator) });
      const version = contentVersion(
        Buffer.from(scene.image.data, "base64"),
        Buffer.from(scene.thumb.data, "base64"),
      );
      expect(version).toMatch(/^[0-9a-f]{12}$/);
      expect(out.imageUrl).toBe(`/api/scenes/${scene._id}/image?v=${version}`);
      expect(out.cardImageUrl).toBe(`${out.imageUrl}&size=card`);
    }
    for (const user of demo.USERS) {
      const version = contentVersion(Buffer.from(user.image.data, "base64"));
      expect(serializeUser(user).avatarUrl).toBe(`/api/users/${user._id}/image?v=${version}`);
    }
  });

  it("change when the bytes change, and only then", () => {
    const milford = contentVersion(images.milfordSound, images.milfordSoundCard);
    expect(contentVersion(images.lakeTekapo, images.lakeTekapoCard)).not.toBe(milford);
    // A new card image alone is a new version too.
    expect(contentVersion(images.milfordSound, images.lakeTekapoCard)).not.toBe(milford);
    // The same bytes, read again, give the same version.
    expect(
      contentVersion(Buffer.from(images.milfordSound), Buffer.from(images.milfordSoundCard)),
    ).toBe(milford);

    const scene = demo.SCENES[0];
    const creator = demo.findUser(scene.creator);
    const replaced = {
      ...scene,
      image: { contentType: "image/webp", data: images.lakeTekapo.toString("base64") },
      thumb: { contentType: "image/webp", data: images.lakeTekapoCard.toString("base64") },
      imageVersion: contentVersion(images.lakeTekapo, images.lakeTekapoCard),
    };
    expect(serializeScene(replaced, { creator }).imageUrl).not.toBe(
      serializeScene(scene, { creator }).imageUrl,
    );
  });

  it("stay the same when the same files are loaded again, as on the next deploy", () => {
    const before = urls(demo);
    for (const file of ["../util/demoData.js", "../util/demoImages.js"]) {
      delete require.cache[require.resolve(file)];
    }
    const reloaded = require("../util/demoData.js");
    expect(reloaded).not.toBe(demo);
    expect(urls(reloaded)).toEqual(before);
  });
});
