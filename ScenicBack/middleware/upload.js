const multer = require("multer");
const HttpError = require("../models/http-error");
const { sniffImageType } = require("../util/image");

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
// The client's card image is about 60 KB; this leaves room without letting a
// full-size photo pose as one.
const MAX_THUMB_BYTES = 300 * 1024;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

const IMAGE_REQUIRED = "Add a JPEG, PNG or WebP image.";
const WRONG_IMAGE_TYPE = "That file isn't a JPEG, PNG or WebP image.";
const THUMB_TOO_BIG = "Card images must be 300 KB or smaller.";

// Memory storage: serverless filesystems are read-only, and the image is
// stored base64-in-DB anyway, so the upload never needs to touch disk.
// Oversized files surface as a MulterError (413, see middleware/errors.js).
const options = (files) => ({
  limits: { fileSize: MAX_IMAGE_BYTES, files },
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (ACCEPTED_TYPES.has(file.mimetype)) return cb(null, true);
    cb(new HttpError(WRONG_IMAGE_TYPE, 422));
  },
});

const upload = multer(options(1));

/** The file sent in `field` of a scene upload, if any. */
const uploadedFile = (req, field) =>
  (req.files && req.files[field] && req.files[field][0]) || undefined;

// A scene's photo in `image` and, optionally, its card-size copy in `thumb`.
// multer's size limit covers every file alike, so the thumb's own cap is
// checked once both have arrived.
const sceneUpload = [
  multer(options(2)).fields([
    { name: "image", maxCount: 1 },
    { name: "thumb", maxCount: 1 },
  ]),
  (req, res, next) => {
    const thumb = uploadedFile(req, "thumb");
    next(thumb && thumb.size > MAX_THUMB_BYTES ? new HttpError(THUMB_TOO_BIG, 413) : undefined);
  },
];

const isEmpty = (file) => !file || !file.buffer || file.buffer.length === 0;

/** Base64 data and the type found in the bytes; 422 when they aren't a JPEG, PNG or WebP. */
function checkedImage(buffer) {
  const contentType = sniffImageType(buffer);
  if (!contentType) throw new HttpError(WRONG_IMAGE_TYPE, 422);
  return { data: buffer.toString("base64"), contentType };
}

/**
 * The uploaded image, checked by its bytes.
 * @returns {{ data: string, contentType: string }} base64 data and the sniffed type
 * @throws {HttpError} 422 when there is no file or it isn't a JPEG, PNG or WebP
 */
function readUploadedImage(file) {
  if (isEmpty(file)) throw new HttpError(IMAGE_REQUIRED, 422);
  return checkedImage(file.buffer);
}

/**
 * The optional card image, checked like the photo. Older clients don't send
 * one, and their scenes' cards use the full photo.
 * @returns {{ data: string, contentType: string } | undefined}
 * @throws {HttpError} 422 when a file was sent and it isn't a JPEG, PNG or WebP
 */
function readUploadedThumb(file) {
  return isEmpty(file) ? undefined : checkedImage(file.buffer);
}

module.exports = upload;
module.exports.sceneUpload = sceneUpload;
module.exports.uploadedFile = uploadedFile;
module.exports.readUploadedImage = readUploadedImage;
module.exports.readUploadedThumb = readUploadedThumb;
module.exports.MAX_IMAGE_BYTES = MAX_IMAGE_BYTES;
module.exports.MAX_THUMB_BYTES = MAX_THUMB_BYTES;
module.exports.THUMB_TOO_BIG = THUMB_TOO_BIG;
