// Head metadata, self-hosted fonts and the manifest.
import { test, expect } from "./fixtures.js";

test("description, Open Graph and Twitter tags, theme colour, NZ English", async ({ page }) => {
  await page.goto("/");
  const meta = (selector) => page.locator(`head ${selector}`).getAttribute("content");
  await expect(page.locator("head meta[name=description]")).toHaveCount(1);
  expect(await meta("meta[name=description]")).toMatch(/^Scenic: share photos of places you love/);
  expect(await meta("meta[property='og:title']")).toBeTruthy();
  expect(await meta("meta[property='og:description']")).toBeTruthy();
  expect(await meta("meta[property='og:image']")).toMatch(/^https:\/\/[^%]+\/og-image\.png$/);
  expect(await meta("meta[name='twitter:card']")).toBe("summary_large_image");
  expect(await meta("meta[name=theme-color]")).toBe("#0f0f11");
  expect(await page.locator("html").getAttribute("lang")).toBe("en-NZ");

  // The share card itself is served (locally) as a 1200 x 630 PNG.
  const card = await page.request.get("/og-image.png");
  expect(card.headers()["content-type"]).toBe("image/png");
  const png = await card.body();
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
});

test("fonts are self-hosted: no Google Fonts, no Nunito, both families load", async ({
  page,
  blockedHosts,
}) => {
  const fontRequests = [];
  page.on("request", (req) => req.resourceType() === "font" && fontRequests.push(req.url()));
  await page.goto("/users", { waitUntil: "networkidle" });
  const loaded = await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family);
  });
  expect(new Set(loaded)).toEqual(new Set(["Inter Variable", "Space Grotesk Variable"]));
  expect(blockedHosts.filter((host) => /fonts\.(googleapis|gstatic)\.com/.test(host))).toEqual([]);
  expect(fontRequests.length).toBeGreaterThan(0);
  for (const url of fontRequests) {
    expect(new URL(url).hostname).toBe("127.0.0.1");
    expect(url).not.toMatch(/nunito/i);
    expect(url).toMatch(/\/static\/.+\.woff2$/);
  }
});

test("the manifest is requested from the root on deep pages and is JSON", async ({
  page,
  request,
}) => {
  const manifests = [];
  page.on(
    "request",
    (req) => /manifest/.test(req.url()) && manifests.push(new URL(req.url()).pathname),
  );
  const { scenes } = await (
    await request.get(`http://127.0.0.1:${process.env.PW_API_PORT || 7105}/api/scenes?limit=1`)
  ).json();
  await page.goto(`/scenes/${scenes[0].id}`);
  await expect(page.locator("head link[rel=manifest]")).toHaveAttribute("href", "/manifest.json");
  const res = await page.request.get("/manifest.json");
  expect(res.headers()["content-type"]).toMatch(/json/);
  const manifest = await res.json();
  expect(manifest).toMatchObject({ name: "Scenic", short_name: "Scenic", start_url: "/" });
  expect(manifest.background_color).toBe("#0f0f11");
  for (const icon of manifest.icons) expect(icon.src).toMatch(/^\//);
  expect(manifests.every((path) => path === "/manifest.json")).toBe(true);
});
