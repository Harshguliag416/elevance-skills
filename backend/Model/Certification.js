const mongoose = require("mongoose");

/**
 * Certification earned by an intern.
 *
 * Each certification is linked to a User (intern) via a proper ObjectId
 * reference. Expiration date and credential details are optional.
 */
const certificationSchema = new mongoose.Schema(
  {
    internId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Intern is required"],
      index: true,
    },
    certificationName: {
      type: String,
      required: [true, "Certification name is required"],
      trim: true,
    },
    issuingOrganization: {
      type: String,
      required: [true, "Issuing organization is required"],
      trim: true,
    },
    issueDate: {
      type: Date,
      required: [true, "Issue date is required"],
    },
    expirationDate: {
      type: Date,
      default: null,
    },
    credentialId: {
      type: String,
      trim: true,
      default: "",
    },
    credentialUrl: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Certification", certificationSchema);