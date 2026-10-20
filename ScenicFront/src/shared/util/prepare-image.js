// Photos are prepared in the browser before they are uploaded: checked,
// turned upright, scaled down to 1600 px on the long edge and re-encoded
// (WebP, or JPEG where the browser can't encode WebP), aiming for 600 KB.
//
// Every image is re-encoded, even a small one. That keeps uploads well
// under the API's 3 MB limit, and it drops the photo's metadata (EXIF),
// including any GPS position: where a scene is comes from the Location the
// member types, never from coordinates hidden in the file.

export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const WRONG_TYPE = "Use a JPEG, PNG or WebP image.";
export const UNREADABLE = "We couldn't read that image. Try a different photo.";
export const MAX_EDGE = 1600;
export const TARGET_BYTES = 600 * 1024;

const WEBP_QUALITIES = [0.82, 0.72, 0.62, 0.52];
const JPEG_QUALITIES = [0.85, 0.75, 0.65, 0.55];

/** A reason the image can't be used, worded for the person choosing it. */
export class ImagePrepError extends Error {
  constructor(message) {
    super(message);
    this.name = "ImagePrepError";
  }
}

/** The size to draw at: at most MAX_EDGE on the long edge, never enlarged. */
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

/** Encode at falling qualities until the result fits TARGET_BYTES (or the lowest is reached). */
async function encode(canvas, type, qualities) {
  let blob = null;
  for (const quality of qualities) {
    blob = await toBlob(canvas, type, quality);
    if (!blob || blob.type !== type || blob.size <= TARGET_BYTES) return blob;
  }
  return blob;
}

const renamed = (name, extension) =>
  `${(name || "photo").replace(/\.[^.]+$/, "") || "photo"}.${extension}`;

/**
 * Prepare a chosen photo for upload.
 * @param {File} file
 * @param {{ decode?: (file: File) => Promise<ImageBitmap>, makeCanvas?: () => HTMLCanvasElement }} [deps]
 *   browser APIs, replaceable in tests
 * @returns {Promise<File>} a WebP or JPEG file, at most 1600 px on its long edge
 * @throws {ImagePrepError} for a type other than JPEG, PNG or WebP, or a file that can't be decoded
 */
export async function prepareImage(file, deps = {}) {
  const { decode, makeCanvas } = { ...browser, ...deps };
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
  const webp = await encode(canvas, "image/webp", WEBP_QUALITIES);
  if (webp && webp.type === "image/webp") {
    return new File([webp], renamed(file.name, "webp"), { type: "image/webp" });
  }

  // JPEG has no transparency: paint transparent areas white, not black.
  const flat = makeCanvas();
  flat.width = width;
  flat.height = height;
  const context = flat.getContext("2d");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, width, height);
  context.drawImage(canvas, 0, 0);
  const jpeg = await encode(flat, "image/jpeg", JPEG_QUALITIES);
  if (!jpeg) throw new ImagePrepError(UNREADABLE);
  return new File([jpeg], renamed(file.name, "jpg"), { type: "image/jpeg" });
}
