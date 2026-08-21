/**
 * Integration smoke test for the new feature set:
 *  - Task 2: Resume builder payment flow (OTP → Razorpay order → payment → resume)
 *  - Task 3: Forgot password (once-per-day, letters-only password)
 *  - Task 4: Public Space (friends + posting limits + like/comment/share)
 *  - Task 5: Login history capture + Chrome OTP gate
 *  - Task 6: Subscription plans + application limit enforcement
 *
 * Run: MONGOMS_VERSION=8.0.4 node __smoketest__/features.test.js
 * Uses an in-memory MongoDB and the insecure-dev Firebase token. No external I/O.
 */
process.env.ALLOW_INSECURE_AUTH = "true";
process.env.OTP_HMAC_SECRET = "smoketest-pepper-0123456789abcdef";
process.env.OTP_DEV_CODE = "654321";

const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const User = require("../Model/User");

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use("/api", require("../Routes/index"));

function makeToken(uid, email, name) {
  const payload = Buffer.from(JSON.stringify({ user_id: uid, email, name })).toString("base64");
  return `header.${payload}.sig`;
}

const results = [];
function check(label, cond) {
  results.push({ label, ok: !!cond });
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
}

const A = makeToken("user-a", "alice@example.com", "Alice");
const B = makeToken("user-b", "bob@example.com", "Bob");
const authA = (r) => r.set("Authorization", `Bearer ${A}`);
const authB = (r) => r.set("Authorization", `Bearer ${B}`);

(async () => {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  await User.create({ uid: "user-a", email: "alice@example.com", name: "Alice", phone: "9876543210" });
  await User.create({ uid: "user-b", email: "bob@example.com", name: "Bob", phone: "9876543211" });

  /* ---------------- Task 3: Forgot password ---------------- */
  let res = await request(app).post("/api/auth/forgot-password").send({ email: "alice@example.com" });
  check("forgot-password (email) -> 200 success", res.status === 200 && res.body.success === true);

  res = await request(app).post("/api/auth/forgot-password").send({ email: "alice@example.com" });
  check("forgot-password second try same day -> 429", res.status === 429 && /once per day/i.test(res.body.error));

  res = await request(app).post("/api/auth/forgot-password").send({ phone: "9876543211" });
  check("forgot-password (phone) -> 200 success", res.status === 200 && res.body.success === true);

  res = await request(app).post("/api/auth/forgot-password").send({});
  check("forgot-password no identifier -> 400", res.status === 400);

    // Test unknown email
    res = await request(app).post("/api/auth/forgot-password").send({ email: "ghost@example.com" });
    check("forgot-password unknown email -> 200 with generic message", res.status === 200 && res.body.success === true && res.body.message.includes("If your email/phone is registered, you will receive a reset instructions."));
    // Test unknown phone
    res = await request(app).post("/api/auth/forgot-password").send({ phone: "0000000000" });
    check("forgot-password unknown phone -> 200 with generic message", res.status === 200 && res.body.success === true && res.body.message.includes("If your email/phone is registered, you will receive a reset instructions."));

  /* ---------------- Task 5: Login history ---------------- */
  res = await authA(
    request(app)
      .post("/api/auth/login-history")
      .set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36")
      .send({ method: "google" })
  );
  check("login-history desktop chrome -> 200 success", res.status === 200 && res.body.status === "success");

  res = await authA(request(app).get("/api/auth/login-history"));
  check("login-history list has 1 entry", res.status === 200 && res.body.data.length === 1);
  check("login-history has browser+os+device", res.body.data[0].browser === "Google Chrome" && res.body.data[0].os === "Windows 10" && res.body.data[0].deviceType === "desktop" && !!res.body.data[0].ipAddress);

  /* ---------------- Task 5: Chrome OTP gate ---------------- */
  res = await authA(request(app).post("/api/auth/chrome/request-otp"));
  check("chrome request-otp -> 200 devCodeEnabled", res.status === 200 && res.body.devCodeEnabled === true);
  res = await authA(request(app).post("/api/auth/chrome/verify-otp").send({ otp: "654321" }));
  check("chrome verify-otp dev code -> 200", res.status === 200 && res.body.success === true);

  /* ---------------- Task 2: Resume flow ---------------- */
  res = await authA(request(app).post("/api/resume/request-otp"));
  check("resume request-otp -> 200", res.status === 200);

  res = await authA(request(app).post("/api/resume/create-order"));
  check("resume create-order before OTP -> 403", res.status === 403 && res.body.otpRequired === true);

  res = await authA(request(app).post("/api/resume/verify-otp").send({ otp: "654321" }));
  check("resume verify-otp dev code -> 200", res.status === 200 && res.body.success === true);

  res = await authA(request(app).post("/api/resume/create-order"));
  check("resume create-order after OTP -> 200 dev order", res.status === 200 && /^order_dev_/.test(res.body.orderId) && res.body.devMode === true);

  res = await authA(
    request(app).post("/api/resume/verify-payment").send({
      orderId: res.body.orderId,
      paymentId: "pay_dev_test123",
      dev: true,
      resumeData: {
        name: "Alice",
        email: "alice@example.com",
        phone: "9876543210",
        qualifications: "B.Tech CSE\nHigher Secondary",
        experience: "Frontend Intern at TechCorp",
        personalInfo: "Full stack developer passionate about web.",
        skills: ["React", "Node.js", "MongoDB"],
      },
    })
  );
  check("resume verify-payment -> 200 with html", res.status === 200 && res.body.resume && res.body.resume.generatedHtml.includes("Alice"));

  res = await authA(request(app).get("/api/resume/me"));
  check("resume/me returns generated resume", res.status === 200 && res.body.data && res.body.data.name === "Alice");

  const aliceUser = await User.findOne({ uid: "user-a" });
  check("user marked premium + resume attached", aliceUser.premium === true && !!aliceUser.resumeId);

  /* ---------------- Task 4: Public Space ---------------- */
  res = await authA(request(app).get("/api/public/posts/limits"));
  check("posting limits with 0 friends -> 0/day", res.status === 200 && res.body.maxPerDay === 0 && res.body.friendCount === 0);

  res = await authA(request(app).post("/api/public/posts").send({ caption: "Hello" }));
  check("post with 0 friends -> 403", res.status === 403);

  res = await authA(request(app).post("/api/public/friends/request").send({ uid: "user-b" }));
  check("friend request -> 201", res.status === 201);
  res = await authA(request(app).post("/api/public/friends/request").send({ uid: "user-b" }));
  check("duplicate friend request -> 409", res.status === 409);
  res = await authB(request(app).post("/api/public/friends/accept").send({ requesterId: "user-a" }));
  check("friend accept -> 200", res.status === 200);
  res = await authA(request(app).get("/api/public/friends"));
  check("friends list count 1", res.status === 200 && res.body.count === 1);

  res = await authA(request(app).get("/api/public/posts/limits"));
  check("posting limits with 1 friend -> 1/day", res.status === 200 && res.body.maxPerDay === 1 && res.body.remaining === 1);

  res = await authA(request(app).post("/api/public/posts").send({ caption: "First post" }));
  check("post with 1 friend -> 201", res.status === 201);
  const postId = res.body.data._id;

  res = await authA(request(app).post("/api/public/posts").send({ caption: "Second post" }));
  check("second post same day -> 403", res.status === 403);

  res = await authB(request(app).post(`/api/public/posts/${postId}/like`));
  check("like post -> 200 likeCount 1", res.status === 200 && res.body.likeCount === 1);

  res = await authB(request(app).post(`/api/public/posts/${postId}/comment`).send({ text: "Nice!" }));
  check("comment post -> 201", res.status === 201);

  res = await authB(request(app).post(`/api/public/posts/${postId}/share`));
  check("share post -> 200 shares 1", res.status === 200 && res.body.shares === 1);

  res = await authA(request(app).get("/api/public/posts"));
  check("feed returns post with likeCount+likedByMe", res.status === 200 && res.body.data[0].likeCount === 1 && res.body.data[0].likedByMe === false);

  /* ---------------- Task 6: Subscription ---------------- */
  res = await authA(request(app).get("/api/subscription/me"));
  check("subscription/me defaults to free", res.status === 200 && res.body.data.plan === "free" && res.body.data.monthlyLimit === 1);

  res = await authA(request(app).post("/api/subscription/create-order").send({ plan: "bronze" }));
  check("create-order returns 200-or-403 (not 500)", res.status === 200 || res.status === 403);

  const apply = (body) =>
    request(app).post("/api/application").send({ ...body, user: { uid: "user-a", name: "Alice", email: "alice@example.com" } });
  res = await apply({ company: "Acme", category: "IT", coverLetter: "c1", Application: "x1" });
  check("first application accepted (free plan)", res.status === 200);
  res = await apply({ company: "Acme", category: "IT", coverLetter: "c2", Application: "x2" });
  check("second application blocked by free plan limit -> 403", res.status === 403 && res.body.reason === "plan-limit");

  /* ---------------- Task 7: Skills & Certifications (Superadmin) ---------------- */
  // Create a superadmin user for testing
  await User.create({
    uid: "superadmin",
    email: "superadmin@test.com",
    name: "Super Admin",
    role: "superadmin"
  });
  const superToken = makeToken("superadmin", "superadmin@test.com", "Super Admin");
  const authSuper = (r) => r.set("Authorization", `Bearer ${superToken}`);

  // Test skills GET (should work for any authenticated user)
  res = await authA(request(app).get("/api/skills"));
  check("skills GET -> 200 (any authenticated user)", res.status === 200 && Array.isArray(res.body.data));

  // Test skills POST (superadmin only)
  res = await authSuper(request(app).post("/api/skills").send({
    name: "JavaScript",
    description: "JavaScript programming language"
  }));
  check("skills POST superadmin -> 201", res.status === 201 && res.body.success === true && !!res.body.data._id);
  const skillId = res.body.data._id;

  // Test duplicate skill prevention
  res = await authSuper(request(app).post("/api/skills").send({
    name: "JavaScript",
    description: "JS language"
  }));
  check("skills POST duplicate -> 409", res.status === 409 && res.body.success === false);

  // Test skills assignment (superadmin only)
  res = await authSuper(request(app).post("/api/skills/assign").send({
    skillId,
    internId: aliceUser._id.toString()
  }));
  check("skills assign -> 200", res.status === 200 && res.body.success === true);

  // Test skills revoke (superadmin only)
  res = await authSuper(request(app).post("/api/skills/revoke").send({
    skillId,
    internId: aliceUser._id.toString()
  }));
  check("skills revoke -> 200", res.status === 200 && res.body.success === true);

  // Test certifications GET (should work for any authenticated user)
  res = await authA(request(app).get("/api/certifications"));
  check("certifications GET -> 200 (any authenticated user)", res.status === 200 && Array.isArray(res.body.data));

  // Test certifications POST (superadmin only)
  res = await authSuper(request(app).post("/api/certifications").send({
    internId: aliceUser._id.toString(),
    certificationName: "AWS Certified Developer",
    issuingOrganization: "Amazon Web Services",
    issueDate: "2024-01-15",
    credentialId: "AWS-123456789",
    credentialUrl: "https://www.credly.com/aws/123456789"
  }));
  check("certifications POST superadmin -> 201", res.status === 201 && res.body.success === true && !!res.body.data._id);
  const certId = res.body.data._id;

  // Test certifications GET by ID
  res = await authA(request(app).get(`/api/certifications/${certId}`));
  check("certifications GET/:id -> 200", res.status === 200 && res.body.success === true && res.body.data._id === certId);

  // Test certifications PUT (superadmin only)
  res = await authSuper(request(app).put(`/api/certifications/${certId}`).send({
    certificationName: "AWS Certified Developer Associate",
    issuingOrganization: "Amazon Web Services",
    issueDate: "2024-01-15",
    expirationDate: "2026-01-15",
    credentialId: "AWS-123456789-UPDATED",
    credentialUrl: "https://www.credly.com/aws/123456789-updated"
  }));
  check("certifications PUT superadmin -> 200", res.status === 200 && res.body.success === true && res.body.data.expirationDate !== null);

  // Test certifications DELETE (superadmin only)
  res = await authSuper(request(app).delete(`/api/certifications/${certId}`));
  check("certifications DELETE superadmin -> 200", res.status === 200 && res.body.success === true);

  await mongoose.disconnect();
  await mongod.stop();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length === 0 ? 0 : 1);
})().catch((err) => {
  console.error("FEATURES SMOKE TEST ERROR:", err);
  process.exit(1);
});
