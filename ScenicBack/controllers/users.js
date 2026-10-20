const bcrypt = require("bcryptjs");
const HttpError = require("../models/http-error");
const User = require("../models/user");
const { assertValid } = require("../middleware/validate");
const { readUploadedImage } = require("../middleware/upload");
const { signToken } = require("../middleware/auth");
const { DUPLICATE_EMAIL } = require("../middleware/errors");
const { legacyUser } = require("../util/serialize");
const { sendStoredImage } = require("../util/send-image");
const { MEMBER_NOT_FOUND } = require("./scenes");

const LOGIN_FAILED = "That email and password don't match an account.";
const BCRYPT_COST = 10;

// Compared against when no account matches, so an unknown email takes as
// long as a wrong password and the response can't reveal who has an account.
const DUMMY_HASH = "$2b$10$KwcZzIUilmr/U7sqivyqeOOm47ecJqyAw.QbvGwcf8Ai.cXxit46O";

// GET /api/users/users. DEPRECATED legacy shape, kept for the deployed
// client. The email is read only to label demo accounts.
const getUsers = async (req, res) => {
  const users = await User.find({}, "name image scenes demo email");
  res.json({ users: users.map(legacyUser) });
};

// GET /api/users/:userId/image. The member's avatar as an image response.
const getUserImage = async (req, res) => {
  const user = await User.findById(req.params.userId, "image").lean();
  if (!user) throw new HttpError(MEMBER_NOT_FOUND, 404);
  sendStoredImage(res, user);
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
    password: await bcrypt.hash(password, BCRYPT_COST),
    image,
    scenes: [],
  });

  res.status(201).json({
    userId: createdUser.id,
    token: signToken(createdUser.id, req.app.locals.env.JWT_KEY),
  });
};

const login = async (req, res) => {
  assertValid(req);
  const email = String(req.body.email);
  const password = String(req.body.password);

  // sanitizeFilter: even if a non-string slipped past validation, an
  // operator object such as { $ne: null } is matched literally.
  const user = await User.findOne({ email }, "password").setOptions({ sanitizeFilter: true });
  const passwordMatches = await bcrypt.compare(password, user ? user.password : DUMMY_HASH);
  if (!user || !passwordMatches) throw new HttpError(LOGIN_FAILED, 401);

  res.json({ userId: user.id, token: signToken(user.id, req.app.locals.env.JWT_KEY) });
};

module.exports = { getUsers, getUserImage, signup, login };
