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
  const app = getFirebaseAdmin();

  /**
   * Development fallback - only allowed when ALLOW_INSECURE_AUTH=true
   */
  if (String(process.env.ALLOW_INSECURE_AUTH).toLowerCase() === "true") {
    let uid = null;
    let email = "";
    let name = "";

    // Try to get uid from token first (if provided)
    if (token) {
      const payload = decodeUnverifiedJwt(token);
      if (payload && (payload.user_id || payload.sub)) {
        uid = payload.user_id || payload.sub;
        email = (payload.email || "").toLowerCase();
        name = payload.name || "";
      }
    }

    // Fallback to dev header
    if (!uid) {
      const devUid = req.headers["x-dev-uid"];
      if (devUid) {
        uid = devUid.toString();
        // email and name unknown; we will fetch from DB below
        email = "";
        name = "";
      }
    }

    if (!uid) {
      return res.status(401).json({
        error: "Invalid authentication token.",
      });
    }

    // In dev mode, if we have a uid but no email/name (from token or header), fetch from DB
    if ((!email || !name) && uid) {
      try {
        const User = require("../Model/User");
        const user = await User.findOne({ uid });
        if (user) {
          email = user.email || "";
          name = user.name || "";
        }
      } catch (dbErr) {
        console.error("[auth] Dev mode DB lookup failed:", dbErr);
        // If DB lookup fails, we continue with empty email/name (may cause route errors)
      }
    }

    console.warn(
      "[auth] INSECURE dev mode: accepting request via X-Dev-UID or unverified Firebase token. Do NOT use in production."
    );

    req.authUser = {
      uid,
      email,
      name,
    };

    return next();
  }

  /**
   * Production mode - verify with Firebase Admin SDK
   */
  if (app) {
    if (!token) {
      return res.status(401).json({
        error: "Authentication required. Missing bearer token.",
      });
    }

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

  return res.status(500).json({
    error:
      "Server authentication is not configured. Configure FIREBASE_SERVICE_ACCOUNT or enable ALLOW_INSECURE_AUTH=true for development only.",
  });
}

module.exports = {
  verifyFirebaseUser,
};