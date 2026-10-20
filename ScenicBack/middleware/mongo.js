const mongoose = require("mongoose");

module.exports = async function connection(dbUrl) {
  if (!dbUrl) {
    throw new Error(
      "DB_URL is not set — create a .env file (see .env.example) with your MongoDB connection string."
    );
  }

  const connectionParams = {
    useNewUrlParser: true,
    useCreateIndex: true,
    useUnifiedTopology: true,
    useFindAndModify: false,
    // settle fast inside the request-bounded await (serverless)
    serverSelectionTimeoutMS: 6000,
  };

  await mongoose.connect(dbUrl, connectionParams);
  console.log("Connected to database");
};
