const mongoose = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");

const Schema = mongoose.Schema;

const UserSchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
  },
  image: {
    data: String,
    contentType: String,
  },
  scenes: [
    {
      type: mongoose.Types.ObjectId,
      ref: "Scene",
    },
  ],
});

UserSchema.plugin(uniqueValidator);

module.exports = mongoose.model("User", UserSchema);
