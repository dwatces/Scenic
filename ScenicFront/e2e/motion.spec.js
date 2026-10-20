// prefers-reduced-motion: no transitions, animations, smooth scrolling or
// hover lifts anywhere (the hero's own behaviour is in hero.spec.js).
import { test, expect, API_URL, signUp, postScene, useSession, deleteScenes } from "./fixtures.js";

test.use({ reducedMotion: "reduce" });

/** Longest transition or animation duration on the matched elements, in ms. */
const longestMotion = (page, selector) =>
  page.locator(selector).evaluateAll((elements) => {
    const ms = (value) =>
      Math.max(
        ...value.split(",").map((part) => parseFloat(part) * (part.includes("ms") ? 1 : 1000)),
      );
    return Math.max(
      0,
      ...elements.map((el) => {
        const style = getComputedStyle(el);
        return Math.max(ms(style.transitionDuration), ms(style.animationDuration));
      }),
    );
  });

test("cards, buttons, dialogs and the menu don't animate; no smooth scrolling", async ({
  page,
  request,
}) => {
  await page.goto("/explore");
  await expect(page.locator(".scene-card").first()).toBeVisible();
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe(
    "auto",
  );
  for (const selector of [".scene-card__inner", ".main-header a", ".load-more .button"]) {
    expect(await longestMotion(page, selector), selector).toBeLessThanOrEqual(0.01);
  }

  // A hovered member card doesn't lift.
  await page.goto("/users");
  const card = page.locator(".user-item a").first();
  await card.hover();
  expect(await card.evaluate((el) => getComputedStyle(el).transform)).toBe("none");

  const member = await signUp(request, "Still");
  const scenes = [await postScene(request, member, "Holding still")];
  await useSession(page, member);
  await page.goto(`/scenes/${scenes[0].id}`);
  const remove = page.getByRole("button", { name: "Delete", exact: true });
  await remove.hover();
  expect(await remove.evaluate((el) => getComputedStyle(el).transform)).toBe("none");
  await remove.click();
  expect(await longestMotion(page, "dialog[open]")).toBeLessThanOrEqual(0.01);
  await page.keyboard.press("Escape");
  await deleteScenes(request, member, scenes);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".main-navigation__menu-btn").click();
  expect(await longestMotion(page, "dialog[open]")).toBeLessThanOrEqual(0.01);
});

test("loading skeletons hold still", async ({ page }) => {
  await page.route(`${API_URL}/**`, () => {}); // never answers
  await page.goto("/explore");
  await expect(page.locator(".skeleton").first()).toBeVisible();
  expect(
    await page
      .locator(".skeleton")
      .first()
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
});
