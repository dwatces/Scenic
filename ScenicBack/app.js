const express = require("express");
require("dotenv").config();
const connection = require("./middleware/mongo");
const HttpError = require("./models/http-error");
const sceneRoutes = require("./Routes/scene");
const userRoutes = require("./Routes/users");

const app = express();

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

// simple health check
app.get("/", (req, res) => {
  res.json({ status: "ok", api: "Scenic backend" });
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
  const status =
    typeof error.code === "number" && error.code >= 100 && error.code < 600
      ? error.code
      : 500;
  res
    .status(status)
    .json({ message: error.message || "An unknown error occurred!" });
});

// connect (non-fatal: in serverless the API stays up and reports cleanly
// while DB_URL is not yet provisioned)
connection().catch((err) =>
  console.error("MongoDB connection failed:", err.message)
);

if (require.main === module) {
  const port = process.env.PORT || 5000;
  app.listen(port, () =>
    console.log(`Scenic backend listening on port ${port}`)
  );
}

module.exports = app;
