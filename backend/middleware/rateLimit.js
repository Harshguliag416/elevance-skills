const rateLimit = require("express-rate-limit");
const { ipKeyGenerator } = require("express-rate-limit");

/**
 * Rate limiters for abuse-sensitive endpoints.
 *
 * These are a coarse network-level guard (per IP + per authenticated user).
 * Fine-grained, correctness-critical limits (max attempts, lockout, one active
 * OTP per user) are enforced in the DB layer inside the route handlers so they
 * survive multiple server instances.
 */

// Key by authenticated uid when available, else by IP. The IP branch uses the
// library's ipKeyGenerator helper so IPv6 addresses are normalised (prefix) and
// cannot be used to bypass the limit one address at a time.
const keyByUser = (req, res) =>
  (req.authUser && req.authUser.uid) || ipKeyGenerator(req, res);

/** OTP generation: max 5 requests / 15 min per user. */
const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUser,
  message: {
    error:
      "Too many verification requests. Please wait a few minutes before trying again.",
  },
});

/** OTP verification: max 15 attempts / 15 min per user (defence in depth). */
const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUser,
  message: {
    error: "Too many attempts. Please wait a few minutes before trying again.",
  },
});

/** Password reset requests: max 5 / 15 min per user. */
const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUser,
  message: {
    error: "Too many reset requests. Please wait a few minutes before trying again.",
  },
});

/** Login-history write: max 30 / 15 min per user. */
const loginHistoryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUser,
  message: {
    error: "Too many requests. Please wait a few minutes before trying again.",
  },
});

module.exports = {
  otpRequestLimiter,
  otpVerifyLimiter,
  passwordResetLimiter,
  loginHistoryLimiter,
};
