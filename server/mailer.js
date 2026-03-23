let nodemailer = null;
try {
  nodemailer = require("nodemailer");
} catch (_) {
  nodemailer = null;
}

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  SMTP_SECURE,
  FROM_EMAIL,
} = process.env;

let transporter = null;

function hasSmtpConfig() {
  return Boolean(nodemailer && SMTP_HOST && SMTP_PORT);
}

function isSecureSmtp() {
  return String(SMTP_SECURE).toLowerCase() === "true";
}

function getSmtpAuth() {
  if (!SMTP_USER && !SMTP_PASS) return undefined;
  return {
    user: SMTP_USER || undefined,
    pass: SMTP_PASS || undefined,
  };
}

function getTransporter() {
  if (transporter) return transporter;
  if (!hasSmtpConfig()) {
    return null;
  }
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: isSecureSmtp(),
    auth: getSmtpAuth(),
  });
  return transporter;
}

function getFromAddress() {
  return FROM_EMAIL || "no-reply@sjt.local";
}

function getVerificationHtml(link) {
  return `
      <div style="font-family:Arial,sans-serif">
        <h2>Smart Job Tracker</h2>
        <p>Click the button to verify your email:</p>
        <p><a href="${link}" style="background:#0ea5e9;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Verify Email</a></p>
        <p>Or open this link:<br><a href="${link}">${link}</a></p>
      </div>
    `;
}

async function sendVerificationEmail(to, link) {
  const t = getTransporter();
  const from = getFromAddress();

  if (!t) {
    console.log(`[DEV] Email verification link for ${to}: ${link}`);
    return;
  }

  await t.sendMail({
    from,
    to,
    subject: "Verify your email",
    html: getVerificationHtml(link),
  });
}

module.exports = { sendVerificationEmail };
