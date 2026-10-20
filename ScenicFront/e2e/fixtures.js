// Shared fixtures. Pages only ever talk to this machine: requests to any other
// host are aborted and recorded, and after each test the app may only have
// tried the hosts in `allowedHosts` (the map embed). Each run lists them in
// test-results/blocked-hosts.log.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test as base, expect } from "@playwright/test";

const LOCAL = new Set(["127.0.0.1", "localhost"]);
const LOG = fileURLToPath(new URL("../test-results/blocked-hosts.log", import.meta.url));

export const test = base.extend({
  // The scene page embeds an OpenStreetMap iframe; nothing else in the app
  // should ever reach for another host.
  allowedHosts: [["www.openstreetmap.org"], { option: true }],
  blockedHosts: async ({ context, allowedHosts }, use, testInfo) => {
    const blocked = [];
    await context.route("**/*", (route) => {
      const { hostname } = new URL(route.request().url());
      if (LOCAL.has(hostname)) return route.continue();
      blocked.push(hostname);
      return route.abort("blockedbyclient");
    });
    await use(blocked);
    const hosts = [...new Set(blocked)].sort();
    fs.mkdirSync(path.dirname(LOG), { recursive: true });
    const name = [path.basename(testInfo.file), ...testInfo.titlePath.slice(1)].join(" > ");
    fs.appendFileSync(LOG, `${name}\t${hosts.join(",")}\n`);
    const unexpected = hosts.filter((host) => !allowedHosts.includes(host));
    expect(unexpected, "requests to hosts other than this machine").toEqual([]);
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

/** Delete `member`'s scenes through the local API (tidying up after a spec). */
export async function deleteScenes(request, member, scenes) {
  for (const scene of scenes) {
    await request.delete(`${API_URL}/scenes/${scene.id}`, {
      headers: { Authorization: `Bearer ${member.token}` },
    });
  }
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
