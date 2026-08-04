/**
 * Dev bootstrap: starts an in-memory MongoDB and launches the backend on PORT.
 * Usage: node boot.js
 * Env: PORT (default 5000)
 */
const { MongoMemoryServer } = require("mongodb-memory-server");

(async () => {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  process.env.DATABASE_URL = uri;
  process.env.OTP_HMAC_SECRET = process.env.OTP_HMAC_SECRET || "dev-only-long-hmac-secret-0123456789";
  process.env.ALLOW_INSECURE_AUTH = "true";
  process.env.OTP_DEV_CODE = process.env.OTP_DEV_CODE || "123456";
  console.log("[boot] in-memory MongoDB:", uri);
  require("./index.js");
})();
