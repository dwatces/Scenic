// axe on every route, signed out and signed in, at 390 and 1440 px (no
// serious or critical violations), and no sideways scrolling from 320 px
// up. Moderate and minor findings are attached to the report.
import { test, expect, API_URL, signUp, postScene, useSession, deleteScenes } from "./fixtures.js";
import { expectNoSeriousViolations } from "./axe.js";

let routes;
test.beforeAll(async ({ request }) => {
  const { users } = await (await request.get(`${API_URL}/users`)).json();
  const { scenes } = await (await request.get(`${API_URL}/scenes?limit=1`)).json();
  const daniel = users.find((user) => user.name === "Daniel");
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

/** Press Tab until the focused element matches `test` (at most `max` presses); returns the count. */
async function tabUntil(page, test, max = 40) {
  for (let presses = 1; presses <= max; presses++) {
    await page.keyboard.press("Tab");
    if (await page.evaluate(test)) return presses;
  }
  throw new Error(`Never reached the element after ${max} Tabs`);
}

/**
 * The focused element shows a focus indicator: an outline of 2 px or more
 * or a ring (box-shadow), on itself or on the card it sits in (a card's
 * title link outlines the whole card).
 */
const focusVisible = (page) =>
  page.evaluate(() => {
    const shows = (el) => {
      const style = getComputedStyle(el);
      const outline = style.outlineStyle !== "none" && parseFloat(style.outlineWidth) >= 2;
      return outline || style.boxShadow !== "none";
    };
    const el = document.activeElement;
    const card = el.closest(".scene-card__inner");
    return shows(el) || Boolean(card && shows(card));
  });

test("keyboard only: from the landing page to a scene and its map, with focus always visible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await tabUntil(page, () => document.activeElement.textContent.trim() === "Browse scenes", 10);
  expect(await focusVisible(page)).toBe(true);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL("/explore");
  await expect(page.getByRole("heading", { level: 1, name: "Explore scenes" })).toBeFocused();

  // The first card's title link, then Enter.
  await tabUntil(page, () => Boolean(document.activeElement.closest(".scene-card__title")));
  expect(await focusVisible(page)).toBe(true);
  const title = await page.evaluate(() => document.activeElement.textContent);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeFocused();

  // On to the map: the embed has a name, and the link to the full map is reachable.
  await expect(page.locator("iframe.map")).toHaveAttribute("title", /^Map of /);
  await tabUntil(page, () => document.activeElement.textContent.trim() === "Open in OpenStreetMap");
  const link = page.getByRole("link", { name: "Open in OpenStreetMap" });
  await expect(link).toBeFocused();
  await expect(link).toBeInViewport();
  expect(await focusVisible(page)).toBe(true);
  await expect(link).toHaveAttribute("href", /^https:\/\/www\.openstreetmap\.org\/\?mlat=/);
});

/** Submit the form on `path` with its required field(s) empty, so every error shows. */
async function showFormErrors(page, { path, button, clear }) {
  await settle(page, path);
  if (clear) await page.locator(clear).fill("");
  await page.locator("form").getByRole("button", { name: button }).click();
  await expect(page.locator(".error-summary")).toBeVisible();
}

test("every form in its error state: no serious axe violations at 390 and 1440 px, no sideways scroll at 320 px", async ({
  page,
  request,
}) => {
  const member = await signUp(request, "Error states");
  const scenes = [await postScene(request, member, "Error state check")];
  const signedOut = [
    { path: "/login", button: "Log in" },
    { path: "/signup", button: "Sign up" },
  ];
  const signedIn = [
    { path: "/scenes/new", button: "Add scene" },
    { path: `/scenes/${scenes[0].id}/edit`, button: "Save changes", clear: "#title" },
  ];
  const wide = [];
  const check = async (forms) => {
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: width < 760 ? 844 : 900 });
      for (const form of forms) {
        await showFormErrors(page, form);
        if (width === 320) {
          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
          );
          if (overflow > 0) wide.push(`${form.path} at 320: ${overflow}px`);
        } else {
          await expectNoSeriousViolations(page);
        }
      }
    }
  };
  await check(signedOut);
  await useSession(page, member);
  await check(signedIn);
  expect(wide).toEqual([]);
  await deleteScenes(request, member, scenes);
});

test("signed in: no sideways scroll at 320 px, and no tap target under 44 x 44 px at 390 px", async ({
  page,
  request,
}) => {
  const member = await signUp(request, "Signed-in layout");
  const scenes = [await postScene(request, member, "A scene with a fairly long title to wrap")];
  await useSession(page, member);
  const paths = ["/", `/scenes/${scenes[0].id}`, `/scenes/${scenes[0].id}/edit`, "/scenes/new"];
  const wide = [];
  const small = {};
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    for (const path of paths) {
      await settle(page, path);
      if (width === 320) {
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        if (overflow > 0) wide.push(`${path} at 320: ${overflow}px`);
      } else {
        const found = await page.evaluate(() =>
          [...document.querySelectorAll("main a, main button, main input, main textarea")]
            .filter((el) => {
              if (el.matches("input[type=file]") || el.closest(".visually-hidden")) return false;
              if (el.tagName === "A") {
                const sentence = el.closest("p");
                if (sentence && sentence.textContent.trim() !== el.textContent.trim()) return false;
              }
              const target = el.closest(".scene-card__title")
                ? el.closest(".scene-card__inner")
                : el;
              const box = target.getBoundingClientRect();
              return box.width > 0 && box.height > 0 && (box.width < 44 || box.height < 44);
            })
            .map((el) => `${el.tagName} "${el.textContent.trim().slice(0, 30)}"`),
        );
        if (found.length) small[path] = found;
      }
    }
  }
  expect(wide).toEqual([]);
  expect(small).toEqual({});
  await deleteScenes(request, member, scenes);
});
