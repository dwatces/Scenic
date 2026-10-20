// Sign-up without an avatar, and photos prepared in the browser before they
// are uploaded: resized, re-encoded, stripped of metadata, wrong types
// refused. All against the local API.
import fs from "node:fs";
import { test, expect, API_URL, signUp, useSession } from "./fixtures.js";
import { largePhoto } from "./generate-fixtures.js";

const GPS_JPEG = new URL("./fixtures/gps-1x1.jpg", import.meta.url).pathname;
const GIF = Buffer.from("R0lGODdhAQABAIEAAChaPAAAAAAAAAAAACwAAAAAAQABAAAIBAABBAQAOw==", "base64");

/** Fill in the new-scene form, with `file` chosen as the photo. */
async function fillSceneForm(page, title, file) {
  await page.goto("/scenes/new");
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Description").fill("Checking how photos are prepared.");
  await page.getByLabel("Location").fill("Piha");
  await page.locator("input[type=file]").setInputFiles(file);
}

/** EXIF in either container: a JPEG APP1 "Exif" segment or a WebP EXIF chunk. */
function hasExif(bytes) {
  if (bytes.includes(Buffer.from("Exif\0\0", "binary"))) return true;
  if (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") {
    for (let at = 12; at + 8 <= bytes.length;) {
      const fourcc = bytes.toString("ascii", at, at + 4);
      if (fourcc === "EXIF") return true;
      at += 8 + bytes.readUInt32LE(at + 4) + (bytes.readUInt32LE(at + 4) % 2);
    }
  }
  return false;
}

test("signing up without a photo works and shows the member's initial", async ({ page }) => {
  const email = `no-photo-${Date.now()}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Moana");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("a-good-password");
  await page.getByRole("button", { name: "Sign up" }).click();

  await expect(page).toHaveURL("/");
  await expect(page.locator("h1")).toHaveText("Your scenes");
  const myScenes = page.locator(".main-navigation__header-nav").getByRole("link", {
    name: "My scenes",
  });
  await expect(myScenes.locator(".avatar__monogram")).toHaveText("M");

  await page.goto("/users");
  const card = page.locator(".user-item", { hasText: "Moana" });
  await expect(card.locator(".avatar__monogram")).toHaveText("M");
  await expect(card.locator("img")).toHaveCount(0);
});

test("the sign-up and log-in pages link to each other", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Sign up" }).last().click();
  await expect(page).toHaveURL("/signup");
  await page.getByRole("main").getByRole("link", { name: "Log in" }).click();
  await expect(page).toHaveURL("/login");
});

test("a 6 MB, 4000 x 3000 photo is resized to 1600 px and sent under 1 MB", async ({
  page,
  request,
  browser,
}) => {
  const big = await largePhoto(browser);
  expect(fs.statSync(big).size).toBeGreaterThan(5 * 1024 * 1024);
  const member = await signUp(request, "Big photo");
  await useSession(page, member);

  await fillSceneForm(page, "A very large photo", big);
  await expect(page.locator(".image-upload__preview img")).toBeVisible();
  const posted = page.waitForRequest(
    (req) => req.method() === "POST" && req.url().endsWith("/api/scenes"),
  );
  await page.getByRole("button", { name: "Add scene" }).click();
  const body = (await posted).postDataBuffer();
  expect(body.length).toBeLessThan(1024 * 1024);

  await expect(page).toHaveURL(/\/scenes\/[0-9a-f]{24}$/);
  await expect(page.locator("h1")).toHaveText("A very large photo");
  const photo = page.locator(".scene-page__figure img");
  await expect.poll(() => photo.evaluate((img) => img.naturalWidth)).toBe(1600);
  expect(await photo.evaluate((img) => img.naturalHeight)).toBe(1200);
});

test("a GIF is refused in the form and nothing is sent", async ({ page, request }) => {
  const member = await signUp(request, "GIF fan");
  await useSession(page, member);
  const posts = [];
  page.on("request", (req) => req.method() === "POST" && posts.push(req.url()));

  await fillSceneForm(page, "A GIF", { name: "moving.gif", mimeType: "image/gif", buffer: GIF });
  await expect(page.getByRole("alert")).toHaveText("Use a JPEG, PNG or WebP image.");
  // Submit stays enabled; it lists what to fix and goes to the photo control.
  await page.getByRole("button", { name: "Add scene" }).click();
  await expect(page.locator(".error-summary")).toContainText("Choose a photo");
  await expect(page.locator("input[type=file]")).toBeFocused();
  expect(posts).toEqual([]);
});

test("a photo's GPS metadata never reaches the server", async ({ page, request }) => {
  const original = fs.readFileSync(GPS_JPEG);
  expect(hasExif(original)).toBe(true); // the fixture really carries EXIF
  const member = await signUp(request, "Privacy");
  await useSession(page, member);

  await fillSceneForm(page, "Somewhere private", GPS_JPEG);
  await expect(page.locator(".image-upload__preview img")).toBeVisible();
  await page.getByRole("button", { name: "Add scene" }).click();
  await expect(page).toHaveURL(/\/scenes\/[0-9a-f]{24}$/);

  const sceneId = page.url().split("/").pop();
  const { scene } = await (await request.get(`${API_URL}/scenes/${sceneId}`)).json();
  const stored = await request.get(new URL(scene.imageUrl, API_URL).href);
  const bytes = Buffer.from(await stored.body());
  expect(stored.headers()["content-type"]).toBe("image/webp");
  expect(hasExif(bytes)).toBe(false);
});
