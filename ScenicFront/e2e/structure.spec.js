// Page structure: skip link, landmarks, the footer, keyboard order to the
// landing page's call to action, and tap-target sizes at 390 px.
import { test, expect, API_URL } from "./fixtures.js";

test("the first Tab reaches the skip link, which moves focus to the page", async ({ page }) => {
  await page.goto("/explore");
  await expect(page.locator("h1")).toHaveText("Explore scenes");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to main content" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press("Enter");
  await expect(page.locator("main#main")).toBeFocused();
  expect(new URL(page.url()).pathname).toBe("/explore");
  // The next Tab goes into the page, not back to the header.
  await page.keyboard.press("Tab");
  expect(
    await page.evaluate(() => document.querySelector("main").contains(document.activeElement)),
  ).toBe(true);
});

test("one banner, a Main navigation, main and a footer on every kind of page", async ({
  page,
  request,
}) => {
  const { scenes } = await (await request.get(`${API_URL}/scenes?limit=1`)).json();
  for (const path of ["/", "/explore", "/users", `/scenes/${scenes[0].id}`, "/login", "/nope"]) {
    await page.goto(path);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.getByRole("banner")).toHaveCount(1);
    await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(1);
    await expect(page.getByRole("main")).toHaveCount(1);
    const footer = page.getByRole("contentinfo");
    await expect(footer).toHaveCount(1);
    await expect(footer).toContainText("Built by Daniel Olliver");
    await expect(footer.getByRole("link", { name: "Source code on GitHub" })).toHaveAttribute(
      "href",
      "https://github.com/dwatces/Scenic",
    );
  }
});

/** How many Tab presses from a fresh load until `name` is focused. */
async function tabsTo(page, name) {
  for (let presses = 1; presses <= 15; presses++) {
    await page.keyboard.press("Tab");
    const label = await page.evaluate(() => document.activeElement.textContent.trim());
    if (label === name) return presses;
  }
  return Infinity;
}

test("Browse scenes is 4 Tabs away at 390 px and at most 7 at 1440 px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  expect(await tabsTo(page, "Browse scenes")).toBeLessThanOrEqual(4);
  await page.keyboard.press("Tab");
  await expect(page.locator(".hero").getByRole("link", { name: "Sign up" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Pause slideshow" })).toBeFocused();

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  expect(await tabsTo(page, "Browse scenes")).toBeLessThanOrEqual(7);
});

/**
 * Visible links, buttons and fields smaller than 44 x 44 CSS px. Exempt
 * under WCAG 2.5.8: links inside a sentence (a paragraph with other text).
 * A scene card's title link covers the whole card (its ::after), so the
 * card is measured. Labels count only when they are the visible control
 * for a hidden file input.
 */
const smallTargets = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("a, button, input, select, textarea, label[for]")]
      .filter((el) => {
        const style = getComputedStyle(el);
        if (style.visibility === "hidden" || el.closest(".visually-hidden")) return false;
        if (el.matches("input[type=file]")) return false; // its <label> is the target
        if (el.tagName === "LABEL") {
          const control = document.getElementById(el.htmlFor);
          if (!control || control.type !== "file") return false;
        }
        if (el.tagName === "A") {
          const sentence = el.closest("p");
          if (sentence && sentence.textContent.trim() !== el.textContent.trim()) return false;
        }
        const target = el.closest(".scene-card__title") ? el.closest(".scene-card__inner") : el;
        const box = target.getBoundingClientRect();
        if (box.width === 0 || box.height === 0) return false;
        return box.width < 44 || box.height < 44;
      })
      .map((el) => {
        const box = el.getBoundingClientRect();
        return `${el.tagName} "${el.textContent.trim().slice(0, 30)}" ${Math.round(box.width)}x${Math.round(box.height)}`;
      }),
  );

test("no tap target under 44 x 44 px at 390 px", async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { users } = await (await request.get(`${API_URL}/users`)).json();
  const { scenes } = await (await request.get(`${API_URL}/scenes?limit=1`)).json();
  const daniel = users.find((user) => user.name === "Daniel");
  const found = {};
  for (const path of [
    "/",
    "/explore",
    "/users",
    `/${daniel.id}/scenes`,
    `/scenes/${scenes[0].id}`,
    "/login",
    "/signup",
    "/nope",
  ]) {
    await page.goto(path, { waitUntil: "networkidle" });
    const small = await smallTargets(page);
    if (small.length) found[path] = small;
  }
  expect(found).toEqual({});
});
