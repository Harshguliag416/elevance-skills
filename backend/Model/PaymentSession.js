const mongoose = require("mongoose");

/**
 * Short-lived payment verification session.
 *
 * Bridges the "OTP verified" state and the Razorpay checkout so an order can
 * only be created for a user who has successfully verified their email, and a
 * payment can only be confirmed against the exact order that was issued.
 * Documents are auto-removed by the TTL index after 15 minutes.
 */
const paymentSessionSchema = new mongoose.Schema(
  {
    uid: {
      type: String,
      required: true,
      index: true,
    },
    purpose: {
      type: String,
      enum: ["resume", "subscription"],
      required: true,
    },
    email: {
      type: String,
      default: "",
    },
    otpVerified: {
      type: Boolean,
      default: false,
    },
    orderId: {
      type: String,
      default: "",
    },
    amount: {
      type: Number,
      default: 0,
    },
    plan: {
      type: String,
      default: "",
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 15 * 60 * 1000),
    },
  },
  { timestamps: true }
);

paymentSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("PaymentSession", paymentSessionSchema);
