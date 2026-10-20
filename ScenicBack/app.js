// Load .env first: modules below may read process.env when they load.
require("dotenv").config({ quiet: true });
const express = require("express");
const mongoose = require("mongoose");
const connection = require("./middleware/mongo");
const HttpError = require("./models/http-error");
const sceneRoutes = require("./Routes/scene");
const userRoutes = require("./Routes/users");
const demo = require("./util/demoData");
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
      `MongoDB connection failed, serving demo content until it connects: ${err.message}`
    )
  );
  return connecting;
}

const isConnected = () => mongoose.connection.readyState === 1;

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
 */
function createApp({
  env = process.env,
  geocode = (address) =>
    getCoordinatesForAddress(address, { apiKey: env.GOOGLE_API_KEY }),
} = {}) {
  const app = express();
  app.locals.geocode = geocode;
  app.locals.env = env;

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization"
    );
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE");
    next();
  });

  // Edge caching for reads: the CDN answers instantly from cache and revalidates
  // in the background, which hides serverless cold starts from visitors. Writes
  // are never cached; a read right after a write may be one view stale.
  app.use((req, res, next) => {
    if (req.method === "GET") {
      res.setHeader("Cache-Control", "s-maxage=1, stale-while-revalidate=599");
    }
    next();
  });

  // DEMO MODE: while no database is configured, GET routes serve seeded demo
  // content and writes return a clear message. Bypassed once Mongo connects.
  // Serverless note: the function freezes between requests, so the connection
  // may still be in flight on the first request: wait for it (bounded) before
  // falling back to demo content.
  app.use(async (req, res, next) => {
    if (!isConnected() && env.DB_URL) {
      // readyState 0 = no attempt yet, or a previous attempt failed and
      // settled. The driver never retries a failed initial connect, so a
      // transient failure would otherwise poison this serverless instance
      // permanently. Kick off a fresh attempt.
      if (!connecting || mongoose.connection.readyState === 0) {
        startConnection(env.DB_URL);
      }
      await waitAtMost(connecting, 8000);
    } else if (!env.DB_URL && !warnedNoDbUrl) {
      warnedNoDbUrl = true;
      console.warn("DB_URL is not set: serving read-only demo content.");
    }
    if (isConnected()) return next();
    const hit = demo.handle(req);
    if (hit) return res.status(hit.status || 200).json(hit.body);
    if (req.method !== "GET")
      return res.status(503).json({
        message:
          "Demo mode: the live database is being provisioned. Browsing works; sign-up and posting return shortly.",
      });
    return next();
  });

  // Health check. It sits behind the gate so it reports the truth: "db" once
  // MongoDB is connected, "demo" when the API is serving demo content (no
  // DB_URL, or the connection failed). Existing keys are unchanged.
  app.get("/", (req, res) => {
    res.json({
      status: "ok",
      api: "Scenic backend",
      mode: isConnected() ? "db" : "demo",
    });
  });

  app.use("/api/scenes", sceneRoutes);
  app.use("/api/users", userRoutes);

  // unmatched routes -> 404
  app.use((req, res, next) => {
    next(new HttpError("Could not find this route.", 404));
  });

  // central error handler
  app.use((error, req, res, next) => {
    if (res.headersSent) {
      return next(error);
    }
    // Only an HttpError chooses the status and the message. Anything else
    // (a driver error, a bug) is logged and answered with a generic 500, so
    // internal details never reach the client and a MongoDB error code is
    // never mistaken for an HTTP status.
    if (error instanceof HttpError) {
      return res.status(error.code).json({ message: error.message });
    }
    console.error(error);
    res.status(500).json({ message: "Something went wrong. Please try again." });
  });

  return app;
}

const app = createApp();

if (require.main === module) {
  const port = process.env.PORT || 5000;
  if (process.env.DB_URL) startConnection(process.env.DB_URL);
  app.listen(port, () =>
    console.log(`Scenic backend listening on port ${port}`)
  );
}

module.exports = app;
module.exports.createApp = createApp;
