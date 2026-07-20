const crypto = require("crypto");

/**
 * OTP utilities — cryptographically secure generation and tamper-resistant
 * hashing.
 *
 * Security model:
 *  - OTPs are generated with `crypto.randomInt` (CSPRNG), never Math.random.
 *  - We never store the plaintext OTP. We store an HMAC-SHA256 digest keyed by a
 *    server-side pepper (OTP_HMAC_SECRET). A plain SHA/bcrypt of a 6-digit code
 *    is brute-forceable in milliseconds if the DB leaks; the keyed HMAC means an
 *    attacker also needs the server secret.
 *  - Verification uses `crypto.timingSafeEqual` to avoid timing side channels.
 */

const OTP_LENGTH = 6;
const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS = 5;
const LOCK_DURATION_MS = 5 * 60 * 1000; // 5 minutes lockout after too many failures

/**
 * Lazily read the pepper so a missing env var fails loudly at first use rather
 * than at import time (keeps the module testable and the server bootable).
 */
function getPepper() {
  const secret = process.env.OTP_HMAC_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "OTP_HMAC_SECRET is missing or too short (min 16 chars). Refusing to generate/verify OTPs insecurely."
    );
  }
  return secret;
}

/** Generate a zero-padded numeric OTP using a CSPRNG. */
function generateOtp() {
  const max = 10 ** OTP_LENGTH; // exclusive upper bound
  const n = crypto.randomInt(0, max);
  return n.toString().padStart(OTP_LENGTH, "0");
}

/** Keyed HMAC-SHA256 digest of an OTP (hex). */
function hashOtp(otp) {
  return crypto
    .createHmac("sha256", getPepper())
    .update(String(otp))
    .digest("hex");
}

/** Constant-time comparison of a candidate OTP against a stored hash. */
function verifyOtp(candidate, storedHash) {
  if (!candidate || !storedHash) return false;
  const candidateHash = hashOtp(candidate);
  const a = Buffer.from(candidateHash, "hex");
  const b = Buffer.from(storedHash, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = {
  OTP_LENGTH,
  OTP_TTL_MS,
  MAX_ATTEMPTS,
  LOCK_DURATION_MS,
  generateOtp,
  hashOtp,
  verifyOtp,
};
