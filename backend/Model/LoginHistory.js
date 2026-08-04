const mongoose = require("mongoose");

/**
 * Login history entry — one document per login attempt.
 *
 * Captures the browser, operating system, device type and IP address of every
 * attempt, plus the outcome so a user can audit their account activity from the
 * profile page.
 */
const loginHistorySchema = new mongoose.Schema(
  {
    uid: {
      type: String,
      required: true,
      index: true,
    },
    email: {
      type: String,
      lowercase: true,
      default: "",
    },
    method: {
      type: String,
      enum: ["google", "email", "phone"],
      default: "google",
    },
    browser: {
      type: String,
      default: "",
    },
    os: {
      type: String,
      default: "",
    },
    deviceType: {
      type: String,
      enum: ["desktop", "laptop", "mobile", "unknown"],
      default: "unknown",
    },
    ipAddress: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["success", "blocked"],
      default: "success",
    },
    reason: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

loginHistorySchema.index({ uid: 1, createdAt: -1 });

module.exports = mongoose.model("LoginHistory", loginHistorySchema);
