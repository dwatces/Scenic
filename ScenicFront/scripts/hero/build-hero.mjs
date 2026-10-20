// Re-encodes the landing page's four hero photos into the small AVIF and
// WebP files the hero loads (src/assets/hero/). Run by hand, never in the
// Vercel build:
//
//   cd ScenicFront/scripts/hero && npm ci && node build-hero.mjs
//
// The originals (18-megapixel JPEGs, 10.8 MB together) used to be served
// from public/assets/. They are no longer in the working tree; this script
// reads them from git history (SOURCE_REV below), so the output can always
// be rebuilt from the same bytes. Pass a folder holding Street.jpg,
// Landscape.jpg, Family.jpg and Portrait.jpg to use files on disk instead.
//
// Each photo gets two crops, picked by the hero's <picture> with a media
// query: "wide" (16:10) for landscape screens and "tall" (9:16) for phones
// held upright, so a phone isn't sent a landscape frame it mostly crops
// away. Each crop is centred on a focal point chosen by eye (the lit
// doorway, the face, the hands, the river). Every width is AVIF; one WebP
// per crop is the fallback for the few browsers without AVIF. Quality steps
// down until a file fits its byte budget, so the result is the same on
// every run.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = path.dirname(fileURLToPath(import.meta.url));
const front = path.resolve(here, "..", "..");
const outDir = path.join(front, "src", "assets", "hero");

// The last commit with the originals in ScenicFront/public/assets/.
const SOURCE_REV = "a92484bb";

const PHOTOS = [
  { name: "street", file: "Street.jpg", wide: [0.5, 0.47], tall: [0.5, 0.5] },
  { name: "landscape", file: "Landscape.jpg", wide: [0.5, 0.5], tall: [0.45, 0.5] },
  { name: "family", file: "Family.jpg", wide: [0.5, 0.5], tall: [0.47, 0.5] },
  { name: "portrait", file: "Portrait.jpg", wide: [0.45, 0.38], tall: [0.45, 0.45] },
];

// Width in px -> largest file allowed, in KB. Every hero file stays well
// under the 250 KB per-image budget (PLAN D1). `webp` is the fallback width.
const CROPS = {
  wide: { ratio: 16 / 10, budgets: { 960: 70, 1440: 130, 1920: 200 }, webp: 1440 },
  tall: { ratio: 9 / 16, budgets: { 640: 60, 960: 120, 1280: 180 }, webp: 960 },
};

const FORMATS = {
  avif: { start: 56, floor: 30, encode: (img, quality) => img.avif({ quality, effort: 6 }) },
  webp: { start: 76, floor: 40, encode: (img, quality) => img.webp({ quality, effort: 6 }) },
};

function readOriginal(file, fromDir) {
  if (fromDir) return fs.readFileSync(path.join(fromDir, file));
  return execFileSync("git", ["show", `${SOURCE_REV}:ScenicFront/public/assets/${file}`], {
    cwd: front,
    maxBuffer: 64 * 1024 * 1024,
  });
}

/** The largest rectangle of `ratio` (w / h) inside w x h, centred on the focal point. */
function cropBox(width, height, ratio, [fx, fy]) {
  const clamp = (value, max) => Math.round(Math.min(Math.max(value, 0), max));
  if (width / height > ratio) {
    const cw = Math.round(height * ratio);
    return { left: clamp(fx * width - cw / 2, width - cw), top: 0, width: cw, height };
  }
  const ch = Math.round(width / ratio);
  return { left: 0, top: clamp(fy * height - ch / 2, height - ch), width, height: ch };
}

async function encodeWithin(pipeline, format, budgetKB) {
  const { start, floor, encode } = FORMATS[format];
  for (let quality = start; quality >= floor; quality -= 4) {
    const buffer = await encode(pipeline.clone(), quality).toBuffer();
    if (buffer.length <= budgetKB * 1024 || quality - 4 < floor) return { buffer, quality };
  }
  throw new Error("unreachable");
}

const fromDir = process.argv[2] ? path.resolve(process.argv[2]) : null;
fs.mkdirSync(outDir, { recursive: true });
for (const old of fs.readdirSync(outDir)) fs.rmSync(path.join(outDir, old));

let total = 0;
for (const photo of PHOTOS) {
  // Decode once. rotate() applies any EXIF orientation; outputs carry no
  // metadata.
  const { data, info } = await sharp(readOriginal(photo.file, fromDir))
    .rotate()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const raw = { raw: { width: info.width, height: info.height, channels: info.channels } };
  for (const [crop, { ratio, budgets, webp }] of Object.entries(CROPS)) {
    const box = cropBox(info.width, info.height, ratio, photo[crop]);
    for (const [w, budgetKB] of Object.entries(budgets)) {
      const pipeline = sharp(data, raw)
        .extract(box)
        .resize({ width: Number(w) });
      const formats = Number(w) === webp ? ["avif", "webp"] : ["avif"];
      for (const format of formats) {
        const { buffer, quality } = await encodeWithin(pipeline, format, budgetKB);
        const name = `${photo.name}-${crop}-${w}.${format}`;
        fs.writeFileSync(path.join(outDir, name), buffer);
        total += buffer.length;
        const kb = (buffer.length / 1024).toFixed(1);
        const over = buffer.length > budgetKB * 1024 ? "  OVER BUDGET" : "";
        console.log(`${name.padEnd(28)} q${quality}  ${kb.padStart(6)} KB${over}`);
      }
    }
  }
}
console.log(`total ${(total / 1024).toFixed(0)} KB in ${outDir}`);
