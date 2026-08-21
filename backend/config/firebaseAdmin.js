const { initializeApp, cert, getApps } = require("firebase-admin/app");

let app = null;
let initialised = false;
let available = false;

function loadServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;

  try {
    if (raw) return JSON.parse(raw);

    if (b64) {
      return JSON.parse(
        Buffer.from(b64, "base64").toString("utf8")
      );
    }
  } catch (err) {
    console.error("[firebaseAdmin] Failed to parse credentials:");
    console.error(err);
    return null;
  }

  return null;
}

function getFirebaseAdmin() {
  if (initialised) {
    return available ? app : null;
  }

  initialised = true;

  const serviceAccount = loadServiceAccount();

  if (!serviceAccount) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Firebase Admin credentials are required in production. Set FIREBASE_SERVICE_ACCOUNT or FIREBASE_SERVICE_ACCOUNT_BASE64.');
    }
    console.warn('[firebaseAdmin] No Firebase Admin credentials provided. Running in development mode without Firebase Admin.');
    available = false;
    return null;
  }

  try {
    app = getApps().length
      ? getApps()[0]
      : initializeApp({
          credential: cert(serviceAccount),
        });

    console.log("[firebaseAdmin] Firebase Admin initialized.");

    available = true;
    return app;
  } catch (err) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Firebase Admin initialization failed in production: ${err.message}`);
    }
    console.error('[firebaseAdmin] Initialization failed (development):', err);
    available = false;
    return null;
  }
}

module.exports = { getFirebaseAdmin };