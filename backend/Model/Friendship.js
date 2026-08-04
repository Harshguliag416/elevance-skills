const mongoose = require("mongoose");

/**
 * Friendship relationship.
 *
 * A user may request to be friends with another user; the addressee accepts or
 * the request stays pending. The number of *accepted* friendships drives the
 * Public Space posting limit.
 */
const friendshipSchema = new mongoose.Schema(
  {
    requester: {
      type: String,
      required: true,
      index: true,
    },
    addressee: {
      type: String,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted"],
      default: "pending",
    },
  },
  { timestamps: true }
);

friendshipSchema.index({ requester: 1, addressee: 1 }, { unique: true });

module.exports = mongoose.model("Friendship", friendshipSchema);
