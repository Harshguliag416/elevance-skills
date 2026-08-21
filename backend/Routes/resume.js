const express = require("express");
const router = express.Router();

const User = require("../Model/User");
const Otp = require("../Model/Otp");
const PaymentSession = require("../Model/PaymentSession");
const Resume = require("../Model/Resume");
const { verifyFirebaseUser } = require("../middleware/auth");
const { otpRequestLimiter, otpVerifyLimiter } = require("../middleware/rateLimit");
const { sendOtpEmail } = require("../utils/email");
const {
  generateOtp,
  hashOtp,
  verifyOtp,
  isDevCode,
  OTP_TTL_MS,
  MAX_ATTEMPTS,
  LOCK_DURATION_MS,
} = require("../utils/otp");
const { createOrder, verifyPaymentSignature } = require("../utils/razorpay");
const { generateResumeHtml } = require("../utils/resumeGenerator");

const OTP_PURPOSE = "resume_payment";
const RESUME_FEE_PAISE = 5000; // ₹50
const RESUME_FEE_INR = 50;
const SESSION_EXPIRY_MS = 10 * 60 * 1000;

/** Find-or-create the User profile doc (mirrors /user/sync). */
async function getOrCreateUser(authUser) {
  let user = await User.findOne({ uid: authUser.uid });
  if (!user) {
    user = await User.create({
      uid: authUser.uid,
      email: authUser.email,
      name: authUser.name || "",
    });
  }
  return user;
}

/** GET /api/resume/me — the current user's latest generated resume. */
router.get("/me", verifyFirebaseUser, async (req, res) => {
  try {
    const resume = await Resume.findOne({ uid: req.authUser.uid }).sort({
      createdAt: -1,
    });
    return res.json({ success: true, data: resume || null });
  } catch (err) {
    console.error("[resume/me]", err.message);
    return res.status(500).json({ error: "Could not fetch your resume." });
  }
});

/**
 * POST /api/resume/request-otp
 * Email an OTP that must be verified before the ₹50 resume payment.
 */
router.post("/request-otp", verifyFirebaseUser, otpRequestLimiter, async (req, res) => {
  try {
    const { uid, email, name } = req.authUser;
    if (!email) {
      return res.status(400).json({
        error: "No email is associated with your account. Please sign in with an email address.",
      });
    }

    const existing = await Otp.findOne({ uid, purpose: OTP_PURPOSE });
    if (existing && existing.lockedUntil && existing.lockedUntil > new Date()) {
      const retryAfter = Math.ceil((existing.lockedUntil - Date.now()) / 1000);
      return res.status(429).json({
        error: "Too many failed attempts. Please try again later.",
        retryAfterSeconds: retryAfter,
      });
    }

    const otp = generateOtp();
    await Otp.findOneAndUpdate(
      { uid, purpose: OTP_PURPOSE },
      {
        $set: {
          email,
          hashedOtp: hashOtp(otp),
          attempts: 0,
          maxAttempts: MAX_ATTEMPTS,
          lockedUntil: null,
          expiresAt: new Date(Date.now() + OTP_TTL_MS),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    let devMode = false;
    try {
      const result = await sendOtpEmail({
        to: email,
        name,
        otp,
        expiryMinutes: Math.round(OTP_TTL_MS / 60000),
      });
      devMode = result.devMode;
    } catch (mailErr) {
      console.error("[resume:request] email send failed:", mailErr.message);
      await Otp.deleteOne({ uid, purpose: OTP_PURPOSE });
      return res.status(502).json({
        error: "We couldn't send the verification email. Please try again.",
      });
    }

    return res.json({
      success: true,
      message: "A verification code has been sent to your registered email.",
      expiresInSeconds: Math.round(OTP_TTL_MS / 1000),
      devMode,
      devCodeEnabled: Boolean(process.env.OTP_DEV_CODE),
      devCode: devMode ? process.env.OTP_DEV_CODE || null : null,
    });
  } catch (err) {
    console.error("[resume:request]", err.message);
    return res.status(500).json({ error: "Could not generate a verification code." });
  }
});

/**
 * POST /api/resume/verify-otp
 * On success, opens a short-lived payment session marked OTP-verified.
 */
router.post("/verify-otp", verifyFirebaseUser, otpVerifyLimiter, async (req, res) => {
  try {
    const { uid } = req.authUser;
    const candidate = String(req.body.otp || "").trim();

    if (!/^\d{6}$/.test(candidate)) {
      return res.status(400).json({ error: "Enter the 6-digit code." });
    }

    const record = await Otp.findOne({ uid, purpose: OTP_PURPOSE });
    if (!record) {
      return res.status(400).json({
        error: "No active verification code. Please request a new one.",
        expired: true,
      });
    }
    if (record.lockedUntil && record.lockedUntil > new Date()) {
      const retryAfter = Math.ceil((record.lockedUntil - Date.now()) / 1000);
      return res.status(429).json({
        error: "Too many failed attempts. Please try again later.",
        retryAfterSeconds: retryAfter,
      });
    }
    if (record.expiresAt <= new Date()) {
      await Otp.deleteOne({ _id: record._id });
      return res.status(400).json({
        error: "This code has expired. Please request a new one.",
        expired: true,
      });
    }

    const updated = await Otp.findOneAndUpdate(
      { _id: record._id },
      { $inc: { attempts: 1 } },
      { new: true }
    );
    if (!updated) {
      return res.status(400).json({
        error: "No active verification code. Please request a new one.",
        expired: true,
      });
    }
    if (updated.attempts > updated.maxAttempts) {
      const lockedUntil = new Date(Date.now() + LOCK_DURATION_MS);
      await Otp.updateOne({ _id: updated._id }, { $set: { lockedUntil } });
      return res.status(429).json({
        error: "Too many failed attempts. Please try again later.",
        retryAfterSeconds: Math.round(LOCK_DURATION_MS / 1000),
      });
    }

    const isValid = verifyOtp(candidate, updated.hashedOtp) || isDevCode(candidate);
    if (!isValid) {
      const remaining = Math.max(0, updated.maxAttempts - updated.attempts);
      if (remaining === 0) {
        const lockedUntil = new Date(Date.now() + LOCK_DURATION_MS);
        await Otp.updateOne({ _id: updated._id }, { $set: { lockedUntil } });
        return res.status(429).json({
          error: "Too many failed attempts. Please try again later.",
          retryAfterSeconds: Math.round(LOCK_DURATION_MS / 1000),
        });
      }
      return res.status(400).json({
        error: "Incorrect code. Please try again.",
        attemptsRemaining: remaining,
      });
    }

    // Consume the OTP and open the payment session.
    await Otp.deleteOne({ _id: updated._id });
    await PaymentSession.findOneAndUpdate(
      { uid, purpose: "resume" },
      {
        $set: {
          uid,
          purpose: "resume",
          email: record.email,
          otpVerified: true,
          expiresAt: new Date(Date.now() + SESSION_EXPIRY_MS),
        },
      },
      { upsert: true, new: true }
    );

    return res.json({
      success: true,
      message: "Email verified. You can now proceed to payment.",
    });
  } catch (err) {
    console.error("[resume:verify]", err.message);
    return res.status(500).json({ error: "Could not verify the code." });
  }
});

/**
 * POST /api/resume/create-order
 * Requires an OTP-verified payment session. Creates the ₹50 Razorpay order.
 */
router.post("/create-order", verifyFirebaseUser, async (req, res) => {
  try {
    const { uid, email } = req.authUser;

    const session = await PaymentSession.findOne({ uid, purpose: "resume" });
    if (!session || !session.otpVerified || session.expiresAt <= new Date()) {
      return res.status(403).json({
        error: "Please verify your email before making the payment.",
        otpRequired: true,
      });
    }

    const order = await createOrder({
      amountPaise: RESUME_FEE_PAISE,
      receipt: `resume-${uid.slice(-8)}`,
      notes: { purpose: "resume", uid, email },
    });

    session.orderId = order.id;
    session.amount = RESUME_FEE_PAISE;
    await session.save();

    return res.json({
      success: true,
      orderId: order.id,
      amount: RESUME_FEE_INR,
      amountPaise: RESUME_FEE_PAISE,
      currency: "INR",
      keyId: process.env.RAZORPAY_KEY_ID || null,
      devMode: !!order.devMode,
    });
  } catch (err) {
    console.error("[resume:create-order]", err.message);
    return res.status(500).json({ error: "Could not create the payment order." });
  }
});

/**
 * POST /api/resume/verify-payment
 * Verifies the Razorpay signature, generates the professional resume from the
 * submitted form data, stores it, and attaches it to the user's profile.
 */
router.post("/verify-payment", verifyFirebaseUser, async (req, res) => {
  try {
    const { uid, email: authEmail, name: authName } = req.authUser;
    const { orderId, paymentId, signature, dev, resumeData } = req.body || {};

    const session = await PaymentSession.findOne({ uid, purpose: "resume" });
    console.log('[resume] verify-payment session:', session);
    if (!session || session.orderId !== orderId || session.expiresAt <= new Date()) {
      return res.status(403).json({ error: "No active order found for this payment." });
    }

    // Dev-mode simulation accepts dev payment ids.
    const effectiveDev = dev === true || String(orderId || "").startsWith("order_dev_");
    const signatureValid = verifyPaymentSignature({ orderId, paymentId, signature });
    console.log('[resume] verify-payment effectiveDev:', effectiveDev, 'signatureValid:', signatureValid, 'dev flag:', dev);
    const valid =
      effectiveDev ||
      signatureValid;

    if (!valid) {
      return res.status(400).json({ error: "Payment verification failed. Please try again." });
    }

    const data = resumeData || {};
    console.log('[resume] verify-payment resumeData:', data);

    // Helper to get field value with proper fallback logic
    const getStringField = (dataField, authValue, treatEmptyAsAuthFallback = false) => {
      if (dataField !== null && dataField !== undefined) {
        const trimmed = String(dataField).trim();
        if (trimmed !== '') {
          return trimmed;
        }
        // If it's empty after trimming and we should treat empty as auth fallback
        if (treatEmptyAsAuthFallback && authValue !== null && authValue !== undefined) {
          return String(authValue).trim();
        }
        return trimmed;
      }
      // If field is null/undefined/not provided
      if (treatEmptyAsAuthFallback && authValue !== null && authValue !== undefined) {
        return String(authValue).trim();
      }
      return '';
    };

    // Use provided data, or fallback to authenticated user's name/email if not provided or empty
    const resolvedName = getStringField(data.name, authName, true);
    const email = getStringField(data.email, authEmail, true);
    const phone = getStringField(data.phone, '', false);
    const photo = data.photo !== null && data.photo !== undefined ? data.photo : "";
    const qualifications = getStringField(data.qualifications, '', false);
    const experience = getStringField(data.experience, '', false);
    const personalInfo = getStringField(data.personalInfo, '', false);
    const skills = Array.isArray(data.skills) ? data.skills : [];

    if (!resolvedName) {
      return res.status(400).json({ error: "Name is required." });
    }

    const html = generateResumeHtml({
      name: resolvedName,
      email,
      phone,
      photo,
      qualifications,
      experience,
      personalInfo,
      skills,
    });

    const resume = await Resume.create({
      uid,
      email,
      name: resolvedName,
      phone,
      qualifications,
      experience,
      personalInfo,
      skills,
      photo,
      generatedHtml: html,
      paymentId: paymentId || "",
      orderId,
      amount: RESUME_FEE_INR,
    });

    const user = await getOrCreateUser(req.authUser);
    user.premium = true;
    user.resumeId = resume._id;
    if (data.phone) user.phone = data.phone;
    await user.save();

    await PaymentSession.deleteOne({ _id: session._id });

    return res.json({
      success: true,
      message: "Payment successful. Your professional resume is ready.",
      resume: {
        _id: resume._id,
        name: resume.name,
        email: resume.email,
        phone: resume.phone,
        qualifications: resume.qualifications,
        experience: resume.experience,
        personalInfo: resume.personalInfo,
        skills: resume.skills,
        photo: resume.photo,
        generatedHtml: resume.generatedHtml,
      },
    });
  } catch (err) {
    console.error("[resume:verify-payment]", err.message);
    return res.status(500).json({ error: "Could not confirm your payment." });
  }
});

/** GET /api/resume/:id — fetch a resume's generated HTML (requires owner or auth). */
router.get("/:id", verifyFirebaseUser, async (req, res) => {
  try {
    const resume = await Resume.findById(req.params.id);
    if (!resume) {
      return res.status(404).json({ error: "Resume not found." });
    }
    if (resume.uid !== req.authUser.uid) {
      return res.status(403).json({ error: "You do not have access to this resume." });
    }
    res.set("Content-Type", "text/html; charset=utf-8");
    return res.send(resume.generatedHtml);
  } catch (err) {
    console.error("[resume:get]", err.message);
    return res.status(500).json({ error: "Could not fetch the resume." });
  }
});

module.exports = router;