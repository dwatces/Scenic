const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const SceneSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    image: {
      data: String,
      contentType: String,
    },
    // Optional small copy of the photo for scene cards, made by the client.
    thumb: {
      data: String,
      contentType: String,
    },
    address: {
      type: String,
      required: true,
    },
    location: {
      lat: {
        type: Number,
        required: true,
      },
      lng: {
        type: Number,
        required: true,
      },
    },
    creator: {
      type: mongoose.Types.ObjectId,
      required: true,
      ref: "User",
    },
    // Optional photo credit, shown with the scene when set.
    credit: {
      text: String,
      url: String,
    },
  },
  { timestamps: true },
);

// A new photo saved without a new card image drops the old one, so a card
// never shows the previous photo (it falls back to the full image instead).
SceneSchema.pre("save", function dropStaleThumb() {
  if (!this.isNew && this.isModified("image") && !this.isModified("thumb")) {
    this.thumb = undefined;
  }
});

module.exports = mongoose.model("Scene", SceneSchema);
