const jwt = require("jsonwebtoken");
const HttpError = require("../models/http-error");

const SIGN_IN = "Sign in to do that.";
const EXPIRED = "Your session has expired. Log in again.";
const NOT_CONFIGURED = "Sign-in isn't set up on this server yet.";

// Tokens are HS256 only: signed and checked with JWT_KEY.
const ALGORITHM = "HS256";

/** 503 when JWT_KEY is missing: sign-up, login and writes can't work. */
function requireJwtKey(req, res, next) {
  if (!req.app.locals.env.JWT_KEY) return next(new HttpError(NOT_CONFIGURED, 503));
  next();
}

/** Requires `Authorization: Bearer <token>`; sets req.userData.userId. */
function checkAuth(req, res, next) {
  if (req.method === "OPTIONS") return next();

  const [scheme, token] = (req.headers.authorization || "").split(" ");
  if (!/^Bearer$/i.test(scheme || "") || !token) {
    return next(new HttpError(SIGN_IN, 401));
  }

  // A token that isn't HS256 (an unsigned alg:none token included) is
  // refused as unauthenticated whatever the server's configuration.
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || decoded.header.alg !== ALGORITHM) {
    return next(new HttpError(SIGN_IN, 401));
  }

  const jwtKey = req.app.locals.env.JWT_KEY;
  if (!jwtKey) return next(new HttpError(NOT_CONFIGURED, 503));

  try {
    const payload = jwt.verify(token, jwtKey, { algorithms: [ALGORITHM] });
    req.userData = { userId: payload.userId };
    return next();
  } catch (err) {
    return next(new HttpError(err.name === "TokenExpiredError" ? EXPIRED : SIGN_IN, 401));
  }
}

/** A one-hour session token. It carries only the user id. */
function signToken(userId, jwtKey) {
  return jwt.sign({ userId }, jwtKey, { algorithm: ALGORITHM, expiresIn: "1h" });
}

module.exports = checkAuth;
module.exports.requireJwtKey = requireJwtKey;
module.exports.signToken = signToken;
