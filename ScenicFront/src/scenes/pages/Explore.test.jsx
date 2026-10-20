import { describe, it, expect, afterEach, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import Explore from "./Explore";
import { describeLoaded, feedUrl } from "../hooks/feed-hook";
import { resetFreshness } from "../../shared/util/api";
import { API, DEMO_DANIEL, json, mockApi, renderPage, sceneFixture } from "../../test/api-mock";

const page = (from, count, creator) =>
  Array.from({ length: count }, (_, i) => sceneFixture(from + i, creator ? { creator } : {}));

afterEach(() => {
  vi.restoreAllMocks();
  resetFreshness();
});

const liveRegion = () => document.querySelector(".load-more [aria-live='polite']");
const cardTitles = () =>
  screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);

describe("Explore", () => {
  it("loads 12, then 12 more after the cursor, announcing each load, until the end", async () => {
    const first = page(1, 12);
    const second = page(13, 12);
    const last = page(25, 1);
    const calls = mockApi({
      "GET /scenes": ({ url }) => {
        const before = url.searchParams.get("before");
        if (!before) return json({ scenes: first, nextCursor: first[11].id });
        if (before === first[11].id) return json({ scenes: second, nextCursor: second[11].id });
        return json({ scenes: last, nextCursor: null });
      },
    });
    renderPage(<Explore />, { path: "/explore" });

    expect(screen.getByRole("status")).toHaveTextContent("Loading scenes…");
    expect(await screen.findByRole("heading", { level: 2, name: "Scene 1" })).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe("Explore · Scenic"));
    expect(cardTitles()).toHaveLength(12);
    expect(calls[0].url.searchParams.get("limit")).toBe("12");
    expect(liveRegion()).toHaveTextContent("");

    await userEvent.click(screen.getByRole("button", { name: "Load more scenes" }));
    await waitFor(() => expect(cardTitles()).toHaveLength(24));
    expect(liveRegion()).toHaveTextContent("12 more scenes loaded.");
    expect(calls[1].url.searchParams.get("before")).toBe(first[11].id);

    await userEvent.click(screen.getByRole("button", { name: "Load more scenes" }));
    await waitFor(() => expect(cardTitles()).toHaveLength(25));
    expect(liveRegion()).toHaveTextContent("1 more scene loaded.");
    expect(screen.queryByRole("button", { name: "Load more scenes" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "You've seen every scene." })).toBeDisabled();
  });

  it("never shows a scene twice when pages overlap", async () => {
    const first = page(1, 12);
    mockApi({
      "GET /scenes": [
        () => json({ scenes: first, nextCursor: first[11].id }),
        () => json({ scenes: [first[11], ...page(13, 2)], nextCursor: null }),
      ],
    });
    renderPage(<Explore />, { path: "/explore" });
    await userEvent.click(await screen.findByRole("button", { name: "Load more scenes" }));
    await waitFor(() => expect(cardTitles()).toHaveLength(14));
    expect(new Set(cardTitles()).size).toBe(14);
    expect(liveRegion()).toHaveTextContent("2 more scenes loaded.");
  });

  it("keeps the scenes it has when Load more fails, and says why", async () => {
    const first = page(1, 12);
    mockApi({
      "GET /scenes": [
        () => json({ scenes: first, nextCursor: first[11].id }),
        () => Promise.reject(new TypeError("Failed to fetch")),
      ],
    });
    renderPage(<Explore />, { path: "/explore" });
    await userEvent.click(await screen.findByRole("button", { name: "Load more scenes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't reach Scenic. Check your connection and try again.",
    );
    expect(cardTitles()).toHaveLength(12);
    expect(screen.getByRole("button", { name: "Load more scenes" })).toBeEnabled();
  });

  it("shows a plain error with Try again when the first page fails, then the scenes", async () => {
    mockApi({
      "GET /scenes": [
        () => new Response("<h1>504 Gateway Timeout</h1>", { status: 504 }),
        () => json({ scenes: page(1, 2), nextCursor: null }),
      ],
    });
    renderPage(<Explore />, { path: "/explore" });
    const panel = await screen.findByRole("alert");
    expect(panel).toHaveTextContent("We couldn't load the scenes");
    expect(panel).toHaveTextContent("Scenic's server took too long to respond. Please try again.");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { level: 2, name: "Scene 2" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("says so when nobody has posted, and adds the demo note only for demo content", async () => {
    mockApi({ "GET /scenes": () => json({ scenes: [], nextCursor: null }) });
    const { unmount } = renderPage(<Explore />, { path: "/explore" });
    expect(await screen.findByText("No one has posted a scene yet.")).toBeInTheDocument();
    expect(screen.queryByText(/Sample accounts and photos/)).not.toBeInTheDocument();
    unmount();
    vi.restoreAllMocks();

    mockApi({ "GET /scenes": () => json({ scenes: page(1, 3, DEMO_DANIEL), nextCursor: null }) });
    renderPage(<Explore />, { path: "/explore" });
    expect(await screen.findByText(/Sample accounts and photos/)).toBeInTheDocument();
  });
});

describe("feed helpers", () => {
  it("builds feed URLs and load announcements", () => {
    expect(feedUrl()).toBe(`${API}/scenes`);
    expect(feedUrl({ limit: 6, creator: "c1", before: "b1" })).toBe(
      `${API}/scenes?limit=6&creator=c1&before=b1`,
    );
    expect(describeLoaded(1)).toBe("1 more scene loaded.");
    expect(describeLoaded(0)).toBe("0 more scenes loaded.");
  });
});
