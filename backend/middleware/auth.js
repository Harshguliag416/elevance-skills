const { getFirebaseAdmin } = require("../config/firebaseAdmin");

/**
 * Authentication middleware.
 *
 * Expects: `Authorization: Bearer <firebase-id-token>`.
 *
 * Production path: verifies the ID token with the Firebase Admin SDK and
 * populates `req.authUser = { uid, email, name }` from the *verified* token.
 * The client can never spoof identity because the token is signed by Google.
 *
 * Development fallback: if the Admin SDK is not configured (no service account),
 * the server accepts an unverified token payload ONLY when
 * `ALLOW_INSECURE_AUTH=true`. This lets the flow be demoed locally without
 * credentials, but is loudly logged and must never be enabled in production.
 */

function extractBearerToken(req) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token.trim();
}

/** base64url-decode the payload of a JWT without verifying the signature. */
function decodeUnverifiedJwt(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64").toString("utf8")
    );
    return payload;
  } catch {
    return null;
  }
}

async function verifyFirebaseUser(req, res, next) {
  const token = extractBearerToken(req);
  if (!token) {
    return res
      .status(401)
      .json({ error: "Authentication required. Missing bearer token." });
  }

  const adminSdk = getFirebaseAdmin();

  // Production path — cryptographically verify the token.
  if (adminSdk) {
    try {
      const decoded = await adminSdk.auth().verifyIdToken(token);
      req.authUser = {
        uid: decoded.uid,
        email: (decoded.email || "").toLowerCase(),
        name: decoded.name || "",
      };
      return next();
    } catch (err) {
      return res
        .status(401)
        .json({ error: "Invalid or expired authentication token." });
    }
  }

  // Development fallback — explicit opt-in only.
  if (String(process.env.ALLOW_INSECURE_AUTH).toLowerCase() === "true") {
    const payload = decodeUnverifiedJwt(token);
    if (!payload || !payload.user_id && !payload.sub) {
      return res
        .status(401)
        .json({ error: "Invalid authentication token." });
    }
    console.warn(
      "[auth] INSECURE dev mode: accepting unverified Firebase token. Do NOT use in production."
    );
    req.authUser = {
      uid: payload.user_id || payload.sub,
      email: (payload.email || "").toLowerCase(),
      name: payload.name || "",
    };
    return next();
  }

  return res.status(500).json({
    error:
      "Server auth is not configured. Set FIREBASE_SERVICE_ACCOUNT (production) or ALLOW_INSECURE_AUTH=true (development).",
  });
}

module.exports = { verifyFirebaseUser };
