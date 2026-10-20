// Draws public/og-image.png, the 1200 x 630 card that link previews show
// (Open Graph / Twitter). Wordmark and the answer line only: no hero photo
// until the photos' licence is confirmed. Run by hand from ScenicFront:
//
//   CHROME_PATH=/usr/bin/google-chrome node scripts/og/make-og-image.mjs
//
// It uses the Playwright already in devDependencies and the self-hosted
// fonts in node_modules, so the card uses the app's own type.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const front = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const font = (pkg, file) =>
  fs
    .readFileSync(path.join(front, "node_modules", "@fontsource-variable", pkg, "files", file))
    .toString("base64");

const html = `<!doctype html>
<html><head><style>
@font-face { font-family: "SG"; font-weight: 300 700; src: url(data:font/woff2;base64,${font("space-grotesk", "space-grotesk-latin-wght-normal.woff2")}) format("woff2"); }
@font-face { font-family: "Inter"; font-weight: 100 900; src: url(data:font/woff2;base64,${font("inter", "inter-latin-wght-normal.woff2")}) format("woff2"); }
* { margin: 0; box-sizing: border-box; }
body { width: 1200px; height: 630px; background: #0f0f11; color: #f4f4f5; font-family: "Inter"; overflow: hidden; }
.card { position: relative; height: 100%; padding: 92px 96px; display: flex; flex-direction: column; justify-content: center; gap: 40px;
  background: radial-gradient(ellipse 70% 80% at 85% 20%, rgba(16,185,129,0.16), transparent 60%), #0f0f11; }
.mark { font-family: "SG"; font-weight: 700; font-size: 160px; line-height: 1; letter-spacing: -0.04em; }
.mark span { display: inline-block; padding-bottom: 10px; border-bottom: 10px solid #10b981; }
.line { font-size: 40px; line-height: 1.3; color: #d4d4d8; max-width: 900px; }
.tag { position: absolute; left: 96px; bottom: 64px; font-size: 24px; color: #a8a8b3; letter-spacing: 0.01em; }
</style></head><body><div class="card">
<div class="mark"><span>Scenic</span></div>
<p class="line">Share your photos, say where you took them, and see them on the map.</p>
<p class="tag">A full-stack demo app: React, Express and MongoDB</p>
</div></body></html>`;

const browser = await chromium.launch(
  process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
);
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);
const out = path.join(front, "public", "og-image.png");
await page.screenshot({ path: out });
await browser.close();
console.log(`wrote ${out} (${(fs.statSync(out).size / 1024).toFixed(1)} KB)`);
