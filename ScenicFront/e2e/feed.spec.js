// Landing, Explore, Members and member pages show content: on the seeded
// data plus the 30-scene fixture (E2E_FIXTURE=1 in playwright.config.js).
import { test, expect, imageSources } from "./fixtures.js";

const NOTE =
  "Sample accounts and photos show how Scenic works. Anyone can sign up and post their own.";

const sceneIds = (page) =>
  page
    .locator(".scene-card__title a")
    .evaluateAll((links) => links.map((link) => link.getAttribute("href")));

test("the landing page shows the six newest scenes and links to Explore", async ({ page }) => {
  await page.goto("/");
  const recent = page.locator(".recent-scenes");
  await expect(recent.getByRole("heading", { name: "Recent scenes" })).toBeVisible();
  await expect(recent.locator(".scene-card")).toHaveCount(6);
  await expect(recent.getByText(NOTE)).toBeVisible();
  const sources = await recent
    .locator(".scene-card img")
    .evaluateAll((images) => images.map((img) => img.getAttribute("src")));
  // Cards load the card-size copy of each photo.
  for (const src of sources) expect(src).toMatch(/^https?:\/\/.*\/image\?v=\d+&size=card$/);
  await recent.getByRole("link", { name: "See all scenes" }).click();
  await expect(page).toHaveURL("/explore");
  // The landing page stays on screen while the Explore chunk loads.
  await expect(page.getByRole("heading", { level: 1, name: "Explore scenes" })).toBeVisible();
  await expect(page.locator("h1")).toHaveCount(1);
});

test("Explore loads 12 at a time, announces each load, and ends without duplicates", async ({
  page,
}) => {
  await page.goto("/explore");
  await expect(page.getByText(NOTE)).toBeVisible();
  const cards = page.locator(".scene-card");
  await expect(cards).toHaveCount(12);
  for (const src of await imageSources(page)) expect(src).toMatch(/^https?:\/\//);

  const live = page.locator(".load-more [aria-live='polite']");
  const button = page.getByRole("button", { name: "Load more scenes" });
  await button.click();
  await expect(cards).toHaveCount(24);
  await expect(live).toHaveText("12 more scenes loaded.");

  // Keep going to the end; how far depends on what other specs have posted.
  for (let i = 0; i < 10 && (await button.count()) > 0; i++) {
    const before = await cards.count();
    await button.click();
    await expect.poll(() => cards.count()).toBeGreaterThan(before);
  }
  await expect(page.getByRole("button", { name: "You've seen every scene." })).toBeDisabled();
  await expect(live).toHaveText(/^\d+ more scenes? loaded\.$/);
  const ids = await sceneIds(page);
  expect(ids.length).toBeGreaterThanOrEqual(33);
  expect(new Set(ids).size).toBe(ids.length);
});

test("the members page lists the seeded members, centred at 1440 px", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/users");
  await expect(page.locator("h1")).toHaveText("Members");
  await expect(page.locator(".user-item", { hasText: "Aroha" })).toBeVisible();
  const { left, right } = await page.locator(".user-item").evaluateAll((items) => {
    const boxes = items.map((item) => item.getBoundingClientRect());
    return {
      left: Math.min(...boxes.map((box) => box.left)),
      right: document.documentElement.clientWidth - Math.max(...boxes.map((box) => box.right)),
    };
  });
  expect(Math.abs(left - right)).toBeLessThanOrEqual(2);
});

test("a member page names the member and pages through their scenes", async ({ page }) => {
  await page.goto("/users");
  await page.locator(".user-item", { hasText: "Test member (demo)" }).getByRole("link").click();
  await expect(page.locator("h1")).toHaveText("Scenes by Test member (demo)");
  await expect(page.getByText("30 scenes")).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to members" })).toHaveAttribute(
    "href",
    "/users",
  );
  await expect(page.locator(".scene-card")).toHaveCount(12);
  await page.getByRole("button", { name: "Load more scenes" }).click();
  await expect(page.locator(".scene-card")).toHaveCount(24);
  await page.getByRole("button", { name: "Load more scenes" }).click();
  await expect(page.locator(".scene-card")).toHaveCount(30);
  await expect(page.getByRole("button", { name: "You've seen every scene." })).toBeDisabled();
});

test("an unknown or malformed member id shows a not-found state with links", async ({ page }) => {
  for (const id of ["000000000000000000000000", "nobody"]) {
    await page.goto(`/${id}/scenes`);
    await expect(page.locator("h1")).toHaveText("We couldn't find that member");
    await expect(page.getByRole("link", { name: "See all members" })).toHaveAttribute(
      "href",
      "/users",
    );
    await expect(page.getByRole("link", { name: "Explore scenes" })).toHaveAttribute(
      "href",
      "/explore",
    );
  }
});
