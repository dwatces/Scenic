// The real route table: every page has its own title, unknown URLs get
// Page not found, and the landing page shows the newest scenes.
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";

import App from "./App";
import { DEMO_DANIEL, json, mockApi, sceneFixture, userFixture } from "./test/api-mock";

const HOUR = 60 * 60 * 1000;

function visit(path, { signedInAs } = {}) {
  if (signedInAs) {
    localStorage.setItem(
      "userData",
      JSON.stringify({
        userId: signedInAs.id,
        token: "t",
        expiration: new Date(Date.now() + HOUR).toISOString(),
      }),
    );
  }
  window.history.replaceState(null, "", path);
  return render(<App />);
}

afterEach(() => {
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/");
});

describe("routes", () => {
  it("shows Page not found for an unknown URL, with its own title and links", async () => {
    mockApi({});
    visit("/no/such/page");
    expect(
      await screen.findByRole("heading", { level: 1, name: "Page not found" }),
    ).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe("Page not found · Scenic"));
    const main = screen.getByRole("main");
    expect(within(main).getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    expect(within(main).getByRole("link", { name: "Explore scenes" })).toHaveAttribute(
      "href",
      "/explore",
    );
  });

  it("also shows Page not found to a signed-in member", async () => {
    mockApi({ [`GET /users/${DEMO_DANIEL.id}`]: () => json({ user: userFixture(DEMO_DANIEL) }) });
    visit("/nothing-here", { signedInAs: DEMO_DANIEL });
    expect(
      await screen.findByRole("heading", { level: 1, name: "Page not found" }),
    ).toBeInTheDocument();
  });

  it("signed out, / is the landing page: the hero, then the six newest scenes", async () => {
    const calls = mockApi({
      "GET /scenes": () => json({ scenes: [sceneFixture(1), sceneFixture(2)], nextCursor: null }),
    });
    visit("/");
    await waitFor(() => expect(document.title).toBe("Scenic: share photos of the places you love"));
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(await screen.findByRole("heading", { level: 3, name: "Scene 2" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Recent scenes" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See all scenes" })).toHaveAttribute(
      "href",
      "/explore",
    );
    expect(calls[0].url.searchParams.get("limit")).toBe("6");
  });

  it("/landing goes home", async () => {
    mockApi({ "GET /scenes": () => json({ scenes: [], nextCursor: null }) });
    visit("/landing");
    expect(await screen.findByText("No one has posted a scene yet.")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/");
  });

  it("sends a signed-in member away from log in and sign up, to next or home", async () => {
    mockApi({
      [`GET /users/${DEMO_DANIEL.id}`]: () => json({ user: userFixture(DEMO_DANIEL) }),
      "GET /scenes": () => json({ scenes: [], nextCursor: null }),
      "GET /users": () => json({ users: [] }),
    });
    visit("/signup?next=%2Fusers", { signedInAs: DEMO_DANIEL });
    expect(await screen.findByRole("heading", { level: 1, name: "Members" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/users");
  });

  it("ignores a next that points at another site", async () => {
    mockApi({
      [`GET /users/${DEMO_DANIEL.id}`]: () => json({ user: userFixture(DEMO_DANIEL) }),
      "GET /scenes": () => json({ scenes: [], nextCursor: null }),
    });
    const origin = window.location.origin;
    visit("/login?next=%2F%2Fexample.com", { signedInAs: DEMO_DANIEL });
    expect(await screen.findByRole("heading", { level: 1, name: "Your scenes" })).toBeVisible();
    expect(window.location.pathname).toBe("/");
    expect(window.location.origin).toBe(origin);
  });
});
