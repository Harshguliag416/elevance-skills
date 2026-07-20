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
    cachedTransporter = null;
    return null;
  }

  cachedTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: String(process.env.SMTP_SECURE || "").toLowerCase() === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
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

module.exports = {
  isSmtpConfigured,
  renderOtpEmail,
  sendMail,
  sendOtpEmail,
};
