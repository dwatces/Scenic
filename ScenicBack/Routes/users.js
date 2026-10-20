const router = require("express").Router();
const { body } = require("express-validator");
const usersControllers = require("../controllers/users");
const upload = require("../middleware/upload");
const { requireJwtKey } = require("../middleware/auth");
const { emailField } = require("../util/email");
const { objectIdParam } = require("../middleware/validate");
const { MEMBER_NOT_FOUND } = require("../controllers/scenes");

router.param("userId", objectIdParam(MEMBER_NOT_FOUND));

router.get("/users", usersControllers.getUsers);

router.get("/:userId/image", usersControllers.getUserImage);

router.post(
  "/signup",
  requireJwtKey,
  upload.single("image"),
  [
    body("name").isString().trim().notEmpty().withMessage("Add your name."),
    emailField(),
    body("password")
      .isString()
      .isLength({ min: 6 })
      .withMessage("Your password needs at least 6 characters."),
  ],
  usersControllers.signup,
);

router.post(
  "/login",
  requireJwtKey,
  [emailField(), body("password").isString().notEmpty().withMessage("Enter your password.")],
  usersControllers.login,
);

module.exports = router;
