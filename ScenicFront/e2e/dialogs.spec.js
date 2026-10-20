// Dialogs (delete confirmation, error message) and the menu are native
// modal <dialog>s: focus moves in, stays in, and comes back; Escape and the
// backdrop close them; the page behind can't be clicked or scrolled.
// Scenes posted here are deleted afterwards, so the landing feed other
// specs check still starts with the demo scenes.
import { test, expect, signUp, postScene, useSession, deleteScenes } from "./fixtures.js";
import { expectNoSeriousViolations } from "./axe.js";

const focusInside = (page, selector) =>
  page.evaluate((sel) => document.querySelector(sel).contains(document.activeElement), selector);

/**
 * Tab round the dialog: focus never reaches the page behind it. As with
 * any native modal dialog, after the last control focus passes to the
 * browser's own UI (document.activeElement is <body>), then comes back to
 * the dialog's first control.
 */
async function expectFocusTrapped(page, selector) {
  let insideCount = 0;
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    const where = await page.evaluate((sel) => {
      const active = document.activeElement;
      if (document.querySelector(sel).contains(active)) return "inside";
      return active === document.body || active === null
        ? "browser"
        : active.outerHTML.slice(0, 80);
    }, selector);
    expect(["inside", "browser"]).toContain(where);
    if (where === "inside") insideCount++;
  }
  expect(insideCount).toBeGreaterThan(0);
}

/** A click where the header's link sits does nothing while the dialog is open. */
async function expectHeaderBlocked(page, linkName) {
  const link = page.locator(".main-header").getByRole("link", { name: linkName, exact: true });
  const box = await link.boundingBox();
  const before = page.url();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(300);
  expect(page.url()).toBe(before);
}

let cleanups = [];
test.afterEach(async () => {
  for (const cleanup of cleanups) await cleanup();
  cleanups = [];
});

test.describe("delete confirmation", () => {
  test("focus, Tab, Escape, focus back, backdrop, page locked, axe", async ({ page, request }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const owner = await signUp(request, "Dialog owner");
    const posted = [];
    for (let i = 1; i <= 7; i++) posted.push(await postScene(request, owner, `Dialog scene ${i}`));
    cleanups.push(() => deleteScenes(request, owner, posted));
    await useSession(page, owner);
    await page.goto(`/${owner.userId}/scenes`);
    await expect(page.locator(".scene-card")).toHaveCount(7);
    await page.evaluate(() => window.scrollTo(0, 400));

    const card = page.locator(".scene-card", { hasText: "Dialog scene 7" });
    const trigger = card.getByRole("button", { name: "Delete", exact: true });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Delete “Dialog scene 7”?" });
    await expect(dialog).toBeVisible();
    expect(await focusInside(page, "dialog[open]")).toBe(true);
    await expect(page.getByRole("button", { name: "Keep it" })).toBeFocused();
    await expectFocusTrapped(page, "dialog[open]");
    await expectNoSeriousViolations(page);

    // The page behind doesn't scroll or take clicks.
    const scrollY = await page.evaluate(() => window.scrollY);
    await page.mouse.move(20, 400);
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
    await expectHeaderBlocked(page, "Explore");
    // ...and that click on the backdrop closed it.
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();

    await trigger.click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(page.locator(".scene-card")).toHaveCount(7);

    // Deleting: the card goes, focus lands on the page heading, and it's announced.
    await trigger.click();
    await page.getByRole("button", { name: "Delete scene" }).click();
    await expect(page.locator(".scene-card")).toHaveCount(6);
    await expect(page.getByRole("heading", { level: 1, name: "Your scenes" })).toBeFocused();
    await expect(
      page.getByRole("status").filter({ hasText: "Deleted “Dialog scene 7”." }),
    ).toHaveCount(1);
  });

  test("on a phone held sideways (844 x 390), every button is on screen", async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    const owner = await signUp(request, "Sideways");
    const scene = await postScene(
      request,
      owner,
      "A scene with a long title that wraps over more than one line in the dialog heading",
    );
    cleanups.push(() => deleteScenes(request, owner, [scene]));
    await useSession(page, owner);
    await page.goto(`/scenes/${scene.id}`);
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    for (const name of ["Keep it", "Delete scene"]) {
      const box = await page.getByRole("button", { name }).boundingBox();
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(390);
    }
  });
});

test("an error message is a dialog that hands focus back", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("nobody@example.com");
  await page.getByLabel("Password").fill("not-the-password");
  const submit = page.locator("form").getByRole("button", { name: "Log in" });
  await submit.click();
  const dialog = page.getByRole("dialog", { name: "Something went wrong" });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("button", { name: "OK" })).toBeFocused();
  await expectFocusTrapped(page, "dialog[open]");
  await expectNoSeriousViolations(page);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(submit).toBeFocused();
});

test.describe("the menu at 390 px", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("opens as a dialog above the header, traps focus, closes four ways", async ({ page }) => {
    await page.goto("/users");
    // While the menu is open the page behind is inert (out of the
    // accessibility tree), so the button is found by its class.
    const menu = page.locator(".main-navigation__menu-btn");
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    await menu.click();
    const drawer = page.getByRole("dialog", { name: "Menu" });
    await expect(drawer).toBeVisible();
    await expect(menu).toHaveAttribute("aria-expanded", "true");
    expect(await focusInside(page, "dialog[open]")).toBe(true);
    await expectFocusTrapped(page, "dialog[open]");
    await expectNoSeriousViolations(page);

    // Links start at the top of the panel, under its heading.
    const first = await drawer.getByRole("link").first().boundingBox();
    expect(first.y).toBeLessThan(200);

    // The header (and its logo) sits behind the menu now: a click there
    // doesn't go home. A click on the backdrop beside the panel closes it.
    await expectHeaderBlocked(page, "Scenic, home");
    await expect(drawer).toBeVisible();
    await page.mouse.click(350, 600);
    await expect(drawer).toHaveCount(0);
    await expect(menu).toBeFocused();

    await menu.click();
    await page.keyboard.press("Escape");
    await expect(drawer).toHaveCount(0);
    await expect(menu).toBeFocused();

    await menu.click();
    await page.getByRole("button", { name: "Close menu" }).click();
    await expect(drawer).toHaveCount(0);

    await menu.click();
    await drawer.getByRole("link", { name: "Explore" }).click();
    await expect(drawer).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1, name: "Explore scenes" })).toBeFocused();
  });
});

test("the menu at 375 px by keyboard alone: Enter opens it, Tab stays inside, Escape closes it and focus returns", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/users");
  const menu = page.locator(".main-navigation__menu-btn");
  for (let presses = 0; presses < 10; presses++) {
    await page.keyboard.press("Tab");
    if (await menu.evaluate((el) => el === document.activeElement)) break;
  }
  await expect(menu).toBeFocused();
  await page.keyboard.press("Enter");
  const drawer = page.getByRole("dialog", { name: "Menu" });
  await expect(drawer).toBeVisible();
  expect(await focusInside(page, "dialog[open]")).toBe(true);
  await expectFocusTrapped(page, "dialog[open]");
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
  await expect(menu).toBeFocused();
  await expect(menu).toHaveAttribute("aria-expanded", "false");
});
