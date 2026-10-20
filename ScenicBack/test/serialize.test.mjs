// The serialisers on their own: shapes, type normalisation, demo labelling.
import { describe, it, expect } from "vitest";
import { require, findKeys, PNG_1PX, WEBP_1PX } from "./helpers.mjs";

const { Types } = require("mongoose");
const {
  serializeUser,
  serializeScene,
  legacyUser,
  legacyScene,
  normaliseContentType,
  isDemoUser,
} = require("../util/serialize.js");

const userId = new Types.ObjectId("6ad72233e7b2b3491f9be98b");
const sceneId = new Types.ObjectId("6ad72233e7b2b3491f9be98d");

const member = {
  _id: userId,
  name: "Kiri",
  email: "kiri@example.com",
  password: "$2b$10$hash",
  __v: 0,
  image: { data: PNG_1PX.toString("base64"), contentType: "image/png" },
  scenes: [sceneId],
  updatedAt: new Date("2026-07-01T00:00:00Z"),
};
const scene = {
  _id: sceneId,
  title: "Piha",
  description: "Lion Rock at low tide.",
  address: "Piha, Auckland",
  location: { lat: -36.954, lng: 174.47 },
  creator: userId,
  image: { data: WEBP_1PX.toString("base64"), contentType: "image/webp" },
  __v: 0,
};

describe("normaliseContentType", () => {
  it.each([
    ["jpeg", "image/jpeg"],
    ["jpg", "image/jpeg"],
    ["image/jpeg", "image/jpeg"],
    ["image/jpg", "image/jpeg"],
    ["JPEG", "image/jpeg"],
    ["png", "image/png"],
    ["image/png", "image/png"],
    ["webp", "image/webp"],
    ["image/webp", "image/webp"],
  ])("%s → %s", (label, expected) => {
    expect(normaliseContentType(label)).toBe(expected);
  });

  it("falls back to the bytes for an unknown label, then to JPEG", () => {
    expect(normaliseContentType(undefined, PNG_1PX.toString("base64"))).toBe("image/png");
    expect(normaliseContentType("image/undefined", WEBP_1PX.toString("base64"))).toBe("image/webp");
    expect(normaliseContentType(undefined, undefined)).toBe("image/jpeg");
  });
});

describe("isDemoUser", () => {
  it("is true for a flagged account or the reserved demo domain, false otherwise", () => {
    expect(isDemoUser({ demo: true, email: "x@example.com" })).toBe(true);
    expect(isDemoUser({ email: "daniel@scenic.example" })).toBe(true);
    expect(isDemoUser({ email: "Aroha@Scenic.Example" })).toBe(true);
    expect(isDemoUser({ email: "someone@scenic.example.com" })).toBe(false);
    expect(isDemoUser({ email: "kiri@example.com", demo: false })).toBe(false);
    expect(isDemoUser(null)).toBe(false);
  });
});

describe("serializeUser and serializeScene", () => {
  it("builds the public member shape with no private fields", () => {
    const out = serializeUser(member);
    expect(out).toEqual({
      id: String(userId),
      name: "Kiri",
      avatarUrl: `/api/users/${userId}/image?v=${Date.parse("2026-07-01T00:00:00Z")}`,
      sceneCount: 1,
      isDemo: false,
    });
  });

  it("gives a member without an image a null avatar", () => {
    expect(serializeUser({ ...member, image: undefined }).avatarUrl).toBeNull();
  });

  it("builds the public scene shape with a creator summary", () => {
    const out = serializeScene(scene, { creator: member });
    expect(Object.keys(out).sort()).toEqual(
      [
        "address",
        "createdAt",
        "creator",
        "credit",
        "description",
        "id",
        "imageType",
        "imageUrl",
        "isDemo",
        "location",
        "title",
      ].sort(),
    );
    expect(out.imageType).toBe("image/webp");
    expect(out.imageUrl).toBe(`/api/scenes/${sceneId}/image?v=${sceneId.getTimestamp().getTime()}`);
    expect(out.createdAt).toBe(sceneId.getTimestamp().toISOString()); // no stored timestamp: the id's time
    expect(out.credit).toBeNull();
    expect(out.creator).toEqual({
      id: String(userId),
      name: "Kiri",
      avatarUrl: expect.any(String),
      isDemo: false,
    });
    expect(findKeys(out, ["email", "password", "__v", "data"])).toEqual([]);
  });

  it("uses a stored createdAt and a credit when present", () => {
    const out = serializeScene(
      { ...scene, createdAt: new Date("2026-06-20T09:10:00Z"), credit: { text: "Photo: Kiri" } },
      { creator: { ...member, demo: true } },
    );
    expect(out.createdAt).toBe("2026-06-20T09:10:00.000Z");
    expect(out.credit).toEqual({ text: "Photo: Kiri", url: null });
    expect(out.isDemo).toBe(true);
    expect(out.creator.isDemo).toBe(true);
  });
});

describe("legacy shapes (deployed client)", () => {
  it("keeps the fields the old client reads, with a bare contentType", () => {
    const user = legacyUser(member);
    expect(user).toEqual({
      id: String(userId),
      _id: String(userId),
      name: "Kiri",
      image: { data: member.image.data, contentType: "png" },
      contentType: "png",
      scenes: [String(sceneId)],
      isDemo: false,
    });
    const legacy = legacyScene(scene, { creator: member });
    expect(legacy.creator).toBe(String(userId));
    expect(legacy.contentType).toBe("webp");
    expect(legacy.image).toEqual({ data: scene.image.data, contentType: "webp" });
    expect(findKeys([user, legacy], ["email", "password", "__v"])).toEqual([]);
  });
});
