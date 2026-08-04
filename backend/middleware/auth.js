const { getFirebaseAdmin } = require("../config/firebaseAdmin");
const { getAuth } = require("firebase-admin/auth");

/**
 * Authentication middleware.
 *
 * Expects:
 * Authorization: Bearer <firebase-id-token>
 */

function extractBearerToken(req) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token.trim();
}

/**
 * Decode a JWT payload without verifying the signature.
 * Used ONLY for explicit development fallback.
 */
function decodeUnverifiedJwt(token) {
  try {
    const parts = token.split(".");

    if (parts.length !== 3) {
      return null;
    }

    return JSON.parse(
      Buffer.from(parts[1], "base64").toString("utf8")
    );
  } catch {
    return null;
  }
}

async function verifyFirebaseUser(req, res, next) {
  const token = extractBearerToken(req);

  if (!token) {
    return res.status(401).json({
      error: "Authentication required. Missing bearer token.",
    });
  }

  const app = getFirebaseAdmin();

  /**
   * Production mode
   */
  if (app) {
    try {
      const decoded = await getAuth(app).verifyIdToken(token);

      req.authUser = {
        uid: decoded.uid,
        email: (decoded.email || "").toLowerCase(),
        name: decoded.name || "",
      };

      return next();
    } catch (err) {
      console.error("[auth] Firebase verification failed:", err);

      return res.status(401).json({
        error: "Invalid or expired authentication token.",
      });
    }
  }

  /**
   * Development fallback
   */
  if (String(process.env.ALLOW_INSECURE_AUTH).toLowerCase() === "true") {
    const payload = decodeUnverifiedJwt(token);

    if (!payload || (!payload.user_id && !payload.sub)) {
      return res.status(401).json({
        error: "Invalid authentication token.",
      });
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
      "Server authentication is not configured. Configure FIREBASE_SERVICE_ACCOUNT or enable ALLOW_INSECURE_AUTH=true for development only.",
  });
}

module.exports = {
  verifyFirebaseUser,
};
