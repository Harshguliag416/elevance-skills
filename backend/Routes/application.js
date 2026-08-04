const express = require("express");
const router = express.Router();
const application = require("../Model/Application");
const Subscription = require("../Model/Subscription");
const { planLimit } = require("../utils/plans");

const PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

/** Roll expired periods forward, resetting usage. */
function rollover(sub) {
  if (sub.status !== "active") {
    sub.status = "active";
    sub.periodStart = new Date();
    sub.periodEnd = new Date(Date.now() + PERIOD_MS);
    sub.applicationsUsed = 0;
    return sub;
  }
  if (sub.periodEnd && sub.periodEnd <= new Date()) {
    sub.periodStart = new Date();
    sub.periodEnd = new Date(Date.now() + PERIOD_MS);
    sub.applicationsUsed = 0;
  }
  return sub;
}

async function getOrCreateSubscription(uid) {
  let sub = await Subscription.findOne({ uid });
  if (!sub) {
    sub = await Subscription.create({
      uid,
      plan: "free",
      status: "active",
      periodStart: new Date(),
      periodEnd: new Date(Date.now() + PERIOD_MS),
    });
  }
  return rollover(sub);
}

/** Resolve the applicant uid from the auth token or the embedded user object. */
function resolveUid(req) {
  if (req.authUser && req.authUser.uid) return req.authUser.uid;
  return req.body?.user?.uid || req.body?.uid || null;
}

router.post("/", async (req, res) => {
  const uid = resolveUid(req);

  // Enforce the subscription plan limit before accepting the application.
  if (uid) {
    const sub = await getOrCreateSubscription(uid);
    const limit = planLimit(sub.plan);
    if (limit !== Infinity && sub.applicationsUsed >= limit) {
      return res.status(403).json({
        error: `You have reached the ${limit} application(s) limit for your current plan.`,
        reason: "plan-limit",
        plan: sub.plan,
        monthlyLimit: limit,
        used: sub.applicationsUsed,
      });
    }
    sub.applicationsUsed += 1;
    await sub.save();
  }

  const applicationipdata = new application({
    company: req.body.company,
    category: req.body.category,
    coverLetter: req.body.coverLetter,
    user: req.body.user,
    Application: req.body.Application,
    body: req.body.body,
  });
  try {
    const data = await applicationipdata.save();
    res.send(data);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "internal server error" });
  }
});
router.get("/", async (req, res) => {
  try {
    const data = await application.find();
    res.json(data).status(200);
  } catch (error) {
    console.log(error);
    res.status(404).json({ error: "internal server error" });
  }
});
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const data = await application.findById(id);
    if (!data) {
      res.status(404).json({ error: "application not found" });
    }
    res.json(data).status(200);
  } catch (error) {
    console.log(error);
    res.status(404).json({ error: "internal server error" });
  }
});
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { action } = req.body;
  let status;
  if (action === "accepted") {
    status = "accepted";
  } else if (action === "rejected") {
    status = "rejected";
  } else {
    res.status(404).json({ error: "Invalid action" });
    return;
  }
  try {
    const updateapplication = await application.findByIdAndUpdate(
      id,
      { $set: { status } },
      { new: true }
    );
    if (!updateapplication) {
      res.status(404).json({ error: "Not able to update the application" });
      return;
    }
    res.status(200).json({ sucess: true, data: updateapplication });
  } catch (error) {
    res.status(500).json({ error: "internal server error" });
  }
});
module.exports = router;
