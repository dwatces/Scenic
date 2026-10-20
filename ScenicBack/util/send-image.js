// Stored images are base64 strings in MongoDB. They are served as real image
// responses, so browsers can lazy-load, cache and prioritise them, and list
// responses never carry the bytes.
const crypto = require("crypto");
const HttpError = require("../models/http-error");
const { sniffImageType } = require("./image");

const IMAGE_NOT_FOUND = "We couldn't find that image.";

// An image never changes for a given id (and its URL carries a version), so
// browsers keep it for a year. The CDN keeps it for a day only, so a deleted
// scene's photo stops being served from the edge within a day.
const BROWSER_CACHE = "public, max-age=31536000, immutable";
const CDN_CACHE = "max-age=86400";

/**
 * Send a stored image as bytes.
 *
 * The Content-Type comes from the bytes, never from the stored label: rows
 * written before uploads were checked may hold anything. Bytes that aren't a
 * JPEG, PNG or WebP are not served at all. The strong ETag is a hash of the
 * stored string; Express answers a matching If-None-Match with a 304 that
 * keeps these caching headers.
 *
 * @param {import("express").Response} res
 * @param {{ _id: unknown, image?: { data?: string } }} doc a scene or user (document or demo)
 * @throws {HttpError} 404 when there is no image, or it isn't a JPEG, PNG or WebP
 */
function sendStoredImage(res, doc) {
  const data = doc.image && doc.image.data;
  if (typeof data !== "string" || data.length === 0) throw new HttpError(IMAGE_NOT_FOUND, 404);

  const bytes = Buffer.from(data, "base64");
  const type = sniffImageType(bytes);
  if (!type) {
    console.warn(`Not serving the stored image of ${doc._id}: it isn't a JPEG, PNG or WebP.`);
    throw new HttpError(IMAGE_NOT_FOUND, 404);
  }

  res.set({
    "Content-Type": type,
    ETag: `"${crypto.createHash("sha1").update(data).digest("base64url")}"`,
    "Cache-Control": BROWSER_CACHE,
    "CDN-Cache-Control": CDN_CACHE,
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
  });
  res.send(bytes);
}

module.exports = { sendStoredImage, IMAGE_NOT_FOUND, BROWSER_CACHE, CDN_CACHE };
