const mongoose = require("mongoose");
const { query, matchedData, validationResult } = require("express-validator");
const HttpError = require("../models/http-error");

const FEED_PAGE = { default: 12, min: 1, max: 24 };

/** Throws a 422 carrying the first validation message, if any check failed. */
function assertValid(req) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    throw new HttpError(result.array({ onlyFirstError: true })[0].msg, 422);
  }
}

/**
 * router.param handler: a malformed id can't match anything, so it is a 404
 * straight away (and never reaches a query as a cast error).
 */
function objectIdParam(notFoundMessage) {
  return (req, res, next, id) =>
    mongoose.isObjectIdOrHexString(id) ? next() : next(new HttpError(notFoundMessage, 404));
}

const isId = (value) => typeof value === "string" && mongoose.isObjectIdOrHexString(value);

/**
 * Query checks for the scene feed: ?limit=1-24 (a number; clamped),
 * ?before=<scene id> (the cursor) and ?creator=<member id>. Unknown
 * parameters, such as the client's cache-busting `fresh`, are ignored.
 */
const feedQuery = [
  query("limit")
    .optional()
    .custom((value) => typeof value === "string" && /^\d+(\.\d+)?$/.test(value))
    .withMessage("The page size must be a number from 1 to 24.")
    .bail()
    .toInt()
    .customSanitizer((value) => Math.min(FEED_PAGE.max, Math.max(FEED_PAGE.min, value))),
  query("before").optional().custom(isId).withMessage("That page link isn't valid."),
  query("creator").optional().custom(isId).withMessage("That member link isn't valid."),
];

/**
 * The checked feed query. Express 5 re-parses req.query on every read, so
 * sanitised values (the clamped limit) only exist in matchedData.
 * @returns {{ limit: number, before?: string, creator?: string }}
 */
function feedOptions(req) {
  assertValid(req);
  const {
    limit = FEED_PAGE.default,
    before,
    creator,
  } = matchedData(req, {
    locations: ["query"],
  });
  return { limit, before, creator };
}

module.exports = { assertValid, objectIdParam, feedQuery, feedOptions, FEED_PAGE };
