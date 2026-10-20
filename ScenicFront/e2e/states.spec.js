// Loading, error and empty states: pages load in place (status line and
// skeletons, never a full-screen overlay), and a failed load shows a plain
// message with "Try again" while the header keeps working. The API is
// "stopped" (requests refused) or answers with a proxy's HTML 504 page.
import { test, expect, API_URL, signUp, postScene, useSession } from "./fixtures.js";

const API_PATTERN = `${API_URL}/**`;

const FAILURES = {
  "the API is stopped": {
    stub: (route) => route.abort("connectionrefused"),
    message: "We couldn't reach Scenic. Check your connection and try again.",
  },
  "a proxy answers with an HTML 504": {
    stub: (route) =>
      route.fulfill({
        status: 504,
        contentType: "text/html",
        body: "<html><body><h1>504 Gateway Timeout</h1></body></html>",
      }),
    message: "Scenic's server took too long to respond. Please try again.",
  },
};

/** Elements fixed over most of the viewport (an overlay), other than the header and dialogs. */
const overlays = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("body *")]
      .filter((el) => {
        if (el.closest(".main-header, dialog")) return false;
        const style = getComputedStyle(el);
        if (style.position !== "fixed") return false;
        const box = el.getBoundingClientRect();
        return box.width * box.height > 0.5 * innerWidth * innerHeight;
      })
      .map((el) => el.className),
  );

let paths;
test.beforeAll(async ({ request }) => {
  const { users } = await (await request.get(`${API_URL}/users`)).json();
  const { scenes } = await (await request.get(`${API_URL}/scenes?limit=1`)).json();
  const daniel = users.find((user) => user.name === "Daniel");
  paths = {
    Members: { path: "/users", ready: (page) => page.locator(".user-item").first() },
    Explore: { path: "/explore", ready: (page) => page.locator(".scene-card").first() },
    "a member page": {
      path: `/${daniel.id}/scenes`,
      ready: (page) => page.locator(".scene-card").first(),
    },
    "a scene page": {
      path: `/scenes/${scenes[0].id}`,
      ready: (page) => page.locator(".scene-page__figure img"),
    },
  };
});

for (const [failure, { stub, message }] of Object.entries(FAILURES)) {
  test(`when ${failure}, each page says so and "Try again" works`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    for (const [name, { path, ready }] of Object.entries(paths)) {
      await page.route(API_PATTERN, stub);
      await page.goto(path);
      const panel = page.getByRole("alert");
      await expect(panel, name).toContainText(message);
      await expect(panel.getByRole("button", { name: "Try again" })).toBeVisible();
      expect(await overlays(page)).toEqual([]);
      // The header still works while the error shows.
      const members = page.locator(".main-navigation__header-nav").getByRole("link", {
        name: "Members",
      });
      await members.click({ trial: true });

      await page.unroute(API_PATTERN);
      await panel.getByRole("button", { name: "Try again" }).click();
      await expect(ready(page), name).toBeVisible();
      await expect(page.getByRole("alert")).toHaveCount(0);
    }
    // A header link really navigates from an error state.
    await page.route(API_PATTERN, stub);
    await page.goto("/users");
    await expect(page.getByRole("alert")).toBeVisible();
    await page
      .locator(".main-navigation__header-nav")
      .getByRole("link", { name: "Explore" })
      .click();
    await expect(page).toHaveURL("/explore");
  });
}

test("slow loads show a status line and skeletons in the page, never an overlay", async ({
  page,
}) => {
  await page.route(API_PATTERN, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await route.continue().catch(() => {}); // the page may have moved on
  });
  const checks = [
    ["/explore", "Loading scenes…", ".skeleton-card", 6],
    ["/users", "Loading members…", ".skeleton-member", 4],
    ["/", "Loading scenes…", ".skeleton-card", 3],
  ];
  for (const [path, text, skeleton, count] of checks) {
    await page.goto(path);
    await expect(page.getByRole("status").filter({ hasText: text })).toBeVisible();
    await expect(page.locator(skeleton)).toHaveCount(count);
    expect(await overlays(page)).toEqual([]);
    await expect(page.locator(skeleton)).toHaveCount(0, { timeout: 10_000 });
  }
  await page.goto(paths["a scene page"].path);
  await expect(page.getByRole("status").filter({ hasText: "Loading scene…" })).toBeVisible();
  await expect(page.locator(".scene-page__photo-skeleton")).toBeVisible();
  await expect(page.locator(".scene-page__figure img")).toBeVisible({ timeout: 10_000 });
});

test("the edit page never flashes a not-found message while loading", async ({ page, request }) => {
  const owner = await signUp(request, "Patient editor");
  const scene = await postScene(request, owner, "Slow to load");
  await useSession(page, owner);
  await page.addInitScript(() => {
    window.__notFoundSeen = false;
    new MutationObserver(() => {
      if (/could ?n[o']t find/i.test(document.body ? document.body.textContent : "")) {
        window.__notFoundSeen = true;
      }
    }).observe(document, { childList: true, subtree: true, characterData: true });
  });
  await page.route(API_PATTERN, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.continue().catch(() => {}); // the page may have moved on
  });
  await page.goto(`/scenes/${scene.id}/edit`);
  await expect(page.getByRole("status").filter({ hasText: "Loading scene…" })).toBeVisible();
  await expect(page.getByLabel("Title")).toHaveValue("Slow to load", { timeout: 10_000 });
  expect(await page.evaluate(() => window.__notFoundSeen)).toBe(false);

  // A scene that really doesn't exist gets the not-found page.
  await page.unroute(API_PATTERN);
  await page.goto("/scenes/000000000000000000000000/edit");
  await expect(page.locator("h1")).toHaveText("We couldn't find that scene");
});
