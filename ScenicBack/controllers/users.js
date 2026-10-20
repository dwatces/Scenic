const bcrypt = require("bcryptjs");
const HttpError = require("../models/http-error");
const User = require("../models/user");
const { assertValid } = require("../middleware/validate");
const { readUploadedImage } = require("../middleware/upload");
const { signToken } = require("../middleware/auth");
const { DUPLICATE_EMAIL } = require("../middleware/errors");
const { legacyUser, serializeUser } = require("../util/serialize");
const { sendStoredImage } = require("../util/send-image");
const { MEMBER_NOT_FOUND, CREATOR_SUMMARY_FIELDS } = require("./scenes");

// A member for the public profile and list: no avatar bytes, and the email
// only to label demo accounts (the serialiser never copies it out).
const MEMBER_FIELDS = `${CREATOR_SUMMARY_FIELDS} scenes`;

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

// GET /api/users. Every member, sorted by name, without image bytes.
const listUsers = async (req, res) => {
  const users = await User.find({}, MEMBER_FIELDS)
    .collation({ locale: "en", strength: 2 })
    .sort({ name: 1, _id: 1 })
    .lean();
  res.json({ users: users.map((user) => serializeUser(user)) });
};

// GET /api/users/:userId. One member's public profile.
const getUserById = async (req, res) => {
  const user = await User.findById(req.params.userId, MEMBER_FIELDS).lean();
  if (!user) throw new HttpError(MEMBER_NOT_FOUND, 404);
  res.json({ user: serializeUser(user) });
};

// GET /api/users/:userId/image
const getUserImage = async (req, res) => {
  const user = await User.findById(req.params.userId, "image").lean();
  if (!user) throw new HttpError(MEMBER_NOT_FOUND, 404);
  sendStoredImage(res, user);
};

const signup = async (req, res) => {
  assertValid(req);
  // The avatar is optional (clients show the member's initial instead), but a
  // file that is sent must be a real JPEG, PNG or WebP.
  const image = req.file && req.file.size > 0 ? readUploadedImage(req.file) : undefined;
  const { name, email, password } = req.body;

  if (await User.exists({ email })) throw new HttpError(DUPLICATE_EMAIL, 422);

  // A sign-up racing this one past the check above loses on the unique
  // index; the error handler maps that duplicate key to the same 422.
  const createdUser = await User.create({
    name,
    email,
    password: await bcrypt.hash(password, BCRYPT_COST),
    ...(image && { image }),
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

module.exports = { getUsers, listUsers, getUserById, getUserImage, signup, login };
