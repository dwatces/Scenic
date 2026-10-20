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

// One MongoDB connection per process (per serverless instance), shared by every
// app built here. It opens on the first request, not at import, so a test or
// script that builds an app never connects by itself.
let connecting = null;
let warnedNoDbUrl = false;
function startConnection(dbUrl) {
  // A failed connect leaves the API in demo mode, so log the driver's reason:
  // a bad DB_URL or an unreachable cluster then shows up in the function log.
  connecting = connection(dbUrl).catch((err) =>
    console.error(
      `MongoDB connection failed, serving demo content until it connects: ${err.message}`,
    ),
  );
  return connecting;
}

const isConnected = () => mongoose.connection.readyState === 1;

/** Start a connection attempt if none is running, and wait up to 8 s for it. */
async function ensureConnection(env) {
  if (!env.DB_URL) {
    if (!warnedNoDbUrl) {
      warnedNoDbUrl = true;
      console.warn("DB_URL is not set: serving read-only demo content.");
    }
    return;
  }
  if (isConnected()) return;
  // readyState 0: no attempt yet, or the last one failed. The driver never
  // retries a failed initial connect, so without a new attempt one transient
  // failure would keep this instance in demo mode for good.
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

// Sign-up and login attempts per IP. Each serverless instance keeps its own
// count, so this slows password guessing rather than capping it exactly.
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
  const app = express();
  app.locals.geocode = geocode;
  app.locals.env = env;

  // Warn about missing config on the first request rather than at import, so
  // scripts and tests that build their own app stay quiet.
  app.use((req, res, next) => {
    checkConfig(env);
    next();
  });

  app.disable("x-powered-by");
  // Vercel's edge is the one proxy in front of the function: req.ip is the
  // visitor's address, which the rate limiter keys on.
  app.set("trust proxy", 1);

  app.use(noStoreOnErrors);

  // A JSON and image API serves no HTML, so the CSP denies everything. The
  // client loads images from another origin, hence the cross-origin CORP.
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
      },
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );

  // Before the demo-mode gate, so preflight requests get their 204 even in
  // demo mode.
  app.use(
    cors({
      origin: corsOrigin(env.CORS_ORIGIN),
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      maxAge: 600,
    }),
  );

  // JSON only: uploads are multipart (multer, on their own routes) and nothing
  // posts urlencoded forms.
  app.use(express.json({ limit: "100kb" }));

  if (rateLimit) {
    const limiter = authRateLimiter(rateLimit === true ? {} : rateLimit);
    app.post(["/api/users/login", "/api/users/signup"], limiter);
  }

  // The CDN answers reads from cache and revalidates in the background, which
  // hides serverless cold starts. A read straight after a write may be one view
  // stale; the client adds ?fresh= after its own writes.
  app.use((req, res, next) => {
    if (req.method === "GET") {
      res.setHeader("Cache-Control", "s-maxage=1, stale-while-revalidate=599");
    }
    next();
  });

  // Health check. It waits for the connection like any other request, so
  // `mode` right after a deploy says whether the database is really in use.
  app.get("/", async (req, res) => {
    await ensureConnection(env);
    res.json({ status: "ok", api: "Scenic backend", mode: usesDatabase(env) ? "db" : "demo" });
  });

  // Demo mode: with no database configured or reachable, visitors still get a
  // working read-only app. Reads come from demo data and writes get a 503
  // (Routes/demo.js).
  app.use(async (req, res, next) => {
    await ensureConnection(env);
    if (usesDatabase(env)) return next();
    return demoRoutes(req, res, next);
  });

  app.use("/api/scenes", sceneRoutes);
  app.use("/api/users", userRoutes);

  // Only an HttpError or a known library error chooses the status and message.
  // Anything else is logged and answered with a generic 500 (middleware/errors.js).
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
