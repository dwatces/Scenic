// The hero's four photos, as the responsive sources <picture> needs. The
// files are made by scripts/hero/build-hero.mjs; Vite hashes them under
// /static/ so they get the immutable cache.
const files = import.meta.glob("../../assets/hero/*.{avif,webp}", {
  eager: true,
  query: "?url",
  import: "default",
});

// Phones held upright get the tall (9:16) crop, everything else the wide
// (16:10) one. Kept in step with the crops in build-hero.mjs.
export const TALL_MEDIA = "(max-aspect-ratio: 4/5)";

/** Each photo, in rotation order, with the word the headline shows for it. */
export const HERO_FRAMES = [
  { photo: "street", word: "street scenes" },
  { photo: "landscape", word: "landscape scenes" },
  { photo: "family", word: "family memories" },
  { photo: "portrait", word: "portraits" },
].map((frame) => ({ ...frame, ...sourcesFor(frame.photo) }));

function sourcesFor(photo) {
  const crops = { wide: { avif: [], webp: null }, tall: { avif: [], webp: null } };
  for (const [path, url] of Object.entries(files)) {
    const match = path.match(/\/([a-z]+)-(wide|tall)-(\d+)\.(avif|webp)$/);
    if (!match || match[1] !== photo) continue;
    const [, , crop, width, format] = match;
    if (format === "avif") crops[crop].avif.push([Number(width), url]);
    else crops[crop].webp = { width: Number(width), url };
  }
  const srcset = (list) =>
    list
      .sort((a, b) => a[0] - b[0])
      .map(([width, url]) => `${url} ${width}w`)
      .join(", ");
  return {
    wideAvif: srcset(crops.wide.avif),
    tallAvif: srcset(crops.tall.avif),
    wideWebp: crops.wide.webp,
    tallWebp: crops.tall.webp,
  };
}
