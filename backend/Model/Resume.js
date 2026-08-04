const mongoose = require("mongoose");

/**
 * Generated resume document.
 *
 * Created only after a successful ₹50 Razorpay payment (which itself is gated
 * by an email OTP). The generated professional resume is stored as HTML so it
 * can be rendered in the browser and printed/downloaded as PDF, and it is linked
 * from the User profile (`user.resumeId`) for future internship applications.
 */
const resumeSchema = new mongoose.Schema(
  {
    uid: {
      type: String,
      required: true,
      index: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      default: "",
    },
    name: {
      type: String,
      trim: true,
      default: "",
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    qualifications: {
      type: String,
      default: "",
    },
    experience: {
      type: String,
      default: "",
    },
    personalInfo: {
      type: String,
      default: "",
    },
    skills: {
      type: [String],
      default: [],
    },
    photo: {
      type: String,
      default: "",
    },
    generatedHtml: {
      type: String,
      default: "",
    },
    paymentId: {
      type: String,
      default: "",
    },
    orderId: {
      type: String,
      default: "",
    },
    amount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Resume", resumeSchema);
