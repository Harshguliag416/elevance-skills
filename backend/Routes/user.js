const express = require("express");
const router = express.Router();

const User = require("../Model/User");
const Otp = require("../Model/Otp");
const { verifyFirebaseUser } = require("../middleware/auth");
const { otpRequestLimiter, otpVerifyLimiter } = require("../middleware/rateLimit");
const { sendOtpEmail } = require("../utils/email");
const {
  isSupportedLanguage,
  requiresVerification,
  DEFAULT_LANGUAGE,
} = require("../config/languages");
const {
  generateOtp,
  hashOtp,
  verifyOtp,
  OTP_TTL_MS,
  MAX_ATTEMPTS,
  LOCK_DURATION_MS,
} = require("../utils/otp");

const OTP_PURPOSE = "french_language_verification";
const FRENCH = "fr";

/** Find-or-create the profile for the authenticated user. */
async function getOrCreateUser(authUser) {
  let user = await User.findOne({ uid: authUser.uid });
  if (!user) {
    user = await User.create({
      uid: authUser.uid,
      email: authUser.email,
      name: authUser.name || "",
      preferredLanguage: DEFAULT_LANGUAGE,
    });
  }
  return user;
}

// Every route below requires a verified Firebase user.
router.use(verifyFirebaseUser);

/**
 * POST /api/user/sync
 * Upsert the profile on login and return the server-stored preference so the
 * client can let the DB value override LocalStorage.
 */
router.post("/sync", async (req, res) => {
  try {
    const { uid, email, name } = req.authUser;
    const user = await User.findOneAndUpdate(
      { uid },
      { $set: { email, ...(name ? { name } : {}) }, $setOnInsert: { preferredLanguage: DEFAULT_LANGUAGE } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    return res.json({ preferredLanguage: user.preferredLanguage });
  } catch (err) {
    console.error("[user/sync]", err.message);
    return res.status(500).json({ error: "Could not sync profile." });
  }
});

/** GET /api/user/language */
router.get("/language", async (req, res) => {
  try {
    const user = await getOrCreateUser(req.authUser);
    return res.json({ preferredLanguage: user.preferredLanguage });
  } catch (err) {
    console.error("[user/language:get]", err.message);
    return res.status(500).json({ error: "Could not read language preference." });
  }
});

/**
 * PUT /api/user/language
 * Persist a non-verified language directly. Verified languages (French) are
 * rejected here and must go through the OTP flow.
 */
router.put("/language", async (req, res) => {
  try {
    const language = String(req.body.language || "").trim().toLowerCase();

    if (!isSupportedLanguage(language)) {
      return res.status(400).json({ error: "Unsupported language." });
    }
    if (requiresVerification(language)) {
      return res.status(403).json({
        error: "This language requires email verification.",
        verificationRequired: true,
      });
    }

    const user = await getOrCreateUser(req.authUser);
    user.preferredLanguage = language;
    await user.save();
    return res.json({ preferredLanguage: user.preferredLanguage });
  } catch (err) {
    console.error("[user/language:put]", err.message);
    return res.status(500).json({ error: "Could not update language preference." });
  }
});

/**
 * POST /api/user/language/french/request-otp
 * Generate + email a fresh OTP. Invalidates any previous OTP for this user.
 * Blocked while the user is in a failure lockout window.
 */
router.post("/language/french/request-otp", otpRequestLimiter, async (req, res) => {
  try {
    const { uid, email, name } = req.authUser;
    if (!email) {
      return res.status(400).json({
        error: "No email is associated with your account. Please sign in with an email address.",
      });
    }

    // Respect an active lockout before issuing anything new.
    const existing = await Otp.findOne({ uid, purpose: OTP_PURPOSE });
    if (existing && existing.lockedUntil && existing.lockedUntil > new Date()) {
      const retryAfter = Math.ceil((existing.lockedUntil - Date.now()) / 1000);
      return res.status(429).json({
        error: "Too many failed attempts. Please try again later.",
        retryAfterSeconds: retryAfter,
      });
    }

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    // Upsert = atomically invalidate any previous code for this purpose.
    await Otp.findOneAndUpdate(
      { uid, purpose: OTP_PURPOSE },
      {
        $set: {
          email,
          targetLanguage: FRENCH,
          hashedOtp: hashOtp(otp),
          attempts: 0,
          maxAttempts: MAX_ATTEMPTS,
          lockedUntil: null,
          expiresAt,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    let devMode = false;
    try {
      const result = await sendOtpEmail({
        to: email,
        name,
        otp,
        expiryMinutes: Math.round(OTP_TTL_MS / 60000),
      });
      devMode = result.devMode;
    } catch (mailErr) {
      console.error("[user/otp:request] email send failed:", mailErr.message);
      // Roll back so the user can retry cleanly instead of being stuck with an
      // OTP they never received.
      await Otp.deleteOne({ uid, purpose: OTP_PURPOSE });
      return res.status(502).json({
        error: "We couldn't send the verification email. Please try again.",
      });
    }

    return res.json({
      success: true,
      message: "A verification code has been sent to your registered email.",
      expiresInSeconds: Math.round(OTP_TTL_MS / 1000),
      // Only signals *that* the server is in console-dev mode; never the code.
      devMode,
    });
  } catch (err) {
    console.error("[user/otp:request]", err.message);
    return res.status(500).json({ error: "Could not generate a verification code." });
  }
});

/**
 * POST /api/user/language/french/verify-otp
 * Validate the code; on success set language = fr and delete the OTP.
 */
router.post("/language/french/verify-otp", otpVerifyLimiter, async (req, res) => {
  try {
    const { uid } = req.authUser;
    const candidate = String(req.body.otp || "").trim();

    // Input validation: must be exactly 6 digits.
    if (!/^\d{6}$/.test(candidate)) {
      return res.status(400).json({ error: "Enter the 6-digit code." });
    }

    const record = await Otp.findOne({ uid, purpose: OTP_PURPOSE });
    if (!record) {
      return res.status(400).json({
        error: "No active verification code. Please request a new one.",
        expired: true,
      });
    }

    // Active lockout.
    if (record.lockedUntil && record.lockedUntil > new Date()) {
      const retryAfter = Math.ceil((record.lockedUntil - Date.now()) / 1000);
      return res.status(429).json({
        error: "Too many failed attempts. Please try again later.",
        retryAfterSeconds: retryAfter,
      });
    }

    // Expiry (belt-and-braces alongside the TTL index).
    if (record.expiresAt <= new Date()) {
      await Otp.deleteOne({ _id: record._id });
      return res.status(400).json({
        error: "This code has expired. Please request a new one.",
        expired: true,
      });
    }

    // Atomically consume one attempt to avoid parallel-request bypass.
    const updated = await Otp.findOneAndUpdate(
      { _id: record._id },
      { $inc: { attempts: 1 } },
      { new: true }
    );
    if (!updated) {
      return res.status(400).json({
        error: "No active verification code. Please request a new one.",
        expired: true,
      });
    }

    // Too many attempts → lock and stop.
    if (updated.attempts > updated.maxAttempts) {
      const lockedUntil = new Date(Date.now() + LOCK_DURATION_MS);
      await Otp.updateOne({ _id: updated._id }, { $set: { lockedUntil } });
      return res.status(429).json({
        error: "Too many failed attempts. Please try again later.",
        retryAfterSeconds: Math.round(LOCK_DURATION_MS / 1000),
      });
    }

    const isValid = verifyOtp(candidate, updated.hashedOtp);
    if (!isValid) {
      const remaining = Math.max(0, updated.maxAttempts - updated.attempts);
      if (remaining === 0) {
        const lockedUntil = new Date(Date.now() + LOCK_DURATION_MS);
        await Otp.updateOne({ _id: updated._id }, { $set: { lockedUntil } });
        return res.status(429).json({
          error: "Too many failed attempts. Please try again later.",
          retryAfterSeconds: Math.round(LOCK_DURATION_MS / 1000),
        });
      }
      return res.status(400).json({
        error: "Incorrect code. Please try again.",
        attemptsRemaining: remaining,
      });
    }

    // Success — commit the language change and destroy the OTP (single use).
    const user = await getOrCreateUser(req.authUser);
    user.preferredLanguage = FRENCH;
    await user.save();
    await Otp.deleteOne({ _id: updated._id });

    return res.json({
      success: true,
      preferredLanguage: FRENCH,
      message: "French has been enabled for your account.",
    });
  } catch (err) {
    console.error("[user/otp:verify]", err.message);
    return res.status(500).json({ error: "Could not verify the code." });
  }
});

module.exports = router;
