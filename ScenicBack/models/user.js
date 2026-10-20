const mongoose = require("mongoose");

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
  // Demo accounts (seeded content) are labelled as demo in every response.
  demo: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

// Defence in depth: a user document turned into JSON or a plain object never
// carries the password hash or email. Responses are still built from an
// explicit field list; lean queries skip this transform.
function hidePrivateFields(doc, ret) {
  delete ret.password;
  delete ret.email;
  delete ret.__v;
  return ret;
}
UserSchema.set("toJSON", { transform: hidePrivateFields });
UserSchema.set("toObject", { transform: hidePrivateFields });

module.exports = mongoose.model("User", UserSchema);
