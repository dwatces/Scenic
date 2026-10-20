import { describe, it, expect, vi, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";

import Hero, { HEADLINE, HERO_INTERVAL_MS, nextLoadedFrame } from "./Hero";
import { HERO_FRAMES } from "./hero-frames";

const renderHero = () =>
  render(
    <MemoryRouter>
      <Hero />
    </MemoryRouter>,
  );

function preferReducedMotion(reduce) {
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    matches: reduce && query.includes("reduce"),
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
}

const activeWord = (container) => container.querySelector(".hero__word.is-active").textContent;

/** Fire load on every hero photo rendered so far. */
const loadImages = (container) =>
  container.querySelectorAll(".hero__frame img").forEach((img) => fireEvent.load(img));

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("Hero", () => {
  it("is one h1 that reads as a plain question, with two links", () => {
    renderHero();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveAccessibleName(HEADLINE);
    expect(screen.getByRole("link", { name: "Browse scenes" })).toHaveAttribute("href", "/explore");
    expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute("href", "/signup");
    expect(document.querySelector(".hero button a, .hero a button")).toBeNull();
  });

  it("asks a question for every photo", () => {
    const { container } = renderHero();
    const words = [...container.querySelectorAll(".hero__word")].map((word) => word.textContent);
    expect(words).toEqual(HERO_FRAMES.map((frame) => `${frame.word}?`));
    for (const word of words) expect(`What should I do with my ${word}`).toMatch(/\?$/);
  });

  it("shows only the first photo until the page has loaded", () => {
    const { container } = renderHero();
    const images = container.querySelectorAll(".hero__frame img");
    expect(images).toHaveLength(1);
    expect(images[0]).toHaveAttribute("fetchpriority", "high");
    expect(images[0]).toHaveAttribute("alt", "");
  });

  it("moves only to photos that have loaded, and the Pause button stops it", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { container } = renderHero();
    loadImages(container); // the first photo; document.readyState is "complete" in jsdom
    expect(container.querySelectorAll(".hero__frame img")).toHaveLength(4);
    expect(activeWord(container)).toBe("street scenes?");

    // Nothing else has loaded: the rotation stays put.
    act(() => vi.advanceTimersByTime(HERO_INTERVAL_MS * 2));
    expect(activeWord(container)).toBe("street scenes?");

    // Only the family photo has loaded: it skips straight there.
    fireEvent.load(container.querySelectorAll(".hero__frame img")[2]);
    act(() => vi.advanceTimersByTime(HERO_INTERVAL_MS));
    expect(activeWord(container)).toBe("family memories?");

    const pause = screen.getByRole("button", { name: "Pause slideshow" });
    expect(pause).toHaveAttribute("aria-pressed", "false");
    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(pause);
    expect(pause).toHaveAttribute("aria-pressed", "true");
    loadImages(container);
    act(() => vi.advanceTimersByTime(HERO_INTERVAL_MS * 3));
    expect(activeWord(container)).toBe("family memories?");
  });

  it("with reduced motion: one photo, the first words, no Pause button", () => {
    preferReducedMotion(true);
    vi.useFakeTimers();
    const { container } = renderHero();
    loadImages(container);
    act(() => vi.advanceTimersByTime(HERO_INTERVAL_MS * 3));
    expect(container.querySelectorAll(".hero__frame img")).toHaveLength(1);
    expect(activeWord(container)).toBe("street scenes?");
    expect(screen.queryByRole("button", { name: "Pause slideshow" })).toBeNull();
  });
});

describe("nextLoadedFrame", () => {
  it("skips frames that haven't loaded and stays put when none has", () => {
    expect(nextLoadedFrame(0, new Set([0, 1, 2, 3]), 4)).toBe(1);
    expect(nextLoadedFrame(3, new Set([0, 1, 2, 3]), 4)).toBe(0);
    expect(nextLoadedFrame(0, new Set([0, 3]), 4)).toBe(3);
    expect(nextLoadedFrame(1, new Set([1]), 4)).toBe(1);
  });
});
