require("dotenv").config();
const fs = require("fs");
const { validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const HttpError = require("../models/http-error");
const User = require("../models/user");

const getUsers = async (req, res, next) => {
  let users;
  try {
    users = await User.find({}, "-password");
  } catch (err) {
    const error = new HttpError("Couldn't fetch users", 500);
    return next(error);
  }

  res.json({ users: users.map((user) => user.toObject({ getters: true })) });
};

const signup = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new HttpError("Invalid inputs, please try again", 422));
  }

  const { name, email, password } = req.body;

  let existingUser;
  try {
    existingUser = await User.findOne({ email: email });
  } catch (err) {
    const error = new HttpError("Signing up failed, please try again", 500);
    return next(error);
  }

  if (existingUser) {
    const error = new HttpError(
      "User exists already, please try another email or login",
      422
    );
    return next(error);
  }

  let hashedPassword = bcrypt.hashSync(password, 8);

  const bitmap = fs.readFileSync("uploads/images/" + req.file.filename);
  const encImage = Buffer.from(bitmap).toString("base64");

  const createdUser = new User({
    name,
    email,
    password: hashedPassword,
    image: {
      data: encImage,
      contentType: req.file.mimetype,
    },
    scenes: [],
  });

  try {
    await createdUser.save();
  } catch (err) {
    const error = new HttpError(
      "Signing up failed, please try again later.",
      500
    );
    return next(error);
  }

  let token;
  try {
    token = jwt.sign(
      { userId: createdUser.id, email: createdUser.email },
      process.env.JWT_KEY,
      { expiresIn: "1h" }
    );
  } catch (err) {
    const error = new HttpError("Signing up failed, please try again", 500);

    return next(error);
  }

  res.status(201).json({ userId: createdUser.id, token: token });
};

const login = async (req, res, next) => {
  const { email, password } = req.body;

  let existingUser;

  try {
    existingUser = await User.findOne({ email: email });
  } catch (err) {
    const error = new HttpError("Logging in failed, please try again", 500);
    return next(error);
  }

  if (!existingUser) {
    const error = new HttpError("Logging in failed, please try again", 401);
    return next(error);
  }

  let validPassword = false;
  try {
    validPassword = await bcrypt.compare(password, existingUser.password);
  } catch (err) {
    const error = new HttpError(
      "Could not login, pelase confirm your credentials",
      500
    );
    return next(error);
  }

  if (!validPassword) {
    const error = new HttpError("Logging in failed, please try again", 403);
    return next(error);
  }

  let token;
  try {
    token = jwt.sign(
      { userId: existingUser.id, email: existingUser.email },
      process.env.JWT_KEY,
      { expiresIn: "1h" }
    );
  } catch (err) {
    const error = new HttpError("Logging in failed, please try again", 500);
    return next(error);
  }

  res.json({
    userId: existingUser.id,
    token: token,
  });
};

exports.getUsers = getUsers;
exports.signup = signup;
exports.login = login;
