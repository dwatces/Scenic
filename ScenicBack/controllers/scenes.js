const mongoose = require("mongoose");
const HttpError = require("../models/http-error");
const Scene = require("../models/scene");
const User = require("../models/user");
const { assertValid, feedOptions } = require("../middleware/validate");
const { readUploadedImage } = require("../middleware/upload");
const { legacyScene, legacyEditFields, serializeScene } = require("../util/serialize");
const { sendStoredImage } = require("../util/send-image");

// Read only to label demo content; the email never leaves the serialiser.
const CREATOR_FIELDS = "name demo email";
// A creator summary for lists: the avatar's type and version, never its bytes.
const CREATOR_SUMMARY_FIELDS = "name demo email image.contentType updatedAt";

const SCENE_NOT_FOUND = "We couldn't find that scene.";
const MEMBER_NOT_FOUND = "We couldn't find that member.";
const NOT_OWNER = "You can only change your own scenes.";

// Express 5 passes a rejected handler promise to the error handler, so the
// handlers below just throw an HttpError.

/** The scene's creator summary, or a bare id if the account no longer exists. */
async function creatorOf(scene) {
  return (
    (await User.findById(scene.creator, CREATOR_SUMMARY_FIELDS).lean()) || { _id: scene.creator }
  );
}

/** Creators of a page of scenes, by id, in one query. */
async function creatorsById(ids) {
  const unique = [...new Set(ids.map(String))];
  const users = await User.find({ _id: { $in: unique } }, CREATOR_SUMMARY_FIELDS).lean();
  return new Map(users.map((user) => [String(user._id), user]));
}

// GET /api/scenes?limit=&before=<sceneId>&creator=<userId>: the feed, newest
// first. `nextCursor` is the next page's `before`, or null on the last page.
const listScenes = async (req, res) => {
  const { limit, before, creator } = feedOptions(req);
  const filter = {};
  if (before) filter._id = { $lt: new mongoose.Types.ObjectId(before) };
  if (creator) filter.creator = new mongoose.Types.ObjectId(creator);

  // One extra row says whether another page exists.
  const rows = await Scene.find(filter)
    .select("-image.data")
    .sort({ _id: -1 })
    .limit(limit + 1)
    .lean();
  const page = rows.slice(0, limit);
  const creators = await creatorsById(page.map((scene) => scene.creator));

  res.json({
    scenes: page.map((scene) =>
      serializeScene(scene, {
        creator: creators.get(String(scene.creator)) || { _id: scene.creator },
      }),
    ),
    nextCursor: rows.length > limit ? String(page[page.length - 1]._id) : null,
  });
};

// GET /api/scenes/:sceneId. The legacy edit fields keep the deployed client's
// edit page working.
const getSceneById = async (req, res) => {
  const scene = await Scene.findById(req.params.sceneId).select("-image.data").lean();
  if (!scene) throw new HttpError(SCENE_NOT_FOUND, 404);
  res.json({
    scene: {
      ...serializeScene(scene, { creator: await creatorOf(scene) }),
      ...legacyEditFields(scene),
    },
  });
};

// GET /api/scenes/user/:userId. DEPRECATED legacy shape, kept for the
// deployed client.
const getScenesByUserId = async (req, res) => {
  const user = await User.findById(req.params.userId, `${CREATOR_FIELDS} scenes`).populate(
    "scenes",
  );
  if (!user) throw new HttpError(MEMBER_NOT_FOUND, 404);
  res.json({ scenes: user.scenes.map((scene) => legacyScene(scene, { creator: user })) });
};

// GET /api/scenes/:sceneId/image
const getSceneImage = async (req, res) => {
  const scene = await Scene.findById(req.params.sceneId, "image").lean();
  if (!scene) throw new HttpError(SCENE_NOT_FOUND, 404);
  sendStoredImage(res, scene);
};

const createScene = async (req, res) => {
  assertValid(req);
  const image = readUploadedImage(req.file);
  const { title, description, address } = req.body;
  const { userId } = req.userData;

  const creator = await User.findById(userId, CREATOR_SUMMARY_FIELDS).lean();
  if (!creator) throw new HttpError("We couldn't find your account. Log in again.", 404);

  const location = await req.app.locals.geocode(address);
  const createdScene = new Scene({ title, description, image, address, location, creator: userId });

  // The scene and the creator's list change together or not at all.
  await mongoose.connection.transaction(async (session) => {
    await createdScene.save({ session });
    await User.updateOne({ _id: userId }, { $addToSet: { scenes: createdScene._id } }, { session });
  });

  res.status(201).json({ scene: serializeScene(createdScene, { creator }) });
};

const updateScene = async (req, res) => {
  assertValid(req);
  const scene = await Scene.findById(req.params.sceneId);
  if (!scene) throw new HttpError(SCENE_NOT_FOUND, 404);
  if (scene.creator.toString() !== req.userData.userId) throw new HttpError(NOT_OWNER, 403);

  scene.title = req.body.title;
  scene.description = req.body.description;
  await scene.save();

  res.status(200).json({ scene: serializeScene(scene, { creator: await creatorOf(scene) }) });
};

const deleteScene = async (req, res) => {
  const scene = await Scene.findById(req.params.sceneId, "creator");
  if (!scene) throw new HttpError(SCENE_NOT_FOUND, 404);
  if (scene.creator.toString() !== req.userData.userId) throw new HttpError(NOT_OWNER, 403);

  await mongoose.connection.transaction(async (session) => {
    await Scene.deleteOne({ _id: scene._id }, { session });
    await User.updateOne({ _id: scene.creator }, { $pull: { scenes: scene._id } }, { session });
  });

  res.status(200).json({ message: "Scene deleted successfully" });
};

module.exports = {
  listScenes,
  getSceneById,
  getScenesByUserId,
  getSceneImage,
  createScene,
  updateScene,
  deleteScene,
  SCENE_NOT_FOUND,
  MEMBER_NOT_FOUND,
  CREATOR_SUMMARY_FIELDS,
};
