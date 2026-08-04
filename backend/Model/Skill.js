const mongoose = require("mongoose");

/**
 * Skill that can be assigned to interns.
 *
 * Each skill has a unique name and an optional description.
 * The assignedTo array tracks which interns have been assigned this skill.
 */
const skillSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Skill name is required"],
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    assignedTo: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Skill", skillSchema);