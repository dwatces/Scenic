// The main user journeys, end to end through the UI against the local API
// and its in-memory database: browsing, a new member's first scene from
// sign-up to delete, and logging in after a wrong password.
import fs from "node:fs";
import { test, expect, API_URL, signUp, postScene, useSession, deleteScenes } from "./fixtures.js";
import { largePhoto } from "./generate-fixtures.js";

const header = (page) => page.locator(".main-navigation__header-nav");

test("browse: landing, a recent scene, its author, Members, another member", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  const recent = page.getByRole("region", { name: "Recent scenes" });
  const firstCard = recent.locator(".scene-card").first();
  const title = await firstCard.getByRole("heading").innerText();
  await firstCard.getByRole("heading").getByRole("link").click();

  // The scene page: its title, the photo, the place and a map of it.
  await expect(page).toHaveURL(/\/scenes\/[0-9a-f]{24}$/);
  await expect(page.locator("h1")).toHaveText(title);
  await expect(page).toHaveTitle(`${title} · Scenic`);
  await expect(page.locator(".scene-page__figure img")).toBeVisible();
  const place = await page.locator(".scene-page__place").innerText();
  const map = page.locator("iframe.map");
  await expect(map).toHaveAttribute("title", `Map of ${place}`);
  await expect(map).toHaveAttribute(
    "src",
    /^https:\/\/www\.openstreetmap\.org\/export\/embed\.html\?/,
  );

  // Its author's page lists the scene.
  const byline = page.locator(".scene-page__byline");
  const author = await byline.getByRole("link").innerText();
  await byline.getByRole("link").click();
  await expect(page.locator("h1")).toHaveText(`Scenes by ${author}`);
  await expect(page.getByRole("heading", { level: 2, name: title })).toBeVisible();

  // Back to Members, then someone else's scenes.
  await page.getByRole("link", { name: "Back to members" }).click();
  await expect(page).toHaveURL("/users");
  await expect(page.locator("h1")).toHaveText("Members");
  await page.locator(".user-item", { hasText: "Aroha" }).getByRole("link").click();
  await expect(page.locator("h1")).toHaveText("Scenes by Aroha");
  await expect(page.getByRole("heading", { level: 2, name: "Cathedral Cove" })).toBeVisible();
  await expect(page.getByText("Demo account")).toBeVisible();
});

test("a new member: sign up, post a 6 MB photo, see it, edit it, delete it", async ({
  page,
  browser,
}) => {
  const photo = await largePhoto(browser);
  expect(fs.statSync(photo).size).toBeGreaterThan(5 * 1024 * 1024);
  const title = `Rangitoto at dawn ${Date.now()}`;

  // Sign up in the form, without a profile photo.
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Hemi");
  await page.getByLabel("Email").fill(`hemi-${Date.now()}@example.com`);
  await page.getByLabel("Password").fill("a-good-password");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.locator("h1")).toHaveText("Your scenes");
  await expect(page.getByText("You haven't posted any scenes yet.")).toBeVisible();

  // Add a scene from the header, with a photo far over the API's 3 MB cap.
  await header(page).getByRole("link", { name: "Add scene" }).click();
  await expect(page.locator("h1")).toHaveText("Add a scene");
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Description").fill("The island from the beach before sunrise.");
  await page.getByLabel("Location").fill("Takapuna, Auckland");
  await page.locator("input[type=file]").setInputFiles(photo);
  await expect(page.locator(".image-upload__preview img")).toBeVisible();
  await page.getByRole("button", { name: "Add scene" }).click();

  // The new scene shows straight away.
  await expect(page).toHaveURL(/\/scenes\/[0-9a-f]{24}$/);
  await expect(page.locator("h1")).toHaveText(title);
  await expect(page.locator(".scene-page__place")).toHaveText("Takapuna, Auckland");
  await expect(page.locator(".scene-page__byline")).toContainText("Posted by Hemi");
  const sceneUrl = page.url();

  // Edit the title.
  await page.getByRole("link", { name: "Edit" }).click();
  await expect(page).toHaveURL(`${sceneUrl}/edit`);
  await expect(page.getByLabel("Title")).toHaveValue(title);
  await page.getByLabel("Title").fill(`${title} (edited)`);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page).toHaveURL(sceneUrl);
  await expect(page.locator("h1")).toHaveText(`${title} (edited)`);

  // Delete it, after a confirmation that names it.
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: `Delete “${title} (edited)”?` });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Delete scene" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.locator("h1")).toHaveText("Your scenes");
  await expect(page.getByText("You haven't posted any scenes yet.")).toBeVisible();
  await expect(page.getByRole("heading", { name: title })).toHaveCount(0);

  // The scene's address is gone for everyone.
  await page.goto(sceneUrl);
  await expect(page.locator("h1")).toHaveText("We couldn't find that scene");
});

test("log in: a wrong password and an unknown email get the same message, then back to next", async ({
  page,
  request,
}) => {
  const member = await signUp(request, "Ana");
  await page.goto("/scenes/new");
  await expect(page).toHaveURL("/login?next=%2Fscenes%2Fnew");

  const messages = [];
  for (const [email, password] of [
    [member.email, "not-the-password"],
    [`nobody-${Date.now()}@example.com`, member.password],
  ]) {
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Log in" }).click();
    const dialog = page.getByRole("dialog", { name: "Something went wrong" });
    await expect(dialog).toBeVisible();
    messages.push(await dialog.locator(".modal__content").innerText());
    await dialog.getByRole("button", { name: "OK" }).click();
    await expect(dialog).toHaveCount(0);
  }
  expect(messages).toEqual([
    "That email and password don't match an account.",
    "That email and password don't match an account.",
  ]);

  await page.getByLabel("Email").fill(member.email);
  await page.getByLabel("Password").fill(member.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL("/scenes/new");
  await expect(page.locator("h1")).toHaveText("Add a scene");
});

test("reloading the edit page while signed in stays there", async ({ page, request }) => {
  const member = await signUp(request, "Reloader");
  const scenes = [await postScene(request, member, "Reload me")];
  await useSession(page, member);
  await page.goto(`/scenes/${scenes[0].id}/edit`);
  await expect(page.getByLabel("Title")).toHaveValue("Reload me");
  await page.reload();
  await expect(page.getByLabel("Title")).toHaveValue("Reload me");
  expect(new URL(page.url()).pathname).toBe(`/scenes/${scenes[0].id}/edit`);
  await deleteScenes(request, member, scenes);
  // Gone from the API too.
  expect((await request.get(`${API_URL}/scenes/${scenes[0].id}`)).status()).toBe(404);
});
