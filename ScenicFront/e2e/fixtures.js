// Shared test fixture: every page only talks to this machine. Requests to
// any other host are aborted and recorded (Google Fonts and the
// OpenStreetMap embed just fail quietly), so a test can never reach a live
// site.
import fs from "node:fs";
import { test as base, expect } from "@playwright/test";

const LOCAL = new Set(["127.0.0.1", "localhost"]);

export const test = base.extend({
  blockedHosts: async ({ context }, use) => {
    const blocked = [];
    await context.route("**/*", (route) => {
      const { hostname } = new URL(route.request().url());
      if (LOCAL.has(hostname)) return route.continue();
      blocked.push(hostname);
      return route.abort("blockedbyclient");
    });
    await use(blocked);
  },
  // Pages always come with the guard on.
  page: async ({ page, blockedHosts }, use) => {
    void blockedHosts;
    await use(page);
  },
});

export { expect };

export const API_URL = `http://127.0.0.1:${process.env.PW_API_PORT || 7105}/api`;

export const SEED_PASSWORD = process.env.E2E_SEED_PASSWORD || "e2e-demo-password";
const PASSWORD = "e2e-member-password";

/** A real image to post (one of the demo placeholders). */
export const SAMPLE_IMAGE = fs.readFileSync(
  new URL("../../ScenicBack/assets/demo/lake-tekapo.webp", import.meta.url),
);

/** A new member, signed up through the local API (no avatar). */
export async function signUp(request, name = "E2E member") {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const res = await request.post(`${API_URL}/users/signup`, {
    multipart: { name, email, password: PASSWORD },
  });
  expect(res.status()).toBe(201);
  return { ...(await res.json()), email, password: PASSWORD, name };
}

/** Log a seeded demo member in through the local API. */
export async function logIn(request, email, password = SEED_PASSWORD) {
  const res = await request.post(`${API_URL}/users/login`, { data: { email, password } });
  expect(res.status()).toBe(200);
  return { ...(await res.json()), email, password };
}

/** A scene posted through the local API for `member`. */
export async function postScene(request, member, title = `E2E scene ${Date.now()}`) {
  const res = await request.post(`${API_URL}/scenes`, {
    headers: { Authorization: `Bearer ${member.token}` },
    multipart: {
      title,
      description: "Posted by an end-to-end test.",
      address: "Auckland",
      image: { name: "scene.webp", mimeType: "image/webp", buffer: SAMPLE_IMAGE },
    },
  });
  expect(res.status()).toBe(201);
  return (await res.json()).scene;
}

/** Put `member`'s session in the browser, as the app saves it after logging in. */
export async function useSession(page, member, expiresInMs = 3600e3) {
  if (!/^http/.test(page.url())) await page.goto("/users");
  await page.evaluate((session) => localStorage.setItem("userData", JSON.stringify(session)), {
    userId: member.userId,
    token: member.token,
    expiration: new Date(Date.now() + expiresInMs).toISOString(),
  });
}

/** Every <img> src on the page (scene photos and avatars). */
export const imageSources = (page) =>
  page.locator("main img").evaluateAll((images) => images.map((img) => img.getAttribute("src")));
