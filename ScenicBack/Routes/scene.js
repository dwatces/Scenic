const express = require("express");
const { body } = require("express-validator");
const upload = require("../middleware/upload");
const sceneControllers = require("../controllers/scenes");
const checkAuth = require("../middleware/auth");
const { objectIdParam } = require("../middleware/validate");

const router = express.Router();

router.param("sceneId", objectIdParam(sceneControllers.SCENE_NOT_FOUND));
router.param("userId", objectIdParam(sceneControllers.MEMBER_NOT_FOUND));

const titleAndDescription = [
  body("title").isString().trim().notEmpty().withMessage("Add a title."),
  body("description")
    .isString()
    .trim()
    .isLength({ min: 5 })
    .withMessage("The description needs at least 5 characters."),
];

router.get("/:sceneId", sceneControllers.getSceneById);

router.get("/user/:userId", sceneControllers.getScenesByUserId);

router.use(checkAuth);

router.post(
  "/",
  upload.single("image"),
  [
    ...titleAndDescription,
    body("address").isString().trim().notEmpty().withMessage("Add a location."),
  ],
  sceneControllers.createScene,
);

router.patch("/:sceneId", titleAndDescription, sceneControllers.updateScene);

router.delete("/:sceneId", sceneControllers.deleteScene);

module.exports = router;
