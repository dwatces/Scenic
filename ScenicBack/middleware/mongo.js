const mongoose = require("mongoose");

/**
 * Open the shared mongoose connection.
 * Tuned for serverless: a small pool per instance (Atlas free tiers cap total
 * connections), idle sockets closed quickly, and server selection that gives
 * up inside the request-bounded wait in app.js.
 */
module.exports = async function connection(dbUrl) {
  if (!dbUrl) {
    throw new Error(
      "DB_URL is not set: create a .env file (see .env.example) with your MongoDB connection string."
    );
  }

  await mongoose.connect(dbUrl, {
    serverSelectionTimeoutMS: 6000,
    maxPoolSize: 5,
    maxIdleTimeMS: 10000,
  });
  console.log("Connected to database");
};
