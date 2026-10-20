import { describe, it, expect, vi, afterEach } from "vitest";

import {
  apiRequest,
  ApiError,
  describeFailure,
  MESSAGES,
  markWrite,
  withFreshness,
  resetFreshness,
  safeNextPath,
  sentToken,
} from "./api";

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const html = (status, body = "<!doctype html><title>Error</title><p>Gateway timeout</p>") =>
  new Response(body, { status, headers: { "Content-Type": "text/html" } });

function mockFetch(impl) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(impl);
}

async function failureOf(promise) {
  try {
    await promise;
  } catch (err) {
    return err;
  }
  throw new Error("expected the request to fail");
}

afterEach(() => {
  vi.restoreAllMocks();
  resetFreshness();
});

describe("apiRequest", () => {
  it("returns the parsed JSON of a 2xx response", async () => {
    mockFetch(async () => json(200, { scenes: [] }));
    await expect(apiRequest("/api/scenes")).resolves.toEqual({ scenes: [] });
  });

  it("turns an HTML 504 page into a plain timeout message", async () => {
    mockFetch(async () => html(504));
    const err = await failureOf(apiRequest("/api/scenes"));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(504);
    expect(err.message).toBe("Scenic's server took too long to respond. Please try again.");
  });

  it("turns a rejected fetch into a connection message", async () => {
    mockFetch(async () => {
      throw new TypeError("Failed to fetch");
    });
    const err = await failureOf(apiRequest("/api/scenes"));
    expect(err.status).toBe(0);
    expect(err.message).toBe("We couldn't reach Scenic. Check your connection and try again.");
  });

  it("lets an abort pass through untouched", async () => {
    mockFetch(async () => {
      throw new DOMException("The operation was aborted.", "AbortError");
    });
    const err = await failureOf(apiRequest("/api/scenes"));
    expect(err.name).toBe("AbortError");
  });

  it("shows the API's own message for 4xx and 5xx JSON errors", async () => {
    mockFetch(async () => json(422, { message: "Add a title." }));
    expect((await failureOf(apiRequest("/x"))).message).toBe("Add a title.");
    mockFetch(async () =>
      json(401, { message: "That email and password don't match an account." }),
    );
    expect((await failureOf(apiRequest("/x"))).message).toBe(
      "That email and password don't match an account.",
    );
    mockFetch(async () => json(502, { message: "The location service is unavailable." }));
    expect((await failureOf(apiRequest("/x"))).message).toBe(
      "The location service is unavailable.",
    );
  });

  it("refuses a 2xx that isn't JSON (the request reached something other than the API)", async () => {
    mockFetch(async () => html(200, "<!doctype html><div id=root></div>"));
    const err = await failureOf(apiRequest("/api/scenes"));
    expect(err.message).toBe(MESSAGES.server);
  });

  it("never shows a parse error, whatever the body", async () => {
    const bodies = [
      html(500),
      html(200, "<html>"),
      new Response("Unexpected token", { status: 500, headers: { "Content-Type": "text/plain" } }),
      new Response("{not json", { status: 500, headers: { "Content-Type": "application/json" } }),
      new Response("{not json", { status: 200, headers: { "Content-Type": "application/json" } }),
      new Response("", { status: 413 }),
      new Response("Too Many Requests", { status: 429 }),
    ];
    for (const body of bodies) {
      mockFetch(async () => body);
      const err = await failureOf(apiRequest("/x"));
      expect(err.message).not.toMatch(/Unexpected token|JSON|<|Failed to fetch/);
      expect(err.message.length).toBeGreaterThan(10);
    }
  });
});

describe("describeFailure", () => {
  it("has a plain message for every status without a JSON body", () => {
    expect(describeFailure(401, null)).toBe(MESSAGES.signIn);
    expect(describeFailure(403, null)).toBe(MESSAGES.forbidden);
    expect(describeFailure(404, null)).toBe(MESSAGES.notFound);
    expect(describeFailure(413, null)).toBe(MESSAGES.tooLarge);
    expect(describeFailure(422, null)).toBe(MESSAGES.invalid);
    expect(describeFailure(429, null)).toBe(MESSAGES.tooMany);
    expect(describeFailure(500, null)).toBe(MESSAGES.server);
    expect(describeFailure(502, null)).toBe(MESSAGES.server);
    expect(describeFailure(503, null)).toBe(MESSAGES.unavailable);
    expect(describeFailure(504, null)).toBe(MESSAGES.timeout);
    expect(describeFailure(418, { message: "  " })).toBe(MESSAGES.invalid);
  });
});

describe("sentToken", () => {
  it("is true only for a Bearer token", () => {
    expect(sentToken({ Authorization: "Bearer abc" })).toBe(true);
    expect(sentToken({ authorization: "bearer abc" })).toBe(true);
    expect(sentToken({ Authorization: "Bearer " })).toBe(false);
    expect(sentToken({ "Content-Type": "application/json" })).toBe(false);
    expect(sentToken()).toBe(false);
  });
});

describe("freshness after a change", () => {
  it("leaves list URLs alone until this visitor changes something", () => {
    expect(withFreshness("/api/scenes?creator=abc", 1000)).toBe("/api/scenes?creator=abc");
  });

  it("adds fresh=<time of the change> for 10 minutes after a change", () => {
    markWrite(5000);
    expect(withFreshness("/api/scenes?creator=abc", 6000)).toBe(
      "/api/scenes?creator=abc&fresh=5000",
    );
    expect(withFreshness("/api/users", 6000)).toBe("/api/users?fresh=5000");
    expect(withFreshness("/api/users", 5000 + 10 * 60 * 1000 + 1)).toBe("/api/users");
  });

  it("remembers the change across a reload in the same tab", () => {
    markWrite(7000);
    expect(sessionStorage.getItem("scenic:lastWrite")).toBe("7000");
  });
});

describe("safeNextPath", () => {
  it("accepts paths on this site", () => {
    expect(safeNextPath("/scenes/new")).toBe("/scenes/new");
    expect(safeNextPath("/abc/scenes?x=1")).toBe("/abc/scenes?x=1");
    expect(safeNextPath("/")).toBe("/");
  });

  it("sends anything else to /", () => {
    for (const next of [
      null,
      undefined,
      "",
      "https://example.com",
      "//example.com",
      "/\\example.com",
      "\\\\example.com",
      "/\t/example.com",
      "/foo://bar",
      "javascript:alert(1)",
      "scenes/new",
      `/${"a".repeat(2001)}`,
    ]) {
      expect(safeNextPath(next), String(next)).toBe("/");
    }
  });
});
