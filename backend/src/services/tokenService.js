const jwt    = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../db');
const logger  = require('../utils/logger');

const ACCESS_SECRET  = process.env.JWT_ACCESS_SECRET  || 'fallback_access_secret_change_me';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret_change_me';
const ACCESS_EXPIRES  = process.env.JWT_ACCESS_EXPIRES  || '15m';
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES || '7d';

// ─── Generate access token ───────────────────────────────────────
const generateAccessToken = (payload) => {
  return jwt.sign(
    { ...payload, type: 'access' },
    ACCESS_SECRET,
    { expiresIn: ACCESS_EXPIRES, issuer: 'vaultlife', audience: 'vaultlife-client' }
  );
};

// ─── Generate refresh token ──────────────────────────────────────
const generateRefreshToken = (payload) => {
  return jwt.sign(
    { ...payload, type: 'refresh', jti: uuidv4() },
    REFRESH_SECRET,
    { expiresIn: REFRESH_EXPIRES, issuer: 'vaultlife', audience: 'vaultlife-client' }
  );
};

// ─── Store refresh token in DB ───────────────────────────────────
const storeRefreshToken = async ({ userId, token, ipAddress, deviceInfo }) => {
  const tokenHash = await bcrypt.hash(token, 10);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, ip_address, device_info, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, tokenHash, ipAddress || null, deviceInfo || null, expiresAt]
  );
};

// ─── Verify access token ─────────────────────────────────────────
const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, ACCESS_SECRET, {
      issuer: 'vaultlife',
      audience: 'vaultlife-client'
    });
  } catch (err) {
    return null;
  }
};

// ─── Verify refresh token ────────────────────────────────────────
const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, REFRESH_SECRET, {
      issuer: 'vaultlife',
      audience: 'vaultlife-client'
    });
  } catch (err) {
    return null;
  }
};

// ─── Revoke refresh token ────────────────────────────────────────
const revokeRefreshToken = async (userId) => {
  await query(
    `UPDATE refresh_tokens SET revoked = TRUE, revoked_at = NOW()
     WHERE user_id = $1 AND revoked = FALSE`,
    [userId]
  );
};

// ─── Issue full token pair ───────────────────────────────────────
const issueTokenPair = async ({ user, ipAddress, deviceInfo }) => {
  const payload = {
    sub:      user.id,
    email:    user.email,
    name:     user.full_name,
    phone:    user.phone,
  };

  const accessToken  = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  await storeRefreshToken({ userId: user.id, token: refreshToken, ipAddress, deviceInfo });

  // Update last login
  await query(
    `UPDATE user_auth SET last_login_at = NOW(), last_login_ip = $1 WHERE user_id = $2`,
    [ipAddress || null, user.id]
  );

  return { accessToken, refreshToken };
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  storeRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  revokeRefreshToken,
  issueTokenPair,
};
