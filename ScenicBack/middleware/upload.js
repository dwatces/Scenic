const multer = require("multer");
const HttpError = require("../models/http-error");
const { sniffImageType } = require("../util/image");

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

const IMAGE_REQUIRED = "Add a JPEG, PNG or WebP image.";
const WRONG_IMAGE_TYPE = "That file isn't a JPEG, PNG or WebP image.";

// Memory storage: serverless filesystems are read-only, and the image is
// stored base64-in-DB anyway, so the upload never needs to touch disk.
// Oversized files surface as a MulterError (413, see middleware/errors.js).
const upload = multer({
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (ACCEPTED_TYPES.has(file.mimetype)) return cb(null, true);
    cb(new HttpError(WRONG_IMAGE_TYPE, 422));
  },
});

/**
 * The uploaded image, checked by its bytes.
 * @returns {{ data: string, contentType: string }} base64 data and the sniffed type
 * @throws {HttpError} 422 when there is no file or it isn't a JPEG, PNG or WebP
 */
function readUploadedImage(file) {
  if (!file || !file.buffer || file.buffer.length === 0) {
    throw new HttpError(IMAGE_REQUIRED, 422);
  }
  const contentType = sniffImageType(file.buffer);
  if (!contentType) throw new HttpError(WRONG_IMAGE_TYPE, 422);
  return { data: file.buffer.toString("base64"), contentType };
}

module.exports = upload;
module.exports.readUploadedImage = readUploadedImage;
module.exports.MAX_IMAGE_BYTES = MAX_IMAGE_BYTES;
