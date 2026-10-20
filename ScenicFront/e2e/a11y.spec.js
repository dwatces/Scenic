// axe on every route, signed out and signed in, at 390 and 1440 px (no
// serious or critical violations), and no sideways scrolling from 320 px
// up. Moderate and minor findings are attached to the report.
import { test, expect, API_URL, signUp, postScene, useSession, deleteScenes } from "./fixtures.js";
import { expectNoSeriousViolations } from "./axe.js";

let routes;
test.beforeAll(async ({ request }) => {
  const { users } = await (await request.get(`${API_URL}/users`)).json();
  const { scenes } = await (await request.get(`${API_URL}/scenes?limit=1`)).json();
  const daniel = users.find((user) => user.name === "Daniel (demo)");
  routes = ["/", "/explore", "/users", `/${daniel.id}/scenes`, `/scenes/${scenes[0].id}`];
  routes.push("/login", "/signup", "/no-such-page");
});

async function settle(page, path) {
  await page.goto(path, { waitUntil: "networkidle" });
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator(".skeleton-list, .skeleton")).toHaveCount(0);
}

for (const width of [390, 1440]) {
  test(`signed out at ${width} px: no serious or critical axe violations`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 760 ? 844 : 900 });
    const minor = {};
    for (const path of routes) {
      await settle(page, path);
      const all = await expectNoSeriousViolations(page);
      if (all.length) minor[path] = all;
    }
    await test.info().attach("moderate-and-minor.json", { body: JSON.stringify(minor, null, 2) });
  });

  test(`signed in at ${width} px: lists, owner actions, forms and the confirm dialog`, async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width, height: width < 760 ? 844 : 900 });
    const member = await signUp(request, `Checker ${width}`);
    const scenes = [await postScene(request, member, "Checked scene")];
    await useSession(page, member);
    const minor = {};
    for (const path of [
      "/",
      `/scenes/${scenes[0].id}`,
      `/scenes/${scenes[0].id}/edit`,
      "/scenes/new",
    ]) {
      await settle(page, path);
      const all = await expectNoSeriousViolations(page);
      if (all.length) minor[path] = all;
    }
    await settle(page, "/");
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expectNoSeriousViolations(page);
    await page.keyboard.press("Escape");
    await test.info().attach("moderate-and-minor.json", { body: JSON.stringify(minor, null, 2) });
    await deleteScenes(request, member, scenes);
  });
}

test("no horizontal scroll at 320, 390, 768 or 1440 px on any route", async ({ page }) => {
  const wide = [];
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of routes) {
      await settle(page, path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      if (overflow > 0) wide.push(`${path} at ${width}: ${overflow}px`);
    }
  }
  expect(wide).toEqual([]);
});

test("the owner's Edit and Delete sit on one row at 390 px", async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const member = await signUp(request, "One row");
  const scenes = [await postScene(request, member, "Row check")];
  await useSession(page, member);
  await settle(page, "/");
  const card = page.locator(".scene-card").first();
  const edit = await card.getByRole("link", { name: "Edit" }).boundingBox();
  const del = await card.getByRole("button", { name: "Delete", exact: true }).boundingBox();
  expect(Math.abs(edit.y - del.y)).toBeLessThanOrEqual(1);
  await deleteScenes(request, member, scenes);
});
