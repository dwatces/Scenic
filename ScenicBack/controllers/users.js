const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const HttpError = require("../models/http-error");
const User = require("../models/user");
const { assertValid } = require("../middleware/validate");
const { readUploadedImage } = require("../middleware/upload");
const { DUPLICATE_EMAIL } = require("../middleware/errors");

const LOGIN_FAILED = "Logging in failed, please try again";

function signToken(user, jwtKey) {
  return jwt.sign({ userId: user.id, email: user.email }, jwtKey, { expiresIn: "1h" });
}

const getUsers = async (req, res) => {
  const users = await User.find({}, "-password");
  res.json({ users: users.map((user) => user.toObject({ getters: true })) });
};

const signup = async (req, res) => {
  assertValid(req);
  const image = readUploadedImage(req.file);
  const { name, email, password } = req.body;

  if (await User.exists({ email })) throw new HttpError(DUPLICATE_EMAIL, 422);

  // A sign-up racing this one past the check above loses on the unique
  // index; the error handler maps that duplicate key to the same 422.
  const createdUser = await User.create({
    name,
    email,
    password: bcrypt.hashSync(password, 8),
    image,
    scenes: [],
  });

  const token = signToken(createdUser, req.app.locals.env.JWT_KEY);
  res.status(201).json({ userId: createdUser.id, token });
};

const login = async (req, res) => {
  const { email, password } = req.body;

  const existingUser = await User.findOne({ email });
  if (!existingUser) throw new HttpError(LOGIN_FAILED, 401);

  const validPassword = await bcrypt.compare(password, existingUser.password);
  if (!validPassword) throw new HttpError(LOGIN_FAILED, 401);

  const token = signToken(existingUser, req.app.locals.env.JWT_KEY);
  res.json({ userId: existingUser.id, token });
};

module.exports = { getUsers, signup, login };
