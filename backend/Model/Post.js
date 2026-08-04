const mongoose = require("mongoose");

/**
 * Public Space post (community feed).
 *
 * Media is stored inline as data URIs (base64) per the MongoDB-storage
 * decision. `likes` holds the uids that liked the post, `comments` is an
 * embedded list of comments, and `shares` is a simple counter.
 */
const commentSchema = new mongoose.Schema(
  {
    uid: { type: String, required: true },
    name: { type: String, default: "" },
    photo: { type: String, default: "" },
    text: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

const mediaSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["image", "video"],
      required: true,
    },
    data: { type: String, required: true },
  },
  { _id: false }
);

const postSchema = new mongoose.Schema(
  {
    uid: {
      type: String,
      required: true,
      index: true,
    },
    authorName: {
      type: String,
      default: "",
    },
    authorPhoto: {
      type: String,
      default: "",
    },
    caption: {
      type: String,
      trim: true,
      default: "",
    },
    media: {
      type: [mediaSchema],
      default: [],
    },
    likes: {
      type: [String],
      default: [],
    },
    comments: {
      type: [commentSchema],
      default: [],
    },
    shares: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Post", postSchema);
