const router = require("express").Router();
const { body } = require("express-validator");
const usersControllers = require("../controllers/users");
const upload = require("../middleware/upload");

router.get("/users", usersControllers.getUsers);

router.post(
  "/signup",
  upload.single("image"),
  [
    body("name").isString().trim().notEmpty().withMessage("Add your name."),
    body("email").normalizeEmail().isEmail().withMessage("Enter a valid email address."),
    body("password")
      .isString()
      .isLength({ min: 6 })
      .withMessage("Your password needs at least 6 characters."),
  ],
  usersControllers.signup
);

router.post("/login", usersControllers.login);

module.exports = router;
