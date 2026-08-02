const mongoose = require("mongoose");

/**
 * Subscription plan document.
 *
 * One active document per user (a new purchase replaces/extends the previous).
 * `applicationsUsed` is reset when the period rolls over so the monthly apply
 * limit is enforced per calendar month.
 */
const subscriptionSchema = new mongoose.Schema(
  {
    uid: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    plan: {
      type: String,
      enum: ["free", "bronze", "silver", "gold"],
      default: "free",
    },
    status: {
      type: String,
      enum: ["active", "expired"],
      default: "active",
    },
    periodStart: {
      type: Date,
      default: () => new Date(),
    },
    periodEnd: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
    applicationsUsed: {
      type: Number,
      default: 0,
    },
    razorpayOrderId: {
      type: String,
      default: "",
    },
    razorpayPaymentId: {
      type: String,
      default: "",
    },
    invoiceNo: {
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

module.exports = mongoose.model("Subscription", subscriptionSchema);
