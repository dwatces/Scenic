const fs = require("fs");
const { validationResult } = require("express-validator");
const mongoose = require("mongoose");
const HttpError = require("../models/http-error");
const getCoordinatesForAddress = require("../util/location");
const Scene = require("../models/scene");
const User = require("../models/user");

const getSceneById = async (req, res, next) => {
  const sceneId = req.params.sceneId;

  let scene;

  try {
    scene = await Scene.findById(sceneId);
  } catch (err) {
    const error = new HttpError("Could not find this scene", 500);
    return next(error);
  }

  if (!scene) {
    const error = new HttpError(
      "Could not find a scene with the provided scene id",
      404
    );
    return next(error);
  }

  res.json({ scene: scene.toObject({ getters: true }) });
};

const getScenesByUserId = async (req, res, next) => {
  const userId = req.params.userId;

  let userWithScenes;

  userWithScenes = await User.findById(userId).populate("scenes");

  res.json({
    scenes: userWithScenes.scenes.map((scene) =>
      scene.toObject({ getters: true })
    ),
  });
};

const createScene = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    next(new HttpError("Invalid inputs, please try again", 422));
  }

  const { title, description, address } = req.body;

  let coordinates;
  try {
    coordinates = await getCoordinatesForAddress(address);
  } catch (error) {
    return next(error);
  }

  const bitmap = fs.readFileSync("uploads/images/" + req.file.filename);
  const encImage = Buffer.from(bitmap).toString("base64");

  const createdScene = new Scene({
    title,
    description,
    image: {
      data: encImage,
      contentType: req.file.mimetype,
    },
    address,
    location: coordinates,
    creator: req.userData.userId,
  });

  let user;

  try {
    user = await User.findById(req.userData.userId);
  } catch (err) {
    const error = new HttpError("Creating scene failed, please try again", 500);
    return next(error);
  }

  if (!user) {
    const error = new HttpError("Could not find user for provided id", 404);
    return next(error);
  }

  try {
    const sess = await mongoose.startSession();
    sess.startTransaction();
    await createdScene.save({ session: sess });
    user.scenes.push(createdScene);
    await user.save({ session: sess });
    await sess.commitTransaction();
  } catch (err) {
    const error = new HttpError(
      "Scene creation failed, please try again.",
      500
    );
    return next(error);
  }

  res.status(201).json({ scene: createdScene });
};

const updateScene = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new HttpError("Invalid inputs, please try again", 422));
  }

  const { title, description } = req.body;
  const sceneId = req.params.sceneId;

  let scene;
  try {
    scene = await Scene.findById(sceneId);
  } catch (err) {
    const error = new HttpError("Could not find this scene to update", 500);
    return next(error);
  }

  if (scene.creator.toString() !== req.userData.userId) {
    const error = new HttpError("You cannot update this scene", 401);
    return next(error);
  }

  scene.title = title;
  scene.description = description;

  try {
    await scene.save();
  } catch (err) {
    const error = new HttpError("Could not update this scene", 500);
    return next(error);
  }

  return res.status(200).json({ scene: scene.toObject({ getters: true }) });
};

const deleteScene = async (req, res, next) => {
  const sceneId = req.params.sceneId;

  let scene;
  try {
    scene = await Scene.findById(sceneId).populate("creator");
  } catch (err) {
    const error = new HttpError(
      "Something went wrong, cannot delete this scene",
      500
    );
    return next(error);
  }

  if (!scene) {
    const error = new HttpError("Scene not found by given ID", 404);
    return next(error);
  }

  if (scene.creator.id !== req.userData.userId) {
    const error = new HttpError("You cannot delete this scene", 401);
    return next(error);
  }

  try {
    const session = await mongoose.startSession();
    session.startTransaction();
    await scene.remove({ session });
    scene.creator.scenes.pull(scene);
    await scene.creator.save({ session });
    await session.commitTransaction();
  } catch (err) {
    const error = new HttpError(
      "Something went wrong, cannot delete this scene",
      500
    );
    return next(error);
  }

  res.status(200).json({
    messsage: "Scene deleted successfully",
  });
};

exports.getSceneById = getSceneById;
exports.getScenesByUserId = getScenesByUserId;
exports.createScene = createScene;
exports.updateScene = updateScene;
exports.deleteScene = deleteScene;
