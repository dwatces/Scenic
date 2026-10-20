// Session expiry, the ?next= return path, and fresh lists after a change.
import { test, expect, SAMPLE_IMAGE, signUp, postScene, useSession } from "./fixtures.js";

const ENDED = "Your session has ended. Log in again to carry on.";

async function logInWithForm(page, member) {
  await page.getByLabel("Email").fill(member.email);
  await page.getByLabel("Password").fill(member.password);
  await page.locator("form").getByRole("button", { name: "Log in" }).click();
}

test("a 401 while posting sends the member to log in, then back to the form", async ({
  page,
  request,
}) => {
  const member = await signUp(request, "Expired");
  // The browser still holds a session, but the API no longer accepts its token.
  await useSession(page, { userId: member.userId, token: "not.a.valid-token" });
  await page.goto("/scenes/new");
  await page.getByLabel("Title").fill("Posted after the token died");
  await page.getByLabel("Description").fill("This request gets a 401.");
  await page.getByLabel("Location").fill("Raglan");
  await page.locator("input[type=file]").setInputFiles({
    name: "scene.webp",
    mimeType: "image/webp",
    buffer: SAMPLE_IMAGE,
  });
  await expect(page.locator(".image-upload__preview img")).toBeVisible();
  await page.getByRole("button", { name: "Add your Scene" }).click();

  await expect(page).toHaveURL("/login?next=%2Fscenes%2Fnew");
  await expect(page.getByText(ENDED)).toBeVisible();
  await logInWithForm(page, member);
  await expect(page).toHaveURL("/scenes/new");
  await expect(page.locator("h1")).toHaveText("Add a scene");
});

test("a 401 on a public page (deleting a scene) also ends the session and comes back", async ({
  page,
  request,
}) => {
  const member = await signUp(request, "Owner with a dead token");
  const scene = await postScene(request, member, "Still mine");
  await useSession(page, { userId: member.userId, token: "not.a.valid-token" });
  await page.goto(`/scenes/${scene.id}`);
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Delete scene" }).click();

  await expect(page).toHaveURL(`/login?next=${encodeURIComponent(`/scenes/${scene.id}`)}`);
  await expect(page.getByText(ENDED)).toBeVisible();
  await logInWithForm(page, member);
  await expect(page).toHaveURL(`/scenes/${scene.id}`);
  await expect(page.locator("h1")).toHaveText("Still mine");
});

test("a session that runs out on a members-only page says why", async ({ page, request }) => {
  const member = await signUp(request, "Timer");
  await useSession(page, member, 2500);
  await page.goto("/scenes/new");
  await expect(page.locator("h1")).toHaveText("Add a scene");
  await expect(page).toHaveURL("/login?next=%2Fscenes%2Fnew", { timeout: 8000 });
  await expect(page.getByText(ENDED)).toBeVisible();
});

test("a signed-out visit to a members-only page returns there after logging in", async ({
  page,
  request,
}) => {
  const member = await signUp(request, "Returner");
  await page.goto("/scenes/new");
  await expect(page).toHaveURL("/login?next=%2Fscenes%2Fnew");
  await expect(page.getByText(ENDED)).toHaveCount(0);
  await logInWithForm(page, member);
  await expect(page).toHaveURL("/scenes/new");
});

for (const next of ["https://example.com", "//example.com", "/\\example.com"]) {
  test(`next=${next} is ignored after logging in`, async ({ page, request, blockedHosts }) => {
    const member = await signUp(request, "Careful");
    await page.goto(`/login?next=${encodeURIComponent(next)}`);
    await logInWithForm(page, member);
    await expect(page.locator("h1")).toHaveText("Your scenes");
    const url = new URL(page.url());
    expect(url.host).toBe(`127.0.0.1:${process.env.PW_PREVIEW_PORT || 7104}`);
    expect(url.pathname).toBe("/");
    expect(blockedHosts).not.toContain("example.com");
  });
}

test("a new scene opens straight away, and Your scenes lists it fresh", async ({
  page,
  request,
}) => {
  const member = await signUp(request, "Poster");
  await useSession(page, member);
  const reads = [];
  page.on("request", (req) => req.method() === "GET" && reads.push(req.url()));

  await page.goto("/scenes/new");
  await page.getByLabel("Title").fill("Fresh off the press");
  await page.getByLabel("Description").fill("Should show at once.");
  await page.getByLabel("Location").fill("Kaikōura");
  await page.locator("input[type=file]").setInputFiles({
    name: "scene.webp",
    mimeType: "image/webp",
    buffer: SAMPLE_IMAGE,
  });
  await expect(page.locator(".image-upload__preview img")).toBeVisible();
  reads.length = 0;
  await page.getByRole("button", { name: "Add your Scene" }).click();

  await expect(page).toHaveURL(/\/scenes\/[0-9a-f]{24}$/);
  await expect(page.locator("h1")).toHaveText("Fresh off the press");
  const sceneId = page.url().split("/").pop();
  // Shown from the POST response: no GET for the scene itself.
  expect(reads.filter((url) => url.endsWith(`/api/scenes/${sceneId}`))).toEqual([]);

  await page
    .locator(".main-navigation__header-nav")
    .getByRole("link", { name: "My scenes" })
    .click();
  await expect(page.locator("h1")).toHaveText("Your scenes");
  await expect(page.getByRole("link", { name: "Fresh off the press" })).toBeVisible();
  const listRead = reads.find((url) => url.includes(`/api/scenes?`) && url.includes(member.userId));
  expect(listRead).toMatch(/[?&]fresh=\d+/);
});
