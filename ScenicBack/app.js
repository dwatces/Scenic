// Load .env first: modules below may read process.env when they load.
require("dotenv").config({ quiet: true });
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { rateLimit: createRateLimiter } = require("express-rate-limit");
const mongoose = require("mongoose");
const connection = require("./middleware/mongo");
const { errorHandler, notFound, noStoreOnErrors } = require("./middleware/errors");
const sceneRoutes = require("./Routes/scene");
const userRoutes = require("./Routes/users");
const demoRoutes = require("./Routes/demo");
const getCoordinatesForAddress = require("./util/location");

// One MongoDB connection per process (one serverless instance), shared by
// every app built here. It starts on the first request rather than at import,
// so building an app (in tests, or in a script) never connects by itself. On
// Vercel the first request arrives straight after module load, so cold-start
// behaviour is unchanged.
let connecting = null;
let warnedNoDbUrl = false;
function startConnection(dbUrl) {
  // A failed connect leaves the API in demo mode: GETs still answer 200 and
  // writes 503. Say so loudly, with the driver's reason, so a bad DB_URL or
  // an unreachable cluster shows up in the function log.
  connecting = connection(dbUrl).catch((err) =>
    console.error(
      `MongoDB connection failed, serving demo content until it connects: ${err.message}`,
    ),
  );
  return connecting;
}

const isConnected = () => mongoose.connection.readyState === 1;

/**
 * Make sure a connection attempt is running and wait for it, at most 8 s.
 * Serverless note: the function freezes between requests, so the connect
 * may still be in flight on the first request.
 */
async function ensureConnection(env) {
  if (!env.DB_URL) {
    if (!warnedNoDbUrl) {
      warnedNoDbUrl = true;
      console.warn("DB_URL is not set: serving read-only demo content.");
    }
    return;
  }
  if (isConnected()) return;
  // readyState 0 = no attempt yet, or a previous attempt failed and settled.
  // The driver never retries a failed initial connect, so a transient
  // failure would otherwise poison this serverless instance permanently.
  if (!connecting || mongoose.connection.readyState === 0) startConnection(env.DB_URL);
  await waitAtMost(connecting, 8000);
}

/** An app without DB_URL always serves demo content. */
const usesDatabase = (env) => Boolean(env.DB_URL) && isConnected();

let warnedNoJwtKey = false;
function checkConfig(env) {
  if (!env.JWT_KEY && !warnedNoJwtKey) {
    warnedNoJwtKey = true;
    console.error(
      "JWT_KEY is not set: sign-up, login and posting answer 503 until it is. Reads still work.",
    );
  }
}

/** CORS_ORIGIN: a comma-separated list of allowed origins; unset means any (*). */
function corsOrigin(value) {
  const origins = (value || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return origins.length === 0 || origins.includes("*") ? "*" : origins;
}

// Sign-up and login: 10 attempts per IP per 15 minutes. On serverless the
// count is per running instance, so this slows guessing rather than capping
// it exactly.
function authRateLimiter(options = {}) {
  return createRateLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { message: "Too many attempts. Wait 15 minutes and try again." },
    ...options,
  });
}

function waitAtMost(promise, ms) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(resolve, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Build the Express app.
 * @param {object} [options]
 * @param {(address: string) => Promise<{lat: number, lng: number}>} [options.geocode]
 *   turns a scene address into coordinates (tests inject a stub)
 * @param {NodeJS.ProcessEnv} [options.env] configuration source (defaults to process.env)
 * @param {boolean | object} [options.rateLimit] sign-up/login rate limiting:
 *   true (default), false to switch it off, or express-rate-limit options
 */
function createApp({
  env = process.env,
  geocode = (address) => getCoordinatesForAddress(address, { apiKey: env.GOOGLE_API_KEY }),
  rateLimit = true,
} = {}) {
  checkConfig(env);
  const app = express();
  app.locals.geocode = geocode;
  app.locals.env = env;

  app.disable("x-powered-by");
  // Vercel's edge is the one proxy in front of the function: req.ip is the
  // visitor's address, which the rate limiter keys on.
  app.set("trust proxy", 1);

  app.use(noStoreOnErrors);

  // A JSON and image API: no HTML is ever served, so the CSP denies
  // everything. Images are loaded cross-origin by the client, which needs
  // Cross-Origin-Resource-Policy: cross-origin.
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
      },
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );

  // CORS answers preflight requests itself (204), before the database gate,
  // so a browser sees the real response even in demo mode.
  app.use(
    cors({
      origin: corsOrigin(env.CORS_ORIGIN),
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      maxAge: 600,
    }),
  );

  // JSON only: the client posts JSON (login, edits) or multipart (uploads,
  // handled by multer on those routes). Nothing posts urlencoded forms.
  app.use(express.json({ limit: "100kb" }));

  if (rateLimit) {
    const limiter = authRateLimiter(rateLimit === true ? {} : rateLimit);
    app.post(["/api/users/login", "/api/users/signup"], limiter);
  }

  // Edge caching for reads: the CDN answers instantly from cache and revalidates
  // in the background, which hides serverless cold starts from visitors. Writes
  // are never cached; a read right after a write may be one view stale.
  app.use((req, res, next) => {
    if (req.method === "GET") {
      res.setHeader("Cache-Control", "s-maxage=1, stale-while-revalidate=599");
    }
    next();
  });

  // Health check: waits for the connection like any request, then reports
  // "db" or "demo" (no DB_URL, or the connection failed), so a check after a
  // deploy tells the truth. Existing keys are unchanged.
  app.get("/", async (req, res) => {
    await ensureConnection(env);
    res.json({ status: "ok", api: "Scenic backend", mode: usesDatabase(env) ? "db" : "demo" });
  });

  // DEMO MODE: while no database is configured or reachable, reads are
  // answered from demo data and writes get a clear 503 (Routes/demo.js).
  // Bypassed once MongoDB connects.
  app.use(async (req, res, next) => {
    await ensureConnection(env);
    if (usesDatabase(env)) return next();
    return demoRoutes(req, res, next);
  });

  app.use("/api/scenes", sceneRoutes);
  app.use("/api/users", userRoutes);

  // Unmatched routes get a JSON 404. Only an HttpError (or a known library
  // error, see middleware/errors.js) chooses the status and the message.
  // Anything else is logged and answered with a generic 500, so internals
  // never reach the client and a MongoDB error code is never mistaken for
  // an HTTP status.
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

const app = createApp();

if (require.main === module) {
  const port = process.env.PORT || 5000;
  if (process.env.DB_URL) startConnection(process.env.DB_URL);
  app.listen(port, () => console.log(`Scenic backend listening on port ${port}`));
}

module.exports = app;
module.exports.createApp = createApp;
