// Unknown URLs, page titles and focus after navigating.
import { test, expect, API_URL, signUp, postScene, useSession } from "./fixtures.js";

async function expectNotFound(page) {
  await expect(page.locator("h1")).toHaveText("Page not found");
  await expect(page).toHaveTitle("Page not found · Scenic");
  await expect(page.getByRole("main").getByRole("link", { name: "Home" })).toHaveAttribute(
    "href",
    "/",
  );
  await expect(
    page.getByRole("main").getByRole("link", { name: "Explore scenes" }),
  ).toHaveAttribute("href", "/explore");
}

test("an unknown URL shows Page not found, signed out and signed in", async ({ page, request }) => {
  await page.goto("/no-such-page");
  await expectNotFound(page);
  expect(new URL(page.url()).pathname).toBe("/no-such-page");

  const member = await signUp(request, "Wanderer");
  await useSession(page, member);
  await page.goto("/no/such/page");
  await expectNotFound(page);
});

test("/landing goes home", async ({ page, request }) => {
  await page.goto("/landing");
  await expect(page).toHaveURL("/");
  const member = await signUp(request, "Home again");
  await useSession(page, member);
  await page.goto("/landing");
  await expect(page).toHaveURL("/");
  await expect(page.locator("h1")).toHaveText("Your scenes");
});

test("every route has its own title", async ({ page, request }) => {
  const { users } = await (await request.get(`${API_URL}/users`)).json();
  const daniel = users.find((user) => user.name === "Daniel (demo)");
  const member = await signUp(request, "Titled");
  const scene = await postScene(request, member, "A titled scene");

  const titles = {};
  const visit = async (path, expected) => {
    await page.goto(path);
    await expect(page).toHaveTitle(expected);
    titles[path] = await page.title();
  };

  await visit("/", "Scenic: share photos of the places you love");
  await visit("/explore", "Explore · Scenic");
  await visit("/users", "Members · Scenic");
  await visit(`/${daniel.id}/scenes`, "Scenes by Daniel (demo) · Scenic");
  await visit(`/scenes/${scene.id}`, "A titled scene · Scenic");
  await visit("/scenes/000000000000000000000000", "Scene not found · Scenic");
  await visit("/000000000000000000000000/scenes", "Member not found · Scenic");
  await visit("/login", "Log in · Scenic");
  await visit("/signup", "Sign up · Scenic");
  await visit("/nowhere", "Page not found · Scenic");

  await useSession(page, member);
  await visit("/scenes/new", "Add a scene · Scenic");
  await visit(`/scenes/${scene.id}/edit`, "Edit A titled scene · Scenic");
  titles["/ (signed in)"] = await (async () => {
    await page.goto("/");
    await expect(page).toHaveTitle("Your scenes · Scenic");
    return page.title();
  })();

  const values = Object.values(titles);
  expect(new Set(values).size).toBe(values.length);
});

test("after following a link, focus is on the new page's heading", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  const nav = page.locator(".main-navigation__header-nav");
  for (const [link, heading] of [
    ["Explore", "Explore scenes"],
    ["Members", "Members"],
    ["Log in", "Log in"],
  ]) {
    await nav.getByRole("link", { name: link }).click();
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeFocused();
  }
  // A first load leaves focus alone.
  await page.goto("/explore");
  await expect(page.locator("h1")).toHaveText("Explore scenes");
  expect(await page.evaluate(() => document.activeElement.tagName)).toBe("BODY");
});
