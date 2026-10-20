// The landing page hero: which photos load and when, the rotation and its
// Pause button, reduced motion, and the headline's semantics.
import { test, expect } from "./fixtures.js";

const HERO_FILE =
  /\/static\/(street|landscape|family|portrait)-(wide|tall)-\d+-[\w-]+\.(avif|webp)$/;

/** Hero photo requests made by the page, by photo name. */
function trackHeroRequests(page) {
  const seen = [];
  page.on("request", (req) => {
    const match = new URL(req.url()).pathname.match(HERO_FILE);
    if (match) seen.push(match[1]);
  });
  return seen;
}

const activeWord = (page) => page.locator(".hero__word.is-active").textContent();

test("one h1 that reads as a question, and two links as calls to action", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName(
    "What should I do with my photos?",
  );
  await expect(page.getByRole("link", { name: "Browse scenes" })).toHaveAttribute(
    "href",
    "/explore",
  );
  await expect(page.locator(".hero").getByRole("link", { name: "Sign up" })).toHaveAttribute(
    "href",
    "/signup",
  );
  await expect(page.locator(".hero [tabindex='-1'], .hero a button")).toHaveCount(0);
  for (const word of await page.locator(".hero__word").allTextContents()) {
    expect(word).toMatch(/\?$/);
  }
});

test("the first photo loads first; the others only after the load event", async ({ page }) => {
  const order = [];
  page.on("requestfinished", (req) => {
    const match = new URL(req.url()).pathname.match(HERO_FILE);
    if (match) order.push(match[1]);
  });
  await page.goto("/", { waitUntil: "load" });
  const photo = page.locator(".hero__frame img").first();
  await expect(photo).toHaveAttribute("fetchpriority", "high");
  expect(await photo.evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true);
  await expect(page.locator(".hero__frame img")).toHaveCount(4);
  await expect.poll(() => order.length).toBe(4);
  expect(order[0]).toBe("street");
});

test("pages other than the landing page request no hero photo", async ({ page }) => {
  const seen = trackHeroRequests(page);
  for (const path of ["/login", "/users", "/explore", "/signup"]) {
    await page.goto(path, { waitUntil: "networkidle" });
  }
  expect(seen).toEqual([]);
});

test("the photo and words change, and Pause stops them (keyboard)", async ({ page }) => {
  await page.goto("/", { waitUntil: "load" });
  await expect(page.locator(".hero__frame img")).toHaveCount(4);
  await expect.poll(() => activeWord(page), { timeout: 15_000 }).not.toBe("street scenes?");

  const pause = page.getByRole("button", { name: "Pause slideshow" });
  await pause.focus();
  await expect(pause).toHaveCSS("outline-style", "solid");
  await page.keyboard.press("Enter");
  await expect(pause).toHaveAttribute("aria-pressed", "true");
  const box = await pause.boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);

  const word = await activeWord(page);
  await page.waitForTimeout(10_000);
  expect(await activeWord(page)).toBe(word);

  await page.keyboard.press("Space");
  await expect(pause).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => activeWord(page), { timeout: 15_000 }).not.toBe(word);
});

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("one photo, no change for 10 s, no other photos requested", async ({ page }) => {
    const seen = trackHeroRequests(page);
    await page.goto("/", { waitUntil: "load" });
    await expect(page.locator(".hero__frame img")).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Pause slideshow" })).toHaveCount(0);
    expect(await activeWord(page)).toBe("street scenes?");
    await page.waitForTimeout(10_000);
    expect(await activeWord(page)).toBe("street scenes?");
    await expect(page.locator(".hero__frame img")).toHaveCount(1);
    expect(new Set(seen)).toEqual(new Set(["street"]));
  });
});
