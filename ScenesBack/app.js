const express = require("express");
const app = express();
require("dotenv").config();
const connection = require("./middleware/mongo");
const sceneRoutes = require("./Routes/scene");
const userRoutes = require("./Routes/users");

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

app.use("/api/scenes", sceneRoutes);
app.use("/api/users", userRoutes);

app.use((req, res, next) => {
  res.redirect("https://scenic-mern.herokuapp.com/api");
});

app.use((error, req, res, next) => {
  res.locals.error = error;
  if (res.status >= 100 && res.status < 600) {
    res.status(error.status);
  } else {
    res.status(500);
  }
  res.json({ message: error.message || "An unknown error occurred!" });
});

connection()
  .then(() => {
    app.listen(process.env.PORT || 5000);
  })
  .catch((err) => {
    console.log(err);
  });
