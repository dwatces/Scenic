// Forms: submit always enabled; an empty or invalid submit lists what to
// fix, shows each field's error linked by aria-describedby, and moves
// focus to the first field to fix. axe runs on each form empty and after
// an invalid submit.
import { test, expect, signUp, postScene, useSession } from "./fixtures.js";
import { expectNoSeriousViolations } from "./axe.js";

/** The texts that the focused field's aria-describedby points at. */
const describedBy = (page) =>
  page.evaluate(() =>
    (document.activeElement.getAttribute("aria-describedby") || "")
      .split(/\s+/)
      .filter(Boolean)
      .map((id) => {
        const el = document.getElementById(id);
        return el && el.checkVisibility() ? el.textContent.trim() : `(missing or hidden: ${id})`;
      }),
  );

async function submitEmpty(page, button, firstField, firstError, summaryCount) {
  await expectNoSeriousViolations(page);
  const submit = page.locator("form").getByRole("button", { name: button });
  await expect(submit).toBeEnabled();
  await submit.click();
  const summary = page.locator(".error-summary");
  await expect(summary).toHaveAttribute("role", "alert");
  await expect(summary.getByRole("link")).toHaveCount(summaryCount);
  await expect(page.locator(`#${firstField}`)).toBeFocused();
  await expect(page.locator(`#${firstField}`)).toHaveAttribute("aria-invalid", "true");
  expect(await describedBy(page)).toContain(firstError);
  await expectNoSeriousViolations(page);
  return summary;
}

test("log in: empty submit", async ({ page }) => {
  const posts = [];
  page.on("request", (req) => req.method() === "POST" && posts.push(req.url()));
  await page.goto("/login");
  const summary = await submitEmpty(page, "Log in", "email", "Enter a valid email address", 2);
  await expect(summary).toContainText("Enter your password");
  // A summary link takes you to its field.
  await summary.getByRole("link", { name: "Enter your password" }).click();
  await expect(page.locator("#password")).toBeFocused();
  expect(posts).toEqual([]);
  await expect(page.locator("#email")).toHaveAttribute("autocomplete", "email");
  await expect(page.locator("#password")).toHaveAttribute("autocomplete", "current-password");
});

test("sign up: empty submit, then fixing a field clears its error", async ({ page }) => {
  await page.goto("/signup");
  const summary = await submitEmpty(page, "Sign up", "name", "Enter your name", 3);
  await expect(summary).toContainText("Passwords need at least 6 characters");
  await page.locator("#name").fill("Kiri");
  await expect(summary.getByRole("link")).toHaveCount(2);
  await expect(page.locator("#name")).not.toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#password")).toHaveAttribute("autocomplete", "new-password");
  await expect(page.locator("#name")).toHaveAttribute("autocomplete", "name");
});

test("an empty field you tab past isn't flagged until you submit", async ({ page }) => {
  await page.goto("/signup");
  await page.locator("#name").focus();
  await page.keyboard.press("Tab");
  await expect(page.locator(".form-control__error")).toHaveCount(0);
  // Typing something invalid and leaving does show the error.
  await page.locator("#email").fill("not-an-email");
  await page.locator("#password").focus();
  await expect(page.locator("#email-error")).toHaveText("Enter a valid email address");
});

test("add a scene: empty submit, and the photo control by keyboard", async ({ page, request }) => {
  const member = await signUp(request, "Form filler");
  await useSession(page, member);
  await page.goto("/scenes/new");
  const summary = await submitEmpty(page, "Add scene", "title", "Enter a title", 4);
  await expect(summary).toContainText("Choose a photo");
  await expect(summary).toContainText("Enter where you took the photo");

  // The file input is reachable by Tab, named by its label, described by its hint.
  await page.locator("#title").focus();
  await page.keyboard.press("Tab");
  const file = page.locator("input[type=file]");
  await expect(file).toBeFocused();
  await expect(file).toHaveAccessibleName("Choose a photo");
  expect(await describedBy(page)).toEqual([
    "JPEG, PNG or WebP. Large photos are resized for you.",
    "Choose a photo",
  ]);
  await expect(page.locator(".image-upload__choose")).toHaveCSS("outline-style", "solid");
  await expect(page.getByLabel("Location")).toHaveAccessibleDescription(
    /Town or place, and region, e\.g\. Hahei, Coromandel/,
  );
});

test("edit a scene: clearing the title and saving lists it; Cancel sends no PATCH", async ({
  page,
  request,
}) => {
  const owner = await signUp(request, "Form editor");
  const scene = await postScene(request, owner, "Editable");
  await useSession(page, owner);
  const patches = [];
  page.on("request", (req) => req.method() === "PATCH" && patches.push(req.url()));
  await page.goto(`/scenes/${scene.id}/edit`);
  await expectNoSeriousViolations(page);
  await page.getByLabel("Title").fill("");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.locator(".error-summary")).toContainText("Enter a title");
  await expect(page.locator("#title")).toBeFocused();
  expect(await describedBy(page)).toContain("Enter a title");
  await expectNoSeriousViolations(page);
  await page.getByRole("link", { name: "Cancel" }).click();
  await expect(page).toHaveURL(`/scenes/${scene.id}`);
  expect(patches).toEqual([]);
});
