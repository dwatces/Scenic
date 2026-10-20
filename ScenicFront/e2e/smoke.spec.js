import { test, expect, API_URL } from "./fixtures.js";

const SEED_PASSWORD = process.env.E2E_SEED_PASSWORD || "e2e-demo-password";

test.describe("smoke", () => {
  test("the landing page renders", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto("/");
    await expect(page.locator(".hero__lede")).toContainText("Share them on Scenic.");
    expect(errors).toEqual([]);
  });

  test("the members page lists the seeded demo members", async ({ page }) => {
    await page.goto("/users");
    // Other specs sign members up, so check the seeded two are listed.
    const names = page.locator(".user-item h2");
    await expect(names.filter({ hasText: "Aroha (demo)" })).toHaveCount(1);
    await expect(names.filter({ hasText: "Daniel (demo)" })).toHaveCount(1);
  });

  test("the drawer opens at 375 px without blanking the app", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/users");
    await page.locator(".main-navigation__menu-btn").click();
    await expect(page.locator(".side-drawer")).toBeVisible();
    await expect(page.locator(".side-drawer").getByRole("link", { name: "Members" })).toBeVisible();
    await expect(page.locator(".user-item").first()).toBeVisible();
  });

  test("reloading /scenes/new while signed in stays there", async ({ page, request }) => {
    const login = await request.post(`${API_URL}/users/login`, {
      data: { email: "daniel@scenic.example", password: SEED_PASSWORD },
    });
    expect(login.status()).toBe(200);
    const { userId, token } = await login.json();
    await page.goto("/users");
    await page.evaluate((session) => localStorage.setItem("userData", JSON.stringify(session)), {
      userId,
      token,
      expiration: new Date(Date.now() + 3600e3).toISOString(),
    });
    await page.goto("/scenes/new");
    await expect(page.getByRole("heading", { name: "Add a scene" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Add a scene" })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/scenes/new");
  });
});

test.describe("request guard", () => {
  test("a request to another host is aborted and recorded", async ({ page, blockedHosts }) => {
    await expect(page.goto("https://example.com/")).rejects.toThrow(/ERR_BLOCKED_BY_CLIENT/);
    expect(blockedHosts).toContain("example.com");
  });
});
