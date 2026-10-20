// Geocoding: Google when a key is configured, otherwise Nominatim, then
// Photon. `fetch` is replaced by a stub for every case here, so nothing
// leaves the machine (the network guard would refuse it anyway). The second
// half checks what a member sees when the geocoder fails while posting.
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import request from "supertest";
import {
  require,
  mongoose,
  buildApp,
  listen,
  close,
  dbUrl,
  PNG_1PX,
  STUB_COORDS,
} from "./helpers.mjs";

const getCoordinatesForAddress = require("../util/location.js");
const HttpError = require("../models/http-error.js");

const UNAVAILABLE = "We couldn't look up that place just now. Please try again in a minute.";
const NOT_FOUND =
  "We couldn't find that place. Try a town or place and its region, e.g. Hahei, Coromandel.";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/**
 * Replace fetch with `answer(url, init)` for one test and record each call.
 * `answer` returns a Response, or throws to stand for a network failure.
 */
function stubFetch(answer) {
  const calls = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    calls.push({ url, init });
    return answer(url, init);
  });
  return calls;
}

describe("getCoordinatesForAddress", () => {
  let logged;
  beforeAll(() => {
    logged = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.mocked(globalThis.fetch).mockRestore?.();
    logged.mockClear();
  });
  afterAll(() => logged.mockRestore());

  describe("with a Google key", () => {
    it("asks Google with the address and key, and returns its first result", async () => {
      const calls = stubFetch(() =>
        json({
          status: "OK",
          results: [{ geometry: { location: { lat: -44.6414, lng: 167.8974 } } }],
        }),
      );
      const coords = await getCoordinatesForAddress("Milford Sound", { apiKey: "test-key" });
      expect(coords).toEqual({ lat: -44.6414, lng: 167.8974 });
      expect(calls).toHaveLength(1);
      const { url, init } = calls[0];
      expect(url.origin + url.pathname).toBe("https://maps.googleapis.com/maps/api/geocode/json");
      expect(url.searchParams.get("address")).toBe("Milford Sound");
      expect(url.searchParams.get("key")).toBe("test-key");
      expect(init.headers.Accept).toBe("application/json");
      // Every call is bounded, so a slow provider can't hold a request open.
      expect(init.signal).toBeInstanceOf(AbortSignal);
    });

    it("answers a place Google doesn't know with the not-found 422", async () => {
      stubFetch(() => json({ status: "ZERO_RESULTS", results: [] }));
      await expect(
        getCoordinatesForAddress("Nowhere at all", { apiKey: "test-key" }),
      ).rejects.toMatchObject({ code: 422, message: NOT_FOUND });
    });

    it("answers an HTTP error or an unreachable Google with the 502, never leaking the key", async () => {
      stubFetch(() => json({ error_message: "boom" }, 500));
      await expect(
        getCoordinatesForAddress("Milford Sound", { apiKey: "secret-google-key" }),
      ).rejects.toMatchObject({ code: 502, message: UNAVAILABLE });
      vi.mocked(globalThis.fetch).mockRestore();

      stubFetch(() => {
        throw new TypeError("fetch failed");
      });
      const err = await getCoordinatesForAddress("Milford Sound", {
        apiKey: "secret-google-key",
      }).catch((e) => e);
      expect(err).toBeInstanceOf(HttpError);
      expect(err.code).toBe(502);
      const log = logged.mock.calls.flat().join(" ");
      expect(log).toMatch(/Google geocoding unreachable/);
      expect(log).not.toContain("secret-google-key");
    });

    it("reads the key per call: an empty key uses the keyless providers", async () => {
      const calls = stubFetch(() => json([{ lat: "-43.9", lon: "170.5" }]));
      await getCoordinatesForAddress("Lake Tekapo", { apiKey: "" });
      expect(calls[0].url.hostname).toBe("nominatim.openstreetmap.org");
    });
  });

  describe("without a key", () => {
    it("uses Nominatim first, identifies itself, and parses its string coordinates", async () => {
      const calls = stubFetch(() => json([{ lat: "-43.8833", lon: "170.5167" }]));
      const coords = await getCoordinatesForAddress("Lake Tekapo", { apiKey: undefined });
      expect(coords).toEqual({ lat: -43.8833, lng: 170.5167 });
      expect(calls).toHaveLength(1);
      const { url, init } = calls[0];
      expect(url.hostname).toBe("nominatim.openstreetmap.org");
      expect(Object.fromEntries(url.searchParams)).toEqual({
        q: "Lake Tekapo",
        format: "json",
        limit: "1",
      });
      expect(init.headers["User-Agent"]).toMatch(/^scenic-app/);
    });

    it("falls through to Photon when Nominatim finds nothing (Photon is [lng, lat])", async () => {
      const calls = stubFetch((url) =>
        url.hostname === "nominatim.openstreetmap.org"
          ? json([])
          : json({ features: [{ geometry: { coordinates: [175.7881, -36.8285] } }] }),
      );
      const coords = await getCoordinatesForAddress("Cathedral Cove", { apiKey: undefined });
      expect(coords).toEqual({ lat: -36.8285, lng: 175.7881 });
      expect(calls.map((c) => c.url.hostname)).toEqual([
        "nominatim.openstreetmap.org",
        "photon.komoot.io",
      ]);
      expect(calls[1].url.searchParams.get("q")).toBe("Cathedral Cove");
    });

    it("falls through to Photon when Nominatim rate-limits (429)", async () => {
      stubFetch((url) =>
        url.hostname === "nominatim.openstreetmap.org"
          ? json({ error: "rate limited" }, 429)
          : json({ features: [{ geometry: { coordinates: [174.7633, -36.8485] } }] }),
      );
      await expect(getCoordinatesForAddress("Auckland", { apiKey: undefined })).resolves.toEqual(
        STUB_COORDS,
      );
    });

    it("answers a place neither provider knows with the not-found 422", async () => {
      stubFetch((url) =>
        url.hostname === "nominatim.openstreetmap.org" ? json([]) : json({ features: [] }),
      );
      await expect(
        getCoordinatesForAddress("Qwertyuiop", { apiKey: undefined }),
      ).rejects.toMatchObject({ code: 422, message: NOT_FOUND });
      expect(logged).not.toHaveBeenCalled();
    });

    it("answers the 502 when a provider failed and the other found nothing, and logs why", async () => {
      stubFetch((url) => {
        if (url.hostname === "nominatim.openstreetmap.org") return json([]);
        throw new TypeError("fetch failed");
      });
      await expect(getCoordinatesForAddress("Hahei", { apiKey: undefined })).rejects.toMatchObject({
        code: 502,
        message: UNAVAILABLE,
      });
      expect(logged.mock.calls.flat().join(" ")).toMatch(
        /Geocoding providers unreachable: fetch failed/,
      );
    });

    it("treats malformed provider answers as not found", async () => {
      stubFetch((url) =>
        url.hostname === "nominatim.openstreetmap.org" ? json({ not: "a list" }) : json(null),
      );
      await expect(
        getCoordinatesForAddress("Somewhere", { apiKey: undefined }),
      ).rejects.toMatchObject({ code: 422 });
    });
  });
});

describe("posting a scene when the geocoder fails", () => {
  let server;
  let member;
  let geocode;
  let logged;

  beforeAll(async () => {
    logged = vi.spyOn(console, "error").mockImplementation(() => {});
    geocode = vi.fn();
    server = await listen(
      buildApp({ env: { ...process.env, DB_URL: dbUrl("geocode") }, geocode: (a) => geocode(a) }),
    );
    member = (
      await request(server)
        .post("/api/users/signup")
        .field("name", "Mere")
        .field("email", "mere@example.com")
        .field("password", "secret123")
    ).body;
    expect(member.token).toBeTruthy();
  });

  afterAll(async () => {
    logged.mockRestore();
    await close(server);
    await mongoose.disconnect();
  });

  const post = () =>
    request(server)
      .post("/api/scenes")
      .set("Authorization", `Bearer ${member.token}`)
      .field("title", "Hot Water Beach")
      .field("description", "Dig your own pool at low tide.")
      .field("address", "Hot Water Beach, Coromandel")
      .attach("image", PNG_1PX, { filename: "a.png", contentType: "image/png" });

  async function expectNothingStored() {
    const Scene = require("../models/scene.js");
    const User = require("../models/user.js");
    expect(await Scene.countDocuments({ creator: member.userId })).toBe(0);
    expect((await User.findById(member.userId).lean()).scenes).toEqual([]);
  }

  it.each([
    ["a place it can't find", new HttpError(NOT_FOUND, 422), 422, NOT_FOUND],
    ["an unreachable provider", new HttpError(UNAVAILABLE, 502), 502, UNAVAILABLE],
    ["a bug in the geocoder", new TypeError("x is undefined"), 500, /Something went wrong/],
  ])(
    "%s → %i with a plain message, nothing stored, never cached",
    async (_, error, status, msg) => {
      geocode.mockRejectedValueOnce(error);
      const res = await post();
      expect(res.status).toBe(status);
      expect(res.body.message).toMatch(msg);
      expect(res.headers["cache-control"]).toBe("no-store");
      expect(JSON.stringify(res.body)).not.toContain("x is undefined");
      await expectNothingStored();
    },
  );

  it("stores the coordinates the geocoder returns", async () => {
    geocode.mockResolvedValueOnce({ lat: -36.8155, lng: 175.8156 });
    const res = await post();
    expect(res.status).toBe(201);
    expect(geocode).toHaveBeenLastCalledWith("Hot Water Beach, Coromandel");
    expect(res.body.scene.location).toEqual({ lat: -36.8155, lng: 175.8156 });
  });
});
