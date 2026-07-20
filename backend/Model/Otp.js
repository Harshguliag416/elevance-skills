const mongoose = require("mongoose");
const { MAX_ATTEMPTS } = require("../utils/otp");

/**
 * One-time-password records used to gate sensitive actions (currently: enabling
 * French as the UI language).
 *
 * Design notes:
 *  - `hashedOtp` only — the plaintext code is never persisted.
 *  - `expiresAt` has a TTL index so MongoDB auto-purges expired documents, which
 *    also enforces "generate a new OTP after expiry" naturally.
 *  - `(uid, purpose)` is unique: generating a new OTP upserts this document,
 *    which atomically invalidates any previous OTP for the same purpose.
 *  - `attempts` / `lockedUntil` implement brute-force protection.
 */
const otpSchema = new mongoose.Schema(
  {
    uid: { type: String, required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    purpose: {
      type: String,
      required: true,
      enum: ["french_language_verification"],
      default: "french_language_verification",
    },
    // Target value this OTP authorizes (defensive: ties the OTP to the request).
    targetLanguage: { type: String, required: true },
    hashedOtp: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: MAX_ATTEMPTS },
    // When set and in the future, new OTP generation is blocked.
    lockedUntil: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// One active OTP per user per purpose.
otpSchema.index({ uid: 1, purpose: 1 }, { unique: true });

// TTL index: Mongo removes the doc once `expiresAt` passes.
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Otp", otpSchema);
