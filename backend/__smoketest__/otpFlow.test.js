/**
 * Standalone integration smoke test for the language + OTP flow.
 * Run with: node __smoketest__/otpFlow.test.js
 * Uses an in-memory MongoDB and an insecure-dev Firebase token. No external I/O.
 */
process.env.ALLOW_INSECURE_AUTH = "true";
process.env.OTP_HMAC_SECRET = "smoketest-pepper-0123456789abcdef";
// No SMTP -> email runs in dev mode (console), never returns the code.

const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const otpUtil = require("../utils/otp");

// Capture the OTP the "email" would contain by spying on generateOtp.
let lastOtp = null;
const realGenerate = otpUtil.generateOtp;
otpUtil.generateOtp = () => {
  lastOtp = realGenerate();
  return lastOtp;
};

const userRouter = require("../Routes/user");

function makeToken(uid, email, name) {
  const payload = Buffer.from(
    JSON.stringify({ user_id: uid, email, name })
  ).toString("base64");
  return `header.${payload}.sig`;
}

const results = [];
function check(label, cond) {
  results.push({ label, ok: !!cond });
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
}

(async () => {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  const app = express();
  app.use(express.json());
  app.use("/api/user", userRouter);

  const token = makeToken("user-1", "test@example.com", "Test User");
  const auth = (r) => r.set("Authorization", `Bearer ${token}`);

  // 1) sync creates profile with default language
  let res = await auth(request(app).post("/api/user/sync"));
  check("sync returns default language en", res.body.preferredLanguage === "en");

  // 2) switch to Spanish (no verification)
  res = await auth(request(app).put("/api/user/language").send({ language: "es" }));
  check("PUT es -> es", res.status === 200 && res.body.preferredLanguage === "es");

  // 3) unsupported language rejected
  res = await auth(request(app).put("/api/user/language").send({ language: "de" }));
  check("PUT unsupported -> 400", res.status === 400);

  // 4) French via PUT rejected (needs verification)
  res = await auth(request(app).put("/api/user/language").send({ language: "fr" }));
  check("PUT fr -> 403 verificationRequired", res.status === 403 && res.body.verificationRequired === true);

  // 5) no auth token -> 401
  res = await request(app).get("/api/user/language");
  check("GET language no token -> 401", res.status === 401);

  // 6) request OTP for French
  res = await auth(request(app).post("/api/user/language/french/request-otp"));
  check("request-otp 200 + devMode true", res.status === 200 && res.body.devMode === true);
  check("request-otp NEVER returns the code", !JSON.stringify(res.body).includes(lastOtp));

  // 7) wrong OTP -> 400 with attemptsRemaining
  res = await auth(request(app).post("/api/user/language/french/verify-otp").send({ otp: "000000" }));
  const wrongCode = lastOtp === "000000" ? "000001" : "000000";
  res = await auth(request(app).post("/api/user/language/french/verify-otp").send({ otp: wrongCode }));
  check("wrong otp -> 400 attemptsRemaining", res.status === 400 && typeof res.body.attemptsRemaining === "number");

  // 8) malformed OTP -> 400
  res = await auth(request(app).post("/api/user/language/french/verify-otp").send({ otp: "12" }));
  check("malformed otp -> 400", res.status === 400);

  // 9) correct OTP -> success, language becomes fr
  res = await auth(request(app).post("/api/user/language/french/verify-otp").send({ otp: lastOtp }));
  check("correct otp -> 200 fr", res.status === 200 && res.body.preferredLanguage === "fr");

  // 10) OTP deleted after success -> verifying again fails
  res = await auth(request(app).post("/api/user/language/french/verify-otp").send({ otp: lastOtp }));
  check("otp single-use (deleted) -> 400 expired", res.status === 400 && res.body.expired === true);

  // 11) lockout after 5 failed attempts
  await auth(request(app).post("/api/user/language/french/request-otp"));
  const good = lastOtp;
  let lockoutHit = false;
  for (let i = 0; i < 6; i++) {
    const bad = good === "111111" ? "222222" : "111111";
    const r = await auth(request(app).post("/api/user/language/french/verify-otp").send({ otp: bad }));
    if (r.status === 429) lockoutHit = true;
  }
  check("lockout after too many attempts -> 429", lockoutHit);

  // 12) new OTP blocked during lockout
  res = await auth(request(app).post("/api/user/language/french/request-otp"));
  check("request-otp blocked during lockout -> 429", res.status === 429 && typeof res.body.retryAfterSeconds === "number");

  await mongoose.disconnect();
  await mongod.stop();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length === 0 ? 0 : 1);
})().catch((err) => {
  console.error("SMOKE TEST ERROR:", err);
  process.exit(1);
});
