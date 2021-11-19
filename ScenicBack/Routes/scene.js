const express = require("express");
const { check } = require("express-validator");
const upload = require("../middleware/upload");
const sceneControllers = require("../controllers/scenes");
const checkAuth = require("../middleware/auth");
const router = express.Router();

router.get("/:sceneId", sceneControllers.getSceneById);

router.get("/user/:userId", sceneControllers.getScenesByUserId);

router.use(checkAuth);

router.post(
  "/",
  upload.single("image"),
  [
    check("title").not().isEmpty(),
    check("description").isLength({ min: 5 }),
    check("address").not().isEmpty(),
  ],
  sceneControllers.createScene
);

router.patch(
  "/:sceneId",
  [check("title").not().isEmpty(), check("description").isLength({ min: 5 })],
  sceneControllers.updateScene
);

router.delete("/:sceneId", sceneControllers.deleteScene);

module.exports = router;
