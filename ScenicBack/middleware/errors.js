// The API's error responses: JSON with a `message`, a status that comes only
// from known sources, and never cached by the CDN.
const HttpError = require("../models/http-error");

const GENERIC_MESSAGE = "Something went wrong. Please try again.";
const DUPLICATE_EMAIL = "An account with this email already exists.";

/** Expected errors as an HttpError; null for anything else. */
function knownError(err) {
  if (err instanceof HttpError) return err;
  if (!err) return null;
  if (err.name === "MulterError") {
    return err.code === "LIMIT_FILE_SIZE"
      ? new HttpError("Images must be 3 MB or smaller.", 413)
      : new HttpError("Send one JPEG, PNG or WebP image in the image field.", 422);
  }
  // body-parser (express.json)
  if (err.type === "entity.too.large") {
    return new HttpError("That request is too large.", 413);
  }
  if (err.type === "entity.parse.failed" || (err.type && err.status === 400)) {
    return new HttpError("We couldn't read that request.", 400);
  }
  if (err.type && err.status === 415) {
    return new HttpError("We couldn't read that request.", 415);
  }
  // MongoDB duplicate key: only users.email is unique
  if (err.code === 11000) return new HttpError(DUPLICATE_EMAIL, 422);
  return null;
}

/**
 * Every 4xx and 5xx response is `Cache-Control: no-store`, whichever code
 * path sends it (error handler, demo gate, rate limiter), so the CDN never
 * keeps an error. 2xx and 304 keep the read caching set in app.js.
 */
function noStoreOnErrors(req, res, next) {
  const writeHead = res.writeHead;
  res.writeHead = function writeHeadNoStoreOnErrors(statusCode, ...rest) {
    if (statusCode >= 400) this.setHeader("Cache-Control", "no-store");
    return writeHead.call(this, statusCode, ...rest);
  };
  next();
}

function notFound(req, res, next) {
  next(new HttpError("That API route doesn't exist.", 404));
}

// Express recognises an error handler by its four parameters.
function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  const known = knownError(err);
  if (known) return res.status(known.code).json({ message: known.message });
  console.error(err);
  res.status(500).json({ message: GENERIC_MESSAGE });
}

module.exports = {
  errorHandler,
  notFound,
  noStoreOnErrors,
  knownError,
  DUPLICATE_EMAIL,
  GENERIC_MESSAGE,
};
