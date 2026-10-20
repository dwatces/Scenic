const mongoose = require("mongoose");
const { validationResult } = require("express-validator");
const HttpError = require("../models/http-error");

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

module.exports = { assertValid, objectIdParam };
