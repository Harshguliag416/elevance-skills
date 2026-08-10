const nodemailer = require("nodemailer");

/**
 * Reusable email utility.
 *
 * The transport is created once (singleton) from SMTP env vars. If SMTP is not
 * configured, the service runs in a safe "dev" mode: it does NOT send mail and
 * NEVER returns the OTP over the API — it only logs the message to the server
 * console so a developer can complete the flow locally.
 *
 * Required env for real sending:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
 * Optional:
 *   SMTP_SECURE ("true" for port 465), EMAIL_FROM (defaults to SMTP_USER)
 */

let cachedTransporter = null;
let transportChecked = false;

function isSmtpConfigured() {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS
  );
}

function getTransporter() {
  if (transportChecked) return cachedTransporter;
  transportChecked = true;

  if (!isSmtpConfigured()) {
    console.warn("[email] SMTP is not configured.");
    cachedTransporter = null;
    return null;
  }

  // Debug: Log the SMTP configuration being used (hide password)
  console.log("[email] SMTP Configuration:");
  console.log(`  Host: ${process.env.SMTP_HOST}`);
  console.log(`  Port: ${process.env.SMTP_PORT}`);
  console.log(`  Secure: ${process.env.SMTP_SECURE}`);
  console.log(`  User: ${process.env.SMTP_USER}`);
  console.log(`  Pass: ${process.env.SMTP_PASS ? '***SET***' : 'NOT SET'}`);

  cachedTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure:
      String(process.env.SMTP_SECURE).toLowerCase() === "true",

    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },

    // Network options
    family: 4, // Force IPv4
    timeout: 30000,
    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 30000,

    // Connection pooling
    pool: true,
    maxConnections: 5,
    maxMessages: 100,

    // TLS settings
    tls: {
      rejectUnauthorized: true,
      minVersion: "TLSv1.2",
    },

    // Debugging
    debug: true, // Enable SMTP protocol debugging
    logger: true, // Log to console
  });

  cachedTransporter.verify((err) => {
    if (err) {
      console.error("================================");
      console.error("SMTP VERIFY FAILED");
      console.error("Error:", err.message);
      console.error("Code:", err.code);
      console.error("Command:", err.command);
      console.error("================================");
    } else {
      console.log("================================");
      console.log("SMTP VERIFIED SUCCESSFULLY");
      console.log("================================");
    }
  });

  return cachedTransporter;
}

/** Minimal HTML escaping to prevent injection of untrusted values into markup. */
function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Professional, self-contained HTML template for the OTP email.
 * All dynamic values are escaped. No secrets beyond the OTP itself are included.
 */
function renderOtpEmail({ name, otp, expiryMinutes }) {
  const safeName = escapeHtml(name && name.trim() ? name.trim() : "there");
  const safeOtp = escapeHtml(otp);
  const safeExpiry = escapeHtml(expiryMinutes);

  const text = [
    `Hi ${safeName},`,
    "",
    `Your verification code to switch InternArea to French is: ${safeOtp}`,
    `This code expires in ${safeExpiry} minutes.`,
    "",
    "If you did not request this change, you can safely ignore this email. Your language will not be changed.",
    "",
    "For your security, never share this code with anyone. InternArea will never ask you for it.",
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
            <tr>
              <td style="background:#2563eb;padding:20px 28px;">
                <span style="color:#ffffff;font-size:20px;font-weight:bold;">InternArea</span>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <p style="margin:0 0 12px;color:#111827;font-size:16px;">Hi ${safeName},</p>
                <p style="margin:0 0 20px;color:#374151;font-size:14px;line-height:1.6;">
                  Use the verification code below to switch your InternArea language to
                  <strong>French</strong>.
                </p>
                <div style="text-align:center;margin:8px 0 20px;">
                  <div style="display:inline-block;background:#eff6ff;border:1px dashed #93c5fd;border-radius:10px;padding:16px 28px;">
                    <span style="font-size:32px;letter-spacing:8px;font-weight:bold;color:#1d4ed8;">${safeOtp}</span>
                  </div>
                </div>
                <p style="margin:0 0 20px;color:#6b7280;font-size:13px;text-align:center;">
                  This code expires in <strong>${safeExpiry} minutes</strong>.
                </p>
                <div style="background:#fef2f2;border:1px solid #fee2e2;border-radius:8px;padding:12px 16px;margin-top:8px;">
                  <p style="margin:0;color:#991b1b;font-size:12px;line-height:1.6;">
                    <strong>Security notice:</strong> Never share this code. InternArea staff will
                    never ask for it. If you didn&#39;t request this, ignore this email — your
                    language will not change.
                  </p>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;">
                <p style="margin:0;color:#9ca3af;font-size:11px;">
                  &copy; ${new Date().getFullYear()} InternArea. This is an automated message.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { html, text };
}

/**
 * Send an email. Returns { delivered: boolean, devMode: boolean }.
 * In dev mode (no SMTP) it logs and reports delivered:false, devMode:true.
 * Throws only on an actual transport failure when SMTP *is* configured.
 */
async function sendMail({ to, subject, html, text }) {
  const transporter = getTransporter();
  const from =
    process.env.EMAIL_FROM ||
    process.env.SMTP_USER ||
    "no-reply@internarea.local";

  if (!transporter) {
    // Safe dev fallback — never expose the body via API, only server logs.
    console.warn(
      `[email] SMTP not configured. Would have sent to ${to} | subject: "${subject}"`
    );
    console.warn(`[email:dev] ${text}`);
    return { delivered: false, devMode: true };
  }

  await transporter.sendMail({ from, to, subject, html, text });
  return { delivered: true, devMode: false };
}

/** High-level helper for the French verification OTP email. */
async function sendOtpEmail({ to, name, otp, expiryMinutes }) {
  const { html, text } = renderOtpEmail({ name, otp, expiryMinutes });
  return sendMail({
    to,
    subject: "Your InternArea verification code",
    html,
    text,
  });
}

/** Currency formatting (Indian Rupees). */
function formatInr(amount) {
  return `₹${Number(amount || 0).toLocaleString("en-IN")}`;
}

/** Invoice email template used after successful subscription payment. */
function renderInvoiceEmail({ name, invoiceNo, plan, amount, paymentId, date }) {
  const safeName = escapeHtml(name && name.trim() ? name.trim() : "there");
  const safeInvoice = escapeHtml(invoiceNo || "");
  const safePlan = escapeHtml(plan || "");
  const safeAmount = escapeHtml(formatInr(amount));
  const safePayment = escapeHtml(paymentId || "");
  const safeDate = escapeHtml(date || new Date().toISOString().slice(0, 10));

  const text = [
    `Hi ${safeName},`,
    "",
    "Thank you for your subscription payment. Your invoice is below:",
    `  Invoice No.: ${safeInvoice}`,
    `  Plan: ${safePlan}`,
    `  Amount paid: ${safeAmount}`,
    `  Payment ID: ${safePayment}`,
    `  Date: ${safeDate}`,
    "",
    "Your plan is now active for the current billing month.",
    "",
    "For your security, never share this invoice or payment details with anyone.",
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
          <tr><td style="background:#1d4ed8;padding:20px 28px;">
            <span style="color:#ffffff;font-size:20px;font-weight:bold;">InternArea</span>
          </td></tr>
          <tr><td style="padding:28px;">
            <p style="margin:0 0 12px;color:#111827;font-size:16px;">Hi ${safeName},</p>
            <p style="margin:0 0 20px;color:#374151;font-size:14px;line-height:1.6;">Thank you for your subscription payment. Here is your invoice.</p>
            <table role="presentation" width="100%" cellpadding="8" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;">
              <tr><td style="color:#6b7280;font-size:13px;">Invoice No.</td><td style="text-align:right;font-weight:bold;color:#111827;">${safeInvoice}</td></tr>
              <tr><td style="color:#6b7280;font-size:13px;">Plan</td><td style="text-align:right;font-weight:bold;color:#111827;">${safePlan}</td></tr>
              <tr><td style="color:#6b7280;font-size:13px;">Amount paid</td><td style="text-align:right;font-weight:bold;color:#111827;">${safeAmount}</td></tr>
              <tr><td style="color:#6b7280;font-size:13px;">Payment ID</td><td style="text-align:right;color:#111827;">${safePayment}</td></tr>
              <tr><td style="color:#6b7280;font-size:13px;">Date</td><td style="text-align:right;color:#111827;">${safeDate}</td></tr>
            </table>
            <p style="margin:20px 0 0;color:#6b7280;font-size:12px;">Your plan is now active for the current billing month.</p>
          </td></tr>
          <tr><td style="padding:16px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;">
            <p style="margin:0;color:#9ca3af;font-size:11px;">&copy; ${new Date().getFullYear()} InternArea. This is an automated message.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  return { html, text };
}

/** Send the invoice email after a successful payment. */
async function sendInvoiceEmail({ to, name, invoiceNo, plan, amount, paymentId, date }) {
  const { html, text } = renderInvoiceEmail({ name, invoiceNo, plan, amount, paymentId, date });
  return sendMail({
    to,
    subject: `Your InternArea invoice ${invoiceNo}`,
    html,
    text,
  });
}

/** Reset-password email template (contains the generated password). */
function renderResetPasswordEmail({ name, password }) {
  const safeName = escapeHtml(name && name.trim() ? name.trim() : "there");
  const safePassword = escapeHtml(password);

  const text = [
    `Hi ${safeName},`,
    "",
    "You requested a password reset for your InternArea account.",
    "",
    `Your new password is: ${safePassword}`,
    "",
    "This password contains only uppercase and lowercase letters.",
    "Sign in with it and change it to something memorable if you wish.",
    "",
    "If you did not request this reset, please contact support immediately.",
    "Never share your password with anyone.",
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
          <tr><td style="background:#1d4ed8;padding:20px 28px;">
            <span style="color:#ffffff;font-size:20px;font-weight:bold;">InternArea</span>
          </td></tr>
          <tr><td style="padding:28px;">
            <p style="margin:0 0 12px;color:#111827;font-size:16px;">Hi ${safeName},</p>
            <p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.6;">You requested a password reset. Your new password is below.</p>
            <div style="text-align:center;margin:8px 0 20px;">
              <div style="display:inline-block;background:#eff6ff;border:1px dashed #93c5fd;border-radius:10px;padding:16px 28px;">
                <span style="font-size:26px;letter-spacing:2px;font-weight:bold;color:#1d4ed8;">${safePassword}</span>
              </div>
            </div>
            <div style="background:#fef2f2;border:1px solid #fee2e2;border-radius:8px;padding:12px 16px;">
              <p style="margin:0;color:#991b1b;font-size:12px;line-height:1.6;">
                <strong>Security notice:</strong> Never share this password. If you did not
                request a reset, contact support immediately.
              </p>
            </div>
          </td></tr>
          <tr><td style="padding:16px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;">
            <p style="margin:0;color:#9ca3af;font-size:11px;">&copy; ${new Date().getFullYear()} InternArea. This is an automated message.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  return { html, text };
}

/** Send the reset-password email with the generated password. */
async function sendResetPasswordEmail({ to, name, password }) {
  const { html, text } = renderResetPasswordEmail({ name, password });
  return sendMail({
    to,
    subject: "Your InternArea password has been reset",
    html,
    text,
  });
}

module.exports = {
  isSmtpConfigured,
  renderOtpEmail,
  renderInvoiceEmail,
  renderResetPasswordEmail,
  sendMail,
  sendOtpEmail,
  sendInvoiceEmail,
  sendResetPasswordEmail,
};
