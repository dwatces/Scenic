// Photos are prepared in the browser before upload: checked, turned upright,
// scaled down and re-encoded as WebP (JPEG where the browser can't encode
// WebP). Every image is re-encoded, even a small one: that keeps uploads under
// the API's 3 MB limit and strips EXIF metadata, including any GPS position.
// A scene's photo also gets a small card copy, so scene cards never download
// the full photo.

export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const WRONG_TYPE = "Use a JPEG, PNG or WebP image.";
export const UNREADABLE = "We couldn't read that image. Try a different photo.";
export const MAX_EDGE = 1600;
export const TARGET_BYTES = 600 * 1024;
export const CARD_EDGE = 640;
export const CARD_TARGET_BYTES = 60 * 1024;
// The API refuses a larger card image, so one this big is left out instead.
export const CARD_MAX_BYTES = 300 * 1024;

const QUALITIES = {
  "image/webp": { photo: [0.82, 0.72, 0.62, 0.52], card: [0.72, 0.62, 0.52, 0.42] },
  "image/jpeg": { photo: [0.85, 0.75, 0.65, 0.55], card: [0.75, 0.65, 0.55, 0.45] },
};

/** A reason the image can't be used, worded for the person choosing it. */
export class ImagePrepError extends Error {
  constructor(message) {
    super(message);
    this.name = "ImagePrepError";
  }
}

/** The size to draw at: at most `maxEdge` on the long edge, never enlarged. */
export function fitWithin(width, height, maxEdge = MAX_EDGE) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

const browser = {
  decode: (file) => createImageBitmap(file, { imageOrientation: "from-image" }),
  makeCanvas: () => document.createElement("canvas"),
};

const toBlob = (canvas, type, quality) =>
  new Promise((resolve) => canvas.toBlob(resolve, type, quality));

/** Encode at falling qualities until the result fits `targetBytes` (or the lowest is reached). */
async function encode(canvas, type, qualities, targetBytes) {
  let blob = null;
  for (const quality of qualities) {
    blob = await toBlob(canvas, type, quality);
    if (!blob || blob.type !== type || blob.size <= targetBytes) return blob;
  }
  return blob;
}

const EXTENSIONS = { "image/webp": "webp", "image/jpeg": "jpg" };

const renamed = (name, type, suffix = "") =>
  `${(name || "photo").replace(/\.[^.]+$/, "") || "photo"}${suffix}.${EXTENSIONS[type]}`;

/** The card copy, drawn from the prepared photo's canvas and encoded as the same type. */
async function makeCard(source, type, name, makeCanvas) {
  const { width, height } = fitWithin(source.width, source.height, CARD_EDGE);
  const canvas = makeCanvas();
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, width, height);
  const blob = await encode(canvas, type, QUALITIES[type].card, CARD_TARGET_BYTES);
  // Without a card image the scene still posts; its cards use the photo.
  if (!blob || blob.type !== type || blob.size > CARD_MAX_BYTES) return null;
  return new File([blob], renamed(name, type, "-card"), { type });
}

/**
 * Prepare a chosen photo for upload.
 * @param {File} file
 * @param {{ card?: boolean, decode?: (file: File) => Promise<ImageBitmap>, makeCanvas?: () => HTMLCanvasElement }} [options]
 *   `card: true` also makes the card copy; decode and makeCanvas are browser APIs, replaceable in tests
 * @returns {Promise<File | { image: File, thumb: File | null }>} a WebP or JPEG file, at most
 *   1600 px on its long edge; with `card`, that file and a copy at most 640 px on its long edge
 *   (null if the browser couldn't make one)
 * @throws {ImagePrepError} for a type other than JPEG, PNG or WebP, or a file that can't be decoded
 */
export async function prepareImage(file, options = {}) {
  const { card = false, decode, makeCanvas } = { ...browser, ...options };
  if (!file || !ACCEPTED_TYPES.includes(file.type)) throw new ImagePrepError(WRONG_TYPE);

  let bitmap;
  try {
    bitmap = await decode(file);
  } catch {
    throw new ImagePrepError(UNREADABLE);
  }

  const { width, height } = fitWithin(bitmap.width, bitmap.height);
  const canvas = makeCanvas();
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);
  if (typeof bitmap.close === "function") bitmap.close();

  // Safari's toBlob silently returns a PNG when asked for WebP, so check
  // what came back before trusting it.
  let source = canvas;
  let type = "image/webp";
  let blob = await encode(canvas, type, QUALITIES[type].photo, TARGET_BYTES);
  if (!blob || blob.type !== type) {
    // JPEG has no transparency: paint transparent areas white, not black.
    source = makeCanvas();
    source.width = width;
    source.height = height;
    const context = source.getContext("2d");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, width, height);
    context.drawImage(canvas, 0, 0);
    type = "image/jpeg";
    blob = await encode(source, type, QUALITIES[type].photo, TARGET_BYTES);
    if (!blob) throw new ImagePrepError(UNREADABLE);
  }

  const image = new File([blob], renamed(file.name, type), { type });
  if (!card) return image;
  return { image, thumb: await makeCard(source, type, file.name, makeCanvas) };
}
