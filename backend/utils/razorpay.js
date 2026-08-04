const axios = require("axios");
const crypto = require("crypto");

/**
 * Razorpay integration built directly on their REST API (no SDK dependency).
 *
 * Production path: creates real orders and verifies the payment signature
 * (HMAC-SHA256 of `orderId|paymentId` with the key secret).
 *
 * Development fallback: when RAZORPAY_KEY_ID/SECRET are not configured the
 * service issues clearly-prefixed "dev" order ids and accepts matching "dev"
 * payment ids so the whole flow can be exercised without live credentials.
 * The `isConfigured()` flag tells the frontend to render a "Simulate payment"
 * button instead of the Razorpay checkout modal.
 */
const RAZORPAY_API = "https://api.razorpay.com/v1";

function isConfigured() {
  return Boolean(
    process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
  );
}

function getAuth() {
  return {
    username: process.env.RAZORPAY_KEY_ID,
    password: process.env.RAZORPAY_KEY_SECRET,
  };
}

/**
 * Create a Razorpay order.
 * @param {number} amountPaise - amount in paise (₹1 = 100).
 * @param {string} receipt - short receipt identifier.
 */
async function createOrder({ amountPaise, receipt, notes = {} }) {
  if (!isConfigured()) {
    const orderId = `order_dev_${crypto.randomBytes(8).toString("hex")}`;
    return { id: orderId, amount: amountPaise, currency: "INR", devMode: true };
  }

  const { data } = await axios.post(
    `${RAZORPAY_API}/orders`,
    {
      amount: amountPaise,
      currency: "INR",
      receipt,
      notes,
    },
    { auth: getAuth(), timeout: 15000 }
  );
  return { ...data, devMode: false };
}

/**
 * Verify the Razorpay payment signature.
 * @param {object} p - { orderId, paymentId, signature }
 */
function verifyPaymentSignature({ orderId, paymentId, signature }) {
  // Dev-mode orders are matched against dev-mode payment ids.
  if (String(orderId || "").startsWith("order_dev_")) {
    if (!String(paymentId || "").startsWith("pay_dev_")) return false;
    return true;
  }
  if (!signature) return false;
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  const a = Buffer.from(String(signature), "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = {
  RAZORPAY_API,
  isConfigured,
  createOrder,
  verifyPaymentSignature,
};
