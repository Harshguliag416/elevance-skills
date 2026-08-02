const mongoose = require("mongoose");

/**
 * Forgot-password request tracker.
 *
 * Enforces the "only once per day" rule per identifier (email or phone).
 * Keyed by the normalized identifier so it works even if no User profile doc
 * exists yet.
 */
const passwordResetSchema = new mongoose.Schema(
  {
    identifier: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    lastRequestedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PasswordReset", passwordResetSchema);
