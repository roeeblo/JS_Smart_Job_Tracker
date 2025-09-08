const nodemailer = require("nodemailer");

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  SMTP_SECURE,
  FROM_EMAIL,
} = process.env;

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (!SMTP_HOST || !SMTP_PORT) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: String(SMTP_SECURE).toLowerCase() === "true",
    auth:
      SMTP_USER || SMTP_PASS
        ? { user: SMTP_USER || undefined, pass: SMTP_PASS || undefined }
        : undefined,
  });

  return transporter;
}

async function sendVerificationEmail(to, link) {
  const t = getTransporter();
  const from = FROM_EMAIL || "no-reply@sjt.local";

  if (!t) {
    console.log(`[DEV] Email verification link for ${to}: ${link}`);
    return;
  }

  await t.sendMail({
    from,
    to,
    subject: "Verify your email",
    html: `
      <div style="font-family:Arial,sans-serif">
        <h2>Smart Job Tracker</h2>
        <p>Click the button to verify your email:</p>
        <p><a href="${link}" style="background:#0ea5e9;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Verify Email</a></p>
        <p>Or open this link:<br><a href="${link}">${link}</a></p>
      </div>
    `,
  });
}

module.exports = { sendVerificationEmail };
