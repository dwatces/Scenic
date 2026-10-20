// Demo mode: the same read routes as the database, answered from
// util/demoData.js through the same id checks and serialisers, so a client
// can't tell the shapes apart. Writes get a clear 503.
const express = require("express");
const HttpError = require("../models/http-error");
const { objectIdParam } = require("../middleware/validate");
const { SCENE_NOT_FOUND, MEMBER_NOT_FOUND } = require("../controllers/scenes");
const { legacyUser, legacyScene } = require("../util/serialize");
const { sendStoredImage } = require("../util/send-image");
const demo = require("../util/demoData");

const DEMO_WRITE =
  "Demo mode: the live database is being provisioned. Browsing works; sign-up and posting return shortly.";

const router = express.Router();

router.param("sceneId", objectIdParam(SCENE_NOT_FOUND));
router.param("userId", objectIdParam(MEMBER_NOT_FOUND));

router.get("/api/users/users", (req, res) => {
  res.json({ users: demo.USERS.map(legacyUser) });
});

router.get("/api/scenes/user/:userId", (req, res) => {
  const user = demo.findUser(req.params.userId);
  if (!user) throw new HttpError(MEMBER_NOT_FOUND, 404);
  res.json({ scenes: demo.scenesOf(user).map((scene) => legacyScene(scene, { creator: user })) });
});

router.get("/api/scenes/:sceneId", (req, res) => {
  const scene = demo.findScene(req.params.sceneId);
  if (!scene) throw new HttpError(SCENE_NOT_FOUND, 404);
  res.json({ scene: legacyScene(scene, { creator: demo.findUser(scene.creator) }) });
});

router.get("/api/scenes/:sceneId/image", (req, res) => {
  const scene = demo.findScene(req.params.sceneId);
  if (!scene) throw new HttpError(SCENE_NOT_FOUND, 404);
  sendStoredImage(res, scene);
});

router.get("/api/users/:userId/image", (req, res) => {
  const user = demo.findUser(req.params.userId);
  if (!user) throw new HttpError(MEMBER_NOT_FOUND, 404);
  sendStoredImage(res, user);
});

// Nothing else exists in demo mode: writes are refused with an explanation,
// other reads are unknown routes.
router.use((req, res, next) => {
  if (req.method === "GET" || req.method === "HEAD") {
    return next(new HttpError("That API route doesn't exist.", 404));
  }
  next(new HttpError(DEMO_WRITE, 503));
});

module.exports = router;
module.exports.DEMO_WRITE = DEMO_WRITE;
