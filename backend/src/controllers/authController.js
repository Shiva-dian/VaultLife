const bcrypt  = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { query }        = require('../db');
const { dispatchOTP, verifyOTP } = require('../services/otpService');
const { issueTokenPair, verifyRefreshToken, revokeRefreshToken } = require('../services/tokenService');
const logger           = require('../utils/logger');

const clientIP   = (req) => req.ip || req.headers['x-forwarded-for'] || 'unknown';
const deviceInfo = (req) => req.headers['user-agent'] || 'unknown';

const auditLog = async (action, { userId, identifier, ip, ua, metadata } = {}) => {
  try {
    await query(
      `INSERT INTO audit_log (user_id, identifier, action, ip_address, user_agent, metadata)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [userId||null, identifier||null, action, ip||null, ua||null,
       metadata ? JSON.stringify(metadata) : null]
    );
  } catch(e) { logger.error('[Audit]', e.message); }
};

// Helper: fetch user from new tables (replaces SELECT FROM users)
const getUserById = async (userId) => {
  const r = await query(
    `SELECT u.id, up.full_name, ua.email, ua.phone, ua.status,
            ua.preferred_otp_channel, ua.failed_login_attempts, ua.locked_until
     FROM users u
     JOIN user_auth    ua ON ua.user_id = u.id
     JOIN user_profile up ON up.user_id = u.id
     WHERE u.id = $1`, [userId]
  );
  return r.rows[0] || null;
};

const getUserByIdentifier = async (identifier) => {
  const r = await query(
    `SELECT u.id, up.full_name, ua.email, ua.phone, ua.password_hash, ua.status,
            ua.failed_login_attempts, ua.locked_until, ua.preferred_otp_channel
     FROM users u
     JOIN user_auth    ua ON ua.user_id = u.id
     JOIN user_profile up ON up.user_id = u.id
     WHERE (ua.email = $1 OR ua.phone = $1) AND ua.status != 'inactive'
     LIMIT 1`, [identifier.toLowerCase().trim()]
  );
  return r.rows[0] || null;
};

// ── REGISTER — Step 1 ─────────────────────────────────────────────
const register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ success:false, errors:errors.array() });

  const { fullName, email, phone, password, otpChannel = 'email' } = req.body;
  try {
    // Duplicate check against user_auth
    const dup = await query(
      `SELECT id FROM user_auth WHERE email=$1 OR phone=$2 LIMIT 1`,
      [email.toLowerCase(), phone]
    );
    if (dup.rows.length)
      return res.status(409).json({ success:false, message:'An account with this email or phone already exists.' });

    const passwordHash = await bcrypt.hash(password, 12);

    // 1. Create anchor row in users
    const anchor = await query(`INSERT INTO users DEFAULT VALUES RETURNING id, created_at`);
    const userId = anchor.rows[0].id;

    // 2. Create user_auth row
    await query(
      `INSERT INTO user_auth (user_id, email, phone, password_hash, preferred_otp_channel, status)
       VALUES ($1,$2,$3,$4,$5,'pending_verification')`,
      [userId, email.toLowerCase(), phone, passwordHash, otpChannel]
    );

    // 3. Create user_profile row
    await query(
      `INSERT INTO user_profile (user_id, full_name) VALUES ($1,$2)`,
      [userId, fullName.trim()]
    );

    const identifier = otpChannel === 'email' ? email.toLowerCase() : phone;
    const otpResult  = await dispatchOTP({ userId, identifier, channel: otpChannel,
      purpose: 'registration', userName: fullName.trim() });

    await auditLog('register', { userId, identifier: email, ip: clientIP(req), ua: deviceInfo(req) });
    logger.info(`[Register] New user: ${email}`);

    const resp = {
      userId, otpChannel: otpResult.channel,
      identifier: otpResult.channel === 'email'
        ? otpResult.identifier.replace(/(.{2}).+(@.+)/, '$1***$2')
        : otpResult.identifier.replace(/(\d{2})\d{6}(\d{2})/, '$1******$2'),
    };
    if (process.env.NODE_ENV !== 'production' && otpResult.otp) resp.devOtp = otpResult.otp;

    return res.status(201).json({
      success:true,
      message: `OTP sent to your ${otpResult.channel}. Please verify to activate your account.`,
      data: resp,
    });
  } catch(err) { logger.error('[Register]',err.message); return res.status(500).json({ success:false, message:'Registration failed.' }); }
};

// ── REGISTER — Step 2: Verify OTP ────────────────────────────────
const verifyRegistration = async (req, res) => {
  const { userId, otp } = req.body;
  if (!userId||!otp) return res.status(400).json({ success:false, message:'userId and otp required.' });
  try {
    const user = await getUserById(userId);
    if (!user) return res.status(404).json({ success:false, message:'User not found.' });

    const tokenLookup = await query(
      `SELECT identifier, channel FROM otp_tokens WHERE user_id=$1 AND purpose='registration'
       AND used=FALSE AND expires_at>NOW() ORDER BY created_at DESC LIMIT 1`, [userId]
    );
    if (!tokenLookup.rows.length)
      return res.status(400).json({ success:false, message:'No active OTP found.' });

    const { identifier, channel } = tokenLookup.rows[0];
    const { valid, reason } = await verifyOTP({ identifier, purpose:'registration', otp });
    if (!valid) return res.status(400).json({ success:false, message:reason });

    const verifiedField = channel === 'email' ? 'email_verified' : 'phone_verified';
    await query(
      `UPDATE user_auth SET status='active', ${verifiedField}=TRUE WHERE user_id=$1`, [userId]
    );

    const tokens = await issueTokenPair({ user, ipAddress: clientIP(req), deviceInfo: deviceInfo(req) });
    await auditLog('otp_verified', { userId, identifier, ip: clientIP(req), ua: deviceInfo(req) });
    logger.info(`[Register] Verified: ${user.email}`);

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly:true, secure:process.env.NODE_ENV==='production', sameSite:'strict',
      maxAge: 7*24*60*60*1000,
    });
    return res.status(200).json({
      success:true, message:'Account activated! Welcome to VaultLife.',
      data:{ accessToken:tokens.accessToken,
             user:{ id:user.id, name:user.full_name, email:user.email, phone:user.phone } },
    });
  } catch(err) { logger.error('[VerifyReg]',err.message); return res.status(500).json({ success:false, message:'Verification failed.' }); }
};

// ── LOGIN — Step 1 ────────────────────────────────────────────────
const login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ success:false, errors:errors.array() });

  const { identifier, password } = req.body;
  try {
    const user = await getUserByIdentifier(identifier);
    if (!user) {
      await auditLog('login_failed', { identifier, ip: clientIP(req), ua: deviceInfo(req) });
      return res.status(401).json({ success:false, message:'Invalid credentials.' });
    }

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const mins = Math.ceil((new Date(user.locked_until)-new Date())/60000);
      return res.status(423).json({ success:false, message:`Account locked. Try in ${mins} minute(s).` });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      const attempts = user.failed_login_attempts + 1;
      const lockUntil = attempts >= 5 ? new Date(Date.now()+15*60*1000) : null;
      await query(`UPDATE user_auth SET failed_login_attempts=$1, locked_until=$2 WHERE user_id=$3`,
        [attempts, lockUntil, user.id]);
      await auditLog('login_failed', { userId:user.id, identifier, ip:clientIP(req), ua:deviceInfo(req) });
      const remaining = Math.max(0, 5-attempts);
      return res.status(401).json({ success:false,
        message: remaining > 0 ? `Invalid credentials. ${remaining} attempt(s) left.`
          : 'Account locked for 15 minutes.' });
    }

    if (user.status === 'pending_verification')
      return res.status(403).json({ success:false, message:'Please verify your account first.',
        data:{ needsVerification:true, userId:user.id } });

    await query(`UPDATE user_auth SET failed_login_attempts=0, locked_until=NULL WHERE user_id=$1`, [user.id]);

    const channel = user.preferred_otp_channel;
    const otpIdentifier = channel === 'email' ? user.email : user.phone;
    const otpResult = await dispatchOTP({ userId:user.id, identifier:otpIdentifier, channel,
      purpose:'login', userName:user.full_name });

    await auditLog('otp_sent', { userId:user.id, identifier, ip:clientIP(req), ua:deviceInfo(req) });
    logger.info(`[Login] OTP sent: ${user.email}`);

    const resp = { userId:user.id, otpChannel:otpResult.channel,
      maskedIdentifier: otpResult.channel==='email'
        ? otpResult.identifier.replace(/(.{2}).+(@.+)/, '$1***$2')
        : otpResult.identifier.replace(/(\d{2})\d{6}(\d{2})/, '$1******$2') };
    if (process.env.NODE_ENV !== 'production' && otpResult.otp) resp.devOtp = otpResult.otp;

    return res.status(200).json({ success:true,
      message:`OTP sent to your ${otpResult.channel}. Please verify.`, data:resp });
  } catch(err) { logger.error('[Login]',err.message); return res.status(500).json({ success:false, message:'Login failed.' }); }
};

// ── LOGIN — Step 2: Verify OTP ────────────────────────────────────
const verifyLoginOTP = async (req, res) => {
  const { userId, otp } = req.body;
  if (!userId||!otp) return res.status(400).json({ success:false, message:'userId and otp required.' });
  try {
    const user = await getUserById(userId);
    if (!user) return res.status(404).json({ success:false, message:'User not found.' });

    const identifier = user.preferred_otp_channel === 'email' ? user.email : user.phone;
    const { valid, reason } = await verifyOTP({ identifier, purpose:'login', otp });
    if (!valid) {
      await auditLog('otp_failed', { userId:user.id, ip:clientIP(req), ua:deviceInfo(req) });
      return res.status(400).json({ success:false, message:reason });
    }

    // Update last login
    await query(`UPDATE user_auth SET last_login_at=NOW(), last_login_ip=$1 WHERE user_id=$2`,
      [clientIP(req), userId]);

    const tokens = await issueTokenPair({ user, ipAddress:clientIP(req), deviceInfo:deviceInfo(req) });
    await auditLog('login_success', { userId:user.id, identifier:user.email, ip:clientIP(req), ua:deviceInfo(req) });
    logger.info(`[Login] Success: ${user.email}`);

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly:true, secure:process.env.NODE_ENV==='production', sameSite:'strict',
      maxAge: 7*24*60*60*1000,
    });
    return res.status(200).json({ success:true, message:'Login successful!',
      data:{ accessToken:tokens.accessToken,
             user:{ id:user.id, name:user.full_name, email:user.email, phone:user.phone } } });
  } catch(err) { logger.error('[VerifyLogin]',err.message); return res.status(500).json({ success:false, message:'Verification failed.' }); }
};

// ── RESEND OTP ────────────────────────────────────────────────────
const resendOTP = async (req, res) => {
  const { userId, purpose } = req.body;
  if (!userId) return res.status(400).json({ success:false, message:'userId required.' });
  try {
    const user = await getUserById(userId);
    if (!user) return res.status(404).json({ success:false, message:'User not found.' });
    const channel = user.preferred_otp_channel;
    const identifier = channel === 'email' ? user.email : user.phone;
    await dispatchOTP({ userId:user.id, identifier, channel, purpose:purpose||'login', userName:user.full_name });
    return res.status(200).json({ success:true, message:`New OTP sent to your ${channel}.` });
  } catch(err) { return res.status(500).json({ success:false, message:'Failed to resend OTP.' }); }
};

// ── REFRESH TOKEN ─────────────────────────────────────────────────
const refreshToken = async (req, res) => {
  const token = req.cookies?.refreshToken || req.body?.refreshToken;
  if (!token) return res.status(401).json({ success:false, message:'Refresh token required.' });
  const decoded = verifyRefreshToken(token);
  if (!decoded) return res.status(401).json({ success:false, message:'Invalid refresh token.' });
  try {
    const user = await getUserById(decoded.sub);
    if (!user || user.status !== 'active')
      return res.status(401).json({ success:false, message:'User not found.' });
    const accessToken = require('../services/tokenService').generateAccessToken({
      sub:user.id, email:user.email, name:user.full_name, phone:user.phone });
    return res.status(200).json({ success:true, data:{ accessToken } });
  } catch(err) { return res.status(500).json({ success:false, message:'Token refresh failed.' }); }
};

// ── LOGOUT ────────────────────────────────────────────────────────
const logout = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (userId) { await revokeRefreshToken(userId); await auditLog('logout', { userId, ip:clientIP(req), ua:deviceInfo(req) }); }
    res.clearCookie('refreshToken');
    return res.status(200).json({ success:true, message:'Logged out successfully.' });
  } catch(err) { return res.status(500).json({ success:false, message:'Logout failed.' }); }
};

// ── GET /api/auth/me ──────────────────────────────────────────────
const getMe = async (req, res) => res.status(200).json({ success:true, data:{ user:req.user } });

// ── FORGOT PASSWORD ───────────────────────────────────────────────
const forgotPassword = async (req, res) => {
  const { identifier } = req.body;
  if (!identifier) return res.status(400).json({ success:false, message:'Email or phone required.' });
  try {
    const user = await getUserByIdentifier(identifier);
    if (!user) return res.status(200).json({ success:true,
      message:'If an account exists, you will receive an OTP.', data:{ found:false } });

    const channel = user.preferred_otp_channel || 'email';
    const otpIdentifier = channel === 'email' ? user.email : user.phone;
    const otpResult = await dispatchOTP({ userId:user.id, identifier:otpIdentifier, channel,
      purpose:'password_reset', userName:user.full_name });

    logger.info(`[ForgotPW] OTP sent: ${user.email}`);
    const resp = { success:true,
      message:`OTP sent to your ${otpResult.channel}.`,
      data:{ userId:user.id, otpChannel:otpResult.channel, found:true,
        maskedIdentifier: otpResult.channel==='email'
          ? otpResult.identifier.replace(/(.{2}).+(@.+)/, '$1***$2')
          : otpResult.identifier.replace(/(\d{2})\d{6}(\d{2})/, '$1******$2') } };
    if (process.env.NODE_ENV !== 'production' && otpResult.otp) resp.data.devOtp = otpResult.otp;
    return res.status(200).json(resp);
  } catch(err) { logger.error('[ForgotPW]',err.message); return res.status(500).json({ success:false, message:'Failed.' }); }
};

// ── VERIFY FORGOT OTP ─────────────────────────────────────────────
const verifyForgotOTP = async (req, res) => {
  const { userId, otp } = req.body;
  if (!userId||!otp) return res.status(400).json({ success:false, message:'userId and otp required.' });
  try {
    const r = await query(`SELECT u.id FROM users u JOIN user_auth ua ON ua.user_id=u.id
      WHERE u.id=$1 AND ua.status='active'`, [userId]);
    if (!r.rows.length) return res.status(404).json({ success:false, message:'User not found.' });

    const tl = await query(`SELECT identifier FROM otp_tokens WHERE user_id=$1
      AND purpose='password_reset' AND used=FALSE AND expires_at>NOW()
      ORDER BY created_at DESC LIMIT 1`, [userId]);
    if (!tl.rows.length) return res.status(400).json({ success:false, message:'No active OTP found.' });

    const { valid, reason } = await verifyOTP({ identifier:tl.rows[0].identifier, purpose:'password_reset', otp });
    if (!valid) return res.status(400).json({ success:false, message:reason });

    const { v4: uuidv4 } = require('uuid');
    const resetToken = uuidv4();
    const tokenHash  = await bcrypt.hash(resetToken, 10);
    const expiresAt  = new Date(Date.now()+15*60*1000);
    await query(`UPDATE password_reset_tokens SET used=TRUE WHERE user_id=$1`, [userId]);
    await query(`INSERT INTO password_reset_tokens (user_id,token_hash,expires_at) VALUES ($1,$2,$3)`,
      [userId, tokenHash, expiresAt]);
    return res.status(200).json({ success:true, message:'OTP verified.',
      data:{ resetToken, userId } });
  } catch(err) { logger.error('[VerifyForgotOTP]',err.message); return res.status(500).json({ success:false, message:'Failed.' }); }
};

// ── RESET PASSWORD ────────────────────────────────────────────────
const resetPassword = async (req, res) => {
  const { userId, resetToken, newPassword } = req.body;
  if (!userId||!resetToken||!newPassword)
    return res.status(400).json({ success:false, message:'userId, resetToken and newPassword required.' });
  if (newPassword.length<8||!/(?=.*[A-Z])(?=.*[0-9])/.test(newPassword))
    return res.status(400).json({ success:false, message:'Password must be 8+ chars with uppercase and number.' });
  try {
    const rows = await query(`SELECT id,token_hash FROM password_reset_tokens
      WHERE user_id=$1 AND expires_at>NOW() AND used=FALSE ORDER BY created_at DESC LIMIT 5`, [userId]);
    let matchedId = null;
    for (const row of rows.rows) {
      if (await bcrypt.compare(resetToken, row.token_hash)) { matchedId = row.id; break; }
    }
    if (!matchedId) return res.status(400).json({ success:false, message:'Invalid or expired reset link.' });

    const passwordHash = await bcrypt.hash(newPassword, 12);
    // Update password in user_auth (not users!)
    await query(`UPDATE user_auth SET password_hash=$1, failed_login_attempts=0, locked_until=NULL
      WHERE user_id=$2`, [passwordHash, userId]);
    await query(`UPDATE password_reset_tokens SET used=TRUE, used_at=NOW() WHERE id=$1`, [matchedId]);
    await auditLog('password_change', { userId, ip:clientIP(req), ua:deviceInfo(req) });
    logger.info(`[ResetPW] Password reset for user: ${userId}`);
    return res.status(200).json({ success:true, message:'Password reset successfully!' });
  } catch(err) { logger.error('[ResetPW]',err.message); return res.status(500).json({ success:false, message:'Failed.' }); }
};

// ── Validators ────────────────────────────────────────────────────
const registerValidators = [
  body('fullName').trim().notEmpty().isLength({ min:2, max:120 }),
  body('email').isEmail().normalizeEmail(),
  body('phone').matches(/^[6-9]\d{9}$/),
  body('password').isLength({ min:8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
  body('otpChannel').optional().isIn(['email','sms']),
];
const loginValidators = [
  body('identifier').notEmpty(),
  body('password').notEmpty(),
];

module.exports = {
  register, registerValidators,
  verifyRegistration,
  login, loginValidators,
  verifyLoginOTP,
  resendOTP,
  refreshToken,
  logout,
  getMe,
  forgotPassword,
  verifyForgotOTP,
  resetPassword,
};
