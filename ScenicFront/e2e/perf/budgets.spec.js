// Payload and layout budgets on a throttled phone connection (150 ms round
// trip, 1.6 Mbps down, 750 kbps up, 4x slower CPU, no cache), against a
// production build and the local API. Bytes, image sizes, hero requests,
// layout shift and bundle size are gated; FCP and LCP are only reported
// (test-results/perf/results.jsonl), because timings vary with machine load.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { test, expect, API_URL } from "../fixtures.js";

const KB = 1024;
const BUILD = fileURLToPath(new URL("../../build/static/", import.meta.url));
const RESULTS = fileURLToPath(new URL("../../test-results/perf/results.jsonl", import.meta.url));
const HERO = /\/static\/(street|landscape|family|portrait)-(wide|tall)-\d+-[\w-]+\.(avif|webp)$/;

const PHONE = {
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
};
const DESKTOP = { viewport: { width: 1440, height: 900 }, isMobile: false, deviceScaleFactor: 1 };

/** Load `url` throttled and cold; returns bytes, images, hero requests, CLS and timings. */
async function measure(page, url, { settleMs = 2000 } = {}) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });

  const requests = new Map();
  const finished = [];
  let navStart = null;
  cdp.on("Network.requestWillBeSent", (e) => {
    requests.set(e.requestId, { url: e.request.url, type: e.type });
    if (navStart === null && e.type === "Document") navStart = e.timestamp;
  });
  // Only this machine's responses count. The guard blocks every other host,
  // and Chrome then reports its own error page (about 180 KB, for the map
  // embed's frame) under the blocked request's id.
  cdp.on("Network.loadingFinished", (e) => {
    const request = requests.get(e.requestId);
    if (!request || !/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(request.url)) return;
    finished.push({ ...request, bytes: e.encodedDataLength, at: e.timestamp });
  });

  await page.addInitScript(() => {
    window.__cls = 0;
    window.__shifts = [];
    window.__lcp = null;
    const describe = (node) =>
      node ? `${node.nodeName.toLowerCase()}.${String(node.className || "").split(" ")[0]}` : "?";
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.hadRecentInput) continue;
        window.__cls += entry.value;
        window.__shifts.push({
          at: Math.round(entry.startTime),
          value: Number(entry.value.toFixed(4)),
          sources: (entry.sources || []).map((source) => describe(source.node)),
        });
      }
    }).observe({ type: "layout-shift", buffered: true });
    new PerformanceObserver((list) => {
      const last = list.getEntries().at(-1);
      if (last) window.__lcp = Math.round(last.startTime);
    }).observe({ type: "largest-contentful-paint", buffered: true });
  });
  await page.goto(url, { waitUntil: "load", timeout: 90_000 });
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(settleMs);

  const timings = await page.evaluate(() => {
    const fcp = performance.getEntriesByName("first-contentful-paint")[0];
    return {
      fcp: fcp ? Math.round(fcp.startTime) : null,
      lcp: window.__lcp,
      cls: window.__cls,
      shifts: window.__shifts,
    };
  });
  await cdp.detach();
  const sum = (list) => list.reduce((total, item) => total + item.bytes, 0);
  const images = finished.filter((item) => item.type === "Image");
  return {
    ...timings,
    cls: Number(timings.cls.toFixed(4)),
    totalBytes: sum(finished),
    bytesIn10s: sum(finished.filter((item) => navStart !== null && item.at - navStart <= 10)),
    largestImage: images.reduce((largest, item) => (item.bytes > largest.bytes ? item : largest), {
      bytes: 0,
      url: null,
    }),
    heroRequests: finished.filter((item) => HERO.test(new URL(item.url).pathname)).length,
  };
}

function record(name, width, result) {
  fs.mkdirSync(path.dirname(RESULTS), { recursive: true });
  const { largestImage, ...rest } = result;
  const line = {
    name,
    width,
    ...rest,
    largestImageKB: Number((largestImage.bytes / KB).toFixed(1)),
    largestImage: largestImage.url && new URL(largestImage.url).pathname,
  };
  fs.appendFileSync(RESULTS, `${JSON.stringify(line)}\n`);
  return line;
}

let paths;
test.beforeAll(async ({ request }) => {
  const { users } = await (await request.get(`${API_URL}/users`)).json();
  const { scenes } = await (await request.get(`${API_URL}/scenes?limit=1`)).json();
  const daniel = users.find((user) => user.name === "Daniel (demo)");
  paths = {
    Explore: "/explore",
    Members: "/users",
    "a member page": `/${daniel.id}/scenes`,
    "a scene page": `/scenes/${scenes[0].id}`,
    "Log in": "/login",
  };
});

test.describe("phone, 390 px", () => {
  test.use(PHONE);

  test("landing: at most 800 KB in the first 10 s, images 250 KB or less, CLS 0.02 or less", async ({
    page,
  }) => {
    const result = record("Landing", 390, await measure(page, "/", { settleMs: 10_000 }));
    expect(result.bytesIn10s).toBeLessThanOrEqual(800 * KB);
    expect(result.largestImageKB).toBeLessThanOrEqual(250);
    expect(result.heroRequests).toBeGreaterThan(0);
    expect(result.cls).toBeLessThanOrEqual(0.02);
  });

  for (const name of ["Explore", "Members", "a member page", "a scene page", "Log in"]) {
    // Layout shift 0.001 or less, not exactly 0: when the web fonts swap in,
    // Chrome still reports a 0.0002 shift on some headings even though the
    // metric-matched fallback fonts (index.css) keep every box the same size.
    // Without those fallbacks Explore measured 0.024 and Members 0.020.
    test(`${name}: no hero photo, images 250 KB or less, layout shift 0.001 or less`, async ({
      page,
    }) => {
      const result = record(name, 390, await measure(page, paths[name]));
      expect(result.heroRequests).toBe(0);
      expect(result.largestImageKB).toBeLessThanOrEqual(250);
      expect(result.cls).toBeLessThanOrEqual(0.001);
    });
  }
});

test.describe("desktop, 1440 px", () => {
  test.use(DESKTOP);

  test("landing: at most 1.2 MB in the first 10 s, images 250 KB or less, CLS 0.02 or less", async ({
    page,
  }) => {
    const result = record("Landing", 1440, await measure(page, "/", { settleMs: 10_000 }));
    expect(result.bytesIn10s).toBeLessThanOrEqual(1.2 * 1024 * KB);
    expect(result.largestImageKB).toBeLessThanOrEqual(250);
    expect(result.cls).toBeLessThanOrEqual(0.02);
  });
});

test("the feed: 10 scenes in 20 KB of JSON or less, with no image bytes", async ({ request }) => {
  const res = await request.get(`${API_URL}/scenes?limit=10`);
  const body = await res.body();
  const { scenes } = JSON.parse(body.toString());
  expect(scenes).toHaveLength(10);
  expect(body.length).toBeLessThanOrEqual(20 * KB);
  expect(body.toString()).not.toMatch(/base64|"data":/);
  fs.mkdirSync(path.dirname(RESULTS), { recursive: true });
  fs.appendFileSync(
    RESULTS,
    `${JSON.stringify({ name: "Feed JSON, 10 scenes", bytes: body.length })}\n`,
  );
});

test("the client's JavaScript is 110 KB or less gzipped, all files together", () => {
  const files = fs.readdirSync(BUILD).filter((file) => file.endsWith(".js"));
  expect(files.length).toBeGreaterThan(0);
  const gzipped = files.reduce(
    (total, file) => total + zlib.gzipSync(fs.readFileSync(path.join(BUILD, file))).length,
    0,
  );
  fs.mkdirSync(path.dirname(RESULTS), { recursive: true });
  fs.appendFileSync(
    RESULTS,
    `${JSON.stringify({ name: "JavaScript, gzip", files: files.length, bytes: gzipped })}\n`,
  );
  expect(gzipped).toBeLessThanOrEqual(110 * KB);
});
