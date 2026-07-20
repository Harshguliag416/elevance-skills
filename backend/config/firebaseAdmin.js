const admin = require("firebase-admin");

/**
 * Lazily initialise the Firebase Admin SDK.
 *
 * Credentials are read from env so no secret is committed:
 *   Option A: FIREBASE_SERVICE_ACCOUNT — the full service-account JSON (stringified).
 *   Option B: FIREBASE_SERVICE_ACCOUNT_BASE64 — the same JSON, base64-encoded
 *             (handy for single-line env vars on hosts like Render).
 *
 * If neither is set, `getFirebaseAdmin()` returns null and the auth middleware
 * falls back to a clearly-flagged development mode.
 */

let initialised = false;
let available = false;

function loadServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;

  try {
    if (raw) return JSON.parse(raw);
    if (b64) return JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  } catch (err) {
    console.error(
      "[firebaseAdmin] Failed to parse service account credentials:",
      err.message
    );
  }
  return null;
}

function getFirebaseAdmin() {
  if (initialised) return available ? admin : null;
  initialised = true;

  const serviceAccount = loadServiceAccount();
  if (!serviceAccount) {
    available = false;
    return null;
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    available = true;
    return admin;
  } catch (err) {
    console.error("[firebaseAdmin] Initialisation failed:", err.message);
    available = false;
    return null;
  }
}

module.exports = { getFirebaseAdmin };
