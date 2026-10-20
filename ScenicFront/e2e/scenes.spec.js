// The public scene page, image URLs instead of inline bytes, and the
// owner's edit and delete flows. All against the local API.
import {
  test,
  expect,
  API_URL,
  signUp,
  logIn,
  postScene,
  useSession,
  imageSources,
} from "./fixtures.js";

const httpOnly = (sources) => {
  expect(sources.length).toBeGreaterThan(0);
  for (const src of sources) expect(src).toMatch(/^https?:\/\//);
};

test.describe("scene page", () => {
  test("a member's card opens the scene page: one h1, the photo, a map, the author", async ({
    page,
  }) => {
    await page.goto("/users");
    await page.getByRole("link", { name: /Daniel \(demo\)/ }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Scenes by Daniel (demo)");
    httpOnly(await imageSources(page));

    await page.getByRole("link", { name: "Milford Sound" }).click();
    await expect(page).toHaveURL(/\/scenes\/[0-9a-f]{24}$/);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("h1")).toHaveText("Milford Sound");
    httpOnly(await imageSources(page));
    const photo = page.locator(".scene-page__figure img");
    await expect(photo).toHaveAttribute("src", /\/api\/scenes\/[0-9a-f]{24}\/image\?v=\d+$/);
    await expect(photo).toHaveAttribute("fetchpriority", "high");
    expect(await photo.evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true);
    await expect(page.locator("iframe[title='Map of Milford Sound, Fiordland']")).toHaveCount(1);
    await expect(page.getByRole("link", { name: "Open in OpenStreetMap" })).toHaveAttribute(
      "href",
      /openstreetmap\.org\/\?mlat=-44\.6717&mlon=167\.9256/,
    );
    await page.getByRole("link", { name: "Daniel (demo)" }).click();
    await expect(page).toHaveURL(/\/[0-9a-f]{24}\/scenes$/);
  });

  test("a signed-out visitor can open a scene link directly", async ({ page, request }) => {
    const { scenes } = await (await request.get(`${API_URL}/scenes?limit=1`)).json();
    await page.goto(`/scenes/${scenes[0].id}`);
    await expect(page.locator("h1")).toHaveText(scenes[0].title);
    await expect(page.getByRole("link", { name: "Edit" })).toHaveCount(0);
  });

  test("an unknown scene says so and links to Explore", async ({ page }) => {
    await page.goto("/scenes/000000000000000000000000");
    await expect(page.locator("h1")).toHaveText("We couldn't find that scene");
    await expect(page.getByRole("link", { name: "Explore scenes" })).toHaveAttribute(
      "href",
      "/explore",
    );
    await page.goto("/scenes/not-an-id");
    await expect(page.locator("h1")).toHaveText("We couldn't find that scene");
  });
});

test.describe("owner and non-owner", () => {
  test("the owner sees Edit; a non-owner sees none and is sent back from the edit URL", async ({
    page,
    request,
  }) => {
    const owner = await signUp(request, "Owner");
    const scene = await postScene(request, owner, "Owner's scene");

    await useSession(page, owner);
    await page.goto(`/scenes/${scene.id}`);
    await page.getByRole("link", { name: "Edit" }).click();
    await expect(page).toHaveURL(`/scenes/${scene.id}/edit`);
    await expect(page.locator("h1")).toHaveText("Edit scene");

    const other = await logIn(request, "aroha@scenic.example");
    await useSession(page, other);
    await page.goto(`/scenes/${scene.id}`);
    await expect(page.locator("h1")).toHaveText("Owner's scene");
    await expect(page.getByRole("link", { name: "Edit" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Delete", exact: true })).toHaveCount(0);
    await page.goto(`/scenes/${scene.id}/edit`);
    await expect(page).toHaveURL(`/scenes/${scene.id}`);
    await expect(page.locator("h1")).toHaveText("Owner's scene");
  });

  test("editing saves and shows the scene; Cancel sends no PATCH", async ({ page, request }) => {
    const owner = await signUp(request, "Editor");
    const scene = await postScene(request, owner, "Before the edit");
    await useSession(page, owner);

    const patches = [];
    page.on("request", (req) => req.method() === "PATCH" && patches.push(req.url()));

    await page.goto(`/scenes/${scene.id}/edit`);
    await page.getByRole("link", { name: "Cancel" }).click();
    await expect(page).toHaveURL(`/scenes/${scene.id}`);
    expect(patches).toEqual([]);

    await page.goto(`/scenes/${scene.id}/edit`);
    await page.getByLabel("Title").fill("After the edit");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page).toHaveURL(`/scenes/${scene.id}`);
    await expect(page.locator("h1")).toHaveText("After the edit");
    expect(patches).toHaveLength(1);
  });

  test("deleting from the scene page asks first, then returns to Your scenes", async ({
    page,
    request,
  }) => {
    const owner = await signUp(request, "Deleter");
    const scene = await postScene(request, owner, "Delete me");
    await useSession(page, owner);
    await page.goto(`/scenes/${scene.id}`);

    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByText("Delete “Delete me”?")).toBeVisible();
    await page.getByRole("button", { name: "Keep it" }).click();
    await expect(page.locator("h1")).toHaveText("Delete me");

    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await page.getByRole("button", { name: "Delete scene" }).click();
    await expect(page).toHaveURL("/");
    await expect(page.locator("h1")).toHaveText("Your scenes");
    await expect(page.getByText("You haven't posted any scenes yet.")).toBeVisible();
    expect((await request.get(`${API_URL}/scenes/${scene.id}`)).status()).toBe(404);
  });
});

test.describe("demo labels", () => {
  test("demo members, their scenes and the lists say they are demo content", async ({ page }) => {
    const note =
      "Sample accounts and photos show how Scenic works. Anyone can sign up and post their own.";
    await page.goto("/users");
    await expect(page.getByText(note)).toBeVisible();
    const daniel = page.locator(".user-item", { hasText: "Daniel (demo)" });
    await expect(daniel.getByText("Demo account")).toBeVisible();

    await daniel.getByRole("link").click();
    await expect(page.locator(".member-page__meta").getByText("Demo account")).toBeVisible();
    const cards = page.locator(".scene-card");
    await expect(cards).toHaveCount(2);
    for (const card of await cards.all()) await expect(card.getByText("Demo scene")).toBeVisible();

    await page.getByRole("link", { name: "Lake Tekapo" }).click();
    await expect(page.locator(".scene-page__body").getByText("Demo scene")).toBeVisible();
    await expect(page.locator(".scene-page__figure img")).toHaveAttribute(
      "alt",
      "Placeholder image for Lake Tekapo (demo content)",
    );
  });

  test("a member who signed up gets no demo label", async ({ page, request }) => {
    const member = await signUp(request, "Real member");
    const scene = await postScene(request, member, "Not a demo");
    await page.goto(`/scenes/${scene.id}`);
    await expect(page.locator("h1")).toHaveText("Not a demo");
    await expect(page.getByText("Demo scene")).toHaveCount(0);
    await page.goto(`/${member.userId}/scenes`);
    await expect(page.getByText("Demo account")).toHaveCount(0);
  });
});
