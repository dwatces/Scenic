const jwt = require("jsonwebtoken");
const HttpError = require("../models/http-error");

const SIGN_IN = "Sign in to do that.";
const EXPIRED = "Your session has expired. Sign in again.";

/** Requires `Authorization: Bearer <token>`; sets req.userData.userId. */
module.exports = (req, res, next) => {
  if (req.method === "OPTIONS") return next();

  const [scheme, token] = (req.headers.authorization || "").split(" ");
  if (!/^Bearer$/i.test(scheme || "") || !token) {
    return next(new HttpError(SIGN_IN, 401));
  }

  try {
    const decoded = jwt.verify(token, req.app.locals.env.JWT_KEY);
    req.userData = { userId: decoded.userId };
    return next();
  } catch (err) {
    return next(new HttpError(err.name === "TokenExpiredError" ? EXPIRED : SIGN_IN, 401));
  }
};
