const express = require("express");
const router = express.Router();
const crypto = require("crypto");

const Subscription = require("../Model/Subscription");
const PaymentSession = require("../Model/PaymentSession");
const { verifyFirebaseUser } = require("../middleware/auth");
const { createOrder, verifyPaymentSignature } = require("../utils/razorpay");
const { PLANS, PLAN_IDS, getPlan, planLimit } = require("../utils/plans");
const { isPaymentWindow, istClock } = require("../utils/timeWindow");
const { sendInvoiceEmail } = require("../utils/email");

const PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

/** Roll an expired subscription period forward, resetting usage. */
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

/** Fetch the current subscription, upserting a free plan when none exists. */
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

function present(sub) {
  const plan = getPlan(sub.plan);
  const limit = plan.limit || planLimit(sub.plan);
  return {
    plan: sub.plan,
    planName: plan.name,
    status: sub.status,
    periodStart: sub.periodStart,
    periodEnd: sub.periodEnd,
    applicationsUsed: sub.applicationsUsed,
    monthlyLimit: limit,
    unlimited: plan.unlimited,
    remaining: plan.unlimited
      ? Infinity
      : Math.max(0, limit - sub.applicationsUsed),
    invoiceNo: sub.invoiceNo,
    amount: sub.amount,
  };
}

/** GET /api/subscription/plans — the static plan catalogue. */
router.get("/plans", verifyFirebaseUser, async (req, res) => {
  return res.json({
    success: true,
    plans: Object.values(PLANS).map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      pricePaise: p.pricePaise,
      monthlyLimit: p.monthlyLimit === Infinity ? "Unlimited" : p.monthlyLimit,
      unlimited: p.unlimited,
    })),
  });
});

/** GET /api/subscription/me — current plan + usage. */
router.get("/me", verifyFirebaseUser, async (req, res) => {
  try {
    const sub = await getOrCreateSubscription(req.authUser.uid);
    await sub.save();
    return res.json({ success: true, data: present(sub) });
  } catch (err) {
    console.error("[subscription/me]", err.message);
    return res.status(500).json({ error: "Could not fetch your subscription." });
  }
});

/**
 * POST /api/subscription/create-order
 * Body: { plan }
 * Payments are only allowed between 10:00 AM and 11:00 AM IST.
 */
router.post("/create-order", verifyFirebaseUser, async (req, res) => {
  try {
    const { uid, email } = req.authUser;
    const planId = String(req.body?.plan || "").trim().toLowerCase();
    if (!PLAN_IDS.includes(planId) || planId === "free") {
      return res.status(400).json({ error: "Invalid plan." });
    }

    if (!isPaymentWindow()) {
      return res.status(403).json({
        error: "Payments are only allowed between 10:00 AM and 11:00 AM IST.",
        reason: "payment-window",
        istNow: istClock(),
        allowedFrom: "10:00 AM",
        allowedTo: "11:00 AM",
      });
    }

    const plan = getPlan(planId);
    const order = await createOrder({
      amountPaise: plan.pricePaise,
      receipt: `sub-${planId}-${uid.slice(-6)}`,
      notes: { purpose: "subscription", plan: planId, uid, email },
    });

    await PaymentSession.findOneAndUpdate(
      { uid, purpose: "subscription" },
      {
        $set: {
          uid,
          purpose: "subscription",
          email: email || "",
          otpVerified: true,
          orderId: order.id,
          amount: plan.pricePaise,
          plan: planId,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        },
      },
      { upsert: true, new: true }
    );

    return res.json({
      success: true,
      orderId: order.id,
      amount: plan.price,
      amountPaise: plan.pricePaise,
      currency: "INR",
      plan: planId,
      keyId: process.env.RAZORPAY_KEY_ID || null,
      devMode: !!order.devMode,
    });
  } catch (err) {
    console.error("[subscription:create-order]", err.message);
    return res.status(500).json({ error: "Could not create the payment order." });
  }
});

/**
 * POST /api/subscription/verify-payment
 * Body: { plan, orderId, paymentId, signature, dev }
 * Activates the plan, sends the invoice email with plan details.
 */
router.post("/verify-payment", verifyFirebaseUser, async (req, res) => {
  try {
    const { uid, email, name } = req.authUser;
    const { plan: planId, orderId, paymentId, signature, dev } = req.body || {};
    if (!PLAN_IDS.includes(planId)) {
      return res.status(400).json({ error: "Invalid plan." });
    }

    const session = await PaymentSession.findOne({ uid, purpose: "subscription" });
    if (!session || session.orderId !== orderId || session.expiresAt <= new Date()) {
      return res.status(403).json({ error: "No active order found for this payment." });
    }

    const effectiveDev = dev === true || String(orderId || "").startsWith("order_dev_");
    const valid = effectiveDev || verifyPaymentSignature({ orderId, paymentId, signature });
    if (!valid) {
      return res.status(400).json({ error: "Payment verification failed. Please try again." });
    }

    const plan = getPlan(planId);
    const invoiceNo = `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${crypto
      .randomBytes(2)
      .toString("hex")
      .toUpperCase()}`;

    const sub = await getOrCreateSubscription(uid);
    sub.plan = planId;
    sub.status = "active";
    sub.periodStart = new Date();
    sub.periodEnd = new Date(Date.now() + PERIOD_MS);
    sub.applicationsUsed = 0;
    sub.razorpayOrderId = orderId;
    sub.razorpayPaymentId = paymentId || "";
    sub.invoiceNo = invoiceNo;
    sub.amount = plan.price;
    await sub.save();

    await PaymentSession.deleteOne({ _id: session._id });

    // Invoice email (dev mode just logs).
    try {
      await sendInvoiceEmail({
        to: email,
        name,
        invoiceNo,
        plan: plan.name,
        amount: plan.price,
        paymentId: paymentId || orderId,
        date: new Date().toISOString().slice(0, 10),
      });
    } catch (mailErr) {
      console.error("[subscription:verify] invoice email error:", mailErr.message);
    }

    return res.json({
      success: true,
      message: "Payment successful. Your plan is now active.",
      data: present(sub),
      invoiceNo,
    });
  } catch (err) {
    console.error("[subscription:verify-payment]", err.message);
    return res.status(500).json({ error: "Could not confirm your payment." });
  }
});

module.exports = router;
