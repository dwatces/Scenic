// Load .env first: modules below may read process.env when they load.
require("dotenv").config({ quiet: true });
const express = require("express");
const mongoose = require("mongoose");
const connection = require("./middleware/mongo");
const { errorHandler, notFound, noStoreOnErrors } = require("./middleware/errors");
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

  app.use(noStoreOnErrors);
  // JSON only: the client posts JSON (login, edits) or multipart (uploads,
  // handled by multer on those routes). Nothing posts urlencoded forms.
  app.use(express.json({ limit: "100kb" }));

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
  app.listen(port, () =>
    console.log(`Scenic backend listening on port ${port}`)
  );
}

module.exports = app;
module.exports.createApp = createApp;
