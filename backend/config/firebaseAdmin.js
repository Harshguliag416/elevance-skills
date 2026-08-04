const admin = require("firebase-admin");

let initialised = false;
let available = false;

function loadServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;

  console.log("========== FIREBASE DEBUG ==========");
  console.log("FIREBASE_SERVICE_ACCOUNT exists:", !!raw);
  console.log("FIREBASE_SERVICE_ACCOUNT_BASE64 exists:", !!b64);

  try {
    if (raw) {
      const parsed = JSON.parse(raw);
      console.log("Project ID:", parsed.project_id);
      console.log("Client Email:", parsed.client_email);
      console.log("====================================");
      return parsed;
    }

    if (b64) {
      const parsed = JSON.parse(
        Buffer.from(b64, "base64").toString("utf8")
      );
      console.log("Project ID:", parsed.project_id);
      console.log("Client Email:", parsed.client_email);
      console.log("====================================");
      return parsed;
    }
  } catch (err) {
    console.error("[firebaseAdmin] Failed to parse credentials");
    console.error(err);
    return null;
  }

  return null;
}

function getFirebaseAdmin() {
  if (initialised) {
    return available ? admin : null;
  }

  initialised = true;

  const serviceAccount = loadServiceAccount();

  if (!serviceAccount) {
    console.error("[firebaseAdmin] No service account found.");
    available = false;
    return null;
  }

  try {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }

    console.log("[firebaseAdmin] Firebase Admin initialized successfully.");

    available = true;
    return admin;
  } catch (err) {
    console.error("[firebaseAdmin] Initialization failed:");
    console.error(err);
    console.error(err.stack);

    available = false;
    return null;
  }
}

module.exports = { getFirebaseAdmin };

