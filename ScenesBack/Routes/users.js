const router = require("express").Router();
const { check } = require("express-validator");
const usersControllers = require("../controllers/users");
const upload = require("../middleware/upload");

router.get("/users", usersControllers.getUsers);

router.post(
  "/signup",
  upload.single("image"),
  [
    check("name").not().isEmpty(),
    check("email").normalizeEmail().isEmail(),
    check("password").isLength({ min: 6 }),
  ],
  usersControllers.signup
);

router.post("/login", usersControllers.login);

module.exports = router;
