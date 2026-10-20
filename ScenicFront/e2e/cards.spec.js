// Scene cards always show a 3:2 photo. A portrait photo (most phone photos
// are) is cropped to fit, never stretching its card or the rest of the
// row. All against the local API.
import fs from "node:fs";
import { test, expect, API_URL, signUp, useSession, deleteScenes } from "./fixtures.js";
import { portraitPhoto } from "./generate-fixtures.js";

/** Post a JPEG as a new scene for `member`, straight to the local API. */
async function postPhoto(request, member, file, title) {
  const res = await request.post(`${API_URL}/scenes`, {
    headers: { Authorization: `Bearer ${member.token}` },
    multipart: {
      title,
      description: "A portrait photo, posted by an end-to-end test.",
      address: "Auckland",
      image: { name: "portrait.jpg", mimeType: "image/jpeg", buffer: fs.readFileSync(file) },
    },
  });
  expect(res.status()).toBe(201);
  return (await res.json()).scene;
}

/**
 * Wait until the card titled `title` has loaded its (portrait) photo. It was
 * posted without a card image, so its card URL serves the full photo.
 */
async function portraitLoaded(page, title) {
  const image = page.locator(".scene-card", { hasText: title }).locator("img");
  await expect(image).toHaveAttribute("src", /&size=card$/);
  await image.scrollIntoViewIfNeeded();
  await expect
    .poll(() => image.evaluate((img) => img.complete && img.naturalHeight > img.naturalWidth))
    .toBe(true);
}

/** Every card's photo box and card height, with the row (top) it sits in. */
const cardSizes = (page) =>
  page.locator(".scene-card").evaluateAll((cards) =>
    cards.map((card) => {
      const photo = card.querySelector(".scene-card__image").getBoundingClientRect();
      const inner = card.querySelector(".scene-card__inner").getBoundingClientRect();
      return {
        title: card.querySelector(".scene-card__title").textContent,
        width: photo.width,
        height: photo.height,
        card: inner.height,
        row: Math.round(inner.top + window.scrollY),
      };
    }),
  );

/** Each photo box is 3:2 (to the pixel) and the portrait card is no taller than its row-mates. */
async function expectThreeTwo(page, title) {
  const sizes = await cardSizes(page);
  expect(sizes.length).toBeGreaterThan(0);
  for (const size of sizes) {
    expect(Math.abs(size.height - size.width / 1.5), `${size.title} photo box`).toBeLessThan(1);
  }
  const portrait = sizes.find((size) => size.title === title);
  expect(portrait, "the portrait card is on the page").toBeTruthy();
  const rowMates = sizes.filter((size) => size.row === portrait.row && size.title !== title);
  for (const other of rowMates) {
    expect(Math.abs(other.card - portrait.card), `${other.title} card height`).toBeLessThan(1);
  }
  return sizes;
}

test("a portrait photo is cropped to 3:2 on every card grid, at 390 and 1440 px", async ({
  page,
  request,
  browser,
}) => {
  const member = await signUp(request, "Portrait poster");
  const title = `Portrait photo ${Date.now()}`;
  const scene = await postPhoto(request, member, await portraitPhoto(browser), title);

  try {
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });

      // Signed out: the landing page's Recent scenes, Explore and the member's page.
      await page.goto("/");
      await portraitLoaded(page, title);
      await expectThreeTwo(page, title);

      await page.goto("/explore");
      await portraitLoaded(page, title);
      const explore = await expectThreeTwo(page, title);
      // At 1440 px the portrait card shares its row with two others.
      if (width === 1440) {
        const portrait = explore.find((size) => size.title === title);
        expect(explore.filter((size) => size.row === portrait.row).length).toBeGreaterThan(1);
      }

      await page.goto(`/${member.userId}/scenes`);
      await portraitLoaded(page, title);
      await expectThreeTwo(page, title);
    }

    // Signed in: Your scenes, where the cards also carry Edit and Delete.
    await useSession(page, member);
    await page.goto("/");
    await expect(page.locator("h1")).toHaveText("Your scenes");
    await portraitLoaded(page, title);
    await expectThreeTwo(page, title);
  } finally {
    await deleteScenes(request, member, [scene]);
  }
});
