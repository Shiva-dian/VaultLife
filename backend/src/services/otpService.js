const crypto     = require('crypto');
const bcrypt     = require('bcryptjs');
const nodemailer = require('nodemailer');
const { query }  = require('../db');
const logger     = require('../utils/logger');

// ─── Generate OTP ────────────────────────────────────────────────
const generateOTP = (length = 6) => {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += digits[crypto.randomInt(0, 10)];
  }
  return otp;
};

// ─── Store OTP in DB ─────────────────────────────────────────────
const storeOTP = async ({ userId, identifier, channel, purpose, otp }) => {
  const expiryMinutes = parseInt(process.env.OTP_EXPIRY_MINUTES || '10');
  // const otpHash = await bcrypt.hash(otp, 10);
  const otpHash = otp;

  // Invalidate any existing unused OTPs for same identifier + purpose
  await query(
    `UPDATE otp_tokens SET used = TRUE WHERE identifier = $1 AND purpose = $2 AND used = FALSE`,
    [identifier, purpose]
  );

  const result = await query(
    `INSERT INTO otp_tokens (user_id, identifier, channel, purpose, otp_hash, expires_at)
     VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '${expiryMinutes} minutes')
     RETURNING id`,
    [userId || null, identifier, channel, purpose, otpHash]
  );
  return result.rows[0].id;
};

// ─── Verify OTP ──────────────────────────────────────────────────
const verifyOTP = async ({ identifier, purpose, otp }) => {
  const result = await query(
    `SELECT id, otp_hash, expires_at, attempts, max_attempts, used
     FROM otp_tokens
     WHERE identifier = $1 AND purpose = $2 AND used = FALSE
     ORDER BY created_at DESC LIMIT 1`,
    [identifier, purpose]
  );

  if (result.rows.length === 0) {
    return { valid: false, reason: 'No active OTP found. Please request a new one.' };
  }

  const token = result.rows[0];

  if (new Date(token.expires_at) < new Date()) {
    await query(`UPDATE otp_tokens SET used = TRUE WHERE id = $1`, [token.id]);
    return { valid: false, reason: 'OTP has expired. Please request a new one.' };
  }

  if (token.attempts >= token.max_attempts) {
    await query(`UPDATE otp_tokens SET used = TRUE WHERE id = $1`, [token.id]);
    return { valid: false, reason: 'Too many failed attempts. Please request a new OTP.' };
  }

  // const isMatch = await bcrypt.compare(otp, token.otp_hash);
  const isMatch = otp === token.otp_hash;

  if (!isMatch) {
    await query(`UPDATE otp_tokens SET attempts = attempts + 1 WHERE id = $1`, [token.id]);
    const remaining = token.max_attempts - token.attempts - 1;
    return { valid: false, reason: `Invalid OTP. ${remaining} attempt(s) remaining.` };
  }

  await query(`UPDATE otp_tokens SET used = TRUE, used_at = NOW() WHERE id = $1`, [token.id]);
  return { valid: true };
};

// ─── Email Transporter ───────────────────────────────────────────
const createTransporter = () => {
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST || 'smtp.gmail.com',
    port:   parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

// ─── Send OTP via Email ──────────────────────────────────────────
const sendEmailOTP = async ({ to, otp, purpose, userName }) => {
  const purposeLabel = {
    login: 'Sign In',
    registration: 'Account Verification',
    password_reset: 'Password Reset',
  }[purpose] || 'Verification';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Segoe UI', sans-serif; background: #f0f4ff; margin: 0; padding: 20px; }
    .container { max-width: 520px; margin: 0 auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(37,99,235,0.1); }
    .header { background: linear-gradient(135deg, #1e40af 0%, #2563eb 100%); padding: 36px 40px; text-align: center; }
    .logo { font-size: 28px; font-weight: 800; color: #fff; letter-spacing: -0.5px; }
    .logo span { color: #93c5fd; }
    .tagline { font-size: 12px; color: rgba(255,255,255,0.6); margin-top: 4px; letter-spacing: 1px; text-transform: uppercase; }
    .body { padding: 40px; }
    .greeting { font-size: 18px; font-weight: 600; color: #1e293b; margin-bottom: 12px; }
    .message { font-size: 14px; color: #64748b; line-height: 1.6; margin-bottom: 32px; }
    .otp-box { background: #eff6ff; border: 2px solid #bfdbfe; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 28px; }
    .otp-label { font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #3b82f6; margin-bottom: 8px; }
    .otp-code { font-size: 40px; font-weight: 800; color: #1e40af; letter-spacing: 12px; font-family: monospace; }
    .expiry { font-size: 12px; color: #94a3b8; margin-top: 8px; }
    .warning { font-size: 12px; color: #f59e0b; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px; }
    .footer { background: #f8fafc; padding: 24px 40px; text-align: center; border-top: 1px solid #e2e8f0; }
    .footer-text { font-size: 11px; color: #94a3b8; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">Vault<span>Life</span></div>
      <div class="tagline">Your Secure Financial Vault</div>
    </div>
    <div class="body">
      <div class="greeting">Hello${userName ? ', ' + userName : ''}! 👋</div>
      <div class="message">
        You've requested a one-time password for <strong>${purposeLabel}</strong>. 
        Use the code below to continue. This code is valid for 
        <strong>${process.env.OTP_EXPIRY_MINUTES || 10} minutes</strong> only.
      </div>
      <div class="otp-box">
        <div class="otp-label">Your OTP Code</div>
        <div class="otp-code">${otp}</div>
        <div class="expiry">Expires in ${process.env.OTP_EXPIRY_MINUTES || 10} minutes</div>
      </div>
      <div class="warning">
        ⚠️ Never share this code with anyone — VaultLife will never ask for your OTP.
        If you didn't request this, please ignore this email.
      </div>
    </div>
    <div class="footer">
      <div class="footer-text">
        VaultLife · India's Most Trusted Financial Vault<br>
        AES-256 Encrypted · DPDP Act Compliant<br><br>
        If you didn't request this OTP, your account is safe. You can ignore this email.
      </div>
    </div>
  </div>
</body>
</html>`;

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    // Dev mode: log OTP to console instead
    logger.info(`[OTP-DEV] Email OTP for ${to}: ${otp}`);
    return { messageId: 'dev-mode' };
  }

  const transporter = createTransporter();
  const info = await transporter.sendMail({
    from:    process.env.SMTP_FROM || 'VaultLife <noreply@vaultlife.in>',
    to,
    subject: `${otp} is your VaultLife OTP for ${purposeLabel}`,
    html,
  });

  logger.info(`[Email] OTP sent to ${to}`, { messageId: info.messageId });
  return info;
};

// ─── Send OTP via SMS (Twilio) ───────────────────────────────────
const sendSMSOTP = async ({ to, otp, purpose }) => {
  const purposeLabel = purpose === 'login' ? 'sign in' : 'verification';

  // Dev mode
  if (!process.env.TWILIO_ACCOUNT_SID) {
    logger.info(`[OTP-DEV] SMS OTP for ${to}: ${otp}`);
    return { sid: 'dev-mode' };
  }

  try {
    const twilio = require('twilio');
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const message = await client.messages.create({
      body: `Your VaultLife OTP for ${purposeLabel} is: ${otp}. Valid for ${process.env.OTP_EXPIRY_MINUTES || 10} minutes. Do NOT share this code.`,
      from: process.env.TWILIO_FROM_NUMBER,
      to,
    });
    logger.info(`[SMS] OTP sent to ${to}`, { sid: message.sid });
    return message;
  } catch (err) {
    logger.error(`[SMS] Failed to send OTP to ${to}:`, err.message);
    throw err;
  }
};

// ─── Dispatch OTP (routes to email or SMS) ──────────────────────
const dispatchOTP = async ({ userId, identifier, channel, purpose, userName }) => {
  const otp = generateOTP(parseInt(process.env.OTP_LENGTH || '6'));
  const isDevMode = process.env.NODE_ENV !== 'production';

  // If SMS chosen but Twilio not configured, auto-fallback to email
  let actualChannel = channel;
  let actualIdentifier = identifier;

  if (channel === 'sms' && !process.env.TWILIO_ACCOUNT_SID) {
    // Check if we have email available for this user
    if (userId) {
      try {
        const { query: dbQuery } = require('../db');
        const res = await dbQuery('SELECT email FROM users WHERE id = $1', [userId]);
        if (res.rows.length && res.rows[0].email) {
          actualChannel = 'email';
          actualIdentifier = res.rows[0].email;
          logger.warn(`[OTP] SMS not configured — falling back to email for user ${userId}`);
        }
      } catch (e) { /* keep sms, will log to console */ }
    }
  }

  await storeOTP({ userId, identifier: actualIdentifier, channel: actualChannel, purpose, otp });

  if (actualChannel === 'email') {
    await sendEmailOTP({ to: actualIdentifier, otp, purpose, userName });
  } else {
    await sendSMSOTP({ to: actualIdentifier, otp, purpose });
  }

  // In dev mode, always log OTP to console prominently
  if (true) {
    logger.info(`\n${'─'.repeat(50)}\n[OTP-DEV] ✅ OTP for ${actualIdentifier} (${actualChannel}): ${otp}\n[OTP-DEV] Purpose: ${purpose} | Expires in ${process.env.OTP_EXPIRY_MINUTES || 10} min\n${'─'.repeat(50)}`);
  }

  return { otp: isDevMode ? otp : null, channel: actualChannel, identifier: actualIdentifier };
};

module.exports = { generateOTP, storeOTP, verifyOTP, dispatchOTP, sendEmailOTP, sendSMSOTP };
