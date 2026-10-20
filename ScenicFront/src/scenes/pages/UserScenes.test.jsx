import { describe, it, expect, afterEach, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import UserScenes from "./UserScenes";
import { resetFreshness } from "../../shared/util/api";
import {
  DEMO_DANIEL,
  KIRI,
  json,
  mockApi,
  renderPage,
  sceneFixture,
  signedInAs,
  userFixture,
} from "../../test/api-mock";

afterEach(() => {
  vi.restoreAllMocks();
  resetFreshness();
});

const ROUTE = "/:userId/scenes";

describe("a member's page", () => {
  it("names the member, counts their scenes, labels a demo account, and links back", async () => {
    const scenes = [
      sceneFixture(1, { creator: DEMO_DANIEL }),
      sceneFixture(2, { creator: DEMO_DANIEL }),
    ];
    const calls = mockApi({
      [`GET /users/${DEMO_DANIEL.id}`]: () => json({ user: userFixture(DEMO_DANIEL, 2) }),
      "GET /scenes": () => json({ scenes, nextCursor: null }),
    });
    renderPage(<UserScenes />, { path: `/${DEMO_DANIEL.id}/scenes`, route: ROUTE });

    expect(screen.getByRole("status")).toHaveTextContent("Loading scenes…");
    expect(
      await screen.findByRole("heading", { level: 1, name: "Scenes by Daniel (demo)" }),
    ).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe("Scenes by Daniel (demo) · Scenic"));
    expect(screen.getByText("2 scenes")).toBeInTheDocument();
    expect(screen.getByText("Demo account")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to members" })).toHaveAttribute("href", "/users");
    expect(await screen.findAllByRole("heading", { level: 2 })).toHaveLength(2);
    // The profile and the scenes load side by side; the feed asks for this creator only.
    const feed = calls.find((c) => c.path === "/scenes");
    expect(feed.url.searchParams.get("creator")).toBe(DEMO_DANIEL.id);
    // Someone else's page: no owner actions, no creator line on each card.
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Daniel (demo)" })).not.toBeInTheDocument();
  });

  it("says when a member has posted nothing", async () => {
    mockApi({
      [`GET /users/${KIRI.id}`]: () => json({ user: userFixture(KIRI, 0) }),
      "GET /scenes": () => json({ scenes: [], nextCursor: null }),
    });
    renderPage(<UserScenes />, { path: `/${KIRI.id}/scenes`, route: ROUTE });
    expect(await screen.findByText("Kiri hasn't posted any scenes yet.")).toBeInTheDocument();
    expect(screen.getByText("0 scenes")).toBeInTheDocument();
  });

  it("answers a malformed member id with not found, without asking the API", async () => {
    const calls = mockApi({});
    renderPage(<UserScenes />, { path: "/not-an-id/scenes", route: ROUTE });
    expect(
      screen.getByRole("heading", { level: 1, name: "We couldn't find that member" }),
    ).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe("Member not found · Scenic"));
    expect(calls).toHaveLength(0);
  });

  it("answers an unknown member with not found", async () => {
    mockApi({
      [`GET /users/${KIRI.id}`]: () => json({ message: "We couldn't find that member." }, 404),
      "GET /scenes": () => json({ scenes: [], nextCursor: null }),
    });
    renderPage(<UserScenes />, { path: `/${KIRI.id}/scenes`, route: ROUTE });
    expect(
      await screen.findByRole("heading", { level: 1, name: "We couldn't find that member" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See all members" })).toHaveAttribute("href", "/users");
  });

  it("retries the profile and the scenes with one Try again", async () => {
    const calls = mockApi({
      [`GET /users/${KIRI.id}`]: [
        () => Promise.reject(new TypeError("Failed to fetch")),
        () => json({ user: userFixture(KIRI, 1) }),
      ],
      "GET /scenes": [
        () => Promise.reject(new TypeError("Failed to fetch")),
        () => json({ scenes: [sceneFixture(1)], nextCursor: null }),
      ],
    });
    renderPage(<UserScenes />, { path: `/${KIRI.id}/scenes`, route: ROUTE });
    const panel = await screen.findByRole("alert");
    expect(panel).toHaveTextContent("We couldn't load this member");
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    await userEvent.click(within(panel).getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { level: 2, name: "Scene 1" })).toBeInTheDocument();
    expect(calls.filter((c) => c.path === "/scenes")).toHaveLength(2);
  });
});

describe("your own scenes", () => {
  it("is 'Your scenes' with a way to add one, and an empty state that invites the first", async () => {
    mockApi({
      [`GET /users/${KIRI.id}`]: () => json({ user: userFixture(KIRI, 0) }),
      "GET /scenes": () => json({ scenes: [], nextCursor: null }),
    });
    renderPage(<UserScenes own />, { path: "/", auth: signedInAs(KIRI) });
    expect(await screen.findByRole("heading", { level: 1, name: "Your scenes" })).toBeVisible();
    await waitFor(() => expect(document.title).toBe("Your scenes · Scenic"));
    expect(await screen.findByText("You haven't posted any scenes yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add your first scene" })).toHaveAttribute(
      "href",
      "/scenes/new",
    );
    expect(screen.getByRole("link", { name: "Add a scene" })).toHaveAttribute(
      "href",
      "/scenes/new",
    );
  });

  // Deleting a card used to reload the whole page (and drop loaded pages).
  it("deletes a card in place: the rest stay, the count drops, and it says so", async () => {
    const scenes = [sceneFixture(1, { title: "Keep me" }), sceneFixture(2, { title: "Bin me" })];
    const calls = mockApi({
      [`GET /users/${KIRI.id}`]: () => json({ user: userFixture(KIRI, 2) }),
      "GET /scenes": () => json({ scenes, nextCursor: null }),
      [`DELETE /scenes/${scenes[1].id}`]: () => json({ message: "Deleted scene." }),
    });
    renderPage(<UserScenes own />, { path: "/", auth: signedInAs(KIRI) });
    const card = (await screen.findByRole("heading", { level: 2, name: "Bin me" })).closest("li");
    await userEvent.click(within(card).getByRole("button", { name: "Delete" }));
    await userEvent.click(
      within(screen.getByRole("dialog", { name: "Delete “Bin me”?" })).getByRole("button", {
        name: "Delete scene",
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("heading", { level: 2, name: "Bin me" })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("heading", { level: 2, name: "Keep me" })).toBeInTheDocument();
    expect(screen.getByText("1 scene")).toBeInTheDocument();
    expect(screen.getByText("Deleted “Bin me”.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
    // No reload: the profile and the feed were each fetched once.
    expect(calls.filter((c) => c.method === "GET")).toHaveLength(2);
  });
});
