const express = require("express");
const router = express.Router();

const User = require("../Model/User");
const Otp = require("../Model/Otp");
const PasswordReset = require("../Model/PasswordReset");
const LoginHistory = require("../Model/LoginHistory");
const { verifyFirebaseUser } = require("../middleware/auth");
const {
  otpRequestLimiter,
  otpVerifyLimiter,
  passwordResetLimiter,
  loginHistoryLimiter,
} = require("../middleware/rateLimit");
const { getFirebaseAdmin } = require("../config/firebaseAdmin");
const { sendOtpEmail, sendResetPasswordEmail } = require("../utils/email");
const {
  generateOtp,
  hashOtp,
  verifyOtp,
  isDevCode,
  OTP_TTL_MS,
  MAX_ATTEMPTS,
  LOCK_DURATION_MS,
} = require("../utils/otp");
const { generateLetterPassword } = require("../utils/passwordGenerator");
const { parseUserAgent } = require("../utils/deviceInfo");
const { isMobileLoginWindow, istClock } = require("../utils/timeWindow");

const CHROME_PURPOSE = "chrome_login";
const RESET_COOLDOWN_MS = 24 * 60 * 60 * 1000; // once per day

/** Resolve a client IP behind proxies. */
function getClientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string") return fwd.split(",")[0].trim();
  if (req.socket && req.socket.remoteAddress) return req.socket.remoteAddress;
  return "";
}

/** Normalize an email or phone identifier for the once-per-day rule. */
function normalizeIdentifier({ email, phone }) {
  if (email) return { type: "email", value: String(email).trim().toLowerCase() };
  if (phone) {
    const digits = String(phone).replace(/\D/g, "");
    return { type: "phone", value: digits };
  }
  return null;
}

/**
 * Resolve a Firebase UID + email from an email or phone.
 * Uses the Admin SDK when available, otherwise falls back to the User profile
 * collection (useful for the insecure dev mode and for phone lookups).
 */
async function resolveAccount({ type, value }) {
  const adminSdk = getFirebaseAdmin();

  if (type === "email") {
    if (adminSdk) {
      try {
        const rec = await adminSdk.auth().getUserByEmail(value);
        return { uid: rec.uid, email: rec.email, name: rec.displayName || "" };
      } catch (err) {
        if (err.code === "auth/user-not-found") return null;
        throw err;
      }
    }
    const user = await User.findOne({ email: value });
    return user ? { uid: user.uid, email: user.email, name: user.name } : null;
  }

  // Phone lookup — always via the User profile collection.
  const user = await User.findOne({ phone: value });
  if (!user) return null;
  return { uid: user.uid, email: user.email, name: user.name };
}

/**
 * POST /api/auth/forgot-password
 * Body: { email } | { phone }
 * Resets the password to a newly generated letters-only password and emails it.
 * Allowed only once per day per identifier.
 */
router.post("/forgot-password", passwordResetLimiter, async (req, res) => {
  try {
    const id = normalizeIdentifier(req.body || {});
    if (!id) {
      return res
        .status(400)
        .json({ error: "Provide either your registered email or phone number." });
    }

    // Once-per-day guard.
    const existing = await PasswordReset.findOne({ identifier: id.value });
    if (
      existing &&
      existing.lastRequestedAt &&
      Date.now() - existing.lastRequestedAt.getTime() < RESET_COOLDOWN_MS
    ) {
      return res.status(429).json({
        error: "You can use this option only once per day.",
        cooldownMs: RESET_COOLDOWN_MS - (Date.now() - existing.lastRequestedAt.getTime()),
      });
    }

    let account;
    try {
      account = await resolveAccount(id);
    } catch (err) {
      console.error("[auth/forgot-password] resolve error:", err.message);
      return res
        .status(500)
        .json({ error: "Could not look up your account. Please try again." });
    }
    if (!account) {
      return res.status(404).json({
        error:
          id.type === "email"
            ? "No account is registered with this email."
            : "No account is registered with this phone number.",
      });
    }
    if (!account.email) {
      return res
        .status(400)
        .json({ error: "No email is attached to this account, so a reset cannot be delivered." });
    }

    const newPassword = generateLetterPassword();
    let adminUpdated = false;
    const adminSdk = getFirebaseAdmin();
    if (adminSdk) {
      try {
        await adminSdk.auth().updateUser(account.uid, { password: newPassword });
        adminUpdated = true;
      } catch (err) {
        console.error("[auth/forgot-password] admin update error:", err.message);
        return res
          .status(500)
          .json({ error: "Could not update your password. Please try again." });
      }
    }

    let devMode = !adminUpdated;
    try {
      const result = await sendResetPasswordEmail({
        to: account.email,
        name: account.name,
        password: newPassword,
      });
      if (result.devMode) devMode = true;
    } catch (mailErr) {
      console.error("[auth/forgot-password] email error:", mailErr.message);
      return res
        .status(502)
        .json({ error: "We couldn't email the new password. Please try again." });
    }

    // Record the request so the once-per-day rule holds.
    await PasswordReset.findOneAndUpdate(
      { identifier: id.value },
      { $set: { lastRequestedAt: new Date() } },
      { upsert: true, new: true }
    );

    return res.json({
      success: true,
      message: "A new password has been generated and sent to your registered email.",
      devMode,
    });
  } catch (err) {
    console.error("[auth/forgot-password]", err.message);
    return res.status(500).json({ error: "Could not reset your password." });
  }
});

/**
 * POST /api/auth/login-history
 * Body: { method }
 * Records browser/OS/device/IP for the login. Mobile logins outside the
 * 10:00–13:00 IST window are blocked and recorded as such.
 */
router.post("/login-history", verifyFirebaseUser, loginHistoryLimiter, async (req, res) => {
  try {
    const { uid, email } = req.authUser;
    const ua = req.headers["user-agent"] || "";
    const info = parseUserAgent(ua);
    const ip = getClientIp(req);
    const method = ["google", "email", "phone"].includes(req.body?.method)
      ? req.body.method
      : "google";

    // Security rule: mobile devices only between 10:00 and 13:00 IST.
    let status = "success";
    let reason = "";
    if (info.deviceType === "mobile" && !isMobileLoginWindow()) {
      status = "blocked";
      reason = "mobile-time-window";
    }

    await LoginHistory.create({
      uid,
      email,
      method,
      browser: info.browser,
      os: info.os,
      deviceType: info.deviceType,
      ipAddress: ip,
      status,
      reason,
    });

    if (status === "blocked") {
      return res.status(403).json({
        error: "Mobile access is only allowed between 10:00 AM and 1:00 PM IST.",
        reason,
        istNow: istClock(),
        allowedFrom: "10:00 AM",
        allowedTo: "1:00 PM",
      });
    }

    return res.json({ success: true, status: "success" });
  } catch (err) {
    console.error("[auth/login-history:post]", err.message);
    return res.status(500).json({ error: "Could not record login history." });
  }
});

/** GET /api/auth/login-history — the current user's recent login activity. */
router.get("/login-history", verifyFirebaseUser, async (req, res) => {
  try {
    const rows = await LoginHistory.find({ uid: req.authUser.uid })
      .sort({ createdAt: -1 })
      .limit(50);
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("[auth/login-history:get]", err.message);
    return res.status(500).json({ error: "Could not fetch login history." });
  }
});

/** POST /api/auth/chrome/request-otp — email OTP that gates Chrome logins. */
router.post("/chrome/request-otp", verifyFirebaseUser, otpRequestLimiter, async (req, res) => {
  try {
    const { uid, email, name } = req.authUser;
    if (!email) {
      return res.status(400).json({
        error: "No email is associated with your account. Please sign in with an email address.",
      });
    }

    const existing = await Otp.findOne({ uid, purpose: CHROME_PURPOSE });
    if (existing && existing.lockedUntil && existing.lockedUntil > new Date()) {
      const retryAfter = Math.ceil((existing.lockedUntil - Date.now()) / 1000);
      return res.status(429).json({
        error: "Too many failed attempts. Please try again later.",
        retryAfterSeconds: retryAfter,
      });
    }

    const otp = generateOtp();
    await Otp.findOneAndUpdate(
      { uid, purpose: CHROME_PURPOSE },
      {
        $set: {
          email,
          hashedOtp: hashOtp(otp),
          attempts: 0,
          maxAttempts: MAX_ATTEMPTS,
          lockedUntil: null,
          expiresAt: new Date(Date.now() + OTP_TTL_MS),
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
      console.error("[auth/chrome:request] email send failed:", mailErr.message);
      await Otp.deleteOne({ uid, purpose: CHROME_PURPOSE });
      return res.status(502).json({
        error: "We couldn't send the verification email. Please try again.",
      });
    }

    return res.json({
      success: true,
      message: "A verification code has been sent to your registered email.",
      expiresInSeconds: Math.round(OTP_TTL_MS / 1000),
      devMode,
      devCodeEnabled: Boolean(process.env.OTP_DEV_CODE),
      devCode: devMode ? process.env.OTP_DEV_CODE || null : null,
    });
  } catch (err) {
    console.error("[auth/chrome:request]", err.message);
    return res.status(500).json({ error: "Could not generate a verification code." });
  }
});

/** POST /api/auth/chrome/verify-otp — confirm the code and unlock access. */
router.post("/chrome/verify-otp", verifyFirebaseUser, otpVerifyLimiter, async (req, res) => {
  try {
    const { uid } = req.authUser;
    const candidate = String(req.body.otp || "").trim();

    if (!/^\d{6}$/.test(candidate)) {
      return res.status(400).json({ error: "Enter the 6-digit code." });
    }

    const record = await Otp.findOne({ uid, purpose: CHROME_PURPOSE });
    if (!record) {
      return res.status(400).json({
        error: "No active verification code. Please request a new one.",
        expired: true,
      });
    }
    if (record.lockedUntil && record.lockedUntil > new Date()) {
      const retryAfter = Math.ceil((record.lockedUntil - Date.now()) / 1000);
      return res.status(429).json({
        error: "Too many failed attempts. Please try again later.",
        retryAfterSeconds: retryAfter,
      });
    }
    if (record.expiresAt <= new Date()) {
      await Otp.deleteOne({ _id: record._id });
      return res.status(400).json({
        error: "This code has expired. Please request a new one.",
        expired: true,
      });
    }

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

    if (updated.attempts > updated.maxAttempts) {
      const lockedUntil = new Date(Date.now() + LOCK_DURATION_MS);
      await Otp.updateOne({ _id: updated._id }, { $set: { lockedUntil } });
      return res.status(429).json({
        error: "Too many failed attempts. Please try again later.",
        retryAfterSeconds: Math.round(LOCK_DURATION_MS / 1000),
      });
    }

    const isValid = verifyOtp(candidate, updated.hashedOtp) || isDevCode(candidate);
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

    // Single use — consume and delete.
    await Otp.deleteOne({ _id: updated._id });

    return res.json({
      success: true,
      message: "Verification successful. Access granted.",
    });
  } catch (err) {
    console.error("[auth/chrome:verify]", err.message);
    return res.status(500).json({ error: "Could not verify the code." });
  }
});

module.exports = router;
