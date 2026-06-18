const { verifyAccessToken } = require('../services/tokenService');
const { query } = require('../db');
const logger    = require('../utils/logger');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : req.cookies?.accessToken;

    if (!token)
      return res.status(401).json({ success:false, message:'Authentication required.' });

    const decoded = verifyAccessToken(token);
    if (!decoded)
      return res.status(401).json({ success:false, message:'Invalid or expired token.' });

    // Fetch from user_auth + user_profile (users table is UUID anchor only)
    const result = await query(
      `SELECT u.id, up.full_name, ua.email, ua.phone, ua.status,
              ua.preferred_otp_channel
       FROM users u
       JOIN user_auth    ua ON ua.user_id = u.id
       JOIN user_profile up ON up.user_id = u.id
       WHERE u.id = $1`,
      [decoded.sub]
    );

    if (!result.rows.length || result.rows[0].status !== 'active')
      return res.status(401).json({ success:false, message:'Account not found or inactive.' });

    req.user = result.rows[0];
    next();
  } catch(err) {
    logger.error('[Auth middleware]', err.message);
    return res.status(500).json({ success:false, message:'Authentication error.' });
  }
};

module.exports = { authenticate };
