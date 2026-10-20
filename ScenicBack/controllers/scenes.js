const mongoose = require("mongoose");
const HttpError = require("../models/http-error");
const Scene = require("../models/scene");
const User = require("../models/user");
const { assertValid } = require("../middleware/validate");
const { readUploadedImage } = require("../middleware/upload");

const SCENE_NOT_FOUND = "We couldn't find that scene.";
const MEMBER_NOT_FOUND = "We couldn't find that member.";
const NOT_OWNER = "You can only change your own scenes.";

// Handlers are async: Express 5 passes a rejected promise to the error
// handler, so a thrown HttpError becomes its status and message, and any
// other error a generic 500.

const getSceneById = async (req, res) => {
  const scene = await Scene.findById(req.params.sceneId);
  if (!scene) throw new HttpError(SCENE_NOT_FOUND, 404);
  res.json({ scene: scene.toObject({ getters: true }) });
};

const getScenesByUserId = async (req, res) => {
  const userWithScenes = await User.findById(req.params.userId).populate("scenes");
  if (!userWithScenes) throw new HttpError(MEMBER_NOT_FOUND, 404);
  res.json({
    scenes: userWithScenes.scenes.map((scene) => scene.toObject({ getters: true })),
  });
};

const createScene = async (req, res) => {
  assertValid(req);
  const image = readUploadedImage(req.file);
  const { title, description, address } = req.body;
  const { userId } = req.userData;

  if (!(await User.exists({ _id: userId }))) {
    throw new HttpError("We couldn't find your account. Sign in again.", 404);
  }

  const location = await req.app.locals.geocode(address);
  const createdScene = new Scene({ title, description, image, address, location, creator: userId });

  // The scene and the creator's list change together or not at all.
  await mongoose.connection.transaction(async (session) => {
    await createdScene.save({ session });
    await User.updateOne(
      { _id: userId },
      { $addToSet: { scenes: createdScene._id } },
      { session }
    );
  });

  res.status(201).json({ scene: createdScene.toObject({ getters: true }) });
};

const updateScene = async (req, res) => {
  assertValid(req);
  const scene = await Scene.findById(req.params.sceneId);
  if (!scene) throw new HttpError(SCENE_NOT_FOUND, 404);
  if (scene.creator.toString() !== req.userData.userId) throw new HttpError(NOT_OWNER, 403);

  scene.title = req.body.title;
  scene.description = req.body.description;
  await scene.save();

  res.status(200).json({ scene: scene.toObject({ getters: true }) });
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
  getSceneById,
  getScenesByUserId,
  createScene,
  updateScene,
  deleteScene,
  SCENE_NOT_FOUND,
  MEMBER_NOT_FOUND,
};
