const mongoose = require("mongoose");
const {
  SUPPORTED_LANGUAGE_CODES,
  DEFAULT_LANGUAGE,
} = require("../config/languages");

/**
 * User profile keyed by the Firebase UID.
 *
 * The app authenticates users via Firebase (Google). There is no local password
 * store; this collection only holds server-owned profile data such as the
 * preferred UI language. The document is created/updated lazily on first sync.
 */
const userSchema = new mongoose.Schema(
  {
    uid: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    name: {
      type: String,
      trim: true,
      default: "",
    },
    preferredLanguage: {
      type: String,
      enum: SUPPORTED_LANGUAGE_CODES,
      default: DEFAULT_LANGUAGE,
    },
    role: {
      type: String,
      enum: ["intern", "superadmin"],
      default: "intern",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
